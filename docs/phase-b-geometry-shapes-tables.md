# Phase B — Interactive Geometry Box, 45+ 2D/3D Shapes & Table Creator

## Scope and product goal

Phase B equips FlowCanvas with precision drafting instruments, an expanded STEM shape/diagram library, and structured canvas tables, matching and exceeding the geometry and diagramming tools of `com.teachingboard.aitricker`.

1. **Interactive Geometry Box (`Ruler`, `Protractor`, `Compass`, `Set Square`)** — virtual Skia drafting tools that float over the canvas, support pan/rotate/scale gestures, and magnetically snap pen strokes or generate exact geometric arcs.
2. **Expanded 45+ 2D/3D Shape, Graph & STEM Library** — 2D polygons, 3D wireframe/shaded solids, Cartesian coordinate axes, Venn diagrams, and STEM schematic stamps.
3. **Table Creator (`TableObject`)** — first-class canvas table object with configurable rows/columns, column resizing, header styling, and in-place cell text editing.

## 1. Interactive Geometry Box (`src/canvas/geometry-box.ts`, `src/components/GeometryBoxOverlay.tsx`)

### Instruments
Each instrument is stored in ephemeral editor state (`GeometryInstrumentState`) and rendered on a translucent Skia overlay (`rgba(240, 253, 250, 0.88)` light / `rgba(16, 59, 55, 0.88)` dark, `1.5px` `#0D9488` border, crisp tick marks, and a live numeric badge):

1. **Ruler (`ruler`):**
   - Length (`240–600` canvas units), position `(x, y)`, and rotation `angleDeg` (`-180°` to `180°`, with `0°`, `15°`, `30°`, `45°`, `60°`, `90°` soft snap detents).
   - **Edge-snapping ink:** when the active tool is `pen` or `highlighter` and a stroke starts within `28` screen points of the top or bottom ruler edge, all subsequent stroke points are orthogonally projected onto that ruler edge, producing a perfectly straight line at `angleDeg` with a live length readout (`cm` / `px`).
2. **Protractor (`protractor`):**
   - Semicircular (`0°–180°`) or full-circle (`0°–360°`) instrument with degree graduations every `1°`, minor ticks every `5°`, and labeled major ticks every `10°`.
   - Includes two draggable ray handles (`startAngleDeg`, `sweepAngleDeg`) and a `Draw angle` / arc-snap mode that draws a clean angle arc + vertex rays onto the board as a single undoable command.
3. **Compass (`compass`):**
   - Two-point instrument: a fixed **needle pivot** `(cx, cy)` and a draggable **pencil arm** `(radius, angleDeg)`.
   - Dragging the pencil handle sweeps a circular arc (or full `360°` circle) in the current pen colour and width, committing as a vector path or `InkStroke` on release.
4. **Set Square (`set-square-45` and `set-square-30-60`):**
   - `45°–45°–90°` and `30°–60°–90°` right-triangle drafting guides whose three edges all support magnetic pen projection just like the ruler.

### Pure geometry contract (`src/canvas/geometry-box.ts`)
```ts
export type InstrumentKind =
  | 'ruler'
  | 'protractor'
  | 'compass'
  | 'set-square-45'
  | 'set-square-30-60';

export function projectPointToRulerEdge(
  point: Point,
  ruler: RulerState,
  snapDistanceCanvas: number,
): { snappedPoint: Point; edge: 'top' | 'bottom'; distanceAlongEdge: number } | null;

export function buildCompassArcPoints(
  center: Point,
  radius: number,
  startAngleDeg: number,
  endAngleDeg: number,
  steps?: number,
): readonly Point[];
```

## 2. Expanded 52-Shape 2D/3D, Graph & STEM Library (`src/canvas/shapes.ts`)

### Unified Normalized Shape Descriptor Architecture (Key Architectural Improvement)
Instead of hardcoding separate `if/else` drawing branches in `CanvasViewport.tsx` and `src/export/export-service.ts` for every new shape, `src/canvas/shapes.ts` defines a single declarative catalog (`SHAPE_CATALOG: Record<ShapeKind, ShapeCatalogEntry>`) and a pure geometry builder:
```ts
export type ShapeRenderPrimitives = {
  /** Closed SVG path for optional pastel/custom fill (`fillKey`). */
  fillPathSvg?: string;
  /** Primary visible contour SVG path rendered with `strokeWidth`. */
  solidStrokeSvg: string;
  /** Interior hidden depth edges (3D solids) or guide lines rendered with `DashPathEffect([6, 4])`. */
  dashedStrokeSvg?: string;
  /** Filled arrowheads for coordinate axes, vectors, and number lines. */
  arrowHeadsSvg?: string;
  /** Optional measurement labels (side lengths, radius, area, or angles) when `showMeasurements` is enabled. */
  measurementLabels?: readonly { text: string; x: number; y: number }[];
};

export function buildShapeRenderPrimitives(
  kind: ShapeKind,
  x: number,
  y: number,
  width: number,
  height: number,
  direction?: LineDirection,
  showMeasurements?: boolean,
): ShapeRenderPrimitives;
```
- **Zero renderer drift:** Live `CanvasViewport.tsx`, toolbar preview icons, and offscreen `export-service.ts` (`PNG`, `JPEG`, `PDF`) all call `buildShapeRenderPrimitives(...)`, guaranteeing 100% identical rendering across all 52 shapes.
- **Live Geometric Measurement Labels (`showMeasurements?: boolean` on `ShapeObject`):**
  - Toggling `Show measurements` in the shape inspector displays live side lengths ($a, b, c$), radius/diameter ($r, d$), hypotenuse, or interior angles ($90^\circ, 60^\circ, 45^\circ$) directly on triangles, rectangles, ellipses/circles, and polygons for geometry lessons.

### Complete 52-Shape Catalog (`ShapeKind` across 5 Categories)
All 52 shapes remain 100% backward-compatible with existing `'rectangle' | 'ellipse' | 'line'`:

1. **Category 1 — Basic & 2D Polygons (16 shapes):**
   - `rectangle`, `rounded-rectangle`, `ellipse`, `line`, `triangle-equilateral`, `triangle-right`, `triangle-isosceles`, `triangle-obtuse`, `diamond` (rhombus), `parallelogram`, `trapezoid`, `kite`, `pentagon`, `hexagon`, `octagon`, `star-5`.
2. **Category 2 — Callouts, Symbols & Flowcharts (8 shapes):**
   - `cross`, `callout-bubble`, `cloud`, `cylinder-db`, `document-wave`, `parallelogram-io`, `brace-left`, `brace-right`.
3. **Category 3 — 3D Geometric Solids with Dashed Hidden Depth Edges (8 shapes):**
   - `cube`, `cuboid`, `cylinder`, `cone`, `sphere` (with dashed equatorial ellipse), `pyramid-square`, `prism-triangular`, `tetrahedron` (with dashed internal altitude/base edges).
4. **Category 4 — Math Graphs, Coordinate Systems & Set Diagrams (10 shapes):**
   - `axes-2d-four-quadrant` ($x, y$ with arrows & tick marks), `axes-2d-first-quadrant` ($x \ge 0, y \ge 0$), `axes-3d` ($x, y, z$ isometric axes), `number-line` (with dual arrowheads and 11 graduation ticks), `unit-circle` (circle with quadrant axes and $30^\circ/45^\circ/60^\circ$ reference rays), `venn-2` (2 overlapping sets), `venn-3` (3 overlapping sets), `fraction-bar`, `pie-quadrant` (fraction circle), `sine-wave` (one full $2\pi$ period reference curve).
5. **Category 5 — STEM Schematic Stamps (10 shapes):**
   - **Physics & Circuits:** `resistor` (zigzag IEEE symbol), `capacitor` (parallel plates), `battery` (long/short cells), `inductor` (coil loops), `switch-open`, `bulb`, `diode`.
   - **Chemistry & Science:** `beaker` (with graduation ticks), `flask` (Erlenmeyer cone), `benzene-ring` (hexagon with aromatic ring), `atom-orbital`.

## 3. Table Creator (`TableObject` in `src/canvas/document.ts`)

### Data model
Add `TableObject` to the `CanvasObject` union in `src/canvas/document.ts`:
```ts
export type TableCell = {
  text: string;
  align?: 'left' | 'center' | 'right';
};

export type TableObject = {
  id: string;
  type: 'table';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  rows: number;
  columns: number;
  /** Normalized column width ratios summing to 1.0 (e.g. [0.33, 0.33, 0.34]). */
  columnRatios: readonly number[];
  /** Row-major cell matrix of length `rows * columns`. */
  cells: readonly TableCell[];
  hasHeaderRow: boolean;
  colorKey: TextColorKey;
  customColor?: string;
  fillHeader: boolean;
  fontSize: number;
};
```

### Interaction rules
- Created from `QuickCreationSheet` (`Insert` -> `Table` with quick size presets `2×2`, `3×3`, `4×3`, `4×4` or custom rows/columns up to `12×8`).
- Rendered in Skia with outer rounded frame, header fill tint (12% opacity of border colour when `hasHeaderRow && fillHeader`), internal grid lines, and cell text wrapped to each column's width.
- **In-place cell editing:** tapping a cell on a selected table computes `{ row, col }` in the table's unrotated local frame and positions the scaled `TextInput` overlay directly over that cell. `Tab` / `Next` advances to the next cell.
- **Contextual actions:** selecting a table exposes `+ Row`, `- Row`, `+ Col`, `- Col`, `Header toggle`, `Style`, `Duplicate`, and `Delete` in the selection action rail / tablet inspector. Every structural or cell edit is a single undoable `object.update` command.

## Verification (`scripts/verify-geometry-shapes-tables.mts`)

Add `npm run test:geometry-shapes-tables` covering:
- Ruler and Set Square edge projection math, snap thresholds, and angle snapping.
- Protractor angle sweep math and Compass arc point generation.
- Path generation and bounding-box hit testing for all 45+ `ShapeKind` primitives (2D, 3D solids, axes, Venn, STEM).
- `TableObject` creation, cell hit testing `(x, y) -> (row, col)` under rotation, adding/removing rows and columns while preserving existing cell data, undo/redo, SQLite persistence round-trip, and offscreen export rendering.
