/**
 * Live Classroom Voice Adapter (LiveKit SFU-ready).
 *
 * Supports:
 * - Teacher broadcasting live voice to all students.
 * - Teacher dynamically allowing **1 student at a time** to unmute & speak.
 * - Safe lazy-loading of `@livekit/react-native` so the app never crashes in
 *   Expo Go or Node verification tests where native WebRTC modules are absent.
 */

import type { ClassroomRole } from './protocol.ts';
import { fcprobe } from '../dev-probe';

export type ClassroomAudioState = {
  available: boolean;
  connected: boolean;
  micEnabled: boolean;
  canPublish: boolean;
  reason?: string;
};

export interface ClassroomAudioAdapter {
  getState(): ClassroomAudioState;
  connect(params: {
    roomCode: string;
    peerId: string;
    displayName: string;
    role: ClassroomRole;
    canPublish: boolean;
  }): Promise<ClassroomAudioState>;
  setMicEnabled(enabled: boolean): Promise<ClassroomAudioState>;
  setCanPublish(canPublish: boolean): Promise<ClassroomAudioState>;
  disconnect(): Promise<void>;
}

export function getLiveKitConfig(): { url: string; tokenEndpoint: string } | null {
  const url =
    typeof process !== 'undefined' ? process.env?.EXPO_PUBLIC_LIVEKIT_URL?.trim() : undefined;
  if (!url) return null;

  const explicitEndpoint =
    typeof process !== 'undefined'
      ? process.env?.EXPO_PUBLIC_LIVEKIT_TOKEN_ENDPOINT?.trim()
      : undefined;
  const supabaseUrl =
    typeof process !== 'undefined' ? process.env?.EXPO_PUBLIC_SUPABASE_URL?.trim() : undefined;
  const validExplicit =
    explicitEndpoint && /^https?:\/\//i.test(explicitEndpoint) ? explicitEndpoint : '';
  const tokenEndpoint =
    validExplicit ||
    (supabaseUrl ? `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/livekit-token` : '');

  if (!tokenEndpoint) return null;
  return { url, tokenEndpoint };
}

type LiveKitRoomLike = {
  connect: (url: string, token: string) => Promise<void>;
  disconnect: () => Promise<void>;
  canPlaybackAudio?: boolean;
  startAudio?: () => Promise<void>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  off?: (event: string, listener: (...args: unknown[]) => void) => void;
  localParticipant?: {
    setMicrophoneEnabled: (enabled: boolean) => Promise<void>;
  };
};

type LiveKitAudioSessionLike = {
  configureAudio?: (config: Record<string, unknown>) => Promise<void>;
  startAudioSession?: () => Promise<void>;
  stopAudioSession?: () => Promise<void>;
};

let globalsRegistered = false;

function tryLoadLiveKitSdk(): {
  Room: new () => LiveKitRoomLike;
  RoomEvent?: Record<string, string>;
  registerGlobals?: () => void;
  AudioSession?: LiveKitAudioSessionLike;
  AndroidAudioTypePresets?: Record<string, unknown>;
} | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const lc = require('livekit-client') as {
      Room?: new () => LiveKitRoomLike;
      RoomEvent?: Record<string, string>;
    };
    let lk: {
      registerGlobals?: () => void;
      AudioSession?: LiveKitAudioSessionLike;
      AndroidAudioTypePresets?: Record<string, unknown>;
    } = {};
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      lk = require('@livekit/react-native') as {
        registerGlobals?: () => void;
        AudioSession?: LiveKitAudioSessionLike;
        AndroidAudioTypePresets?: Record<string, unknown>;
      };
    } catch {
      // In non-native environments or unit tests, LiveKit client is still functional
    }
    const RoomClass = lc.Room;
    if (typeof RoomClass === 'function') {
      return {
        Room: RoomClass,
        RoomEvent: lc.RoomEvent,
        registerGlobals: lk.registerGlobals,
        AudioSession: lk.AudioSession,
        AndroidAudioTypePresets: lk.AndroidAudioTypePresets,
      };
    }
  } catch {
    // Expected in Expo Go or when dependencies are not installed.
  }
  return null;
}

export class LiveKitClassroomAudioAdapter implements ClassroomAudioAdapter {
  private room: LiveKitRoomLike | null = null;
  private onStateChange: ((state: ClassroomAudioState) => void) | null = null;
  private lastParams: {
    roomCode: string;
    peerId: string;
    displayName: string;
    role: ClassroomRole;
    canPublish: boolean;
    startMicMuted?: boolean;
  } | null = null;
  private state: ClassroomAudioState = {
    available: false,
    connected: false,
    micEnabled: false,
    canPublish: false,
  };

  constructor() {
    const config = getLiveKitConfig();
    const sdk = tryLoadLiveKitSdk();
    if (!config) {
      this.state.reason = 'LiveKit URL or token endpoint not configured.';
    } else if (!sdk) {
      this.state.reason = 'Voice requires an Expo Development Build with @livekit/react-native.';
    } else {
      this.state.available = true;
    }
  }

  setOnStateChange(listener: ((state: ClassroomAudioState) => void) | null): void {
    this.onStateChange = listener;
  }

  private emitState(): void {
    this.onStateChange?.(this.getState());
  }

  getState(): ClassroomAudioState {
    return { ...this.state };
  }

  private tickTimer: ReturnType<typeof setInterval> | null = null;

  startTicker() {
    if (this.tickTimer) return;
    this.tickTimer = setInterval(() => fcprobe('tick'), 500);
  }

  stopTicker() {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  async connect(params: {
    roomCode: string;
    peerId: string;
    displayName: string;
    role: ClassroomRole;
    canPublish: boolean;
    startMicMuted?: boolean;
  }): Promise<ClassroomAudioState> {
    fcprobe('audio: connect start');
    this.lastParams = params;
    const config = getLiveKitConfig();
    const sdk = tryLoadLiveKitSdk();
    fcprobe(`audio: config=${Boolean(config)} sdk=${Boolean(sdk)}`);
    if (!config || !sdk) {
      this.state = {
        available: false,
        connected: false,
        micEnabled: false,
        canPublish: params.canPublish,
        reason: !config
          ? 'LiveKit URL or token endpoint not configured.'
          : 'Voice requires an Expo Development Build with @livekit/react-native.',
      };
      this.emitState();
      return this.getState();
    }

    try {
      if (
        !globalsRegistered &&
        !(globalThis as Record<string, unknown>).LiveKitReactNativeGlobal
      ) {
        sdk.registerGlobals?.();
        globalsRegistered = true;
      }

      fcprobe('audio: starting audio session');
      try {
        await sdk.AudioSession?.startAudioSession?.();
      } catch {
        // Continue even if AudioSession startup reports a non-fatal error.
      }

      const supabaseAnonKey =
        typeof process !== 'undefined'
          ? process.env?.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim()
          : undefined;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (supabaseAnonKey) {
        headers.apikey = supabaseAnonKey;
        headers.Authorization = `Bearer ${supabaseAnonKey}`;
      }
      fcprobe('audio: fetching token');
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 10_000) : null;
      let response: Response;
      try {
        response = await fetch(config.tokenEndpoint, {
          method: 'POST',
          headers,
          signal: controller?.signal,
          body: JSON.stringify({
            roomCode: params.roomCode,
            peerId: params.peerId,
            displayName: params.displayName,
            role: params.role,
            canPublish: params.canPublish,
          }),
        });
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
      if (!response.ok) {
        throw new Error(`Token endpoint returned HTTP ${response.status}`);
      }
      fcprobe(`audio: token http ${response.status}`);
      const data = (await response.json()) as { token?: string; url?: string };
      if (!data.token) {
        throw new Error('Missing LiveKit token from endpoint');
      }

      if (this.room) {
        try {
          await this.room.disconnect();
        } catch {
          // Ignore prior room disconnect errors.
        }
      }

      const room = new sdk.Room();
      const events = sdk.RoomEvent;
      if (events && room.on) {
        fcprobe('audio: registering room events');
        if (events.Disconnected) {
          room.on(events.Disconnected, () => {
            fcprobe('audio: EVENT Disconnected');
            this.state = {
              ...this.state,
              connected: false,
              micEnabled: false,
            };
            this.emitState();
          });
        }
        if (events.MediaDevicesError) {
          room.on(events.MediaDevicesError, (err: unknown) => {
            fcprobe('audio: EVENT MediaDevicesError ' + String(err));
            this.state = {
              ...this.state,
              micEnabled: false,
              reason: err instanceof Error ? err.message : 'Microphone capture failed.',
            };
            this.emitState();
          });
        }
        // `startAudio()` re-emits `AudioPlaybackStatusChanged`. Retrying it from
        // inside this listener creates a microtask chain that never yields when
        // playback cannot succeed (e.g. an emulator with no audio route), which
        // hard-freezes the Hermes thread. Attempt the unlock at most once per
        // connection and never re-enter.
        let audioUnlockAttempted = false;
        if (events.AudioPlaybackStatusChanged) {
          room.on(events.AudioPlaybackStatusChanged, () => {
            fcprobe(`audio: EVENT AudioPlaybackStatusChanged canPlayback=${room.canPlaybackAudio}`);
            if (audioUnlockAttempted || room.canPlaybackAudio !== false) return;
            audioUnlockAttempted = true;
            void Promise.resolve(room.startAudio?.()).catch(() => undefined);
          });
        }
        if (events.AudioDeviceChanged) {
          room.on(events.AudioDeviceChanged, () => fcprobe('audio: EVENT AudioDeviceChanged'));
        }
      }

      fcprobe('audio: room.connect start');
      this.startTicker();
      await room.connect(data.url ?? config.url, data.token);
      fcprobe('audio: room.connect done');
      this.room = room;

      const shouldMic =
        params.role === 'teacher' && params.canPublish && !params.startMicMuted;
      let micEnabled = false;
      let micReason: string | undefined;
      if (shouldMic && room.localParticipant) {
        try {
          // Let initial room-connect WebRTC callbacks and UI renders settle
          // before starting microphone capture and synchronous addTransceiver.
          fcprobe('audio: waiting 150ms before mic');
          await new Promise((resolve) => setTimeout(resolve, 150));
          fcprobe('audio: enabling mic');
          fcprobe('audio: about to await setMicrophoneEnabled');
          await room.localParticipant.setMicrophoneEnabled(true);
          fcprobe('audio: awaited setMicrophoneEnabled');
          fcprobe('audio: mic enabled');
          micEnabled = true;
        } catch (micError) {
          micEnabled = false;
          micReason =
            micError instanceof Error
              ? micError.message
              : 'Unable to enable microphone.';
        }
      }

      this.state = {
        available: true,
        connected: true,
        micEnabled,
        canPublish: params.canPublish,
        reason: micReason,
      };
    } catch (error) {
      fcprobe(`audio: connect threw ${error instanceof Error ? error.message : 'unknown'}`);
      this.state = {
        available: true,
        connected: false,
        micEnabled: false,
        canPublish: params.canPublish,
        reason: error instanceof Error ? error.message : 'Unable to connect voice.',
      };
    }
    fcprobe('audio: connect finished');
    this.stopTicker();
    this.emitState();
    return this.getState();
  }

  async setMicEnabled(enabled: boolean): Promise<ClassroomAudioState> {
    if (!this.state.canPublish && enabled) {
      return this.getState();
    }
    if (this.room?.localParticipant) {
      try {
        await this.room.localParticipant.setMicrophoneEnabled(enabled);
        this.state = { ...this.state, micEnabled: enabled, reason: undefined };
      } catch (error) {
        this.state = {
          ...this.state,
          micEnabled: false,
          reason:
            error instanceof Error ? error.message : 'Unable to toggle microphone.',
        };
      }
    } else {
      this.state = { ...this.state, micEnabled: false };
    }
    this.emitState();
    return this.getState();
  }

  async setCanPublish(canPublish: boolean): Promise<ClassroomAudioState> {
    const wasCanPublish = this.state.canPublish;
    this.state = {
      ...this.state,
      canPublish,
      micEnabled: canPublish ? this.state.micEnabled : false,
    };
    if (!canPublish && this.room?.localParticipant) {
      try {
        await this.room.localParticipant.setMicrophoneEnabled(false);
      } catch {
        // Ignore.
      }
    } else if (canPublish && !wasCanPublish && this.state.available && this.lastParams) {
      return this.connect({ ...this.lastParams, canPublish: true });
    }
    this.emitState();
    return this.getState();
  }

  async resume(): Promise<ClassroomAudioState> {
    if (this.lastParams && this.state.available && !this.state.connected) {
      return this.connect(this.lastParams);
    }
    return this.getState();
  }

  async disconnect(): Promise<void> {
    if (this.room) {
      try {
        await this.room.disconnect();
      } catch {
        // Ignore disconnect errors.
      }
      this.room = null;
    }
    try {
      await tryLoadLiveKitSdk()?.AudioSession?.stopAudioSession?.();
    } catch {
      // Ignore audio session stop errors.
    }
    this.lastParams = null;
    this.state = {
      ...this.state,
      connected: false,
      micEnabled: false,
      reason: undefined,
    };
    this.emitState();
  }
}
