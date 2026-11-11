/**
 * Thin adapter around the native offline recognizer.
 *
 * `expo-mlkit-ocr` is an Expo module: it is not present in Expo Go, and its
 * JavaScript wrapper throws while loading when the native module is missing.
 * The registered `ExpoMlkitOcr` module is looked up optionally instead, so the
 * editor still opens, the image can still be added, and the review screen can
 * show an honest unavailable state instead of crashing the board.
 *
 * iOS is configured to use Apple's Vision framework and Android uses Google ML
 * Kit Text Recognition v2. Both run entirely on the device.
 */

import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

import { normalizeOcrResult, type OcrEngine, type OcrResult } from './ocr-service';

type NativeOcrModule = {
  recognizeText: (uri: string) => Promise<unknown>;
  isSupported?: () => boolean;
};

type ModuleState =
  | { module: NativeOcrModule; error: null }
  | { module: null; error: OcrServiceError };

export class OcrServiceError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'OcrServiceError';
    this.code = code;
  }
}

let moduleState: ModuleState | null = null;

function engineForPlatform(): OcrEngine {
  return Platform.OS === 'ios' ? 'apple-vision' : 'mlkit-v2';
}

function loadNativeModule(): NativeOcrModule {
  if (moduleState) {
    if (moduleState.module) return moduleState.module;
    throw moduleState.error;
  }

  if (Platform.OS === 'web') {
    const error = new OcrServiceError(
      'UNSUPPORTED',
      'Text recognition is not available on web.',
    );
    moduleState = { module: null, error };
    throw error;
  }

  try {
    // `expo-mlkit-ocr` registers its native module as `ExpoMlkitOcr`. Looking it
    // up directly (instead of importing the package's JS wrapper, which calls
    // the throwing `requireNativeModule` at import time) keeps Expo Go alive and
    // lets the review screen explain that this build has no recognizer.
    const nativeModule = requireOptionalNativeModule<NativeOcrModule>('ExpoMlkitOcr');
    if (!nativeModule || typeof nativeModule.recognizeText !== 'function') {
      throw new OcrServiceError(
        'NATIVE_UNAVAILABLE',
        'The native OCR module is missing from this build.',
      );
    }
    moduleState = { module: nativeModule, error: null };
    return nativeModule;
  } catch (error) {
    const wrapped =
      error instanceof OcrServiceError
        ? error
        : new OcrServiceError(
            'NATIVE_UNAVAILABLE',
            'The native OCR module is missing from this build.',
          );
    moduleState = { module: null, error: wrapped };
    throw wrapped;
  }
}

function assertSupported(module: NativeOcrModule): void {
  if (typeof module.isSupported !== 'function') return;
  if (module.isSupported()) return;
  throw new OcrServiceError(
    'UNSUPPORTED',
    'Text recognition is not supported on this device.',
  );
}

/** True when the device/build can run local recognition. Never throws. */
export function isLocalOcrAvailable(): boolean {
  try {
    assertSupported(loadNativeModule());
    return true;
  } catch {
    return false;
  }
}

/**
 * Recognize text in a durable local image. The URI must point at a file the app
 * owns; OCR never uploads the image and never requests camera or photo access
 * on its own because the image has already been imported.
 */
export async function recognizeImageText(uri: string): Promise<OcrResult> {
  const module = loadNativeModule();
  assertSupported(module);
  const raw = await module.recognizeText(uri);
  return normalizeOcrResult(raw, engineForPlatform());
}
