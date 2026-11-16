/**
 * Lazy native audio recording & playback adapter for Spatial Voice-Pin Stickers.
 *
 * Uses dynamic `import('expo-audio')` + `requestMicrophonePermission()` so
 * Expo Go, web, or permission-denied builds degrade gracefully without crashes.
 */

import { Platform } from 'react-native';

import { requestMicrophonePermission } from '../recorder/permissions';
import type { PermissionCheckResult } from '../recorder/permission-model';
import { MAX_VOICE_PIN_DURATION_MS, normalizeWaveformPeaks } from './voice-pin-model';

type ExpoAudioRecorderInstance = {
  uri: string | null;
  isRecording?: boolean;
  prepareToRecordAsync: (options?: Record<string, unknown>) => Promise<void>;
  record: () => void;
  stop: () => Promise<void>;
  getStatus?: () => { durationMillis?: number; metering?: number; isRecording?: boolean };
};

type ExpoAudioPlayerInstance = {
  play: () => void;
  pause: () => void;
  remove?: () => void;
  release?: () => void;
  addListener?: (event: string, cb: (status: { didJustFinish?: boolean; playing?: boolean; currentTime?: number; duration?: number }) => void) => { remove: () => void };
};

export type VoicePinRecordingResult =
  | {
      ok: true;
      uri: string;
      durationMs: number;
      waveformPeaks: number[];
    }
  | {
      ok: false;
      error: string;
      permission?: PermissionCheckResult;
    };

let activeRecorder: ExpoAudioRecorderInstance | null = null;
let recordingStartedAt = 0;
let meterSamples: number[] = [];
let activePlayer: ExpoAudioPlayerInstance | null = null;
let activePlayerSub: { remove: () => void } | null = null;

export function sampleVoicePinMeter(metering?: number): number {
  if (typeof metering === 'number' && Number.isFinite(metering)) {
    meterSamples.push(metering);
    const normalized = Math.max(0.08, Math.min(1, (metering + 60) / 60));
    return normalized;
  }
  const fallback = 0.25 + 0.35 * Math.abs(Math.sin(Date.now() / 160));
  meterSamples.push(fallback);
  return fallback;
}

export async function startVoicePinRecording(): Promise<
  | { ok: true }
  | { ok: false; error: string; permission?: PermissionCheckResult }
> {
  if (Platform.OS === 'web') {
    return {
      ok: false,
      error: 'Voice Pin recording requires an iOS or Android device.',
    };
  }

  const perm = await requestMicrophonePermission();
  if (!perm.granted) {
    return {
      ok: false,
      error: perm.message ?? 'Microphone access is needed to record a Voice Pin.',
      permission: perm,
    };
  }

  try {
    await stopVoicePinPlayback();
    const expoAudio = await import('expo-audio');
    await expoAudio.setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
    });

    const AudioModule = expoAudio.default ?? (expoAudio as unknown as { AudioRecorder?: unknown });
    const RecorderCtor =
      (AudioModule as { AudioRecorder?: new (opts: Record<string, unknown>) => ExpoAudioRecorderInstance })
        ?.AudioRecorder ??
      (expoAudio as unknown as { AudioRecorder?: new (opts: Record<string, unknown>) => ExpoAudioRecorderInstance })
        ?.AudioRecorder;

    if (!RecorderCtor) {
      return {
        ok: false,
        error: 'Audio recording module is unavailable in this runtime.',
      };
    }

    const preset = {
      ...expoAudio.RecordingPresets.HIGH_QUALITY,
      isMeteringEnabled: true,
    };
    const recorder = new RecorderCtor(preset);
    await recorder.prepareToRecordAsync(preset);
    recorder.record();

    activeRecorder = recorder;
    recordingStartedAt = Date.now();
    meterSamples = [];
    return { ok: true };
  } catch (error) {
    activeRecorder = null;
    return {
      ok: false,
      error:
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'Could not start microphone recording on this device.',
    };
  }
}

export function pollVoicePinRecordingProgress(): {
  durationMs: number;
  latestLevel: number;
  peaks: number[];
  reachedLimit: boolean;
} {
  const status = activeRecorder?.getStatus?.();
  const elapsed =
    typeof status?.durationMillis === 'number' && status.durationMillis > 0
      ? status.durationMillis
      : Math.max(0, Date.now() - recordingStartedAt);
  const latestLevel = sampleVoicePinMeter(status?.metering);
  return {
    durationMs: elapsed,
    latestLevel,
    peaks: normalizeWaveformPeaks(meterSamples),
    reachedLimit: elapsed >= MAX_VOICE_PIN_DURATION_MS,
  };
}

export async function stopVoicePinRecording(): Promise<VoicePinRecordingResult> {
  const recorder = activeRecorder;
  activeRecorder = null;
  if (!recorder) {
    return { ok: false, error: 'No active Voice Pin recording.' };
  }

  try {
    const statusBeforeStop = recorder.getStatus?.();
    await recorder.stop();
    const durationMs = Math.max(
      200,
      Math.min(
        MAX_VOICE_PIN_DURATION_MS,
        typeof statusBeforeStop?.durationMillis === 'number' && statusBeforeStop.durationMillis > 0
          ? statusBeforeStop.durationMillis
          : Date.now() - recordingStartedAt,
      ),
    );
    const uri = recorder.uri;
    if (!uri) {
      return { ok: false, error: 'Recorded audio file could not be saved.' };
    }
    const peaks = normalizeWaveformPeaks(meterSamples);
    meterSamples = [];
    return {
      ok: true,
      uri,
      durationMs,
      waveformPeaks: peaks,
    };
  } catch (error) {
    meterSamples = [];
    return {
      ok: false,
      error:
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'Could not finalize Voice Pin audio.',
    };
  }
}

export async function cancelVoicePinRecording(): Promise<void> {
  const recorder = activeRecorder;
  activeRecorder = null;
  meterSamples = [];
  if (!recorder) return;
  try {
    await recorder.stop();
  } catch {
    // Ignore cancel errors.
  }
}

export async function stopVoicePinPlayback(): Promise<void> {
  try {
    activePlayerSub?.remove();
    activePlayerSub = null;
    if (activePlayer) {
      activePlayer.pause();
      activePlayer.release?.();
      activePlayer.remove?.();
      activePlayer = null;
    }
  } catch {
    activePlayer = null;
  }
}

export async function playVoicePinAudio(
  uri: string,
  onEnded?: () => void,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (Platform.OS === 'web') {
    return { ok: false, error: 'Audio playback is only supported on iOS and Android.' };
  }
  try {
    await stopVoicePinPlayback();
    const expoAudio = await import('expo-audio');
    await expoAudio.setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
    });
    const createPlayer = (
      expoAudio as unknown as {
        createAudioPlayer?: (source: string) => ExpoAudioPlayerInstance;
      }
    ).createAudioPlayer;
    if (!createPlayer) {
      return { ok: false, error: 'Audio playback is unavailable in this runtime.' };
    }
    const player = createPlayer(uri);
    activePlayer = player;
    if (player.addListener && onEnded) {
      activePlayerSub = player.addListener('playbackStatusUpdate', (status) => {
        if (status?.didJustFinish) {
          void stopVoicePinPlayback();
          onEnded();
        }
      });
    }
    player.play();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'Unable to play this Voice Pin audio clip.',
    };
  }
}
