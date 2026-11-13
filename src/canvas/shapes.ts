/**
 * Pure geometry for the expanded 53-shape 2D/3D, Graph & STEM library and
 * connector objects.
 *
 * A shape or connector is stored as an axis-aligned canvas-space box plus a
 * `direction` that records which two corners the line runs between. Keeping the
 * geometry pure means the live Skia renderer, picker preview icons, offscreen
 * export renderer, hit testing, and Node verification scripts all agree on
 * what every shape looks like at any zoom level.
 */

import type { Point } from './viewport.ts';

export type ShapeCategory =
  | 'basic'
  | 'flowchart'
  | 'solid-3d'
  | 'math-graph'
  | 'stem';

export type ShapeKind =
  // Category 1 — Basic & 2D Polygons (16)
  | 'rectangle'
  | 'rounded-rectangle'
  | 'ellipse'
  | 'line'
  | 'triangle-equilateral'
  | 'triangle-right'
  | 'triangle-isosceles'
  | 'triangle-obtuse'
  | 'diamond'
  | 'parallelogram'
  | 'trapezoid'
  | 'kite'
  | 'pentagon'
  | 'hexagon'
  | 'octagon'
  | 'star-5'
  // Category 2 — Callouts & Flowchart (8)
  | 'cross'
  | 'callout-bubble'
  | 'cloud'
  | 'cylinder-db'
  | 'document-wave'
  | 'parallelogram-io'
  | 'brace-left'
  | 'brace-right'
  // Category 3 — 3D Solids with dashed hidden edges (8)
  | 'cube'
  | 'cuboid'
  | 'cylinder'
  | 'cone'
  | 'sphere'
  | 'pyramid-square'
  | 'prism-triangular'
  | 'tetrahedron'
  // Category 4 — Math Graphs & Diagrams (10)
  | 'axes-2d-four-quadrant'
  | 'axes-2d-first-quadrant'
  | 'axes-3d'
  | 'number-line'
  | 'unit-circle'
  | 'venn-2'
  | 'venn-3'
  | 'fraction-bar'
  | 'pie-quadrant'
  | 'sine-wave'
  // Category 5 — STEM Stamps (11)
  | 'resistor'
  | 'capacitor'
  | 'battery'
  | 'inductor'
  | 'switch-open'
  | 'bulb'
  | 'diode'
  | 'beaker'
  | 'flask'
  | 'benzene-ring'
  | 'atom-orbital';

export type ShapeCatalogEntry = {
  kind: ShapeKind;
  label: string;
  category: ShapeCategory;
  fillable: boolean;
};

export const SHAPE_CATEGORIES: ReadonlyArray<{ id: ShapeCategory; label: string }> = [
  { id: 'basic', label: '2D Shapes' },
  { id: 'flowchart', label: 'Flowchart' },
  { id: 'solid-3d', label: '3D Solids' },
  { id: 'math-graph', label: 'Math Graphs' },
  { id: 'stem', label: 'STEM' },
] as const;

export const SHAPE_CATALOG: Record<ShapeKind, ShapeCatalogEntry> = {
  // Basic & 2D Polygons (16)
  rectangle: { kind: 'rectangle', label: 'Rectangle', category: 'basic', fillable: true },
  'rounded-rectangle': { kind: 'rounded-rectangle', label: 'Rounded Rect', category: 'basic', fillable: true },
  ellipse: { kind: 'ellipse', label: 'Ellipse', category: 'basic', fillable: true },
  line: { kind: 'line', label: 'Line', category: 'basic', fillable: false },
  'triangle-equilateral': { kind: 'triangle-equilateral', label: 'Equilateral', category: 'basic', fillable: true },
  'triangle-right': { kind: 'triangle-right', label: 'Right Triangle', category: 'basic', fillable: true },
  'triangle-isosceles': { kind: 'triangle-isosceles', label: 'Isosceles', category: 'basic', fillable: true },
  'triangle-obtuse': { kind: 'triangle-obtuse', label: 'Obtuse', category: 'basic', fillable: true },
  diamond: { kind: 'diamond', label: 'Diamond', category: 'basic', fillable: true },
  parallelogram: { kind: 'parallelogram', label: 'Parallelogram', category: 'basic', fillable: true },
  trapezoid: { kind: 'trapezoid', label: 'Trapezoid', category: 'basic', fillable: true },
  kite: { kind: 'kite', label: 'Kite', category: 'basic', fillable: true },
  pentagon: { kind: 'pentagon', label: 'Pentagon', category: 'basic', fillable: true },
  hexagon: { kind: 'hexagon', label: 'Hexagon', category: 'basic', fillable: true },
  octagon: { kind: 'octagon', label: 'Octagon', category: 'basic', fillable: true },
  'star-5': { kind: 'star-5', label: '5-Star', category: 'basic', fillable: true },
  // Callouts & Flowchart (8)
  cross: { kind: 'cross', label: 'Cross', category: 'flowchart', fillable: true },
  'callout-bubble': { kind: 'callout-bubble', label: 'Callout', category: 'flowchart', fillable: true },
  cloud: { kind: 'cloud', label: 'Cloud', category: 'flowchart', fillable: true },
  'cylinder-db': { kind: 'cylinder-db', label: 'Database', category: 'flowchart', fillable: true },
  'document-wave': { kind: 'document-wave', label: 'Document', category: 'flowchart', fillable: true },
  'parallelogram-io': { kind: 'parallelogram-io', label: 'Data I/O', category: 'flowchart', fillable: true },
  'brace-left': { kind: 'brace-left', label: 'Left Brace', category: 'flowchart', fillable: false },
  'brace-right': { kind: 'brace-right', label: 'Right Brace', category: 'flowchart', fillable: false },
  // 3D Solids (8)
  cube: { kind: 'cube', label: 'Cube', category: 'solid-3d', fillable: true },
  cuboid: { kind: 'cuboid', label: 'Cuboid', category: 'solid-3d', fillable: true },
  cylinder: { kind: 'cylinder', label: 'Cylinder', category: 'solid-3d', fillable: true },
  cone: { kind: 'cone', label: 'Cone', category: 'solid-3d', fillable: true },
  sphere: { kind: 'sphere', label: 'Sphere', category: 'solid-3d', fillable: true },
  'pyramid-square': { kind: 'pyramid-square', label: 'Pyramid', category: 'solid-3d', fillable: true },
  'prism-triangular': { kind: 'prism-triangular', label: 'Triangular Prism', category: 'solid-3d', fillable: true },
  tetrahedron: { kind: 'tetrahedron', label: 'Tetrahedron', category: 'solid-3d', fillable: true },
  // Math Graphs & Diagrams (10)
  'axes-2d-four-quadrant': { kind: 'axes-2d-four-quadrant', label: '4-Quad Axes', category: 'math-graph', fillable: false },
  'axes-2d-first-quadrant': { kind: 'axes-2d-first-quadrant', label: '1st Quad Axes', category: 'math-graph', fillable: false },
  'axes-3d': { kind: 'axes-3d', label: '3D Axes', category: 'math-graph', fillable: false },
  'number-line': { kind: 'number-line', label: 'Number Line', category: 'math-graph', fillable: false },
  'unit-circle': { kind: 'unit-circle', label: 'Unit Circle', category: 'math-graph', fillable: true },
  'venn-2': { kind: 'venn-2', label: '2-Set Venn', category: 'math-graph', fillable: true },
  'venn-3': { kind: 'venn-3', label: '3-Set Venn', category: 'math-graph', fillable: true },
  'fraction-bar': { kind: 'fraction-bar', label: 'Fraction Bar', category: 'math-graph', fillable: true },
  'pie-quadrant': { kind: 'pie-quadrant', label: 'Fraction Circle', category: 'math-graph', fillable: true },
  'sine-wave': { kind: 'sine-wave', label: 'Sine Wave', category: 'math-graph', fillable: false },
  // STEM Stamps (11)
  resistor: { kind: 'resistor', label: 'Resistor', category: 'stem', fillable: false },
  capacitor: { kind: 'capacitor', label: 'Capacitor', category: 'stem', fillable: false },
  battery: { kind: 'battery', label: 'Battery', category: 'stem', fillable: false },
  inductor: { kind: 'inductor', label: 'Inductor', category: 'stem', fillable: false },
  'switch-open': { kind: 'switch-open', label: 'Open Switch', category: 'stem', fillable: false },
  bulb: { kind: 'bulb', label: 'Lamp / Bulb', category: 'stem', fillable: true },
  diode: { kind: 'diode', label: 'Diode', category: 'stem', fillable: true },
  beaker: { kind: 'beaker', label: 'Beaker', category: 'stem', fillable: true },
  flask: { kind: 'flask', label: 'Flask', category: 'stem', fillable: true },
  'benzene-ring': { kind: 'benzene-ring', label: 'Benzene Ring', category: 'stem', fillable: true },
  'atom-orbital': { kind: 'atom-orbital', label: 'Atom Orbital', category: 'stem', fillable: true },
};

export const ALL_SHAPE_KINDS: readonly ShapeKind[] = Object.keys(SHAPE_CATALOG) as ShapeKind[];

export function shapesByCategory(category: ShapeCategory): readonly ShapeCatalogEntry[] {
  return ALL_SHAPE_KINDS
    .map((k) => SHAPE_CATALOG[k])
    .filter((entry) => entry.category === category);
}

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

// -------------------------------------------- unified shape render primitives

export type ShapeRenderPrimitives = {
  /** Closed SVG path for optional pastel/custom fill (`fillKey`). */
  fillPathSvg?: string;
  /** Primary visible contour SVG path rendered with `strokeWidth`. */
  solidStrokeSvg: string;
  /** Interior hidden depth edges (3D solids) or guide lines rendered with `DashPathEffect([6, 4])`. */
  dashedStrokeSvg?: string;
  /** Filled arrowheads for coordinate axes, vectors, and number lines. */
  arrowHeadsSvg?: string;
  /** Optional measurement labels (side lengths, radius, or interior angles) when `showMeasurements` is enabled. */
  measurementLabels?: readonly { text: string; x: number; y: number }[];
};

const n = (v: number): string => String(Math.round(v * 100) / 100);

function polygonSvg(pts: readonly [number, number][]): string {
  if (pts.length === 0) return '';
  return (
    `M ${n(pts[0][0])} ${n(pts[0][1])} ` +
    pts
      .slice(1)
      .map(([px, py]) => `L ${n(px)} ${n(py)}`)
      .join(' ') +
    ' Z'
  );
}

function regularPolygonSvg(
  x: number,
  y: number,
  w: number,
  h: number,
  sides: number,
  startDeg = -90,
): string {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rx = w / 2;
  const ry = h / 2;
  const pts: [number, number][] = [];
  for (let i = 0; i < sides; i += 1) {
    const rad = ((startDeg + (360 / sides) * i) * Math.PI) / 180;
    pts.push([cx + rx * Math.cos(rad), cy + ry * Math.sin(rad)]);
  }
  return polygonSvg(pts);
}

function ellipseSvg(cx: number, cy: number, rx: number, ry: number): string {
  const sx = Math.max(0.5, rx);
  const sy = Math.max(0.5, ry);
  return (
    `M ${n(cx - sx)} ${n(cy)} ` +
    `A ${n(sx)} ${n(sy)} 0 1 0 ${n(cx + sx)} ${n(cy)} ` +
    `A ${n(sx)} ${n(sy)} 0 1 0 ${n(cx - sx)} ${n(cy)} Z`
  );
}

function roundedRectSvg(x: number, y: number, w: number, h: number, r: number): string {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  return (
    `M ${n(x + rad)} ${n(y)} ` +
    `L ${n(x + w - rad)} ${n(y)} ` +
    `Q ${n(x + w)} ${n(y)} ${n(x + w)} ${n(y + rad)} ` +
    `L ${n(x + w)} ${n(y + h - rad)} ` +
    `Q ${n(x + w)} ${n(y + h)} ${n(x + w - rad)} ${n(y + h)} ` +
    `L ${n(x + rad)} ${n(y + h)} ` +
    `Q ${n(x)} ${n(y + h)} ${n(x)} ${n(y + h - rad)} ` +
    `L ${n(x)} ${n(y + rad)} ` +
    `Q ${n(x)} ${n(y)} ${n(x + rad)} ${n(y)} Z`
  );
}

function arrowHeadAt(tipX: number, tipY: number, angleRad: number, size: number): string {
  const spread = Math.PI / 7;
  const lx = tipX - size * Math.cos(angleRad - spread);
  const ly = tipY - size * Math.sin(angleRad - spread);
  const rx = tipX - size * Math.cos(angleRad + spread);
  const ry = tipY - size * Math.sin(angleRad + spread);
  return `M ${n(tipX)} ${n(tipY)} L ${n(lx)} ${n(ly)} L ${n(rx)} ${n(ry)} Z`;
}

function fmtDim(val: number): string {
  return `${Math.round(val)}`;
}

/**
 * Unified declarative geometry builder shared by `CanvasViewport.tsx`,
 * `ShapePreviewIcon.tsx`, and `export-service.ts`.
 */
export function buildShapeRenderPrimitives(
  kind: ShapeKind,
  x: number,
  y: number,
  width: number,
  height: number,
  direction: LineDirection = 'tlbr',
  showMeasurements = false,
): ShapeRenderPrimitives {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const head = Math.max(5, Math.min(12, Math.min(w, h) * 0.12));

  switch (kind) {
    // ---------------------------------------- Category 1: Basic & 2D Polygons
    case 'rectangle': {
      const p = polygonSvg([
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
      ]);
      return {
        fillPathSvg: p,
        solidStrokeSvg: p,
        ...(showMeasurements
          ? {
              measurementLabels: [
                { text: fmtDim(w), x: cx, y: y - 6 },
                { text: fmtDim(h), x: x + w + 8, y: cy },
              ],
            }
          : {}),
      };
    }

    case 'rounded-rectangle': {
      const p = roundedRectSvg(x, y, w, h, Math.min(w, h) * 0.18);
      return {
        fillPathSvg: p,
        solidStrokeSvg: p,
        ...(showMeasurements
          ? {
              measurementLabels: [
                { text: fmtDim(w), x: cx, y: y - 6 },
                { text: fmtDim(h), x: x + w + 8, y: cy },
              ],
            }
          : {}),
      };
    }

    case 'ellipse': {
      const p = ellipseSvg(cx, cy, w / 2, h / 2);
      const isCircle = Math.abs(w - h) < 2;
      return {
        fillPathSvg: p,
        solidStrokeSvg: p,
        ...(showMeasurements
          ? {
              measurementLabels: isCircle
                ? [{ text: `r=${fmtDim(w / 2)}`, x: cx, y: cy - 6 }]
                : [
                    { text: `a=${fmtDim(w / 2)}`, x: cx, y: y - 6 },
                    { text: `b=${fmtDim(h / 2)}`, x: x + w + 8, y: cy },
                  ],
            }
          : {}),
      };
    }

    case 'line': {
      const { start, end } = linePoints(x, y, w, h, direction);
      const len = Math.hypot(end.x - start.x, end.y - start.y);
      return {
        solidStrokeSvg: `M ${n(start.x)} ${n(start.y)} L ${n(end.x)} ${n(end.y)}`,
        ...(showMeasurements
          ? {
              measurementLabels: [
                { text: fmtDim(len), x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 - 8 },
              ],
            }
          : {}),
      };
    }

    case 'triangle-equilateral': {
      const p = polygonSvg([
        [cx, y],
        [x + w, y + h],
        [x, y + h],
      ]);
      const side = Math.hypot(w / 2, h);
      return {
        fillPathSvg: p,
        solidStrokeSvg: p,
        ...(showMeasurements
          ? {
              measurementLabels: [
                { text: '60°', x: cx, y: y + Math.min(22, h * 0.28) },
                { text: fmtDim(w), x: cx, y: y + h + 14 },
                { text: fmtDim(side), x: x + w * 0.2, y: cy },
              ],
            }
          : {}),
      };
    }

    case 'triangle-right': {
      const p = polygonSvg([
        [x, y],
        [x + w, y + h],
        [x, y + h],
      ]);
      const hyp = Math.hypot(w, h);
      return {
        fillPathSvg: p,
        solidStrokeSvg: p,
        ...(showMeasurements
          ? {
              measurementLabels: [
                { text: '90°', x: x + 16, y: y + h - 8 },
                { text: fmtDim(w), x: cx, y: y + h + 14 },
                { text: fmtDim(h), x: x - 14, y: cy },
                { text: fmtDim(hyp), x: cx + 10, y: cy - 6 },
              ],
            }
          : {}),
      };
    }

    case 'triangle-isosceles': {
      const p = polygonSvg([
        [cx, y],
        [x + w * 0.85, y + h],
        [x + w * 0.15, y + h],
      ]);
      const leg = Math.hypot(w * 0.35, h);
      return {
        fillPathSvg: p,
        solidStrokeSvg: p,
        ...(showMeasurements
          ? {
              measurementLabels: [
                { text: fmtDim(leg), x: x + w * 0.22, y: cy },
                { text: fmtDim(w * 0.7), x: cx, y: y + h + 14 },
              ],
            }
          : {}),
      };
    }

    case 'triangle-obtuse': {
      const p = polygonSvg([
        [x + w * 0.18, y],
        [x + w, y + h],
        [x, y + h * 0.72],
      ]);
      return {
        fillPathSvg: p,
        solidStrokeSvg: p,
        ...(showMeasurements
          ? { measurementLabels: [{ text: '>90°', x: x + w * 0.15, y: y + h * 0.65 }] }
          : {}),
      };
    }

    case 'diamond': {
      const p = polygonSvg([
        [cx, y],
        [x + w, cy],
        [cx, y + h],
        [x, cy],
      ]);
      return {
        fillPathSvg: p,
        solidStrokeSvg: p,
        ...(showMeasurements
          ? {
              measurementLabels: [
                { text: fmtDim(w), x: cx, y: y - 6 },
                { text: fmtDim(h), x: x + w + 8, y: cy },
              ],
            }
          : {}),
      };
    }

    case 'parallelogram': {
      const skew = w * 0.22;
      const p = polygonSvg([
        [x + skew, y],
        [x + w, y],
        [x + w - skew, y + h],
        [x, y + h],
      ]);
      return {
        fillPathSvg: p,
        solidStrokeSvg: p,
        ...(showMeasurements
          ? { measurementLabels: [{ text: fmtDim(w - skew), x: cx, y: y - 6 }] }
          : {}),
      };
    }

    case 'trapezoid': {
      const inset = w * 0.2;
      const p = polygonSvg([
        [x + inset, y],
        [x + w - inset, y],
        [x + w, y + h],
        [x, y + h],
      ]);
      return {
        fillPathSvg: p,
        solidStrokeSvg: p,
        ...(showMeasurements
          ? {
              measurementLabels: [
                { text: fmtDim(w - inset * 2), x: cx, y: y - 6 },
                { text: fmtDim(w), x: cx, y: y + h + 14 },
              ],
            }
          : {}),
      };
    }

    case 'kite': {
      const p = polygonSvg([
        [cx, y],
        [x + w, y + h * 0.36],
        [cx, y + h],
        [x, y + h * 0.36],
      ]);
      return { fillPathSvg: p, solidStrokeSvg: p };
    }

    case 'pentagon': {
      const p = regularPolygonSvg(x, y, w, h, 5, -90);
      return {
        fillPathSvg: p,
        solidStrokeSvg: p,
        ...(showMeasurements ? { measurementLabels: [{ text: '108°', x: cx, y: y + 18 }] } : {}),
      };
    }

    case 'hexagon': {
      const p = regularPolygonSvg(x, y, w, h, 6, 0);
      return {
        fillPathSvg: p,
        solidStrokeSvg: p,
        ...(showMeasurements ? { measurementLabels: [{ text: '120°', x: cx, y: y + 18 }] } : {}),
      };
    }

    case 'octagon': {
      const p = regularPolygonSvg(x, y, w, h, 8, 22.5);
      return {
        fillPathSvg: p,
        solidStrokeSvg: p,
        ...(showMeasurements ? { measurementLabels: [{ text: '135°', x: cx, y: y + 18 }] } : {}),
      };
    }

    case 'star-5': {
      const pts: [number, number][] = [];
      const rxOuter = w / 2;
      const ryOuter = h / 2;
      const rxInner = w * 0.21;
      const ryInner = h * 0.21;
      for (let i = 0; i < 10; i += 1) {
        const rad = ((-90 + i * 36) * Math.PI) / 180;
        const rx = i % 2 === 0 ? rxOuter : rxInner;
        const ry = i % 2 === 0 ? ryOuter : ryInner;
        pts.push([cx + rx * Math.cos(rad), cy + ry * Math.sin(rad)]);
      }
      const p = polygonSvg(pts);
      return { fillPathSvg: p, solidStrokeSvg: p };
    }

    // ---------------------------------------- Category 2: Callouts & Flowchart
    case 'cross': {
      const x1 = x + w * 0.33;
      const x2 = x + w * 0.67;
      const y1 = y + h * 0.33;
      const y2 = y + h * 0.67;
      const p = polygonSvg([
        [x1, y],
        [x2, y],
        [x2, y1],
        [x + w, y1],
        [x + w, y2],
        [x2, y2],
        [x2, y + h],
        [x1, y + h],
        [x1, y2],
        [x, y2],
        [x, y1],
        [x1, y1],
      ]);
      return { fillPathSvg: p, solidStrokeSvg: p };
    }

    case 'callout-bubble': {
      const bodyH = h * 0.76;
      const r = Math.min(w, bodyH) * 0.15;
      const p =
        `M ${n(x + r)} ${n(y)} ` +
        `L ${n(x + w - r)} ${n(y)} ` +
        `Q ${n(x + w)} ${n(y)} ${n(x + w)} ${n(y + r)} ` +
        `L ${n(x + w)} ${n(y + bodyH - r)} ` +
        `Q ${n(x + w)} ${n(y + bodyH)} ${n(x + w - r)} ${n(y + bodyH)} ` +
        `L ${n(x + w * 0.42)} ${n(y + bodyH)} ` +
        `L ${n(x + w * 0.22)} ${n(y + h)} ` +
        `L ${n(x + w * 0.26)} ${n(y + bodyH)} ` +
        `L ${n(x + r)} ${n(y + bodyH)} ` +
        `Q ${n(x)} ${n(y + bodyH)} ${n(x)} ${n(y + bodyH - r)} ` +
        `L ${n(x)} ${n(y + r)} ` +
        `Q ${n(x)} ${n(y)} ${n(x + r)} ${n(y)} Z`;
      return { fillPathSvg: p, solidStrokeSvg: p };
    }

    case 'cloud': {
      const p =
        `M ${n(x + w * 0.25)} ${n(y + h * 0.8)} ` +
        `C ${n(x + w * 0.04)} ${n(y + h * 0.8)} ${n(x + w * 0.04)} ${n(y + h * 0.48)} ${n(x + w * 0.2)} ${n(y + h * 0.44)} ` +
        `C ${n(x + w * 0.16)} ${n(y + h * 0.18)} ${n(x + w * 0.46)} ${n(y + h * 0.12)} ${n(x + w * 0.56)} ${n(y + h * 0.28)} ` +
        `C ${n(x + w * 0.72)} ${n(y + h * 0.14)} ${n(x + w * 0.94)} ${n(y + h * 0.3)} ${n(x + w * 0.88)} ${n(y + h * 0.5)} ` +
        `C ${n(x + w * 0.98)} ${n(y + h * 0.62)} ${n(x + w * 0.9)} ${n(y + h * 0.8)} ${n(x + w * 0.74)} ${n(y + h * 0.8)} Z`;
      return { fillPathSvg: p, solidStrokeSvg: p };
    }

    case 'cylinder-db': {
      const ry = Math.min(h * 0.18, w * 0.22);
      const rx = w / 2;
      const topY = y + ry;
      const botY = y + h - ry;
      const fill =
        `M ${n(x)} ${n(topY)} ` +
        `A ${n(rx)} ${n(ry)} 0 1 1 ${n(x + w)} ${n(topY)} ` +
        `L ${n(x + w)} ${n(botY)} ` +
        `A ${n(rx)} ${n(ry)} 0 0 1 ${n(x)} ${n(botY)} Z`;
      const stroke =
        fill +
        ` M ${n(x)} ${n(topY)} A ${n(rx)} ${n(ry)} 0 0 0 ${n(x + w)} ${n(topY)}` +
        ` M ${n(x)} ${n(topY + (botY - topY) * 0.35)} A ${n(rx)} ${n(ry)} 0 0 0 ${n(x + w)} ${n(topY + (botY - topY) * 0.35)}`;
      return { fillPathSvg: fill, solidStrokeSvg: stroke };
    }

    case 'document-wave': {
      const p =
        `M ${n(x)} ${n(y)} L ${n(x + w)} ${n(y)} L ${n(x + w)} ${n(y + h * 0.82)} ` +
        `Q ${n(x + w * 0.75)} ${n(y + h * 0.68)} ${n(cx)} ${n(y + h * 0.84)} ` +
        `Q ${n(x + w * 0.25)} ${n(y + h)} ${n(x)} ${n(y + h * 0.86)} Z`;
      return { fillPathSvg: p, solidStrokeSvg: p };
    }

    case 'parallelogram-io': {
      const skew = w * 0.18;
      const p = polygonSvg([
        [x + skew, y],
        [x + w, y],
        [x + w - skew, y + h],
        [x, y + h],
      ]);
      return { fillPathSvg: p, solidStrokeSvg: p };
    }

    case 'brace-left': {
      const midX = x + w * 0.45;
      const stroke =
        `M ${n(x + w * 0.85)} ${n(y)} ` +
        `Q ${n(midX)} ${n(y)} ${n(midX)} ${n(y + h * 0.25)} ` +
        `L ${n(midX)} ${n(cy - h * 0.08)} ` +
        `Q ${n(midX)} ${n(cy)} ${n(x + w * 0.12)} ${n(cy)} ` +
        `Q ${n(midX)} ${n(cy)} ${n(midX)} ${n(cy + h * 0.08)} ` +
        `L ${n(midX)} ${n(y + h * 0.75)} ` +
        `Q ${n(midX)} ${n(y + h)} ${n(x + w * 0.85)} ${n(y + h)}`;
      return { solidStrokeSvg: stroke };
    }

    case 'brace-right': {
      const midX = x + w * 0.55;
      const stroke =
        `M ${n(x + w * 0.15)} ${n(y)} ` +
        `Q ${n(midX)} ${n(y)} ${n(midX)} ${n(y + h * 0.25)} ` +
        `L ${n(midX)} ${n(cy - h * 0.08)} ` +
        `Q ${n(midX)} ${n(cy)} ${n(x + w * 0.88)} ${n(cy)} ` +
        `Q ${n(midX)} ${n(cy)} ${n(midX)} ${n(cy + h * 0.08)} ` +
        `L ${n(midX)} ${n(y + h * 0.75)} ` +
        `Q ${n(midX)} ${n(y + h)} ${n(x + w * 0.15)} ${n(y + h)}`;
      return { solidStrokeSvg: stroke };
    }

    // ---------------------------------------- Category 3: 3D Geometric Solids
    case 'cube':
    case 'cuboid': {
      const dx = w * 0.24;
      const dy = h * 0.22;
      const fx = x;
      const fy = y + dy;
      const fw = w - dx;
      const fh = h - dy;
      const bx = x + dx;
      const by = y;
      const fill = polygonSvg([
        [fx, fy],
        [bx, by],
        [bx + fw, by],
        [bx + fw, by + fh],
        [fx + fw, fy + fh],
        [fx, fy + fh],
      ]);
      const solid =
        polygonSvg([
          [fx, fy],
          [fx + fw, fy],
          [fx + fw, fy + fh],
          [fx, fy + fh],
        ]) +
        ` M ${n(fx)} ${n(fy)} L ${n(bx)} ${n(by)} L ${n(bx + fw)} ${n(by)} L ${n(bx + fw)} ${n(by + fh)} L ${n(fx + fw)} ${n(fy + fh)}` +
        ` M ${n(fx + fw)} ${n(fy)} L ${n(bx + fw)} ${n(by)}`;
      const dashed =
        `M ${n(bx)} ${n(by)} L ${n(bx)} ${n(by + fh)} L ${n(fx)} ${n(fy + fh)}` +
        ` M ${n(bx)} ${n(by + fh)} L ${n(bx + fw)} ${n(by + fh)}`;
      return { fillPathSvg: fill, solidStrokeSvg: solid, dashedStrokeSvg: dashed };
    }

    case 'cylinder': {
      const ry = Math.min(h * 0.16, w * 0.22);
      const rx = w / 2;
      const topY = y + ry;
      const botY = y + h - ry;
      const fill =
        `M ${n(x)} ${n(topY)} ` +
        `A ${n(rx)} ${n(ry)} 0 1 1 ${n(x + w)} ${n(topY)} ` +
        `L ${n(x + w)} ${n(botY)} ` +
        `A ${n(rx)} ${n(ry)} 0 0 1 ${n(x)} ${n(botY)} Z`;
      const solid =
        ellipseSvg(cx, topY, rx, ry) +
        ` M ${n(x)} ${n(topY)} L ${n(x)} ${n(botY)} A ${n(rx)} ${n(ry)} 0 0 0 ${n(x + w)} ${n(botY)} L ${n(x + w)} ${n(topY)}`;
      const dashed = `M ${n(x)} ${n(botY)} A ${n(rx)} ${n(ry)} 0 0 1 ${n(x + w)} ${n(botY)}`;
      return { fillPathSvg: fill, solidStrokeSvg: solid, dashedStrokeSvg: dashed };
    }

    case 'cone': {
      const ry = Math.min(h * 0.16, w * 0.22);
      const rx = w / 2;
      const botY = y + h - ry;
      const fill =
        `M ${n(cx)} ${n(y)} L ${n(x + w)} ${n(botY)} ` +
        `A ${n(rx)} ${n(ry)} 0 0 1 ${n(x)} ${n(botY)} Z`;
      const solid =
        `M ${n(x)} ${n(botY)} L ${n(cx)} ${n(y)} L ${n(x + w)} ${n(botY)} ` +
        `A ${n(rx)} ${n(ry)} 0 0 1 ${n(x)} ${n(botY)}`;
      const dashed = `M ${n(x)} ${n(botY)} A ${n(rx)} ${n(ry)} 0 0 0 ${n(x + w)} ${n(botY)}`;
      return { fillPathSvg: fill, solidStrokeSvg: solid, dashedStrokeSvg: dashed };
    }

    case 'sphere': {
      const rx = w / 2;
      const ry = h / 2;
      const eqRy = ry * 0.34;
      const outer = ellipseSvg(cx, cy, rx, ry);
      const eqFront = `M ${n(x)} ${n(cy)} A ${n(rx)} ${n(eqRy)} 0 0 0 ${n(x + w)} ${n(cy)}`;
      const eqBack = `M ${n(x)} ${n(cy)} A ${n(rx)} ${n(eqRy)} 0 0 1 ${n(x + w)} ${n(cy)}`;
      return {
        fillPathSvg: outer,
        solidStrokeSvg: outer + ' ' + eqFront,
        dashedStrokeSvg: eqBack,
      };
    }

    case 'pyramid-square': {
      const apex: [number, number] = [cx, y];
      const fl: [number, number] = [x, y + h * 0.86];
      const fr: [number, number] = [x + w * 0.72, y + h];
      const br: [number, number] = [x + w, y + h * 0.76];
      const bl: [number, number] = [x + w * 0.28, y + h * 0.64];
      const fill = polygonSvg([apex, br, fr, fl]);
      const solid =
        `M ${n(apex[0])} ${n(apex[1])} L ${n(fl[0])} ${n(fl[1])} L ${n(fr[0])} ${n(fr[1])} L ${n(br[0])} ${n(br[1])} Z` +
        ` M ${n(apex[0])} ${n(apex[1])} L ${n(fr[0])} ${n(fr[1])}`;
      const dashed = `M ${n(apex[0])} ${n(apex[1])} L ${n(bl[0])} ${n(bl[1])} L ${n(fl[0])} ${n(fl[1])} M ${n(bl[0])} ${n(bl[1])} L ${n(br[0])} ${n(br[1])}`;
      return { fillPathSvg: fill, solidStrokeSvg: solid, dashedStrokeSvg: dashed };
    }

    case 'prism-triangular': {
      const fTop: [number, number] = [x + w * 0.28, y + h * 0.22];
      const fLeft: [number, number] = [x, y + h];
      const fRight: [number, number] = [x + w * 0.56, y + h];
      const bTop: [number, number] = [x + w * 0.72, y];
      const bRight: [number, number] = [x + w, y + h * 0.78];
      const bLeft: [number, number] = [x + w * 0.44, y + h * 0.78];
      const fill = polygonSvg([fTop, bTop, bRight, fRight, fLeft]);
      const solid =
        polygonSvg([fTop, fRight, fLeft]) +
        ` M ${n(fTop[0])} ${n(fTop[1])} L ${n(bTop[0])} ${n(bTop[1])} L ${n(bRight[0])} ${n(bRight[1])} L ${n(fRight[0])} ${n(fRight[1])}`;
      const dashed = `M ${n(bTop[0])} ${n(bTop[1])} L ${n(bLeft[0])} ${n(bLeft[1])} L ${n(fLeft[0])} ${n(fLeft[1])} M ${n(bLeft[0])} ${n(bLeft[1])} L ${n(bRight[0])} ${n(bRight[1])}`;
      return { fillPathSvg: fill, solidStrokeSvg: solid, dashedStrokeSvg: dashed };
    }

    case 'tetrahedron': {
      const apex: [number, number] = [cx, y];
      const left: [number, number] = [x, y + h * 0.85];
      const front: [number, number] = [x + w * 0.62, y + h];
      const right: [number, number] = [x + w, y + h * 0.7];
      const fill = polygonSvg([apex, right, front, left]);
      const solid =
        `M ${n(apex[0])} ${n(apex[1])} L ${n(left[0])} ${n(left[1])} L ${n(front[0])} ${n(front[1])} L ${n(right[0])} ${n(right[1])} Z` +
        ` M ${n(apex[0])} ${n(apex[1])} L ${n(front[0])} ${n(front[1])}`;
      const dashed = `M ${n(left[0])} ${n(left[1])} L ${n(right[0])} ${n(right[1])}`;
      return { fillPathSvg: fill, solidStrokeSvg: solid, dashedStrokeSvg: dashed };
    }

    // ---------------------------------------- Category 4: Math Graphs & Diagrams
    case 'axes-2d-four-quadrant': {
      const tick = Math.min(w, h) * 0.035;
      let ticks = '';
      for (let i = 1; i <= 4; i += 1) {
        const dx = (w * 0.38 * i) / 4;
        const dy = (h * 0.38 * i) / 4;
        ticks +=
          ` M ${n(cx + dx)} ${n(cy - tick)} L ${n(cx + dx)} ${n(cy + tick)}` +
          ` M ${n(cx - dx)} ${n(cy - tick)} L ${n(cx - dx)} ${n(cy + tick)}` +
          ` M ${n(cx - tick)} ${n(cy + dy)} L ${n(cx + tick)} ${n(cy + dy)}` +
          ` M ${n(cx - tick)} ${n(cy - dy)} L ${n(cx + tick)} ${n(cy - dy)}`;
      }
      const solid =
        `M ${n(x)} ${n(cy)} L ${n(x + w)} ${n(cy)} ` +
        `M ${n(cx)} ${n(y + h)} L ${n(cx)} ${n(y)}` +
        ticks;
      const arrows =
        arrowHeadAt(x + w, cy, 0, head) +
        ' ' +
        arrowHeadAt(x, cy, Math.PI, head) +
        ' ' +
        arrowHeadAt(cx, y, -Math.PI / 2, head) +
        ' ' +
        arrowHeadAt(cx, y + h, Math.PI / 2, head);
      return { solidStrokeSvg: solid, arrowHeadsSvg: arrows };
    }

    case 'axes-2d-first-quadrant': {
      const ox = x + w * 0.12;
      const oy = y + h * 0.88;
      const tick = Math.min(w, h) * 0.035;
      let ticks = '';
      for (let i = 1; i <= 4; i += 1) {
        const dx = (w * 0.72 * i) / 4;
        const dy = (h * 0.72 * i) / 4;
        ticks +=
          ` M ${n(ox + dx)} ${n(oy - tick)} L ${n(ox + dx)} ${n(oy + tick)}` +
          ` M ${n(ox - tick)} ${n(oy - dy)} L ${n(ox + tick)} ${n(oy - dy)}`;
      }
      const solid = `M ${n(ox)} ${n(y)} L ${n(ox)} ${n(oy)} L ${n(x + w)} ${n(oy)}` + ticks;
      const arrows =
        arrowHeadAt(x + w, oy, 0, head) + ' ' + arrowHeadAt(ox, y, -Math.PI / 2, head);
      return { solidStrokeSvg: solid, arrowHeadsSvg: arrows };
    }

    case 'axes-3d': {
      const ox = x + w * 0.45;
      const oy = y + h * 0.56;
      const solid =
        `M ${n(ox)} ${n(oy)} L ${n(ox)} ${n(y)} ` +
        `M ${n(ox)} ${n(oy)} L ${n(x + w)} ${n(oy)} ` +
        `M ${n(ox)} ${n(oy)} L ${n(x + w * 0.12)} ${n(y + h)}`;
      const zAngle = Math.atan2(y + h - oy, x + w * 0.12 - ox);
      const arrows =
        arrowHeadAt(ox, y, -Math.PI / 2, head) +
        ' ' +
        arrowHeadAt(x + w, oy, 0, head) +
        ' ' +
        arrowHeadAt(x + w * 0.12, y + h, zAngle, head);
      return { solidStrokeSvg: solid, arrowHeadsSvg: arrows };
    }

    case 'number-line': {
      const tick = Math.min(h * 0.25, 10);
      let ticks = '';
      for (let i = 0; i <= 10; i += 1) {
        const tx = x + w * 0.1 + (w * 0.8 * i) / 10;
        const th = i % 5 === 0 ? tick * 1.4 : tick;
        ticks += ` M ${n(tx)} ${n(cy - th)} L ${n(tx)} ${n(cy + th)}`;
      }
      const solid = `M ${n(x)} ${n(cy)} L ${n(x + w)} ${n(cy)}` + ticks;
      const arrows =
        arrowHeadAt(x + w, cy, 0, head) + ' ' + arrowHeadAt(x, cy, Math.PI, head);
      return { solidStrokeSvg: solid, arrowHeadsSvg: arrows };
    }

    case 'unit-circle': {
      const r = Math.min(w, h) * 0.44;
      const circle = ellipseSvg(cx, cy, r, r);
      const axes =
        ` M ${n(x)} ${n(cy)} L ${n(x + w)} ${n(cy)}` +
        ` M ${n(cx)} ${n(y)} L ${n(cx)} ${n(y + h)}`;
      const rays = [30, 45, 60]
        .map((deg) => {
          const rad = (-deg * Math.PI) / 180;
          return `M ${n(cx)} ${n(cy)} L ${n(cx + r * Math.cos(rad))} ${n(cy + r * Math.sin(rad))}`;
        })
        .join(' ');
      return { fillPathSvg: circle, solidStrokeSvg: circle + axes, dashedStrokeSvg: rays };
    }

    case 'venn-2': {
      const r = Math.min(w * 0.31, h * 0.45);
      const c1 = ellipseSvg(x + w * 0.36, cy, r, r);
      const c2 = ellipseSvg(x + w * 0.64, cy, r, r);
      return { fillPathSvg: c1 + ' ' + c2, solidStrokeSvg: c1 + ' ' + c2 };
    }

    case 'venn-3': {
      const r = Math.min(w, h) * 0.28;
      const c1 = ellipseSvg(cx, y + h * 0.36, r, r);
      const c2 = ellipseSvg(x + w * 0.36, y + h * 0.64, r, r);
      const c3 = ellipseSvg(x + w * 0.64, y + h * 0.64, r, r);
      return { fillPathSvg: c1 + ' ' + c2 + ' ' + c3, solidStrokeSvg: c1 + ' ' + c2 + ' ' + c3 };
    }

    case 'fraction-bar': {
      const outer = polygonSvg([
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
      ]);
      const fill = polygonSvg([
        [x, y],
        [x + w * 0.5, y],
        [x + w * 0.5, y + h],
        [x, y + h],
      ]);
      const divs = [1, 2, 3]
        .map((i) => `M ${n(x + (w * i) / 4)} ${n(y)} L ${n(x + (w * i) / 4)} ${n(y + h)}`)
        .join(' ');
      return { fillPathSvg: fill, solidStrokeSvg: outer + ' ' + divs };
    }

    case 'pie-quadrant': {
      const rx = w / 2;
      const ry = h / 2;
      const outer = ellipseSvg(cx, cy, rx, ry);
      const fill =
        `M ${n(cx)} ${n(cy)} L ${n(cx)} ${n(y)} ` +
        `A ${n(rx)} ${n(ry)} 0 0 1 ${n(x + w)} ${n(cy)} Z`;
      const cuts =
        ` M ${n(x)} ${n(cy)} L ${n(x + w)} ${n(cy)}` +
        ` M ${n(cx)} ${n(y)} L ${n(cx)} ${n(y + h)}`;
      return { fillPathSvg: fill, solidStrokeSvg: outer + cuts };
    }

    case 'sine-wave': {
      const steps = 32;
      const pts: string[] = [];
      for (let i = 0; i <= steps; i += 1) {
        const t = i / steps;
        const px = x + w * t;
        const py = cy - Math.sin(t * Math.PI * 2) * (h * 0.42);
        pts.push(`${i === 0 ? 'M' : 'L'} ${n(px)} ${n(py)}`);
      }
      const axis = `M ${n(x)} ${n(cy)} L ${n(x + w)} ${n(cy)}`;
      return { solidStrokeSvg: pts.join(' '), dashedStrokeSvg: axis };
    }

    // ---------------------------------------- Category 5: STEM Stamps
    case 'resistor': {
      const lead = w * 0.18;
      const zigW = (w - lead * 2) / 6;
      const amp = h * 0.35;
      const solid =
        `M ${n(x)} ${n(cy)} L ${n(x + lead)} ${n(cy)} ` +
        `L ${n(x + lead + zigW * 0.5)} ${n(cy - amp)} ` +
        `L ${n(x + lead + zigW * 1.5)} ${n(cy + amp)} ` +
        `L ${n(x + lead + zigW * 2.5)} ${n(cy - amp)} ` +
        `L ${n(x + lead + zigW * 3.5)} ${n(cy + amp)} ` +
        `L ${n(x + lead + zigW * 4.5)} ${n(cy - amp)} ` +
        `L ${n(x + lead + zigW * 5.5)} ${n(cy + amp)} ` +
        `L ${n(x + w - lead)} ${n(cy)} L ${n(x + w)} ${n(cy)}`;
      return { solidStrokeSvg: solid };
    }

    case 'capacitor': {
      const p1 = x + w * 0.42;
      const p2 = x + w * 0.58;
      const solid =
        `M ${n(x)} ${n(cy)} L ${n(p1)} ${n(cy)} ` +
        `M ${n(p1)} ${n(y + h * 0.15)} L ${n(p1)} ${n(y + h * 0.85)} ` +
        `M ${n(p2)} ${n(y + h * 0.15)} L ${n(p2)} ${n(y + h * 0.85)} ` +
        `M ${n(p2)} ${n(cy)} L ${n(x + w)} ${n(cy)}`;
      return { solidStrokeSvg: solid };
    }

    case 'battery': {
      const p1 = x + w * 0.42;
      const p2 = x + w * 0.58;
      const solid =
        `M ${n(x)} ${n(cy)} L ${n(p1)} ${n(cy)} ` +
        `M ${n(p1)} ${n(y + h * 0.12)} L ${n(p1)} ${n(y + h * 0.88)} ` +
        `M ${n(p2)} ${n(y + h * 0.3)} L ${n(p2)} ${n(y + h * 0.7)} ` +
        `M ${n(p2)} ${n(cy)} L ${n(x + w)} ${n(cy)}`;
      return { solidStrokeSvg: solid };
    }

    case 'inductor': {
      const lead = w * 0.15;
      const coilW = (w - lead * 2) / 4;
      let loops = `M ${n(x)} ${n(cy)} L ${n(x + lead)} ${n(cy)}`;
      for (let i = 0; i < 4; i += 1) {
        const sx = x + lead + i * coilW;
        const ex = sx + coilW;
        loops += ` A ${n(coilW / 2)} ${n(h * 0.32)} 0 0 1 ${n(ex)} ${n(cy)}`;
      }
      loops += ` L ${n(x + w)} ${n(cy)}`;
      return { solidStrokeSvg: loops };
    }

    case 'switch-open': {
      const p1 = x + w * 0.3;
      const p2 = x + w * 0.7;
      const r = Math.max(2, Math.min(w, h) * 0.05);
      const solid =
        `M ${n(x)} ${n(cy)} L ${n(p1 - r)} ${n(cy)} ` +
        ellipseSvg(p1, cy, r, r) +
        ` M ${n(p1 + r)} ${n(cy - r * 0.5)} L ${n(p2 - r)} ${n(y + h * 0.18)} ` +
        ellipseSvg(p2, cy, r, r) +
        ` M ${n(p2 + r)} ${n(cy)} L ${n(x + w)} ${n(cy)}`;
      return { solidStrokeSvg: solid };
    }

    case 'bulb': {
      const r = Math.min(w * 0.28, h * 0.38);
      const circle = ellipseSvg(cx, cy, r, r);
      const d = r * 0.68;
      const solid =
        circle +
        ` M ${n(x)} ${n(cy)} L ${n(cx - r)} ${n(cy)}` +
        ` M ${n(cx + r)} ${n(cy)} L ${n(x + w)} ${n(cy)}` +
        ` M ${n(cx - d)} ${n(cy - d)} L ${n(cx + d)} ${n(cy + d)}` +
        ` M ${n(cx - d)} ${n(cy + d)} L ${n(cx + d)} ${n(cy - d)}`;
      return { fillPathSvg: circle, solidStrokeSvg: solid };
    }

    case 'diode': {
      const triLeft = x + w * 0.3;
      const triRight = x + w * 0.68;
      const tri = polygonSvg([
        [triLeft, y + h * 0.2],
        [triRight, cy],
        [triLeft, y + h * 0.8],
      ]);
      const solid =
        tri +
        ` M ${n(x)} ${n(cy)} L ${n(triLeft)} ${n(cy)}` +
        ` M ${n(triRight)} ${n(y + h * 0.2)} L ${n(triRight)} ${n(y + h * 0.8)}` +
        ` M ${n(triRight)} ${n(cy)} L ${n(x + w)} ${n(cy)}`;
      return { fillPathSvg: tri, solidStrokeSvg: solid };
    }

    case 'beaker': {
      const body = polygonSvg([
        [x + w * 0.16, y + h * 0.12],
        [x + w * 0.84, y + h * 0.12],
        [x + w * 0.84, y + h],
        [x + w * 0.16, y + h],
      ]);
      const rim = `M ${n(x + w * 0.08)} ${n(y + h * 0.06)} L ${n(x + w * 0.16)} ${n(y + h * 0.12)} L ${n(x + w * 0.84)} ${n(y + h * 0.12)} L ${n(x + w * 0.9)} ${n(y + h * 0.06)}`;
      const ticks = [0.35, 0.55, 0.75]
        .map((f) => `M ${n(x + w * 0.16)} ${n(y + h * f)} L ${n(x + w * 0.36)} ${n(y + h * f)}`)
        .join(' ');
      return { fillPathSvg: body, solidStrokeSvg: body + ' ' + rim + ' ' + ticks };
    }

    case 'flask': {
      const body = polygonSvg([
        [x + w * 0.38, y + h * 0.08],
        [x + w * 0.62, y + h * 0.08],
        [x + w * 0.62, y + h * 0.34],
        [x + w * 0.92, y + h * 0.92],
        [x + w * 0.85, y + h],
        [x + w * 0.15, y + h],
        [x + w * 0.08, y + h * 0.92],
        [x + w * 0.38, y + h * 0.34],
      ]);
      const rim = `M ${n(x + w * 0.32)} ${n(y + h * 0.08)} L ${n(x + w * 0.68)} ${n(y + h * 0.08)}`;
      return { fillPathSvg: body, solidStrokeSvg: body + ' ' + rim };
    }

    case 'benzene-ring': {
      const outer = regularPolygonSvg(x, y, w, h, 6, -90);
      const r = Math.min(w, h) * 0.27;
      const ring = ellipseSvg(cx, cy, r, r);
      return { fillPathSvg: outer, solidStrokeSvg: outer + ' ' + ring };
    }

    case 'atom-orbital': {
      const rx = w * 0.46;
      const ry = h * 0.18;
      const nuc = ellipseSvg(cx, cy, Math.max(2, Math.min(w, h) * 0.07), Math.max(2, Math.min(w, h) * 0.07));
      const o1 = ellipseSvg(cx, cy, rx, ry);
      const o2 = ellipseSvg(cx, cy, ry, rx);
      // Diagonal orbital
      const o3 =
        `M ${n(cx - w * 0.34)} ${n(cy - h * 0.34)} ` +
        `C ${n(cx - w * 0.1)} ${n(cy - h * 0.44)} ${n(cx + w * 0.44)} ${n(cy + h * 0.1)} ${n(cx + w * 0.34)} ${n(cy + h * 0.34)} ` +
        `C ${n(cx + w * 0.1)} ${n(cy + h * 0.44)} ${n(cx - w * 0.44)} ${n(cy - h * 0.1)} ${n(cx - w * 0.34)} ${n(cy - h * 0.34)} Z`;
      return { fillPathSvg: nuc, solidStrokeSvg: nuc + ' ' + o1 + ' ' + o2 + ' ' + o3 };
    }
  }
}
