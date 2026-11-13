/**
 * Pure geometry for the Interactive Geometry Box instruments:
 * Ruler, Protractor, Compass, and Set Squares (45° & 30°–60°).
 *
 * All coordinates and dimensions are in canvas (world) space so instruments
 * pan, zoom, and align 1:1 with ink strokes and shapes.
 */

import type { Point } from './viewport.ts';

export type InstrumentKind =
  | 'ruler'
  | 'protractor'
  | 'compass'
  | 'set-square-45'
  | 'set-square-30-60';

export type RulerState = {
  kind: 'ruler';
  /** Center of the ruler in canvas coordinates. */
  x: number;
  y: number;
  /** Clockwise rotation in degrees (-180 to 180). */
  angleDeg: number;
  /** Length along the ruler's primary axis (240–600). */
  length: number;
  /** Thickness perpendicular to the primary axis. */
  width: number;
};

export type ProtractorState = {
  kind: 'protractor';
  /** Origin (center of the baseline) in canvas coordinates. */
  x: number;
  y: number;
  /** Clockwise rotation of the protractor baseline in degrees. */
  angleDeg: number;
  radius: number;
  fullCircle: boolean;
  /** Ray 1 angle in protractor-local degrees (0° = right along baseline). */
  startAngleDeg: number;
  /** Sweep angle from Ray 1 to Ray 2 in degrees. */
  sweepAngleDeg: number;
};

export type CompassState = {
  kind: 'compass';
  /** Needle pivot center in canvas coordinates. */
  x: number;
  y: number;
  /** Arm radius in canvas units (24–360). */
  radius: number;
  /** Current pencil arm angle in degrees. */
  angleDeg: number;
};

export type SetSquareState = {
  kind: 'set-square-45' | 'set-square-30-60';
  /** Right-angle reference center / centroid in canvas coordinates. */
  x: number;
  y: number;
  angleDeg: number;
  /** Base leg length in canvas units. */
  size: number;
};

export type GeometryInstrumentState =
  | RulerState
  | ProtractorState
  | CompassState
  | SetSquareState;

export const RULER_MIN_LENGTH = 240;
export const RULER_MAX_LENGTH = 600;
export const RULER_DEFAULT_WIDTH = 56;
export const COMPASS_MIN_RADIUS = 24;
export const COMPASS_MAX_RADIUS = 360;
export const GEOMETRY_SNAP_SCREEN_DISTANCE = 28;
export const ANGLE_DETENT_STEP_DEG = 15;
export const ANGLE_DETENT_THRESHOLD_DEG = 3;

export function normalizeAngleDeg(angleDeg: number): number {
  let angle = ((angleDeg + 180) % 360 + 360) % 360 - 180;
  if (angle === -180) angle = 180;
  return angle;
}

/**
 * Soft-snap an angle to 15° increments (0°, 15°, 30°, 45°, 60°, 90°, etc.)
 * when within `thresholdDeg`.
 */
export function snapAngleDeg(
  angleDeg: number,
  thresholdDeg = ANGLE_DETENT_THRESHOLD_DEG,
  stepDeg = ANGLE_DETENT_STEP_DEG,
): number {
  const normalized = normalizeAngleDeg(angleDeg);
  const nearest = Math.round(normalized / stepDeg) * stepDeg;
  if (Math.abs(normalized - nearest) <= thresholdDeg) {
    return normalizeAngleDeg(nearest);
  }
  return normalized;
}

export function createDefaultInstrument(
  kind: InstrumentKind,
  center: Point,
): GeometryInstrumentState {
  switch (kind) {
    case 'ruler':
      return {
        kind: 'ruler',
        x: Math.round(center.x),
        y: Math.round(center.y),
        angleDeg: 0,
        length: 360,
        width: RULER_DEFAULT_WIDTH,
      };
    case 'protractor':
      return {
        kind: 'protractor',
        x: Math.round(center.x),
        y: Math.round(center.y),
        angleDeg: 0,
        radius: 130,
        fullCircle: false,
        startAngleDeg: 0,
        sweepAngleDeg: 45,
      };
    case 'compass':
      return {
        kind: 'compass',
        x: Math.round(center.x),
        y: Math.round(center.y),
        radius: 100,
        angleDeg: -45,
      };
    case 'set-square-45':
      return {
        kind: 'set-square-45',
        x: Math.round(center.x),
        y: Math.round(center.y),
        angleDeg: 0,
        size: 210,
      };
    case 'set-square-30-60':
      return {
        kind: 'set-square-30-60',
        x: Math.round(center.x),
        y: Math.round(center.y),
        angleDeg: 0,
        size: 230,
      };
  }
}

function toLocal(point: Point, origin: Point, angleDeg: number): Point {
  const rad = (-angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  return {
    x: dx * cos - dy * sin,
    y: dx * sin + dy * cos,
  };
}

function toWorld(local: Point, origin: Point, angleDeg: number): Point {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: origin.x + local.x * cos - local.y * sin,
    y: origin.y + local.x * sin + local.y * cos,
  };
}

/**
 * Project a canvas point onto the nearest top or bottom edge of the Ruler if
 * it lies within `snapDistanceCanvas` of that edge and within the ruler's span.
 */
export function projectPointToRulerEdge(
  point: Point,
  ruler: RulerState,
  snapDistanceCanvas: number,
): { snappedPoint: Point; edge: 'top' | 'bottom'; distanceAlongEdge: number } | null {
  const local = toLocal(point, { x: ruler.x, y: ruler.y }, ruler.angleDeg);
  const halfLen = ruler.length / 2;
  const halfWidth = ruler.width / 2;

  if (local.x < -halfLen - snapDistanceCanvas || local.x > halfLen + snapDistanceCanvas) {
    return null;
  }

  const distTop = Math.abs(local.y - -halfWidth);
  const distBottom = Math.abs(local.y - halfWidth);
  if (distTop > snapDistanceCanvas && distBottom > snapDistanceCanvas) {
    return null;
  }

  const edge: 'top' | 'bottom' = distTop <= distBottom ? 'top' : 'bottom';
  return { ...projectPointToLockedRulerEdge(point, ruler, edge), edge };
}

/**
 * Project a canvas point onto a previously locked ruler edge (`top` or `bottom`),
 * clamping along the ruler's length.
 */
export function projectPointToLockedRulerEdge(
  point: Point,
  ruler: RulerState,
  edge: 'top' | 'bottom',
): { snappedPoint: Point; distanceAlongEdge: number } {
  const local = toLocal(point, { x: ruler.x, y: ruler.y }, ruler.angleDeg);
  const halfLen = ruler.length / 2;
  const halfWidth = ruler.width / 2;
  const clampedX = Math.max(-halfLen, Math.min(halfLen, local.x));
  const edgeY = edge === 'top' ? -halfWidth : halfWidth;
  return {
    snappedPoint: toWorld({ x: clampedX, y: edgeY }, { x: ruler.x, y: ruler.y }, ruler.angleDeg),
    distanceAlongEdge: clampedX + halfLen,
  };
}

/**
 * Compute the three world-space vertices of a Set Square (`45°` or `30°–60°`).
 * Vertex 0 is the 90° right-angle corner.
 */
export function setSquareVertices(setSquare: SetSquareState): [Point, Point, Point] {
  const size = setSquare.size;
  let localVerts: [Point, Point, Point];
  if (setSquare.kind === 'set-square-45') {
    const leg = size;
    // Centroid-centered right isosceles triangle
    localVerts = [
      { x: -leg / 3, y: leg / 3 },
      { x: -leg / 3, y: (-2 * leg) / 3 },
      { x: (2 * leg) / 3, y: leg / 3 },
    ];
  } else {
    // 30°-60°-90° triangle: base = size, vertical leg = size / sqrt(3)
    const base = size;
    const height = size / Math.sqrt(3);
    localVerts = [
      { x: -base / 3, y: height / 3 },
      { x: -base / 3, y: (-2 * height) / 3 },
      { x: (2 * base) / 3, y: height / 3 },
    ];
  }
  const origin = { x: setSquare.x, y: setSquare.y };
  return [
    toWorld(localVerts[0], origin, setSquare.angleDeg),
    toWorld(localVerts[1], origin, setSquare.angleDeg),
    toWorld(localVerts[2], origin, setSquare.angleDeg),
  ];
}

function projectOntoSegment(
  point: Point,
  a: Point,
  b: Point,
): { snappedPoint: Point; distance: number; distanceAlongEdge: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return {
      snappedPoint: a,
      distance: Math.hypot(point.x - a.x, point.y - a.y),
      distanceAlongEdge: 0,
    };
  }
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lenSq));
  const snappedPoint = { x: a.x + t * dx, y: a.y + t * dy };
  return {
    snappedPoint,
    distance: Math.hypot(point.x - snappedPoint.x, point.y - snappedPoint.y),
    distanceAlongEdge: t * Math.sqrt(lenSq),
  };
}

/**
 * Project a canvas point onto the nearest of the 3 edges of a Set Square
 * (or a locked edge index `0 | 1 | 2`).
 */
export function projectPointToSetSquareEdge(
  point: Point,
  setSquare: SetSquareState,
  snapDistanceCanvas: number,
  lockedEdgeIndex?: 0 | 1 | 2,
): { snappedPoint: Point; edgeIndex: 0 | 1 | 2; distanceAlongEdge: number } | null {
  const verts = setSquareVertices(setSquare);
  const edges: readonly [Point, Point][] = [
    [verts[0], verts[1]],
    [verts[1], verts[2]],
    [verts[2], verts[0]],
  ];

  if (lockedEdgeIndex !== undefined) {
    const [a, b] = edges[lockedEdgeIndex];
    const proj = projectOntoSegment(point, a, b);
    return {
      snappedPoint: proj.snappedPoint,
      edgeIndex: lockedEdgeIndex,
      distanceAlongEdge: proj.distanceAlongEdge,
    };
  }

  let bestEdge: 0 | 1 | 2 | null = null;
  let bestDist = snapDistanceCanvas;
  let bestPoint: Point = point;
  let bestAlong = 0;

  for (let i = 0; i < 3; i += 1) {
    const [a, b] = edges[i];
    const proj = projectOntoSegment(point, a, b);
    if (proj.distance <= bestDist) {
      bestDist = proj.distance;
      bestEdge = i as 0 | 1 | 2;
      bestPoint = proj.snappedPoint;
      bestAlong = proj.distanceAlongEdge;
    }
  }

  if (bestEdge === null) return null;
  return {
    snappedPoint: bestPoint,
    edgeIndex: bestEdge,
    distanceAlongEdge: bestAlong,
  };
}

/**
 * Generate canvas-space polyline points along a circular arc for the Compass
 * (or Protractor arc).
 */
export function buildCompassArcPoints(
  center: Point,
  radius: number,
  startAngleDeg: number,
  endAngleDeg: number,
  steps?: number,
): readonly Point[] {
  const safeRadius = Math.max(4, radius);
  const sweep = endAngleDeg - startAngleDeg;
  const absSweep = Math.abs(sweep);
  const segmentCount =
    steps ?? Math.max(12, Math.min(180, Math.ceil((absSweep / 360) * 96)));
  const points: Point[] = [];
  for (let i = 0; i <= segmentCount; i += 1) {
    const t = i / segmentCount;
    const deg = startAngleDeg + sweep * t;
    const rad = (deg * Math.PI) / 180;
    points.push({
      x: center.x + safeRadius * Math.cos(rad),
      y: center.y + safeRadius * Math.sin(rad),
    });
  }
  return points;
}

/**
 * Compute world-space rays and arc for the Protractor's `Draw angle` action.
 */
export function buildProtractorAngleGeometry(protractor: ProtractorState): {
  vertex: Point;
  ray1End: Point;
  ray2End: Point;
  arcPoints: readonly Point[];
  sweepDeg: number;
} {
  const vertex = { x: protractor.x, y: protractor.y };
  const rayLength = protractor.radius * 1.15;
  const arcRadius = protractor.radius * 0.45;
  // Local protractor 0° points right; positive angles go counter-clockwise in standard math,
  // or clockwise in screen space. Here we use standard screen-clockwise negated so 90° is "up".
  const worldStartDeg = protractor.angleDeg - protractor.startAngleDeg;
  const worldEndDeg = protractor.angleDeg - (protractor.startAngleDeg + protractor.sweepAngleDeg);

  const startRad = (worldStartDeg * Math.PI) / 180;
  const endRad = (worldEndDeg * Math.PI) / 180;

  return {
    vertex,
    ray1End: {
      x: vertex.x + rayLength * Math.cos(startRad),
      y: vertex.y + rayLength * Math.sin(startRad),
    },
    ray2End: {
      x: vertex.x + rayLength * Math.cos(endRad),
      y: vertex.y + rayLength * Math.sin(endRad),
    },
    arcPoints: buildCompassArcPoints(vertex, arcRadius, worldStartDeg, worldEndDeg),
    sweepDeg: Math.round(Math.abs(protractor.sweepAngleDeg) * 10) / 10,
  };
}
