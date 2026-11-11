/**
 * Pure OCR review model.
 *
 * The native recognizer is behind `native-ocr.ts`; this module only knows the
 * shape of a result so its ordering, empty-state, correction, and error rules
 * can be checked without a device. No text leaves the device.
 */

export type OcrEngine = 'apple-vision' | 'mlkit-v2';

export type OcrBoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type OcrRegion = {
  text: string;
  boundingBox: OcrBoundingBox;
};

export type OcrResult = {
  text: string;
  regions: OcrRegion[];
  regionCount: number;
  engine: OcrEngine;
};

export type OcrReviewStatus = 'loading' | 'success' | 'empty' | 'error';

export type OcrReviewState = {
  status: OcrReviewStatus;
  text: string;
  regionCount: number;
  engine: OcrEngine | null;
  errorMessage: string | null;
};

type RawOcrBlock = {
  text?: unknown;
  boundingBox?: {
    x?: unknown;
    y?: unknown;
    width?: unknown;
    height?: unknown;
  };
};

type RawOcrResult = {
  text?: unknown;
  blocks?: unknown;
};

const RETRY_WITH_IMAGE = ' You can still add the image.';

/** Plain-language engine names for the review screen. */
export function ocrEngineLabel(engine: OcrEngine | null): string {
  if (engine === 'apple-vision') return 'Apple Vision';
  if (engine === 'mlkit-v2') return 'Google ML Kit';
  return 'on-device recognition';
}

/** `1 text region` / `3 text regions`; zero is reported as none. */
export function ocrRegionLabel(count: number): string {
  if (count <= 0) return 'No text regions';
  return `${count} text region${count === 1 ? '' : 's'}`;
}

/**
 * Tidy recognizer output without changing meaning: normalise line endings,
 * trim each line, collapse horizontal runs, and drop leading/trailing blank
 * lines. Correction happens afterwards in the review field.
 */
export function normalizeRecognizedText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function finite(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function parseRegion(raw: unknown): OcrRegion | null {
  if (!raw || typeof raw !== 'object') return null;
  const block = raw as RawOcrBlock;
  if (typeof block.text !== 'string') return null;
  const text = normalizeRecognizedText(block.text);
  if (text.length === 0) return null;
  const box = block.boundingBox ?? {};
  return {
    text,
    boundingBox: {
      x: finite(box.x),
      y: finite(box.y),
      width: Math.max(0, finite(box.width)),
      height: Math.max(0, finite(box.height)),
    },
  };
}

/**
 * Reading order for text blocks: top to bottom, then left to right. A small
 * vertical tolerance keeps two blocks on the same visual line in the expected
 * order even when their top edges differ by a few pixels.
 */
function compareRegions(left: OcrRegion, right: OcrRegion): number {
  const tolerance = Math.max(8, Math.min(left.boundingBox.height, right.boundingBox.height) * 0.6);
  if (Math.abs(left.boundingBox.y - right.boundingBox.y) > tolerance) {
    return left.boundingBox.y - right.boundingBox.y;
  }
  return left.boundingBox.x - right.boundingBox.x;
}

/**
 * Convert a recognizer payload into stable reading order. Blocks are preferred
 * over the raw transcript because they preserve separate text regions; the raw
 * transcript is a fallback for engines that only return a string.
 */
export function normalizeOcrResult(
  raw: unknown,
  engine: OcrEngine = 'mlkit-v2',
): OcrResult {
  const value = (raw && typeof raw === 'object' ? raw : {}) as RawOcrResult;
  const blocks = Array.isArray(value.blocks) ? value.blocks : [];
  const regions = blocks
    .map(parseRegion)
    .filter((region): region is OcrRegion => region !== null)
    .sort(compareRegions);
  const transcript =
    typeof value.text === 'string' ? normalizeRecognizedText(value.text) : '';

  if (regions.length === 0 && transcript.length > 0) {
    regions.push({
      text: transcript,
      boundingBox: { x: 0, y: 0, width: 0, height: 0 },
    });
  }

  const text = regions.map((region) => region.text).join('\n');
  return {
    text,
    regions,
    regionCount: regions.length,
    engine,
  };
}

export function loadingOcrState(): OcrReviewState {
  return {
    status: 'loading',
    text: '',
    regionCount: 0,
    engine: null,
    errorMessage: null,
  };
}

export function ocrReviewStateFromResult(result: OcrResult): OcrReviewState {
  const text = normalizeRecognizedText(result.text);
  if (text.length === 0) {
    return {
      status: 'empty',
      text: '',
      regionCount: 0,
      engine: result.engine,
      errorMessage: null,
    };
  }
  return {
    status: 'success',
    text,
    regionCount: Math.max(1, result.regionCount),
    engine: result.engine,
    errorMessage: null,
  };
}

function errorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

/** Clear, action-oriented copy; every failure still leaves image placement open. */
export function ocrErrorMessage(error: unknown): string {
  switch (errorCode(error)) {
    case 'INVALID_URI':
      return `The image could not be read for text recognition.${RETRY_WITH_IMAGE}`;
    case 'IMAGE_LOAD_FAILED':
      return `The image could not be opened for text recognition.${RETRY_WITH_IMAGE}`;
    case 'RECOGNITION_FAILED':
      return `Text recognition failed on this device.${RETRY_WITH_IMAGE}`;
    case 'UNSUPPORTED':
      return `Text recognition is not available on this device.${RETRY_WITH_IMAGE}`;
    case 'NATIVE_UNAVAILABLE':
      return `Text recognition is not available in this build. Use a development build to enable it.${RETRY_WITH_IMAGE}`;
    default:
      return `Text recognition could not run.${RETRY_WITH_IMAGE}`;
  }
}

export function ocrReviewStateFromError(error: unknown): OcrReviewState {
  return {
    status: 'error',
    text: '',
    regionCount: 0,
    engine: null,
    errorMessage: ocrErrorMessage(error),
  };
}

/** The primary action is available only when reviewed text has content. */
export function canAddRecognizedText(state: OcrReviewState): boolean {
  return state.status === 'success' && state.text.trim().length > 0;
}

/** Keep the review text editable without losing the result metadata. */
export function withOcrCorrection(state: OcrReviewState, text: string): OcrReviewState {
  if (state.status !== 'success') return state;
  return { ...state, text };
}
