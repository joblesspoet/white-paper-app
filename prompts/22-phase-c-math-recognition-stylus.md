# Session 22 — Phase C: Math Formula Builder, Smart Recognition & Stylus Polish

Read `README.md`, `docs/task-status.md`, `docs/agent-workflow.md`, `docs/phase-c-math-recognition-stylus.md`, `docs/screen-architecture.md`, and `design/flows.md`. Inspect `src/canvas/ink.ts`, `src/canvas/document.ts`, `src/ocr/ocr-service.ts`, and `src/settings/preferences-context.tsx` before making changes.

Implement only Phase C:
1. **Math Formula Builder (`src/canvas/math-model.ts`, `src/canvas/math-layout.ts`, `src/components/MathKeyboardSheet.tsx`):** add `MathObject` to `CanvasObject` with a pure recursive box-layout and vector path engine (`layoutMathExpression` emitting positioned Skia glyphs + SVG vector paths for fraction vinculum bars, dynamic $\sqrt{\phantom{x}}$ hooks, $\sum$/$\int$ contours, $|x|$ bars, and $2\times 2$/$3\times 3$ matrix brackets—zero WebView). Support 5 curriculum domains (Algebra, Trig/Geometry, Calculus, Linear Algebra/Matrices, Set Theory/Logic) and 12 one-tap curriculum formula templates in `MathKeyboardSheet`. Render cleanly on the Skia canvas and offscreen export, and allow re-editing on tap.
2. **Smart Shape & Handwriting Recognition (`src/canvas/recognition.ts`):**
   - **Hold-to-snap shape recognition:** holding the pointer stationary for `350 ms` at the end of a pen stroke classifies lines, arrows, ellipses/circles, rectangles, diamonds, and triangles and converts the stroke into a vector `ShapeObject`/`ConnectorObject` with undo preservation.
   - **Lasso ink-to-text OCR:** allow selecting freehand ink strokes, rendering their bounds offscreen via Skia, and feeding them through `src/ocr/ocr-service.ts` + `OcrReviewScreen` to convert handwritten board ink into an editable `TextObject`.
3. **Stylus, S-Pen & Apple Pencil optimization (`src/canvas/ink.ts`, `src/settings/preferences-context.tsx`):** add optional per-point `pressure` for variable-width tapered strokes, plus a `stylusOnlyDrawing` (palm rejection) preference in Settings and `InkingQuickTray` that restricts inking to `stylus` pointers while finger touches only pan/zoom.

Add `scripts/verify-math-recognition-stylus.mts` and wire `npm run test:math-recognition-stylus` into `npm test`. Run `npm run typecheck`, `npm test`, and bundle checks. Update `docs/task-status.md`; next task is Session 23 — Phase D: Multi-Page Boards & Multi-Page PDF Annotation.
