/// <reference types="node" />

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import {
  createDocumentHistory,
  createImageObject,
  documentReducer,
  documentsEqual,
  measureTextBlock,
  type CanvasDocument,
  type ImageObject,
  type TextObject,
} from '../src/canvas/document.ts';
import { canRedo, canUndo } from '../src/canvas/history.ts';
import {
  buildOcrPlacement,
  createOcrTextObject,
  OCR_TEXT_GAP,
  withRecognizedOcr,
} from '../src/ocr/ocr-placement.ts';
import {
  canAddRecognizedText,
  loadingOcrState,
  normalizeOcrResult,
  normalizeRecognizedText,
  ocrErrorMessage,
  ocrTextLineLabel,
  ocrReviewStateFromError,
  ocrReviewStateFromResult,
  withOcrCorrection,
} from '../src/ocr/ocr-service.ts';
import { ocrSourceSize } from '../src/media/image-crop.ts';
import {
  migrateDatabase,
  type PersistenceDatabase,
} from '../src/persistence/database.ts';
import {
  insertBoard,
  loadBoardDocument,
  parseCanvasObject,
  saveBoardDocument,
} from '../src/persistence/repository.ts';
import { DEFAULT_BOARD_SETTINGS, SCHEMA_VERSION } from '../src/persistence/schema.ts';

// ---------------------------------------------------------------- fixtures

const image: ImageObject = createImageObject({
  id: 'img-ocr-1',
  point: { x: 240, y: 180 },
  assetId: 'asset-placed-ocr',
  storagePath: 'media/board-ocr/images/asset-placed-ocr.jpg',
  originalAssetId: 'asset-orig-ocr',
  originalStoragePath: 'media/board-ocr/originals/asset-orig-ocr.jpg',
  sourceWidth: 640,
  sourceHeight: 480,
  originalWidth: 1920,
  originalHeight: 1080,
  crop: { x: 120, y: 80, width: 640, height: 480, rotation: 0 },
});

const emptyDocument: CanvasDocument = { strokes: [], objects: [] };

// ------------------------------------------------------ line-level read order

// Blocks arrive out of order; the review must read top-to-bottom, then
// left-to-right, preserving each line as its own region.
const multiRegion = normalizeOcrResult(
  {
    text: 'beta\nalpha\nProject title',
    blocks: [
      { text: 'beta', boundingBox: { x: 220, y: 140, width: 100, height: 22 } },
      { text: 'alpha', boundingBox: { x: 40, y: 142, width: 120, height: 22 } },
      { text: 'Project title', boundingBox: { x: 30, y: 24, width: 260, height: 30 } },
    ],
  },
  'mlkit-v2',
);
assert.deepEqual(
  multiRegion.regions.map((region) => region.text),
  ['Project title', 'alpha', 'beta'],
);
assert.equal(multiRegion.text, 'Project title\nalpha\nbeta');
assert.equal(multiRegion.regionCount, 3);
assert.equal(multiRegion.engine, 'mlkit-v2');

// A region whose text has blank lines and collapsed spacing is normalized but
// keeps its internal paragraph break.
const whitespace = normalizeOcrResult({
  text: '  Hello   world \r\n\r\n next  ',
  blocks: [
    { text: '  Hello   world \r\n\r\n next  ', boundingBox: { x: 0, y: 0, width: 100, height: 20 } },
  ],
});
assert.equal(whitespace.text, 'Hello world\n\nnext');
assert.equal(normalizeRecognizedText('  a  \r\n\r\n\r\n b '), 'a\n\nb');

// Engines that return only a transcript still produce one reviewable region.
const transcriptOnly = normalizeOcrResult({ text: 'Only a transcript' }, 'apple-vision');
assert.equal(transcriptOnly.regionCount, 1);
assert.equal(transcriptOnly.text, 'Only a transcript');
assert.equal(transcriptOnly.engine, 'apple-vision');

// iOS Apple Vision returns a single block containing every line. Line
// geometry is what makes that usable: each line becomes its own region, and a
// single block no longer reports "1 text region".
const singleBlock = normalizeOcrResult(
  {
    text: 'beta\nalpha\nProject title',
    blocks: [
      {
        text: 'beta\nalpha\nProject title',
        boundingBox: { x: 20, y: 20, width: 300, height: 160 },
        lines: [
          { text: 'beta', boundingBox: { x: 220, y: 140, width: 100, height: 22 } },
          { text: 'alpha', boundingBox: { x: 40, y: 142, width: 120, height: 22 } },
          { text: 'Project title', boundingBox: { x: 30, y: 24, width: 260, height: 30 } },
        ],
      },
    ],
  },
  'apple-vision',
);
assert.deepEqual(
  singleBlock.regions.map((region) => region.text),
  ['Project title', 'alpha', 'beta'],
);
assert.equal(singleBlock.text, 'Project title\nalpha\nbeta');
assert.equal(singleBlock.regionCount, 3, 'a single Vision block must not count as one region');

// Two side-by-side columns are read column by column, not row by row, even
// when the payload interleaves the two columns.
const twoColumns = normalizeOcrResult({
  text: 'Right two\nLeft one\nRight one\nLeft three\nRight three\nLeft two',
  blocks: [
    {
      text: 'Left column',
      lines: [
        { text: 'Left one', boundingBox: { x: 40, y: 100, width: 260, height: 24 } },
        { text: 'Left two', boundingBox: { x: 40, y: 140, width: 280, height: 24 } },
        { text: 'Left three', boundingBox: { x: 40, y: 180, width: 250, height: 24 } },
      ],
    },
    {
      text: 'Right column',
      lines: [
        { text: 'Right one', boundingBox: { x: 440, y: 104, width: 240, height: 24 } },
        { text: 'Right two', boundingBox: { x: 440, y: 144, width: 260, height: 24 } },
        { text: 'Right three', boundingBox: { x: 440, y: 184, width: 230, height: 24 } },
      ],
    },
  ],
});
assert.equal(
  twoColumns.text,
  'Left one\nLeft two\nLeft three\nRight one\nRight two\nRight three',
);

// A full-width title spans the gutter, so the layout splits horizontally first
// and the columns below it are still read left to right.
const titleAboveColumns = normalizeOcrResult(
  {
    text: '',
    blocks: [
      {
        text: 'Board',
        lines: [
          { text: 'Sprint board', boundingBox: { x: 40, y: 30, width: 640, height: 30 } },
          { text: 'Doing', boundingBox: { x: 420, y: 104, width: 180, height: 22 } },
          { text: 'Todo', boundingBox: { x: 40, y: 100, width: 160, height: 22 } },
          { text: 'Later', boundingBox: { x: 420, y: 138, width: 150, height: 22 } },
          { text: 'Next', boundingBox: { x: 40, y: 134, width: 140, height: 22 } },
        ],
      },
    ],
  },
  'apple-vision',
);
assert.equal(titleAboveColumns.text, 'Sprint board\nTodo\nNext\nDoing\nLater');

// Two lines on one visual row keep a single row when neither side has enough
// lines to be a column, and read left to right.
const rowPair = normalizeOcrResult({
  text: '',
  blocks: [
    {
      text: 'pair',
      lines: [
        { text: 'Second', boundingBox: { x: 420, y: 102, width: 120, height: 22 } },
        { text: 'First', boundingBox: { x: 40, y: 100, width: 110, height: 22 } },
      ],
    },
  ],
});
assert.equal(rowPair.text, 'First\nSecond');

// A block without line geometry still contributes its text (other engines),
// and its internal newlines are counted for the review summary.
const blockOnly = normalizeOcrResult({
  blocks: [{ text: 'one\n\ntwo', boundingBox: { x: 10, y: 10, width: 100, height: 60 } }],
});
assert.equal(blockOnly.text, 'one\n\ntwo');
assert.equal(blockOnly.regionCount, 2);

// The OCR copy is lossless PNG; small crops are enlarged, large ones are kept.
assert.deepEqual(ocrSourceSize(800, 600), { width: 1600, height: 1200 });
assert.deepEqual(ocrSourceSize(1200, 900), { width: 1600, height: 1200 });
assert.deepEqual(ocrSourceSize(4000, 3000), { width: 4000, height: 3000 });
assert.deepEqual(ocrSourceSize(200, 100), { width: 800, height: 400 });

// Empty or whitespace-only output is an empty result, not a failure.
for (const raw of [{}, { text: '   ' }, { blocks: [] }, { blocks: [{ text: '   ' }] }]) {
  const empty = normalizeOcrResult(raw);
  assert.equal(empty.text, '');
  assert.equal(empty.regionCount, 0);
}

// ------------------------------------------------------- loading and statuses

assert.equal(loadingOcrState().status, 'loading');
assert.ok(!canAddRecognizedText(loadingOcrState()));

const successState = ocrReviewStateFromResult(multiRegion);
assert.equal(successState.status, 'success');
assert.equal(successState.text, 'Project title\nalpha\nbeta');
assert.equal(successState.regionCount, 3);
assert.equal(successState.engine, 'mlkit-v2');
assert.ok(canAddRecognizedText(successState));

const emptyState = ocrReviewStateFromResult(normalizeOcrResult({ text: '' }));
assert.equal(emptyState.status, 'empty');
assert.equal(emptyState.errorMessage, null);
assert.ok(!canAddRecognizedText(emptyState));

// Every OCR failure is actionable and says the image can still be added.
for (const [code, fragment] of [
  ['INVALID_URI', 'could not be read'],
  ['IMAGE_LOAD_FAILED', 'could not be opened'],
  ['RECOGNITION_FAILED', 'failed on this device'],
  ['UNSUPPORTED', 'not available on this device'],
  ['NATIVE_UNAVAILABLE', 'development build'],
  ['SOMETHING_ELSE', 'could not run'],
]) {
  const message = ocrErrorMessage({ code });
  assert.ok(message.includes(fragment), `${code} copy: ${message}`);
  assert.ok(message.includes('You can still add the image'), `${code} must offer image-only placement`);
}
const errorState = ocrReviewStateFromError({ code: 'RECOGNITION_FAILED' });
assert.equal(errorState.status, 'error');
assert.ok(errorState.errorMessage);
assert.ok(!canAddRecognizedText(errorState));

// ---------------------------------------------------------- correction states

const corrected = withOcrCorrection(successState, '  Corrected project title  ');
assert.equal(corrected.status, 'success');
assert.equal(corrected.text, '  Corrected project title  ');
assert.ok(canAddRecognizedText(corrected));

const cleared = withOcrCorrection(successState, '   ');
assert.equal(cleared.status, 'success');
assert.ok(!canAddRecognizedText(cleared), 'whitespace-only correction cannot add a text block');

// Corrections cannot resurrect a failed or empty pass.
assert.equal(withOcrCorrection(errorState, 'manual').status, 'error');
assert.equal(withOcrCorrection(emptyState, 'manual').text, '');

assert.equal(ocrTextLineLabel(0), 'No text lines');
assert.equal(ocrTextLineLabel(1), '1 line of text');
assert.equal(ocrTextLineLabel(4), '4 lines of text');

// ------------------------------------------ placement, correction, and linking

const textOnlyPlacement = buildOcrPlacement({
  image,
  state: corrected,
  choice: 'text',
  textId: 'ocr-text-1',
  recognizedAt: '2026-01-02T03:04:05.000Z',
});
assert.equal(textOnlyPlacement.image.id, image.id);
assert.equal(textOnlyPlacement.image.ocr?.text, 'Corrected project title');
assert.equal(textOnlyPlacement.image.ocr?.engine, 'mlkit-v2');
assert.equal(textOnlyPlacement.image.ocr?.regionCount, 3);
assert.equal(textOnlyPlacement.image.ocr?.recognizedAt, '2026-01-02T03:04:05.000Z');
const linkedText = textOnlyPlacement.text as TextObject;
assert.ok(linkedText);
assert.equal(linkedText.type, 'text');
assert.equal(linkedText.text, 'Corrected project title');
assert.equal(linkedText.sourceImageId, image.id);
assert.equal(linkedText.x, image.x);
assert.equal(linkedText.y, image.y + image.height + OCR_TEXT_GAP);
assert.ok(linkedText.width >= 160);
assert.equal(
  linkedText.height,
  measureTextBlock(linkedText.text, linkedText.fontSize, linkedText.width).height,
);
// The text is a normal selectable object, not an overlay pinned to the image.
assert.ok(linkedText.id !== image.id);
assert.equal(linkedText.rotation, 0);

// Image-only keeps the reviewed extraction linked to the photo but creates no
// text object.
const imageOnlyPlacement = buildOcrPlacement({
  image,
  state: corrected,
  choice: 'image-only',
  recognizedAt: '2026-01-02T03:04:05.000Z',
});
assert.equal(imageOnlyPlacement.text, null);
assert.equal(imageOnlyPlacement.image.ocr?.text, 'Corrected project title');

// A loading pass is not a gate: the image can be placed before recognition ends.
const loadingPlacement = buildOcrPlacement({
  image,
  state: loadingOcrState(),
  choice: 'image-only',
});
assert.deepEqual(loadingPlacement, { image, text: null });
assert.equal(createOcrTextObject(image, loadingOcrState()), null);
assert.equal(withRecognizedOcr(image, loadingOcrState()), image);

// Failure is not a gate either. Both choices still return a placeable image.
for (const state of [errorState, emptyState, cleared]) {
  const textChoice = buildOcrPlacement({ image, state, choice: 'text' });
  assert.deepEqual(textChoice, { image, text: null });
  const imageChoice = buildOcrPlacement({ image, state, choice: 'image-only' });
  assert.deepEqual(imageChoice, { image, text: null });
}

// -------------------------------------------------- one undo step for two objects

let history = createDocumentHistory(emptyDocument);
history = documentReducer(history, {
  type: 'commands',
  commands: [
    { type: 'object.insert', object: textOnlyPlacement.image },
    { type: 'object.insert', object: linkedText },
  ],
});
assert.equal(history.present.objects.length, 2);
assert.ok(canUndo(history));
history = documentReducer(history, { type: 'undo' });
assert.equal(history.present.objects.length, 0, 'image + text placement is one undo step');
assert.ok(canRedo(history));
history = documentReducer(history, { type: 'redo' });
assert.equal(history.present.objects.length, 2);
assert.equal((history.present.objects[1] as TextObject).sourceImageId, image.id);

// ------------------------------------------------------- persistence + relaunch

type TestDatabase = {
  database: PersistenceDatabase;
  close: () => void;
};

function openTestDb(filename = ':memory:'): TestDatabase {
  const raw = new DatabaseSync(filename);
  raw.exec('PRAGMA foreign_keys = ON');
  const database: PersistenceDatabase = {
    async execAsync(source) { raw.exec(source); },
    async runAsync(source, params = []) {
      const result = raw.prepare(source).run(...(params as (string | number | null)[]));
      return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
    },
    async getFirstAsync<T>(source: string, params = []) {
      const row = raw.prepare(source).get(...(params as (string | number | null)[]));
      return (row ? { ...row } : null) as T | null;
    },
    async getAllAsync<T>(source: string, params = []) {
      return raw.prepare(source).all(...(params as (string | number | null)[])) as T[];
    },
    async withTransactionAsync<T>(action: () => Promise<T>) {
      raw.exec('BEGIN TRANSACTION');
      try {
        const result = await action();
        raw.exec('COMMIT');
        return result;
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return { database, close: () => raw.close() };
}

async function testPersistenceAndRelaunch() {
  const dir = mkdtempSync(join(tmpdir(), 'flowcanvas-ocr-test-'));
  const dbFile = join(dir, 'flowcanvas.db');
  const boardId = 'board-ocr-test';
  const document: CanvasDocument = {
    strokes: [],
    objects: [textOnlyPlacement.image, linkedText],
  };

  try {
    const firstRun = openTestDb(dbFile);
    try {
      await migrateDatabase(firstRun.database);
      await insertBoard(firstRun.database, {
        id: boardId,
        title: 'OCR Board',
        settings: DEFAULT_BOARD_SETTINGS,
        createdAt: '2026-01-01T00:00:00.000Z',
      });
      await saveBoardDocument(firstRun.database, boardId, document, { x: 0, y: 0, scale: 1 });
    } finally {
      firstRun.close();
    }

    // Simulate a kill and relaunch from the on-disk database.
    const relaunch = openTestDb(dbFile);
    try {
      const migration = await migrateDatabase(relaunch.database);
      assert.deepEqual(migration, { from: SCHEMA_VERSION, to: SCHEMA_VERSION, applied: [] });
      const loaded = await loadBoardDocument(relaunch.database, boardId);
      assert.ok(documentsEqual(loaded.document, document), 'OCR image and linked text round-trip');
      const restoredImage = loaded.document.objects.find((object) => object.type === 'image') as ImageObject;
      const restoredText = loaded.document.objects.find((object) => object.type === 'text') as TextObject;
      assert.equal(restoredImage.ocr?.text, 'Corrected project title');
      assert.equal(restoredImage.ocr?.engine, 'mlkit-v2');
      assert.equal(restoredImage.ocr?.regionCount, 3);
      assert.equal(restoredImage.ocr?.recognizedAt, '2026-01-02T03:04:05.000Z');
      assert.equal(restoredText.sourceImageId, restoredImage.id);
      assert.equal(restoredText.text, restoredImage.ocr?.text);
    } finally {
      relaunch.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

await testPersistenceAndRelaunch();

// Malformed OCR metadata is dropped without rejecting the whole image, and an
// older image row without OCR still loads.
const legacyImage = parseCanvasObject(JSON.stringify({ ...image, ocr: undefined }));
assert.ok(legacyImage && legacyImage.type === 'image');
assert.equal(legacyImage.ocr, undefined);
const brokenOcr = parseCanvasObject(
  JSON.stringify({
    ...image,
    ocr: { text: 'kept?', engine: '', regionCount: 'three', recognizedAt: '' },
  }),
);
assert.ok(brokenOcr && brokenOcr.type === 'image');
assert.equal(brokenOcr.ocr, undefined);

console.log(
  'OCR checks passed: line-level reading order, columns and title/column layouts, multiple regions, loading/success/no-text/error states, correction, linking, image-only fallback, one-step undo, OCR copy sizing, persistence and relaunch',
);
