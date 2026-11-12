# Phase C — Math Formula Builder, Smart Recognition & Stylus Polish

## Scope and product goal

Phase C introduces intelligent input and mathematical typesetting so teachers, students, and engineers can write equations, convert freehand sketches into crisp objects or text, and write naturally with an Apple Pencil or Samsung S-Pen.

1. **Math Formula Builder (`MathObject` & `MathKeyboardSheet`)** — structured equation editor with a dedicated math keyboard that renders crisp mathematical notation on the Skia canvas.
2. **Smart Shape & Handwriting Recognition (`src/canvas/recognition.ts`)** — hold-to-snap freehand stroke-to-shape/connector recognition (`350 ms` pause at stroke end) plus lasso-selected ink-to-text OCR conversion.
3. **Stylus, S-Pen & Apple Pencil Optimization** — pressure-sensitive variable-width calligraphy/fountain pen strokes and a palm-rejection `Stylus-only drawing` mode.

## 1. Math Formula Builder (`src/canvas/math-model.ts`, `src/components/MathKeyboardSheet.tsx`)

### Data model
Add `MathObject` to `CanvasObject` in `src/canvas/document.ts`:
```ts
export type MathObject = {
  id: string;
  type: 'math';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  /** Structured math expression (LaTeX-subset / AST string, e.g. "\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}"). */
  latex: string;
  /** Plain-text accessible spoken/readable representation. */
  displayText: string;
  colorKey: TextColorKey;
  customColor?: string;
  fontSize: number;
};
```

### Pure Box-Layout & Vector Math Engine (`src/canvas/math-layout.ts`)
- **Zero WebView / Zero External Font Dependency:** Instead of embedding a heavy HTML/KaTeX WebView on the canvas, `layoutMathExpression(latex, baseFontSize)` parses the LaTeX subset into a recursive box tree (`MathBox`) and emits:
  1. `glyphs: readonly { text: string; x: number; y: number; fontSize: number; italic: boolean }[]` (rendered via Skia text/ParagraphBuilder);
  2. `vectorPathsSvg: string` (horizontal fraction vinculum bars, dynamic radical $\sqrt{\phantom{x}}$ hooks with overbars that stretch to the exact width/height of the inner expression, summation $\sum$ / integral $\int$ contours, absolute value bars $|x|$, and matrix brackets $\begin{bmatrix}\cdot\end{bmatrix}$).
- **Supported Math Curriculum Domains:**
  - **Algebra:** Fractions (`\frac{num}{den}`), nested fractions, exponents (`x^{2}`), subscripts (`a_{n}`), radicals (`\sqrt{x}`, `\sqrt[n]{x}`), absolute value, inequalities ($\le, \ge, \neq, \approx$), systems of equations, and quadratic formula.
  - **Trigonometry & Geometry:** $\sin, \cos, \tan, \cot, \sec, \csc$, inverse trig ($\sin^{-1}$), degree/radian symbols ($^\circ, \pi, \theta, \alpha, \beta, \gamma, \Delta, \angle, \perp, \parallel, \cong, \sim$).
  - **Calculus:** Definite & indefinite integrals ($\int_{a}^{b} f(x)\,dx$), derivatives ($\frac{dy}{dx}, \frac{\partial f}{\partial x}, f'(x)$), limits ($\lim_{x \to 0}$), summations ($\sum_{i=1}^{n}$), and products ($\prod$).
  - **Linear Algebra & Vectors:** `2×2` and `3×3` bracketed matrices (`\begin{bmatrix} a & b \\ c & d \end{bmatrix}`), determinant bars, and vector arrows ($\vec{v}$).
  - **Set Theory & Logic:** $\in, \notin, \subset, \subseteq, \cup, \cap, \emptyset, \forall, \exists, \Rightarrow, \Leftrightarrow, \mathbb{R}, \mathbb{Z}, \mathbb{N}$.
- **Math Keyboard Sheet (`src/components/MathKeyboardSheet.tsx`):**
  - Tabbed symbol & template keypad (`Algebra & Fractions`, `Trig & Geometry`, `Calculus & Sums`, `Matrices & Sets`, `Quick Formulas` with 12 ready-to-insert curriculum formulas: Quadratic Formula, Pythagorean Theorem, Law of Cosines, Distance Formula, Slope-Intercept, Compound Interest, Derivative Definition, Fundamental Theorem of Calculus, Gaussian Normal PDF, Binomial Theorem, Euler's Identity, Ohm's/Newton's Laws) with live Skia preview and one-tap `Insert` / `Update` on canvas.

## 2. Smart Shape & Handwriting Recognition (`src/canvas/recognition.ts`)

### Hold-to-Snap Shape Recognition (Ink-to-Shape)
- When drawing with `pen` and the user holds the pointer stationary (`movement < 4pt` for `350 ms`) at the end of a stroke, `classifyInkStroke(points)` runs purely on-device in `< 5 ms`:
  - **Line / Arrow:** high collinearity (`end-to-end distance / path length >= 0.94`) converts into a straight `ShapeObject` (`line`) or `ConnectorObject` (`arrow` if an arrowhead hook is detected).
  - **Ellipse / Circle:** closed loop (`start-to-end distance <= 0.18 * perimeter`) with radial variance below threshold converts into an `ellipse` `ShapeObject`.
  - **Rectangle / Square / Diamond:** closed 4-corner polygon detected via Ramer–Douglas–Peucker (`RDP`) simplification converts into a `rectangle` or `diamond` `ShapeObject`.
  - **Triangle:** closed 3-corner RDP polygon converts into a `triangle-equilateral` / `triangle-right` `ShapeObject`.
- **Undo behavior:** the temporary freehand stroke is replaced by the recognized `ShapeObject` as a single `object.create` command, or pressing `Undo` once reverts back to the raw freehand `InkStroke` so the user never loses their original drawing if they preferred freehand.
- Can be toggled on/off in `InkOptionsSheet` and `Settings` (`Hold to snap shapes`).

### Lasso Ink-to-Text (Handwriting OCR on Canvas)
- In `Select` mode (or a new `Lasso Ink` mode), marquee-selecting freehand `InkStroke`s exposes `Convert to text` in the selection action rail.
- Renders the selected strokes onto an offscreen white Skia surface (`Skia.Surface.MakeOffscreen`) with `24pt` padding, exports a temporary PNG in cache, and passes it to `src/ocr/ocr-service.ts` (`expo-mlkit-ocr`).
- Opens `OcrReviewScreen` with the recognized text so the user can edit before replacing (or placing beside) the handwritten strokes in a single batched undo command.

## 3. Stylus, S-Pen & Apple Pencil Polish (`src/canvas/ink.ts`, `src/settings/preferences-context.tsx`)

### Pressure-sensitive variable-width ink
- Extend `InkPoint` in `src/canvas/ink.ts`:
```ts
export type InkPoint = {
  x: number;
  y: number;
  /** Normalized stylus pressure in [0, 1]; undefined or 0.5 for finger input. */
  pressure?: number;
};
```
- When stylus pressure is present (or simulated via velocity taper when `Pressure sensitivity` is enabled), `buildVariableWidthStrokePath` computes a smooth ribbon outline whose width modulates between `0.45 * width` and `1.45 * width`.
- Backward-compatible: legacy `{ x, y }` points without `pressure` render with uniform stroke width exactly as before.

### Palm rejection (`Stylus-only drawing` preference)
- New boolean preference `stylusOnlyDrawing` in `AppPreferences` (`src/settings/preferences-context.tsx`, default `false`).
- When `stylusOnlyDrawing === true` and an inking tool is active:
  - pointer events with `pointerType === 'stylus'` draw ink;
  - single-finger or palm touches (`pointerType === 'touch'`) are ignored for inking (or pan the viewport cleanly), preventing accidental palm marks on iPad and Android tablets.

## Verification (`scripts/verify-math-recognition-stylus.mts`)

Add `npm run test:math-recognition-stylus` covering:
- Math AST parser and bounding-box layout for fractions, nested roots, superscripts/subscripts, integrals/sums, and Greek symbols, plus SQLite persistence round-trip.
- `classifyInkStroke` accuracy across noisy synthetic hand-drawn lines, circles, rectangles, triangles, and non-geometric scribbles (confirming scribbles are never falsely snapped).
- Variable-width pressure stroke ribbon generation and legacy uniform-width compatibility.
- Palm-rejection gesture filter (`shouldAcceptInkPointer`) for `touch` vs `stylus` pointers under both preference states.
