/**
 * "Explode Photo into Sticky Notes" — spatial multi-note OCR mapper.
 *
 * Maps recognized OCR bounding boxes from a photographed whiteboard or
 * sticky-note wall into individual, movable, non-overlapping `StickyObject`s
 * preserving their relative 2D spatial layout in one batched undo command.
 */

import {
  DEFAULT_STICKY_FONT_SIZE,
  STICKY_HEIGHT,
  STICKY_WIDTH,
  type StickyColorKey,
  type StickyObject,
} from '../canvas/document.ts';
import type { Point } from '../canvas/viewport.ts';
import { normalizeRecognizedText, type OcrRegion } from './ocr-service.ts';

export const EXPLODE_PASTEL_CYCLE: readonly StickyColorKey[] = [
  'butter',
  'mint',
  'sky',
  'lilac',
  'peach',
  'aqua',
] as const;

export const EXPLODE_MIN_TEXT_LENGTH = 2;
export const EXPLODE_COLLISION_GAP = 16;

export type ImageExplosionSource = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  sourceWidth?: number;
  sourceHeight?: number;
};

function isNormalizedCoordinateSpace(
  regions: readonly OcrRegion[],
  source: ImageExplosionSource,
): boolean {
  let maxRight = 0;
  let maxBottom = 0;
  for (const region of regions) {
    maxRight = Math.max(maxRight, region.boundingBox.x + region.boundingBox.width);
    maxBottom = Math.max(maxBottom, region.boundingBox.y + region.boundingBox.height);
  }
  if (maxRight <= 1.05 && maxBottom <= 1.05) return true;
  if (!source.sourceWidth && !source.sourceHeight && maxRight <= 1.05) return true;
  return false;
}

function resolveStickyCollisions(notes: StickyObject[], gap = EXPLODE_COLLISION_GAP): StickyObject[] {
  const placed: StickyObject[] = [];

  for (const current of notes) {
    let candidate = { ...current };
    for (let pass = 0; pass < 24; pass += 1) {
      const overlap = placed.find(
        (other) =>
          candidate.x < other.x + other.width + gap &&
          candidate.x + candidate.width + gap > other.x &&
          candidate.y < other.y + other.height + gap &&
          candidate.y + candidate.height + gap > other.y,
      );
      if (!overlap) break;

      const pushRight = overlap.x + overlap.width + gap - candidate.x;
      const pushDown = overlap.y + overlap.height + gap - candidate.y;
      if (pushDown <= pushRight) {
        candidate = { ...candidate, y: Math.round(overlap.y + overlap.height + gap) };
      } else {
        candidate = { ...candidate, x: Math.round(overlap.x + overlap.width + gap) };
      }
    }
    placed.push(candidate);
  }

  return placed;
}

/**
 * Converts recognized OCR regions into spatially-mapped `StickyObject`s
 * around `viewportCenter` (or below/centered on `imagePlacement`).
 */
export function buildSpatialStickyExplosion(
  blocks: readonly OcrRegion[],
  imagePlacement: ImageExplosionSource,
  options?: {
    idPrefix?: string;
    viewportCenter?: Point;
    fontSize?: number;
  },
): StickyObject[] {
  const validBlocks = blocks
    .map((region) => ({
      text: normalizeRecognizedText(region.text),
      boundingBox: region.boundingBox,
    }))
    .filter((region) => region.text.length >= EXPLODE_MIN_TEXT_LENGTH);

  if (validBlocks.length === 0) return [];

  const normalized = isNormalizedCoordinateSpace(validBlocks, imagePlacement);
  const imgW = normalized
    ? 1
    : Math.max(
        1,
        imagePlacement.sourceWidth ??
          Math.max(...validBlocks.map((b) => b.boundingBox.x + b.boundingBox.width), 1),
      );
  const imgH = normalized
    ? 1
    : Math.max(
        1,
        imagePlacement.sourceHeight ??
          Math.max(...validBlocks.map((b) => b.boundingBox.y + b.boundingBox.height), 1),
      );

  // Target spread canvas footprint so sticky notes remain legible (at least 112x112 each).
  const targetSpreadWidth = Math.max(imagePlacement.width * 1.6, validBlocks.length >= 4 ? 420 : 320);
  const targetSpreadHeight = Math.max(
    imagePlacement.height * 1.6,
    targetSpreadWidth * (imgH / imgW),
  );

  const center: Point = options?.viewportCenter ?? {
    x: imagePlacement.x + imagePlacement.width / 2,
    y: imagePlacement.y + imagePlacement.height / 2,
  };
  const originX = center.x - targetSpreadWidth / 2;
  const originY = center.y - targetSpreadHeight / 2;
  const fontSize = options?.fontSize ?? DEFAULT_STICKY_FONT_SIZE;
  const idPrefix = options?.idPrefix ?? `ocr-sticky-${Date.now()}`;

  const rawStickies: StickyObject[] = validBlocks.map((block, index) => {
    const hasBox = block.boundingBox.width > 0 || block.boundingBox.height > 0;
    const normCenterX = hasBox
      ? (block.boundingBox.x + block.boundingBox.width / 2) / imgW
      : ((index % 3) + 0.5) / 3;
    const normCenterY = hasBox
      ? (block.boundingBox.y + block.boundingBox.height / 2) / imgH
      : (Math.floor(index / 3) + 0.5) / Math.max(1, Math.ceil(validBlocks.length / 3));

    const normW = hasBox ? block.boundingBox.width / imgW : 0.3;
    const width = Math.max(
      STICKY_WIDTH,
      Math.min(180, Math.round(normW * targetSpreadWidth)),
    );
    const estimatedLines = Math.max(1, Math.ceil(block.text.length / Math.max(8, Math.floor(width / 10))));
    const height = Math.max(STICKY_HEIGHT, Math.min(180, estimatedLines * 22 + 24));

    return {
      id: `${idPrefix}-${index}`,
      type: 'sticky',
      text: block.text,
      x: Math.round(originX + normCenterX * targetSpreadWidth - width / 2),
      y: Math.round(originY + normCenterY * targetSpreadHeight - height / 2),
      width,
      height,
      rotation: 0,
      colorKey: EXPLODE_PASTEL_CYCLE[index % EXPLODE_PASTEL_CYCLE.length],
      fontSize,
      fontWeight: 'normal',
      fontStyle: 'normal',
      sourceImageId: imagePlacement.id,
    };
  });

  return resolveStickyCollisions(rawStickies);
}
