/**
 * Pure export geometry: what part of the board becomes an image, and how many
 * pixels it should have.
 *
 * The visible-board region is derived from the live viewport, so the exported
 * image matches exactly what the user sees. A selection export uses the rotated
 * bounds of the selected objects with a small breathing margin. Nothing here
 * touches Skia or the file system, which keeps the maths testable in Node.
 */

import type { CanvasDocument, CanvasObject } from '../canvas/document.ts';
import { selectionBounds, type CanvasRect } from '../canvas/selection.ts';
import type { Viewport } from '../canvas/viewport.ts';

export type ExportRect = { x: number; y: number; width: number; height: number };

/** Breathing room around a selection so outlines and rotation are not clipped. */
export const EXPORT_SELECTION_PADDING = 24;

/** Largest output edge. Keeps a huge board from allocating an unusable bitmap. */
export const MAX_EXPORT_DIMENSION = 4096;

/** Smallest output edge, so a tiny selection still produces a usable image. */
export const MIN_EXPORT_DIMENSION = 64;

/** Preferred device-pixel density for a normal phone/tablet canvas. */
export const EXPORT_PIXEL_RATIO = 2;

/** A board this size gets a visible progress treatment instead of a quick flash. */
export const LARGE_EXPORT_OBJECTS = 80;
export const LARGE_EXPORT_PIXELS = 4_000_000;

export type ExportScope = 'visible' | 'selection' | 'all-pages';
export type ExportImageFormat = 'png' | 'jpeg';
export type ExportFileFormat = ExportImageFormat | 'pdf' | 'backup';

function positive(value: number, fallback = 1): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * The canvas rectangle currently visible through the viewport. Screen position
 * `(0, 0)` maps to canvas `(-viewport.x / scale, -viewport.y / scale)`.
 */
export function visibleBoardRegion(
  viewport: Viewport,
  canvasSize: { width: number; height: number },
): ExportRect {
  const scale = positive(viewport.scale);
  const width = positive(canvasSize.width);
  const height = positive(canvasSize.height);
  return {
    x: -viewport.x / scale + 0,
    y: -viewport.y / scale + 0,
    width: width / scale,
    height: height / scale,
  };
}

/**
 * Bounds of the selected objects plus padding, or `null` when nothing is
 * selected. Ink is not selectable in this build, so an ink-only board has no
 * selection export.
 */
export function selectionExportRegion(
  document: CanvasDocument,
  selectedIds: readonly string[],
  padding = EXPORT_SELECTION_PADDING,
): ExportRect | null {
  if (selectedIds.length === 0) return null;
  const ids = new Set(selectedIds);
  const selected = document.objects.filter((object) => ids.has(object.id));
  if (selected.length === 0) return null;
  return padRegion(selectionBounds(selected), padding);
}

/** Add padding around a canvas rectangle, keeping it finite. */
export function padRegion(region: CanvasRect | null, padding: number): ExportRect | null {
  if (!region) return null;
  const safePadding = Math.max(0, Number.isFinite(padding) ? padding : 0);
  return {
    x: region.x - safePadding,
    y: region.y - safePadding,
    width: positive(region.width + safePadding * 2),
    height: positive(region.height + safePadding * 2),
  };
}

export type ExportPixelSize = {
  width: number;
  height: number;
  /** Pixels per canvas unit. */
  scale: number;
};

/**
 * Raster size for a canvas region. The preferred density is 2x, but the longer
 * edge is clamped to `maxDimension` and the shorter edge is lifted to
 * `MIN_EXPORT_DIMENSION`, so a one-pixel selection still exports legibly.
 */
export function exportPixelSize(
  region: ExportRect,
  maxDimension = MAX_EXPORT_DIMENSION,
): ExportPixelSize {
  const regionWidth = positive(region.width);
  const regionHeight = positive(region.height);
  const longest = Math.max(regionWidth, regionHeight);
  const limit = Math.max(1, maxDimension);
  const scale = Math.min(
    limit / longest,
    Math.max(EXPORT_PIXEL_RATIO, MIN_EXPORT_DIMENSION / longest),
  );
  return {
    width: Math.max(1, Math.round(regionWidth * scale)),
    height: Math.max(1, Math.round(regionHeight * scale)),
    scale,
  };
}

/** True when the export is big enough that the UI should show progress. */
export function isLargeExport(
  document: CanvasDocument,
  pixelSize: ExportPixelSize,
): boolean {
  return (
    document.objects.length + document.strokes.length > LARGE_EXPORT_OBJECTS ||
    pixelSize.width * pixelSize.height > LARGE_EXPORT_PIXELS
  );
}

/**
 * Bounds of an entire page's content (objects + strokes) with padding, falling
 * back to `visibleBoardRegion` when the page is empty. Used for multi-page PDF
 * exports so off-viewport worksheet pages export in full.
 */
export function pageExportRegion(
  document: CanvasDocument,
  viewport: Viewport,
  canvasSize: { width: number; height: number },
  padding = EXPORT_SELECTION_PADDING,
): ExportRect {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  if (document.objects.length > 0) {
    const objBounds = selectionBounds(document.objects);
    if (objBounds) {
      minX = Math.min(minX, objBounds.x);
      minY = Math.min(minY, objBounds.y);
      maxX = Math.max(maxX, objBounds.x + objBounds.width);
      maxY = Math.max(maxY, objBounds.y + objBounds.height);
    }
  }

  for (const stroke of document.strokes) {
    const halfW = stroke.width / 2;
    for (const pt of stroke.points) {
      minX = Math.min(minX, pt.x - halfW);
      minY = Math.min(minY, pt.y - halfW);
      maxX = Math.max(maxX, pt.x + halfW);
      maxY = Math.max(maxY, pt.y + halfW);
    }
  }

  if (
    Number.isFinite(minX) &&
    Number.isFinite(minY) &&
    Number.isFinite(maxX) &&
    Number.isFinite(maxY)
  ) {
    return (
      padRegion(
        {
          x: minX,
          y: minY,
          width: Math.max(1, maxX - minX),
          height: Math.max(1, maxY - minY),
        },
        padding,
      ) ?? visibleBoardRegion(viewport, canvasSize)
    );
  }

  return visibleBoardRegion(viewport, canvasSize);
}

/** Only the objects a selection export should paint. */
export function objectsForScope(
  document: CanvasDocument,
  scope: ExportScope,
  selectedIds: readonly string[] = [],
): CanvasObject[] {
  if (scope === 'visible' || scope === 'all-pages') return document.objects;
  const ids = new Set(selectedIds);
  return document.objects.filter((object) => ids.has(object.id));
}

// --------------------------------------------------------------- file names

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

/** Compact local timestamp used in export file names. */
export function exportTimestamp(date = new Date()): string {
  return `${date.getFullYear()}${twoDigits(date.getMonth() + 1)}${twoDigits(date.getDate())}-${twoDigits(date.getHours())}${twoDigits(date.getMinutes())}`;
}

/**
 * A safe file stem: no path separators, no reserved punctuation, no trailing
 * dots. An all-symbol title falls back to "board" rather than producing `-`.
 */
export function sanitizeFileStem(title: string): string {
  const cleaned = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/[-_.]{2,}/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '')
    .slice(0, 48);
  return cleaned.length > 0 ? cleaned : 'board';
}

export function exportFileName(
  title: string,
  format: ExportFileFormat,
  scope: ExportScope = 'visible',
  date = new Date(),
): string {
  const stem = sanitizeFileStem(title);
  const stamp = exportTimestamp(date);
  if (format === 'backup') return `flowcanvas-${stem}-${stamp}.flowcanvas.json`;
  const extension = format === 'jpeg' ? 'jpg' : format;
  const suffix = scope === 'selection' ? 'selection' : 'board';
  return `flowcanvas-${stem}-${suffix}-${stamp}.${extension}`;
}

/** Progress as a 0–1 fraction, safe for zero totals. */
export function progressFraction(completed: number, total: number): number {
  if (!Number.isFinite(completed) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.min(1, Math.max(0, completed / total));
}

/** Human file size for the export summary. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
