/**
 * Versioned, editable board backups (`.flowcanvas.json`).
 *
 * A backup contains the full document (objects plus ink), the viewport, board
 * settings, and the bytes of every referenced image. That makes it portable:
 * importing does not depend on the old app container or another device's media
 * folder. Image files are embedded as base64 so a backup remains one file.
 *
 * This module is pure. It validates and migrates the schema, and it produces a
 * plan that rewrites ids and media paths for a brand-new board. The native store
 * that writes the files and database rows lives in `backup-store.ts`.
 */

import type { CanvasDocument, CanvasObject, ImageObject } from '../canvas/document.ts';
import { documentsEqual } from '../canvas/document.ts';
import type { InkStroke } from '../canvas/ink.ts';
import type { Viewport } from '../canvas/viewport.ts';
import { safeBoardSegment } from '../media/image-crop.ts';
import { parseCanvasObject, parseInkStroke } from '../persistence/repository.ts';
import {
  DEFAULT_BOARD_SETTINGS,
  parseBoardSettings,
  parseViewport,
  type BoardSettings,
} from '../persistence/schema.ts';

export const BACKUP_FORMAT = 'flowcanvas';
export const BACKUP_VERSION = 2;
export const BACKUP_EXTENSION = '.flowcanvas.json';

/** Refuse a backup larger than this before reading it into memory. */
export const MAX_BACKUP_BYTES = 64 * 1024 * 1024;

export type BackupMediaEntry = {
  /** Relative media path as stored in the exporting app, for example `media/<board>/images/x.jpg`. */
  path: string;
  mimeType: string;
  /** Base64 file contents. */
  data: string;
  width?: number;
  height?: number;
};

export type BoardPageBackup = {
  id: string;
  name: string;
  orderIndex: number;
  viewport: Viewport | null;
  backgroundAssetId?: string | null;
  document: CanvasDocument;
};

export type BoardBackup = {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  app: {
    name: 'FlowCanvas';
    version?: string;
  };
  board: {
    title: string;
    viewport: Viewport | null;
    settings: BoardSettings;
  };
  document: CanvasDocument;
  pages?: BoardPageBackup[];
  media: BackupMediaEntry[];
};

export type BackupParseResult = {
  backup: BoardBackup;
  /** Version written by the source app; 0 means an unversioned legacy document. */
  sourceVersion: number;
  warnings: string[];
};

export type BackupErrorCode =
  | 'empty-file'
  | 'invalid-json'
  | 'unsupported-format'
  | 'unsupported-version'
  | 'invalid-version'
  | 'invalid-document'
  | 'invalid-media'
  | 'too-large';

export class BackupError extends Error {
  readonly code: BackupErrorCode;

  constructor(code: BackupErrorCode, message: string) {
    super(message);
    this.name = 'BackupError';
    this.code = code;
  }
}

export type ImportedMediaPlan = {
  /** Path from the backup; used only to rewrite object references. */
  oldPath: string;
  /** New path relative to this app's document directory. */
  storagePath: string;
  assetId: string;
  mimeType: string;
  data: string;
  width: number;
  height: number;
  /** Approximate decoded size, used for progress copy. */
  bytes: number;
};

export type ImportedPagePlan = {
  id: string;
  name: string;
  orderIndex: number;
  viewport: Viewport | null;
  backgroundAssetId?: string | null;
  document: CanvasDocument;
};

export type BackupImportPlan = {
  board: {
    id: string;
    title: string;
    settings: BoardSettings;
    createdAt: string;
  };
  viewport: Viewport | null;
  document: CanvasDocument;
  pages: ImportedPagePlan[];
  media: ImportedMediaPlan[];
  /** Image paths whose bytes were not embedded in the backup. */
  missingMedia: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPositiveNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** A relative path that cannot escape the media directory. */
export function isSafeMediaPath(path: string): boolean {
  if (path.length === 0 || path.length > 512) return false;
  if (path.startsWith('/') || path.startsWith('\\')) return false;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(path)) return false;
  const parts = path.replace(/\\/g, '/').split('/');
  return parts.every((part) => part.length > 0 && part !== '.' && part !== '..');
}

function isBase64ish(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  // Validate the alphabet without scanning a potentially huge string twice.
  return /^[A-Za-z0-9+/=\r\n]+$/.test(value.slice(0, 512));
}

function mediaMimeForPath(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'gif') return 'image/gif';
  if (extension === 'heic' || extension === 'heif') return `image/${extension}`;
  return 'image/jpeg';
}

function extensionForMime(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  if (mimeType === 'image/heic') return 'heic';
  if (mimeType === 'image/heif') return 'heif';
  return 'jpg';
}

function fileStem(path: string): string {
  const name = path.replace(/\\/g, '/').split('/').pop() ?? 'image';
  const withoutExtension = name.replace(/\.[a-zA-Z0-9]+$/, '');
  const safe = withoutExtension.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^[-_.]+|[-_.]+$/g, '');
  return (safe.length > 0 ? safe : 'image').slice(0, 32);
}

// -------------------------------------------------------------- legacy repair

/**
 * Older exports predate optional style fields. Fill only the values the current
 * parser requires, so an old board opens instead of being rejected wholesale.
 * Unknown fields are preserved and validated by `parseCanvasObject`.
 */
function migrateLegacyObject(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const next: Record<string, unknown> = { ...value };
  if (next.type === 'text') {
    if (!nonEmptyString(next.colorKey)) next.colorKey = 'ink';
    if (!isFiniteNumber(next.fontSize)) next.fontSize = 18;
  } else if (next.type === 'sticky') {
    if (!nonEmptyString(next.colorKey)) next.colorKey = 'butter';
    if (!isFiniteNumber(next.fontSize)) next.fontSize = 16;
  } else if (next.type === 'shape') {
    if (!nonEmptyString(next.colorKey)) next.colorKey = 'ink';
    if (!isFiniteNumber(next.strokeWidth)) next.strokeWidth = 4;
    if (!('fillKey' in next)) next.fillKey = null;
    if (!nonEmptyString(next.direction)) next.direction = 'tlbr';
  } else if (next.type === 'connector') {
    if (!nonEmptyString(next.colorKey)) next.colorKey = 'ink';
    if (!isFiniteNumber(next.strokeWidth)) next.strokeWidth = 4;
    if (!nonEmptyString(next.style)) next.style = 'arrow';
    if (!nonEmptyString(next.direction)) next.direction = 'tlbr';
  }
  return next;
}

// ------------------------------------------------------------------- building

export type BuildBackupInput = {
  title: string;
  document: CanvasDocument;
  viewport: Viewport | null;
  settings: BoardSettings;
  pages?: readonly BoardPageBackup[];
  media?: BackupMediaEntry[];
  exportedAt?: string;
  appVersion?: string;
};

export function buildBoardBackup({
  title,
  document,
  viewport,
  settings,
  pages,
  media = [],
  exportedAt = new Date().toISOString(),
  appVersion,
}: BuildBackupInput): BoardBackup {
  const normalizedPages: BoardPageBackup[] =
    pages && pages.length > 0
      ? pages.map((page, index) => ({
          id: page.id,
          name: page.name.trim() || `Page ${index + 1}`,
          orderIndex: index,
          viewport: page.viewport,
          backgroundAssetId: page.backgroundAssetId ?? null,
          document: {
            strokes: [...page.document.strokes],
            objects: [...page.document.objects],
          },
        }))
      : [
          {
            id: 'page:0',
            name: 'Page 1',
            orderIndex: 0,
            viewport,
            backgroundAssetId: null,
            document: {
              strokes: [...document.strokes],
              objects: [...document.objects],
            },
          },
        ];

  const primaryDocument = normalizedPages[0]?.document ?? document;

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt,
    app: {
      name: 'FlowCanvas',
      ...(appVersion ? { version: appVersion } : {}),
    },
    board: {
      title: title.trim() || 'Untitled board',
      viewport,
      settings: { ...settings },
    },
    document: {
      strokes: [...primaryDocument.strokes],
      objects: [...primaryDocument.objects],
    },
    pages: normalizedPages,
    media: media.map((entry) => ({ ...entry })),
  };
}

/** Compact JSON keeps a media-heavy backup from doubling its size with indentation. */
export function serializeBackup(backup: BoardBackup): string {
  return JSON.stringify(backup);
}

// ------------------------------------------------------------------- parsing

export function assertBackupSize(size: number | null | undefined, max = MAX_BACKUP_BYTES): void {
  if (isFiniteNumber(size) && size > max) {
    throw new BackupError(
      'too-large',
      `This backup is ${(size / (1024 * 1024)).toFixed(1)} MB. The limit is ${Math.round(max / (1024 * 1024))} MB.`,
    );
  }
}

function parseDocumentValue(
  value: Record<string, unknown>,
  version: number,
): { document: CanvasDocument; warnings: string[] } {
  const warnings: string[] = [];
  const documentValue = version === 0 && !isRecord(value.document) ? value : value.document;
  if (!isRecord(documentValue)) {
    throw new BackupError('invalid-document', 'This file does not contain a board document.');
  }
  const strokesValue = documentValue.strokes ?? [];
  const objectsValue = documentValue.objects ?? [];
  if (!Array.isArray(strokesValue) || !Array.isArray(objectsValue)) {
    throw new BackupError('invalid-document', 'The board document is malformed: strokes and objects must be lists.');
  }

  const seenIds = new Set<string>();
  const strokes: InkStroke[] = [];
  for (const entry of strokesValue) {
    const stroke = parseInkStroke(JSON.stringify(entry));
    if (!stroke) {
      warnings.push('Skipped an ink stroke with invalid data.');
      continue;
    }
    if (seenIds.has(stroke.id)) {
      warnings.push('Skipped a duplicate ink stroke id.');
      continue;
    }
    seenIds.add(stroke.id);
    strokes.push(stroke);
  }

  const objects: CanvasObject[] = [];
  for (const entry of objectsValue) {
    const object = parseCanvasObject(JSON.stringify(migrateLegacyObject(entry)));
    if (!object) {
      warnings.push('Skipped an object with invalid data.');
      continue;
    }
    if (seenIds.has(object.id)) {
      warnings.push('Skipped a duplicate object id.');
      continue;
    }
    seenIds.add(object.id);
    objects.push(object);
  }
  return { document: { strokes, objects }, warnings };
}

function parseMediaValue(value: unknown): { media: BackupMediaEntry[]; warnings: string[] } {
  if (value === undefined) return { media: [], warnings: [] };
  if (!Array.isArray(value)) {
    throw new BackupError('invalid-media', 'The backup media list is malformed.');
  }
  const warnings: string[] = [];
  const media: BackupMediaEntry[] = [];
  const seenPaths = new Set<string>();
  for (const entry of value) {
    if (!isRecord(entry) || !nonEmptyString(entry.path) || !isSafeMediaPath(entry.path)) {
      warnings.push('Skipped a media entry with an unsafe or missing path.');
      continue;
    }
    if (!nonEmptyString(entry.mimeType) || !isBase64ish(entry.data)) {
      warnings.push('Skipped a media entry with missing bytes.');
      continue;
    }
    if (seenPaths.has(entry.path)) {
      warnings.push('Skipped a duplicate media path.');
      continue;
    }
    seenPaths.add(entry.path);
    media.push({
      path: entry.path,
      mimeType: entry.mimeType,
      data: entry.data,
      ...(isPositiveNumber(entry.width) ? { width: entry.width } : {}),
      ...(isPositiveNumber(entry.height) ? { height: entry.height } : {}),
    });
  }
  return { media, warnings };
}

/**
 * Parse and validate a `.flowcanvas.json` file.
 *
 * - A file with no `format`/`version` is treated as a legacy unversioned
 *   document (version 0) and repaired before parsing.
 * - A file from a newer app version is refused with an actionable error rather
 *   than guessed at.
 * - Individual corrupt objects or media entries are skipped and reported; a
 *   broken row must not make the whole backup unimportable.
 */
export function parseBackup(raw: string): BackupParseResult {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw new BackupError('empty-file', 'This file is empty.');
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new BackupError('invalid-json', 'This file is not valid JSON. Choose a FlowCanvas backup file.');
  }
  if (!isRecord(value)) {
    throw new BackupError('invalid-document', 'This file does not contain a FlowCanvas board.');
  }

  if (value.format !== undefined && value.format !== BACKUP_FORMAT) {
    throw new BackupError(
      'unsupported-format',
      'This file is not a FlowCanvas backup. Export a new .flowcanvas.json file and try again.',
    );
  }

  const hasFormat = value.format === BACKUP_FORMAT;
  const rawVersion = value.version;
  let sourceVersion = 0;
  if (hasFormat || rawVersion !== undefined) {
    if (!Number.isInteger(rawVersion) || (rawVersion as number) < 0) {
      throw new BackupError('invalid-version', 'This backup has no valid schema version.');
    }
    sourceVersion = rawVersion as number;
    if (sourceVersion > BACKUP_VERSION) {
      throw new BackupError(
        'unsupported-version',
        `This backup was created by a newer FlowCanvas (schema ${sourceVersion}). Update the app before importing it.`,
      );
    }
  }

  const { document, warnings } = parseDocumentValue(value, sourceVersion);
  const mediaResult = parseMediaValue(value.media);
  warnings.push(...mediaResult.warnings);

  const boardValue = isRecord(value.board) ? value.board : {};
  const title = nonEmptyString(boardValue.title) ? boardValue.title.trim() : 'Imported board';
  const settings = parseBoardSettings(
    boardValue.settings === undefined ? null : JSON.stringify(boardValue.settings),
  );
  const viewport = boardValue.viewport === undefined || boardValue.viewport === null
    ? null
    : parseViewport(JSON.stringify(boardValue.viewport));

  let pages: BoardPageBackup[];
  if (Array.isArray(value.pages) && value.pages.length > 0) {
    pages = [];
    for (let index = 0; index < value.pages.length; index += 1) {
      const rawPage = value.pages[index];
      if (!isRecord(rawPage)) {
        warnings.push(`Skipped malformed page at index ${index}.`);
        continue;
      }
      const pageDocResult = parseDocumentValue(rawPage, sourceVersion);
      warnings.push(...pageDocResult.warnings);
      const pageViewport =
        rawPage.viewport === undefined || rawPage.viewport === null
          ? null
          : parseViewport(JSON.stringify(rawPage.viewport));
      pages.push({
        id: nonEmptyString(rawPage.id) ? rawPage.id.trim() : `page:${index}`,
        name: nonEmptyString(rawPage.name) ? rawPage.name.trim() : `Page ${pages.length + 1}`,
        orderIndex: pages.length,
        viewport: pageViewport,
        backgroundAssetId: nonEmptyString(rawPage.backgroundAssetId)
          ? rawPage.backgroundAssetId.trim()
          : null,
        document: pageDocResult.document,
      });
    }
    if (pages.length === 0) {
      pages = [
        {
          id: 'page:0',
          name: 'Page 1',
          orderIndex: 0,
          viewport,
          backgroundAssetId: null,
          document,
        },
      ];
    }
  } else {
    pages = [
      {
        id: 'page:0',
        name: 'Page 1',
        orderIndex: 0,
        viewport,
        backgroundAssetId: null,
        document,
      },
    ];
  }

  const exportedAt = nonEmptyString(value.exportedAt)
    ? value.exportedAt
    : new Date(0).toISOString();
  const appValue = isRecord(value.app) ? value.app : {};
  const appVersion = nonEmptyString(appValue.version) ? appValue.version : undefined;

  return {
    backup: {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt,
      app: { name: 'FlowCanvas', ...(appVersion ? { version: appVersion } : {}) },
      board: {
        title,
        viewport,
        settings: { ...DEFAULT_BOARD_SETTINGS, ...settings },
      },
      document: pages[0].document,
      pages,
      media: mediaResult.media,
    },
    sourceVersion,
    warnings,
  };
}

// -------------------------------------------------------------------- import

/** A new board is always created; an import never overwrites an existing board. */
export function importedBoardTitle(title: string): string {
  const base = title.trim() || 'Imported board';
  return /\(imported\)$/i.test(base) ? base : `${base} (imported)`;
}

function importedStoragePath(
  newBoardId: string,
  index: number,
  oldPath: string,
  mimeType: string,
  missing = false,
): string {
  const board = safeBoardSegment(newBoardId);
  const prefix = String(index + 1).padStart(3, '0');
  const folder = missing ? 'missing' : 'imported';
  const extension = extensionForMime(mimeType);
  return `media/${board}/${folder}/${prefix}-${fileStem(oldPath)}.${extension}`;
}

/**
 * Rewrite a parsed backup for insertion as a new board.
 *
 * Object and stroke ids are prefixed with the new board id because the SQLite
 * tables use a global primary key. Media paths move under the new board's
 * folder, and image asset ids/paths are updated in the document. `sourceImageId`
 * links from OCR text blocks are remapped to the new image ids.
 */
export function planBackupImport(
  backup: BoardBackup,
  newBoardId: string,
  now = new Date().toISOString(),
): BackupImportPlan {
  const pathMap = new Map<string, ImportedMediaPlan>();
  const media: ImportedMediaPlan[] = [];
  const missingMedia = new Set<string>();

  for (let index = 0; index < backup.media.length; index += 1) {
    const entry = backup.media[index];
    const plan: ImportedMediaPlan = {
      oldPath: entry.path,
      storagePath: importedStoragePath(newBoardId, index, entry.path, entry.mimeType),
      assetId: `${newBoardId}:asset:${index + 1}`,
      mimeType: entry.mimeType,
      data: entry.data,
      width: Math.max(1, Math.round(entry.width ?? 1)),
      height: Math.max(1, Math.round(entry.height ?? 1)),
      bytes: Math.ceil(entry.data.length * 0.75),
    };
    pathMap.set(entry.path, plan);
    media.push(plan);
  }

  const missingPath = (oldPath: string): ImportedMediaPlan => {
    const existing = pathMap.get(oldPath);
    if (existing) return existing;
    missingMedia.add(oldPath);
    const plan: ImportedMediaPlan = {
      oldPath,
      storagePath: importedStoragePath(newBoardId, missingMedia.size - 1, oldPath, mediaMimeForPath(oldPath), true),
      assetId: `${newBoardId}:asset:missing:${missingMedia.size}`,
      mimeType: mediaMimeForPath(oldPath),
      data: '',
      width: 1,
      height: 1,
      bytes: 0,
    };
    pathMap.set(oldPath, plan);
    return plan;
  };

  const mapPageDocument = (doc: CanvasDocument, pageIndex: number): CanvasDocument => {
    const idPrefix = pageIndex === 0 ? newBoardId : `${newBoardId}:p${pageIndex}`;
    const objectIdMap = new Map<string, string>();
    const mappedObjects = doc.objects.map((object) => {
      const newId = `${idPrefix}:${object.id}`;
      objectIdMap.set(object.id, newId);
      if (object.type !== 'image') return { ...object, id: newId };
      const placed = missingPath(object.storagePath);
      const original = object.storagePath === object.originalStoragePath
        ? placed
        : missingPath(object.originalStoragePath);
      return {
        ...object,
        id: newId,
        assetId: placed.assetId,
        storagePath: placed.storagePath,
        originalAssetId: original.assetId,
        originalStoragePath: original.storagePath,
      } satisfies ImageObject;
    });

    const objects = mappedObjects.map((object) => {
      if (object.type !== 'text' || !object.sourceImageId) return object;
      const mapped = objectIdMap.get(object.sourceImageId);
      if (!mapped) return object;
      return { ...object, sourceImageId: mapped };
    });

    const strokes = doc.strokes.map((stroke) => ({
      ...stroke,
      id: `${idPrefix}:${stroke.id}`,
    }));

    return { strokes, objects };
  };

  const sourcePages: BoardPageBackup[] =
    backup.pages && backup.pages.length > 0
      ? backup.pages
      : [
          {
            id: 'page:0',
            name: 'Page 1',
            orderIndex: 0,
            viewport: backup.board.viewport,
            backgroundAssetId: null,
            document: backup.document,
          },
        ];

  const pages: ImportedPagePlan[] = sourcePages.map((page, index) => ({
    id: `${newBoardId}:page:${index}`,
    name: page.name,
    orderIndex: index,
    viewport: page.viewport,
    backgroundAssetId: page.backgroundAssetId ?? null,
    document: mapPageDocument(page.document, index),
  }));

  return {
    board: {
      id: newBoardId,
      title: importedBoardTitle(backup.board.title),
      settings: { ...backup.board.settings },
      createdAt: now,
    },
    viewport: backup.board.viewport,
    document: pages[0]?.document ?? { strokes: [], objects: [] },
    pages,
    media,
    missingMedia: [...missingMedia],
  };
}

// ------------------------------------------------------------------ summary

/** One-line summary shown after choosing a backup file. */
export function backupSummary(backup: BoardBackup): string {
  const pages = backup.pages && backup.pages.length > 0 ? backup.pages : [{ document: backup.document }];
  let objectCount = 0;
  let strokeCount = 0;
  let imageCount = 0;
  for (const page of pages) {
    objectCount += page.document.objects.length;
    strokeCount += page.document.strokes.length;
    imageCount += page.document.objects.filter((object) => object.type === 'image').length;
  }
  const parts: string[] = [];
  if (pages.length > 1) parts.push(`${pages.length} pages`);
  parts.push(
    `${objectCount} object${objectCount === 1 ? '' : 's'}`,
    `${strokeCount} stroke${strokeCount === 1 ? '' : 's'}`,
  );
  if (imageCount > 0) parts.push(`${imageCount} image${imageCount === 1 ? '' : 's'}`);
  if (backup.media.length > 0) parts.push(`${backup.media.length} media file${backup.media.length === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

/** Actionable copy for a failed import. */
export function importErrorMessage(error: unknown): string {
  if (error instanceof BackupError) return error.message;
  if (error instanceof Error && error.message.trim().length > 0) {
    return `The board could not be imported: ${error.message}`;
  }
  return 'The board could not be imported. The file may be damaged or unsupported.';
}

/** True when two imported boards are semantically identical apart from new ids. */
export function backupDocumentsMatch(left: CanvasDocument, right: CanvasDocument): boolean {
  return documentsEqual(left, right);
}
