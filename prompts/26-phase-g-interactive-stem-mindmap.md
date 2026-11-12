# Session 26 — Phase G: Magnetic Mind-Mapping, Live STEM Graphing & Spatial OCR Explode

Read `README.md`, `docs/task-status.md`, `docs/agent-workflow.md`, `docs/phase-g-interactive-stem-mindmap.md`, and `docs/screen-architecture.md`. Inspect `src/canvas/document.ts`, `src/canvas/shapes.ts`, `src/canvas/selection.ts`, and `src/ocr/ocr-placement.ts` before making changes.

Implement only Phase G:
1. **Magnetic Object Connectors, `+` Quick-Branching & Lasso "Tidy Up" (`src/canvas/connectors.ts`, `src/canvas/auto-layout.ts`):**
   - Add optional `startBinding` and `endBinding` (`{ objectId, port }`) to `ConnectorObject` so connectors snap to object ports (`top`, `right`, `bottom`, `left`) and automatically re-route whenever bound objects move, resize, or rotate.
   - Show cardinal `+` quick-branch handles on a single selected sticky note or shape to spawn a connected child object in one tap and one undo step.
   - Add `Tidy grid`, `Align row`, and `Align column` actions for 3+ selected objects in the selection rail and tablet inspector.
2. **Live Function Plotter, Key-Point Solver & Table-to-Chart / Stats Generator (`src/canvas/function-plotter.ts`, `src/canvas/chart-generator.ts`):**
   - Allow plotting single-variable `MathObject` equations onto 2D coordinate axes with interactive parameter sliders (`a`, `b`, `c`, `k`), automatic key-point detection (**roots / $x$-intercepts, $y$-intercept, local extrema / vertex**, and optional **calculus tangent-line slope preview**).
   - Allow generating a vector Bar, Line, or Pie chart AND one-tap column summary statistics (`Sum`, `Mean`, `Median`, `Min/Max`, `Std Dev`) directly from a numeric `TableObject`.
3. **"Explode Photo into Sticky Notes" (`src/ocr/ocr-explode.ts`, `src/components/OcrReviewScreen.tsx`):**
   - Add `Explode into sticky notes (N)` to `OcrReviewScreen` when multiple text regions are recognized, mapping each OCR block's bounding box into a separate movable `StickyObject` in the same 2D spatial layout in one batched undo command.

Add `scripts/verify-stem-mindmap.mts` and wire `npm run test:stem-mindmap` into `npm test`. Run `npm run typecheck`, `npm test`, and bundle checks. Update `docs/task-status.md`; next task is Session 27 — Phase H: Active Recall Reveal Tape, Voice Pins & Presenter Teleprompter Layer.
