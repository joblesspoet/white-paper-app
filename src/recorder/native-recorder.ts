/**
 * Native screen/audio capture adapter for FlowCanvas Lesson Recorder.
 *
 * 1. Uses lazy `requireOptionalNativeModule('FlowCanvasRecorder')` (from
 *    `modules/flowcanvas-recorder`) for full MP4 screen + mic video capture.
 * 2. Automatically falls back to `expo-audio` (`AudioRecorder`) for voice
 *    narration (`.m4a`) when screen capture is unavailable (e.g. Expo Go) or
 *    declined, so voice audio is still captured alongside the 60 FPS timeline.
 */

import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

import { resolutionForQuality, type VideoQuality } from './lesson-recorder';

export type CaptureCropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type NativeScreenRecorderModule = {
  isSupported?: () => boolean;
  startRecording: (options: {
    width: number;
    height: number;
    bitrate: number;
    includeMic: boolean;
    cropRect?: CaptureCropRect;
    outputPath?: string;
  }) => Promise<{ outputPath?: string } | void>;
  pauseRecording?: () => Promise<void>;
  resumeRecording?: () => Promise<void>;
  stopRecording: () => Promise<{ videoUri?: string | null; audioUri?: string | null } | string | null>;
  saveVideoToGallery?: (videoUri: string) => Promise<{ saved?: boolean; uri?: string } | void>;
};

type ExpoAudioRecorderInstance = {
  uri: string | null;
  prepareToRecordAsync: (options?: Record<string, unknown>) => Promise<void>;
  record: () => void;
  pause: () => void;
  stop: () => Promise<void>;
};

export type NativeRecordingStartResult = {
  nativeActive: boolean;
  audioActive: boolean;
  reason?: string;
};

export type NativeRecordingStopResult = {
  nativeAvailable: boolean;
  videoUri: string | null;
  audioUri: string | null;
};

let cachedChecked = false;
let cachedModule: NativeScreenRecorderModule | null = null;
let activeAudioRecorder: ExpoAudioRecorderInstance | null = null;
let activeScreenCapture = false;

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

async function startExpoAudioFallback(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const expoAudio = await import('expo-audio');
    const perm = await expoAudio.requestRecordingPermissionsAsync();
    if (!perm.granted) return false;

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
    if (!RecorderCtor) return false;

    const recorder = new RecorderCtor(expoAudio.RecordingPresets.HIGH_QUALITY);
    await recorder.prepareToRecordAsync(expoAudio.RecordingPresets.HIGH_QUALITY);
    recorder.record();
    activeAudioRecorder = recorder;
    return true;
  } catch {
    activeAudioRecorder = null;
    return false;
  }
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
  cropRect?: CaptureCropRect;
}): Promise<NativeRecordingStartResult> {
  activeScreenCapture = false;
  activeAudioRecorder = null;

  const mod = loadNativeRecorderModule();
  if (mod) {
    try {
      const res = resolutionForQuality(params.quality, params.aspectRatio);
      await mod.startRecording({
        width: res.width,
        height: res.height,
        bitrate: res.bitrate,
        includeMic: params.includeMic,
        cropRect: params.cropRect,
      });
      activeScreenCapture = true;
      return { nativeActive: true, audioActive: params.includeMic };
    } catch (error) {
      // Fall through to expo-audio mic recording if screen capture was declined or unavailable.
      const audioActive = params.includeMic ? await startExpoAudioFallback() : false;
      return {
        nativeActive: false,
        audioActive,
        reason: error instanceof Error ? error.message : 'Screen capture did not start.',
      };
    }
  }

  const audioActive = params.includeMic ? await startExpoAudioFallback() : false;
  return {
    nativeActive: false,
    audioActive,
    reason: audioActive
      ? 'Recording voice audio + 60 FPS canvas timeline.'
      : 'Recording deterministic 60 FPS canvas timeline.',
  };
}

export async function pauseNativeCapture(): Promise<void> {
  if (activeScreenCapture) {
    const mod = loadNativeRecorderModule();
    if (mod?.pauseRecording) {
      try {
        await mod.pauseRecording();
      } catch {
        // Ignore if pause is unsupported.
      }
    }
  }
  if (activeAudioRecorder) {
    try {
      activeAudioRecorder.pause();
    } catch {
      // Ignore pause errors.
    }
  }
}

export async function resumeNativeCapture(): Promise<void> {
  if (activeScreenCapture) {
    const mod = loadNativeRecorderModule();
    if (mod?.resumeRecording) {
      try {
        await mod.resumeRecording();
      } catch {
        // Ignore if resume is unsupported.
      }
    }
  }
  if (activeAudioRecorder) {
    try {
      activeAudioRecorder.record();
    } catch {
      // Ignore resume errors.
    }
  }
}

export async function stopNativeCapture(): Promise<NativeRecordingStopResult> {
  let videoUri: string | null = null;
  let audioUri: string | null = null;
  let nativeAvailable = false;

  if (activeScreenCapture) {
    activeScreenCapture = false;
    const mod = loadNativeRecorderModule();
    if (mod) {
      nativeAvailable = true;
      try {
        const result = await mod.stopRecording();
        if (typeof result === 'string') {
          videoUri = result;
        } else {
          videoUri = result?.videoUri ?? null;
          audioUri = result?.audioUri ?? null;
        }
      } catch {
        // Ignore stop error.
      }
    }
  }

  if (activeAudioRecorder) {
    const recorder = activeAudioRecorder;
    activeAudioRecorder = null;
    try {
      await recorder.stop();
      audioUri = recorder.uri ?? audioUri;
    } catch {
      // Ignore stop error.
    }
    try {
      const expoAudio = await import('expo-audio');
      await expoAudio.setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });
    } catch {
      // Ignore audio mode reset error.
    }
  }

  return { nativeAvailable, videoUri, audioUri };
}

export async function saveVideoToGallery(
  videoUri: string,
): Promise<{ saved: boolean; message?: string }> {
  const mod = loadNativeRecorderModule();
  if (!mod?.saveVideoToGallery) {
    return { saved: false, message: 'Gallery export is unavailable in this build.' };
  }
  try {
    await mod.saveVideoToGallery(videoUri);
    return { saved: true };
  } catch (error) {
    return {
      saved: false,
      message: error instanceof Error ? error.message : 'Could not save video to gallery.',
    };
  }
}
