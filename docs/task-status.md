# Task status

## Current phase
Smart Teaching & Presentation Differentiation Architecture (Phases A–F planning, prompt creation, feature specifications, and design handoff updates on branch `feat/teaching-board-architecture`).

## Status
`complete` — architecture, per-phase feature specifications (`docs/phase-a-*.md` through `docs/phase-h-*.md`), implementation session prompts (`prompts/20-phase-a-*.md` through `prompts/27-phase-h-*.md`), and design system handoff updates (`design/tokens.md`, `design/flows.md`, `design/screen-inventory.md`, `design/component-handoff.md`) are defined:
- `prompts/18-quality-hardening.md` and `prompts/19-design-to-react-native.md` are paused until Phases A–H (`prompts/20-*` through `prompts/27-*`) are implemented and verified.
- **Phase A (`prompts/20-phase-a-teaching-utilities.md`, `docs/phase-a-teaching-utilities.md`):** Laser pointer (`laser`) with `1200 ms` decaying Skia trail, teaching canvas backgrounds (`grid`, `ruled`, `isometric`), draggable `FloatingTimer` (countdown + stopwatch + `Pin to board`), and draggable `FloatingCalculator` (standard + scientific evaluator + `Paste to board`).
- **Phase B (`prompts/21-phase-b-geometry-shapes-tables.md`, `docs/phase-b-geometry-shapes-tables.md`):** Interactive Skia Geometry Box (`Ruler`, `Protractor`, `Compass`, `Set Square` with magnetic pen edge snapping and arc sweeping), expanded 45+ 2D/3D/graph/STEM shape library, and `TableObject` with in-place cell editing.
- **Phase C (`prompts/22-phase-c-math-recognition-stylus.md`, `docs/phase-c-math-recognition-stylus.md`):** `MathObject` & `MathKeyboardSheet` equation builder, `350 ms` hold-to-snap freehand shape recognition, lasso handwritten ink-to-text OCR, stylus pressure-sensitive variable-width strokes, and `stylusOnlyDrawing` palm rejection.
- **Phase D (`prompts/23-phase-d-multipage-pdf-annotation.md`, `docs/phase-d-multipage-pdf-annotation.md`):** Multi-page board switcher & page sorter activating `board_pages`, locked background worksheet objects, multi-page PDF import for markup, and multi-page PDF/backup export.
- **Phase E (`prompts/24-phase-e-lesson-recorder-facecam.md`, `docs/phase-e-lesson-recorder-facecam.md`):** Draggable corner-snapping `FaceCamBubble` PiP camera and in-editor `LessonRecorderBar` (`480p`/`720p`/`1080p` + deterministic 60 FPS canvas timeline replay).
- **Phase F (`prompts/25-phase-f-live-classroom.md`, `docs/phase-f-live-classroom.md`):** Live Classroom broadcasting with 6-digit numeric code & SVG QR code join, zero-account student mode, real-time stroke/laser/page/timer sync, Raise Hand (`👋`) queue, Pass-the-Marker (`can-draw`) permission grant, Student Boards Gallery, and Lock Class.
- **Phase G (`prompts/26-phase-g-interactive-stem-mindmap.md`, `docs/phase-g-interactive-stem-mindmap.md`):** Magnetic object connectors (`startBinding`/`endBinding`), `+` quick-branching handles, Lasso `Tidy up` auto-layout, Live Function Plotter (`MathObject` → interactive curve), `TableObject` → Vector Chart generator, and Spatial OCR `Explode into sticky notes`.
- **Phase H (`prompts/27-phase-h-active-recall-voice-presenter.md`, `docs/phase-h-active-recall-voice-presenter.md`):** Tap-to-Reveal Answer Tape (`RevealTapeObject`), Stage Curtain / Spotlight Shade, Spatial Voice-Pin Stickers (`VoicePinObject`), Presenter-only Private Teleprompter Layer (`isPrivate`), Live Class Pop-Quiz Polls (`A/B/C/D`), and 1-Thumb Flashcard Study Mode.
- The next task is `Session 20 — Phase A: Smart Teaching & Presentation Utilities` (`prompts/20-phase-a-teaching-utilities.md`).

`implemented-unverified` — responsive phone and tablet support is implemented across all target device profiles with no new product features:
- Orientation unlocked in `app.json` (`"orientation": "default"`) so phones and tablets smoothly transition between portrait and landscape.
- Centralized responsive layout engine (`src/responsive/layout.ts`) classifying viewports (`small-phone`, `phone`, `phone-landscape`, `tablet-portrait`, `tablet-landscape`) using both `shortEdge >= 600` and `width >= 768` so large phones in landscape (`932×430`, `915×412`) and iPad Split View compact windows (`507×768`) are never misclassified as full tablets.
- Home screen (`app/index.tsx`, `src/screens/home.styles.ts`, `src/components/BoardCard.tsx`): adapts gutters (`16pt` on phones, `32pt` on tablets + left/right safe-area insets), columns (`2` on phone portrait, `2–3` on phone landscape, `4` on iPad portrait, and a two-pane `268pt` sidebar + `3–4` column board grid on iPad landscape), and deterministic `cardWidth` sizing so partial rows never stretch across wide screens. BoardCard now honors the active theme in dark mode.
- Editor navigation & inspector presentation (`app/editor.tsx`, `src/components/EditorInspectorPanel.tsx`):
  - Phones (portrait and landscape) use the bottom `ActionIsland` and bottom sheets; compact landscape viewports use a `48pt` top bar and tighter margins so the canvas stays dominant.
  - Tablets (`iPad portrait` and `iPad landscape`) use the left `84pt` vertical `ToolRail` wrapped in a safe-area `ScrollView` with `48×48pt` (`DOCK_TOUCH_TARGET`) buttons, and anchor tool option sheets (`InkOptionsSheet`, `ObjectOptionsSheet`, `ShapeOptionsSheet`) as `rail-popover` cards beside the rail instead of full-width bottom sheets.
  - Tablet inspector (`src/components/EditorInspectorPanel.tsx`): in iPad landscape, selecting one or more objects docks a `288pt` right-hand inspector panel with capability-aware Quick Actions (`Edit`, `Duplicate`, `Delete`), inline colour/typography/shape/connector style controls, and dimensions metadata while keeping the canvas dominant (`>= 60%` width); in iPad portrait, the inspector defaults to a `44pt` right-edge tab and slides over as an `overlay` panel when opened.
- Safe areas, keyboard avoidance, and rotation (`app/editor.tsx`, `app/settings.tsx`):
  - Left and right safe-area insets (`insets.left`, `insets.right`) are applied to the editor top bar, workspace, storage alert banner, `QuickCreationSheet`, and `SettingsScreen`.
  - Canvas window bounds (`measureCanvas`) automatically re-measure on dimension, navigation mode, or inspector presentation changes.
  - Software vs hardware keyboard detection (`isSoftwareKeyboardVisible`) avoids false offsets from iPad hardware keyboard shortcut bars while panning the canvas (`keepObjectAboveKeyboard`) whenever multiline text growth or software keyboards overlap the active `TextInput`, accompanied by a floating `Style` / `Done` bar while editing.
- Modals & secondary flows (`src/components/ExportSheet.tsx`, `src/components/ImportBoardModal.tsx`, `src/components/ImageSourceSheet.tsx`, `src/components/ImageCropScreen.tsx`, `src/components/OcrReviewScreen.tsx`):
  - `ExportSheet`, `ImportBoardModal`, and Home's "Customize your board" modal render as centered `480pt`-max-width dialogs on tablets and landscape phones.
  - `ImageSourceSheet` centers at `560pt` max width and lays out "Take photo" and "Choose from library" side-by-side in two columns on tablets.
  - `ImageCropScreen` moves its controls into a right-hand vertical rail (`cropToolbarPlacement === 'right-rail'`) in landscape so the 4:3 crop frame gets full vertical height.
  - `OcrReviewScreen` switches to a side-by-side two-column layout (`ocrLayout === 'two-column'`) on tablets and wide landscape screens with the image preview on the left and the editable transcript on the right.
- Touch targets (`src/components/InkingQuickTray.tsx`, `src/components/ColorPicker.tsx`, `app/editor.tsx`): all interactive controls meet or exceed `44×44pt` (`touchTarget`, including horizontal and vertical `hitSlop` on compact tray chips and hue sliders) and `48×48pt` (`DOCK_TOUCH_TARGET`) on dock/rail buttons.
- Verification suite added at `scripts/verify-responsive.mts` (`npm run test:responsive`) testing all 13 target device profiles across `small phone`, `large phone`, `Android phone`, `iPad portrait`, and `iPad landscape`.
- The next task is quality hardening.

`implemented-unverified` — local MVP Settings are implemented with no cloud sync:
- Settings screen (`app/settings.tsx`) organized into 6 flat sections matching Stitch designs (`55-settings-01-default-light.png`, `56-settings-02-dark.png`, `57-settings-03-ipad-portrait.png`, `58-clear-local-data-01-confirm-dialog.png`): Appearance, Canvas, Interaction, Export, About, and Data.
- Theme switching: System, Light, and Dark mode via 3-way segmented control; applied globally via `PreferencesProvider` (`src/settings/preferences-context.tsx`) dynamically styling header bars, status bar style, background, card borders, and toolbars across Home, Editor, and Settings.
- Default canvas background and texture: options for Light/Dark canvas background and Blank/Dot Grid texture persisted and automatically applied to new boards (`app/index.tsx`) and the customisation sheet.
- Default pen color and width: preferences from the 16-color WCAG AA canvas palette and standard stroke widths (2, 4, 8, 12) applied on board open in `app/editor.tsx`.
- Haptics feedback toggle: toggles tactile feedback on tool switching, tray toggling, undo/redo, and preferences changes, using a resilient native wrapper (`src/utils/haptics.ts`).
- Export format preference: default format (PNG, JPEG, PDF, backup) saved and pre-selected when opening `ExportSheet.tsx`.
- About and Privacy modals (`src/components/SettingsPickers.tsx`): offline architecture, local Skia engine details, zero telemetry, zero analytics, zero external network requests.
- Clear local data flow (`src/components/ClearLocalDataDialog.tsx`): displays real live counts of active boards, sticky notes, vector drawings, and database media bytes; requires explicit checkbox acknowledgement before enabling the destructive "Delete everything" action; atomically wipes SQLite tables, removes durable media files, resets preferences to defaults, clears in-memory boards, and navigates cleanly back to Home empty state.
- Durability: append-only SQLite schema migration 3 creates `app_preferences` table with WAL mode and serialized transactional writes.
- Verification suite added at `scripts/verify-settings.mts` (`npm run test:settings`) covering preference parsing, SQLite roundtrip, on-disk recovery, real data purge, and default fallback.
- The next task is responsive tablet support.

`implemented-unverified` — local export and import are implemented with no cloud sync:
- Visible-board and selected-region raster export (`PNG` and `JPEG`) render offscreen via `@shopify/react-native-skia` (`src/export/export-service.ts`, `src/export/regions.ts`) with clamped pixel bounds (`MAX_EXPORT_DIMENSION = 4096`), selection padding (`EXPORT_SELECTION_PADDING = 24`), and periodic event-loop yields (`RENDER_BATCH_SIZE = 20`) so large boards never freeze the editor.
- Local PDF export (`exportBoardPdf`) uses `expo-print` (`Print.printToFileAsync`) on iOS and Android to generate a single-page PDF sized to the rendered region aspect ratio, and returns an actionable error on unsupported platforms (web).
- Native share sheet (`src/export/share.ts`, `src/export/share-outcome.ts`) wraps `expo-sharing` and classifies outcomes (`shared`, `cancelled`, `unavailable`, `failed`).
- Versioned editable `.flowcanvas.json` backups (`src/export/backup.ts`, `src/export/backup-store.ts`, `src/persistence/repository.ts`) embed board metadata, viewport, document, and base64-encoded media files; import validates schemas, repairs legacy unversioned (version 0) objects, rejects newer schema versions (`version > BACKUP_VERSION`) and oversized files (`MAX_BACKUP_BYTES = 64 MB`), skips unsafe media paths, and always creates a new board (`(imported)`) atomically in SQLite without overwriting existing boards.
- UI wiring: `src/components/ExportSheet.tsx` is wired to the editor top bar's `MoreIcon` button (`app/editor.tsx`) with scope selection (Visible board / Selection), format selection, progress bar for large exports, and share-sheet handoff; `src/components/ImportBoardModal.tsx` is wired to `"Import a board"` on `app/index.tsx` (both empty state and footer).
- Verification suite added at `scripts/verify-export.mts` (`npm run test:export`) covering empty boards, large boards, selections, invalid files, version mismatch, SQLite round-trip import, and share cancellation.
- The next task is settings.

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
  - `src/ocr/ocr-service.ts` normalizes whitespace, sorts text blocks top to bottom with a row tolerance then left to right, falls back to a plain transcript when an engine returns no blocks, and maps failures to action-oriented copy;
  - loading, success, no-text, and error review states with text-region and engine labels;
  - the extracted text is editable before placement; `Add text to board` is disabled when the corrected text is empty;
  - `Add text to board` places a normal editable text block below the image at the image's width and records `TextObject.sourceImageId`;
  - `Add image only` places the image with `ImageObject.ocr` metadata but no text block;
  - image + text placement is one batched command and therefore one undo step;
  - `ImageObject.ocr` is optional and malformed OCR metadata is dropped without rejecting the image row, so older boards still load;
  - verification in `scripts/verify-ocr.mts` covers block ordering, all four review states, correction, linking, image-only fallback after loading/empty/error, one-step undo, persistence, and an on-disk relaunch.
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
- `src/components/ImageImportFlow.tsx` — now presents the flow in a `Modal` so no editor chrome can draw above it, handles Android back per step, and dismisses after a successful placement.
- `src/components/ImageCropScreen.tsx` — `.runOnJS(true)` on the pan, pinch, and double-tap gestures (fixes the UI-thread crash) and safe-area padding.
- `src/components/ImageSourceSheet.tsx` — dimmed scrim that dismisses on tap, theme-tokened header border, and bottom safe-area inset.
- `app.json` — `expo-image-picker` plugin configuration with camera and photo library usage descriptions, Android permissions.
- `package.json` / `package-lock.json` — dependencies `expo-image-picker`, `expo-image-manipulator`, `expo-file-system`, and `test:image` verification script.
- `scripts/verify-image.mts` (new) — comprehensive automated tests covering permissions, cancellations, large image bounds, crop maths, rotation, placement, proportional resize, undo/redo history, and persistence relaunch recovery.
- `src/ocr/ocr-service.ts` (new) — platform-independent OCR result normalization, top-to-bottom/left-to-right block ordering, review states, correction, region/engine labels, and error copy.
- `src/ocr/native-ocr.ts` (new) — lazy `expo-mlkit-ocr` adapter using `requireOptionalNativeModule('ExpoMlkitOcr')`, mapping a missing native module or unsupported device to `OcrServiceError` codes instead of crashing.
- `src/ocr/ocr-placement.ts` (new) — attaches reviewed OCR metadata to the image and builds the linked text block below it; `OCR_TEXT_GAP` and `buildOcrPlacement`.
- `src/components/OcrReviewScreen.tsx` (new) — image preview, loading/success/no-text/error states, editable extracted text, `Add text to board`, `Add image only`, retry, and close; the summary reports recognized text regions.
- `src/components/ImageImportFlow.tsx` — added the OCR review step, temporary-file cleanup across the new step, and the two placement choices.
- `src/components/AppButton.tsx` — `disabled` prop with an accessibility state and dimmed style.
- `src/canvas/document.ts` — `ImageOcr`, optional `ImageObject.ocr`, `TextObject.sourceImageId`, and OCR fields in image equality.
- `src/persistence/repository.ts` — parses/preserves `sourceImageId` and optional image OCR metadata; malformed OCR is dropped without rejecting the image.
- `app/editor.tsx` — `placeImageObject(object, textObject?)` inserts the image and linked text in one batched command and mirrors OCR into the placed asset's metadata.
- `app.json` — `expo-mlkit-ocr` with `iosEngine: "vision"` and `expo-build-properties` iOS deployment target `16.4`.
- `package.json` / `package-lock.json` — dependencies `expo-mlkit-ocr` and `expo-build-properties`, plus `test:ocr`.
- `scripts/verify-ocr.mts` (new) — OCR normalization, reading order, review states, correction, linking, image-only fallback, one-step undo, and persistence/relaunch checks.
- `docs/ocr.md` (new) — OCR option evaluation, chosen package, flow, permissions/privacy, limitations, and verification approach.
- `src/export/regions.ts` (new) — pure export geometry: visible-board mapping, padded selection export bounds, raster dimensions clamped to [64, 4096], large export thresholding, file stem sanitization, and timestamped file naming.
- `src/export/share-outcome.ts` (new) — pure share-sheet outcome classifier mapping resolutions and native exceptions into `shared`, `cancelled`, `unavailable`, and `failed`.
- `src/export/share.ts` (new) — `expo-sharing` wrapper with platform availability checks and classified results.
- `src/export/export-service.ts` (new) — offscreen Skia rendering for raster (PNG/JPEG), `expo-print` single-page PDF generation, versioned JSON backup packaging with embedded base64 media, event loop yielding (`RENDER_BATCH_SIZE = 20`) to keep the UI responsive, and temporary file lifecycle management.
- `src/export/backup.ts` (new) — pure backup schema validation, legacy format/version-0 repair, unsupported version/format guards, safe media path validation, size limits (64 MB), new board planning with id/path rewriting, and summary formatting.
- `src/export/backup-store.ts` (new) — document picker integration (`.flowcanvas.json`), media file persistence under `media/<newBoardId>/imported/`, and transactional board creation with rollback.
- `src/components/ExportSheet.tsx` (new) — bottom sheet for scope (visible vs selection) and format (PNG, JPEG, PDF, Backup) selection, progress tracking with progress bar and labels, and share-sheet handoff.
- `src/components/ImportBoardModal.tsx` (new) — import preview modal showing board summary, embedded media count, non-fatal warnings, progress bar, and atomic creation confirmation.
- `src/persistence/repository.ts` — `insertImportedBoard` transactional multi-row insertion for board, page, media asset rows, and canvas objects.
- `app/editor.tsx` — top-bar "More board options" button wired to `ExportSheet`.
- `app/index.tsx` — "Import a board" button wired to file picker and `ImportBoardModal` on empty state and board list footer.
- `app.json` — added `expo-sharing` plugin.
- `package.json` — added `test:export` verification script to `npm test`.
- `scripts/verify-export.mts` (new) — automated verification suite for empty boards, large boards, selections, invalid files, version mismatch, SQLite round-trip import, and share cancellation.
- `src/responsive/layout.ts` (new) — pure responsive viewport profiler and layout calculators (`resolveViewportProfile`, `resolveHomeLayout`, `resolveEditorLayout`, `resolveFlowModalLayout`, `isSoftwareKeyboardVisible`).
- `src/components/EditorInspectorPanel.tsx` (new) — tablet right-side object inspector supporting `docked`, `overlay`, and `edge-tab` presentations with capability-aware quick actions, inline style controls, and dimensions summary.
- `app.json` — unlocked orientation (`"orientation": "default"`).
- `app/index.tsx`, `src/screens/home.styles.ts`, `src/components/BoardCard.tsx` — responsive gutters (`16pt`/`32pt`), 2/4-column grids, iPad landscape two-pane sidebar + grid layout, non-stretching `cardWidth`, dark theme card support, and centered modal sheet on tablet/landscape.
- `app/editor.tsx` — wired `resolveEditorLayout`, scrollable `ToolRail` with `48pt` targets, `EditorInspectorPanel`, `rail-popover` tool option sheets on tablet, safe-area left/right insets, rotation re-measurement, multiline keyboard avoidance, and floating `Style`/`Done` bar during text editing.
- `src/components/InkOptionsSheet.tsx`, `src/components/ObjectOptionsSheet.tsx`, `src/components/ShapeOptionsSheet.tsx` — added `rail-popover` variant anchored beside the tablet tool rail and viewport-clamped `ScrollView` height.
- `src/components/ExportSheet.tsx`, `src/components/ImportBoardModal.tsx`, `src/components/ImageSourceSheet.tsx`, `src/components/ImageCropScreen.tsx`, `src/components/OcrReviewScreen.tsx`, `src/components/QuickCreationSheet.tsx` — centered tablet modals, two-column image source cards, landscape right-rail crop toolbar, two-column tablet OCR review, and safe-area insets.
- `src/components/InkingQuickTray.tsx`, `src/components/ColorPicker.tsx`, `app/settings.tsx` — horizontal/vertical `hitSlop` for `44pt` touch targets and safe-area horizontal gutters on Settings.
- `scripts/verify-responsive.mts` (new) & `package.json` — automated verification across 13 target phone and tablet viewport profiles (`npm run test:responsive`).
- `docs/task-status.md` — this update.

## Verification
- `npm run typecheck` (`tsc --noEmit`) passes with 0 errors.
- `npm test` passes all 11 verification suites:
  - `test:viewport`: conversion, pan, zoom limits, focal anchoring, reset
  - `test:ink`: zoomed drawing, tool styles, smoothing, erasing, eraser scaling
  - `test:history`: command stacks, multiple strokes, erase sweeps, undo/redo, redo clearing, bounded history
  - `test:objects`: creation, measuring, contrast, hit testing, commands, empty objects, keyboard panning, undo/redo
  - `test:selection`: rotated bounds and hit testing, handles, resize anchors, rotation, marquee, screen conversion, action rail placement, duplicate, multi-transform undo/redo
  - `test:persistence`: schema migrations, document round-trip, corrupt row tolerance, media assets, write queue, relaunch recovery
  - `test:image`: permission copy, cancel, large image, crop, rotate, placement, resize, history, persistence and relaunch
  - `test:ocr`: block ordering, loading/success/no-text/error states, correction, source-image linking, image-only fallback, one-step undo, persistence and relaunch
  - `test:export`: empty boards, large boards, selections, invalid files, version mismatch, round-trip SQLite import, and share cancellation
  - `test:settings`: preference parser, SQLite roundtrip, on-disk recovery, data stats, and clear-local-data purge
  - `test:responsive`: viewport classification, Home 2/4-col & two-pane layouts, Editor island/rail & inspector modes, canvas dominance, orientation transitions, modal/flow layouts, keyboard overlap, and touch targets across 13 target device profiles (`small phone`, `large phone`, `Android phone`, `iPad portrait`, `iPad landscape`)
- `EXPO_NO_TELEMETRY=1 npx expo export --platform ios` bundles successfully.
- `EXPO_NO_TELEMETRY=1 npx expo export --platform android` bundles successfully.
- No ESLint config or lint script exists in this project, so there is no separate lint run.
- Not verified: physical camera and native photo picker dialogs, native OCR recognition and its permission-free path, physical share sheet presentation on device hardware, physical iPad Split View drag-resizing gestures, and Expo Go unavailable-state behaviour on real devices; these are covered by the pure suites and type-safe wrappers but still need manual verification on a device.

## Known issues
- Image files are stored locally in the app container. When boards are deleted in the future, orphaned media cleanup will be needed.
- OCR recognition requires a development build (or EAS build). In Expo Go the review screen reports that text recognition is unavailable in this build; `Add image only` still works.
- Native OCR, permission dialogs, physical-device relaunch, and offline recognition have not been exercised in this environment. Manual testing on iOS and Android is required to confirm engine availability and recognition quality.
- iOS is pinned to Apple Vision (`iosEngine: "vision"`) and the iOS deployment target is 16.4. Android uses ML Kit's bundled Latin model; non-Latin scripts would need a different ML Kit artifact.
- OCR reading order is inferred from block geometry: blocks are sorted top to bottom then left to right. Very dense, overlapping, or multi-column layouts can still be misordered; the user can correct the text before adding it.
- OCR reads the placed JPEG, so source photos larger than the 4096 px working cap are recognized from the downsampled working pixels rather than the untouched original.
- Handwriting, glare, and very small or distant text remain best-effort; the recognizer has no contrast/grayscale retry or handwriting model yet.
- OCR can only be started during import. Re-running recognition on an image already on a board, and removing a linked text block when its source image is deleted, are not exposed yet.
- Touch interaction on actual mobile hardware was not exercised in this environment; manual testing of pinch-zoom crop is recommended.
- PDF generation on web is unsupported (`expo-print` HTML printing is mobile-only). On web, export offers PNG, JPEG, and backup formats.

## Decisions
- Offscreen Skia rendering (`Skia.Surface.MakeOffscreen`) is used for raster exports. This ensures the live editor canvas does not flicker, re-render, or shift viewport during export.
- Batch rendering with event loop yields (`RENDER_BATCH_SIZE = 20`, `yieldToEventLoop`) ensures large boards with hundreds of strokes or objects never freeze the JS thread or drop animation frames.
- Export output pixels are clamped to `[MIN_EXPORT_DIMENSION = 64, MAX_EXPORT_DIMENSION = 4096]` with a default 2x pixel ratio to prevent OOMs on massive boards while keeping tiny selections sharp.
- Local PDF generation utilizes `expo-print` (`printToFileAsync`) with an HTML wrapper embedding the rendered PNG as base64, maintaining exact visual fidelity with canvas rendering without introducing heavy native PDF libraries.
- Backups (`.flowcanvas.json`) embed referenced media files as base64 data strings directly within the JSON document. This makes backup files completely portable, self-contained, and shareable across devices without separate archive/zip machinery.
- Imports always create a brand-new board titled `<Original Title> (imported)` with unique generated IDs. An import never overwrites or mutates existing boards or media assets.
- Schema versioning guards imports: legacy version-0 unversioned boards have missing style fields migrated on the fly; newer schema versions (`> BACKUP_VERSION`) are rejected with an explicit prompt to update the app.
- Corrupt individual objects or strokes within an imported file are skipped with non-fatal warnings rather than failing the entire board import.
- Native sharing via `expo-sharing` is wrapped with pure classification (`classifyShareResult`) to cleanly handle cancellations, missing native capabilities, and share-sheet completion without unhandled promise rejections.
- Exported files are written to a cache directory (`flowcanvas-exports`) and temporary files are cleaned up after sharing or failure.
- No cloud sync or network storage: all export and import operations are strictly local to the device filesystem.

## Next task
Next: Session 20 — Phase A: Smart Teaching & Presentation Utilities (`prompts/20-phase-a-teaching-utilities.md` & `docs/phase-a-teaching-utilities.md`). Note: `prompts/18-quality-hardening.md` and `prompts/19-design-to-react-native.md` are paused until Phases A–F (`20`–`25`) are completed.
