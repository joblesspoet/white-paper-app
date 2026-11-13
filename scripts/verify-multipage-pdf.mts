import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

import {
  createStickyObject,
  documentsEqual,
  objectAtPoint,
  type CanvasDocument,
} from '../src/canvas/document.ts';
import { objectsInRect } from '../src/canvas/selection.ts';
import {
  BACKUP_VERSION,
  buildBoardBackup,
  parseBackup,
  planBackupImport,
  serializeBackup,
} from '../src/export/backup.ts';
import { buildMultiPagePdfHtml } from '../src/export/pdf-layout.ts';
import { pageExportRegion } from '../src/export/regions.ts';
import {
  buildPdfBackgroundImageObject,
  getPdfCapabilityStatus,
  MAX_PDF_IMPORT_PAGES,
  parsePageRange,
} from '../src/pdf/pdf-import-service.ts';
import { migrateDatabase, type PersistenceDatabase } from '../src/persistence/database.ts';
import {
  createPage,
  deletePage,
  duplicatePage,
  insertBoard,
  listBoardPages,
  loadBoardDocument,
  renamePage,
  reorderPages,
  saveBoardDocument,
} from '../src/persistence/repository.ts';
import { DEFAULT_BOARD_SETTINGS } from '../src/persistence/schema.ts';

function openTestDb(): { database: PersistenceDatabase; close: () => void } {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON');
  const database: PersistenceDatabase = {
    async execAsync(source) {
      raw.exec(source);
    },
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

async function testMultiPageCrudAndGuard(): Promise<void> {
  const { database, close } = openTestDb();
  try {
    await migrateDatabase(database);
    const now = '2026-11-13T10:00:00.000Z';
    await insertBoard(database, {
      id: 'board-mp',
      title: 'Algebra Lesson',
      settings: DEFAULT_BOARD_SETTINGS,
      createdAt: now,
    });

    let pages = await listBoardPages(database, 'board-mp');
    assert.equal(pages.length, 1);
    assert.equal(pages[0].name, 'Page 1');
    assert.equal(pages[0].orderIndex, 0);

    // Single-page guard: cannot delete sole remaining page.
    await assert.rejects(
      () => deletePage(database, 'board-mp', pages[0].id),
      /last remaining page/i,
    );

    // Save an annotation on Page 1.
    const note1 = { ...createStickyObject({ id: 'note-1', point: { x: 100, y: 120 } }), text: 'Problem 1' };
    await saveBoardDocument(
      database,
      'board-mp',
      { strokes: [], objects: [note1] },
      { x: 10, y: 20, scale: 1.25 },
      now,
      pages[0].id,
    );

    // Create Page 2 and Page 3.
    const page2 = await createPage(database, 'board-mp', {
      name: 'Worksheet A',
      backgroundAssetId: 'asset-pdf-1',
      viewport: { x: -50, y: 0, scale: 1 },
    });
    const page3 = await createPage(database, 'board-mp', {
      name: 'Summary',
    });

    pages = await listBoardPages(database, 'board-mp');
    assert.equal(pages.length, 3);
    assert.deepEqual(
      pages.map((p) => [p.name, p.orderIndex]),
      [
        ['Page 1', 0],
        ['Worksheet A', 1],
        ['Summary', 2],
      ],
    );
    assert.equal(pages[1].backgroundAssetId, 'asset-pdf-1');
    assert.deepEqual(pages[0].viewport, { x: 10, y: 20, scale: 1.25 });

    // Duplicate Page 1 right after Page 1.
    const dup = await duplicatePage(database, 'board-mp', pages[0].id);
    pages = await listBoardPages(database, 'board-mp');
    assert.equal(pages.length, 4);
    assert.equal(pages[1].id, dup.id);
    assert.equal(pages[1].name, 'Page 1 (copy)');
    assert.equal(pages[1].document.objects.length, 1);
    assert.notEqual(pages[1].document.objects[0].id, note1.id);

    // Rename & reorder.
    await renamePage(database, 'board-mp', page3.id, 'Exit Ticket');
    await reorderPages(database, 'board-mp', [page3.id, page2.id, pages[0].id, dup.id]);
    pages = await listBoardPages(database, 'board-mp');
    assert.deepEqual(
      pages.map((p) => [p.name, p.orderIndex]),
      [
        ['Exit Ticket', 0],
        ['Worksheet A', 1],
        ['Page 1', 2],
        ['Page 1 (copy)', 3],
      ],
    );

    // Delete duplicated page and verify contiguous order_index compaction.
    const delResult = await deletePage(database, 'board-mp', dup.id);
    assert.equal(delResult.deleted, true);
    assert.deepEqual(
      delResult.remainingPages.map((p) => p.orderIndex),
      [0, 1, 2],
    );
  } finally {
    close();
  }
}

async function testLockedBackgroundObjects(): Promise<void> {
  const { database, close } = openTestDb();
  try {
    await migrateDatabase(database);
    await insertBoard(database, {
      id: 'board-locked',
      title: 'PDF Markup',
      settings: DEFAULT_BOARD_SETTINGS,
      createdAt: '2026-11-13T10:00:00.000Z',
    });

    const bgImage = buildPdfBackgroundImageObject({
      id: 'pdf-bg-1',
      pageNumber: 1,
      assetId: 'asset-1',
      storagePath: 'media/board-locked/pdf-pages/p1.png',
      sourceWidth: 1000,
      sourceHeight: 1400,
      center: { x: 0, y: 0 },
    });
    assert.equal(bgImage.locked, true);

    const annotation = {
      ...createStickyObject({
        id: 'sticky-top',
        point: { x: 40, y: 40 },
      }),
      text: 'Check step 2',
    };

    const objects = [bgImage, annotation];

    // Tapping empty region over the locked PDF background returns null.
    assert.equal(objectAtPoint(objects, { x: -200, y: -200 }), null);
    // Explicitly including locked objects finds it.
    assert.equal(objectAtPoint(objects, { x: -200, y: -200 }, { includeLocked: true })?.id, 'pdf-bg-1');
    // Tapping the annotation on top selects the annotation.
    assert.equal(objectAtPoint(objects, { x: 40, y: 40 })?.id, 'sticky-top');

    // Marquee selection skips locked background, selects unlocked annotation.
    const marqueeHits = objectsInRect(objects, { x: -500, y: -500, width: 1000, height: 1000 });
    assert.deepEqual(marqueeHits.map((o) => o.id), ['sticky-top']);

    // SQLite persistence preserves `locked: true`.
    await saveBoardDocument(database, 'board-locked', { strokes: [], objects }, null);
    const loaded = await loadBoardDocument(database, 'board-locked');
    const loadedBg = loaded.document.objects.find((o) => o.id === 'pdf-bg-1');
    assert.equal(loadedBg?.locked, true);
  } finally {
    close();
  }
}

function testPdfRangeAndHtmlLayout(): void {
  const allTruncated = parsePageRange('all', 45);
  assert.equal(allTruncated.ok, true);
  if (allTruncated.ok) {
    assert.equal(allTruncated.pages.length, MAX_PDF_IMPORT_PAGES);
    assert.equal(allTruncated.truncated, true);
  }

  const custom = parsePageRange('1-3, 5, 7-8', 10);
  assert.deepEqual(custom, { ok: true, pages: [1, 2, 3, 5, 7, 8], truncated: false });

  const invalid = parsePageRange('9-2', 10);
  assert.equal(invalid.ok, false);

  const capability = getPdfCapabilityStatus();
  assert.equal(capability.available, false);
  if (!capability.available) {
    assert.ok(capability.reason.includes('development build'));
  }

  const html = buildMultiPagePdfHtml(
    [
      { pixelWidth: 800, pixelHeight: 1000, base64Png: 'AAA', name: 'Page 1' },
      { pixelWidth: 800, pixelHeight: 1000, base64Png: 'BBB', name: 'Page 2' },
    ],
    'Math <Worksheet>',
    '#FFFFFF',
  );
  assert.ok(html.includes('Math &lt;Worksheet&gt;'));
  assert.ok(html.includes('page-break-after: always;'));
  assert.ok(html.includes('page-break-after: auto;'));

  const doc: CanvasDocument = {
    strokes: [
      {
        id: 's1',
        tool: 'pen',
        color: '#000',
        width: 4,
        opacity: 1,
        createdAt: '2026-11-13T10:00:00.000Z',
        points: [{ x: 50, y: 60 }, { x: 250, y: 360 }],
      },
    ],
    objects: [],
  };
  const region = pageExportRegion(doc, { x: 0, y: 0, scale: 1 }, { width: 400, height: 600 }, 20);
  assert.equal(region.x, 28);
  assert.equal(region.y, 38);
  assert.equal(region.width, 244);
  assert.equal(region.height, 344);
}

async function testMultiPageBackupRoundTripAndV1Compat(): Promise<void> {
  const { database, close } = openTestDb();
  try {
    await migrateDatabase(database);
    const note1 = { ...createStickyObject({ id: 'n1', point: { x: 0, y: 0 } }), text: 'Page 1 note' };
    const bg2 = buildPdfBackgroundImageObject({
      id: 'bg2',
      pageNumber: 2,
      assetId: 'a2',
      storagePath: 'media/orig/pdf-pages/p2.png',
      sourceWidth: 800,
      sourceHeight: 1100,
    });
    const note2 = { ...createStickyObject({ id: 'n2', point: { x: 20, y: 30 } }), text: 'Page 2 note' };

    const backup = buildBoardBackup({
      title: 'Multi-Page Deck',
      document: { strokes: [], objects: [note1] },
      viewport: { x: 0, y: 0, scale: 1 },
      settings: DEFAULT_BOARD_SETTINGS,
      pages: [
        {
          id: 'p1',
          name: 'Intro',
          orderIndex: 0,
          viewport: { x: 0, y: 0, scale: 1 },
          backgroundAssetId: null,
          document: { strokes: [], objects: [note1] },
        },
        {
          id: 'p2',
          name: 'Worksheet p.2',
          orderIndex: 1,
          viewport: { x: 15, y: 25, scale: 1.5 },
          backgroundAssetId: 'a2',
          document: { strokes: [], objects: [bg2, note2] },
        },
      ],
      media: [
        {
          path: 'media/orig/pdf-pages/p2.png',
          mimeType: 'image/png',
          data: 'iVBORw0KGgo=',
          width: 800,
          height: 1100,
        },
      ],
    });
    assert.equal(backup.version, BACKUP_VERSION);

    const parsed = parseBackup(serializeBackup(backup));
    assert.equal(parsed.backup.pages?.length, 2);

    const plan = planBackupImport(parsed.backup, 'imported-mp-1', '2026-11-13T12:00:00.000Z');
    assert.equal(plan.pages.length, 2);

    const { insertImportedBoard } = await import('../src/persistence/repository.ts');
    await insertImportedBoard(database, plan);

    const restoredPages = await listBoardPages(database, 'imported-mp-1');
    assert.equal(restoredPages.length, 2);
    assert.equal(restoredPages[0].name, 'Intro');
    assert.equal(restoredPages[1].name, 'Worksheet p.2');
    assert.equal(restoredPages[1].backgroundAssetId, 'a2');
    assert.deepEqual(restoredPages[1].viewport, { x: 15, y: 25, scale: 1.5 });
    assert.equal(restoredPages[1].document.objects.length, 2);
    const restoredBg = restoredPages[1].document.objects.find((o) => o.type === 'image');
    assert.equal(restoredBg?.locked, true);

    // v1 single-page backup compatibility
    const v1Json = JSON.stringify({
      format: 'flowcanvas',
      version: 1,
      exportedAt: '2026-11-10T00:00:00.000Z',
      app: { name: 'FlowCanvas' },
      board: { title: 'Legacy v1', viewport: null, settings: DEFAULT_BOARD_SETTINGS },
      document: { strokes: [], objects: [note1] },
      media: [],
    });
    const parsedV1 = parseBackup(v1Json);
    assert.equal(parsedV1.sourceVersion, 1);
    assert.equal(parsedV1.backup.pages?.length, 1);
    assert.ok(documentsEqual(parsedV1.backup.pages![0].document, { strokes: [], objects: [note1] }));
  } finally {
    close();
  }
}

await testMultiPageCrudAndGuard();
await testLockedBackgroundObjects();
testPdfRangeAndHtmlLayout();
await testMultiPageBackupRoundTripAndV1Compat();

console.log(
  'multipage-pdf checks passed: multi-page SQLite CRUD + single-page guard, locked background hit-testing, PDF range/HTML layout, and v2/v1 backup round-trip',
);
