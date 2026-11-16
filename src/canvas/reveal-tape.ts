/**
 * Tap-to-Reveal Answer Tape model and spatial overlap helpers.
 *
 * Kept free of React Native / Expo imports so it can be verified in plain Node.
 */

import type {
  CanvasDocument,
  CanvasObject,
  DocumentCommand,
  RevealTapeObject,
  StickyColorKey,
} from './document.ts';
import type { Point } from './viewport.ts';

export const DEFAULT_REVEAL_TAPE_WIDTH = 160;
export const DEFAULT_REVEAL_TAPE_HEIGHT = 44;
export const DEFAULT_REVEAL_TAPE_COLOR: StickyColorKey = 'butter';
export const DEFAULT_REVEAL_TAPE_LABEL = 'Tap to reveal';

export type CreateRevealTapeInput = {
  id: string;
  point: Point;
  width?: number;
  height?: number;
  colorKey?: string;
  label?: string;
  isPrivate?: boolean;
};

export function createRevealTapeObject({
  id,
  point,
  width = DEFAULT_REVEAL_TAPE_WIDTH,
  height = DEFAULT_REVEAL_TAPE_HEIGHT,
  colorKey = DEFAULT_REVEAL_TAPE_COLOR,
  label = DEFAULT_REVEAL_TAPE_LABEL,
  isPrivate,
}: CreateRevealTapeInput): RevealTapeObject {
  const safeWidth = Math.max(44, Math.round(width));
  const safeHeight = Math.max(28, Math.round(height));
  return {
    id,
    type: 'reveal-tape',
    x: Math.round(point.x - safeWidth / 2),
    y: Math.round(point.y - safeHeight / 2),
    width: safeWidth,
    height: safeHeight,
    rotation: 0,
    colorKey,
    label,
    isRevealed: false,
    ...(isPrivate ? { isPrivate: true } : {}),
  };
}

/**
 * Create a RevealTapeObject sized with comfortable padding over an existing
 * text, math, or sticky object so the teacher can mask an answer in one tap.
 */
export function createRevealTapeCoveringObject(
  id: string,
  target: CanvasObject,
  colorKey: string = DEFAULT_REVEAL_TAPE_COLOR,
  label: string = DEFAULT_REVEAL_TAPE_LABEL,
): RevealTapeObject {
  const paddingX = 10;
  const paddingY = 6;
  const width = Math.max(64, Math.round(target.width + paddingX * 2));
  const height = Math.max(36, Math.round(target.height + paddingY * 2));
  return {
    id,
    type: 'reveal-tape',
    x: Math.round(target.x - paddingX),
    y: Math.round(target.y - paddingY),
    width,
    height,
    rotation: target.rotation,
    colorKey,
    label,
    isRevealed: false,
  };
}

export function toggleRevealTape(tape: RevealTapeObject): RevealTapeObject {
  return {
    ...tape,
    isRevealed: !tape.isRevealed,
  };
}

export function resetAllRevealTapes(document: CanvasDocument): CanvasDocument {
  let changed = false;
  const objects = document.objects.map((object) => {
    if (object.type !== 'reveal-tape' || !object.isRevealed) return object;
    changed = true;
    return { ...object, isRevealed: false };
  });
  return changed ? { ...document, objects } : document;
}

export function buildResetAllRevealTapesCommands(
  document: CanvasDocument,
): DocumentCommand[] {
  const commands: DocumentCommand[] = [];
  for (const object of document.objects) {
    if (object.type === 'reveal-tape' && object.isRevealed) {
      commands.push({
        type: 'object.update',
        id: object.id,
        isRevealed: false,
      });
    }
  }
  return commands;
}

type Rect = { x: number; y: number; width: number; height: number };

function rectIntersectionArea(a: Rect, b: Rect): number {
  const xOverlap = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const yOverlap = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return xOverlap * yOverlap;
}

/**
 * Find textual or math objects spatially covered beneath a RevealTapeObject.
 * An object counts as covered when at least 35% of its area (or of the tape's
 * area) overlaps with the tape bounding box.
 */
export function findCoveredObjectsUnderTape(
  tape: RevealTapeObject,
  objects: readonly CanvasObject[],
): CanvasObject[] {
  const tapeArea = Math.max(1, tape.width * tape.height);
  const covered: CanvasObject[] = [];

  for (const candidate of objects) {
    if (candidate.id === tape.id) continue;
    if (
      candidate.type !== 'text' &&
      candidate.type !== 'math' &&
      candidate.type !== 'sticky'
    ) {
      continue;
    }
    const candidateArea = Math.max(1, candidate.width * candidate.height);
    const overlap = rectIntersectionArea(tape, candidate);
    if (overlap <= 0) continue;

    const candidateRatio = overlap / candidateArea;
    const tapeRatio = overlap / tapeArea;
    if (candidateRatio >= 0.25 || tapeRatio >= 0.25) {
      covered.push(candidate);
    }
  }

  return covered;
}
