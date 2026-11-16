/**
 * Auto-layout ("Tidy Up") algorithms for multi-selected canvas objects.
 *
 * Pure canvas-coordinate calculations producing non-overlapping target `(x, y)`
 * coordinates for `Tidy grid`, `Align row`, and `Align column` in one
 * `objects.geometry` undo entry.
 */

import type { CanvasObject } from './document.ts';
import { objectBounds, type CanvasRect } from './selection.ts';

export type TidyMode = 'grid' | 'row' | 'column';

export const TIDY_DEFAULT_GAP = 24;

export type TidyPositionUpdate = {
  id: string;
  x: number;
  y: number;
};

type MeasuredEntry = {
  object: CanvasObject;
  bounds: CanvasRect;
  centerX: number;
  centerY: number;
};

function measureObjects(objects: readonly CanvasObject[]): MeasuredEntry[] {
  return objects.map((object) => {
    const bounds = objectBounds(object);
    return {
      object,
      bounds,
      centerX: bounds.x + bounds.width / 2,
      centerY: bounds.y + bounds.height / 2,
    };
  });
}

function sortReadingOrder(entries: readonly MeasuredEntry[]): MeasuredEntry[] {
  return [...entries].sort((left, right) => {
    const rowTolerance = Math.max(12, Math.min(left.bounds.height, right.bounds.height) * 0.5);
    if (Math.abs(left.bounds.y - right.bounds.y) > rowTolerance) {
      return left.bounds.y - right.bounds.y;
    }
    return left.bounds.x - right.bounds.x;
  });
}

function positionedForBounds(entry: MeasuredEntry, targetBoundsX: number, targetBoundsY: number): TidyPositionUpdate {
  const deltaX = targetBoundsX - entry.bounds.x;
  const deltaY = targetBoundsY - entry.bounds.y;
  return {
    id: entry.object.id,
    x: Math.round(entry.object.x + deltaX),
    y: Math.round(entry.object.y + deltaY),
  };
}

/**
 * Computes non-overlapping `(x, y)` updates for `objects` arranged as a
 * `grid`, `row`, or `column` with uniform `gap` (default 24 canvas units).
 * Connectors are skipped so magnetic bindings re-route automatically.
 */
export function computeTidyLayout(
  objects: readonly CanvasObject[],
  mode: TidyMode,
  gap = TIDY_DEFAULT_GAP,
): TidyPositionUpdate[] {
  const layoutTargets = objects.filter((obj) => obj.type !== 'connector' && !obj.locked);
  if (layoutTargets.length < 2) return [];

  const measured = measureObjects(layoutTargets);
  const anchorX = Math.min(...measured.map((m) => m.bounds.x));
  const anchorY = Math.min(...measured.map((m) => m.bounds.y));

  if (mode === 'row') {
    const sorted = [...measured].sort((a, b) => a.centerX - b.centerX || a.centerY - b.centerY);
    const maxHeight = Math.max(...sorted.map((m) => m.bounds.height));
    const updates: TidyPositionUpdate[] = [];
    let cursorX = anchorX;

    for (const entry of sorted) {
      const targetY = anchorY + (maxHeight - entry.bounds.height) / 2;
      updates.push(positionedForBounds(entry, cursorX, targetY));
      cursorX += entry.bounds.width + gap;
    }
    return updates;
  }

  if (mode === 'column') {
    const sorted = [...measured].sort((a, b) => a.centerY - b.centerY || a.centerX - b.centerX);
    const maxWidth = Math.max(...sorted.map((m) => m.bounds.width));
    const updates: TidyPositionUpdate[] = [];
    let cursorY = anchorY;

    for (const entry of sorted) {
      const targetX = anchorX + (maxWidth - entry.bounds.width) / 2;
      updates.push(positionedForBounds(entry, targetX, cursorY));
      cursorY += entry.bounds.height + gap;
    }
    return updates;
  }

  // 'grid' mode
  const sorted = sortReadingOrder(measured);
  const cols = Math.max(2, Math.ceil(Math.sqrt(sorted.length)));
  const rows = Math.ceil(sorted.length / cols);

  const colWidths = Array.from({ length: cols }, () => 0);
  const rowHeights = Array.from({ length: rows }, () => 0);

  sorted.forEach((entry, idx) => {
    const r = Math.floor(idx / cols);
    const c = idx % cols;
    colWidths[c] = Math.max(colWidths[c], entry.bounds.width);
    rowHeights[r] = Math.max(rowHeights[r], entry.bounds.height);
  });

  const colOffsets: number[] = [];
  let accX = anchorX;
  for (let c = 0; c < cols; c += 1) {
    colOffsets.push(accX);
    accX += colWidths[c] + gap;
  }

  const rowOffsets: number[] = [];
  let accY = anchorY;
  for (let r = 0; r < rows; r += 1) {
    rowOffsets.push(accY);
    accY += rowHeights[r] + gap;
  }

  return sorted.map((entry, idx) => {
    const r = Math.floor(idx / cols);
    const c = idx % cols;
    const cellX = colOffsets[c] + (colWidths[c] - entry.bounds.width) / 2;
    const cellY = rowOffsets[r] + (rowHeights[r] - entry.bounds.height) / 2;
    return positionedForBounds(entry, cellX, cellY);
  });
}
