# Task status

## Current phase
Selection and transforms.

## Status
`implemented-unverified` — selection and transforms work for every current object type: rotation-aware hit testing, a single-object bounding box with four corner resize handles and a rotate handle, long-press marquee multi-selection, move, resize, rotate, duplicate, delete, and object inspector actions. All gesture points are converted from screen to canvas space, and handle sizes and minimum resize limits use the current zoom, so pan and zoom cannot skew a transform. Every transform merges its pointer samples into one undo entry; multi-duplicate and multi-delete use one batched history command. Pure verification and typecheck pass; simulator touch testing remains unavailable in this environment.

`implemented-unverified` — rectangle, ellipse, line, and line/arrow/elbow connector objects are implemented with canvas-space geometry, Skia rendering, drag creation, movement, deletion, and command-based undo/redo. Shape and connector options expose color, fill, border/stroke width, and connector style. Each board mutation is a create, update, delete, or batched command that knows how to apply and revert itself; the history stores commands instead of document snapshots. The undo and redo stacks are bounded at 100 entries, a new edit clears redo, and empty gestures record nothing. Toolbar undo/redo use arrow-return SVG icons with disabled states, action labels, and accessibility hints. Pen, text, and the shared shape palette expose the same 16 presets, sticky notes expose 15 pastels, and every tool now has a full-spectrum custom colour picker for anything the presets miss. The text and sticky-note slice already present in this tree continues to use the same chronological history. Typecheck, the pure-logic checks, and the iOS bundle pass; touch interaction could not be exercised in this environment (see Verification).

Selection and editing are capability-aware: text and sticky notes expose text editing plus colour, size, bold, and italic style, shapes and connectors expose duplicate, style, and delete, and ink is not selectable. A single selection shows `Edit` (textual only), `Style`, `Duplicate`, and `Delete`; a multi-selection shows `Duplicate` and `Delete`. Every action has an explicit accessibility label and hint.

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
  - Select mode: touch selects, drag moves with the grab offset preserved, a tap on the single selected text or sticky note enters editing, and the action bar offers `Edit`, `Style`, `Duplicate`, and `Delete`;
  - capabilities drive the actions: text and sticky notes expose text editing plus style, shapes and connectors expose duplicate, style, and delete, and ink strokes are not selectable;
   - text style includes colour, size, bold, and italic for both new and existing objects; style changes on existing objects go through `object.update` so they undo like every other edit;
   - the viewport pans (never zooms) when the keyboard appears so the edited object stays above the keyboard and the style sheet;
   - the in-place editor follows an object's rotation.
- Selection and transforms (`src/canvas/selection.ts`, `src/components/CanvasViewport.tsx`, `app/editor.tsx`):
  - rotation-aware hit testing for text, sticky notes, ellipses, lines, and elbow/straight connectors: the point is transformed into the object's unrotated frame;
  - one object shows a rotation-aware outline, four 12pt corner handles, and a rotate handle 36pt above the top edge; hit areas are finger-sized in screen points and scale with zoom;
  - resizing from any corner keeps the diagonally opposite corner fixed in world space, even on a rotated object, and clamps to a 24pt on-screen minimum;
  - text objects re-wrap on width changes and derive height from `measureTextBlock`; sticky, shape, and connector boxes take the pointer-driven size;
  - the rotate handle preserves the angle under the finger and snaps within 3° of a 15° step, for every object type;
  - long-press (280 ms) on empty canvas then drag draws a marquee; the marquee uses rotated bounds, and the resulting multi-selection shows an axis-aligned union box;
  - multi-selection supports move, duplicate, and delete; a tap on one member collapses to that object;
  - duplicate offsets each copy by 16 canvas units and selects the copies; single and multi duplicate/delete are one undo step;
  - all pointer samples of a move, resize, or rotate merge into one `objects.geometry` history entry, so one gesture is one undo step;
  - the selection frame and handles render on a transparent Skia layer above the native text views, so they stay visible on notes and text;
  - the contextual actions live in a vertical rail 12pt beside the selection, vertically centred; it stays right of the object, flips to the left near the right edge, and only overlaps the selection when neither side fits, so it never covers the rotate stem.
- Interactive controls use accessibility labels and 44pt minimum targets.

## Files changed
- `src/canvas/selection.ts` (new) — pure rotated corners and bounds, selection union, handle positions and hit testing, marquee intersection, canvas-to-screen rect conversion, corner resize anchored in world space, rotation helpers, and side-flipping action rail placement.
- `src/canvas/history.ts` — command-based undo/redo: create/update/delete/batch entries, transient gesture batching and move coalescing, bounded stacks, redo clearing, stack predicates, and next-action labels.
- `src/canvas/document.ts` — shape and connector object model, creation, rotation-aware geometry and hit testing, styling, duplication, batched multi-object commands, and command-history integration alongside ink/text/sticky objects; text weight/slant are stored and measured, and `prepareDocumentCommand` builds inverse commands for all object mutations.
- `src/canvas/shapes.ts` — pure drag geometry, elbow routing, arrowheads, polyline hit testing, and stroke defaults.
- `src/components/CanvasViewport.tsx` — selection, move, resize, and rotate gestures; long-press marquee; rotated rendering of geometric objects; a transparent Skia selection/handle layer above the native text views; and shape/connector rendering at all viewport scales.
- `src/components/ShapeOptionsSheet.tsx` — shape type, fill, border color, connector style, and stroke controls.
- `src/components/InkOptionsSheet.tsx` — pen and highlighter show the full theme-aware palette plus a custom-colour swatch and inline picker; the sheet scrolls on short screens.
- `src/components/ObjectOptionsSheet.tsx` — text and sticky sheets share the same palette, custom swatch, picker, text size, and bold/italic controls.
- `src/components/ColorPicker.tsx` — HSV saturation/value field and hue strip built on `react-native-svg`, with a live hex readout and contrast warning.
- `src/components/icons.tsx` — `UndoIcon` and `RedoIcon` use the standard arrow-return shapes; `EditIcon`, `StyleIcon`, `DuplicateIcon`, and `TrashIcon` supply the selection actions.
- `app/editor.tsx` — toolbar uses the new icons, disabled styling, and command-aware accessibility hints; selected pen colour remaps on theme changes; multi-selection state, duplicate/delete actions, rotated in-place text editing, capability-aware inspector actions, and the vertical selection action rail that flips sides and stays clear of the rotate stem.
- `scripts/verify-selection.mts` (new), `scripts/verify-history.mts`, `scripts/verify-objects.mts` (updated) and `package.json` — selection geometry, transform history, command-history, drag-coalescing, palette, contrast, and stack checks.
- `docs/screen-architecture.md` — selection and transform interaction rules.
- `docs/task-status.md` — this update.

The text, sticky-note, object sheet, and keyboard files listed in the previous status remain in place and were not changed by this slice.

## Verification
- `npx tsc --noEmit` passes.
- `npm test` passes: `test:viewport`, `test:ink`, `test:history`, `test:objects`, and `test:selection`.
- `test:history` covers: a fresh board with both stacks empty; three sequential strokes as three undo steps; undo and redo in order; an eraser sweep applying many transient commands and committing as one entry; undoing a sweep that is still open; a single command erasing two strokes and restoring both; an eraser miss recording nothing; undo restoring erased strokes in their original order; redo replaying the same commands; a new edit clearing redo; redo disabled during an open gesture; create/delete command payloads; action labels; document equality; and the 100-entry bound.
- `test:objects` also checks that pen, text, and shape palettes are equal, that sticky notes expose the full pastel range, that every text/pen and sticky pairing clears 4.5:1 in both themes, and that custom hex colours pass through unchanged with legible note ink.
- `test:selection` covers: rotated corners and bounds; multi-selection union and rotated marquee intersection; rotation-aware hit testing for notes, lines, and connectors; handle positions and hit testing; anchor-preserving resize from all four corners on rotated objects; the non-zero-origin resize regression; the 24pt minimum clamp; text re-wrap height; rotation normalisation, finger-preserving rotation, and 15° snapping; canvas-to-screen conversion at four viewport scales; the action rail's side flip, inside fallback, edge clamping, and clearance from the rotate handle; duplicate offset and id; multi-move, resize, rotate, multi-delete, and multi-duplicate as single undo/redo entries; no-op gestures recording nothing; and separate consecutive gestures.
- `npx expo export --platform ios` bundles successfully.
- No ESLint config or lint script exists in this project, so there is no separate lint run.
- Not verified: touch interaction. The undo/redo toolbar paths, selection maths, and transform history were exercised through the pure command-history, object, and selection checks, but this environment has no way to inject taps into the simulator.

## Known issues
- Touch interaction and visual rendering were not exercised on a simulator in this environment; verify selection, handles, resize, rotate, and the long-press marquee at 0.5×, 1×, 2×, and 4× zoom on device.
- A long press on empty canvas starts a marquee, so a pan from empty canvas must begin moving within 280 ms. Pan still works from a touch that moves immediately.
- Multi-selection deliberately has no combined resize or rotate: the union box supports move, duplicate, and delete only.
- Handle squares are drawn in Skia and are not individual accessibility elements; the selection action rail provides the labelled, 44pt actions. A future accessibility pass could add adjustable actions for moving and resizing.
- Shape option custom colors currently use the shared palette keys; custom color picker integration for shape borders/fills can be expanded later if needed.
- The command history is in memory only; reloading the app clears both the board and its undo/redo stacks.
- Text and sticky objects render as native views layered over the Skia canvas rather than as Skia primitives; they are not drawn into a future image/PDF export until that slice decides how to rasterise text.
- Object height starts from an average-glyph estimate, then the canvas measures the real rendered line count and corrects it, so bold/large text is not clipped.
- Editing blocks one-finger canvas gestures; two-finger pan/zoom still works while the keyboard is up.
- Web export needs `react-dom` and `react-native-web`; it is not configured for this slice.
- Text alignment was listed in the design notes for the editor and is not implemented.

## Decisions
- Undo entries are commands, not document snapshots. Each command carries the inverse data it needs: the stroke it created, the erased strokes and their original indexes, or the object fields it replaced.
- A transient gesture applies its commands immediately but commits one batched entry, so a drag or an eraser sweep is one undo step.
- Commands return the same document reference when they change nothing, and `documentsEqual` handles a gesture that moves away and back, so neither can create an empty entry.
- One history covers ink and objects together; there is no separate per-tool undo stack.
- A new command clears the redo stack; undo and redo preserve the active tool, viewport, and selection.
- Every object carries one clockwise `rotation` in degrees around its centre; hit testing inverse-rotates the pointer instead of keeping a second geometry model.
- A single selection gets four corner handles and a rotate stem; a multi-selection gets an axis-aligned union box and no combined resize/rotate, which keeps the interaction predictable.
- Move, resize, and rotate send an absolute `objects.geometry` command per pointer sample; the history merges consecutive samples of the same verb and object set into one entry.
- Multi-duplicate and multi-delete use a `commands` document action that prepares and batches one history entry.
- A text resize re-wraps at the new width and derives height from the measured text block rather than the pointer, so text never clips.
- Duplicated objects are offset by 16 canvas units and become the new selection.
- The marquee begins after a 280 ms hold so a normal drag still pans the canvas.
- Pure modules import each other with explicit `.ts` extensions so the Node verification scripts can load them without a bundler.

## Next task
Next: local persistence.
