# Component handoff

Generated from the approved FlowCanvas Stitch project `projects/18433233690962903854`.

This is a React Native implementation handoff. Stitch HTML/code is visual reference only and must not be copied directly.

## Home / Boards

### Screen references
- Empty: `bec7935657a04f688e3281a6fad4bf74`
- Populated: `f82ebe4e87d74e8eaa7ba1365ef412de`
- Loading: `5fa13f8a14d548aead4745f138cc3ed6`
- Corrupt board: `91b5f9d2bc33477caea95e347a36045a`
- Delete confirmation: `31da4656c79d411b8912a28619fd54b4`
- Tablet portrait: `313802e9738e4fd69e28ce140ad18fb5`
- Tablet landscape: `88eec8edb10c4976ad5b03688ce67e82`
- Tablet dark: `6d03484958124f1098a389d5098157d3`

## Component hierarchy

- `HomeScreen`
  - `HomeHeader`
    - `HomeWordmark`
    - `SearchField` (only when board count exceeds five)
    - `IconButton` settings action
  - `NewBoardButton`
  - `BoardGrid`
    - `BoardCard`
      - `BoardThumbnail`
      - title and relative modified time
      - overflow `IconButton`
  - `EmptyBoardsState` for first launch
  - `BoardGridSkeleton` for local loading
  - `CorruptBoardCard` for recovery failure
  - `DeleteBoardDialog` for destructive confirmation

## React Native implementation guidance

- Use `FlatList` with a responsive `numColumns`: 2 on phones, 4 on portrait tablets.
- Use `useWindowDimensions()` for breakpoints and gutters; tablet cards should not stretch phone compositions.
- Use semantic tokens from `src/theme.ts`; preserve the flat design with borders and color shifts, not shadows or gradients.
- All interactive controls require at least a 44pt hit area and accessibility labels.
- Use the existing local SVG icon family in `src/components/icons.tsx`; never use emoji icons.
- Keep Home local-only. No authentication, cloud sync, collaboration, AI, or subscription behavior.

## Data contract

```ts
type BoardSummary = {
  id: string;
  title: string;
  thumbnailUri?: string;
  updatedAt: string;
  objectCount: number;
};
```

## States required for the Home slice

- First launch / empty
- Populated board grid
- Loading local data
- Corrupt-board recovery
- Delete confirmation
- Search/no-results refinement remains an implementation gap noted in `design/stitch-notes.md`.

---

## Smart Teaching & Differentiation Component Handoff (Phases A–F)

### Phase A — Teaching Utilities (`docs/phase-a-teaching-utilities.md`)
- `FloatingTimer` (`src/components/FloatingTimer.tsx`): draggable card (`220pt` expanded, `104×40pt` minimized pill), `1px` `--color-border`, countdown presets (`1m`, `3m`, `5m`, `10m`, `15m`), stopwatch toggle, and `Pin to board` action.
- `FloatingCalculator` (`src/components/FloatingCalculator.tsx`): draggable card (`268pt` standard / `320pt` scientific), `44×44pt` keypad buttons, `DEG`/`RAD` toggle, and primary `Paste to board` button.
- `LaserTrailLayer` (`src/canvas/laser.ts`, `src/components/CanvasViewport.tsx`): ephemeral Skia strokes that decay over `1200 ms` with zero history mutations.

### Phase B — Geometry Box, 45+ Shapes & Tables (`docs/phase-b-geometry-shapes-tables.md`)
- `GeometryBoxOverlay` (`src/components/GeometryBoxOverlay.tsx`): Skia-rendered `Ruler`, `Protractor`, `Compass`, and `Set Square` with `44×44pt` move/rotate/arc handles and magnetic edge projection.
- `TableObjectView` & `TableActionRail` (`src/canvas/document.ts`, `src/components/CanvasViewport.tsx`): Skia table grid with optional teal header fill, rotation-aware cell hit testing, and `+ Row` / `- Row` / `+ Col` / `- Col` actions.

### Phase C — Math Formula Builder, Smart Recognition & Stylus (`docs/phase-c-math-recognition-stylus.md`)
- `MathKeyboardSheet` (`src/components/MathKeyboardSheet.tsx`): bottom sheet on phones, `480pt` centered modal / popover on tablets, with live Skia `MathObjectView` preview and structured symbol tabs.

### Phase D — Multi-Page & PDF Annotation (`docs/phase-d-multipage-pdf-annotation.md`)
- `PageNavigator` & `PageSorterSheet` (`src/components/PageNavigator.tsx`): top-right `< Page X / N > +` pill (`44pt` targets) and slide-up page management sheet.

### Phase E — Lesson Recorder & Face-Cam (`docs/phase-e-lesson-recorder-facecam.md`)
- `FaceCamBubble` (`src/components/FaceCamBubble.tsx`): corner-snapping PiP camera (`88pt`/`124pt`/`164pt`) with `2px` `--color-primary` border.
- `LessonRecorderBar` (`src/components/LessonRecorderBar.tsx`): top-center HUD (`Rec ● MM:SS`, `Pause`, `Stop`) and `LessonReplayModal`.

### Phase F — Live Classroom (`docs/phase-f-live-classroom.md`)
- `LiveClassHostSheet` (`src/components/LiveClassHostSheet.tsx`): 6-digit code display, SVG QR code, student roster with `👋` hand-raise queue, `Allow to draw` toggle, `Student Boards Gallery`, and `Lock class`.
- `JoinClassModal` (`src/components/JoinClassModal.tsx`): zero-account student join modal on Home (`6-digit code` + `Display name`).
