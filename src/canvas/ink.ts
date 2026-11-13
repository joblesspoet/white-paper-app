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

export type InkPoint = {
  x: number;
  y: number;
  /** Normalized stylus pressure in [0, 1]; undefined or 0.5 for finger input. */
  pressure?: number;
};

export type InputPointerKind = 'touch' | 'stylus' | 'mouse' | 'other';

export type InkStroke = {
  id: string;
  tool: FreehandTool;
  /** Canvas-space points. The first point is the start of the stroke. */
  points: InkPoint[];
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
  point: InkPoint;
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
export function appendInkPoint(stroke: InkStroke, point: InkPoint, minDistance = 0): InkStroke {
  const last = stroke.points[stroke.points.length - 1];
  if (last && Math.hypot(point.x - last.x, point.y - last.y) < minDistance) return stroke;
  return { ...stroke, points: [...stroke.points, point] };
}

/**
 * Build a smooth SVG path through the sampled points. Quadratic segments join
 * midpoints, which removes the faceted look of raw polyline input while still
 * passing through the ends of the stroke.
 */
export function inkPathData(points: InkPoint[]): string {
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

/**
 * Palm-rejection filter: when `stylusOnlyDrawing` is enabled, only stylus
 * (or mouse in simulator/desktop testing) pointers are accepted for inking.
 */
export function shouldAcceptInkPointer(
  pointerKind: InputPointerKind,
  stylusOnlyDrawing: boolean,
): boolean {
  'worklet';
  if (!stylusOnlyDrawing) return true;
  return pointerKind === 'stylus' || pointerKind === 'mouse';
}

/** Map normalized pressure in [0, 1] to a stroke width multiplier in [0.45, 1.45]. */
export function pressureWidthMultiplier(pressure: number | undefined): number {
  if (typeof pressure !== 'number' || !Number.isFinite(pressure)) return 1;
  const clamped = Math.max(0, Math.min(1, pressure));
  return 0.45 + clamped;
}

/** True when any point carries explicit stylus pressure metadata. */
export function hasVariablePressure(points: readonly InkPoint[]): boolean {
  for (let i = 0; i < points.length; i += 1) {
    if (typeof points[i].pressure === 'number' && Number.isFinite(points[i].pressure)) {
      return true;
    }
  }
  return false;
}

/**
 * Compute a closed filled SVG ribbon path for pressure-sensitive strokes.
 * Modulates half-width along perpendicular normals using `pressureWidthMultiplier`.
 */
export function buildVariableWidthStrokePath(
  points: readonly InkPoint[],
  baseWidth: number,
): string {
  if (points.length === 0) return '';
  const safeWidth = Math.max(0.5, baseWidth);

  if (points.length === 1) {
    const p = points[0];
    const r = (safeWidth * pressureWidthMultiplier(p.pressure)) / 2;
    return `M ${p.x - r} ${p.y} A ${r} ${r} 0 1 0 ${p.x + r} ${p.y} A ${r} ${r} 0 1 0 ${p.x - r} ${p.y} Z`;
  }

  const leftSide: Point[] = [];
  const rightSide: Point[] = [];
  let lastNx = 0;
  let lastNy = -1;

  for (let i = 0; i < points.length; i += 1) {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy);
    let nx = lastNx;
    let ny = lastNy;
    if (len > 1e-4) {
      nx = -dy / len;
      ny = dx / len;
      lastNx = nx;
      lastNy = ny;
    }
    const r = (safeWidth * pressureWidthMultiplier(points[i].pressure)) / 2;
    leftSide.push({ x: points[i].x + nx * r, y: points[i].y + ny * r });
    rightSide.push({ x: points[i].x - nx * r, y: points[i].y - ny * r });
  }

  const first = points[0];
  const firstR = (safeWidth * pressureWidthMultiplier(first.pressure)) / 2;
  const last = points[points.length - 1];
  const lastR = (safeWidth * pressureWidthMultiplier(last.pressure)) / 2;

  const commands: string[] = [`M ${leftSide[0].x.toFixed(2)} ${leftSide[0].y.toFixed(2)}`];
  for (let i = 1; i < leftSide.length; i += 1) {
    commands.push(`L ${leftSide[i].x.toFixed(2)} ${leftSide[i].y.toFixed(2)}`);
  }
  const lastRight = rightSide[rightSide.length - 1];
  commands.push(
    `A ${lastR.toFixed(2)} ${lastR.toFixed(2)} 0 0 1 ${lastRight.x.toFixed(2)} ${lastRight.y.toFixed(2)}`,
  );
  for (let i = rightSide.length - 2; i >= 0; i -= 1) {
    commands.push(`L ${rightSide[i].x.toFixed(2)} ${rightSide[i].y.toFixed(2)}`);
  }
  commands.push(
    `A ${firstR.toFixed(2)} ${firstR.toFixed(2)} 0 0 1 ${leftSide[0].x.toFixed(2)} ${leftSide[0].y.toFixed(2)} Z`,
  );

  return commands.join(' ');
}
