/**
 * Pure geometry for rectangle, ellipse, line, and connector objects.
 *
 * A shape or connector is stored as an axis-aligned canvas-space box plus a
 * `direction` that records which two corners the line runs between. Keeping the
 * geometry pure means the Skia renderer, hit testing, and the Node verification
 * scripts all agree on what a shape looks like at any zoom level.
 *
 * The direction is not cosmetic: a connector arrow must keep pointing at the
 * end the user dragged toward, even when the drag box is normalised.
 */

import type { Point } from './viewport';

export type ShapeKind = 'rectangle' | 'ellipse' | 'line';
export type ConnectorStyle = 'line' | 'arrow' | 'elbow';

/**
 * Which corners a line/connector runs between:
 * `tlbr` top-left → bottom-right, `trbl` top-right → bottom-left,
 * `bltr` bottom-left → top-right, `brtl` bottom-right → top-left.
 */
export type LineDirection = 'tlbr' | 'trbl' | 'bltr' | 'brtl';

export type ShapeGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
  direction: LineDirection;
};

export const SHAPE_STROKE_WIDTHS = [2, 4, 8] as const;
export const CONNECTOR_STROKE_WIDTHS = [2, 4, 6] as const;
export const STROKE_WIDTH_LABELS = ['S', 'M', 'L'] as const;

export const DEFAULT_SHAPE_STROKE_WIDTH = 4;
export const DEFAULT_CONNECTOR_STROKE_WIDTH = 4;

/** A drag shorter than this (in screen points) is a tap, not a shape. */
export const MIN_SHAPE_SIZE_SCREEN = 8;

/** Arrow heads are drawn in canvas units so they zoom with the connector. */
export function arrowHeadSize(strokeWidth: number): number {
  return Math.max(10, strokeWidth * 3);
}

/** Record the drag direction while normalising the box. */
export function directionFromPoints(start: Point, end: Point): LineDirection {
  'worklet';
  if (end.x >= start.x) return end.y >= start.y ? 'tlbr' : 'bltr';
  return end.y >= start.y ? 'trbl' : 'brtl';
}

/** Normalised canvas box for a drag, preserving which corner the drag began at. */
export function geometryFromPoints(start: Point, end: Point): ShapeGeometry {
  'worklet';
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
    direction: directionFromPoints(start, end),
  };
}

/** The two ends of a line inside a normalised box. */
export function linePoints(
  x: number,
  y: number,
  width: number,
  height: number,
  direction: LineDirection,
): { start: Point; end: Point } {
  'worklet';
  switch (direction) {
    case 'trbl':
      return { start: { x: x + width, y }, end: { x, y: y + height } };
    case 'bltr':
      return { start: { x, y: y + height }, end: { x: x + width, y } };
    case 'brtl':
      return { start: { x: x + width, y: y + height }, end: { x, y } };
    case 'tlbr':
    default:
      return { start: { x, y }, end: { x: x + width, y: y + height } };
  }
}

/**
 * The polyline a connector follows. Straight connectors are one segment; an
 * elbow connector takes the longer axis first, then turns across the middle.
 */
export function connectorPolyline(
  style: ConnectorStyle,
  x: number,
  y: number,
  width: number,
  height: number,
  direction: LineDirection,
): Point[] {
  'worklet';
  const { start, end } = linePoints(x, y, width, height, direction);
  if (style !== 'elbow') return [start, end];
  if (width >= height) {
    const midX = x + width / 2;
    return [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end];
  }
  const midY = y + height / 2;
  return [start, { x: start.x, y: midY }, { x: end.x, y: midY }, end];
}

/** SVG path data for a polyline. */
export function polylinePathData(points: readonly Point[]): string {
  const first = points[0];
  if (!first) return '';
  const commands = [`M ${first.x} ${first.y}`];
  for (let index = 1; index < points.length; index += 1) {
    commands.push(`L ${points[index].x} ${points[index].y}`);
  }
  return commands.join(' ');
}

/** A filled arrow head at the end of a polyline, pointing along its last segment. */
export function arrowHeadPathData(points: readonly Point[], headSize: number): string {
  if (points.length < 2) return '';
  const end = points[points.length - 1];
  const previous = points[points.length - 2];
  const angle = Math.atan2(end.y - previous.y, end.x - previous.x);
  const spread = Math.PI / 7;
  const left = {
    x: end.x - headSize * Math.cos(angle - spread),
    y: end.y - headSize * Math.sin(angle - spread),
  };
  const right = {
    x: end.x - headSize * Math.cos(angle + spread),
    y: end.y - headSize * Math.sin(angle + spread),
  };
  return `M ${end.x} ${end.y} L ${left.x} ${left.y} L ${right.x} ${right.y} Z`;
}

function distanceToSegment(point: Point, start: Point, end: Point): number {
  'worklet';
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared),
  );
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

/** Shortest distance from a point to any segment of a polyline. */
export function distanceToPolyline(point: Point, points: readonly Point[]): number {
  'worklet';
  if (points.length === 0) return Number.POSITIVE_INFINITY;
  if (points.length === 1) return Math.hypot(point.x - points[0].x, point.y - points[0].y);
  let closest = Number.POSITIVE_INFINITY;
  for (let index = 1; index < points.length; index += 1) {
    closest = Math.min(closest, distanceToSegment(point, points[index - 1], points[index]));
  }
  return closest;
}

/** Finger-sized hit tolerance in canvas units; thick strokes are easier to grab. */
export function strokeHitTolerance(strokeWidth: number): number {
  'worklet';
  return Math.max(8, strokeWidth / 2 + 4);
}
