/// <reference types="node" />

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import type { CanvasDocument, CanvasObject } from '../src/canvas/document.ts';
import { MAX_ZOOM, MIN_ZOOM } from '../src/canvas/viewport.ts';
import type { InkStroke } from '../src/canvas/ink.ts';
import {
  LocalStoreVersionError,
  migrateDatabase,
  readSchemaVersion,
  type PersistenceDatabase,
} from '../src/persistence/database.ts';
import {
  documentsEqual,
  insertBoard,
  insertMediaAsset,
  listBoards,
  listMediaAssets,
  loadBoardDocument,
  parseCanvasObject,
  parseInkStroke,
  saveBoardDocument,
  saveBoardViewport,
  updateBoardTitle,
} from '../src/persistence/repository.ts';
import {
  DEFAULT_BOARD_SETTINGS,
  MIGRATIONS,
  SCHEMA_VERSION,
  parseBoardSettings,
  parseViewport,
  planMigrations,
} from '../src/persistence/schema.ts';
import {
  enqueuePersistenceWrite,
  whenPersistenceWritesSettled,
} from '../src/persistence/write-queue.ts';

// ------------------------------------------------------------ test database

type TestDatabase = {
  database: PersistenceDatabase;
  raw: DatabaseSync;
  close: () => void;
};

/**
 * Bind the repository's tiny async interface to Node's built-in SQLite. The
 * queries and migrations under test are exactly the ones the app runs.
 */
function openTestDatabase(filename = ':memory:'): TestDatabase {
  const raw = new DatabaseSync(filename);
  raw.exec('PRAGMA foreign_keys = ON');
  const database: PersistenceDatabase = {
    async execAsync(source) {
      raw.exec(source);
    },
    async runAsync(source, params = []) {
      const result = raw.prepare(source).run(...params);
      return {
        changes: Number(result.changes),
        lastInsertRowId: Number(result.lastInsertRowid),
      };
    },
    async getAllAsync<T>(source: string, params = []) {
      return raw.prepare(source).all(...params).map((row) => ({ ...row })) as T[];
    },
    async getFirstAsync<T>(source: string, params = []) {
      const row = raw.prepare(source).get(...params);
      return row ? ({ ...row } as T) : null;
    },
    async withTransactionAsync(task) {
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return { database, raw, close: () => raw.close() };
}

async function tableNames(database: PersistenceDatabase): Promise<string[]> {
  const rows = await database.getAllAsync<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`,
  );
  return rows.map((row) => row.name);
}

async function columnNames(database: PersistenceDatabase, table: string): Promise<string[]> {
  const rows = await database.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  return rows.map((row) => row.name);
}

// ------------------------------------------------------------------ fixtures

const CREATED_AT = '2026-01-01T00:00:00.000Z';

function makeBoard(id = 'board-1', title = 'Ideas') {
  return {
    id,
    title,
    createdAt: CREATED_AT,
    settings: { background: 'dark' as const, style: 'dots' as const, orientation: 'landscape' as const },
  };
}

const stroke: InkStroke = {
  id: 'ink-1',
  tool: 'pen',
  points: [
    { x: 1.5, y: 2.5 },
    { x: 12.25, y: -8 },
  ],
  color: '#123456',
  width: 4,
  opacity: 1,
  createdAt: CREATED_AT,
};

const textObject: CanvasObject = {
  id: 'text-1',
  type: 'text',
  text: 'Hello board',
  x: 10,
  y: 20,
  width: 160,
  height: 32,
  rotation: 15,
  colorKey: 'ink',
  fontSize: 18,
  fontWeight: 'bold',
  fontStyle: 'italic',
};

const stickyObject: CanvasObject = {
  id: 'sticky-1',
  type: 'sticky',
  text: 'A note',
  x: 0,
  y: 0,
  width: 112,
  height: 112,
  rotation: 0,
  colorKey: 'butter',
  fontSize: 16,
  fontWeight: 'normal',
  fontStyle: 'normal',
};

const shapeObject: CanvasObject = {
  id: 'shape-1',
  type: 'shape',
  shape: 'ellipse',
  x: 5,
  y: 6,
  width: 50,
  height: 40,
  rotation: 30,
  colorKey: 'blue',
  fillKey: 'sky',
  strokeWidth: 4,
  direction: 'tlbr',
};

const connectorObject: CanvasObject = {
  id: 'connector-1',
  type: 'connector',
  style: 'elbow',
  x: 1,
  y: 1,
  width: 100,
  height: 100,
  rotation: 0,
  colorKey: 'red',
  strokeWidth: 2,
  direction: 'brtl',
};

const fullDocument: CanvasDocument = {
  strokes: [stroke],
  objects: [textObject, stickyObject, shapeObject, connectorObject],
};

// ---------------------------------------------------------------- migrations

async function testFreshDatabase(): Promise<void> {
  const test = openTestDatabase();
  try {
    assert.deepEqual(planMigrations(0).map((migration) => migration.version), [1, 2]);
    assert.deepEqual(planMigrations(1).map((migration) => migration.version), [2]);
    assert.deepEqual(planMigrations(SCHEMA_VERSION), []);

    const result = await migrateDatabase(test.database);
    assert.deepEqual(result, { from: 0, to: SCHEMA_VERSION, applied: [1, 2] });
    assert.equal(await readSchemaVersion(test.database), SCHEMA_VERSION);

    const tables = await tableNames(test.database);
    for (const table of ['boards', 'board_pages', 'canvas_objects', 'media_assets']) {
      assert.ok(tables.includes(table), `missing table ${table}`);
    }
    assert.ok((await columnNames(test.database, 'boards')).includes('viewport_json'));
    assert.ok((await columnNames(test.database, 'canvas_objects')).includes('revision'));

    // Re-running is a no-op, not an error.
    const again = await migrateDatabase(test.database);
    assert.deepEqual(again, { from: SCHEMA_VERSION, to: SCHEMA_VERSION, applied: [] });
  } finally {
    test.close();
  }
}

async function testVersionOneUpgrade(): Promise<void> {
  const test = openTestDatabase();
  try {
    for (const statement of MIGRATIONS[0].statements) await test.database.execAsync(statement);
    await test.database.execAsync('PRAGMA user_version = 1');

    await test.database.runAsync(
      `INSERT INTO boards (id, title, created_at, updated_at, settings_json)
       VALUES (?, ?, ?, ?, ?)`,
      ['legacy', 'Legacy board', CREATED_AT, CREATED_AT, JSON.stringify(DEFAULT_BOARD_SETTINGS)],
    );
    await test.database.runAsync(
      `INSERT INTO board_pages (id, board_id, name, order_index, created_at, updated_at)
       VALUES (?, ?, ?, 0, ?, ?)`,
      ['legacy:page:0', 'legacy', 'Page 1', CREATED_AT, CREATED_AT],
    );
    await test.database.runAsync(
      `INSERT INTO canvas_objects
        (id, page_id, type, z_index, x, y, width, height, rotation, content_json, style_json, created_at, updated_at)
       VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        textObject.id,
        'legacy:page:0',
        'text',
        textObject.x,
        textObject.y,
        textObject.width,
        textObject.height,
        textObject.rotation,
        JSON.stringify(textObject),
        JSON.stringify({ colorKey: textObject.colorKey }),
        CREATED_AT,
        CREATED_AT,
      ],
    );

    const result = await migrateDatabase(test.database);
    assert.deepEqual(result, { from: 1, to: SCHEMA_VERSION, applied: [2] });
    assert.ok((await columnNames(test.database, 'boards')).includes('viewport_json'));

    const snapshot = await loadBoardDocument(test.database, 'legacy');
    assert.equal(snapshot.viewport, null);
    assert.equal(snapshot.document.objects.length, 1);
    assert.deepEqual(snapshot.document.objects[0], textObject);
  } finally {
    test.close();
  }
}

async function testNewerDatabaseIsRefused(): Promise<void> {
  const test = openTestDatabase();
  try {
    await test.database.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION + 1}`);
    await assert.rejects(
      () => migrateDatabase(test.database),
      (error: unknown) => error instanceof LocalStoreVersionError,
    );
    assert.equal(await readSchemaVersion(test.database), SCHEMA_VERSION + 1);
  } finally {
    test.close();
  }
}

// ------------------------------------------------------------ board records

async function testBoardMetadata(): Promise<void> {
  const test = openTestDatabase();
  try {
    await migrateDatabase(test.database);
    await insertBoard(test.database, makeBoard('older', 'Older'));
    await insertBoard(
      test.database,
      makeBoard('newer', 'Newer'),
      '2026-01-02T00:00:00.000Z',
    );

    let boards = await listBoards(test.database);
    assert.deepEqual(boards.map((board) => board.id), ['newer', 'older']);
    assert.deepEqual(boards[0].settings, makeBoard().settings);
    assert.equal(boards[0].objectCount, 0);
    assert.equal(boards[0].viewport, null);

    await saveBoardDocument(
      test.database,
      'newer',
      fullDocument,
      { x: 12.5, y: -40, scale: 2.5 },
      '2026-01-03T00:00:00.000Z',
    );
    await updateBoardTitle(test.database, 'newer', '  Renamed board  ', '2026-01-04T00:00:00.000Z');

    boards = await listBoards(test.database);
    assert.equal(boards[0].id, 'newer');
    assert.equal(boards[0].title, 'Renamed board');
    assert.equal(boards[0].objectCount, 5);
    assert.deepEqual(boards[0].viewport, { x: 12.5, y: -40, scale: 2.5 });

    await updateBoardTitle(test.database, 'older', '   ');
    boards = await listBoards(test.database);
    assert.equal(boards.find((board) => board.id === 'older')?.title, 'Untitled board');
  } finally {
    test.close();
  }
}

// ------------------------------------------------------------- documents

async function testDocumentRoundTrip(): Promise<void> {
  const test = openTestDatabase();
  try {
    await migrateDatabase(test.database);
    await insertBoard(test.database, makeBoard());
    const viewport = { x: 12.5, y: -40, scale: 2.5 };
    await saveBoardDocument(test.database, 'board-1', fullDocument, viewport);

    const snapshot = await loadBoardDocument(test.database, 'board-1');
    assert.ok(documentsEqual(snapshot.document, fullDocument), 'document round-trip mismatch');
    assert.deepEqual(snapshot.viewport, viewport);
    assert.equal(snapshot.pageId, 'board-1:page:0');

    const types = await test.database.getAllAsync<{ type: string; z_index: number }>(
      `SELECT type, z_index FROM canvas_objects WHERE page_id = ? ORDER BY z_index`,
      ['board-1:page:0'],
    );
    assert.deepEqual(types.map((row) => row.type), ['ink', 'text', 'sticky', 'shape', 'connector']);
    assert.deepEqual(types.map((row) => row.z_index), [0, 1, 2, 3, 4]);

    // A second save replaces the page rows rather than duplicating them.
    const smaller: CanvasDocument = { strokes: [], objects: [textObject] };
    await saveBoardDocument(
      test.database,
      'board-1',
      smaller,
      null,
      '2026-02-01T00:00:00.000Z',
    );
    const replaced = await loadBoardDocument(test.database, 'board-1');
    assert.ok(documentsEqual(replaced.document, smaller));
    assert.equal(replaced.viewport, null);
    const count = await test.database.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count FROM canvas_objects`,
    );
    assert.equal(count?.count, 1);

    const boards = await listBoards(test.database);
    assert.equal(boards[0].objectCount, 1);
    assert.equal(boards[0].updatedAt, '2026-02-01T00:00:00.000Z');
  } finally {
    test.close();
  }
}

async function testViewportOnlySave(): Promise<void> {
  const test = openTestDatabase();
  try {
    await migrateDatabase(test.database);
    await insertBoard(test.database, makeBoard());
    await saveBoardViewport(test.database, 'board-1', { x: -10, y: 25, scale: 0.75 });
    const snapshot = await loadBoardDocument(test.database, 'board-1');
    assert.deepEqual(snapshot.viewport, { x: -10, y: 25, scale: 0.75 });
  } finally {
    test.close();
  }
}

async function testCorruptRowsAreSkipped(): Promise<void> {
  const test = openTestDatabase();
  try {
    await migrateDatabase(test.database);
    await insertBoard(test.database, makeBoard());
    const pageId = 'board-1:page:0';

    await test.database.runAsync(
      `INSERT INTO canvas_objects
        (id, page_id, type, z_index, x, y, width, height, rotation, content_json, style_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['good', pageId, 'text', 0, 1, 2, 30, 40, 0, JSON.stringify(textObject), '{}', CREATED_AT, CREATED_AT],
    );
    await test.database.runAsync(
      `INSERT INTO canvas_objects
        (id, page_id, type, z_index, content_json, created_at, updated_at)
       VALUES (?, ?, 'shape', 1, ?, ?, ?)`,
      ['bad-json', pageId, '{not json', CREATED_AT, CREATED_AT],
    );
    await test.database.runAsync(
      `INSERT INTO canvas_objects
        (id, page_id, type, z_index, content_json, created_at, updated_at)
       VALUES (?, ?, 'image', 2, ?, ?, ?)`,
      ['unknown-type', pageId, JSON.stringify({ id: 'unknown-type', type: 'image' }), CREATED_AT, CREATED_AT],
    );
    await test.database.runAsync(`UPDATE boards SET viewport_json = ? WHERE id = ?`, [
      '{"x": "nope"}',
      'board-1',
    ]);

    const snapshot = await loadBoardDocument(test.database, 'board-1');
    assert.equal(snapshot.document.objects.length, 1);
    assert.equal(snapshot.document.objects[0].id, textObject.id);
    assert.equal(snapshot.viewport, null);

    assert.equal(parseCanvasObject('{not json'), null);
    assert.equal(parseCanvasObject(JSON.stringify({ id: 'x', type: 'image' })), null);
    assert.equal(parseInkStroke(JSON.stringify({ id: 'ink', points: [] })), null);
  } finally {
    test.close();
  }
}

// -------------------------------------------------------------------- media

async function testMediaReferences(): Promise<void> {
  const test = openTestDatabase();
  try {
    await migrateDatabase(test.database);
    await insertBoard(test.database, makeBoard());
    await insertMediaAsset(test.database, {
      id: 'media-1',
      boardId: 'board-1',
      ownerId: null,
      storagePath: 'media/board-1/photo.jpg',
      mimeType: 'image/jpeg',
      bytes: 2048,
      metadata: { width: 1024, height: 768, source: 'photo' },
      createdAt: CREATED_AT,
    });
    const assets = await listMediaAssets(test.database, 'board-1');
    assert.equal(assets.length, 1);
    assert.deepEqual(assets[0], {
      id: 'media-1',
      boardId: 'board-1',
      ownerId: null,
      storagePath: 'media/board-1/photo.jpg',
      mimeType: 'image/jpeg',
      bytes: 2048,
      metadata: { width: 1024, height: 768, source: 'photo' },
      createdAt: CREATED_AT,
    });
  } finally {
    test.close();
  }
}

// ------------------------------------------------------------------ parsers

function testValueParsers(): void {
  assert.deepEqual(parseBoardSettings(null), DEFAULT_BOARD_SETTINGS);
  assert.deepEqual(parseBoardSettings('{oops'), DEFAULT_BOARD_SETTINGS);
  assert.deepEqual(parseBoardSettings('{"background":"dark","style":"dots","orientation":"landscape"}'), {
    background: 'dark',
    style: 'dots',
    orientation: 'landscape',
  });

  assert.equal(parseViewport(null), null);
  assert.equal(parseViewport('{oops'), null);
  assert.equal(parseViewport('{"x":1,"y":2,"scale":99}')?.scale, MAX_ZOOM);
  assert.equal(parseViewport('{"x":1,"y":2,"scale":-4}')?.scale, MIN_ZOOM);
  assert.deepEqual(parseViewport('{"x":1,"y":2,"scale":2}'), { x: 1, y: 2, scale: 2 });
}

// ------------------------------------------------------- restart / durability

/**
 * Simulate create → edit → kill → relaunch → reopen with a real database file:
 * write everything, close the connection, open a fresh connection, and read it
 * back. No in-memory state survives between the two halves.
 */
async function testRestartRecovery(): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), 'flowcanvas-persistence-'));
  const filename = join(directory, 'flowcanvas.db');
  const viewport = { x: -120.5, y: 88, scale: 1.75 };
  try {
    const firstRun = openTestDatabase(filename);
    try {
      await migrateDatabase(firstRun.database);
      await insertBoard(firstRun.database, makeBoard());
      await saveBoardDocument(firstRun.database, 'board-1', fullDocument, viewport);
    } finally {
      firstRun.close();
    }

    const relaunch = openTestDatabase(filename);
    try {
      // A relaunch must not re-run or reset the schema.
      const migration = await migrateDatabase(relaunch.database);
      assert.deepEqual(migration, {
        from: SCHEMA_VERSION,
        to: SCHEMA_VERSION,
        applied: [],
      });
      const boards = await listBoards(relaunch.database);
      assert.equal(boards.length, 1);
      assert.equal(boards[0].title, 'Ideas');
      assert.equal(boards[0].objectCount, 5);
      const snapshot = await loadBoardDocument(relaunch.database, 'board-1');
      assert.ok(documentsEqual(snapshot.document, fullDocument));
      assert.deepEqual(snapshot.viewport, viewport);
    } finally {
      relaunch.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------- write queue

async function testWriteQueueOrder(): Promise<void> {
  const order: string[] = [];
  let releaseFirst: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });

  const first = enqueuePersistenceWrite(async () => {
    order.push('first:start');
    await gate;
    order.push('first:end');
  });
  const second = enqueuePersistenceWrite(async () => {
    order.push('second');
  });

  // Let the queue start the first task before releasing its gate.
  await Promise.resolve();
  await Promise.resolve();
  // The second task must not start while the first is still running.
  assert.deepEqual(order, ['first:start']);
  releaseFirst();
  await Promise.all([first, second]);
  assert.deepEqual(order, ['first:start', 'first:end', 'second']);

  // A failed write must not poison the queue for later autosaves.
  await assert.rejects(
    enqueuePersistenceWrite(async () => {
      throw new Error('disk full');
    }),
    /disk full/,
  );
  await enqueuePersistenceWrite(async () => {
    order.push('after-failure');
  });
  await whenPersistenceWritesSettled();
  assert.ok(order.includes('after-failure'));
}

// --------------------------------------------------------------------- main

async function main(): Promise<void> {
  await testFreshDatabase();
  await testVersionOneUpgrade();
  await testNewerDatabaseIsRefused();
  await testBoardMetadata();
  await testDocumentRoundTrip();
  await testViewportOnlySave();
  await testCorruptRowsAreSkipped();
  await testMediaReferences();
  await testRestartRecovery();
  await testWriteQueueOrder();
  testValueParsers();
  console.log('persistence checks passed');
}

await main();
