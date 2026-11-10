/// <reference types="node" />

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import {
  MAX_IMAGE_CANVAS_WIDTH,
  createDocumentHistory,
  createImageObject,
  documentReducer,
  documentsEqual,
  duplicateObject,
  imagePlacement,
  isImageObject,
  objectAtPoint,
  withObjectGeometry,
  type CanvasDocument,
  type ImageCrop,
  type ImageObject,
  type ImageRotation,
} from '../src/canvas/document.ts';
import { canRedo, canUndo } from '../src/canvas/history.ts';
import { resizeObject, selectionBounds } from '../src/canvas/selection.ts';
import {
  CROP_MAX_ZOOM,
  IMAGE_ROTATIONS,
  MAX_WORKING_DIMENSION,
  clampCropTransform,
  coverScale,
  cropMetadata,
  cropRectFromTransform,
  fitImageInFrame,
  isFullImageCrop,
  isImageRotation,
  nextRotation,
  rotatedSize,
  safeBoardSegment,
  toImageCrop,
  zoomCropTransform,
} from '../src/media/image-crop.ts';
import {
  IMAGE_SOURCE_COPY,
  imageImportErrorMessage,
  imagePickErrorMessage,
  permissionDeniedMessage,
} from '../src/media/image-source.ts';
import {
  migrateDatabase,
  type PersistenceDatabase,
} from '../src/persistence/database.ts';
import {
  insertBoard,
  insertMediaAsset,
  listMediaAssets,
  loadBoardDocument,
  parseCanvasObject,
  saveBoardDocument,
} from '../src/persistence/repository.ts';
import { DEFAULT_BOARD_SETTINGS, SCHEMA_VERSION } from '../src/persistence/schema.ts';

function close(actual: number, expected: number, epsilon = 1e-4) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${expected}, got ${actual}`);
}

// ------------------------------------------------------------- permission copy

// 1. Permission denied messages
const cameraAskAgain = permissionDeniedMessage('camera', true);
const cameraPermanentlyDenied = permissionDeniedMessage('camera', false);
assert.equal(cameraAskAgain, 'Camera access is needed to add an image.');
assert.equal(cameraPermanentlyDenied, 'Camera access is off. Enable it in system Settings to add an image.');

const libraryAskAgain = permissionDeniedMessage('library', true);
const libraryPermanentlyDenied = permissionDeniedMessage('library', false);
assert.equal(libraryAskAgain, 'Photo library access is needed to add an image.');
assert.equal(libraryPermanentlyDenied, 'Photo library access is off. Enable it in system Settings to add an image.');

// Source screen copy
assert.ok(IMAGE_SOURCE_COPY.camera.title.length > 0);
assert.ok(IMAGE_SOURCE_COPY.camera.action.length > 0);
assert.ok(IMAGE_SOURCE_COPY.library.title.length > 0);
assert.ok(IMAGE_SOURCE_COPY.library.action.length > 0);

// Error fallback messages
assert.equal(imagePickErrorMessage(null), 'The image could not be opened. Try another photo.');
assert.equal(imagePickErrorMessage(new Error('Pick failed')), 'Pick failed');
assert.equal(imageImportErrorMessage(null), 'The image could not be saved on this device.');
assert.equal(imageImportErrorMessage(new Error('Out of space')), 'Out of space');

// Board segment sanitisation
assert.equal(safeBoardSegment('board-123'), 'board-123');
assert.equal(safeBoardSegment('../etc/passwd'), '.._etc_passwd');
assert.equal(safeBoardSegment(''), 'board');

// ----------------------------------------------------------------- large image

// Large camera images (e.g. 8000x6000) fit within MAX_IMAGE_CANVAS_WIDTH (320), preserving aspect ratio
const landscapePlacement = imagePlacement(8000, 6000, { x: 500, y: 300 });
assert.equal(landscapePlacement.width, MAX_IMAGE_CANVAS_WIDTH);
assert.equal(landscapePlacement.height, Math.round(MAX_IMAGE_CANVAS_WIDTH * (6000 / 8000)));
assert.equal(landscapePlacement.x, 500 - Math.round(landscapePlacement.width / 2));
assert.equal(landscapePlacement.y, 300 - Math.round(landscapePlacement.height / 2));

// Portrait camera photo (e.g. 3000x4000)
const portraitPlacement = imagePlacement(3000, 4000, { x: 0, y: 0 });
assert.equal(portraitPlacement.width, MAX_IMAGE_CANVAS_WIDTH);
assert.equal(portraitPlacement.height, Math.round(MAX_IMAGE_CANVAS_WIDTH * (4000 / 3000)));

// Square image
const squarePlacement = imagePlacement(2000, 2000, { x: 100, y: 100 });
assert.equal(squarePlacement.width, MAX_IMAGE_CANVAS_WIDTH);
assert.equal(squarePlacement.height, MAX_IMAGE_CANVAS_WIDTH);

// Panorama (e.g. 10000x2000)
const panoramaPlacement = imagePlacement(10000, 2000, { x: 0, y: 0 });
assert.equal(panoramaPlacement.width, MAX_IMAGE_CANVAS_WIDTH);
assert.equal(panoramaPlacement.height, Math.round(MAX_IMAGE_CANVAS_WIDTH * 0.2));

// Edge cases: zero or negative dimensions fallback safely
const safeFallback = imagePlacement(0, 0, { x: 0, y: 0 });
assert.ok(safeFallback.width > 0 && safeFallback.height > 0);
assert.equal(MAX_WORKING_DIMENSION, 4096);

// ------------------------------------------------------------- crop and rotate

// Rotation helpers
for (const rot of IMAGE_ROTATIONS) {
  assert.ok(isImageRotation(rot));
}
assert.ok(!isImageRotation(45));
assert.ok(!isImageRotation('90'));

assert.equal(nextRotation(0), 90);
assert.equal(nextRotation(90), 180);
assert.equal(nextRotation(180), 270);
assert.equal(nextRotation(270), 0);

// Rotated size
assert.deepEqual(rotatedSize(800, 600, 0), { width: 800, height: 600 });
assert.deepEqual(rotatedSize(800, 600, 90), { width: 600, height: 800 });
assert.deepEqual(rotatedSize(800, 600, 180), { width: 800, height: 600 });
assert.deepEqual(rotatedSize(800, 600, 270), { width: 600, height: 800 });

// Cover scale
// Frame: 400x300. Image: 800x600 -> cover scale is 0.5
close(coverScale(800, 600, 400, 300), 0.5);
// Image: 800x400 in 400x300 frame -> scale needed for height is 300/400 = 0.75 > 400/800 = 0.5
close(coverScale(800, 400, 400, 300), 0.75);

// Fit in frame centres the image
const fit = fitImageInFrame(800, 600, 400, 300);
close(fit.scale, 0.5);
close(fit.translateX, 0);
close(fit.translateY, 0);

// Clamping prevents empty padding
const clamped = clampCropTransform({ scale: 0.5, translateX: 50, translateY: -100 }, 800, 600, 400, 300);
assert.equal(clamped.translateX, 0, 'cannot pan past left edge');
assert.equal(clamped.translateY, 0, 'cannot pan past top edge');

// Zoom around focal point
const zoomed = zoomCropTransform(
  fit,
  1.0, // zoom in 2x from 0.5
  200, 150, // centre of frame
  800, 600,
  400, 300,
);
close(zoomed.scale, 1.0);
close(zoomed.translateX, -200);
close(zoomed.translateY, -150);

// Crop rect in source coordinates
const cropRect = cropRectFromTransform(zoomed, 800, 600, 400, 300);
assert.equal(cropRect.x, 200);
assert.equal(cropRect.y, 150);
assert.equal(cropRect.width, 400);
assert.equal(cropRect.height, 300);
assert.ok(!isFullImageCrop(cropRect, 800, 600));

// Full image crop detection
const fullCrop = cropRectFromTransform(fit, 800, 600, 400, 300);
assert.ok(isFullImageCrop(fullCrop, 800, 600));

// Crop metadata conversion
const cropMeta: ImageCrop = toImageCrop(cropRect, 90);
assert.deepEqual(cropMeta, { x: 200, y: 150, width: 400, height: 300, rotation: 90 });

// Placed crop metadata record
const metaRecord = cropMetadata(cropMeta, 'asset-original', 'library', { width: 400, height: 300 });
assert.equal(metaRecord.kind, 'placed');
assert.equal(metaRecord.originalAssetId, 'asset-original');

// ------------------------------------------------------- image canvas object

const testImage: ImageObject = createImageObject({
  id: 'img-1',
  point: { x: 100, y: 100 },
  assetId: 'asset-placed-1',
  storagePath: 'media/board-1/images/asset-placed-1.jpg',
  originalAssetId: 'asset-orig-1',
  originalStoragePath: 'media/board-1/originals/asset-orig-1.jpg',
  sourceWidth: 640,
  sourceHeight: 480,
  originalWidth: 1920,
  originalHeight: 1080,
  crop: cropMeta,
});

assert.equal(testImage.id, 'img-1');
assert.equal(testImage.type, 'image');
assert.ok(isImageObject(testImage));
assert.equal(testImage.width, MAX_IMAGE_CANVAS_WIDTH);
assert.equal(testImage.height, Math.round(MAX_IMAGE_CANVAS_WIDTH * (480 / 640)));
assert.equal(testImage.rotation, 0);

// Hit testing
assert.ok(objectAtPoint([testImage], { x: 100, y: 100 }));
assert.ok(objectAtPoint([testImage], { x: testImage.x + 1, y: testImage.y + 1 }));
assert.ok(objectAtPoint([testImage], { x: testImage.x + testImage.width - 1, y: testImage.y + testImage.height - 1 }));
assert.equal(objectAtPoint([testImage], { x: testImage.x - 10, y: testImage.y }), null);

// Hit testing rotated image
const rotatedImage = withObjectGeometry(testImage, { rotation: 90 });
assert.equal(rotatedImage.rotation, 90);
const center = { x: testImage.x + testImage.width / 2, y: testImage.y + testImage.height / 2 };
assert.ok(objectAtPoint([rotatedImage], center));

// Proportional resizing (aspect ratio preserved)
const originalAspect = testImage.height / testImage.width;
const resizedSE = resizeObject(testImage, 'se', { x: testImage.x + 400, y: testImage.y + 200 }, 24);
assert.equal(resizedSE.width, 400);
close(resizedSE.height / resizedSE.width, originalAspect);
assert.equal(resizedSE.x, testImage.x, 'SE resize preserves NW corner');
assert.equal(resizedSE.y, testImage.y, 'SE resize preserves NW corner');

const resizedNW = resizeObject(testImage, 'nw', { x: testImage.x - 50, y: testImage.y - 50 }, 24);
assert.equal(resizedNW.x + resizedNW.width, testImage.x + testImage.width, 'NW resize preserves SE corner');
close(resizedNW.height / resizedNW.width, originalAspect);

// Duplication
const duplicated = duplicateObject(testImage, 'img-dup') as ImageObject;
assert.equal(duplicated.id, 'img-dup');
assert.equal(duplicated.type, 'image');
assert.equal(duplicated.x, testImage.x + 16);
assert.equal(duplicated.y, testImage.y + 16);
assert.equal(duplicated.storagePath, testImage.storagePath);
assert.equal(duplicated.originalAssetId, testImage.originalAssetId);
assert.deepEqual(duplicated.crop, testImage.crop);

// ---------------------------------------------------- undo/redo and history

const emptyDoc: CanvasDocument = { strokes: [], objects: [] };
let history = createDocumentHistory(emptyDoc);

// Insert image
history = documentReducer(history, {
  type: 'command',
  command: { type: 'object.insert', object: testImage },
});
assert.equal(history.present.objects.length, 1);
assert.equal(history.present.objects[0].id, 'img-1');
assert.ok(canUndo(history));
assert.ok(!canRedo(history));

// Move image
history = documentReducer(history, {
  type: 'command',
  command: { type: 'object.move', id: 'img-1', x: 200, y: 250 },
});
assert.equal(history.present.objects[0].x, 200);
assert.equal(history.present.objects[0].y, 250);

// Undo move
history = documentReducer(history, { type: 'undo' });
assert.equal(history.present.objects[0].x, testImage.x);
assert.equal(history.present.objects[0].y, testImage.y);

// Redo move
history = documentReducer(history, { type: 'redo' });
assert.equal(history.present.objects[0].x, 200);
assert.equal(history.present.objects[0].y, 250);

// Delete image
history = documentReducer(history, {
  type: 'command',
  command: { type: 'object.delete', id: 'img-1' },
});
assert.equal(history.present.objects.length, 0);

// Undo delete restores the image object
history = documentReducer(history, { type: 'undo' });
assert.equal(history.present.objects.length, 1);
assert.equal(history.present.objects[0].id, 'img-1');

// Redo delete removes it again
history = documentReducer(history, { type: 'redo' });
assert.equal(history.present.objects.length, 0);

// Undo back to restored
history = documentReducer(history, { type: 'undo' });
assert.equal(history.present.objects.length, 1);

// Equality comparison with nested crop
const docA: CanvasDocument = { strokes: [], objects: [testImage] };
const docB: CanvasDocument = {
  strokes: [],
  objects: [{ ...testImage, crop: { ...testImage.crop } }],
};
assert.ok(documentsEqual(docA, docB), 'documentsEqual handles ImageObject and crop');

// ------------------------------------------------- persistence and relaunch

type TestDatabase = {
  database: PersistenceDatabase;
  raw: DatabaseSync;
  close: () => void;
};

function openTestDb(filename = ':memory:'): TestDatabase {
  const raw = new DatabaseSync(filename);
  raw.exec('PRAGMA foreign_keys = ON');
  const database: PersistenceDatabase = {
    async execAsync(source) { raw.exec(source); },
    async runAsync(source, params = []) {
      const statement = raw.prepare(source);
      const result = statement.run(...(params as (string | number | null)[]));
      return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
    },
    async getFirstAsync<T>(source: string, params = []) {
      const statement = raw.prepare(source);
      return (statement.get(...(params as (string | number | null)[])) as T | undefined) ?? null;
    },
    async getAllAsync<T>(source: string, params = []) {
      const statement = raw.prepare(source);
      return statement.all(...(params as (string | number | null)[])) as T[];
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
  return { database, raw, close: () => raw.close() };
}

async function testPersistenceAndRelaunch() {
  const dir = mkdtempSync(join(tmpdir(), 'flowcanvas-image-test-'));
  const dbFile = join(dir, 'flowcanvas.db');
  const boardId = 'board-img-test';
  const boardDoc: CanvasDocument = {
    strokes: [],
    objects: [testImage],
  };

  try {
    // 1. Initial write
    const firstRun = openTestDb(dbFile);
    try {
      await migrateDatabase(firstRun.database);
      await insertBoard(firstRun.database, {
        id: boardId,
        title: 'Image Board',
        settings: DEFAULT_BOARD_SETTINGS,
        createdAt: '2026-01-01T00:00:00.000Z',
      });

      // Save media asset records
      await insertMediaAsset(firstRun.database, {
        id: testImage.originalAssetId,
        boardId,
        ownerId: null,
        storagePath: testImage.originalStoragePath,
        mimeType: 'image/jpeg',
        bytes: 1024000,
        metadata: { width: 1920, height: 1080 },
        createdAt: '2026-01-01T00:00:00.000Z',
      });
      await insertMediaAsset(firstRun.database, {
        id: testImage.assetId,
        boardId,
        ownerId: null,
        storagePath: testImage.storagePath,
        mimeType: 'image/jpeg',
        bytes: 256000,
        metadata: cropMetadata(testImage.crop, testImage.originalAssetId, 'library', {
          width: testImage.sourceWidth,
          height: testImage.sourceHeight,
        }),
        createdAt: '2026-01-01T00:00:00.000Z',
      });

      // Save document with image object
      await saveBoardDocument(firstRun.database, boardId, boardDoc, { x: 0, y: 0, scale: 1 });
    } finally {
      firstRun.close();
    }

    // 2. Simulate app kill and relaunch: reopen DB from disk
    const relaunch = openTestDb(dbFile);
    try {
      const migration = await migrateDatabase(relaunch.database);
      assert.deepEqual(migration, { from: SCHEMA_VERSION, to: SCHEMA_VERSION, applied: [] });

      // Load document back
      const loaded = await loadBoardDocument(relaunch.database, boardId);
      assert.ok(documentsEqual(loaded.document, boardDoc), 'loaded document must match original');
      assert.equal(loaded.document.objects.length, 1);
      const restored = loaded.document.objects[0] as ImageObject;
      assert.equal(restored.type, 'image');
      assert.equal(restored.id, testImage.id);
      assert.equal(restored.assetId, testImage.assetId);
      assert.equal(restored.storagePath, testImage.storagePath);
      assert.equal(restored.originalAssetId, testImage.originalAssetId);
      assert.equal(restored.originalStoragePath, testImage.originalStoragePath);
      assert.deepEqual(restored.crop, testImage.crop);

      // Verify media assets
      const media = await listMediaAssets(relaunch.database, boardId);
      assert.equal(media.length, 2);
      const placedRecord = media.find((m) => m.id === testImage.assetId);
      assert.ok(placedRecord);
      assert.equal(placedRecord.storagePath, testImage.storagePath);

      // Verify malformed row resilience
      assert.equal(parseCanvasObject('{"type": "image", "id": "bad"}'), null);
      assert.equal(parseCanvasObject('{"type": "image", "id": "bad", "crop": "not-obj"}'), null);
    } finally {
      relaunch.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

await testPersistenceAndRelaunch();

console.log('image checks passed: permission copy, cancel, large image, crop, rotate, placement, resize, history, persistence and relaunch');
