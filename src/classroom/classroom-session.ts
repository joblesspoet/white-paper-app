/**
 * Live Classroom Session Controller (`src/classroom/classroom-session.ts`).
 *
 * Coordinates Teacher and Student state over a `ClassroomTransport`:
 * - `snapshot.sync` on join / reconnect / page switch
 * - `command.broadcast` with monotonic `seq` & gap-recovery
 * - `ephemeral.stream` throttled at 30 Hz (~33 ms) for zero-lag ink, laser,
 *   Geometry Box, timer, and teacher viewport follow
 * - `classroom.control` for Raise Hand, Pass the Marker (`can-draw`),
 *   1-student-at-a-time Voice allowance, Lock Class, and Student Showcase
 * - `student.board.update` for the Teacher's Student Boards Gallery
 */

import { EMPTY_DOCUMENT, filterPublicDocument, type CanvasDocument } from '../canvas/document.ts';
import type { GeometryInstrumentState } from '../canvas/geometry-box.ts';
import { IDENTITY_VIEWPORT, type Viewport } from '../canvas/viewport.ts';
import { DEFAULT_BOARD_SETTINGS, type BoardSettings } from '../persistence/schema.ts';
import {
  closeClassroomPoll,
  submitPollVote,
  type ClassroomPoll,
} from './poll-model.ts';
import {
  applySerializableCommand,
  buildClassroomDeepLink,
  CLASSROOM_PROTOCOL_VERSION,
  EPHEMERAL_STREAM_INTERVAL_MS,
  filterPublicSerializableCommand,
  generateRoomCode,
  MAX_CLASSROOM_STUDENTS,
  normalizeRoomCode,
  STUDENT_GALLERY_INTERVAL_MS,
  type ClassroomControlAction,
  type ClassroomEnvelope,
  type ClassroomParticipant,
  type ClassroomRole,
  type ClassroomRoomInfo,
  type EphemeralLaserPacket,
  type EphemeralStrokePacket,
  type EphemeralTimerPacket,
  type SerializableCanvasCommand,
  type StudentPermission,
} from './protocol.ts';
import {
  createDefaultClassroomTransport,
  type ClassroomTransport,
  type PresencePeer,
  type TransportStatus,
} from './transport.ts';

export type StudentBoardSnapshot = {
  peerId: string;
  displayName: string;
  strokeCount: number;
  objectCount: number;
  document: CanvasDocument;
  viewport: Viewport;
  updatedAt: number;
};

export type ClassroomSessionCallbacks = {
  onSnapshot?: (snapshot: {
    pageId: string;
    pageName: string;
    pageOrderIndex: number;
    boardSettings: BoardSettings;
    document: CanvasDocument;
    viewport: Viewport;
    roomInfo: ClassroomRoomInfo;
  }) => void;
  onRemoteCommand?: (
    pageId: string,
    command: SerializableCanvasCommand,
    authorPeerId: string,
  ) => void;
  onEphemeral?: (ephemeral: {
    pageId: string;
    senderPeerId: string;
    activeStroke?: EphemeralStrokePacket;
    laser?: EphemeralLaserPacket;
    geometryInstrument?: GeometryInstrumentState | null;
    viewport?: Viewport;
    timer?: EphemeralTimerPacket;
  }) => void;
  onShowcase?: (showcase: {
    studentPeerId: string | null;
    studentName?: string;
    document?: CanvasDocument;
    viewport?: Viewport;
  }) => void;
  onFollowTeacherViewport?: (follow: boolean, viewport?: Viewport) => void;
  onNotice?: (message: string) => void;
  onKicked?: () => void;
  onClassEnded?: () => void;
  onPollChanged?: (poll: ClassroomPoll | null) => void;
};

export type ClassroomSessionState = {
  active: boolean;
  role: ClassroomRole;
  peerId: string;
  displayName: string;
  status: TransportStatus;
  roomInfo: ClassroomRoomInfo | null;
  participants: ClassroomParticipant[];
  myPermission: StudentPermission;
  myHandRaised: boolean;
  myCanSpeak: boolean;
  seq: number;
  hasSnapshot: boolean;
  rejectedCommandsCount: number;
  studentBoards: Record<string, StudentBoardSnapshot>;
  showcasedStudentPeerId: string | null;
  activePoll: ClassroomPoll | null;
};

function makePeerId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export class ClassroomSession {
  private transport: ClassroomTransport;
  private callbacks: ClassroomSessionCallbacks;
  private unsubMessage: (() => void) | null = null;
  private unsubPresence: (() => void) | null = null;
  private unsubStatus: (() => void) | null = null;
  private listeners = new Set<(state: ClassroomSessionState) => void>();

  private state: ClassroomSessionState;

  // Teacher's latest board state for late joiners & reconnects
  private hostBoardState: {
    pageId: string;
    pageName: string;
    pageOrderIndex: number;
    boardSettings: BoardSettings;
    document: CanvasDocument;
    viewport: Viewport;
  } = {
    pageId: 'page-1',
    pageName: 'Page 1',
    pageOrderIndex: 0,
    boardSettings: DEFAULT_BOARD_SETTINGS,
    document: EMPTY_DOCUMENT,
    viewport: IDENTITY_VIEWPORT,
  };

  private lastEphemeralSentAt = 0;
  private lastGallerySentAt = 0;
  private seenInPresence = new Set<string>();
  private syncRetryTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    transport: ClassroomTransport = createDefaultClassroomTransport(),
    callbacks: ClassroomSessionCallbacks = {},
    peerId?: string,
  ) {
    this.transport = transport;
    this.callbacks = callbacks;
    this.state = {
      active: false,
      role: 'teacher',
      peerId: peerId ?? makePeerId('peer'),
      displayName: 'Teacher',
      status: 'disconnected',
      roomInfo: null,
      participants: [],
      myPermission: 'view-only',
      myHandRaised: false,
      myCanSpeak: false,
      seq: 0,
      hasSnapshot: false,
      rejectedCommandsCount: 0,
      studentBoards: {},
      showcasedStudentPeerId: null,
      activePoll: null,
    };
  }

  setCallbacks(callbacks: ClassroomSessionCallbacks) {
    this.callbacks = callbacks;
  }

  getState(): ClassroomSessionState {
    return this.state;
  }

  subscribe(listener: (state: ClassroomSessionState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private updateState(patch: Partial<ClassroomSessionState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  private bindTransport() {
    this.seenInPresence.clear();
    this.unbindTransport();
    this.unsubMessage = this.transport.onMessage((env) => this.handleEnvelope(env));
    this.unsubPresence = this.transport.onPresence((peers) => this.handlePresence(peers));
    this.unsubStatus = this.transport.onStatus((status) => {
      this.updateState({ status });
      if (status === 'connected' && this.state.role === 'student' && !this.state.hasSnapshot) {
        void this.requestSync();
      }
    });
  }

  private unbindTransport() {
    this.unsubMessage?.();
    this.unsubPresence?.();
    this.unsubStatus?.();
    this.unsubMessage = null;
    this.unsubPresence = null;
    this.unsubStatus = null;
  }

  // ---------------------------------------------------------------- lifecycle

  async startAsTeacher(params: {
    boardId: string;
    boardTitle: string;
    pageId: string;
    pageName: string;
    pageOrderIndex: number;
    boardSettings: BoardSettings;
    document: CanvasDocument;
    viewport: Viewport;
    displayName?: string;
    roomCode?: string;
    voiceEnabled?: boolean;
    maxStudents?: number;
    ephemeralIntervalMs?: number;
  }): Promise<ClassroomRoomInfo> {
    const code = normalizeRoomCode(params.roomCode ?? '') ?? generateRoomCode();
    const displayName = params.displayName?.trim() || 'Teacher';
    const voiceEnabled = params.voiceEnabled ?? true;
    const roomInfo: ClassroomRoomInfo = {
      roomCode: code,
      boardId: params.boardId,
      boardTitle: params.boardTitle,
      hostPeerId: this.state.peerId,
      deepLinkUri: buildClassroomDeepLink(code),
      isLocked: false,
      teacherMuted: !voiceEnabled,
      activeSpeakerPeerId: null,
      followTeacherViewport: true,
      voiceEnabled,
      maxStudents: params.maxStudents ?? MAX_CLASSROOM_STUDENTS,
      ...(params.ephemeralIntervalMs ? { ephemeralIntervalMs: params.ephemeralIntervalMs } : {}),
    };

    this.hostBoardState = {
      pageId: params.pageId,
      pageName: params.pageName,
      pageOrderIndex: params.pageOrderIndex,
      boardSettings: params.boardSettings,
      document: filterPublicDocument(params.document),
      viewport: params.viewport,
    };

    this.seenInPresence.clear();
    this.updateState({
      active: true,
      role: 'teacher',
      displayName,
      roomInfo,
      participants: [],
      myPermission: 'can-draw',
      myHandRaised: false,
      myCanSpeak: true,
      seq: 0,
      hasSnapshot: true,
      rejectedCommandsCount: 0,
      studentBoards: {},
      showcasedStudentPeerId: null,
      activePoll: null,
    });

    this.bindTransport();
    try {
      await this.transport.connect(code, {
        peerId: this.state.peerId,
        displayName,
        role: 'teacher',
        joinedAt: new Date().toISOString(),
      });
    } catch (error) {
      await this.endOrLeave();
      throw error;
    }

    return roomInfo;
  }

  async joinAsStudent(params: {
    roomCode: string;
    displayName: string;
  }): Promise<void> {
    const code = normalizeRoomCode(params.roomCode);
    if (!code) {
      throw new Error('Enter a valid 6-digit classroom code.');
    }
    const displayName = params.displayName.trim() || 'Student';

    this.seenInPresence.clear();
    this.updateState({
      active: true,
      role: 'student',
      displayName,
      roomInfo: {
        roomCode: code,
        boardId: '',
        boardTitle: 'Live Class',
        hostPeerId: '',
        deepLinkUri: buildClassroomDeepLink(code),
        isLocked: false,
        teacherMuted: false,
        activeSpeakerPeerId: null,
        followTeacherViewport: true,
      },
      participants: [],
      myPermission: 'view-only',
      myHandRaised: false,
      myCanSpeak: false,
      seq: 0,
      hasSnapshot: false,
      rejectedCommandsCount: 0,
      studentBoards: {},
      showcasedStudentPeerId: null,
      activePoll: null,
    });

    this.bindTransport();
    await this.transport.connect(code, {
      peerId: this.state.peerId,
      displayName,
      role: 'student',
      joinedAt: new Date().toISOString(),
    });

    await this.requestSync();
    this.startSyncRetry();
  }

  private startSyncRetry() {
    this.stopSyncRetry();
    let attempts = 0;
    this.syncRetryTimer = setInterval(() => {
      attempts += 1;
      if (
        !this.state.active ||
        this.state.role !== 'student' ||
        this.state.hasSnapshot ||
        attempts > 10
      ) {
        this.stopSyncRetry();
        return;
      }
      void this.requestSync();
    }, 1500);
    if (typeof (this.syncRetryTimer as { unref?: () => void }).unref === 'function') {
      (this.syncRetryTimer as { unref: () => void }).unref();
    }
  }

  private stopSyncRetry() {
    if (this.syncRetryTimer) {
      clearInterval(this.syncRetryTimer);
      this.syncRetryTimer = null;
    }
  }

  async resume(): Promise<void> {
    if (!this.state.active || !this.state.roomInfo) return;
    if (this.state.status === 'disconnected' || this.state.status === 'error') {
      await this.transport.connect(this.state.roomInfo.roomCode, {
        peerId: this.state.peerId,
        displayName: this.state.displayName,
        role: this.state.role,
        joinedAt: new Date().toISOString(),
      });
    }
    if (this.state.role === 'student') {
      await this.requestSync();
    }
  }

  async endOrLeave(): Promise<void> {
    this.stopSyncRetry();
    if (this.state.active && this.state.role === 'teacher' && this.state.roomInfo) {
      await this.sendControl({ action: 'class.end' });
    }
    this.seenInPresence.clear();
    this.unbindTransport();
    await this.transport.disconnect();
    this.updateState({
      active: false,
      status: 'disconnected',
      roomInfo: null,
      participants: [],
      myHandRaised: false,
      myCanSpeak: false,
      hasSnapshot: false,
      studentBoards: {},
      showcasedStudentPeerId: null,
      activePoll: null,
    });
  }

  // ---------------------------------------------------------------- host state & broadcast

  updateHostSnapshot(snapshot: {
    pageId: string;
    pageName: string;
    pageOrderIndex: number;
    boardSettings: BoardSettings;
    document: CanvasDocument;
    viewport: Viewport;
  }) {
    this.hostBoardState = {
      ...snapshot,
      document: filterPublicDocument(snapshot.document),
    };
  }

  updateHostViewport(viewport: Viewport) {
    if (this.state.role !== 'teacher') return;
    this.hostBoardState = {
      ...this.hostBoardState,
      viewport,
    };
  }

  async sendSnapshotTo(targetPeerId?: string): Promise<void> {
    if (this.state.role !== 'teacher' || !this.state.roomInfo) return;
    const envelope: ClassroomEnvelope = {
      v: CLASSROOM_PROTOCOL_VERSION,
      type: 'snapshot.sync',
      roomCode: this.state.roomInfo.roomCode,
      senderPeerId: this.state.peerId,
      targetPeerId,
      seq: this.state.seq,
      sentAt: Date.now(),
      payload: {
        roomInfo: this.state.roomInfo,
        ...this.hostBoardState,
        document: filterPublicDocument(this.hostBoardState.document),
      },
    };
    await this.transport.send(envelope);
  }

  async broadcastCommand(
    pageId: string,
    command: SerializableCanvasCommand,
  ): Promise<void> {
    if (!this.state.active || !this.state.roomInfo) return;
    if (this.state.role === 'student') {
      if (this.state.myPermission !== 'can-draw' || this.state.roomInfo.isLocked) {
        return;
      }
    }
    const publicCommand =
      this.state.role === 'teacher' ? filterPublicSerializableCommand(command) : command;
    if (!publicCommand) return;
    const nextSeq = this.state.seq + 1;
    this.updateState({ seq: nextSeq });
    const envelope: ClassroomEnvelope = {
      v: CLASSROOM_PROTOCOL_VERSION,
      type: 'command.broadcast',
      roomCode: this.state.roomInfo.roomCode,
      senderPeerId: this.state.peerId,
      seq: nextSeq,
      sentAt: Date.now(),
      payload: { pageId, command: publicCommand },
    };
    await this.transport.send(envelope);
  }

  async sendEphemeral(
    payload: {
      pageId: string;
      activeStroke?: EphemeralStrokePacket;
      laser?: EphemeralLaserPacket;
      geometryInstrument?: GeometryInstrumentState | null;
      viewport?: Viewport;
      timer?: EphemeralTimerPacket;
    },
    force = false,
  ): Promise<void> {
    if (!this.state.active || !this.state.roomInfo) return;
    if (
      this.state.role === 'student' &&
      (this.state.myPermission !== 'can-draw' || this.state.roomInfo.isLocked)
    ) {
      return;
    }

    const now = Date.now();
    const isTerminalPacket =
      force ||
      payload.activeStroke?.isDone === true ||
      payload.laser?.active === false;
    const minInterval = this.state.roomInfo.ephemeralIntervalMs ?? EPHEMERAL_STREAM_INTERVAL_MS;
    if (!isTerminalPacket && now - this.lastEphemeralSentAt < minInterval) {
      return;
    }
    this.lastEphemeralSentAt = now;

    const envelope: ClassroomEnvelope = {
      v: CLASSROOM_PROTOCOL_VERSION,
      type: 'ephemeral.stream',
      roomCode: this.state.roomInfo.roomCode,
      senderPeerId: this.state.peerId,
      sentAt: now,
      payload,
    };
    await this.transport.send(envelope);
  }

  async broadcastPageSwitch(params: {
    pageId: string;
    pageName: string;
    pageOrderIndex: number;
    boardSettings: BoardSettings;
    document: CanvasDocument;
    viewport: Viewport;
  }): Promise<void> {
    if (this.state.role !== 'teacher' || !this.state.roomInfo) return;
    const sanitized = {
      ...params,
      document: filterPublicDocument(params.document),
    };
    this.hostBoardState = sanitized;
    const nextSeq = this.state.seq + 1;
    this.updateState({ seq: nextSeq });
    await this.sendControl({
      action: 'page.switch',
      ...sanitized,
    });
  }

  // ---------------------------------------------------------------- pop-quiz polls

  async startPoll(poll: ClassroomPoll): Promise<void> {
    if (this.state.role !== 'teacher' || !this.state.active) return;
    this.updateState({ activePoll: poll });
    this.callbacks.onPollChanged?.(poll);
    await this.sendControl({ action: 'poll.start', poll });
  }

  async voteInPoll(pollId: string, optionId: string): Promise<void> {
    if (!this.state.active) return;
    const current = this.state.activePoll;
    if (!current || current.id !== pollId) return;
    const next = submitPollVote(current, this.state.peerId, optionId);
    if (next !== current) {
      this.updateState({ activePoll: next });
      this.callbacks.onPollChanged?.(next);
    }
    await this.sendControl({
      action: 'poll.vote',
      pollId,
      peerId: this.state.peerId,
      optionId,
    });
  }

  async closePoll(pollId: string): Promise<void> {
    if (this.state.role !== 'teacher' || !this.state.active) return;
    const current = this.state.activePoll;
    if (!current || current.id !== pollId) return;
    const closedAt = Date.now();
    const closed = closeClassroomPoll(current, closedAt);
    this.updateState({ activePoll: closed });
    this.callbacks.onPollChanged?.(closed);
    await this.sendControl({ action: 'poll.close', pollId, closedAt });
  }

  clearPoll(): void {
    this.updateState({ activePoll: null });
    this.callbacks.onPollChanged?.(null);
  }

  // ---------------------------------------------------------------- teacher moderation

  async grantDrawPermission(targetPeerId: string): Promise<void> {
    if (this.state.role !== 'teacher') return;
    this.patchParticipant(targetPeerId, { permission: 'can-draw', handRaised: false });
    await this.sendControl({
      action: 'permission.grant',
      targetPeerId,
      permission: 'can-draw',
    });
  }

  async revokeDrawPermission(targetPeerId: string): Promise<void> {
    if (this.state.role !== 'teacher') return;
    this.patchParticipant(targetPeerId, { permission: 'view-only' });
    await this.sendControl({
      action: 'permission.revoke',
      targetPeerId,
      permission: 'view-only',
    });
  }

  /**
   * Grants voice permission to **one student at a time**.
   * Automatically revokes any previously active student speaker.
   */
  async allowStudentVoice(targetPeerId: string): Promise<void> {
    if (this.state.role !== 'teacher' || !this.state.roomInfo) return;
    const prevSpeaker = this.state.roomInfo.activeSpeakerPeerId;
    if (prevSpeaker && prevSpeaker !== targetPeerId) {
      this.patchParticipant(prevSpeaker, { voicePermission: 'muted' });
      await this.sendControl({ action: 'voice.revoke', targetPeerId: prevSpeaker });
    }
    this.patchParticipant(targetPeerId, {
      voicePermission: 'can-speak',
      handRaised: false,
    });
    this.updateState({
      roomInfo: { ...this.state.roomInfo, activeSpeakerPeerId: targetPeerId },
    });
    await this.sendControl({ action: 'voice.allow', targetPeerId });
  }

  async revokeStudentVoice(targetPeerId?: string): Promise<void> {
    if (this.state.role !== 'teacher' || !this.state.roomInfo) return;
    const target = targetPeerId ?? this.state.roomInfo.activeSpeakerPeerId;
    if (target) {
      this.patchParticipant(target, { voicePermission: 'muted' });
    }
    this.updateState({
      roomInfo: { ...this.state.roomInfo, activeSpeakerPeerId: null },
    });
    await this.sendControl({ action: 'voice.revoke', targetPeerId: target ?? null });
  }

  async setTeacherMuted(muted: boolean): Promise<void> {
    if (this.state.role !== 'teacher' || !this.state.roomInfo) return;
    this.updateState({
      roomInfo: { ...this.state.roomInfo, teacherMuted: muted },
    });
    await this.sendControl({ action: 'voice.teacher-mute', muted });
  }

  async setClassLocked(locked: boolean): Promise<void> {
    if (this.state.role !== 'teacher' || !this.state.roomInfo) return;
    if (locked && this.state.roomInfo.activeSpeakerPeerId) {
      await this.revokeStudentVoice(this.state.roomInfo.activeSpeakerPeerId);
    }
    const participants = this.state.participants.map((p) =>
      p.role === 'student'
        ? { ...p, permission: locked ? ('locked' as const) : ('view-only' as const) }
        : p,
    );
    this.updateState({
      roomInfo: { ...this.state.roomInfo, isLocked: locked },
      participants,
    });
    await this.sendControl({ action: 'class.lock', locked });
  }

  async setFollowTeacherViewport(follow: boolean): Promise<void> {
    if (!this.state.roomInfo) return;
    this.updateState({
      roomInfo: { ...this.state.roomInfo, followTeacherViewport: follow },
    });
    if (this.state.role === 'teacher') {
      await this.sendControl({
        action: 'viewport.follow',
        follow,
        viewport: follow ? this.hostBoardState.viewport : undefined,
      });
      if (follow) {
        await this.sendEphemeral(
          { pageId: this.hostBoardState.pageId, viewport: this.hostBoardState.viewport },
          true,
        );
      }
    }
  }

  async lowerStudentHand(peerId: string): Promise<void> {
    this.patchParticipant(peerId, { handRaised: false, handRaisedAt: undefined });
    await this.sendControl({ action: 'hand.lower', peerId });
  }

  async showcaseStudentBoard(studentPeerId: string | null): Promise<void> {
    if (this.state.role !== 'teacher') return;
    if (!studentPeerId) {
      this.updateState({ showcasedStudentPeerId: null });
      await this.sendControl({ action: 'student.showcase', studentPeerId: null });
      return;
    }
    const snapshot = this.state.studentBoards[studentPeerId];
    if (!snapshot) return;
    this.updateState({ showcasedStudentPeerId: studentPeerId });
    await this.sendControl({
      action: 'student.showcase',
      studentPeerId,
      studentName: snapshot.displayName,
      document: snapshot.document,
      viewport: snapshot.viewport,
    });
  }

  async kickParticipant(targetPeerId: string): Promise<void> {
    if (this.state.role !== 'teacher') return;
    const nextBoards = { ...this.state.studentBoards };
    delete nextBoards[targetPeerId];
    const wasActiveSpeaker = this.state.roomInfo?.activeSpeakerPeerId === targetPeerId;
    const wasShowcased = this.state.showcasedStudentPeerId === targetPeerId;
    this.updateState({
      participants: this.state.participants.filter((p) => p.peerId !== targetPeerId),
      studentBoards: nextBoards,
      roomInfo:
        this.state.roomInfo && wasActiveSpeaker
          ? { ...this.state.roomInfo, activeSpeakerPeerId: null }
          : this.state.roomInfo,
    });
    if (wasShowcased) {
      await this.showcaseStudentBoard(null);
    }
    await this.sendControl({ action: 'peer.kick', targetPeerId });
  }

  // ---------------------------------------------------------------- student actions

  async raiseHand(): Promise<void> {
    if (this.state.role !== 'student') return;
    this.updateState({ myHandRaised: true });
    await this.sendControl({
      action: 'hand.raise',
      peerId: this.state.peerId,
      displayName: this.state.displayName,
      timestamp: Date.now(),
    });
  }

  async lowerHand(): Promise<void> {
    if (this.state.role !== 'student') return;
    this.updateState({ myHandRaised: false });
    await this.sendControl({ action: 'hand.lower', peerId: this.state.peerId });
  }

  async requestSync(): Promise<void> {
    if (this.state.role !== 'student') return;
    await this.sendControl({
      action: 'sync.request',
      requesterPeerId: this.state.peerId,
      displayName: this.state.displayName,
      lastSeq: this.state.seq,
    });
  }

  async sendStudentScratchpad(
    document: CanvasDocument,
    viewport: Viewport,
    force = false,
  ): Promise<void> {
    if (this.state.role !== 'student' || !this.state.roomInfo) return;
    const now = Date.now();
    if (!force && now - this.lastGallerySentAt < STUDENT_GALLERY_INTERVAL_MS) return;
    this.lastGallerySentAt = now;

    const envelope: ClassroomEnvelope = {
      v: CLASSROOM_PROTOCOL_VERSION,
      type: 'student.board.update',
      roomCode: this.state.roomInfo.roomCode,
      senderPeerId: this.state.peerId,
      sentAt: now,
      payload: {
        peerId: this.state.peerId,
        displayName: this.state.displayName,
        strokeCount: document.strokes.length,
        objectCount: document.objects.length,
        document,
        viewport,
        updatedAt: now,
      },
    };
    await this.transport.send(envelope);
  }

  // ---------------------------------------------------------------- incoming handlers

  private async sendControl(payload: ClassroomControlAction): Promise<void> {
    if (!this.state.roomInfo) return;
    const envelope: ClassroomEnvelope = {
      v: CLASSROOM_PROTOCOL_VERSION,
      type: 'classroom.control',
      roomCode: this.state.roomInfo.roomCode,
      senderPeerId: this.state.peerId,
      sentAt: Date.now(),
      payload,
    };
    await this.transport.send(envelope);
  }

  private patchParticipant(peerId: string, patch: Partial<ClassroomParticipant>) {
    this.updateState({
      participants: this.state.participants.map((p) =>
        p.peerId === peerId ? { ...p, ...patch } : p,
      ),
    });
  }

  private handlePresence(peers: PresencePeer[]) {
    const existingById = new Map(this.state.participants.map((p) => [p.peerId, p]));
    const nextList: ClassroomParticipant[] = [];
    const seenIds = new Set<string>();
    const newlyJoinedStudents: string[] = [];
    const roomCap = this.state.roomInfo?.maxStudents ?? MAX_CLASSROOM_STUDENTS;

    for (const peer of peers) {
      this.seenInPresence.add(peer.peerId);
      if (peer.peerId === this.state.peerId) continue;
      if (
        peer.role === 'student' &&
        nextList.filter((p) => p.role === 'student').length >= roomCap
      ) {
        continue;
      }
      seenIds.add(peer.peerId);
      const existing = existingById.get(peer.peerId);
      if (existing) {
        nextList.push({ ...existing, displayName: peer.displayName });
      } else {
        if (peer.role === 'student') newlyJoinedStudents.push(peer.peerId);
        nextList.push({
          peerId: peer.peerId,
          displayName: peer.displayName,
          role: peer.role,
          permission: this.state.roomInfo?.isLocked ? 'locked' : 'view-only',
          voicePermission: 'muted',
          handRaised: false,
          joinedAt: peer.joinedAt,
        });
      }
    }

    // Preserve students who joined via `sync.request` before their presence event arrived.
    for (const existing of this.state.participants) {
      if (seenIds.has(existing.peerId)) continue;
      if (!this.seenInPresence.has(existing.peerId)) {
        nextList.push(existing);
      }
    }

    this.updateState({ participants: nextList });

    if (
      this.state.role === 'teacher' &&
      this.state.roomInfo &&
      !this.state.roomInfo.isLocked &&
      roomCap === 1 &&
      nextList.filter((p) => p.role === 'student').length >= 1
    ) {
      void this.setClassLocked(true);
    }

    // Teacher sends snapshot.sync to newly joined students
    if (this.state.role === 'teacher' && newlyJoinedStudents.length > 0) {
      for (const studentId of newlyJoinedStudents) {
        if (this.state.roomInfo?.isLocked) {
          void this.sendControl({ action: 'peer.kick', targetPeerId: studentId });
        } else {
          void this.sendSnapshotTo(studentId);
        }
      }
    }
  }

  private handleEnvelope(envelope: ClassroomEnvelope) {
    if (!this.state.active || !this.state.roomInfo) return;
    if (envelope.roomCode !== this.state.roomInfo.roomCode) return;

    switch (envelope.type) {
      case 'snapshot.sync': {
        if (this.state.role !== 'student') return;
        if (envelope.targetPeerId && envelope.targetPeerId !== this.state.peerId) return;
        this.stopSyncRetry();
        const { roomInfo, pageId, pageName, pageOrderIndex, boardSettings, document, viewport } =
          envelope.payload;
        this.updateState({
          roomInfo,
          seq: envelope.seq,
          hasSnapshot: true,
          myPermission: roomInfo.isLocked ? 'locked' : this.state.myPermission,
          myCanSpeak: roomInfo.activeSpeakerPeerId === this.state.peerId,
        });
        this.callbacks.onSnapshot?.({
          pageId,
          pageName,
          pageOrderIndex,
          boardSettings,
          document,
          viewport,
          roomInfo,
        });
        return;
      }

      case 'command.broadcast': {
        if (this.state.role === 'teacher') {
          const sender = this.state.participants.find(
            (p) => p.peerId === envelope.senderPeerId,
          );
          if (
            this.state.roomInfo.isLocked ||
            !sender ||
            sender.permission !== 'can-draw'
          ) {
            this.updateState({
              rejectedCommandsCount: this.state.rejectedCommandsCount + 1,
            });
            return;
          }
          // Apply to host snapshot & re-broadcast with authoritative teacher seq
          if (envelope.payload.pageId === this.hostBoardState.pageId) {
            this.hostBoardState = {
              ...this.hostBoardState,
              document: applySerializableCommand(
                this.hostBoardState.document,
                envelope.payload.command,
              ),
            };
          }
          this.callbacks.onRemoteCommand?.(
            envelope.payload.pageId,
            envelope.payload.command,
            envelope.senderPeerId,
          );
          void this.broadcastCommand(envelope.payload.pageId, envelope.payload.command);
          return;
        }

        // Student side: accept only authoritative teacher broadcasts, check seq ordering
        if (envelope.senderPeerId === this.state.peerId) return;
        if (
          this.state.roomInfo.hostPeerId &&
          envelope.senderPeerId !== this.state.roomInfo.hostPeerId
        ) {
          return;
        }
        if (envelope.seq <= this.state.seq) return;
        if (!this.state.hasSnapshot || envelope.seq > this.state.seq + 1) {
          void this.requestSync();
        }
        this.updateState({ seq: envelope.seq });
        this.callbacks.onRemoteCommand?.(
          envelope.payload.pageId,
          envelope.payload.command,
          envelope.senderPeerId,
        );
        return;
      }

      case 'ephemeral.stream': {
        if (envelope.senderPeerId === this.state.peerId) return;
        if (this.state.role === 'teacher') {
          const sender = this.state.participants.find(
            (p) => p.peerId === envelope.senderPeerId,
          );
          if (!sender || sender.permission !== 'can-draw' || this.state.roomInfo.isLocked) {
            return;
          }
        }
        this.callbacks.onEphemeral?.({
          senderPeerId: envelope.senderPeerId,
          ...envelope.payload,
        });
        return;
      }

      case 'student.board.update': {
        if (this.state.role !== 'teacher') return;
        const p = envelope.payload;
        this.updateState({
          studentBoards: {
            ...this.state.studentBoards,
            [p.peerId]: p,
          },
        });
        this.patchParticipant(p.peerId, { scratchpadUpdatedAt: p.updatedAt });
        return;
      }

      case 'classroom.control': {
        this.handleControl(envelope.payload, envelope.senderPeerId);
      }
    }
  }

  private handleControl(action: ClassroomControlAction, senderPeerId: string) {
    switch (action.action) {
      case 'hand.raise': {
        this.patchParticipant(action.peerId, {
          handRaised: true,
          handRaisedAt: action.timestamp,
        });
        if (this.state.role === 'teacher') {
          this.callbacks.onNotice?.(`${action.displayName} raised their hand 👋`);
        }
        return;
      }
      case 'hand.lower': {
        this.patchParticipant(action.peerId, {
          handRaised: false,
          handRaisedAt: undefined,
        });
        return;
      }
      case 'permission.grant': {
        this.patchParticipant(action.targetPeerId, {
          permission: 'can-draw',
          handRaised: false,
        });
        if (action.targetPeerId === this.state.peerId) {
          this.updateState({ myPermission: 'can-draw', myHandRaised: false });
          this.callbacks.onNotice?.('Teacher passed you the marker! You can draw now.');
        }
        return;
      }
      case 'permission.revoke': {
        this.patchParticipant(action.targetPeerId, { permission: 'view-only' });
        if (action.targetPeerId === this.state.peerId) {
          this.updateState({ myPermission: 'view-only' });
          this.callbacks.onNotice?.('Drawing access returned to view-only.');
        }
        return;
      }
      case 'voice.allow': {
        if (this.state.roomInfo) {
          this.updateState({
            roomInfo: { ...this.state.roomInfo, activeSpeakerPeerId: action.targetPeerId },
          });
        }
        if (action.targetPeerId === this.state.peerId) {
          this.updateState({ myCanSpeak: true, myHandRaised: false });
          this.callbacks.onNotice?.('Teacher allowed you to speak! Mic unlocked.');
        } else if (this.state.myCanSpeak) {
          this.updateState({ myCanSpeak: false });
        }
        return;
      }
      case 'voice.revoke': {
        if (this.state.roomInfo) {
          this.updateState({
            roomInfo: { ...this.state.roomInfo, activeSpeakerPeerId: null },
          });
        }
        if (!action.targetPeerId || action.targetPeerId === this.state.peerId) {
          if (this.state.myCanSpeak) {
            this.updateState({ myCanSpeak: false });
            this.callbacks.onNotice?.('Your mic was muted by the teacher.');
          }
        }
        return;
      }
      case 'voice.teacher-mute': {
        if (this.state.roomInfo) {
          this.updateState({
            roomInfo: { ...this.state.roomInfo, teacherMuted: action.muted },
          });
        }
        return;
      }
      case 'class.lock': {
        if (this.state.roomInfo) {
          this.updateState({
            roomInfo: { ...this.state.roomInfo, isLocked: action.locked },
            myPermission: action.locked
              ? 'locked'
              : this.state.myPermission === 'locked'
                ? 'view-only'
                : this.state.myPermission,
          });
        }
        if (this.state.role === 'student') {
          this.callbacks.onNotice?.(
            action.locked ? 'Class locked by teacher.' : 'Class unlocked by teacher.',
          );
        }
        return;
      }
      case 'viewport.follow': {
        if (this.state.roomInfo) {
          this.updateState({
            roomInfo: { ...this.state.roomInfo, followTeacherViewport: action.follow },
          });
        }
        if (this.state.role === 'student') {
          this.callbacks.onFollowTeacherViewport?.(action.follow, action.viewport);
        }
        return;
      }
      case 'page.switch': {
        if (this.state.role !== 'student' || !this.state.roomInfo) return;
        this.callbacks.onSnapshot?.({
          pageId: action.pageId,
          pageName: action.pageName,
          pageOrderIndex: action.pageOrderIndex,
          boardSettings: action.boardSettings,
          document: action.document,
          viewport: action.viewport,
          roomInfo: this.state.roomInfo,
        });
        return;
      }
      case 'student.showcase': {
        this.updateState({ showcasedStudentPeerId: action.studentPeerId });
        this.callbacks.onShowcase?.({
          studentPeerId: action.studentPeerId,
          studentName: action.studentName,
          document: action.document,
          viewport: action.viewport,
        });
        return;
      }
      case 'sync.request': {
        if (this.state.role === 'teacher') {
          const cleanName = action.displayName?.trim() || 'Student';
          const existing = this.state.participants.find(
            (p) => p.peerId === action.requesterPeerId,
          );
          if (!existing && action.requesterPeerId !== this.state.peerId) {
            const roomCap = this.state.roomInfo?.maxStudents ?? 1;
            const currentStudents = this.state.participants.filter((p) => p.role === 'student');
            if (this.state.roomInfo?.isLocked || currentStudents.length >= roomCap) {
              void this.sendControl({ action: 'peer.kick', targetPeerId: action.requesterPeerId });
              return;
            }
            const nextParticipants = [
              ...this.state.participants,
              {
                peerId: action.requesterPeerId,
                displayName: cleanName,
                role: 'student' as const,
                permission: 'view-only' as const,
                voicePermission: 'muted' as const,
                handRaised: false,
                joinedAt: new Date().toISOString(),
              },
            ];
            this.updateState({
              participants: nextParticipants,
            });
            if (nextParticipants.filter((p) => p.role === 'student').length >= roomCap) {
              void this.setClassLocked(true);
            }
          } else if (existing && existing.displayName === 'Student' && cleanName !== 'Student') {
            this.patchParticipant(action.requesterPeerId, { displayName: cleanName });
          }
          void this.sendSnapshotTo(senderPeerId);
        }
        return;
      }
      case 'peer.kick': {
        if (action.targetPeerId === this.state.peerId) {
          this.callbacks.onKicked?.();
          void this.endOrLeave();
        }
        return;
      }
      case 'class.end': {
        if (this.state.role === 'student') {
          this.callbacks.onClassEnded?.();
          void this.endOrLeave();
        }
        return;
      }
      case 'poll.start': {
        this.updateState({ activePoll: action.poll });
        this.callbacks.onPollChanged?.(action.poll);
        if (this.state.role === 'student') {
          this.callbacks.onNotice?.(`Quick Poll: ${action.poll.question}`);
        }
        return;
      }
      case 'poll.vote': {
        const current = this.state.activePoll;
        if (!current || current.id !== action.pollId) return;
        const next = submitPollVote(current, action.peerId, action.optionId);
        if (next !== current) {
          this.updateState({ activePoll: next });
          this.callbacks.onPollChanged?.(next);
        }
        return;
      }
      case 'poll.close': {
        const current = this.state.activePoll;
        if (!current || current.id !== action.pollId) return;
        const closed = closeClassroomPoll(current, action.closedAt);
        this.updateState({ activePoll: closed });
        this.callbacks.onPollChanged?.(closed);
        return;
      }
    }
  }
}
