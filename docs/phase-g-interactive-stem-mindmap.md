# Phase G — Magnetic Mind-Mapping, Live STEM Graphing & Spatial OCR Explode

## Scope and product goal

Phase G adds three market-defining spatial and interactive STEM capabilities that set FlowCanvas apart from static whiteboards (`com.teachingboard.aitricker`, Freeform, Goodnotes):

1. **Magnetic Object Connectors, `+` Quick-Branching & Lasso "Tidy Up"** — connectors attach to object ports (`top`, `right`, `bottom`, `left`) and automatically re-route when objects move; selected sticky notes/shapes expose one-tap `+` quick-branch handles; multi-selections can be auto-aligned into clean grids or rows in one undoable command.
2. **Live Function Plotter (`MathObject` → Curve) & `TableObject` → Chart Generator** — plot algebraic/trigonometric equations directly onto 2D coordinate axes with interactive parameter sliders, and generate vector Bar, Line, or Pie charts from any canvas `TableObject`.
3. **"Explode Photo into Sticky Notes" (Spatial Multi-Note OCR)** — use `expo-mlkit-ocr` block bounding boxes to split a photo of a physical whiteboard or sticky-note wall into individual, movable sticky notes arranged in the same 2D layout on the canvas.

## 1. Magnetic Connectors, Quick-Branching & Auto-Tidy (`src/canvas/connectors.ts`, `src/canvas/auto-layout.ts`)

### Magnetic port binding
Extend `ConnectorObject` in `src/canvas/document.ts` with optional endpoint bindings:
```ts
export type PortSide = 'top' | 'right' | 'bottom' | 'left' | 'center';

export type ConnectorBinding = {
  objectId: string;
  port: PortSide;
};

// On ConnectorObject:
export type ConnectorObject = {
  // ...existing fields
  startBinding?: ConnectorBinding;
  endBinding?: ConnectorBinding;
};
```
- **Snap on drag:** when creating or dragging a connector endpoint within `24` screen points of a shape, sticky note, table, or math object, the endpoint snaps to the nearest port (`top`, `right`, `bottom`, `left`) and records `startBinding` / `endBinding`.
- **Automatic follow:** whenever `applyCommand` processes an `object.update` or `objects.geometry` move/resize/rotate on an object, any connector bound to that `objectId` automatically recomputes its attached endpoint in the same command step so arrows stay glued during movement and undo/redo.
- **1-Tap `+` Quick-Branch:** when a single `sticky` or `shape` object is selected, four small `+` quick-branch pills appear outside its cardinal edges. Tapping `+` creates a new matching sticky note / shape `80` canvas units away in that direction **and** a bound `arrow` `ConnectorObject` linking them in a single batched undo command.

### Lasso "Tidy Up" (`src/canvas/auto-layout.ts`)
- When 3 or more objects are selected in `Select` mode, the selection action rail and tablet inspector expose `Tidy grid`, `Align row`, and `Align column`.
- `computeTidyLayout(objects, mode)` sorts objects by their current reading order (`top-to-bottom, left-to-right`) and computes non-overlapping target `(x, y)` coordinates with uniform `24pt` gaps, committing as a single `objects.geometry` undo entry.

## 2. Live Function Plotter, Key-Point Solver & Table-to-Chart / Stats Generator (`src/canvas/function-plotter.ts`, `src/canvas/chart-generator.ts`)

### Formula-to-Curve Plotter with Key-Point Highlights
- Selecting a `MathObject` containing a single-variable function (e.g., `y = x^2 - 4`, `f(x) = \sin(x)`, `y = a \cdot x + b`) exposes `Plot graph` in the action rail.
- Evaluates the parsed math AST safely across `x ∈ [xMin, xMax]` (`120` sample points, splitting discontinuous branches across vertical asymptotes like `tan(x)` or `1/x`) and places a vector `FunctionPlotObject` on the canvas.
- **Automatic Key-Point Markers (Roots, Intercepts & Extrema):**
  - Automatically detects and highlights on the plotted curve:
    - **Roots / $x$-intercepts** ($y = 0$, solved via sign-change bisection);
    - **$y$-intercept** ($x = 0$);
    - **Local extrema / vertex** ($f'(x) \approx 0$, e.g., parabola vertex $(h, k)$);
    - **Optional Tangent Line preview** at a draggable point $x_0$ showing instantaneous slope $m = f'(x_0)$ for calculus lessons!
- **Interactive parameter sliders:** if the formula includes free parameters (`a`, `b`, `c`, `k`), selecting the plot shows inline sliders (`-5.0` to `+5.0`) so teachers can animate how changing a coefficient transforms the curve and its roots/vertex in real time at 60 FPS.

### 1-Tap Table Statistics & Table-to-Chart (`TableObject` → Stats / Vector Chart)
- Selecting a `TableObject` with numeric cells exposes two smart actions:
  1. **`Generate chart` (`Bar chart`, `Line chart`, `Pie chart`):** extracts labels from column 0 and numeric series from subsequent columns, generating a crisp vector chart object beside the table in one undoable command.
  2. **`Compute column stats` (`Sum`, `Mean`, `Median`, `Min/Max`, `Std Dev`):** appends a summary row or places a statistics summary card beside the table for statistics and data-analysis lessons.

## 3. "Explode Photo into Sticky Notes" (`src/ocr/ocr-explode.ts`, `src/components/OcrReviewScreen.tsx`)

- In `OcrReviewScreen`, when `regionCount >= 2`, expose a secondary smart action: **`Explode into sticky notes (N)`** alongside `Add text to board` and `Add image only`.
- `buildSpatialStickyExplosion(blocks, imagePlacement)`:
  - filters out tiny noise fragments (`text.trim().length < 2`);
  - maps each recognized OCR block's normalized image bounding box `(x, y, width, height)` into non-overlapping canvas coordinates relative to the viewport center;
  - creates one editable `StickyObject` per block (cycling or matching pastel colours) with `sourceImageId` linked back to the source photo, committed as one batched undo step.

## Verification (`scripts/verify-stem-mindmap.mts`)

Add `npm run test:stem-mindmap` covering:
- Port snapping math, automatic connector re-routing when bound objects move/resize/rotate, `+` quick-branch placement, and single-step undo restoration.
- `computeTidyLayout` grid, row, and column alignment without object overlap.
- Safe AST evaluation and curve point sampling for polynomials, trig functions, asymptotes (`1/x`), and parameter slider updates.
- `TableObject` numeric extraction and Bar/Line/Pie vector geometry generation.
- `buildSpatialStickyExplosion` coordinate mapping, overlap resolution, and batched undo/redo.
