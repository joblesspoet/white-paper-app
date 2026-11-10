/**
 * A tiny database interface plus the schema migration runner.
 *
 * The app binds this to expo-sqlite. Verification binds the same interface to
 * Node's built-in SQLite, so migrations and repository queries are exercised
 * against a real database instead of a hand-written fake.
 */

import { MIGRATIONS, SCHEMA_VERSION, planMigrations } from './schema.ts';

export type SqlValue = string | number | null;
export type SqlParams = readonly SqlValue[];

export type SqlRunResult = {
  changes: number;
  lastInsertRowId: number;
};

export type PersistenceDatabase = {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params?: SqlParams): Promise<SqlRunResult>;
  getAllAsync<T>(source: string, params?: SqlParams): Promise<T[]>;
  getFirstAsync<T>(source: string, params?: SqlParams): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
};

/** The database was written by a build newer than this one; do not touch it. */
export class LocalStoreVersionError extends Error {
  readonly version: number;

  constructor(version: number) {
    super(
      `The local board store uses schema version ${version}, but this build only understands ${SCHEMA_VERSION}. Update the app before opening it.`,
    );
    this.name = 'LocalStoreVersionError';
    this.version = version;
  }
}

export async function readSchemaVersion(database: PersistenceDatabase): Promise<number> {
  const row = await database.getFirstAsync<{ user_version?: number | null }>('PRAGMA user_version');
  const version = row?.user_version;
  return typeof version === 'number' && Number.isFinite(version) ? Math.floor(version) : 0;
}

export type MigrationResult = {
  from: number;
  to: number;
  applied: number[];
};

/**
 * Bring a database up to `SCHEMA_VERSION`. Each migration and its version bump
 * run in one transaction, so a crash cannot leave a half-applied version.
 */
export async function migrateDatabase(
  database: PersistenceDatabase,
): Promise<MigrationResult> {
  const from = await readSchemaVersion(database);
  if (from > SCHEMA_VERSION) throw new LocalStoreVersionError(from);

  const pending = planMigrations(from);
  for (const migration of pending) {
    await database.withTransactionAsync(async () => {
      for (const statement of migration.statements) {
        await database.execAsync(statement);
      }
      await database.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
  }

  const to = await readSchemaVersion(database);
  if (to !== SCHEMA_VERSION) {
    throw new Error(
      `Local board store stopped at schema version ${to}; expected ${SCHEMA_VERSION}.`,
    );
  }
  return { from, to, applied: pending.map((migration) => migration.version) };
}

export { MIGRATIONS, SCHEMA_VERSION };
