/// <reference types="node" />

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import {
  migrateDatabase,
  readSchemaVersion,
  type PersistenceDatabase,
} from '../src/persistence/database.ts';
import {
  clearAllLocalData,
  getLocalDataStats,
  insertBoard,
  insertMediaAsset,
  loadAppPreferences,
  resetAppPreferences,
  saveAppPreference,
  saveBoardDocument,
} from '../src/persistence/repository.ts';
import {
  DEFAULT_APP_PREFERENCES,
  DEFAULT_BOARD_SETTINGS,
  SCHEMA_VERSION,
  parseAppPreferences,
  serializeAppPreferences,
  type AppPreferences,
} from '../src/persistence/schema.ts';
import { createDocumentHistory } from '../src/canvas/document.ts';

type TestDatabase = {
  database: PersistenceDatabase;
  raw: DatabaseSync;
  close: () => void;
};

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

// ---------------------------------------------------------------- Tests

function testPreferenceParser(): void {
  // Missing / empty / invalid JSON
  assert.deepEqual(parseAppPreferences(null), DEFAULT_APP_PREFERENCES);
  assert.deepEqual(parseAppPreferences(undefined), DEFAULT_APP_PREFERENCES);
  assert.deepEqual(parseAppPreferences(''), DEFAULT_APP_PREFERENCES);
  assert.deepEqual(parseAppPreferences('not-json'), DEFAULT_APP_PREFERENCES);
  assert.deepEqual(parseAppPreferences('42'), DEFAULT_APP_PREFERENCES);
  assert.deepEqual(parseAppPreferences('[]'), DEFAULT_APP_PREFERENCES);

  // Partial or invalid values fallback to defaults
  const partial = parseAppPreferences(JSON.stringify({ theme: 'dark', haptics: false, defaultPenWidth: 999 }));
  assert.equal(partial.theme, 'dark');
  assert.equal(partial.haptics, false);
  assert.equal(partial.defaultPenWidth, DEFAULT_APP_PREFERENCES.defaultPenWidth); // invalid width falls back
  assert.equal(partial.canvasBackground, 'light'); // missing falls back

  // Invalid theme falls back
  const badTheme = parseAppPreferences(JSON.stringify({ theme: 'neon' }));
  assert.equal(badTheme.theme, 'system');

  // Full valid preferences
  const custom: AppPreferences = {
    theme: 'dark',
    canvasBackground: 'dark',
    canvasStyle: 'dots',
    defaultPenColor: 'teal',
    defaultPenWidth: 8,
    haptics: false,
    exportFormat: 'pdf',
  };
  const parsed = parseAppPreferences(serializeAppPreferences(custom));
  assert.deepEqual(parsed, custom);
}

async function testDatabasePreferencesRoundTrip(): Promise<void> {
  const test = openTestDatabase();
  try {
    await migrateDatabase(test.database);
    assert.equal(await readSchemaVersion(test.database), SCHEMA_VERSION);

    // Initial load returns defaults
    const initial = await loadAppPreferences(test.database);
    assert.deepEqual(initial, DEFAULT_APP_PREFERENCES);

    // Save individual preferences
    await saveAppPreference(test.database, 'theme', 'dark');
    await saveAppPreference(test.database, 'canvasBackground', 'dark');
    await saveAppPreference(test.database, 'canvasStyle', 'dots');
    await saveAppPreference(test.database, 'defaultPenColor', '#4338CA');
    await saveAppPreference(test.database, 'defaultPenWidth', 12);
    await saveAppPreference(test.database, 'haptics', false);
    await saveAppPreference(test.database, 'exportFormat', 'backup');

    const loaded = await loadAppPreferences(test.database);
    assert.equal(loaded.theme, 'dark');
    assert.equal(loaded.canvasBackground, 'dark');
    assert.equal(loaded.canvasStyle, 'dots');
    assert.equal(loaded.defaultPenColor, '#4338CA');
    assert.equal(loaded.defaultPenWidth, 12);
    assert.equal(loaded.haptics, false);
    assert.equal(loaded.exportFormat, 'backup');

    // Reset preferences
    const reset = await resetAppPreferences(test.database);
    assert.deepEqual(reset, DEFAULT_APP_PREFERENCES);
    assert.deepEqual(await loadAppPreferences(test.database), DEFAULT_APP_PREFERENCES);
  } finally {
    test.close();
  }
}

async function testOnDiskPreferencesRecovery(): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), 'flowcanvas-settings-test-'));
  const file = join(dir, 'test.db');
  try {
    // Open and write preferences
    const test1 = openTestDatabase(file);
    await migrateDatabase(test1.database);
    await saveAppPreference(test1.database, 'theme', 'dark');
    await saveAppPreference(test1.database, 'exportFormat', 'jpeg');
    test1.close();

    // Reopen and verify persistence
    const test2 = openTestDatabase(file);
    const recovered = await loadAppPreferences(test2.database);
    assert.equal(recovered.theme, 'dark');
    assert.equal(recovered.exportFormat, 'jpeg');
    test2.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function testClearLocalDataFlow(): Promise<void> {
  const test = openTestDatabase();
  try {
    await migrateDatabase(test.database);

    // Setup dummy data: 2 boards, objects, ink stroke, sticky note, media asset
    const now = new Date().toISOString();
    await insertBoard(test.database, {
      id: 'board-1',
      title: 'First Board',
      settings: DEFAULT_BOARD_SETTINGS,
      createdAt: now,
    });
    await insertBoard(test.database, {
      id: 'board-2',
      title: 'Second Board',
      settings: DEFAULT_BOARD_SETTINGS,
      createdAt: now,
    });

    const doc = createDocumentHistory().present;
    doc.strokes.push({
      id: 'stroke-1',
      tool: 'pen',
      color: '#134E4A',
      width: 4,
      opacity: 1,
      createdAt: now,
      points: [{ x: 10, y: 10 }],
    });
    doc.objects.push({
      type: 'sticky',
      id: 'sticky-1',
      colorKey: 'butter',
      fontSize: 16,
      text: 'Remember milk',
      x: 50,
      y: 50,
      width: 112,
      height: 112,
      rotation: 0,
    });
    doc.objects.push({
      type: 'shape',
      id: 'shape-1',
      shape: 'rectangle',
      direction: 'tlbr',
      colorKey: 'ink',
      fillKey: null,
      strokeWidth: 4,
      x: 100,
      y: 100,
      width: 200,
      height: 150,
      rotation: 0,
    });

    await saveBoardDocument(test.database, 'board-1', doc, null);

    await insertMediaAsset(test.database, {
      id: 'asset-1',
      boardId: 'board-1',
      ownerId: null,
      storagePath: 'media/board-1/originals/test.jpg',
      mimeType: 'image/jpeg',
      bytes: 1024 * 50, // 50 KB
      metadata: {},
      createdAt: now,
    });

    // Save custom preference
    await saveAppPreference(test.database, 'theme', 'dark');

    // Check stats before purge
    const statsBefore = await getLocalDataStats(test.database);
    assert.equal(statsBefore.boardCount, 2);
    assert.equal(statsBefore.stickyCount, 1);
    assert.equal(statsBefore.strokeCount, 1);
    assert.equal(statsBefore.shapeCount, 1);
    assert.equal(statsBefore.totalObjectCount, 3);
    assert.equal(statsBefore.mediaAssetCount, 1);
    assert.equal(statsBefore.mediaBytes, 1024 * 50);

    // Execute purge
    const result = await clearAllLocalData(test.database);
    assert.equal(result.boardsCleared, 2);
    assert.equal(result.objectsCleared, 3);
    assert.equal(result.mediaCleared, 1);

    // Verify stats after purge
    const statsAfter = await getLocalDataStats(test.database);
    assert.equal(statsAfter.boardCount, 0);
    assert.equal(statsAfter.stickyCount, 0);
    assert.equal(statsAfter.strokeCount, 0);
    assert.equal(statsAfter.shapeCount, 0);
    assert.equal(statsAfter.totalObjectCount, 0);
    assert.equal(statsAfter.mediaAssetCount, 0);
    assert.equal(statsAfter.mediaBytes, 0);

    // Preferences table is cleared; subsequent load returns defaults
    const prefsAfter = await loadAppPreferences(test.database);
    assert.deepEqual(prefsAfter, DEFAULT_APP_PREFERENCES);
  } finally {
    test.close();
  }
}

// ---------------------------------------------------------------- Main

async function main(): Promise<void> {
  testPreferenceParser();
  await testDatabasePreferencesRoundTrip();
  await testOnDiskPreferencesRecovery();
  await testClearLocalDataFlow();
  console.log('settings checks passed: parser, SQLite roundtrip, on-disk recovery, data stats, and clear-local-data purge');
}

await main();
