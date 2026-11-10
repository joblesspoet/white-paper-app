# Task status

## Current phase
Image import (Milestone 3).

## Status
`implemented-unverified` — image import and capture without OCR are implemented:
- Camera and photo library permissions are declared in `app.json` (iOS usage descriptions and Android permissions) and requested on-demand via `expo-image-picker`.
- The image source sheet offers "Take photo" and "Choose from library", actionable error messages, permission denied states with an "Open Settings" link, and clean dismissal.
- The crop and rotate flow allows panning and pinching within a fixed 4:3 frame, double-tap zoom toggle, quarter-turn clockwise rotation, and strict boundary clamping so cropped images never include blank margins.
- Local media storage preserves the untouched source file under `media/<boardId>/originals/` and the placed copy under `media/<boardId>/images/` in the app's document directory. All stored paths are relative to ensure portability across iOS/Android sandbox container UUID changes. Working copies in the cache directory are cleaned up on completion or cancellation.
- Placed images are full `ImageObject` canvas elements with move, proportional corner resize (aspect-ratio locked so pixels never distort), rotation, duplicate, and delete capabilities, integrated with command-based undo/redo.
- The canvas viewport renders images using Skia's `useImage` with a muted placeholder fallback during loading.
- Durability and relaunch: board document and media asset records persist in SQLite; relaunch recovery from an on-disk database restores original/placed asset links and crop metadata identically (`documentsEqual`). Corrupt image rows are skipped without damaging the board.
- Next task is local OCR.

`implemented-unverified` — boards now live in an on-device SQLite store instead of React state. `expo-sqlite` opens `flowcanvas.db` with WAL and foreign keys enabled, runs append-only migrations tracked by `PRAGMA user_version`, and defines versioned tables for boards, pages, canvas objects (including ink strokes), and media references. Home reads the board list from SQLite, board creation and title edits are written through a serialized queue, and the editor loads a board's document plus viewport on open. Document changes autosave after a 700 ms quiet period, viewport changes after 900 ms, and both flush when the app backgrounds or the editor closes. A corrupt object row is skipped, a store written by a newer schema is refused instead of damaged, and a failed read or write leaves the in-memory board editable with an alert banner. Pure verification runs the real SQL and migrations against Node's built-in SQLite, including an on-disk close/reopen restart; the native expo-sqlite binding and device kill/relaunch have not been exercised in this environment.

`implemented-unverified` — selection and transforms work for every current object type: rotation-aware hit testing, a single-object bounding box with four corner resize handles and a rotate handle, long-press marquee multi-selection, move, resize, rotate, duplicate, delete, and object inspector actions. All gesture points are converted from screen to canvas space, and handle sizes and minimum resize limits use the current zoom, so pan and zoom cannot skew a transform. Every transform merges its pointer samples into one undo entry; multi-duplicate and multi-delete use one batched history command. Pure verification and typecheck pass; simulator touch testing remains unavailable in this environment.

`implemented-unverified` — rectangle, ellipse, line, and line/arrow/elbow connector objects are implemented with canvas-space geometry, Skia rendering, drag creation, movement, deletion, and command-based undo/redo. Shape and connector options expose color, fill, border/stroke width, and connector style. Each board mutation is a create, update, delete, or batched command that knows how to apply and revert itself; the history stores commands instead of document snapshots. The undo and redo stacks are bounded at 100 entries, a new edit clears redo, and empty gestures record nothing. Toolbar undo/redo use arrow-return SVG icons with disabled states, action labels, and accessibility hints. Pen, text, and the shared shape palette expose the same 16 presets, sticky notes expose 15 pastels, and every tool now has a full-spectrum custom colour picker for anything the presets miss. The text and sticky-note slice already present in this tree continues to use the same chronological history. Typecheck, the pure-logic checks, and the iOS bundle pass; touch interaction could not be exercised in this environment (see Verification).

Selection and editing are capability-aware: text and sticky notes expose text editing plus colour, size, bold, and italic style, shapes and connectors expose duplicate, style, and delete, images expose duplicate and delete with proportional scaling, and ink is not selectable. A single selection shows `Edit` (textual only), `Style` (textual/geometric), `Duplicate`, and `Delete`; an image selection shows `Duplicate` and `Delete`; a multi-selection shows `Duplicate` and `Delete`. Every action has an explicit accessibility label and hint.

## Completed slices
- Image capture and import (`src/media/`, `src/components/Image*`):
  - `expo-image-picker`, `expo-image-manipulator`, and `expo-file-system` handle device camera/library access, resizing, rotation, and file operations;
  - iOS photo/camera usage descriptions and Android permissions configured in `app.json`;
  - Image source sheet with "Take photo" and "Choose from library", error banner with "Open Settings" link on permanent denial;
  - Image crop screen with gesture-based pan and pinch, double-tap zoom toggle, quarter-turn clockwise rotation, frame fitting, and integer pixel crop rectangle calculation;
  - Durable media store saving original untouched assets (`originals/`) and placed cropped assets (`images/`) under the document directory, with relative paths stored in SQLite `media_assets`;
  - Temporary working copies in cache directory deleted on completion or cancellation;
  - `ImageObject` canvas type storing placed asset ID, storage path, original asset ID, original storage path, source dimensions, original dimensions, and crop metadata (`x`, `y`, `width`, `height`, `rotation`);
  - Center placement on current viewport canvas center point;
  - Proportional corner resizing anchored in world space (maintaining source aspect ratio);
  - Skia rendering via `useImage` with placeholder rectangle during load;
  - Verification suite in `scripts/verify-image.mts` covering permission denied messages, cancellation, large image downsampling/placement, crop math, rotation cycling, proportional resizing, undo/redo history, and persistence relaunch from disk.
- Local persistence (`src/persistence/`):
  - `expo-sqlite` 58.0.15 is the storage engine; the connection opens lazily, enables WAL and foreign keys, and is shared by every screen;
  - schema version 2 is stored in `PRAGMA user_version`; migrations are append-only and each migration plus its version bump runs in one transaction;
  - version 1 creates `boards`, `board_pages`, `canvas_objects`, and `media_assets`; version 2 adds `boards.viewport_json` and `canvas_objects.revision`;
  - canvas objects and ink strokes are both rows in `canvas_objects`, ordered by `z_index`, with the full object in `content_json` and geometry/style mirrors for inspection;
  - board metadata (title, created/updated timestamps, settings) and viewport are stored on the board row; the Home list is read from SQLite with a loading state instead of starting empty;
  - document autosave is debounced by 700 ms; viewport saves are debounced by 900 ms; both flush on `background`/`inactive` and on editor unmount;
  - one process-wide write queue serializes board creation, title edits, autosave, and viewport writes so a new board cannot be opened and saved before its insert commits;
  - the editor hydrates the saved document and viewport before mounting the canvas, then starts a fresh undo history so undo cannot walk back past the load;
  - malformed object rows and viewport JSON are skipped rather than failing the whole board; a store from a newer app version raises a visible error instead of being modified;
  - read and write failures keep the board editable in memory and show an alert banner on Home and in the editor;
  - `media_assets` stores metadata for original and cropped placed assets.
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
  - rotation-aware hit testing for text, sticky notes, ellipses, lines, elbow/straight connectors, and images: the point is transformed into the object's unrotated frame;
  - one object shows a rotation-aware outline, four 12pt corner handles, and a rotate handle 36pt above the top edge; hit areas are finger-sized in screen points and scale with zoom;
  - resizing from any corner keeps the diagonally opposite corner fixed in world space, even on a rotated object, and clamps to a 24pt on-screen minimum;
  - images scale proportionally from all four corners;
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
- `src/media/image-crop.ts` (new) — pure crop geometry, cover scale, frame fitting, transform clamping, focal zoom, integer pixel crop calculation, quarter-turn rotation, and safe board segment helper.
- `src/media/image-source.ts` (new) — user-facing copy for source sheet, permission denied guidance, and error formatting.
- `src/media/image-picker.ts` (new) — thin wrapper for `expo-image-picker` camera and media library launchers with error and permission mapping.
- `src/media/asset-store.ts` (new) — file system store managing original and cropped image files under the app document directory, downsampled cache working copies, deletion, and crop metadata record generation.
- `src/components/ImageSourceSheet.tsx` (new) — bottom sheet presenting camera and photo library options, error alert banner with "Open Settings" link.
- `src/components/ImageCropScreen.tsx` (new) — crop viewport modal with gesture-driven pan/pinch/double-tap, quarter-turn clockwise rotation, dashed frame border, and cancel/done controls.
- `src/components/ImageImportFlow.tsx` (new) — coordinator managing the pick → cache → crop → store → place lifecycle, temporary file cleanup on cancel/unmount.
- `src/canvas/document.ts` — `ImageObject` type, `createImageObject`, `imagePlacement` with aspect ratio preservation and max width clamp, `isImageObject` guard, capability checks, and deep equality for nested crop metadata.
- `src/canvas/selection.ts` — proportional aspect-locked corner resizing for `ImageObject`.
- `src/components/CanvasViewport.tsx` — Skia `ImageObjectView` with `useImage` and placeholder fallback, `image` ink tool support.
- `src/components/icons.tsx` — `ImageIcon` SVG icon for toolbar dock.
- `src/persistence/repository.ts` — `parseCanvasObject` and `objectStyle` serialization and deserialization for `image` canvas objects.
- `app/editor.tsx` — Image tool button in dock, modal flow presentation, `placeImageObject` inserting image object and recording media asset rows in SQLite, image-specific selection rail actions (duplicate and delete).
- `app.json` — `expo-image-picker` plugin configuration with camera and photo library usage descriptions, Android permissions.
- `package.json` / `package-lock.json` — dependencies `expo-image-picker`, `expo-image-manipulator`, `expo-file-system`, and `test:image` verification script.
- `scripts/verify-image.mts` (new) — comprehensive automated tests covering permissions, cancellations, large image bounds, crop maths, rotation, placement, proportional resize, undo/redo history, and persistence relaunch recovery.
- `docs/task-status.md` — this update.

## Verification
- `npm run typecheck` (`tsc --noEmit`) passes with 0 errors.
- `npm test` passes all 7 verification suites:
  - `test:viewport`: conversion, pan, zoom limits, focal anchoring, reset
  - `test:ink`: zoomed drawing, tool styles, smoothing, erasing, eraser scaling
  - `test:history`: command stacks, multiple strokes, erase sweeps, undo/redo, redo clearing, bounded history
  - `test:objects`: creation, measuring, contrast, hit testing, commands, empty objects, keyboard panning, undo/redo
  - `test:selection`: rotated bounds and hit testing, handles, resize anchors, rotation, marquee, screen conversion, action rail placement, duplicate, multi-transform undo/redo
  - `test:persistence`: schema migrations, document round-trip, corrupt row tolerance, media assets, write queue, relaunch recovery
  - `test:image`: permission copy, cancel, large image, crop, rotate, placement, resize, history, persistence and relaunch
- `EXPO_NO_TELEMETRY=1 npx expo export --platform ios` bundles successfully.
- `EXPO_NO_TELEMETRY=1 npx expo export --platform android` bundles successfully.
- No ESLint config or lint script exists in this project, so there is no separate lint run.
- Not verified: physical camera and native photo picker dialogs on real devices; these are exercised through the pure verification suite and type-safe wrappers.

## Known issues
- Image files are stored locally in the app container. When boards are deleted in the future, orphaned media cleanup will be needed.
- OCR text recognition is not yet implemented (scheduled for the next slice).
- Touch interaction on actual mobile hardware was not exercised in this environment; manual testing of pinch-zoom crop is recommended.

## Decisions
- Stored media asset paths are stored relative to the document directory (`media/<boardId>/...`) rather than as absolute paths, so app container path shifts across iOS/Android OS updates and restores never break image references.
- Working image copies live in the cache directory (`flowcanvas-images`) and are purged upon placement or cancellation; only original and placed assets are durable.
- Original source images are always preserved untouched alongside placed/cropped images, allowing future OCR re-runs or re-cropping from the source photo.
- Image objects scale proportionally during corner resize to prevent visual stretching/distortion.
- Image objects expose duplicate and delete actions; text editing and style sheets are suppressed for images.
- Images render as Skia primitives (`useImage`) at the bottom of the object layer.

## Next task
Next: local OCR.
