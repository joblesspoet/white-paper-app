# Session 20 — Phase A: Smart Teaching & Presentation Utilities

Read `README.md`, `docs/task-status.md`, `docs/agent-workflow.md`, `docs/phase-a-teaching-utilities.md`, `docs/screen-architecture.md`, and `design/flows.md`. Inspect the editor, ink tray, quick creation sheet, canvas viewport, and export service before making changes.

Implement only Phase A:
1. **Laser pointer tool (`laser`):** add `src/canvas/laser.ts` and integrate `laser` into `InkingQuickTray`, tablet `ToolRail`, and `CanvasViewport` with a glowing dual-layer Skia stroke trail that decays over `1200 ms` after release without writing to `CanvasDocument.strokes`, undo history, or SQLite.
2. **Teaching canvas backgrounds (`grid`, `ruled`, `isometric`):** extend `BoardStyle` in `src/persistence/schema.ts` and render math square grid (`24pt` minor / `120pt` major), ruled notebook lines (`32pt`), and isometric `60°` lattice in both `CanvasViewport.tsx` and offscreen `src/export/export-service.ts`. Expose all 5 styles in board customisation and Settings.
3. **Floating classroom timer & stopwatch (`src/timer/timer-model.ts`, `src/components/FloatingTimer.tsx`):** draggable/minimizable countdown and stopwatch card with presets (`1m`, `3m`, `5m`, `10m`, `15m`), `+1m`/`-30s` steppers, haptic completion state, and `Pin to board` (inserts a canvas text/sticky summary in one undoable command).
4. **Floating scientific calculator (`src/calculator/calculator-engine.ts`, `src/components/FloatingCalculator.tsx`):** deterministic expression evaluator (no `eval()`) with standard + scientific operations (`sin`, `cos`, `tan` with `DEG`/`RAD`, `√`, `x²`, `xʸ`, `log`, `ln`, `π`, `e`) and `Paste to board` that creates a canvas object with `<expression> = <result>` in one undoable command.

Add `scripts/verify-teaching-utilities.mts` and wire `npm run test:teaching-utilities` into `npm test`. Run `npm run typecheck`, `npm test`, and bundle checks. Update `docs/task-status.md`; next task is Session 21 — Phase B: Interactive Geometry Box, 2D/3D Shapes & Table Creator.
