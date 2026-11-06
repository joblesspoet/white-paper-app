# Task status

## Current phase
Undo and redo.

## Status
`implemented` — undo/redo is now command-based. Each board mutation is a create, update, delete, or batched command that knows how to apply and revert itself; the history stores commands instead of document snapshots. The undo and redo stacks are bounded at 100 entries, a new edit clears redo, and empty gestures record nothing. Toolbar undo/redo use arrow-return SVG icons with disabled states, action labels, and accessibility hints. Pen, text, and the shared shape palette expose the same 16 presets, sticky notes expose 15 pastels, and every tool now has a full-spectrum custom colour picker for anything the presets miss. The text and sticky-note slice already present in this tree continues to use the same chronological history. Typecheck, the pure-logic checks, and the iOS bundle pass; touch interaction could not be exercised in this environment (see Verification).

## Completed slices
- Expo Router stack with Home, Editor, and Settings routes.
- Editor native header replaced with an in-app safe-area top bar.
- Editable board title field, back navigation, undo/redo controls, and overflow affordance.
- Responsive phone floating bottom tool dock and tablet vertical tool rail.
- Canvas viewport: pure viewport model in `src/canvas/viewport.ts` with 0.5×–4× zoom, focal-point anchoring, and a `Reset view` action.
- Pen, highlighter, eraser, and a compact ink options sheet.
- Full shared colour palette (`src/canvas/document.ts`):
  - 16 high-contrast light/dark preset colours used by pen, text, and the shape palette;
  - 15 sticky-note pastels;
  - every text, pen, and sticky pairing is asserted at 4.5:1 or better;
  - pen colour follows the active theme and remaps when the theme changes;
  - a `+` swatch opens the inline HSV picker (`src/components/ColorPicker.tsx`) for any colour outside the presets;
  - custom colours are stored as `#rrggbb` and are never theme-remapped;
  - custom note fills automatically switch between deep-teal and white ink for legibility;
  - the picker warns when a custom text/pen colour falls below 4.5:1 on the canvas.
- Command-based undo/redo (`src/canvas/history.ts`, `src/canvas/document.ts`):
  - create, update, delete, and batch command types;
  - undo and redo stacks, bounded to 100 entries;
  - a new edit clears the redo stack;
  - ink add and erase commands capture their own inverse data;
  - an eraser sweep and an object drag collapse into one undo entry;
  - consecutive drag samples coalesce into one move command;
  - no-op commands and gestures that end where they started add no entry;
  - toolbar undo/redo use SVG icons, disabled states, and command-aware accessibility hints.
- Text and sticky-note canvas objects in `src/canvas/document.ts`:
  - tap-to-create centred on the tapped canvas point;
  - in-place `TextInput` overlay scaled with the viewport, so editing happens where the object is;
  - one commit path for `Done`, outside tap, tool change, title field, back, and blur;
  - empty objects are discarded instead of committed (an existing object whose text is cleared is deleted, undoably);
  - text colour (light/dark variants) and text size, sticky pastels with `#134E4A` note text;
  - Select mode: touch selects, drag moves with the grab offset preserved, a tap on the selected object enters editing, and a selection bar offers `Edit` and `Delete`;
  - the viewport pans (never zooms) when the keyboard appears so the edited object stays above the keyboard and the style sheet.
- Interactive controls use accessibility labels and 44pt minimum targets.

## Files changed
- `src/canvas/history.ts` — command-based undo/redo: create/update/delete/batch entries, transient gesture batching and move coalescing, bounded stacks, redo clearing, stack predicates, and next-action labels.
- `src/canvas/document.ts` — `prepareDocumentCommand` builds inverse commands for ink add/erase and object insert/update/move/delete; `documentsEqual` discards net-zero gestures; the shared canvas palette and expanded sticky pastels live here.
- `src/components/InkOptionsSheet.tsx` — pen and highlighter show the full theme-aware palette plus a custom-colour swatch and inline picker; the sheet scrolls on short screens.
- `src/components/ObjectOptionsSheet.tsx` — text and sticky sheets share the same palette, custom swatch, and picker.
- `src/components/ColorPicker.tsx` — HSV saturation/value field and hue strip built on `react-native-svg`, with a live hex readout and contrast warning.
- `src/components/icons.tsx` — `UndoIcon` and `RedoIcon` use the standard arrow-return shapes.
- `app/editor.tsx` — toolbar uses the new icons, disabled styling, and command-aware accessibility hints; selected pen colour remaps on theme changes.
- `scripts/verify-history.mts`, `scripts/verify-objects.mts` (new/updated) and `package.json` — command-history, drag-coalescing, palette, contrast, and stack checks.
- `docs/task-status.md` — this update.

The text, sticky-note, object sheet, and keyboard files listed in the previous status remain in place and were not changed by this slice.

## Verification
- `npx tsc --noEmit` passes.
- `npm test` passes: `test:viewport`, `test:ink`, `test:history`, and `test:objects`.
- `test:history` covers: a fresh board with both stacks empty; three sequential strokes as three undo steps; undo and redo in order; an eraser sweep applying many transient commands and committing as one entry; undoing a sweep that is still open; a single command erasing two strokes and restoring both; an eraser miss recording nothing; undo restoring erased strokes in their original order; redo replaying the same commands; a new edit clearing redo; redo disabled during an open gesture; create/delete command payloads; action labels; document equality; and the 100-entry bound.
- `test:objects` also checks that pen, text, and shape palettes are equal, that sticky notes expose the full pastel range, that every text/pen and sticky pairing clears 4.5:1 in both themes, and that custom hex colours pass through unchanged with legible note ink.
- `npx expo export --platform ios` bundles successfully.
- No ESLint config or lint script exists in this project, so there is no separate lint run.
- Not verified: touch interaction. The undo/redo toolbar paths and canvas gestures were exercised through the pure command-history and object checks, but this environment has no way to inject taps into the simulator.

## Known issues
- Shape objects are not implemented yet. The shared `SHAPE_COLORS` palette and matching contrast checks are ready for the shapes-and-connectors slice.
- The command history is in memory only; reloading the app clears both the board and its undo/redo stacks.
- Text and sticky objects render as native views layered over the Skia canvas rather than as Skia primitives; they are not drawn into a future image/PDF export until that slice decides how to rasterise text.
- Object height is estimated from an average glyph width, so a selection frame can be a few units taller or shorter than the rendered text.
- Sticky notes keep their standard 112×112 size; resizing a note after typing is not implemented.
- Editing blocks one-finger canvas gestures; two-finger pan/zoom still works while the keyboard is up.
- Web export needs `react-dom` and `react-native-web`; it is not configured for this slice.
- Text alignment was listed in the design notes for the editor and is not implemented.

## Decisions
- Undo entries are commands, not document snapshots. Each command carries the inverse data it needs: the stroke it created, the erased strokes and their original indexes, or the object fields it replaced.
- A transient gesture applies its commands immediately but commits one batched entry, so a drag or an eraser sweep is one undo step.
- Commands return the same document reference when they change nothing, and `documentsEqual` handles a gesture that moves away and back, so neither can create an empty entry.
- One history covers ink and objects together; there is no separate per-tool undo stack.
- A new command clears the redo stack; undo and redo preserve the active tool, viewport, and selection.
- Pure modules import each other with explicit `.ts` extensions so the Node verification scripts can load them without a bundler.

## Next task
Next: text and sticky notes. Those objects are already present in this working tree from an earlier pass, so the next unimplemented slice is shapes and connectors.
