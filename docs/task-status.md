# Task status

## Current phase
Local OCR (Milestone 3): on-device text recognition with an editable review step.

## Status
`implemented-unverified` — local OCR is implemented on top of the image import flow:
- `expo-mlkit-ocr` 0.2.7 is wrapped by `src/ocr/`: Apple Vision on iOS (`iosEngine: "vision"`) and Google ML Kit Text Recognition v2 on Android. Recognition is entirely on-device; there is no cloud OCR, AI provider, or network call.
- The native module is loaded lazily, so Expo Go or a build without the module shows an `unavailable` error state in the review screen instead of crashing the board.
- `src/ocr/ocr-service.ts` is the platform-independent contract: line-level normalization, column-aware reading order (side-by-side columns left to right, otherwise paragraph bands top to bottom and rows left to right), loading/success/no-text/error states, engine and line-count copy, correction handling, and error messages that always remind the user the image can still be added.
- `src/components/OcrReviewScreen.tsx` previews the durable placed image, shows a progress state while recognition runs, reports how many lines of text and which engine produced them, exposes a multiline editable field for correction, and offers `Add text to board` (disabled when the text is empty) and `Add image only`.
- `src/components/ImageImportFlow.tsx` now runs pick → crop/rotate → durable store → lossless OCR copy → OCR review → placement. Recognition reads a dedicated cache PNG of the same crop (taken from the untouched original while it still matches the working size, otherwise the rotated working copy, enlarged up to 4× when small), so it never sees a double-compressed JPEG. Recognition starts from that local copy, so a slow, empty, or failed pass can never block image placement.
- `ImageObject.ocr` keeps the reviewed text, engine id, region count, and recognition timestamp; `TextObject.sourceImageId` links an extracted text block back to its photo. Both are optional, so older boards still load, and malformed OCR metadata is dropped without rejecting the image.
- `Add text to board` places a normal editable text block directly below the image at the image's width and inserts image + text in one batched command, so the placement is a single undo step. `Add image only` keeps the OCR metadata attached to the image but creates no text block.
- Reviewed OCR text is also mirrored onto the placed `media_assets` row.
- The next task is export/import.

`implemented-unverified` — image import and capture are implemented:
- Camera and photo library permissions are declared in `app.json` (iOS usage descriptions and Android permissions) and requested on-demand via `expo-image-picker`.
- The image source sheet offers "Take photo" and "Choose from library", actionable error messages, permission denied states with an "Open Settings" link, and clean dismissal.
- The crop and rotate flow allows panning and pinching within a fixed 4:3 frame, double-tap zoom toggle, quarter-turn clockwise rotation, and strict boundary clamping so cropped images never include blank margins.
- Local media storage preserves the untouched source file under `media/<boardId>/originals/` and the placed copy under `media/<boardId>/images/` in the app's document directory. All stored paths are relative to ensure portability across iOS/Android sandbox container UUID changes. Working copies in the cache directory are cleaned up on completion or cancellation.
- Placed images are full `ImageObject` canvas elements with move, proportional corner resize (aspect-ratio locked so pixels never distort), rotation, duplicate, and delete capabilities, integrated with command-based undo/redo.
- The canvas viewport renders images using Skia's `useImage` with a muted placeholder fallback during loading.
- Durability and relaunch: board document and media asset records persist in SQLite; relaunch recovery from an on-disk database restores original/placed asset links and crop metadata identically (`documentsEqual`). Corrupt image rows are skipped without damaging the board.

`implemented-unverified` — three defects in the image and inking surfaces are fixed. (1) The crop screen crashed the app on the first drag: `react-native-worklets/plugin` is auto-enabled by `babel-preset-expo`, so every `Gesture.Pan()/Pinch()/Tap()` callback in `src/components/ImageCropScreen.tsx` was workletized onto the UI thread while it called plain JS (`setTransform`, `rotatedSize`, `clampCropTransform`), which Reanimated aborts fatally. Those three gestures now declare `.runOnJS(true)`, matching how `CanvasViewport` already wraps its JS calls in `runOnJS`. (2) The image flow was a sibling view inside the editor root, so the editor top bar and action island drew over the "Add image" sheet and the crop stage was squeezed into the leftover flex space. `ImageImportFlow` now renders in its own `Modal` (`transparent`, `slide`, `statusBarTranslucent`, `onRequestClose`), and the sheet and crop screen carry safe-area insets. (3) The inking tray was a single row of ~480pt of controls and always overflowed a phone; it is now two centred rows that fit a 320pt screen with the same 44pt targets.

`implemented-unverified` — the phone tool dock is now a two-tier action island. Tier one is a four-anchor capsule — Select, Draw, Note, and a filled Insert button — each a 48pt target with a selected tint, an accessibility label and hint, and a live indicator (the Draw anchor shows the inking tool it will resume plus the current pen colour; the Note anchor shows the current pastel). The nine former flat tools no longer need a slot: Draw opens the compact inking tray, Note opens the note style sheet, and Insert opens a slide-up "Insert object" sheet holding Text block, Sticky note, the note and text quick-colour rows with custom pickers, Shapes (rectangle, ellipse, line), Connectors (arrow, line, elbow), and a Photo card that enters the existing image flow. Every sheet stacks above the pill at `ACTION_ISLAND_HEIGHT` instead of covering it. The island and sheets are flat — depth comes from a 1px border, never a drop shadow — and the 15-swatch rows that overflowed the old dock are replaced by six pastels, six text colours, and a `+` that opens the full HSV picker. The two-tier dock is phone-only; the tablet tool rail, undo/redo, the drawing engine, and SQLite persistence are unchanged.

`implemented-unverified` — boards now live in an on-device SQLite store instead of React state. `expo-sqlite` opens `flowcanvas.db` with WAL and foreign keys enabled, runs append-only migrations tracked by `PRAGMA user_version`, and defines versioned tables for boards, pages, canvas objects (including ink strokes), and media references. Home reads the board list from SQLite, board creation and title edits are written through a serialized queue, and the editor loads a board's document plus viewport on open. Document changes autosave after a 700 ms quiet period, viewport changes after 900 ms, and both flush when the app backgrounds or the editor closes. A corrupt object row is skipped, a store written by a newer schema is refused instead of damaged, and a failed read or write leaves the in-memory board editable with an alert banner. Pure verification runs the real SQL and migrations against Node's built-in SQLite, including an on-disk close/reopen restart; the native expo-sqlite binding and device kill/relaunch have not been exercised in this environment.

`implemented-unverified` — selection and transforms work for every current object type: rotation-aware hit testing, a single-object bounding box with four corner resize handles and a rotate handle, long-press marquee multi-selection, move, resize, rotate, duplicate, delete, and object inspector actions. All gesture points are converted from screen to canvas space, and handle sizes and minimum resize limits use the current zoom, so pan and zoom cannot skew a transform. Every transform merges its pointer samples into one undo entry; multi-duplicate and multi-delete use one batched history command. Pure verification and typecheck pass; simulator touch testing remains unavailable in this environment.

`implemented-unverified` — rectangle, ellipse, line, and line/arrow/elbow connector objects are implemented with canvas-space geometry, Skia rendering, drag creation, movement, deletion, and command-based undo/redo. Shape and connector options expose color, fill, border/stroke width, and connector style. Each board mutation is a create, update, delete, or batched command that knows how to apply and revert itself; the history stores commands instead of document snapshots. The undo and redo stacks are bounded at 100 entries, a new edit clears redo, and empty gestures record nothing. Toolbar undo/redo use arrow-return SVG icons with disabled states, action labels, and accessibility hints. Pen, text, and the shared shape palette expose the same 16 presets, sticky notes expose 15 pastels, and every tool now has a full-spectrum custom colour picker for anything the presets miss. The text and sticky-note slice already present in this tree continues to use the same chronological history. Typecheck, the pure-logic checks, and the iOS bundle pass; touch interaction could not be exercised in this environment (see Verification).

Selection and editing are capability-aware: text and sticky notes expose text editing plus colour, size, bold, and italic style, shapes and connectors expose duplicate, style, and delete, images expose duplicate and delete with proportional scaling, and ink is not selectable. A single selection shows `Edit` (textual only), `Style` (textual/geometric), `Duplicate`, and `Delete`; an image selection shows `Duplicate` and `Delete`; a multi-selection shows `Duplicate` and `Delete`. Every action has an explicit accessibility label and hint.

## Completed slices
- Two-tier action island and quick creation sheet (`src/components/ActionIsland.tsx`, `src/components/QuickCreationSheet.tsx`, `src/components/InkingQuickTray.tsx`):
  - tier one is a four-anchor capsule pill — `Select`, `Draw`, `Note`, and a filled primary `Insert` button — replacing the nine-button dock; every anchor is a 48pt target with `accessibilityLabel`/`accessibilityHint`/`accessibilityState`;
  - the pill reports expansion to assistive tech (`expanded` on Insert) and tints the active anchor instead of only recolouring an icon;
  - `Draw` resumes the last inking tool (`pen`, `highlighter`, or `eraser`), shows that tool's icon plus a dot in the current pen colour, and toggles the compact inking tray;
  - `Note` arms the sticky tool and opens the note style sheet, with a dot in the current pastel;
  - `Insert` opens the tier-two sheet: Text block, Sticky note, note and text quick-colour rows (six presets each plus a `+` that opens the shared HSV picker), Shapes (rectangle, ellipse, line), Connectors (arrow, line, elbow), and a Photo card that hands off to the existing image import flow;
  - each section carries a `Styles` action that arms the tool and opens the full style sheet, so the sheet stays a pickup point rather than a second options screen;
  - the sheet is a real `Modal` (`transparent`, `animationType="slide"`, `statusBarTranslucent`, `onRequestClose`) with a safe-area bottom inset, a dimmed backdrop that dismisses it, and a scroll cap of 80% of the window height;
  - a custom colour is drafted locally while the picker is open and applied when it is confirmed, so dragging the HSV field cannot fire an insert per pointer sample;
  - the colour picker state is cleared whenever the sheet closes, so a half-finished custom pick is never waiting on the next open;
  - `ACTION_ISLAND_HEIGHT` is the single source of truth for stacking the ink tray, note, and shape style sheets above the pill;
  - flat design is enforced here: no drop shadows on the island, the sheet, or the inking tray — depth is a 1px border;
  - small tray controls (24–36pt chips) keep their compact look but carry vertical `hitSlop` so their tap targets reach the 44pt minimum.
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
- Local OCR (`src/ocr/`, `src/components/OcrReviewScreen.tsx`, `src/components/ImageImportFlow.tsx`):
  - `expo-mlkit-ocr` 0.2.7 behind a lazy adapter: Apple Vision on iOS through `iosEngine: "vision"`, Google ML Kit Text Recognition v2 on Android; all recognition is offline and on-device;
  - a missing native module (for example Expo Go) becomes an unavailable OCR error state, never a crash, and `Add image only` stays available;
  - `src/ocr/ocr-service.ts` normalizes whitespace at line level, flattens `blocks[].lines` (including Apple Vision's single-block payload), reads genuine side-by-side columns left to right and everything else top to bottom with row tolerance, falls back to a plain transcript when an engine returns no blocks, and maps failures to action-oriented copy;
  - loading, success, no-text, and error review states with text-line and engine labels;
  - the extracted text is editable before placement; `Add text to board` is disabled when the corrected text is empty;
  - `Add text to board` places a normal editable text block below the image at the image's width and records `TextObject.sourceImageId`;
  - `Add image only` places the image with `ImageObject.ocr` metadata but no text block;
  - image + text placement is one batched command and therefore one undo step;
  - `ImageObject.ocr` is optional and malformed OCR metadata is dropped without rejecting the image row, so older boards still load;
  - the recognizer reads a lossless PNG copy of the crop rather than the placed JPEG, taken from the untouched original while it still matches the working size and otherwise from the rotated working copy, with small crops enlarged up to 4×; the copy is deleted with the other cache files and a preparation failure falls back to the placed copy;
  - verification in `scripts/verify-ocr.mts` covers line-level flattening, column and title/column reading order, row ordering, OCR copy sizing, all four review states, correction, linking, image-only fallback after loading/empty/error, one-step undo, persistence, and an on-disk relaunch.
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
- Two-tier phone action island and insert sheet; tablet keeps the vertical tool rail.
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
- `src/components/ActionIsland.tsx` (new) — tier-one capsule pill with the four anchors, live ink and pastel indicators, and the exported `ACTION_ISLAND_HEIGHT` stacking constant.
- `src/components/QuickCreationSheet.tsx` (new, rewritten) — tier-two slide-up insert sheet: text/notes, shapes, connectors, media, custom colour drafting, and the `InsertToolRequest` type the editor consumes.
- `src/components/InkingQuickTray.tsx` (new) — compact inking tray behind the Draw anchor: tool segment, width/eraser presets, quick colours, and a route to the full ink options.
- `src/components/icons.tsx` — added `ElbowIcon` for the elbow connector tile.
- `src/components/ShapeOptionsSheet.tsx` — custom `#rrggbb` colour support so the sheet can show a colour picked in the insert sheet.
- `app/editor.tsx` — `ActionIsland`, `InkingQuickTray`, and `QuickCreationSheet` wiring, `toggleInking` and `handleSelectInsert`, `islandBottom`/`optionsBottom` derived from `ACTION_ISLAND_HEIGHT`, and removal of the old `ToolDock`/`FloatingIsland` and their dead styles.
- `src/media/image-crop.ts` (new) — pure crop geometry, cover scale, frame fitting, transform clamping, focal zoom, integer pixel crop calculation, quarter-turn rotation, OCR copy sizing, and safe board segment helper.
- `src/media/image-source.ts` (new) — user-facing copy for source sheet, permission denied guidance, and error formatting.
- `src/media/image-picker.ts` (new) — thin wrapper for `expo-image-picker` camera and media library launchers with error and permission mapping.
- `src/media/asset-store.ts` (new) — file system store managing original and cropped image files under the app document directory, downsampled cache working copies, the lossless PNG copy the recognizer reads, deletion, and crop metadata record generation.
- `src/components/ImageSourceSheet.tsx` (new) — bottom sheet presenting camera and photo library options, error alert banner with "Open Settings" link.
- `src/components/ImageCropScreen.tsx` (new) — crop viewport modal with gesture-driven pan/pinch/double-tap, quarter-turn clockwise rotation, dashed frame border, and cancel/done controls.
- `src/components/ImageImportFlow.tsx` (new) — coordinator managing the pick → cache → crop → store → place lifecycle, temporary file cleanup on cancel/unmount.
- `src/canvas/document.ts` — `ImageObject` type, `createImageObject`, `imagePlacement` with aspect ratio preservation and max width clamp, `isImageObject` guard, capability checks, and deep equality for nested crop metadata.
- `src/canvas/selection.ts` — proportional aspect-locked corner resizing for `ImageObject`.
- `src/components/CanvasViewport.tsx` — Skia `ImageObjectView` with `useImage` and placeholder fallback, `image` ink tool support.
- `src/components/icons.tsx` — `ImageIcon` SVG icon for toolbar dock.
- `src/persistence/repository.ts` — `parseCanvasObject` and `objectStyle` serialization and deserialization for `image` canvas objects.
- `app/editor.tsx` — Image tool button in dock, modal flow presentation, `placeImageObject` inserting image object and recording media asset rows in SQLite, image-specific selection rail actions (duplicate and delete).
- `src/components/ImageImportFlow.tsx` — now presents the flow in a `Modal` so no editor chrome can draw above it, handles Android back per step, and dismisses after a successful placement.
- `src/components/ImageCropScreen.tsx` — `.runOnJS(true)` on the pan, pinch, and double-tap gestures (fixes the UI-thread crash) and safe-area padding.
- `src/components/ImageSourceSheet.tsx` — dimmed scrim that dismisses on tap, theme-tokened header border, and bottom safe-area inset.
- `app.json` — `expo-image-picker` plugin configuration with camera and photo library usage descriptions, Android permissions.
- `package.json` / `package-lock.json` — dependencies `expo-image-picker`, `expo-image-manipulator`, `expo-file-system`, and `test:image` verification script.
- `scripts/verify-image.mts` (new) — comprehensive automated tests covering permissions, cancellations, large image bounds, crop maths, rotation, placement, proportional resize, undo/redo history, and persistence relaunch recovery.
- `src/ocr/ocr-service.ts` (new) — platform-independent OCR result normalization at line level, column-aware reading order, review states, correction, text-line/engine labels, and error copy.
- `src/ocr/native-ocr.ts` (new) — lazy `expo-mlkit-ocr` adapter using `requireOptionalNativeModule('ExpoMlkitOcr')`, mapping a missing native module or unsupported device to `OcrServiceError` codes instead of crashing.
- `src/ocr/ocr-placement.ts` (new) — attaches reviewed OCR metadata to the image and builds the linked text block below it; `OCR_TEXT_GAP` and `buildOcrPlacement`.
- `src/components/OcrReviewScreen.tsx` (new) — image preview, loading/success/no-text/error states, editable extracted text, `Add text to board`, `Add image only`, retry, and close; the summary reports recognized text lines.
- `src/components/ImageImportFlow.tsx` — added the OCR review step, a dedicated lossless OCR copy with stale-request guarding, temporary-file cleanup across the new step, and the two placement choices.
- `src/media/asset-store.ts` — `prepareOcrImage` renders rotate → crop → optional upscale into a lossless PNG cache file; `src/media/image-crop.ts` gained the pure `ocrSourceSize` sizing rule.
- `src/components/AppButton.tsx` — `disabled` prop with an accessibility state and dimmed style.
- `src/canvas/document.ts` — `ImageOcr`, optional `ImageObject.ocr`, `TextObject.sourceImageId`, and OCR fields in image equality.
- `src/persistence/repository.ts` — parses/preserves `sourceImageId` and optional image OCR metadata; malformed OCR is dropped without rejecting the image.
- `app/editor.tsx` — `placeImageObject(object, textObject?)` inserts the image and linked text in one batched command and mirrors OCR into the placed asset's metadata.
- `app.json` — `expo-mlkit-ocr` with `iosEngine: "vision"` and `expo-build-properties` iOS deployment target `16.4`.
- `package.json` / `package-lock.json` — dependencies `expo-mlkit-ocr` and `expo-build-properties`, plus `test:ocr`.
- `scripts/verify-ocr.mts` (new) — OCR normalization, reading order, review states, correction, linking, image-only fallback, one-step undo, and persistence/relaunch checks.
- `docs/ocr.md` (new) — OCR option evaluation, chosen package, flow, permissions/privacy, limitations, and verification approach.
- `docs/task-status.md` — this update.

## Verification
- `npm run typecheck` (`tsc --noEmit`) passes with 0 errors.
- `npm test` passes all 8 verification suites:
  - `test:viewport`: conversion, pan, zoom limits, focal anchoring, reset
  - `test:ink`: zoomed drawing, tool styles, smoothing, erasing, eraser scaling
  - `test:history`: command stacks, multiple strokes, erase sweeps, undo/redo, redo clearing, bounded history
  - `test:objects`: creation, measuring, contrast, hit testing, commands, empty objects, keyboard panning, undo/redo
  - `test:selection`: rotated bounds and hit testing, handles, resize anchors, rotation, marquee, screen conversion, action rail placement, duplicate, multi-transform undo/redo
  - `test:persistence`: schema migrations, document round-trip, corrupt row tolerance, media assets, write queue, relaunch recovery
  - `test:image`: permission copy, cancel, large image, crop, rotate, placement, resize, history, persistence and relaunch
  - `test:ocr`: line-level flattening, column and title/column reading order, row ordering, OCR copy sizing, loading/success/no-text/error states, correction, source-image linking, image-only fallback, one-step undo, persistence and relaunch
- `EXPO_NO_TELEMETRY=1 npx expo export --platform ios` bundles successfully.
- `EXPO_NO_TELEMETRY=1 npx expo export --platform android` bundles successfully.
- No ESLint config or lint script exists in this project, so there is no separate lint run.
- Not verified: physical camera and native photo picker dialogs, native OCR recognition and its permission-free path, and Expo Go unavailable-state behaviour on real devices; these are covered by the pure suites and type-safe wrappers but still need a development build on a phone or simulator.

## Known issues
- Image files are stored locally in the app container. When boards are deleted in the future, orphaned media cleanup will be needed.
- OCR recognition requires a development build (or EAS build). In Expo Go the review screen reports that text recognition is unavailable in this build; `Add image only` still works.
- Native OCR, permission dialogs, physical-device relaunch, and offline recognition have not been exercised in this environment. Manual testing on iOS and Android is required to confirm engine availability and recognition quality.
- iOS is pinned to Apple Vision (`iosEngine: "vision"`) and the iOS deployment target is 16.4. Android uses ML Kit's bundled Latin model; non-Latin scripts would need a different ML Kit artifact.
- OCR reading order is inferred from line geometry. Clear side-by-side columns and a title above them are ordered correctly, but very dense, overlapping, or irregular layouts can still be misordered; the user can correct the text before adding it.
- Source photos larger than the 4096 px working cap are recognized from the downsampled working pixels, because crop-screen geometry is measured against that working copy. The untouched original is used only while it still matches the working size.
- Handwriting, glare, and very small or distant text remain best-effort; the recognizer has no contrast/grayscale retry or handwriting model yet.
- OCR can only be started during import. Re-running recognition on an image already on a board, and removing a linked text block when its source image is deleted, are not exposed yet.
- Touch interaction on actual mobile hardware was not exercised in this environment; manual testing of pinch-zoom crop is recommended.

## Decisions
- Crop-screen gestures call `.runOnJS(true)` instead of being rewritten as worklets. The crop maths in `src/media/image-crop.ts` is shared with the pure verification suite, so keeping it plain JS and running the gesture callbacks on the JS thread avoids duplicating every helper as a worklet while removing the UI-thread crash.
- Modal-based image import: the flow owns its own window so it cannot be interleaved with editor chrome, and it is the same primitive the insert sheet uses for the same reason.
- The inking tray uses two fixed rows rather than a horizontal scroller. A drawing toolbar needs every control visible at once; a horizontal list hides options off-screen with no affordance and asks for a sideways drag that competes with the canvas pan gesture. Two rows also stay inside a 320pt-wide screen, which a single row of the same controls cannot.
- The image flow dismisses itself after a successful placement, because the placed copy is already durable and leaving the source sheet up asked the user to close the flow twice.
- The phone dock is two-tier because nine flat buttons cannot meet the 48pt target and the label legibility the design system asks for at once. Tier one holds the four things that are one tap away in practice; everything else lives in tier two.
- `ACTION_ISLAND_HEIGHT` is exported from `ActionIsland` and consumed by `app/editor.tsx` so the ink tray and style sheets stack above the pill from a single number instead of a repeated magic offset.
- The insert sheet is a `Modal` rather than an absolutely positioned `View`: it gets the platform slide animation, hardware back handling via `onRequestClose`, and correct modal focus for screen readers.
- The insert sheet does not run OCR itself. The media card is a plain "Photo" card that hands off to the image flow; recognition only happens after the image has been picked, cropped, and stored.
- The island, the insert sheet, and the inking tray are flat. The design tokens forbid drop shadows, so depth is a 1px border and elevation is never used.
- Quick-colour rows show six presets per kind with a `+` for the full picker, instead of the fifteen overflowing swatches the old dock carried.
- Stored media asset paths are stored relative to the document directory (`media/<boardId>/...`) rather than as absolute paths, so app container path shifts across iOS/Android OS updates and restores never break image references.
- Working image copies live in the cache directory (`flowcanvas-images`) and are purged upon placement or cancellation; only original and placed assets are durable.
- Original source images are always preserved untouched alongside placed/cropped images, allowing future OCR re-runs or re-cropping from the source photo.
- Image objects scale proportionally during corner resize to prevent visual stretching/distortion.
- Image objects expose duplicate and delete actions; text editing and style sheets are suppressed for images.
- Images render as Skia primitives (`useImage`) at the bottom of the object layer.
- `expo-mlkit-ocr` was chosen over `expo-text-extractor`, `expo-ocr-kit`, `@infinitered/react-native-mlkit-text-recognition`, `@react-native-ml-kit/text-recognition`, `react-native-image-analysis`, `tesseract.js`, and `react-native-tesseract-ocr`. It fits the Expo config-plugin workflow, returns blocks with image-space bounding boxes for multi-region review, and reports device support. The full comparison is in `docs/ocr.md`.
- iOS uses Apple Vision (`iosEngine: "vision"`) instead of shipping Google ML Kit pods. This keeps the iOS build simulator-friendly and smaller; Android keeps ML Kit's bundled Latin model for offline recognition.
- The OCR module is resolved with `requireOptionalNativeModule('ExpoMlkitOcr')`, not a static import of `expo-mlkit-ocr`. The package's JS wrapper calls the throwing `requireNativeModule` while loading, so importing it would take down the editor in Expo Go; the optional lookup turns a missing module into an error state next to an image that can still be placed.
- Durable image storage happens before recognition. OCR is an enhancement layered on an already-placeable image, so loading, no-text, and error states cannot block `Add image only` or lose the imported photo.
- Extracted text is a normal editable `TextObject` placed below the image, not a pinned overlay. It can be selected, moved, restyled, duplicated, and edited like any other text; `sourceImageId` keeps the trace back to the photo.
- Reviewed OCR text is stored on the image even when the user chooses `Add image only`, so a later re-run or re-placement does not need to redo recognition.
- Image and linked text are inserted with one `commands` action, so one placement is one undo step rather than two.
- OCR metadata is parsed leniently: a malformed result is dropped while the image row still loads, matching the existing corrupt-row tolerance for the rest of the board.
- OCR ordering is computed at line level, not block level. Apple Vision returns one block for the whole page, so block sorting would report one region and could interleave columns; flattening `blocks[].lines` and then choosing column-first or row-first order is platform-independent and needs no native patch.
- Columns win over rows only when a blank gutter runs the full height of the group and both sides have at least two lines with overlapping vertical ranges. This keeps genuine columns and title/column layouts in order without turning scattered notes into columns.
- The recognizer reads a lossless PNG of the crop in the cache directory instead of the placed JPEG. The copy comes from the untouched original while it still matches the working size, is enlarged up to 4× when the crop is small, and is deleted with the other temporary files; if it cannot be prepared, recognition falls back to the placed copy so OCR never blocks placement.

## Next task
Next: export and import (PNG/PDF export, share sheet, and versioned JSON board backup/restore).
