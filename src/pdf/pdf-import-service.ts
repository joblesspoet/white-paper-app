/**
 * Multi-page PDF import for worksheet markup.
 *
 * Pure page-range parsing and locked background ImageObject builders live here
 * alongside the Expo DocumentPicker + native PDF rasterizer adapter so the
 * core planning logic is testable in Node and Expo Go degrades gracefully with
 * an honest capability message.
 */

import type { ImageObject } from '../canvas/document.ts';
import { safeBoardSegment } from '../media/image-crop.ts';
import type { PersistenceDatabase } from '../persistence/database.ts';
import {
  createPage,
  insertMediaAsset,
  type BoardPageRecord,
} from '../persistence/repository.ts';

export const MAX_PDF_IMPORT_PAGES = 30;
export const DEFAULT_PDF_CANVAS_WIDTH = 720;

export type PickedPdfFile = {
  uri: string;
  name: string;
  size: number | null;
};

export type PdfPickResult =
  | { canceled: true }
  | { canceled: false; file: PickedPdfFile };

export type PdfRasterizedPage = {
  pageNumber: number;
  uri: string;
  width: number;
  height: number;
  mimeType: string;
};

export type PdfRasterizerAdapter = {
  getPageCount: (pdfUri: string) => Promise<number>;
  renderPage: (pdfUri: string, pageNumber: number, targetWidth?: number) => Promise<PdfRasterizedPage>;
};

export type PdfCapabilityStatus =
  | { available: true; adapter: PdfRasterizerAdapter }
  | { available: false; reason: string };

export type ParsedPageRange =
  | { ok: true; pages: number[]; truncated: boolean }
  | { ok: false; error: string };

/**
 * Parse a user-entered page range (e.g. `"all"`, `"1-5"`, `"1, 3, 5-8"`) into
 * sorted 1-based page numbers capped at `MAX_PDF_IMPORT_PAGES`.
 */
export function parsePageRange(input: string, totalPages: number): ParsedPageRange {
  const safeTotal = Math.max(1, Math.floor(totalPages));
  const trimmed = input.trim().toLowerCase();

  if (!trimmed || trimmed === 'all') {
    const count = Math.min(safeTotal, MAX_PDF_IMPORT_PAGES);
    const pages: number[] = [];
    for (let i = 1; i <= count; i += 1) pages.push(i);
    return { ok: true, pages, truncated: safeTotal > MAX_PDF_IMPORT_PAGES };
  }

  const tokens = trimmed.split(',').map((t) => t.trim()).filter(Boolean);
  if (tokens.length === 0) {
    return { ok: false, error: 'Enter page numbers or a range like 1-5.' };
  }

  const selected = new Set<number>();
  for (const token of tokens) {
    const rangeMatch = /^(\d+)\s*-\s*(\d+)$/.exec(token);
    if (rangeMatch) {
      const start = Number.parseInt(rangeMatch[1], 10);
      const end = Number.parseInt(rangeMatch[2], 10);
      if (start < 1 || end < 1 || start > end) {
        return { ok: false, error: `Invalid page range "${token}".` };
      }
      if (start > safeTotal || end > safeTotal) {
        return { ok: false, error: `Page range "${token}" exceeds ${safeTotal} pages.` };
      }
      for (let p = start; p <= end; p += 1) {
        selected.add(p);
        if (selected.size > MAX_PDF_IMPORT_PAGES) {
          return {
            ok: false,
            error: `You can import up to ${MAX_PDF_IMPORT_PAGES} pages per batch.`,
          };
        }
      }
      continue;
    }

    if (/^\d+$/.test(token)) {
      const page = Number.parseInt(token, 10);
      if (page < 1 || page > safeTotal) {
        return { ok: false, error: `Page ${page} is out of range (1–${safeTotal}).` };
      }
      selected.add(page);
      if (selected.size > MAX_PDF_IMPORT_PAGES) {
        return {
          ok: false,
          error: `You can import up to ${MAX_PDF_IMPORT_PAGES} pages per batch.`,
        };
      }
      continue;
    }

    return { ok: false, error: `Could not understand "${token}". Use e.g. 1-5, 8.` };
  }

  const pages = Array.from(selected).sort((a, b) => a - b);
  return { ok: true, pages, truncated: false };
}

/**
 * Build a locked background `ImageObject` for an imported PDF page so normal
 * single-finger `Select` gestures pass through to annotations on top.
 */
export function buildPdfBackgroundImageObject(params: {
  id?: string;
  pageNumber: number;
  assetId: string;
  storagePath: string;
  sourceWidth: number;
  sourceHeight: number;
  canvasWidth?: number;
  center?: { x: number; y: number };
}): ImageObject {
  const safeSrcW = Math.max(1, params.sourceWidth);
  const safeSrcH = Math.max(1, params.sourceHeight);
  const targetWidth = params.canvasWidth ?? DEFAULT_PDF_CANVAS_WIDTH;
  const targetHeight = Math.round((targetWidth * safeSrcH) / safeSrcW);
  const centerX = params.center?.x ?? 0;
  const centerY = params.center?.y ?? 0;

  return {
    id:
      params.id ??
      `pdf-bg-${params.pageNumber}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'image',
    x: centerX - targetWidth / 2,
    y: centerY - targetHeight / 2,
    width: targetWidth,
    height: targetHeight,
    rotation: 0,
    locked: true,
    assetId: params.assetId,
    storagePath: params.storagePath,
    originalAssetId: params.assetId,
    originalStoragePath: params.storagePath,
    sourceWidth: safeSrcW,
    sourceHeight: safeSrcH,
    originalWidth: safeSrcW,
    originalHeight: safeSrcH,
    crop: {
      x: 0,
      y: 0,
      width: safeSrcW,
      height: safeSrcH,
      rotation: 0,
    },
  };
}

let customPdfRasterizer: PdfRasterizerAdapter | null = null;

/** Register a custom native PDF rasterizer adapter (for dev builds or tests). */
export function registerPdfRasterizer(adapter: PdfRasterizerAdapter | null): void {
  customPdfRasterizer = adapter;
}

type NativeFlowCanvasPdfModule = {
  getPageCount: (pdfUri: string) => Promise<number>;
  renderPage: (pdfUri: string, pageNumber: number, targetWidth: number) => Promise<PdfRasterizedPage>;
};

function resolveNativePdfRasterizer(): PdfRasterizerAdapter | null {
  try {
    // Only available inside React Native / Expo runtime (not plain Node tests).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requireOptionalNativeModule } = require('expo-modules-core') as {
      requireOptionalNativeModule: <T>(name: string) => T | null;
    };
    const native = requireOptionalNativeModule<NativeFlowCanvasPdfModule>('FlowCanvasPdf');
    if (!native) return null;
    return {
      getPageCount: (pdfUri) => native.getPageCount(pdfUri),
      renderPage: (pdfUri, pageNumber, targetWidth = 1440) =>
        native.renderPage(pdfUri, pageNumber, targetWidth),
    };
  } catch {
    return null;
  }
}

/**
 * Probe whether native PDF page rasterization is available in the current
 * runtime. Expo Go does not ship a native PDF page renderer, so this returns
 * `available: false` with an honest capability message instead of crashing.
 */
export function getPdfCapabilityStatus(): PdfCapabilityStatus {
  if (customPdfRasterizer) {
    return { available: true, adapter: customPdfRasterizer };
  }
  const nativeAdapter = resolveNativePdfRasterizer();
  if (nativeAdapter) {
    return { available: true, adapter: nativeAdapter };
  }
  return {
    available: false,
    reason:
      'Native PDF page rasterization requires a development build. In Expo Go, you can still import images or .flowcanvas.json backups.',
  };
}

/** Pick a local `.pdf` file via `expo-document-picker`. */
export async function pickPdfDocument(): Promise<PdfPickResult> {
  const DocumentPicker = await import('expo-document-picker');
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return { canceled: true };
  const asset = result.assets[0];
  if (!asset || !asset.uri) return { canceled: true };
  return {
    canceled: false,
    file: {
      uri: asset.uri,
      name: asset.name ?? 'document.pdf',
      size: typeof asset.size === 'number' ? asset.size : null,
    },
  };
}

export type PdfImportProgress = (fraction: number, label: string) => void;

export type ImportPdfPagesInput = {
  database: PersistenceDatabase;
  boardId: string;
  pdfUri: string;
  pdfName: string;
  pageNumbers: readonly number[];
  adapter: PdfRasterizerAdapter;
  insertAtIndex?: number;
  onProgress?: PdfImportProgress;
};

/**
 * Render each selected PDF page into `media/<boardId>/pdf-pages/` and create
 * corresponding `board_pages` with locked background `ImageObject`s.
 */
export async function importPdfPagesToBoard(
  input: ImportPdfPagesInput,
): Promise<BoardPageRecord[]> {
  const { Directory, File, Paths } = await import('expo-file-system');
  const createdPages: BoardPageRecord[] = [];
  const baseTitle = input.pdfName.replace(/\.pdf$/i, '').trim() || 'PDF';
  const total = input.pageNumbers.length;
  const boardSegment = safeBoardSegment(input.boardId);
  const pdfDir = new Directory(Paths.document, 'media', boardSegment, 'pdf-pages');
  if (!pdfDir.exists) {
    pdfDir.create({ intermediates: true, idempotent: true });
  }

  for (let index = 0; index < total; index += 1) {
    const pageNumber = input.pageNumbers[index];
    input.onProgress?.(
      (index + 0.2) / Math.max(1, total),
      `Rendering page ${pageNumber} (${index + 1} of ${total})…`,
    );

    const rendered = await input.adapter.renderPage(input.pdfUri, pageNumber, 1440);
    const ext = rendered.mimeType === 'image/png' ? 'png' : 'jpg';
    const assetId = `pdf-asset-${Date.now().toString(36)}-${pageNumber}-${Math.random().toString(36).slice(2, 6)}`;
    const fileName = `${assetId}.${ext}`;
    const storagePath = `media/${boardSegment}/pdf-pages/${fileName}`;

    const sourceFile = new File(rendered.uri);
    const destFile = new File(pdfDir, fileName);
    if (destFile.exists) {
      destFile.delete();
    }
    await sourceFile.copy(destFile);
    try {
      if (sourceFile.exists) sourceFile.delete();
    } catch {
      // Best-effort cleanup of temporary rendered PNG
    }

    const now = new Date().toISOString();
    await insertMediaAsset(input.database, {
      id: assetId,
      boardId: input.boardId,
      ownerId: null,
      storagePath,
      mimeType: rendered.mimeType,
      bytes: destFile.size ?? 0,
      metadata: {
        width: rendered.width,
        height: rendered.height,
        pdfPage: pageNumber,
        pdfName: input.pdfName,
      },
      createdAt: now,
    });

    const bgObject = buildPdfBackgroundImageObject({
      pageNumber,
      assetId,
      storagePath,
      sourceWidth: rendered.width,
      sourceHeight: rendered.height,
    });

    const created = await createPage(input.database, input.boardId, {
      name: `${baseTitle} · p.${pageNumber}`,
      document: { strokes: [], objects: [bgObject] },
      backgroundAssetId: assetId,
      insertAtIndex:
        typeof input.insertAtIndex === 'number' ? input.insertAtIndex + index : undefined,
      now,
    });
    createdPages.push(created);

    input.onProgress?.(
      (index + 1) / Math.max(1, total),
      `Imported page ${pageNumber} (${index + 1} of ${total})`,
    );
  }

  return createdPages;
}
