import * as SQLite from 'expo-sqlite';

import { migrateDatabase, type PersistenceDatabase } from './database.ts';

/**
 * The app's single SQLite connection. Opening and migrating are lazy so the
 * first screen paints immediately; a failure clears the cached promise so a
 * later action can retry instead of being stuck on one bad open.
 */
let databasePromise: Promise<PersistenceDatabase> | null = null;

function wrap(database: SQLite.SQLiteDatabase): PersistenceDatabase {
  return {
    execAsync: (source) => database.execAsync(source),
    runAsync: async (source, params = []) => {
      const result = await database.runAsync(source, [...params]);
      return { changes: result.changes, lastInsertRowId: result.lastInsertRowId };
    },
    getAllAsync: <T>(source: string, params = []) =>
      database.getAllAsync<T>(source, [...params]),
    getFirstAsync: <T>(source: string, params = []) =>
      database.getFirstAsync<T>(source, [...params]),
    withTransactionAsync: (task) => database.withTransactionAsync(task),
  };
}

async function open(): Promise<PersistenceDatabase> {
  const database = await SQLite.openDatabaseAsync('flowcanvas.db');
  // WAL keeps autosave writes from blocking reads while a board is open.
  await database.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  await migrateDatabase(wrap(database));
  return wrap(database);
}

export function getLocalDatabase(): Promise<PersistenceDatabase> {
  if (!databasePromise) {
    databasePromise = open().catch((error) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

/** Only used by development resets; normal code shares the cached connection. */
export function closeLocalDatabase(): void {
  databasePromise = null;
}
