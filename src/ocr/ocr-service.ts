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

type RawOcrBoundingBox = {
  x?: unknown;
  y?: unknown;
  width?: unknown;
  height?: unknown;
};

type RawOcrLine = {
  text?: unknown;
  boundingBox?: RawOcrBoundingBox;
};

type RawOcrBlock = RawOcrLine & {
  lines?: unknown;
};

type RawOcrResult = {
  text?: unknown;
  blocks?: unknown;
};

type Span = { start: number; end: number };

const RETRY_WITH_IMAGE = ' You can still add the image.';

/** Plain-language engine names for the review screen. */
export function ocrEngineLabel(engine: OcrEngine | null): string {
  if (engine === 'apple-vision') return 'Apple Vision';
  if (engine === 'mlkit-v2') return 'Google ML Kit';
  return 'on-device recognition';
}

/** `1 line of text` / `12 lines of text`; zero is reported as none. */
export function ocrTextLineLabel(count: number): string {
  if (count <= 0) return 'No text lines';
  return `${count} line${count === 1 ? '' : 's'} of text`;
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

function parseBoundingBox(raw: RawOcrBoundingBox | undefined): OcrBoundingBox {
  const box = raw ?? {};
  return {
    x: finite(box.x),
    y: finite(box.y),
    width: Math.max(0, finite(box.width)),
    height: Math.max(0, finite(box.height)),
  };
}

/**
 * One recognized line. Both engines report `blocks[].lines[]` with their own
 * boxes (Apple Vision reports a single block containing every line; ML Kit
 * reports several blocks), so normalising at line level is what makes reading
 * order and the review count platform-independent.
 */
function parseLine(raw: unknown): OcrRegion | null {
  if (!raw || typeof raw !== 'object') return null;
  const line = raw as RawOcrLine;
  if (typeof line.text !== 'string') return null;
  const text = normalizeRecognizedText(line.text);
  if (text.length === 0) return null;
  return { text, boundingBox: parseBoundingBox(line.boundingBox) };
}

function countTextLines(text: string): number {
  return Math.max(1, text.split('\n').filter((line) => line.trim().length > 0).length);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function spanX(region: OcrRegion): Span {
  return {
    start: region.boundingBox.x,
    end: region.boundingBox.x + region.boundingBox.width,
  };
}

function spanY(region: OcrRegion): Span {
  return {
    start: region.boundingBox.y,
    end: region.boundingBox.y + region.boundingBox.height,
  };
}

function centerY(region: OcrRegion): number {
  return region.boundingBox.y + region.boundingBox.height / 2;
}

function groupSpanY(regions: OcrRegion[]): Span {
  let start = Infinity;
  let end = -Infinity;
  for (const region of regions) {
    const span = spanY(region);
    start = Math.min(start, span.start);
    end = Math.max(end, span.end);
  }
  return { start, end };
}

/**
 * Widest horizontal blank column between two line boxes. Because the input is
 * projected onto the x axis, the returned range contains no line at all, so it
 * is safe to split a layout there without cutting through a line.
 */
function widestGutter(spans: Span[]): Span | null {
  if (spans.length < 2) return null;
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  let reach = sorted[0].end;
  let gutter: Span | null = null;
  for (let index = 1; index < sorted.length; index += 1) {
    const span = sorted[index];
    if (span.start - reach > 0 && (!gutter || span.start - reach > gutter.end - gutter.start)) {
      gutter = { start: reach, end: span.start };
    }
    reach = Math.max(reach, span.end);
  }
  return gutter;
}

/** How much two groups share the same vertical band, relative to the shorter one. */
function verticalOverlap(left: OcrRegion[], right: OcrRegion[]): number {
  const a = groupSpanY(left);
  const b = groupSpanY(right);
  const shorter = Math.min(a.end - a.start, b.end - b.start);
  if (shorter <= 0) return 0;
  const overlap = Math.min(a.end, b.end) - Math.max(a.start, b.start);
  return Math.max(0, overlap) / shorter;
}

/**
 * Split genuine side-by-side columns. A wide blank gutter alone is not enough:
 * both sides need at least two lines and must share a vertical band, otherwise
 * scattered sticky notes or a staggered layout would be read column-first
 * instead of row-first.
 */
function splitColumns(
  regions: OcrRegion[],
  lineHeight: number,
): [OcrRegion[], OcrRegion[]] | null {
  const gutter = widestGutter(regions.map(spanX));
  if (!gutter) return null;
  const gutterSize = gutter.end - gutter.start;
  const contentStart = Math.min(...regions.map((region) => spanX(region).start));
  const contentEnd = Math.max(...regions.map((region) => spanX(region).end));
  const minimumGutter = Math.max(lineHeight * 0.8, (contentEnd - contentStart) * 0.02, 8);
  if (gutterSize < minimumGutter) return null;

  // No line crosses the gutter, so the two sides are unambiguous.
  const left = regions.filter((region) => spanX(region).end <= gutter.start + 0.5);
  const right = regions.filter((region) => spanX(region).start >= gutter.end - 0.5);
  if (left.length < 2 || right.length < 2) return null;
  if (left.length + right.length !== regions.length) return null;
  if (verticalOverlap(left, right) < 0.5) return null;
  return [left, right];
}

/** Split into paragraph-sized horizontal bands, top to bottom. */
function splitBands(regions: OcrRegion[], gapThreshold: number): OcrRegion[][] {
  const sorted = [...regions].sort((a, b) => spanY(a).start - spanY(b).start);
  const bands: OcrRegion[][] = [];
  let current: OcrRegion[] = [];
  let bottom = 0;

  for (const region of sorted) {
    const span = spanY(region);
    if (current.length > 0 && span.start - bottom >= gapThreshold) {
      bands.push(current);
      current = [];
    }
    bottom = current.length === 0 ? span.end : Math.max(bottom, span.end);
    current.push(region);
  }
  if (current.length > 0) bands.push(current);
  return bands;
}

/** Row-major fallback: cluster lines into rows, then read each row left to right. */
function rowOrder(regions: OcrRegion[]): OcrRegion[] {
  const sorted = [...regions].sort((a, b) => centerY(a) - centerY(b));
  const rows: { center: number; height: number; items: OcrRegion[] }[] = [];

  for (const region of sorted) {
    const center = centerY(region);
    const height = Math.max(1, region.boundingBox.height);
    const row = rows[rows.length - 1];
    const tolerance = row ? Math.max(6, Math.min(row.height, height) * 0.6) : 0;
    if (row && Math.abs(center - row.center) <= tolerance) {
      row.items.push(region);
    } else {
      rows.push({ center, height, items: [region] });
    }
  }

  return rows.flatMap((row) => row.items.sort((a, b) => a.boundingBox.x - b.boundingBox.x));
}

/**
 * Reading order for recognized lines.
 *
 * 1. Real side-by-side columns are read left to right, each top to bottom.
 * 2. Otherwise, bands separated by paragraph-sized gaps are read top to bottom.
 * 3. Otherwise, lines are clustered into rows and read left to right.
 *
 * Recursing on each split keeps a title above two columns in the expected
 * order: the title spans the gutter, so the first split is horizontal, and the
 * column split happens inside the band below it.
 */
function orderInReadingOrder(regions: OcrRegion[]): OcrRegion[] {
  if (regions.length <= 1) return [...regions];

  const heights = regions.map((region) => region.boundingBox.height).filter((height) => height > 0);
  const lineHeight = median(heights);

  const columns = splitColumns(regions, lineHeight);
  if (columns) {
    return [...orderInReadingOrder(columns[0]), ...orderInReadingOrder(columns[1])];
  }

  const bands = splitBands(regions, Math.max(8, lineHeight * 0.7));
  if (bands.length > 1) return bands.flatMap((band) => orderInReadingOrder(band));

  return rowOrder(regions);
}

/**
 * Convert a recognizer payload into stable reading order. Recognized lines are
 * preferred over block text because they carry their own geometry; a block
 * without lines, and the raw transcript, are fallbacks for other engines.
 */
export function normalizeOcrResult(
  raw: unknown,
  engine: OcrEngine = 'mlkit-v2',
): OcrResult {
  const value = (raw && typeof raw === 'object' ? raw : {}) as RawOcrResult;
  const blocks = Array.isArray(value.blocks) ? value.blocks : [];
  const regions: OcrRegion[] = [];

  for (const rawBlock of blocks) {
    const block = (rawBlock && typeof rawBlock === 'object' ? rawBlock : {}) as RawOcrBlock;
    const blockLines = Array.isArray(block.lines) ? block.lines : [];
    const lines = blockLines
      .map(parseLine)
      .filter((line): line is OcrRegion => line !== null);
    if (lines.length > 0) {
      regions.push(...lines);
      continue;
    }
    // Some engines return block text without line geometry.
    const blockRegion = parseLine(block);
    if (blockRegion) regions.push(blockRegion);
  }

  const transcript =
    typeof value.text === 'string' ? normalizeRecognizedText(value.text) : '';

  if (regions.length === 0 && transcript.length > 0) {
    regions.push({
      text: transcript,
      boundingBox: { x: 0, y: 0, width: 0, height: 0 },
    });
  }

  const ordered = orderInReadingOrder(regions);
  const text = ordered.map((region) => region.text).join('\n');
  const regionCount = ordered.reduce((count, region) => count + countTextLines(region.text), 0);
  return {
    text,
    regions: ordered,
    regionCount,
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
