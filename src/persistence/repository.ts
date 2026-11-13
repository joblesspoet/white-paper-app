/**
 * Board repository: every read and write the app needs for local persistence.
 *
 * Documents are stored one row per canvas object, including ink strokes, so a
 * future page or object query does not need to parse the whole board. The full
 * object is also kept in `content_json`; the mirrored geometry columns exist for
 * indexing and inspection, not as a second source of truth.
 *
 * A save replaces the page's object rows inside one transaction. That keeps the
 * write simple and atomic for the board sizes this MVP targets; incremental row
 * updates can replace it when boards grow large.
 */

import type {
  CanvasDocument,
  CanvasObject,
  ConnectorStyle,
  ImageOcr,
  LineDirection,
  ShapeKind,
  TableCell,
} from '../canvas/document.ts';
import {
  ALL_SHAPE_KINDS,
  documentsEqual,
  normalizeColumnRatios,
} from '../canvas/document.ts';
import type { InkStroke } from '../canvas/ink.ts';
import type { Viewport } from '../canvas/viewport.ts';
import type { PersistenceDatabase, SqlParams } from './database.ts';
import {
  DEFAULT_BOARD_SETTINGS,
  parseBoardSettings,
  parseViewport,
  serializeBoardSettings,
  serializeViewport,
  type BoardSettings,
  type AppPreferences,
  DEFAULT_APP_PREFERENCES,
  parseAppPreferences,
  serializeAppPreferences,
} from './schema.ts';

export type BoardRecord = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  settings: BoardSettings;
  viewport: Viewport | null;
  objectCount: number;
};

export type NewBoardRecord = {
  id: string;
  title: string;
  settings: BoardSettings;
  createdAt: string;
};

export type BoardSnapshot = {
  document: CanvasDocument;
  viewport: Viewport | null;
  pageId: string | null;
};

export type MediaAssetRecord = {
  id: string;
  boardId: string;
  ownerId: string | null;
  storagePath: string;
  mimeType: string;
  bytes: number;
  metadata: Record<string, unknown>;
  createdAt: string;
};

type BoardRow = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  settings_json: string | null;
  viewport_json: string | null;
  object_count?: number | null;
};

type PageRow = {
  id: string;
  board_id: string;
  name: string;
  order_index: number;
};

type CanvasObjectRow = {
  id: string;
  type: string;
  z_index: number;
  content_json: string;
};

type MediaAssetRow = {
  id: string;
  board_id: string;
  owner_id: string | null;
  storage_path: string;
  mime_type: string;
  bytes: number | null;
  metadata_json: string | null;
  created_at: string;
};

const BOARD_COLUMNS = `
  b.id, b.title, b.created_at, b.updated_at, b.settings_json, b.viewport_json,
  (
    SELECT COUNT(*)
    FROM canvas_objects o
    JOIN board_pages p ON p.id = o.page_id
    WHERE p.board_id = b.id AND o.deleted_at IS NULL
  ) AS object_count
`;

/** Stable id for a board's first page, so a retried create cannot duplicate it. */
export function defaultPageId(boardId: string): string {
  return `${boardId}:page:0`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function boardFromRow(row: BoardRow): BoardRecord {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    settings: parseBoardSettings(row.settings_json),
    viewport: parseViewport(row.viewport_json),
    objectCount: Number(row.object_count ?? 0),
  };
}

// -------------------------------------------------------------------- boards

export async function listBoards(database: PersistenceDatabase): Promise<BoardRecord[]> {
  const rows = await database.getAllAsync<BoardRow>(
    `SELECT ${BOARD_COLUMNS} FROM boards b ORDER BY b.updated_at DESC`,
  );
  return rows.map(boardFromRow);
}

export async function getBoard(
  database: PersistenceDatabase,
  boardId: string,
): Promise<BoardRecord | null> {
  const row = await database.getFirstAsync<BoardRow>(
    `SELECT ${BOARD_COLUMNS} FROM boards b WHERE b.id = ?`,
    [boardId],
  );
  return row ? boardFromRow(row) : null;
}

/**
 * Create a board and its first page together. The page row is what lets every
 * later save be a plain page-scoped object replacement.
 */
export async function insertBoard(
  database: PersistenceDatabase,
  board: NewBoardRecord,
  now = board.createdAt,
): Promise<void> {
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `INSERT OR IGNORE INTO boards (id, title, created_at, updated_at, settings_json)
       VALUES (?, ?, ?, ?, ?)`,
      [board.id, board.title, board.createdAt, now, serializeBoardSettings(board.settings)],
    );
    await database.runAsync(
      `INSERT OR IGNORE INTO board_pages (id, board_id, name, order_index, created_at, updated_at)
       VALUES (?, ?, ?, 0, ?, ?)`,
      [defaultPageId(board.id), board.id, 'Page 1', board.createdAt, now],
    );
  });
}

export async function updateBoardTitle(
  database: PersistenceDatabase,
  boardId: string,
  title: string,
  now = new Date().toISOString(),
): Promise<void> {
  await database.runAsync(
    `UPDATE boards SET title = ?, updated_at = ? WHERE id = ?`,
    [title.trim() || 'Untitled board', now, boardId],
  );
}

export async function updateBoardSettings(
  database: PersistenceDatabase,
  boardId: string,
  settings: BoardSettings,
  now = new Date().toISOString(),
): Promise<void> {
  await database.runAsync(
    `UPDATE boards SET settings_json = ?, updated_at = ? WHERE id = ?`,
    [serializeBoardSettings(settings), now, boardId],
  );
}

// ----------------------------------------------------------------- documents

async function firstPage(
  database: PersistenceDatabase,
  boardId: string,
): Promise<PageRow | null> {
  return database.getFirstAsync<PageRow>(
    `SELECT id, board_id, name, order_index
     FROM board_pages WHERE board_id = ? ORDER BY order_index ASC LIMIT 1`,
    [boardId],
  );
}

async function ensurePage(
  database: PersistenceDatabase,
  boardId: string,
  now: string,
): Promise<string> {
  const page = await firstPage(database, boardId);
  if (page) return page.id;
  const id = defaultPageId(boardId);
  await database.runAsync(
    `INSERT OR IGNORE INTO board_pages (id, board_id, name, order_index, created_at, updated_at)
     VALUES (?, ?, ?, 0, ?, ?)`,
    [id, boardId, 'Page 1', now, now],
  );
  return id;
}

/** Load a board's document and saved viewport. Corrupt rows are skipped. */
export async function loadBoardDocument(
  database: PersistenceDatabase,
  boardId: string,
): Promise<BoardSnapshot> {
  const board = await database.getFirstAsync<{ viewport_json: string | null }>(
    `SELECT viewport_json FROM boards WHERE id = ?`,
    [boardId],
  );
  const viewport = parseViewport(board?.viewport_json);
  const page = await firstPage(database, boardId);
  if (!page) return { document: { strokes: [], objects: [] }, viewport, pageId: null };

  const rows = await database.getAllAsync<CanvasObjectRow>(
    `SELECT id, type, z_index, content_json
     FROM canvas_objects
     WHERE page_id = ? AND deleted_at IS NULL
     ORDER BY z_index ASC, rowid ASC`,
    [page.id],
  );

  const strokes: InkStroke[] = [];
  const objects: CanvasObject[] = [];
  for (const row of rows) {
    if (row.type === 'ink') {
      const stroke = parseInkStroke(row.content_json);
      if (stroke) strokes.push(stroke);
      continue;
    }
    const object = parseCanvasObject(row.content_json);
    if (object) objects.push(object);
  }
  return { document: { strokes, objects }, viewport, pageId: page.id };
}

/** Save a board document and viewport in one transaction. */
export async function saveBoardDocument(
  database: PersistenceDatabase,
  boardId: string,
  document: CanvasDocument,
  viewport: Viewport | null,
  now = new Date().toISOString(),
): Promise<void> {
  const pageId = await ensurePage(database, boardId, now);
  await database.withTransactionAsync(async () => {
    await database.runAsync(`DELETE FROM canvas_objects WHERE page_id = ?`, [pageId]);

    let zIndex = 0;
    for (const stroke of document.strokes) {
      await insertCanvasRow(database, {
        id: stroke.id,
        pageId,
        type: 'ink',
        zIndex,
        x: null,
        y: null,
        width: null,
        height: null,
        rotation: 0,
        content: stroke,
        style: {
          color: stroke.color,
          width: stroke.width,
          opacity: stroke.opacity,
          tool: stroke.tool,
        },
        createdAt: stroke.createdAt,
        updatedAt: now,
      });
      zIndex += 1;
    }
    for (const object of document.objects) {
      await insertCanvasRow(database, {
        id: object.id,
        pageId,
        type: object.type,
        zIndex,
        x: object.x,
        y: object.y,
        width: object.width,
        height: object.height,
        rotation: object.rotation,
        content: object,
        style: objectStyle(object),
        createdAt: now,
        updatedAt: now,
      });
      zIndex += 1;
    }

    await database.runAsync(
      `UPDATE boards SET updated_at = ?, viewport_json = ? WHERE id = ?`,
      [now, viewport ? serializeViewport(viewport) : null, boardId],
    );
  });
}

type InsertObjectInput = {
  id: string;
  pageId: string;
  type: string;
  zIndex: number;
  x: number | null;
  y: number | null;
  width: number | null;
  height: number | null;
  rotation: number;
  content: CanvasObject | InkStroke;
  style: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

async function insertCanvasRow(
  database: PersistenceDatabase,
  input: InsertObjectInput,
): Promise<void> {
  const params: SqlParams = [
    input.id,
    input.pageId,
    input.type,
    input.zIndex,
    input.x,
    input.y,
    input.width,
    input.height,
    input.rotation,
    JSON.stringify(input.content),
    JSON.stringify(input.style),
    input.createdAt,
    input.updatedAt,
  ];
  await database.runAsync(
    `INSERT OR REPLACE INTO canvas_objects
      (id, page_id, type, z_index, x, y, width, height, rotation, content_json, style_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    params,
  );
}

function objectStyle(object: CanvasObject): Record<string, unknown> {
  const style: Record<string, unknown> = {};
  if ('colorKey' in object) style.colorKey = object.colorKey;
  if (object.type === 'shape') {
    style.shape = object.shape;
    style.fillKey = object.fillKey;
    style.strokeWidth = object.strokeWidth;
    if (object.showMeasurements !== undefined) style.showMeasurements = object.showMeasurements;
  }
  if (object.type === 'table') {
    style.rows = object.rows;
    style.columns = object.columns;
    style.hasHeaderRow = object.hasHeaderRow;
    style.fillHeader = object.fillHeader;
    style.fontSize = object.fontSize;
  }
  if (object.type === 'connector') {
    style.style = object.style;
    style.strokeWidth = object.strokeWidth;
  }
  if (object.type === 'image') {
    style.assetId = object.assetId;
    style.storagePath = object.storagePath;
  }
  if (object.type === 'text' || object.type === 'sticky') {
    style.fontSize = object.fontSize;
    style.fontWeight = object.fontWeight ?? 'normal';
    style.fontStyle = object.fontStyle ?? 'normal';
  }
  if (object.type === 'math') {
    style.fontSize = object.fontSize;
  }
  return style;
}

// ------------------------------------------------------------------ viewport

export async function saveBoardViewport(
  database: PersistenceDatabase,
  boardId: string,
  viewport: Viewport,
): Promise<void> {
  await database.runAsync(`UPDATE boards SET viewport_json = ? WHERE id = ?`, [
    serializeViewport(viewport),
    boardId,
  ]);
}

// ------------------------------------------------------------------- parsing

const SHAPE_KINDS = new Set<string>(ALL_SHAPE_KINDS);
const CONNECTOR_STYLES = new Set(['line', 'arrow', 'elbow']);
const DIRECTIONS = new Set(['tlbr', 'trbl', 'bltr', 'brtl']);

function baseGeometry(value: Record<string, unknown>): boolean {
  return (
    typeof value.id === 'string' &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    isFiniteNumber(value.width) &&
    isFiniteNumber(value.height) &&
    isFiniteNumber(value.rotation)
  );
}

/** Parse optional OCR metadata; malformed metadata is dropped, not fatal. */
function parseImageOcr(value: unknown): ImageOcr | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.text !== 'string' ||
    value.text.trim().length === 0 ||
    typeof value.engine !== 'string' ||
    value.engine.length === 0 ||
    !isFiniteNumber(value.regionCount) ||
    typeof value.recognizedAt !== 'string' ||
    value.recognizedAt.length === 0
  ) {
    return null;
  }
  return {
    text: value.text,
    engine: value.engine,
    regionCount: Math.max(0, Math.round(value.regionCount)),
    recognizedAt: value.recognizedAt,
  };
}

/** Parse one stored object; `null` means the row is unusable and is skipped. */
export function parseCanvasObject(raw: string): CanvasObject | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value) || !baseGeometry(value)) return null;

  const base = {
    id: value.id as string,
    x: value.x as number,
    y: value.y as number,
    width: value.width as number,
    height: value.height as number,
    rotation: value.rotation as number,
  };
  const text = value.text;
  const fontSize = value.fontSize;
  const colorKey = value.colorKey;

  if (value.type === 'text' || value.type === 'sticky') {
    if (typeof text !== 'string' || !isFiniteNumber(fontSize) || typeof colorKey !== 'string') {
      return null;
    }
    const fontWeight = value.fontWeight === 'bold' ? 'bold' : 'normal';
    const fontStyle = value.fontStyle === 'italic' ? 'italic' : 'normal';
    const sourceImageId =
      value.type === 'text' && typeof value.sourceImageId === 'string' && value.sourceImageId.length > 0
        ? value.sourceImageId
        : null;
    return {
      ...base,
      type: value.type,
      text,
      fontSize,
      colorKey,
      fontWeight,
      fontStyle,
      ...(sourceImageId ? { sourceImageId } : {}),
    };
  }

  if (value.type === 'shape') {
    if (
      typeof value.shape !== 'string' ||
      !SHAPE_KINDS.has(value.shape) ||
      typeof colorKey !== 'string' ||
      !isFiniteNumber(value.strokeWidth) ||
      !(value.fillKey === null || typeof value.fillKey === 'string') ||
      typeof value.direction !== 'string' ||
      !DIRECTIONS.has(value.direction)
    ) {
      return null;
    }
    return {
      ...base,
      type: 'shape',
      shape: value.shape as ShapeKind,
      colorKey,
      fillKey: value.fillKey as string | null,
      strokeWidth: value.strokeWidth,
      direction: value.direction as LineDirection,
      ...(typeof value.showMeasurements === 'boolean' ? { showMeasurements: value.showMeasurements } : {}),
    };
  }

  if (value.type === 'table') {
    if (
      !isFiniteNumber(value.rows) ||
      !isFiniteNumber(value.columns) ||
      value.rows < 1 ||
      value.columns < 1 ||
      !Array.isArray(value.cells) ||
      typeof colorKey !== 'string' ||
      !isFiniteNumber(fontSize)
    ) {
      return null;
    }
    const rows = Math.round(value.rows);
    const columns = Math.round(value.columns);
    const expectedCount = rows * columns;
    const cells: TableCell[] = [];
    for (let i = 0; i < expectedCount; i += 1) {
      const rawCell = value.cells[i];
      if (isRecord(rawCell) && typeof rawCell.text === 'string') {
        const align =
          rawCell.align === 'center' || rawCell.align === 'right' || rawCell.align === 'left'
            ? rawCell.align
            : undefined;
        cells.push(align ? { text: rawCell.text, align } : { text: rawCell.text });
      } else {
        cells.push({ text: '' });
      }
    }
    const rawRatios = Array.isArray(value.columnRatios)
      ? value.columnRatios.filter((v): v is number => isFiniteNumber(v))
      : [];
    return {
      ...base,
      type: 'table',
      rows,
      columns,
      columnRatios: normalizeColumnRatios(rawRatios, columns),
      cells,
      hasHeaderRow: typeof value.hasHeaderRow === 'boolean' ? value.hasHeaderRow : true,
      colorKey,
      fillHeader: typeof value.fillHeader === 'boolean' ? value.fillHeader : true,
      fontSize,
    };
  }

  if (value.type === 'image') {
    const crop = value.crop;
    if (
      typeof value.assetId !== 'string' || typeof value.storagePath !== 'string' ||
      typeof value.originalAssetId !== 'string' || typeof value.originalStoragePath !== 'string' ||
      !isFiniteNumber(value.sourceWidth) || !isFiniteNumber(value.sourceHeight) ||
      !isFiniteNumber(value.originalWidth) || !isFiniteNumber(value.originalHeight) ||
      !isRecord(crop) || !isFiniteNumber(crop.x) || !isFiniteNumber(crop.y) ||
      !isFiniteNumber(crop.width) || !isFiniteNumber(crop.height) ||
      ![0, 90, 180, 270].includes(crop.rotation as number)
    ) return null;
    const ocr = parseImageOcr(value.ocr);
    return {
      ...base, type: 'image', assetId: value.assetId, storagePath: value.storagePath,
      originalAssetId: value.originalAssetId, originalStoragePath: value.originalStoragePath,
      sourceWidth: value.sourceWidth, sourceHeight: value.sourceHeight,
      originalWidth: value.originalWidth, originalHeight: value.originalHeight,
      crop: { x: crop.x, y: crop.y, width: crop.width, height: crop.height, rotation: crop.rotation as 0 | 90 | 180 | 270 },
      ...(ocr ? { ocr } : {}),
    };
  }

  if (value.type === 'connector') {
    if (
      typeof value.style !== 'string' ||
      !CONNECTOR_STYLES.has(value.style) ||
      typeof colorKey !== 'string' ||
      !isFiniteNumber(value.strokeWidth) ||
      typeof value.direction !== 'string' ||
      !DIRECTIONS.has(value.direction)
    ) {
      return null;
    }
    return {
      ...base,
      type: 'connector',
      style: value.style as ConnectorStyle,
      colorKey,
      strokeWidth: value.strokeWidth,
      direction: value.direction as LineDirection,
    };
  }

  if (value.type === 'math') {
    if (
      typeof value.latex !== 'string' ||
      typeof colorKey !== 'string' ||
      !isFiniteNumber(fontSize)
    ) {
      return null;
    }
    return {
      ...base,
      type: 'math',
      latex: value.latex,
      displayText: typeof value.displayText === 'string' ? value.displayText : value.latex,
      colorKey,
      fontSize,
    };
  }

  return null;
}

export function parseInkStroke(raw: string): InkStroke | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;
  const { id, tool, color, width, opacity, createdAt, points } = value;
  if (
    typeof id !== 'string' ||
    (tool !== 'pen' && tool !== 'highlighter') ||
    typeof color !== 'string' ||
    !isFiniteNumber(width) ||
    !isFiniteNumber(opacity) ||
    typeof createdAt !== 'string' ||
    !Array.isArray(points) ||
    points.length === 0
  ) {
    return null;
  }
  const parsedPoints: { x: number; y: number; pressure?: number }[] = [];
  for (const point of points) {
    if (!isRecord(point) || !isFiniteNumber(point.x) || !isFiniteNumber(point.y)) return null;
    parsedPoints.push(
      isFiniteNumber(point.pressure)
        ? { x: point.x, y: point.y, pressure: point.pressure }
        : { x: point.x, y: point.y },
    );
  }
  return {
    id,
    tool,
    color,
    width,
    opacity,
    createdAt,
    points: parsedPoints,
  };
}

// -------------------------------------------------------------------- media

export async function insertMediaAsset(
  database: PersistenceDatabase,
  asset: MediaAssetRecord,
): Promise<void> {
  await database.runAsync(
    `INSERT OR REPLACE INTO media_assets
      (id, board_id, owner_id, storage_path, mime_type, bytes, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      asset.id,
      asset.boardId,
      asset.ownerId,
      asset.storagePath,
      asset.mimeType,
      asset.bytes,
      JSON.stringify(asset.metadata),
      asset.createdAt,
    ],
  );
}

export async function listMediaAssets(
  database: PersistenceDatabase,
  boardId: string,
): Promise<MediaAssetRecord[]> {
  const rows = await database.getAllAsync<MediaAssetRow>(
    `SELECT id, board_id, owner_id, storage_path, mime_type, bytes, metadata_json, created_at
     FROM media_assets WHERE board_id = ? ORDER BY created_at ASC`,
    [boardId],
  );
  return rows.map((row) => {
    let metadata: Record<string, unknown> = {};
    if (row.metadata_json) {
      try {
        const value: unknown = JSON.parse(row.metadata_json);
        if (isRecord(value)) metadata = value;
      } catch {
        metadata = {};
      }
    }
    return {
      id: row.id,
      boardId: row.board_id,
      ownerId: row.owner_id,
      storagePath: row.storage_path,
      mimeType: row.mime_type,
      bytes: Number(row.bytes ?? 0),
      metadata,
      createdAt: row.created_at,
    };
  });
}

/**
 * A plan produced by the export/import slice. It is a structural type here, not
 * a type import from `backup.ts`, so the repository can stay free of a runtime
 * cycle: the backup module imports this file, this file never imports it back.
 */
export type ImportedBoardPlan = {
  board: {
    id: string;
    title: string;
    settings: BoardSettings;
    createdAt: string;
  };
  viewport: Viewport | null;
  document: CanvasDocument;
  media: readonly {
    assetId: string;
    storagePath: string;
    mimeType: string;
    bytes: number;
    width: number;
    height: number;
  }[];
};

/**
 * Insert a fully-planned imported board in one transaction: board row, first
 * page, every media asset row, and every canvas object row. Media files are
 * written by the caller; this function only records the references, so a
 * failure here leaves no orphaned database rows.
 */
export async function insertImportedBoard(
  database: PersistenceDatabase,
  plan: ImportedBoardPlan,
  now = plan.board.createdAt,
): Promise<void> {
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `INSERT OR IGNORE INTO boards (id, title, created_at, updated_at, settings_json, viewport_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        plan.board.id,
        plan.board.title,
        plan.board.createdAt,
        now,
        serializeBoardSettings(plan.board.settings),
        plan.viewport ? serializeViewport(plan.viewport) : null,
      ],
    );
    await database.runAsync(
      `INSERT OR IGNORE INTO board_pages (id, board_id, name, order_index, created_at, updated_at)
       VALUES (?, ?, ?, 0, ?, ?)`,
      [defaultPageId(plan.board.id), plan.board.id, 'Page 1', plan.board.createdAt, now],
    );
    const pageId = defaultPageId(plan.board.id);

    for (const asset of plan.media) {
      await database.runAsync(
        `INSERT OR REPLACE INTO media_assets
          (id, board_id, owner_id, storage_path, mime_type, bytes, metadata_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          asset.assetId,
          plan.board.id,
          null,
          asset.storagePath,
          asset.mimeType,
          asset.bytes,
          JSON.stringify({ width: asset.width, height: asset.height }),
          plan.board.createdAt,
        ],
      );
    }

    let zIndex = 0;
    for (const stroke of plan.document.strokes) {
      await insertCanvasRow(database, {
        id: stroke.id,
        pageId,
        type: 'ink',
        zIndex,
        x: null,
        y: null,
        width: null,
        height: null,
        rotation: 0,
        content: stroke,
        style: {
          color: stroke.color,
          width: stroke.width,
          opacity: stroke.opacity,
          tool: stroke.tool,
        },
        createdAt: stroke.createdAt,
        updatedAt: now,
      });
      zIndex += 1;
    }
    for (const object of plan.document.objects) {
      await insertCanvasRow(database, {
        id: object.id,
        pageId,
        type: object.type,
        zIndex,
        x: object.x,
        y: object.y,
        width: object.width,
        height: object.height,
        rotation: object.rotation,
        content: object,
        style: objectStyle(object),
        createdAt: now,
        updatedAt: now,
      });
      zIndex += 1;
    }
  });
}

/** Re-exported so verification can assert a save/load round-trip precisely. */
export { documentsEqual };
export { DEFAULT_BOARD_SETTINGS };

// ------------------------------------------------------------- preferences

export type LocalDataStats = {
  boardCount: number;
  stickyCount: number;
  strokeCount: number;
  shapeCount: number;
  connectorCount: number;
  textCount: number;
  imageCount: number;
  totalObjectCount: number;
  mediaAssetCount: number;
  mediaBytes: number;
};

const PREFERENCES_KEY = 'app_preferences';

export async function loadAppPreferences(
  database: PersistenceDatabase,
): Promise<AppPreferences> {
  try {
    const row = await database.getFirstAsync<{ value_json?: string | null }>(
      'SELECT value_json FROM app_preferences WHERE key = ?',
      [PREFERENCES_KEY],
    );
    return parseAppPreferences(row?.value_json);
  } catch {
    return { ...DEFAULT_APP_PREFERENCES };
  }
}

export async function saveAppPreference<K extends keyof AppPreferences>(
  database: PersistenceDatabase,
  key: K,
  value: AppPreferences[K],
  now = new Date().toISOString(),
): Promise<AppPreferences> {
  const current = await loadAppPreferences(database);
  const updated: AppPreferences = { ...current, [key]: value };
  await database.runAsync(
    `INSERT OR REPLACE INTO app_preferences (key, value_json, updated_at)
     VALUES (?, ?, ?)`,
    [PREFERENCES_KEY, serializeAppPreferences(updated), now],
  );
  return updated;
}

export async function saveAllAppPreferences(
  database: PersistenceDatabase,
  prefs: AppPreferences,
  now = new Date().toISOString(),
): Promise<void> {
  await database.runAsync(
    `INSERT OR REPLACE INTO app_preferences (key, value_json, updated_at)
     VALUES (?, ?, ?)`,
    [PREFERENCES_KEY, serializeAppPreferences(prefs), now],
  );
}

export async function resetAppPreferences(
  database: PersistenceDatabase,
  now = new Date().toISOString(),
): Promise<AppPreferences> {
  await database.runAsync(
    `INSERT OR REPLACE INTO app_preferences (key, value_json, updated_at)
     VALUES (?, ?, ?)`,
    [PREFERENCES_KEY, serializeAppPreferences(DEFAULT_APP_PREFERENCES), now],
  );
  return { ...DEFAULT_APP_PREFERENCES };
}

// ----------------------------------------------------------------- data stats & wipe

export async function getLocalDataStats(
  database: PersistenceDatabase,
): Promise<LocalDataStats> {
  const boardRow = await database.getFirstAsync<{ count?: number | null }>(
    'SELECT COUNT(*) as count FROM boards',
  );
  const boardCount = Number(boardRow?.count ?? 0);

  const objectRows = await database.getAllAsync<{ type: string; count: number }>(
    'SELECT type, COUNT(*) as count FROM canvas_objects GROUP BY type',
  );

  let stickyCount = 0;
  let strokeCount = 0;
  let shapeCount = 0;
  let connectorCount = 0;
  let textCount = 0;
  let imageCount = 0;
  let totalObjectCount = 0;

  for (const row of objectRows) {
    const count = Number(row.count ?? 0);
    totalObjectCount += count;
    switch (row.type) {
      case 'sticky':
        stickyCount += count;
        break;
      case 'ink':
        strokeCount += count;
        break;
      case 'shape':
        shapeCount += count;
        break;
      case 'connector':
        connectorCount += count;
        break;
      case 'text':
        textCount += count;
        break;
      case 'image':
        imageCount += count;
        break;
    }
  }

  const mediaRow = await database.getFirstAsync<{ count?: number | null; total_bytes?: number | null }>(
    'SELECT COUNT(*) as count, SUM(bytes) as total_bytes FROM media_assets',
  );
  const mediaAssetCount = Number(mediaRow?.count ?? 0);
  const mediaBytes = Number(mediaRow?.total_bytes ?? 0);

  return {
    boardCount,
    stickyCount,
    strokeCount,
    shapeCount,
    connectorCount,
    textCount,
    imageCount,
    totalObjectCount,
    mediaAssetCount,
    mediaBytes,
  };
}

export async function clearAllLocalData(
  database: PersistenceDatabase,
): Promise<{
  boardsCleared: number;
  objectsCleared: number;
  mediaCleared: number;
}> {
  let boardsCleared = 0;
  let objectsCleared = 0;
  let mediaCleared = 0;

  await database.withTransactionAsync(async () => {
    const mediaRes = await database.runAsync('DELETE FROM media_assets');
    mediaCleared = mediaRes.changes;

    const objectsRes = await database.runAsync('DELETE FROM canvas_objects');
    objectsCleared = objectsRes.changes;

    await database.runAsync('DELETE FROM board_pages');

    const boardsRes = await database.runAsync('DELETE FROM boards');
    boardsCleared = boardsRes.changes;

    await database.runAsync('DELETE FROM app_preferences');
  });

  return { boardsCleared, objectsCleared, mediaCleared };
}

