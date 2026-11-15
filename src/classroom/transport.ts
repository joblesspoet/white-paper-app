/**
 * Classroom Transport abstraction with:
 * 1. `SupabaseRealtimeTransport` — zero-dependency Phoenix Channels WebSocket
 *    client for Supabase Realtime Broadcast + Presence (`classroom:<code>`).
 * 2. `LocalLoopbackTransport` — in-memory multi-peer hub for offline demos
 *    and automated Node verification (`scripts/verify-live-classroom.mts`).
 */

import {
  parseClassroomEnvelope,
  type ClassroomEnvelope,
  type ClassroomRole,
} from './protocol.ts';

export type TransportStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

export type PresencePeer = {
  peerId: string;
  displayName: string;
  role: ClassroomRole;
  joinedAt: string;
};

export interface ClassroomTransport {
  readonly kind: 'supabase' | 'loopback';
  connect(
    roomCode: string,
    peer: PresencePeer,
  ): Promise<void>;
  disconnect(): Promise<void>;
  send(envelope: ClassroomEnvelope): Promise<void>;
  onMessage(listener: (envelope: ClassroomEnvelope) => void): () => void;
  onPresence(listener: (peers: PresencePeer[]) => void): () => void;
  onStatus(listener: (status: TransportStatus, detail?: string) => void): () => void;
}

// ---------------------------------------------------------------- config helpers

export function getSupabaseConfig(): { url: string; anonKey: string } | null {
  const url =
    typeof process !== 'undefined' ? process.env?.EXPO_PUBLIC_SUPABASE_URL?.trim() : undefined;
  const anonKey =
    typeof process !== 'undefined' ? process.env?.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() : undefined;
  if (!url || !anonKey) return null;
  return { url: url.replace(/\/+$/, ''), anonKey };
}

export function hasSupabaseConfig(): boolean {
  return getSupabaseConfig() !== null;
}

// ---------------------------------------------------------------- LocalLoopbackTransport

export class LoopbackHub {
  private rooms = new Map<string, Set<LocalLoopbackTransport>>();

  join(roomCode: string, peerTransport: LocalLoopbackTransport) {
    let set = this.rooms.get(roomCode);
    if (!set) {
      set = new Set();
      this.rooms.set(roomCode, set);
    }
    set.add(peerTransport);
    this.broadcastPresence(roomCode);
  }

  leave(roomCode: string, peerTransport: LocalLoopbackTransport) {
    const set = this.rooms.get(roomCode);
    if (!set) return;
    set.delete(peerTransport);
    if (set.size === 0) {
      this.rooms.delete(roomCode);
    } else {
      this.broadcastPresence(roomCode);
    }
  }

  dispatch(roomCode: string, sender: LocalLoopbackTransport, envelope: ClassroomEnvelope) {
    const set = this.rooms.get(roomCode);
    if (!set) return;
    for (const peer of set) {
      if (peer === sender) continue;
      peer.deliverRemote(envelope);
    }
  }

  private broadcastPresence(roomCode: string) {
    const set = this.rooms.get(roomCode);
    if (!set) return;
    const peers: PresencePeer[] = [];
    for (const transport of set) {
      if (transport.currentPeer) peers.push(transport.currentPeer);
    }
    for (const transport of set) {
      transport.deliverPresence(peers);
    }
  }
}

export class LocalLoopbackTransport implements ClassroomTransport {
  readonly kind = 'loopback' as const;
  private hub: LoopbackHub;
  private roomCode: string | null = null;
  currentPeer: PresencePeer | null = null;
  private messageListeners = new Set<(envelope: ClassroomEnvelope) => void>();
  private presenceListeners = new Set<(peers: PresencePeer[]) => void>();
  private statusListeners = new Set<(status: TransportStatus, detail?: string) => void>();

  constructor(hub: LoopbackHub = new LoopbackHub()) {
    this.hub = hub;
  }

  async connect(roomCode: string, peer: PresencePeer): Promise<void> {
    this.emitStatus('connecting');
    this.roomCode = roomCode;
    this.currentPeer = peer;
    this.emitStatus('connected');
    this.hub.join(roomCode, this);
  }

  async disconnect(): Promise<void> {
    if (this.roomCode) {
      this.hub.leave(this.roomCode, this);
    }
    this.roomCode = null;
    this.currentPeer = null;
    this.emitStatus('disconnected');
  }

  async send(envelope: ClassroomEnvelope): Promise<void> {
    if (!this.roomCode) return;
    this.hub.dispatch(this.roomCode, this, envelope);
  }

  deliverRemote(envelope: ClassroomEnvelope) {
    const parsed = parseClassroomEnvelope(envelope);
    if (!parsed) return;
    for (const listener of this.messageListeners) {
      listener(parsed);
    }
  }

  deliverPresence(peers: PresencePeer[]) {
    for (const listener of this.presenceListeners) {
      listener(peers);
    }
  }

  onMessage(listener: (envelope: ClassroomEnvelope) => void): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  onPresence(listener: (peers: PresencePeer[]) => void): () => void {
    this.presenceListeners.add(listener);
    return () => this.presenceListeners.delete(listener);
  }

  onStatus(listener: (status: TransportStatus, detail?: string) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  private emitStatus(status: TransportStatus, detail?: string) {
    for (const listener of this.statusListeners) {
      listener(status, detail);
    }
  }
}

// ---------------------------------------------------------------- SupabaseRealtimeTransport

type PhoenixMessage = {
  topic: string;
  event: string;
  payload: Record<string, unknown>;
  ref: string | null;
};

export class SupabaseRealtimeTransport implements ClassroomTransport {
  readonly kind = 'supabase' as const;
  private url: string;
  private anonKey: string;
  private ws: WebSocket | null = null;
  private roomCode: string | null = null;
  private peer: PresencePeer | null = null;
  private refCounter = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private closedManually = false;
  private joinRef: string | null = null;
  private pendingJoinResolve: (() => void) | null = null;
  private pendingJoinReject: ((err: Error) => void) | null = null;
  private presenceState = new Map<string, PresencePeer>();

  private messageListeners = new Set<(envelope: ClassroomEnvelope) => void>();
  private presenceListeners = new Set<(peers: PresencePeer[]) => void>();
  private statusListeners = new Set<(status: TransportStatus, detail?: string) => void>();

  constructor(url: string, anonKey: string) {
    this.url = url.replace(/\/+$/, '');
    this.anonKey = anonKey;
  }

  private nextRef(): string {
    this.refCounter += 1;
    return String(this.refCounter);
  }

  private topic(): string {
    return `realtime:classroom:${this.roomCode}`;
  }

  async connect(roomCode: string, peer: PresencePeer): Promise<void> {
    this.closedManually = false;
    this.roomCode = roomCode;
    this.peer = peer;
    this.reconnectAttempts = 0;
    await this.openSocket();
  }

  private openSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.roomCode || !this.peer) {
        reject(new Error('Missing roomCode or peer'));
        return;
      }

      this.emitStatus(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');

      const wsBase = this.url.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
      const socketUrl = `${wsBase}/realtime/v1/websocket?apikey=${encodeURIComponent(this.anonKey)}&vsn=1.0.0`;

      let settled = false;
      this.pendingJoinResolve = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };
      this.pendingJoinReject = (err: Error) => {
        if (!settled) {
          settled = true;
          reject(err);
        }
      };
      const ws = new WebSocket(socketUrl);
      this.ws = ws;

      ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.joinChannel();
      };

      ws.onmessage = (event) => {
        this.handleRawMessage(String(event.data));
      };

      ws.onerror = (event) => {
        console.warn('[ClassroomTransport] WebSocket error:', (event as { message?: string })?.message ?? 'unknown');
        this.emitStatus('error', 'Realtime connection error');
        this.pendingJoinReject?.(new Error('Supabase Realtime WebSocket error'));
        this.pendingJoinResolve = null;
        this.pendingJoinReject = null;
      };

      ws.onclose = () => {
        this.stopHeartbeat();
        if (this.closedManually) {
          this.emitStatus('disconnected');
          return;
        }
        this.scheduleReconnect();
      };
    });
  }

  private joinChannel() {
    if (!this.ws || this.ws.readyState !== 1 || !this.roomCode || !this.peer) return;
    const ref = this.nextRef();
    this.joinRef = ref;
    const joinMsg: PhoenixMessage = {
      topic: this.topic(),
      event: 'phx_join',
      payload: {
        access_token: this.anonKey,
        config: {
          broadcast: { self: false, ack: false },
          presence: { key: this.peer.peerId },
        },
      },
      ref,
    };
    this.ws.send(JSON.stringify(joinMsg));
  }

  private trackPresence() {
    if (!this.ws || this.ws.readyState !== 1 || !this.peer) return;
    const trackMsg: PhoenixMessage = {
      topic: this.topic(),
      event: 'presence',
      payload: {
        type: 'presence',
        event: 'track',
        payload: this.peer,
      },
      ref: this.nextRef(),
    };
    this.ws.send(JSON.stringify(trackMsg));
  }

  private handleRawMessage(raw: string) {
    let msg: PhoenixMessage;
    try {
      msg = JSON.parse(raw) as PhoenixMessage;
    } catch {
      return;
    }

    if (msg.event === 'phx_reply' && msg.topic === this.topic()) {
      const status = msg.payload?.status;
      if (msg.ref === this.joinRef) {
        if (status === 'ok') {
          this.emitStatus('connected');
          this.trackPresence();
          this.pendingJoinResolve?.();
          this.pendingJoinResolve = null;
          this.pendingJoinReject = null;
        } else {
          this.emitStatus('error', 'Failed to join realtime channel');
          this.pendingJoinReject?.(new Error('Failed to join Supabase Realtime channel'));
          this.pendingJoinResolve = null;
          this.pendingJoinReject = null;
        }
      }
      return;
    }

    if (
      (msg.event === 'phx_close' || msg.event === 'phx_error') &&
      msg.topic === this.topic()
    ) {
      console.warn('[ClassroomTransport] Channel closed/errored:', msg.event, msg.payload);
      if (!this.closedManually && this.ws && this.ws.readyState === 1) {
        this.joinChannel();
      }
      return;
    }

    if (msg.event === 'system' && msg.payload?.status === 'error') {
      console.warn('[ClassroomTransport] System error:', msg.payload);
      return;
    }

    if (msg.event === 'broadcast' && msg.payload?.event === 'classroom_envelope') {
      const envelope = parseClassroomEnvelope(msg.payload?.payload);
      if (!envelope) return;
      for (const listener of this.messageListeners) {
        listener(envelope);
      }
      return;
    }

    if (msg.event === 'presence_state') {
      this.presenceState.clear();
      this.applyPresenceMap(msg.payload);
      this.emitPresence();
      return;
    }

    if (msg.event === 'presence_diff') {
      const joins = msg.payload?.joins as Record<string, unknown> | undefined;
      const leaves = msg.payload?.leaves as Record<string, unknown> | undefined;
      if (leaves && typeof leaves === 'object') {
        for (const key of Object.keys(leaves)) {
          this.presenceState.delete(key);
        }
      }
      if (joins && typeof joins === 'object') {
        this.applyPresenceMap(joins);
      }
      this.emitPresence();
    }
  }

  private applyPresenceMap(map: Record<string, unknown>) {
    for (const [key, entry] of Object.entries(map)) {
      if (!entry || typeof entry !== 'object') continue;
      const metas = (entry as { metas?: unknown[] }).metas;
      const latest = Array.isArray(metas) && metas.length > 0 ? metas[metas.length - 1] : null;
      if (!latest || typeof latest !== 'object') continue;
      const p = latest as Partial<PresencePeer>;
      if (typeof p.peerId === 'string' && typeof p.displayName === 'string') {
        this.presenceState.set(key, {
          peerId: p.peerId,
          displayName: p.displayName,
          role: p.role === 'teacher' ? 'teacher' : 'student',
          joinedAt: typeof p.joinedAt === 'string' ? p.joinedAt : new Date().toISOString(),
        });
      }
    }
  }

  private emitPresence() {
    const peers = Array.from(this.presenceState.values());
    for (const listener of this.presenceListeners) {
      listener(peers);
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (!this.ws || this.ws.readyState !== 1) return;
      const hb: PhoenixMessage = {
        topic: 'phoenix',
        event: 'heartbeat',
        payload: {},
        ref: this.nextRef(),
      };
      this.ws.send(JSON.stringify(hb));
    }, 25_000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || this.closedManually) return;
    this.reconnectAttempts += 1;
    const delay = Math.min(8000, 600 * 2 ** Math.min(4, this.reconnectAttempts - 1));
    this.emitStatus('reconnecting');
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.closedManually) {
        void this.openSocket().catch(() => {
          this.scheduleReconnect();
        });
      }
    }, delay);
  }

  async send(envelope: ClassroomEnvelope): Promise<void> {
    if (!this.ws || this.ws.readyState !== 1 || !this.roomCode) return;
    const msg: PhoenixMessage = {
      topic: this.topic(),
      event: 'broadcast',
      payload: {
        type: 'broadcast',
        event: 'classroom_envelope',
        payload: envelope,
      },
      ref: null,
    };
    const encoded = JSON.stringify(msg);
    if (encoded.length > 240_000) {
      console.warn(
        `[ClassroomTransport] Large ${envelope.type} payload (${Math.round(encoded.length / 1024)} KB)`,
      );
    }
    this.ws.send(encoded);
  }

  async disconnect(): Promise<void> {
    this.closedManually = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // Ignore close errors.
      }
      this.ws = null;
    }
    this.presenceState.clear();
    this.emitStatus('disconnected');
  }

  onMessage(listener: (envelope: ClassroomEnvelope) => void): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  onPresence(listener: (peers: PresencePeer[]) => void): () => void {
    this.presenceListeners.add(listener);
    return () => this.presenceListeners.delete(listener);
  }

  onStatus(listener: (status: TransportStatus, detail?: string) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  private emitStatus(status: TransportStatus, detail?: string) {
    for (const listener of this.statusListeners) {
      listener(status, detail);
    }
  }
}

export function createDefaultClassroomTransport(): ClassroomTransport {
  const config = getSupabaseConfig();
  if (config) {
    return new SupabaseRealtimeTransport(config.url, config.anonKey);
  }
  return new LocalLoopbackTransport();
}
