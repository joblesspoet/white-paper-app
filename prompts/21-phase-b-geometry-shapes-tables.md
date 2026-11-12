# Session 21 — Phase B: Interactive Geometry Box, 2D/3D Shapes & Table Creator

Read `README.md`, `docs/task-status.md`, `docs/agent-workflow.md`, `docs/phase-b-geometry-shapes-tables.md`, `docs/screen-architecture.md`, and `design/component-handoff.md`. Inspect `src/canvas/shapes.ts`, `src/canvas/document.ts`, `src/canvas/selection.ts`, `src/components/CanvasViewport.tsx`, and `src/components/QuickCreationSheet.tsx` before making changes.

Implement only Phase B:
1. **Interactive Geometry Box (`src/canvas/geometry-box.ts`, `src/components/GeometryBoxOverlay.tsx`):** Skia overlay instruments for **Ruler**, **Protractor**, **Compass**, and **Set Square (`45°` & `30°–60°`)** with pan/rotate handles, live degree and length readouts, magnetic pen edge projection for straight measured lines along Ruler/Set Square edges, and Protractor/Compass arc generation into undoable canvas strokes/shapes.
2. **Expanded 52-Shape 2D/3D, Graph & STEM Library (`src/canvas/shapes.ts`):** implement the unified declarative `SHAPE_CATALOG` and `buildShapeRenderPrimitives(kind, x, y, width, height, direction, showMeasurements)` returning `fillPathSvg`, `solidStrokeSvg`, `dashedStrokeSvg`, `arrowHeadsSvg`, and optional `measurementLabels` (live side lengths, radius, or interior angles when `showMeasurements` is enabled). Support all 52 shapes across 5 categories:
   - Basic & 2D Polygons (16): `rectangle`, `rounded-rectangle`, `ellipse`, `line`, `triangle-equilateral`, `triangle-right`, `triangle-isosceles`, `triangle-obtuse`, `diamond`, `parallelogram`, `trapezoid`, `kite`, `pentagon`, `hexagon`, `octagon`, `star-5`.
   - Callouts & Flowchart (8): `cross`, `callout-bubble`, `cloud`, `cylinder-db`, `document-wave`, `parallelogram-io`, `brace-left`, `brace-right`.
   - 3D Solids with dashed hidden edges (8): `cube`, `cuboid`, `cylinder`, `cone`, `sphere`, `pyramid-square`, `prism-triangular`, `tetrahedron`.
   - Math Graphs & Diagrams (10): `axes-2d-four-quadrant`, `axes-2d-first-quadrant`, `axes-3d`, `number-line`, `unit-circle`, `venn-2`, `venn-3`, `fraction-bar`, `pie-quadrant`, `sine-wave`.
   - STEM Stamps (10): `resistor`, `capacitor`, `battery`, `inductor`, `switch-open`, `bulb`, `diode`, `beaker`, `flask`, `benzene-ring`, `atom-orbital`.
   Share `buildShapeRenderPrimitives` across `CanvasViewport.tsx`, picker icons, and `src/export/export-service.ts`.
3. **Table Creator (`TableObject` in `src/canvas/document.ts`):** add `TableObject` (`rows`, `columns`, `columnRatios`, `cells`, `hasHeaderRow`, `fillHeader`, `fontSize`), Skia rendering, rotation-aware cell hit testing, in-place cell `TextInput` editing, row/column add/remove actions in the selection rail and tablet inspector, SQLite persistence, and offscreen export rendering.

Add `scripts/verify-geometry-shapes-tables.mts` and wire `npm run test:geometry-shapes-tables` into `npm test`. Run `npm run typecheck`, `npm test`, and bundle checks. Update `docs/task-status.md`; next task is Session 22 — Phase C: Math Formula Builder, Smart Recognition & Stylus Polish.
