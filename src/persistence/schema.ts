/**
 * Local SQLite schema, versioning, and value parsers.
 *
 * The schema is deliberately boring: boards own pages, pages own canvas
 * objects, and media references point at files the board may import later. The
 * schema version lives in SQLite's `PRAGMA user_version`, so a database written
 * by an older build can be upgraded in place before the app reads a row.
 *
 * Every migration is append-only. Never edit an existing migration: a shipped
 * build may already have applied it. Add a new entry with the next version and
 * the statements needed to move forward.
 */

import { clampScale, type Viewport } from '../canvas/viewport.ts';

export type BoardBackground = 'light' | 'dark';
export type BoardStyle = 'blank' | 'dots';
export type BoardOrientation = 'landscape' | 'portrait';

export type BoardSettings = {
  background: BoardBackground;
  style: BoardStyle;
  orientation: BoardOrientation;
};

export const DEFAULT_BOARD_SETTINGS: BoardSettings = {
  background: 'light',
  style: 'blank',
  orientation: 'portrait',
};

export type Migration = {
  /** Monotonic version written to `PRAGMA user_version` after it succeeds. */
  version: number;
  name: string;
  statements: readonly string[];
};

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: 'create board store',
    statements: [
      `CREATE TABLE IF NOT EXISTS boards (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        settings_json TEXT NOT NULL DEFAULT '{"background":"light","style":"blank","orientation":"portrait"}'
      )`,
      `CREATE TABLE IF NOT EXISTS board_pages (
        id TEXT PRIMARY KEY NOT NULL,
        board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        order_index INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS board_pages_board_order
        ON board_pages(board_id, order_index)`,
      `CREATE TABLE IF NOT EXISTS canvas_objects (
        id TEXT PRIMARY KEY NOT NULL,
        page_id TEXT NOT NULL REFERENCES board_pages(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        z_index INTEGER NOT NULL DEFAULT 0,
        x REAL,
        y REAL,
        width REAL,
        height REAL,
        rotation REAL NOT NULL DEFAULT 0,
        content_json TEXT NOT NULL,
        style_json TEXT NOT NULL DEFAULT '{}',
        deleted_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS canvas_objects_page_order
        ON canvas_objects(page_id, z_index)`,
      `CREATE TABLE IF NOT EXISTS media_assets (
        id TEXT PRIMARY KEY NOT NULL,
        board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        owner_id TEXT,
        storage_path TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        bytes INTEGER NOT NULL DEFAULT 0,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS media_assets_board
        ON media_assets(board_id)`,
    ],
  },
  {
    version: 2,
    name: 'save viewport and object revisions',
    statements: [
      `ALTER TABLE boards ADD COLUMN viewport_json TEXT`,
      `ALTER TABLE canvas_objects ADD COLUMN revision INTEGER NOT NULL DEFAULT 1`,
      `CREATE INDEX IF NOT EXISTS canvas_objects_page_type
        ON canvas_objects(page_id, type)`,
    ],
  },
] as const;

/** Latest schema version this build understands. */
export const SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 0;

/** Migrations still needed to bring `fromVersion` up to the current schema. */
export function planMigrations(fromVersion: number): readonly Migration[] {
  const current = Number.isFinite(fromVersion) ? Math.floor(fromVersion) : 0;
  return MIGRATIONS.filter((migration) => migration.version > current).sort(
    (left, right) => left.version - right.version,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Parse stored settings, falling back to the default for missing or bad JSON. */
export function parseBoardSettings(raw: string | null | undefined): BoardSettings {
  if (!raw) return { ...DEFAULT_BOARD_SETTINGS };
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return { ...DEFAULT_BOARD_SETTINGS };
    const background: BoardBackground = value.background === 'dark' ? 'dark' : 'light';
    const style: BoardStyle = value.style === 'dots' ? 'dots' : 'blank';
    const orientation: BoardOrientation =
      value.orientation === 'landscape' ? 'landscape' : 'portrait';
    return { background, style, orientation };
  } catch {
    return { ...DEFAULT_BOARD_SETTINGS };
  }
}

/**
 * Parse a stored viewport. A corrupt value must never stop a board from opening,
 * so bad or incomplete data becomes `null` and the editor uses its default.
 */
export function parseViewport(raw: string | null | undefined): Viewport | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return null;
    const { x, y, scale } = value;
    if (
      typeof x !== 'number' ||
      typeof y !== 'number' ||
      typeof scale !== 'number' ||
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(scale)
    ) {
      return null;
    }
    return { x, y, scale: clampScale(scale) };
  } catch {
    return null;
  }
}

export function serializeViewport(viewport: Viewport): string {
  return JSON.stringify({ x: viewport.x, y: viewport.y, scale: viewport.scale });
}

export function serializeBoardSettings(settings: BoardSettings): string {
  return JSON.stringify(settings);
}
