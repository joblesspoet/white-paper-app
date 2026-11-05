# Task status

## Current phase
Text and sticky notes.

## Status
`implemented-unverified` — Text and sticky-note objects, tap-to-create, in-place keyboard-safe editing, commit/discard rules, text size and colour, sticky pastels with verified contrast, move, delete, and one chronological undo/redo history for ink and objects are implemented. Typecheck, the pure-logic checks, and the iOS bundle pass; the editor could not be driven with touch input in this environment (see Verification).

## Completed slices
- Expo Router stack with Home, Editor, and Settings routes.
- Editor native header replaced with an in-app safe-area top bar.
- Editable board title field, back navigation, undo/redo affordances, and overflow affordance.
- Responsive phone floating bottom tool dock and tablet vertical tool rail.
- Canvas viewport: pure viewport model in `src/canvas/viewport.ts` with 0.5×–4× zoom, focal-point anchoring, and a `Reset view` action.
- Pen, highlighter, eraser, and a compact ink options sheet.
- Text and sticky-note canvas objects in `src/canvas/document.ts`:
  - tap-to-create centred on the tapped canvas point;
  - in-place `TextInput` overlay scaled with the viewport, so editing happens where the object is;
  - one commit path for `Done`, outside tap, tool change, title field, back, and blur;
  - empty objects are discarded instead of committed (an existing object whose text is cleared is deleted, undoably);
  - text colour (light/dark variants) and text size, sticky pastels with `#134E4A` note text;
  - Select mode: touch selects, drag moves with the grab offset preserved, a tap on the selected object enters editing, and a selection bar offers `Edit` and `Delete`;
  - the viewport pans (never zooms) when the keyboard appears so the edited object stays above the keyboard and the style sheet.
- One undo/redo history covers ink and objects (`src/canvas/history.ts`): drags and eraser sweeps collapse into a single entry, no-op gestures record nothing, and a new edit clears redo.
- Interactive controls use accessibility labels and 44pt minimum targets.

## Files changed
- `src/canvas/colors.ts` (new) — hex parsing, WCAG relative luminance and contrast ratio.
- `src/canvas/history.ts` (new) — snapshot undo/redo with transient gestures and a bounded stack.
- `src/canvas/document.ts` (new) — object model, palettes, measurement, hit test, keyboard-visibility maths, `applyCommand` and the document reducer.
- `src/components/CanvasViewport.tsx` — now controlled: strokes and objects come in as props, gestures emit `DocumentCommand`s, selection and the editing overlay are rendered here, in-canvas undo/redo props removed.
- `src/components/ObjectOptionsSheet.tsx` (new) — colour and text-size sheet shared by the text tool, sticky tool, and in-place editor.
- `app/editor.tsx` — owns the document history, selection, the editing draft, the keyboard-safe viewport request, and the selection bar.
- `scripts/verify-objects.mts` (new) and `package.json` — object, history, empty-cancel, and keyboard checks.
- `docs/screen-architecture.md`, `README.md` — implemented notes for this slice.

## Verification
- `npx tsc --noEmit` passes.
- `npm test` passes: `test:viewport`, `test:ink`, and the new `test:objects`.
- `test:objects` covers: creation centred on the tap point at 0.5×/1×/2×/4× zoom; text measurement and growth; every sticky/text palette pair at ≥4.5:1 in both themes; topmost-object hit testing; insert/update/move/delete commands that return the same document when they change nothing; empty-object discard and clear-to-delete; one undo step per drag, per eraser sweep, and per committed edit; chronological ink+object undo/redo; redo cleared by a new edit; bounded history; and keyboard panning at four zoom levels (object above the keyboard, scale untouched, wide and tall objects handled).
- `npx expo export --platform ios` bundles successfully.
- No ESLint config or lint script exists in this project, so there is no separate lint run.
- Not verified: touch interaction. Expo Go was installed on the iPhone 16 Pro Max simulator and launched, but the simulator showed a blocking system dialog and this environment has no way to inject taps, so tap-to-create, typing, the keyboard pan, dragging, and the Done/outside-tap paths were not exercised on a device.

## Known issues
- Text and sticky objects render as native views layered over the Skia canvas rather than as Skia primitives; they are not drawn into a future image/PDF export until that slice decides how to rasterise text.
- Object height is estimated from an average glyph width, so a selection frame can be a few units taller or shorter than the rendered text.
- Sticky notes keep their standard 112×112 size; resizing a note after typing is not implemented.
- Editing blocks one-finger canvas gestures; two-finger pan/zoom still works while the keyboard is up.
- Web export needs `react-dom` and `react-native-web`; it is not configured for this slice.
- Board, ink, and object state are in-memory only and reset on reload.
- Text alignment was listed in the design notes for this screen and is not implemented.

## Decisions
- Objects are stored in canvas coordinates and never in screen coordinates; zoom must not change an object's size or position.
- `src/canvas/document.ts` is the single place that mutates a board document. Commands return the same document reference when nothing changed, and the history depends on that to avoid empty undo steps.
- Undo entries are document snapshots, not inverse commands. Gestures apply transient changes and commit one checkpoint, so a drag or an eraser sweep is one undo step.
- One history covers ink and objects together; there is no separate per-tool undo stack.
- An empty object is never stored. Committing an existing object with no text deletes it, and undo restores it.
- Palette values are chosen against measured contrast, not by eye: light text colours are darkened until they clear 4.5:1 on `#F0FDFA`, and the dark variants are checked against `#0B2B28`.
- The keyboard moves the viewport only; the object never moves, and the viewport is never zoomed automatically.
- Pure modules import each other with explicit `.ts` extensions so the Node verification scripts can load them without a bundler.

## Next task
Next: implement shapes and connectors.
