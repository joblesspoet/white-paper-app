/**
 * Smart on-device shape & handwriting recognition helpers.
 *
 * - Hold-to-snap shape recognition (`classifyInkStroke`) runs in < 5 ms on
 *   raw stroke points using Ramer-Douglas-Peucker simplification, collinearity,
 *   closure, radial variance, and corner-angle heuristics.
 * - Lasso ink-to-text helpers (`strokesInRect`, `inkStrokesBoundingBox`) select
 *   freehand ink strokes and compute padded offscreen bounds for OCR.
 */

import {
  createConnectorObject,
  createShapeObject,
  type ConnectorObject,
  type LineDirection,
  type ShapeObject,
} from './document.ts';
import type { InkStroke } from './ink.ts';
import type { CanvasRect } from './selection.ts';
import { directionFromPoints } from './shapes.ts';
import type { Point } from './viewport.ts';

export type RecognizedShapeKind =
  | 'line'
  | 'arrow'
  | 'ellipse'
  | 'rectangle'
  | 'diamond'
  | 'triangle-equilateral'
  | 'triangle-right';

export type RecognizedShapeResult = {
  kind: RecognizedShapeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  direction?: LineDirection;
};

const MIN_RECOGNIZABLE_LENGTH = 24;

/** Compute total polyline path length. */
export function strokePathLength(points: readonly Point[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i += 1) {
    len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return len;
}

function perpendicularDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

/** Ramer-Douglas-Peucker polyline simplification. */
export function rdpSimplify(points: readonly Point[], epsilon: number): Point[] {
  if (points.length <= 2) return [...points];
  let maxDist = 0;
  let index = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i += 1) {
    const d = perpendicularDistance(points[i], start, end);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }

  if (maxDist > epsilon) {
    const left = rdpSimplify(points.slice(0, index + 1), epsilon);
    const right = rdpSimplify(points.slice(index), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [start, end];
}

function boundsOfPoints(points: readonly Point[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i];
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

function lineDirectionFromEndpoints(start: Point, end: Point): LineDirection {
  return directionFromPoints(start, end);
}

function hasRightAngleCorner(vertices: readonly Point[]): boolean {
  if (vertices.length !== 3) return false;
  for (let i = 0; i < 3; i += 1) {
    const a = vertices[i];
    const b = vertices[(i + 1) % 3];
    const c = vertices[(i + 2) % 3];
    const v1x = a.x - b.x;
    const v1y = a.y - b.y;
    const v2x = c.x - b.x;
    const v2y = c.y - b.y;
    const len1 = Math.hypot(v1x, v1y);
    const len2 = Math.hypot(v2x, v2y);
    if (len1 > 0 && len2 > 0) {
      const cosAngle = Math.abs((v1x * v2x + v1y * v2y) / (len1 * len2));
      if (cosAngle < 0.22) return true; // ~77°–103°
    }
  }
  return false;
}

/**
 * Classify a freehand stroke into a crisp geometric shape or connector.
 * Returns `null` for scribbles, text, or ambiguous strokes.
 */
export function classifyInkStroke(points: readonly Point[]): RecognizedShapeResult | null {
  if (points.length < 3) return null;

  const totalLength = strokePathLength(points);
  if (totalLength < MIN_RECOGNIZABLE_LENGTH) return null;

  const box = boundsOfPoints(points);
  const diag = Math.hypot(box.width, box.height);
  if (diag < MIN_RECOGNIZABLE_LENGTH) return null;

  const first = points[0];
  const last = points[points.length - 1];
  const endToEnd = Math.hypot(last.x - first.x, last.y - first.y);

  // 1. Straight line check (high collinearity)
  if (endToEnd / totalLength >= 0.92 && totalLength / diag <= 1.15) {
    return {
      kind: 'line',
      x: box.minX,
      y: box.minY,
      width: Math.max(2, box.width),
      height: Math.max(2, box.height),
      direction: lineDirectionFromEndpoints(first, last),
    };
  }

  // 2. Arrow check: mostly straight shaft followed by a short arrowhead hook (1 or 2 barbs)
  const rdpLine = rdpSimplify(points, Math.max(6, diag * 0.045));
  if (rdpLine.length >= 3 && rdpLine.length <= 5) {
    const shaftStart = rdpLine[0];
    const shaftTip = rdpLine[1];
    const shaftLen = Math.hypot(shaftTip.x - shaftStart.x, shaftTip.y - shaftStart.y);
    const tailLen = totalLength - shaftLen;
    const tailNearTip = rdpLine
      .slice(2)
      .every((pt) => Math.hypot(pt.x - shaftTip.x, pt.y - shaftTip.y) <= Math.max(36, shaftLen * 0.35));
    if (shaftLen >= diag * 0.65 && tailLen > 8 && tailLen <= shaftLen * 0.65 && tailNearTip) {
      const shaftBox = boundsOfPoints([shaftStart, shaftTip]);
      return {
        kind: 'arrow',
        x: shaftBox.minX,
        y: shaftBox.minY,
        width: Math.max(2, shaftBox.width),
        height: Math.max(2, shaftBox.height),
        direction: lineDirectionFromEndpoints(shaftStart, shaftTip),
      };
    }
  }

  // 3. Closed shapes: start and end must be reasonably close
  const isClosed = endToEnd <= Math.max(24, totalLength * 0.24);
  if (!isClosed) return null;

  // Reject multi-loop scribbles (perimeter much larger than bounding box perimeter)
  const boxPerimeter = 2 * (box.width + box.height);
  if (totalLength > boxPerimeter * 1.45) return null;

  // Simplify closed loop
  const epsilon = Math.max(6, diag * 0.055);
  const simplified = rdpSimplify(points, epsilon);
  // Drop closing duplicate vertex if near first
  const vertices =
    simplified.length > 2 &&
    Math.hypot(
      simplified[simplified.length - 1].x - simplified[0].x,
      simplified[simplified.length - 1].y - simplified[0].y,
    ) <= Math.max(24, diag * 0.22)
      ? simplified.slice(0, -1)
      : simplified;

  // 3a. Triangle (3 vertices)
  if (vertices.length === 3) {
    return {
      kind: hasRightAngleCorner(vertices) ? 'triangle-right' : 'triangle-equilateral',
      x: box.minX,
      y: box.minY,
      width: box.width,
      height: box.height,
    };
  }

  // 3b. Quadrilateral: Rectangle vs Diamond (4 vertices)
  if (vertices.length === 4) {
    const cx = (box.minX + box.maxX) / 2;
    const cy = (box.minY + box.maxY) / 2;
    // Diamond vertices sit near the midpoints of the bounding box edges;
    // rectangle vertices sit near the bounding box corners.
    let cornerScore = 0;
    let midpointScore = 0;
    for (const v of vertices) {
      const nx = Math.abs(v.x - cx) / Math.max(1, box.width / 2);
      const ny = Math.abs(v.y - cy) / Math.max(1, box.height / 2);
      // Near a corner: both nx and ny are near 1
      cornerScore += Math.hypot(1 - nx, 1 - ny);
      // Near an edge midpoint: one of (nx, ny) is near 1, the other near 0
      const distToXMid = Math.hypot(nx, 1 - ny);
      const distToYMid = Math.hypot(1 - nx, ny);
      midpointScore += Math.min(distToXMid, distToYMid);
    }
    return {
      kind: midpointScore < cornerScore * 0.85 ? 'diamond' : 'rectangle',
      x: box.minX,
      y: box.minY,
      width: box.width,
      height: box.height,
    };
  }

  // 3c. Ellipse / Circle: normalized radial variance around bounding-box centre
  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;
  const rx = Math.max(1, box.width / 2);
  const ry = Math.max(1, box.height / 2);
  let sumR = 0;
  const radii: number[] = [];
  for (let i = 0; i < points.length; i += 1) {
    const r = Math.hypot((points[i].x - cx) / rx, (points[i].y - cy) / ry);
    radii.push(r);
    sumR += r;
  }
  const meanR = sumR / radii.length;
  let variance = 0;
  for (let i = 0; i < radii.length; i += 1) {
    const diff = radii[i] - meanR;
    variance += diff * diff;
  }
  const stdDev = Math.sqrt(variance / radii.length);

  if (stdDev <= 0.19 && meanR >= 0.78 && meanR <= 1.15) {
    return {
      kind: 'ellipse',
      x: box.minX,
      y: box.minY,
      width: box.width,
      height: box.height,
    };
  }

  return null;
}

/** Convert a recognized shape into a `ShapeObject` or `ConnectorObject`. */
export function recognizedShapeToObject(
  id: string,
  recognized: RecognizedShapeResult,
  style: { colorKey: string; strokeWidth: number },
): ShapeObject | ConnectorObject {
  const start = { x: recognized.x, y: recognized.y };
  const end = { x: recognized.x + recognized.width, y: recognized.y + recognized.height };

  if (recognized.kind === 'arrow') {
    const base = createConnectorObject({
      id,
      style: 'arrow',
      start,
      end,
      colorKey: style.colorKey,
      strokeWidth: style.strokeWidth,
    });
    return {
      ...base,
      direction: recognized.direction ?? 'tlbr',
    };
  }

  const base = createShapeObject({
    id,
    shape: recognized.kind,
    start,
    end,
    colorKey: style.colorKey,
    fillKey: null,
    strokeWidth: style.strokeWidth,
  });
  return {
    ...base,
    ...(recognized.direction ? { direction: recognized.direction } : {}),
  };
}

/** Return every ink stroke that has at least one point inside `rect`. */
export function strokesInRect(
  strokes: readonly InkStroke[],
  rect: CanvasRect,
): InkStroke[] {
  const minX = rect.x;
  const maxX = rect.x + rect.width;
  const minY = rect.y;
  const maxY = rect.y + rect.height;

  return strokes.filter((stroke) =>
    stroke.points.some(
      (p) => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY,
    ),
  );
}

/** Compute the padded bounding box covering all selected ink strokes. */
export function inkStrokesBoundingBox(
  strokes: readonly InkStroke[],
  padding = 24,
): CanvasRect | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let hasPoints = false;

  for (const stroke of strokes) {
    const halfW = stroke.width / 2;
    for (const p of stroke.points) {
      hasPoints = true;
      if (p.x - halfW < minX) minX = p.x - halfW;
      if (p.y - halfW < minY) minY = p.y - halfW;
      if (p.x + halfW > maxX) maxX = p.x + halfW;
      if (p.y + halfW > maxY) maxY = p.y + halfW;
    }
  }

  if (!hasPoints) return null;
  return {
    x: minX - padding,
    y: minY - padding,
    width: Math.max(32, maxX - minX + padding * 2),
    height: Math.max(32, maxY - minY + padding * 2),
  };
}
