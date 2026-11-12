/// <reference types="node" />

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import {
  EMPTY_DOCUMENT,
  createConnectorObject,
  createImageObject,
  createShapeObject,
  createStickyObject,
  createTextObject,
  documentsEqual,
  type CanvasDocument,
  type ImageObject,
  type TextObject,
} from '../src/canvas/document.ts';
import { createInkStroke } from '../src/canvas/ink.ts';
import {
  BACKUP_EXTENSION,
  BACKUP_FORMAT,
  BACKUP_VERSION,
  BackupError,
  MAX_BACKUP_BYTES,
  assertBackupSize,
  backupSummary,
  buildBoardBackup,
  importErrorMessage,
  importedBoardTitle,
  isSafeMediaPath,
  parseBackup,
  planBackupImport,
  serializeBackup,
} from '../src/export/backup.ts';
import {
  EXPORT_SELECTION_PADDING,
  MAX_EXPORT_DIMENSION,
  MIN_EXPORT_DIMENSION,
  exportFileName,
  exportPixelSize,
  formatBytes,
  isLargeExport,
  objectsForScope,
  progressFraction,
  sanitizeFileStem,
  selectionExportRegion,
  visibleBoardRegion,
} from '../src/export/regions.ts';
import { classifyShareResult, wasShared } from '../src/export/share-outcome.ts';
import { migrateDatabase, type PersistenceDatabase } from '../src/persistence/database.ts';
import {
  getBoard,
  insertBoard,
  insertImportedBoard,
  listMediaAssets,
  loadBoardDocument,
  saveBoardDocument,
} from '../src/persistence/repository.ts';
import { DEFAULT_BOARD_SETTINGS } from '../src/persistence/schema.ts';

// ----------------------------------------------------------------- empty board

const emptyRegion = visibleBoardRegion({ x: 0, y: 0, scale: 1 }, { width: 400, height: 800 });
assert.deepEqual(emptyRegion, { x: 0, y: 0, width: 400, height: 800 });
assert.equal(selectionExportRegion(EMPTY_DOCUMENT, []), null);
assert.equal(selectionExportRegion(EMPTY_DOCUMENT, ['missing']), null);
assert.equal(isLargeExport(EMPTY_DOCUMENT, exportPixelSize(emptyRegion)), false);

const emptyBackup = buildBoardBackup({
  title: '   ',
  document: EMPTY_DOCUMENT,
  viewport: null,
  settings: DEFAULT_BOARD_SETTINGS,
  exportedAt: '2026-11-12T00:00:00.000Z',
});
assert.equal(emptyBackup.board.title, 'Untitled board');
assert.equal(emptyBackup.format, BACKUP_FORMAT);
assert.equal(emptyBackup.version, BACKUP_VERSION);
const parsedEmpty = parseBackup(serializeBackup(emptyBackup));
assert.ok(documentsEqual(parsedEmpty.backup.document, EMPTY_DOCUMENT));
assert.equal(backupSummary(parsedEmpty.backup), '0 objects · 0 strokes');

// ------------------------------------------------------------------ selections

const note = { ...createStickyObject({ id: 'sticky-1', point: { x: 200, y: 150 } }), text: 'Note A' };
const shape = createShapeObject({
  id: 'shape-1',
  shape: 'rectangle',
  start: { x: 300, y: 200 },
  end: { x: 420, y: 280 },
});
const rotatedText: TextObject = {
  ...createTextObject({ id: 'text-1', point: { x: 100, y: 100 } }),
  text: 'Rotated',
  rotation: 45,
};
const selectionDoc: CanvasDocument = {
  strokes: [createInkStroke({ id: 's-1', tool: 'pen', point: { x: 10, y: 10 }, color: '#134E4A', width: 4, opacity: 1 })],
  objects: [note, shape, rotatedText],
};

const selectedRegion = selectionExportRegion(selectionDoc, ['shape-1']);
assert.ok(selectedRegion);
assert.equal(selectedRegion.x, 300 - EXPORT_SELECTION_PADDING);
assert.equal(selectedRegion.y, 200 - EXPORT_SELECTION_PADDING);
assert.equal(selectedRegion.width, 120 + EXPORT_SELECTION_PADDING * 2);
assert.equal(selectedRegion.height, 80 + EXPORT_SELECTION_PADDING * 2);

assert.deepEqual(
  objectsForScope(selectionDoc, 'selection', ['shape-1']).map((item) => item.id),
  ['shape-1'],
);
assert.equal(objectsForScope(selectionDoc, 'visible').length, 3);
// Ink is not selectable, so selecting a non-existent id yields null.
assert.equal(selectionExportRegion(selectionDoc, ['s-1']), null);

// Tiny selection is lifted to MIN_EXPORT_DIMENSION; huge region is clamped to MAX_EXPORT_DIMENSION.
const tinyPixels = exportPixelSize({ x: 0, y: 0, width: 2, height: 2 });
assert.ok(tinyPixels.width >= MIN_EXPORT_DIMENSION);
assert.ok(tinyPixels.height >= MIN_EXPORT_DIMENSION);

const hugePixels = exportPixelSize({ x: 0, y: 0, width: 10000, height: 5000 });
assert.equal(hugePixels.width, MAX_EXPORT_DIMENSION);
assert.equal(hugePixels.height, 2048);

// ----------------------------------------------------------------- large board

const largeObjects = Array.from({ length: 90 }, (_, index) =>
  createShapeObject({
    id: `large-shape-${index}`,
    shape: index % 2 === 0 ? 'rectangle' : 'ellipse',
    start: { x: index * 20, y: index * 10 },
    end: { x: index * 20 + 60, y: index * 10 + 40 },
  }),
);
const largeStrokes = Array.from({ length: 30 }, (_, index) =>
  createInkStroke({
    id: `large-ink-${index}`,
    tool: 'pen',
    point: { x: index * 15, y: index * 15 },
    color: '#134E4A',
    width: 4,
    opacity: 1,
    createdAt: '2026-11-12T00:00:00.000Z',
  }),
);
const largeDoc: CanvasDocument = { strokes: largeStrokes, objects: largeObjects };
assert.equal(isLargeExport(largeDoc, exportPixelSize({ x: 0, y: 0, width: 800, height: 600 })), true);
assert.equal(progressFraction(45, 90), 0.5);
assert.equal(progressFraction(120, 90), 1);
assert.equal(progressFraction(-5, 0), 0);

// --------------------------------------------------------------- file naming

assert.equal(sanitizeFileStem('My Q4 / Roadmap: Draft!'), 'My-Q4-Roadmap-Draft');
assert.equal(sanitizeFileStem('***'), 'board');
assert.ok(exportFileName('Design Sprint', 'png', 'visible', new Date(2026, 10, 12, 9, 5)).endsWith('-board-20261112-0905.png'));
assert.ok(exportFileName('Design Sprint', 'jpeg', 'selection', new Date(2026, 10, 12, 9, 5)).endsWith('-selection-20261112-0905.jpg'));
assert.ok(exportFileName('Design Sprint', 'pdf', 'visible', new Date(2026, 10, 12, 9, 5)).endsWith('-board-20261112-0905.pdf'));
assert.ok(exportFileName('Design Sprint', 'backup', 'visible', new Date(2026, 10, 12, 9, 5)).endsWith(BACKUP_EXTENSION));
assert.equal(formatBytes(512), '512 B');
assert.equal(formatBytes(2048), '2.0 KB');

// --------------------------------------------------------------- invalid files

assert.throws(() => parseBackup(''), (error: unknown) => error instanceof BackupError && error.code === 'empty-file');
assert.throws(() => parseBackup('   \n  '), (error: unknown) => error instanceof BackupError && error.code === 'empty-file');
assert.throws(() => parseBackup('{not json'), (error: unknown) => error instanceof BackupError && error.code === 'invalid-json');
assert.throws(() => parseBackup('[]'), (error: unknown) => error instanceof BackupError && error.code === 'invalid-document');
assert.throws(
  () => parseBackup(JSON.stringify({ format: 'other-app', version: 1, document: EMPTY_DOCUMENT })),
  (error: unknown) => error instanceof BackupError && error.code === 'unsupported-format',
);
assert.throws(
  () => parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 'one', document: EMPTY_DOCUMENT })),
  (error: unknown) => error instanceof BackupError && error.code === 'invalid-version',
);
assert.throws(
  () => parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 1, document: { strokes: 'bad', objects: [] } })),
  (error: unknown) => error instanceof BackupError && error.code === 'invalid-document',
);
assert.throws(
  () => parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 1, document: EMPTY_DOCUMENT, media: 'bad' })),
  (error: unknown) => error instanceof BackupError && error.code === 'invalid-media',
);
assert.throws(
  () => assertBackupSize(MAX_BACKUP_BYTES + 1),
  (error: unknown) => error instanceof BackupError && error.code === 'too-large',
);

// Unsafe media paths (traversal, absolute paths, schemes) are rejected.
assert.equal(isSafeMediaPath('media/b1/images/x.jpg'), true);
assert.equal(isSafeMediaPath('../secret.jpg'), false);
assert.equal(isSafeMediaPath('/etc/passwd'), false);
assert.equal(isSafeMediaPath('file:///tmp/x.jpg'), false);

// ------------------------------------------------------------ version mismatch

assert.throws(
  () =>
    parseBackup(
      JSON.stringify({
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION + 1,
        document: EMPTY_DOCUMENT,
      }),
    ),
  (error: unknown) => error instanceof BackupError && error.code === 'unsupported-version',
);

// Legacy unversioned document (version 0) migrates missing style fields.
const legacyJson = JSON.stringify({
  strokes: [],
  objects: [
    { id: 'legacy-text', type: 'text', x: 10, y: 20, width: 160, height: 40, rotation: 0, text: 'Legacy' },
    { id: 'legacy-conn', type: 'connector', x: 50, y: 60, width: 100, height: 80, rotation: 0 },
  ],
});
const migrated = parseBackup(legacyJson);
assert.equal(migrated.sourceVersion, 0);
assert.equal(migrated.backup.document.objects.length, 2);
assert.equal(importedBoardTitle('Project Alpha'), 'Project Alpha (imported)');
assert.equal(importedBoardTitle('Project Alpha (imported)'), 'Project Alpha (imported)');
assert.ok(importErrorMessage(new BackupError('invalid-json', 'Bad JSON')).includes('Bad JSON'));

// ----------------------------------------------------------- round-trip import

const imageObj: ImageObject = {
  ...createImageObject({
    id: 'img-1',
    point: { x: 200, y: 200 },
    assetId: 'asset-placed',
    storagePath: 'media/orig-board/images/placed.jpg',
    originalAssetId: 'asset-orig',
    originalStoragePath: 'media/orig-board/originals/orig.jpg',
    sourceWidth: 600,
    sourceHeight: 400,
    originalWidth: 1200,
    originalHeight: 800,
    crop: { x: 0, y: 0, width: 600, height: 400, rotation: 0 },
  }),
  ocr: {
    text: 'Diagram label',
    engine: 'apple-vision',
    regionCount: 1,
    recognizedAt: '2026-11-12T00:00:00.000Z',
  },
};
const ocrText: TextObject = {
  ...createTextObject({ id: 'ocr-text-1', point: { x: 200, y: 360 } }),
  text: 'Diagram label',
  sourceImageId: imageObj.id,
};
const connector = createConnectorObject({
  id: 'conn-1',
  style: 'elbow',
  start: { x: 40, y: 40 },
  end: { x: 180, y: 140 },
});
const roundTripDoc: CanvasDocument = {
  strokes: largeStrokes.slice(0, 2),
  objects: [note, shape, connector, imageObj, ocrText],
};

const exportedJson = serializeBackup(
  buildBoardBackup({
    title: 'Architecture',
    document: roundTripDoc,
    viewport: { x: 24, y: -12, scale: 1.5 },
    settings: { background: 'dark', style: 'dots', orientation: 'landscape' },
    media: [
      { path: 'media/orig-board/images/placed.jpg', mimeType: 'image/jpeg', data: 'AQID', width: 600, height: 400 },
      { path: 'media/orig-board/originals/orig.jpg', mimeType: 'image/jpeg', data: 'BAUG', width: 1200, height: 800 },
    ],
  }),
);
const reparsed = parseBackup(exportedJson);
const plan = planBackupImport(reparsed.backup, 'new-board-id', '2026-11-12T01:00:00.000Z');
assert.equal(plan.board.id, 'new-board-id');
assert.equal(plan.board.title, 'Architecture (imported)');
assert.equal(plan.missingMedia.length, 0);
assert.equal(plan.media.length, 2);

const importedImage = plan.document.objects.find((obj) => obj.type === 'image') as ImageObject;
const importedOcrText = plan.document.objects.find((obj) => obj.id === 'new-board-id:ocr-text-1') as TextObject;
assert.ok(importedImage.storagePath.startsWith('media/new-board-id/imported/'));
assert.equal(importedOcrText.sourceImageId, importedImage.id);

type TestDatabase = { database: PersistenceDatabase; close: () => void };

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

async function testRoundTripSqlite() {
  const dir = mkdtempSync(join(tmpdir(), 'flowcanvas-export-test-'));
  const dbFile = join(dir, 'flowcanvas.db');
  try {
    const db = openTestDb(dbFile);
    try {
      await migrateDatabase(db.database);
      await insertBoard(db.database, {
        id: 'orig-board',
        title: 'Architecture',
        settings: DEFAULT_BOARD_SETTINGS,
        createdAt: '2026-11-12T00:00:00.000Z',
      });
      await saveBoardDocument(db.database, 'orig-board', roundTripDoc, { x: 24, y: -12, scale: 1.5 });

      await insertImportedBoard(db.database, plan);

      const originalRecord = await getBoard(db.database, 'orig-board');
      const importedRecord = await getBoard(db.database, 'new-board-id');
      assert.ok(originalRecord && importedRecord);
      assert.equal(originalRecord.title, 'Architecture');
      assert.equal(importedRecord.title, 'Architecture (imported)');
      assert.deepEqual(importedRecord.settings, { background: 'dark', style: 'dots', orientation: 'landscape' });

      const loadedImported = await loadBoardDocument(db.database, 'new-board-id');
      assert.ok(documentsEqual(loadedImported.document, plan.document), 'imported document round-trips through SQLite');
      assert.deepEqual(loadedImported.viewport, { x: 24, y: -12, scale: 1.5 });

      const mediaRows = await listMediaAssets(db.database, 'new-board-id');
      assert.equal(mediaRows.length, 2);
    } finally {
      db.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

await testRoundTripSqlite();

// ---------------------------------------------------------- share cancellation

const shared = classifyShareResult(null);
assert.equal(shared.outcome, 'shared');
assert.equal(wasShared(shared.outcome), true);

for (const cancelErr of [
  new Error('User cancelled sharing'),
  new Error('UserCancel'),
  new Error('Share sheet dismissed'),
]) {
  const cancelled = classifyShareResult(cancelErr);
  assert.equal(cancelled.outcome, 'cancelled');
  assert.equal(wasShared(cancelled.outcome), false);
}

const unavailable = classifyShareResult(new Error('Sharing is not available on this platform'));
assert.equal(unavailable.outcome, 'unavailable');
assert.equal(wasShared(unavailable.outcome), false);

const failed = classifyShareResult(new Error('Disk full'));
assert.equal(failed.outcome, 'failed');
assert.equal(wasShared(failed.outcome), false);

console.log(
  'Export/import checks passed: empty boards, large boards, selections, invalid files, version mismatch, round-trip import, and share cancellation',
);
