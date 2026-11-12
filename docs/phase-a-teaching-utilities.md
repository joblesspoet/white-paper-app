# Phase A — Smart Teaching & Presentation Utilities

## Scope and product goal

Phase A turns the FlowCanvas editor into an active teaching and presentation workspace without requiring a backend, account, or database schema breaking change. It adds four cohesive utilities inspired by smart classroom boards (`com.teachingboard.aitricker`):

1. **Laser pointer tool (`laser`)** — ephemeral, high-visibility pointer and stroke trail for guiding attention during explanations without leaving permanent marks or polluting undo/redo history.
2. **Expanded teaching canvas backgrounds (`grid`, `ruled`, `isometric`)** — math graph paper, lined notebook paper, and 3D isometric dot/line grids alongside existing `blank` and `dots` styles.
3. **Floating classroom timer & stopwatch (`FloatingTimer`)** — draggable, non-blocking countdown timer and stopwatch with presets, visual progress, haptic/visual completion state, and optional `Pin snapshot to board`.
4. **Floating scientific calculator (`FloatingCalculator`)** — draggable standard and scientific calculator with expression preview and one-tap `Paste to board` that inserts the calculation as a styled canvas text or sticky object.

## 1. Laser pointer (`src/canvas/ink.ts`, `src/components/CanvasViewport.tsx`)

### Interaction contract
- Selected from the Inking Quick Tray (`Draw` anchor on phones) or the left `ToolRail` on tablets alongside `pen`, `highlighter`, and `eraser`.
- Drawing with `laser` captures pointer points in canvas coordinates and renders a dual-layer Skia path:
  - outer halo: `strokeWidth = 10`, opacity `0.28`, colour `#EF4444` (or user-selected laser preset: Red `#EF4444`, Neon Teal `#14B8A6`, Solar Amber `#F59E0B`);
  - inner core: `strokeWidth = 3.5`, opacity `0.95`, white-tinted core `#FCA5A5` / `#FFFFFF`.
- **Decay lifecycle:** each laser stroke records `createdAtMs` and `releasedAtMs`. Once released (or per point sample after `700 ms`), opacity decays linearly over `1200 ms` until `0`, at which point the stroke is removed from ephemeral state.
- **Zero history / zero persistence footprint:** laser strokes never enter `CanvasDocument.strokes`, never trigger SQLite autosave, and never push to `History`. Two-finger pan/zoom remains active while the laser tool is armed.

### Pure model (`src/canvas/laser.ts`)
```ts
export type LaserColorKey = 'red' | 'teal' | 'amber';

export type LaserPoint = {
  x: number;
  y: number;
  timestampMs: number;
};

export type EphemeralLaserStroke = {
  id: string;
  colorKey: LaserColorKey;
  points: readonly LaserPoint[];
  releasedAtMs: number | null;
};

export const LASER_DECAY_MS = 1200;
export const LASER_HOLD_MS = 350;

export function laserStrokeOpacity(stroke: EphemeralLaserStroke, nowMs: number): number;
export function pruneExpiredLaserStrokes(
  strokes: readonly EphemeralLaserStroke[],
  nowMs: number,
): readonly EphemeralLaserStroke[];
```

## 2. Teaching canvas backgrounds (`src/persistence/schema.ts`, `src/components/CanvasViewport.tsx`)

### Data model
Extend `BoardStyle` in `src/persistence/schema.ts`:
```ts
export type BoardStyle = 'blank' | 'dots' | 'grid' | 'ruled' | 'isometric';
```
- Backward-compatible: existing boards with `'blank'` or `'dots'` load unchanged; unknown strings still fall back safely to `'blank'`.
- Rendered in Skia inside `CanvasViewport.tsx` (and in `src/export/export-service.ts` so PNG/JPEG/PDF exports match the live canvas):
  - `blank`: solid theme canvas background (`#F0FDFA` light / `#0B2B28` dark).
  - `dots`: existing `24pt` world-space dot lattice.
  - `grid`: `24pt` minor square grid lines (`1px`, 12% foreground opacity) with `120pt` (`5×5`) major axis subdivisions (`1.25px`, 22% foreground opacity) for math and engineering graphs.
  - `ruled`: horizontal notebook lines spaced `32pt` apart in canvas units with an optional subtle vertical margin line.
  - `isometric`: `60°` equilateral triangular dot/line lattice (`28pt` spacing) for 3D geometry and architecture sketches.
- Selectable in Home's `Customize your board` sheet, Editor overflow `Board settings`, and App `Settings` (`Default canvas texture`).

## 3. Floating classroom timer & stopwatch (`src/timer/timer-model.ts`, `src/components/FloatingTimer.tsx`)

### Capabilities
- Accessible from a new `Utilities` section in `QuickCreationSheet` (phone) and a dedicated utility button in the `ToolRail` / top bar (tablet).
- Modes:
  - **Countdown timer:** quick presets (`1m`, `3m`, `5m`, `10m`, `15m`) plus `+1m` / `-30s` steppers while paused or running.
  - **Stopwatch:** counts up from `00:00` with lap/reset controls.
- **Draggable & collapsible:**
  - Full card (`220pt` wide) shows `MM:SS`, mode toggle, progress bar, `Start/Pause`, `Reset`, `Pin to board`, and `Minimize`.
  - Minimized pill (`104×40pt`) docks cleanly inside safe-area bounds so it never blocks drawing.
- **Completion state:** when countdown reaches `00:00`, the border pulses with `--color-accent` (`#EA580C`), fires haptic notification (`src/utils/haptics.ts`), and displays `Time's up!`.
- **Pin to board:** inserts a formatted sticky note or text card (e.g., `Timer: 05:00 — Group Activity`) at the current viewport center as a single undoable command.

## 4. Floating scientific calculator (`src/calculator/calculator-engine.ts`, `src/components/FloatingCalculator.tsx`)

### Capabilities
- Pure, deterministic expression evaluator (`src/calculator/calculator-engine.ts`) with **no `eval()`**:
  - Standard operations: `+`, `-`, `×`, `÷`, `%`, parentheses `( )`, decimal, `±`, `C`, `⌫`, `ANS`.
  - Scientific operations: `sin`, `cos`, `tan` (with `DEG`/`RAD` toggle), `√`, `x²`, `xʸ`, `log`, `ln`, `π`, `e`, `1/x`, `!`.
  - Explicit error states (`Division by zero`, `Invalid expression`, `Overflow`) that never throw or crash.
- **Paste to board:**
  - Tapping `Paste to board` creates a new `TextObject` (or `StickyObject`) at the current viewport center containing `<expression> = <result>` (for example `sin(30°) × 12 = 6`) in one undoable command.
- **Responsive layout:**
  - Draggable floating card (`268pt` wide on phone portrait, `320pt` in scientific mode or on tablet) clamped within canvas safe-area bounds.

## Verification (`scripts/verify-teaching-utilities.mts`)

Add `npm run test:teaching-utilities` covering:
- Laser stroke opacity decay math, hold-to-fade timing, and expired stroke pruning.
- `BoardStyle` parser and SQLite round-trip for `blank`, `dots`, `grid`, `ruled`, and `isometric`, plus offscreen export background parity.
- Timer state machine: preset initialization, countdown tick accuracy, pause/resume, time adjustment clamping, completion transition at `0`, stopwatch count-up, and `Pin to board` command generation.
- Calculator engine: operator precedence (`2 + 3 × 4 = 14`), parentheses, trigonometric `DEG` vs `RAD`, square root, exponents, division-by-zero error handling, and `Paste to board` canvas object creation and undo/redo.
