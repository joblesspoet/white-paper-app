/**
 * Lazy native screen/audio capture adapter for FlowCanvas Lesson Recorder.
 *
 * Uses `requireOptionalNativeModule` (just like `src/ocr/native-ocr.ts`) so
 * the app never crashes in Expo Go when native screen-capture or audio-muxing
 * modules are absent. In Expo Go, the deterministic canvas timeline recorder
 * (`lesson-recorder.ts`) continues to work at full 60 FPS fidelity.
 */

import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

import { resolutionForQuality, type VideoQuality } from './lesson-recorder';

type NativeScreenRecorderModule = {
  isSupported?: () => boolean;
  startRecording: (options: {
    width: number;
    height: number;
    bitrate: number;
    includeMic: boolean;
    outputPath?: string;
  }) => Promise<{ outputPath?: string } | void>;
  pauseRecording?: () => Promise<void>;
  resumeRecording?: () => Promise<void>;
  stopRecording: () => Promise<{ videoUri?: string | null; audioUri?: string | null } | string | null>;
};

export type NativeRecordingStartResult = {
  nativeActive: boolean;
  reason?: string;
};

export type NativeRecordingStopResult = {
  nativeAvailable: boolean;
  videoUri: string | null;
  audioUri: string | null;
};

let cachedChecked = false;
let cachedModule: NativeScreenRecorderModule | null = null;

function loadNativeRecorderModule(): NativeScreenRecorderModule | null {
  if (cachedChecked) return cachedModule;
  cachedChecked = true;

  if (Platform.OS === 'web') {
    cachedModule = null;
    return null;
  }

  try {
    const mod =
      requireOptionalNativeModule<NativeScreenRecorderModule>('FlowCanvasRecorder') ??
      requireOptionalNativeModule<NativeScreenRecorderModule>('ExpoScreenRecorder') ??
      null;
    if (
      mod &&
      typeof mod.startRecording === 'function' &&
      typeof mod.stopRecording === 'function'
    ) {
      cachedModule = mod;
      return mod;
    }
  } catch {
    // Module absent in Expo Go or current build.
  }

  cachedModule = null;
  return null;
}

export function isNativeVideoRecorderAvailable(): boolean {
  const mod = loadNativeRecorderModule();
  if (!mod) return false;
  if (typeof mod.isSupported === 'function') {
    try {
      return Boolean(mod.isSupported());
    } catch {
      return false;
    }
  }
  return true;
}

export async function startNativeCapture(params: {
  quality: VideoQuality;
  includeMic: boolean;
  aspectRatio?: number;
}): Promise<NativeRecordingStartResult> {
  const mod = loadNativeRecorderModule();
  if (!mod) {
    return {
      nativeActive: false,
      reason: 'Native video capture is unavailable in Expo Go; recording deterministic 60 FPS canvas timeline.',
    };
  }
  try {
    const res = resolutionForQuality(params.quality, params.aspectRatio);
    await mod.startRecording({
      width: res.width,
      height: res.height,
      bitrate: res.bitrate,
      includeMic: params.includeMic,
    });
    return { nativeActive: true };
  } catch (error) {
    return {
      nativeActive: false,
      reason: error instanceof Error ? error.message : 'Native video capture could not start.',
    };
  }
}

export async function pauseNativeCapture(): Promise<void> {
  const mod = loadNativeRecorderModule();
  if (!mod?.pauseRecording) return;
  try {
    await mod.pauseRecording();
  } catch {
    // Ignore if pause is unsupported by the native adapter.
  }
}

export async function resumeNativeCapture(): Promise<void> {
  const mod = loadNativeRecorderModule();
  if (!mod?.resumeRecording) return;
  try {
    await mod.resumeRecording();
  } catch {
    // Ignore if resume is unsupported by the native adapter.
  }
}

export async function stopNativeCapture(): Promise<NativeRecordingStopResult> {
  const mod = loadNativeRecorderModule();
  if (!mod) {
    return { nativeAvailable: false, videoUri: null, audioUri: null };
  }
  try {
    const result = await mod.stopRecording();
    if (typeof result === 'string') {
      return { nativeAvailable: true, videoUri: result, audioUri: null };
    }
    return {
      nativeAvailable: true,
      videoUri: result?.videoUri ?? null,
      audioUri: result?.audioUri ?? null,
    };
  } catch {
    return { nativeAvailable: true, videoUri: null, audioUri: null };
  }
}
