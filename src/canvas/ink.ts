/**
 * Freehand ink model.
 *
 * A stroke is immutable once committed: it stores canvas-space points together
 * with the style captured when the stroke started. Storing canvas coordinates
 * (not screen coordinates) is what keeps ink stable while the board is panned
 * and zoomed.
 */

import type { Point } from './viewport';

export type FreehandTool = 'pen' | 'highlighter';

export type InkStroke = {
  id: string;
  tool: FreehandTool;
  /** Canvas-space points. The first point is the start of the stroke. */
  points: Point[];
  color: string;
  /** Rendered stroke width in canvas units. */
  width: number;
  /** Rendered opacity, 0–1. */
  opacity: number;
  createdAt: string;
};

export type CreateStrokeInput = {
  id: string;
  tool: FreehandTool;
  point: Point;
  color: string;
  /** The width the user selected; the tool may render wider than this. */
  width: number;
  opacity: number;
  createdAt?: string;
};

/** Width options shown in the ink options sheet. */
export const INK_WIDTHS = [2, 4, 8, 12] as const;
export const INK_OPACITIES = [0.35, 0.6, 1] as const;

/**
 * A highlighter reads as a broad band, not a fat pen. The selected width is
 * multiplied so switching tools keeps the same hand-feel without needing a
 * second width control.
 */
export const HIGHLIGHTER_WIDTH_MULTIPLIER = 3;
export const HIGHLIGHTER_MAX_OPACITY = 0.42;

/** Eraser size is a screen radius so it always feels the same under the finger. */
export const ERASER_SIZES = [16, 24, 36] as const;
export const DEFAULT_ERASER_RADIUS = 24;

/** Ignore near-duplicate pointer samples; they add weight and cost for nothing. */
export const MIN_POINT_DISTANCE_SCREEN = 0.75;

export function createInkStroke(input: CreateStrokeInput): InkStroke {
  const isHighlighter = input.tool === 'highlighter';
  return {
    id: input.id,
    tool: input.tool,
    points: [input.point],
    color: input.color,
    width: input.width * (isHighlighter ? HIGHLIGHTER_WIDTH_MULTIPLIER : 1),
    opacity: isHighlighter ? Math.min(input.opacity, HIGHLIGHTER_MAX_OPACITY) : input.opacity,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

/** Append a sampled point unless it is too close to the previous one. */
export function appendInkPoint(stroke: InkStroke, point: Point, minDistance = 0): InkStroke {
  const last = stroke.points[stroke.points.length - 1];
  if (last && Math.hypot(point.x - last.x, point.y - last.y) < minDistance) return stroke;
  return { ...stroke, points: [...stroke.points, point] };
}

/**
 * Build a smooth SVG path through the sampled points. Quadratic segments join
 * midpoints, which removes the faceted look of raw polyline input while still
 * passing through the ends of the stroke.
 */
export function inkPathData(points: Point[]): string {
  const first = points[0];
  if (!first) return '';
  if (points.length === 1) {
    // A dot: a hair of length makes round caps paint a visible round mark.
    return `M ${first.x} ${first.y} L ${first.x + 0.01} ${first.y}`;
  }

  const commands = [`M ${first.x} ${first.y}`];
  for (let index = 1; index < points.length - 1; index += 1) {
    const control = points[index];
    const next = points[index + 1];
    commands.push(`Q ${control.x} ${control.y} ${(control.x + next.x) / 2} ${(control.y + next.y) / 2}`);
  }
  const last = points[points.length - 1];
  commands.push(`L ${last.x} ${last.y}`);
  return commands.join(' ');
}

/** Shortest distance from a point to a line segment. */
export function distanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

/**
 * Hit testing uses segments plus half the rendered width, so the eraser can
 * catch a thin line between samples or a wide highlighter without demanding a
 * direct hit on a stored point.
 */
export function strokeIntersectsPoint(stroke: InkStroke, point: Point, radius: number): boolean {
  const threshold = Math.max(0, radius) + stroke.width / 2;
  if (stroke.points.length === 1) {
    const only = stroke.points[0];
    return Math.hypot(point.x - only.x, point.y - only.y) <= threshold;
  }
  for (let index = 1; index < stroke.points.length; index += 1) {
    if (distanceToSegment(point, stroke.points[index - 1], stroke.points[index]) <= threshold) return true;
  }
  return false;
}

export type EraseResult = {
  strokes: InkStroke[];
  erasedIds: string[];
};

/** Remove every stroke touched by the eraser. */
export function eraseStrokesAt(strokes: InkStroke[], point: Point, radius: number): EraseResult {
  const erasedIds: string[] = [];
  const remaining = strokes.filter((stroke) => {
    if (!strokeIntersectsPoint(stroke, point, radius)) return true;
    erasedIds.push(stroke.id);
    return false;
  });
  return erasedIds.length === 0 ? { strokes, erasedIds } : { strokes: remaining, erasedIds };
}

/** Convert the screen-sized eraser radius into canvas units at the current zoom. */
export function eraserRadiusForScale(screenRadius: number, scale: number): number {
  'worklet';
  if (!Number.isFinite(scale) || scale <= 0) return screenRadius;
  return screenRadius / scale;
}
