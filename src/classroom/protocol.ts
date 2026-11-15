/**
 * Live Classroom Broadcasting protocol, room-code helpers, and schema-validated
 * message envelopes (`snapshot.sync`, `command.broadcast`, `ephemeral.stream`,
 * `classroom.control`, and `student.board.update`).
 *
 * Kept free of React Native / Expo imports so it can be verified directly in Node.
 */

import {
  type CanvasDocument,
  type CanvasObject,
  type TextColorKey,
} from '../canvas/document.ts';
import type { GeometryInstrumentState } from '../canvas/geometry-box.ts';
import type { InkPoint, InkStroke } from '../canvas/ink.ts';
import type { LaserColorKey } from '../canvas/laser.ts';
import type { Viewport } from '../canvas/viewport.ts';
import type { BoardSettings } from '../persistence/schema.ts';

export const CLASSROOM_PROTOCOL_VERSION = 1;
export const EPHEMERAL_STREAM_INTERVAL_MS = 33; // ~30 Hz
export const STUDENT_GALLERY_INTERVAL_MS = 3000;
export const MAX_CLASSROOM_STUDENTS = 40;

export type ClassroomRole = 'teacher' | 'student';
export type StudentPermission = 'view-only' | 'can-draw' | 'locked';
export type VoicePermission = 'muted' | 'can-speak';

export type ClassroomParticipant = {
  peerId: string;
  displayName: string;
  role: ClassroomRole;
  permission: StudentPermission;
  voicePermission: VoicePermission;
  handRaised: boolean;
  handRaisedAt?: number;
  joinedAt: string;
  scratchpadUpdatedAt?: number;
};

export type ClassroomRoomInfo = {
  roomCode: string; // 6-digit numeric string, e.g. "482910"
  boardId: string;
  boardTitle: string;
  hostPeerId: string;
  deepLinkUri: string; // e.g. "flowcanvas://join?code=482910"
  isLocked: boolean;
  teacherMuted: boolean;
  activeSpeakerPeerId: string | null;
  followTeacherViewport: boolean;
};

export type EphemeralStrokePacket = {
  strokeId: string;
  authorPeerId: string;
  tool: 'pen' | 'highlighter';
  color: TextColorKey;
  width: number;
  opacity: number;
  points: InkPoint[];
  isDone?: boolean;
};

export type EphemeralLaserPacket = {
  id: string;
  authorPeerId: string;
  colorKey: LaserColorKey;
  points: { x: number; y: number }[];
  active: boolean;
};

export type EphemeralTimerPacket = {
  mode: 'countdown' | 'stopwatch';
  remainingSeconds: number;
  elapsedSeconds: number;
  running: boolean;
};

export type SerializableCanvasCommand =
  | { kind: 'stroke.add'; stroke: InkStroke }
  | { kind: 'strokes.erase'; removedIds: string[]; restoredStrokes?: InkStroke[] }
  | { kind: 'object.create'; object: CanvasObject }
  | {
      kind: 'object.update';
      objectId: string;
      fullObject: CanvasObject;
      previousObject?: CanvasObject;
    }
  | { kind: 'object.delete'; objectId: string; deletedObject?: CanvasObject }
  | { kind: 'batch'; commands: SerializableCanvasCommand[] };

export type ClassroomControlAction =
  | { action: 'hand.raise'; peerId: string; displayName: string; timestamp: number }
  | { action: 'hand.lower'; peerId: string }
  | { action: 'permission.grant'; targetPeerId: string; permission: 'can-draw' }
  | { action: 'permission.revoke'; targetPeerId: string; permission: 'view-only' }
  | { action: 'voice.allow'; targetPeerId: string }
  | { action: 'voice.revoke'; targetPeerId: string | null }
  | { action: 'voice.teacher-mute'; muted: boolean }
  | { action: 'class.lock'; locked: boolean }
  | { action: 'class.end' }
  | { action: 'peer.kick'; targetPeerId: string }
  | {
      action: 'page.switch';
      pageId: string;
      pageName: string;
      pageOrderIndex: number;
      document: CanvasDocument;
      viewport: Viewport;
      boardSettings: BoardSettings;
    }
  | {
      action: 'student.showcase';
      studentPeerId: string | null;
      studentName?: string;
      document?: CanvasDocument;
      viewport?: Viewport;
    }
  | {
      action: 'sync.request';
      requesterPeerId: string;
      displayName?: string;
      lastSeq: number;
    };

export type ClassroomEnvelope =
  | {
      v: number;
      type: 'snapshot.sync';
      roomCode: string;
      senderPeerId: string;
      targetPeerId?: string;
      seq: number;
      sentAt: number;
      payload: {
        roomInfo: ClassroomRoomInfo;
        pageId: string;
        pageName: string;
        pageOrderIndex: number;
        boardSettings: BoardSettings;
        document: CanvasDocument;
        viewport: Viewport;
      };
    }
  | {
      v: number;
      type: 'command.broadcast';
      roomCode: string;
      senderPeerId: string;
      seq: number;
      sentAt: number;
      payload: {
        pageId: string;
        command: SerializableCanvasCommand;
      };
    }
  | {
      v: number;
      type: 'ephemeral.stream';
      roomCode: string;
      senderPeerId: string;
      sentAt: number;
      payload: {
        pageId: string;
        activeStroke?: EphemeralStrokePacket;
        laser?: EphemeralLaserPacket;
        geometryInstrument?: GeometryInstrumentState | null;
        viewport?: Viewport;
        timer?: EphemeralTimerPacket;
      };
    }
  | {
      v: number;
      type: 'classroom.control';
      roomCode: string;
      senderPeerId: string;
      sentAt: number;
      payload: ClassroomControlAction;
    }
  | {
      v: number;
      type: 'student.board.update';
      roomCode: string;
      senderPeerId: string;
      sentAt: number;
      payload: {
        peerId: string;
        displayName: string;
        strokeCount: number;
        objectCount: number;
        document: CanvasDocument;
        viewport: Viewport;
        updatedAt: number;
      };
    };

// ---------------------------------------------------------------- room codes & links

export function generateRoomCode(random: () => number = Math.random): string {
  const num = Math.floor(100000 + random() * 900000);
  return String(Math.min(999999, Math.max(100000, num)));
}

export function normalizeRoomCode(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  return /^\d{6}$/.test(digits) ? digits : null;
}

export function formatRoomCode(code: string): string {
  const normalized = normalizeRoomCode(code);
  if (!normalized) return code;
  return `${normalized.slice(0, 3)} - ${normalized.slice(3, 6)}`;
}

export function buildClassroomDeepLink(roomCode: string): string {
  const normalized = normalizeRoomCode(roomCode) ?? roomCode;
  return `flowcanvas://join?code=${normalized}`;
}

export function parseClassroomDeepLink(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const direct = normalizeRoomCode(trimmed);
  if (direct && trimmed.replace(/[\s-]/g, '') === direct) {
    return direct;
  }
  const match = trimmed.match(/(?:[?&]code=|\/join\/)(\d{6})/i);
  if (match?.[1]) {
    return normalizeRoomCode(match[1]);
  }
  return null;
}

// ---------------------------------------------------------------- command serialization

export function applySerializableCommand(
  doc: CanvasDocument,
  cmd: SerializableCanvasCommand,
): CanvasDocument {
  switch (cmd.kind) {
    case 'stroke.add':
      if (doc.strokes.some((s) => s.id === cmd.stroke.id)) return doc;
      return { ...doc, strokes: [...doc.strokes, cmd.stroke] };
    case 'strokes.erase': {
      const removed = new Set(cmd.removedIds);
      const strokes = doc.strokes.filter((s) => !removed.has(s.id));
      return strokes.length === doc.strokes.length ? doc : { ...doc, strokes };
    }
    case 'object.create':
      if (doc.objects.some((o) => o.id === cmd.object.id)) return doc;
      return { ...doc, objects: [...doc.objects, cmd.object] };
    case 'object.update':
      return {
        ...doc,
        objects: doc.objects.map((o) => (o.id === cmd.objectId ? cmd.fullObject : o)),
      };
    case 'object.delete': {
      const objects = doc.objects.filter((o) => o.id !== cmd.objectId);
      return objects.length === doc.objects.length ? doc : { ...doc, objects };
    }
    case 'batch':
      return cmd.commands.reduce(
        (acc, inner) => applySerializableCommand(acc, inner),
        doc,
      );
  }
}

// ---------------------------------------------------------------- envelope validation

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSerializableCommand(value: unknown): value is SerializableCanvasCommand {
  if (!isRecord(value) || typeof value.kind !== 'string') return false;
  switch (value.kind) {
    case 'stroke.add':
      return isRecord(value.stroke) && typeof value.stroke.id === 'string';
    case 'strokes.erase':
      return Array.isArray(value.removedIds);
    case 'object.create':
      return isRecord(value.object) && typeof value.object.id === 'string';
    case 'object.update':
      return (
        typeof value.objectId === 'string' &&
        isRecord(value.fullObject) &&
        typeof value.fullObject.id === 'string'
      );
    case 'object.delete':
      return typeof value.objectId === 'string';
    case 'batch':
      return (
        Array.isArray(value.commands) &&
        value.commands.every((item) => isSerializableCommand(item))
      );
    default:
      return false;
  }
}

const VALID_CONTROL_ACTIONS = new Set([
  'hand.raise',
  'hand.lower',
  'permission.grant',
  'permission.revoke',
  'voice.allow',
  'voice.revoke',
  'voice.teacher-mute',
  'class.lock',
  'class.end',
  'peer.kick',
  'page.switch',
  'student.showcase',
  'sync.request',
]);

export function parseClassroomEnvelope(raw: unknown): ClassroomEnvelope | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.v !== 'number' || typeof raw.type !== 'string') return null;
  if (typeof raw.roomCode !== 'string' || !normalizeRoomCode(raw.roomCode)) return null;
  if (typeof raw.senderPeerId !== 'string' || raw.senderPeerId.length === 0) return null;
  if (typeof raw.sentAt !== 'number') return null;
  if (!isRecord(raw.payload)) return null;

  switch (raw.type) {
    case 'snapshot.sync': {
      if (typeof raw.seq !== 'number') return null;
      const p = raw.payload;
      if (
        !isRecord(p.roomInfo) ||
        typeof p.pageId !== 'string' ||
        !isRecord(p.document) ||
        !isRecord(p.viewport)
      ) {
        return null;
      }
      return raw as ClassroomEnvelope;
    }
    case 'command.broadcast': {
      if (typeof raw.seq !== 'number') return null;
      const p = raw.payload;
      if (typeof p.pageId !== 'string' || !isSerializableCommand(p.command)) {
        return null;
      }
      return raw as ClassroomEnvelope;
    }
    case 'ephemeral.stream': {
      if (typeof raw.payload.pageId !== 'string') return null;
      return raw as ClassroomEnvelope;
    }
    case 'classroom.control': {
      if (
        typeof raw.payload.action !== 'string' ||
        !VALID_CONTROL_ACTIONS.has(raw.payload.action)
      ) {
        return null;
      }
      return raw as ClassroomEnvelope;
    }
    case 'student.board.update': {
      const p = raw.payload;
      if (
        typeof p.peerId !== 'string' ||
        typeof p.displayName !== 'string' ||
        !isRecord(p.document) ||
        !isRecord(p.viewport)
      ) {
        return null;
      }
      return raw as ClassroomEnvelope;
    }
    default:
      return null;
  }
}
