# Screen inventory

Generated from Stitch project `18433233690962903854` (see `design/stitch-project.md`).
Every row below maps to real generated screens; screen IDs are short forms of `projects/18433233690962903854/screens/{id}`.

This is a design reference. It does not authorise any scope beyond `docs/screen-architecture.md`.

---

## 1. Home / Boards

**Screens:** `bec7935657a04f688e3281a6fad4bf74` (empty), `f82ebe4e87d74e8eaa7ba1365ef412de` (populated), `5fa13f8a14d548aead4745f138cc3ed6` (loading), `91b5f9d2bc33477caea95e347a36045a` (corrupt board), `31da4656c79d411b8912a28619fd54b4` (delete confirmation), `313802e9738e4fd69e28ce140ad18fb5` / `88eec8edb10c4976ad5b03688ce67e82` / `6d03484958124f1098a389d5098157d3` (tablet).

- **Purpose:** the collection area for every local board; the only top-level destination.
- **Entry points:** app launch, back from the editor, back from Settings, cancel from Import.
- **Exit points:** `New board` → editor; a board card → editor; settings icon → Settings; import action → Import Board; overflow menu → rename/duplicate/export/delete.
- **Primary action:** `New board` (accent orange, the only orange element on the screen).
- **Components:** `HomeHeader`, `HomeWordmark`, `SearchField`, `NewBoardButton`, `ImportButton`, `BoardGrid`, `BoardCard`, `BoardThumbnail`, `BoardCardMeta`, `BoardMenu`, `EmptyBoardsState`, `BoardGridSkeleton`, `CorruptBoardCard`, `DeleteBoardDialog`.
- **States:** first launch empty, populated, search-filtered (design only, search appears above five boards), loading skeleton, corrupt-board recovery, delete confirmation, importing (see group 12).
- **Phone layout:** own safe-area header (wordmark left, search + settings right), `New board` CTA directly under the header, single column at 2 cards across, generous 16 gutter, cards with 12 radius and 1px border.
- **Tablet layout:** 32 gutter and a 4-column adaptive grid in portrait; landscape becomes a two-pane list-and-preview composition. Do not stretch phone cards.
- **Implementation notes:** card content is `BoardSummary` (`id`, `title`, `thumbnailUri`, `updatedAt`, `objectCount`); relative time is formatted with the platform formatter; the overflow menu is a sheet/popover route, not a screen; delete confirmation is a dialog over the grid, not a route. The empty state must not become an onboarding carousel.

---

## 2. New Board

**Screens:** `54f05c43ecca46508db56462013e9209` (instant creation transition), `83af1e6775c747d389eacf01dffb0c66` (customize, light), `8ab912aa16e44afd87df7c850f72c647` (customize, dark), `ae9b249eb5004f96be58d8253ef61a8d` (inline title rename).

- **Purpose:** create a board with zero friction, with optional customisation for people who want it.
- **Entry points:** `New board` on Home; the placeholder board card that appears during creation.
- **Exit points:** straight into the editor (common path); `Use defaults`; `Create board` after customising; `Cancel` returns to Home with no board created.
- **Primary action:** `New board` — the board is created and opened immediately as `Untitled board`.
- **Components:** `NewBoardButton` (pressed state), `CreatingBoardSkeletonCard`, `NewBoardSheet`, `CanvasStyleSelector` (blank / dot grid), `CanvasColorSelector`, `FrameOrientationSelector` (portrait / landscape), `SheetHeader`, `BoardTitleField`, `UndoRedoControls`.
- **States:** pressed CTA, creating, customise light, customise dark, title editing, title editing with focus ring.
- **Phone layout:** the customize sheet is a bottom sheet with 12 radius top corners over a 12% scrim; it never covers the whole canvas and does not block creation.
- **Tablet layout:** the same sheet centres as a 16-radius modal at a 480 max width.
- **Implementation notes:** creation is a single command — never a form. `Untitled board` is the default title and the title field is only reachable from the editor top bar. Customisation writes canvas style and frame into the board document at creation time.

---

## 3. Board Editor

**Screens:** `728b733d0e3b47f99f719aa3c7395b1b` (empty), `bb1f366b91e54a8288a682b557d4aa31` (drawing), `0903fa59f4a043e8bc81e97cc59c8afb` (single selection), `1651077228504f2dbef50c9fc49c30b4` (multi-selection), `d7d9317d874e48a2838dd6a18c4501be` (highlighter), plus tablet `cc05bb34df5b4a80b4146aa83f3097e5`, `76ee069b770a427dbccf2cd863ecf93b`, `c3db2b32927f426b92693b681c8a68f6`, `c3ee8b1b85b94803b4d20a13d9e2f51d`.

- **Purpose:** the dominant experience; the infinite canvas where every board object lives.
- **Entry points:** new board, board card, deep link `/editor`.
- **Exit points:** back chevron / system back → Home; overflow → export, import, board settings; tool dock → tool option sheets; selection → inspector.
- **Primary action:** drawing on the canvas. There is no submit; every mutation is one undoable command.
- **Components:** `EditorScreen`, `EditorTopBar`, `BoardTitleButton`, `UndoRedoControls`, `OverflowMenu`, `CanvasSurface`, `DotGrid`, `ToolDock`, `ToolButton`, `SelectionBoundingBox`, `SelectionHandle`, `SelectionActionBar`, `EmptyCanvasHint`, and on tablets `EditorTabletScreen`, `ToolRail`, `ToolRailButton`, `InspectorPanel`, `ToolOptionsStrip`.
- **States:** empty board, active ink, highlighter, single selection, multi-selection, (design also implies) saving, exporting, OCR processing.
- **Phone layout:** compact top bar, full-bleed canvas, floating pill tool dock near the bottom above the home indicator with 48pt targets and icon-only after first use.
- **Tablet layout:** vertical tool rail on the left (48pt), optional right inspector panel in landscape, optional tool options strip under the top bar in portrait.
- **Implementation notes:** canvas is `@shopify/react-native-skia`; the dock and rail share one `EditorMode` union (`select | pen | highlighter | eraser | text | sticky | shape | connector | image`); selection uses a 1.5px teal bounding box with 12pt square handles and 44pt hit areas; two-finger pan/zoom must stay available while a drawing tool is active.

---

## 4. Tool Options

**Screens:** `ceb29242673a48f5bd6ad4797003b213` (pen), `022551089e074b1f898632d85c85b33d` (highlighter), `fdd7a3b5e458475c8fad414347c63364` (eraser), `e626c9d1246540db8adcb01c80b7b017` (shape), `9134c32b33c64afbb03edccae1bd2553` (sticky note), `6263dc9277984b6ea7585486f897d2fd` (connector), `34b5f6334d024dc79258623fcb1187e0` (pen, dark).

- **Purpose:** change how the active tool behaves without leaving the canvas.
- **Entry points:** tapping the active tool a second time in the dock/rail, or the tool's chevron affordance.
- **Exit points:** `Done`, tapping the canvas, selecting another tool, or dragging the sheet down.
- **Primary action:** `Done` (text button, not a filled CTA).
- **Components:** `ToolOptionsSheet`, `SheetHeader`, `ColorSwatchRow`, `ColorSwatch`, `StrokeWidthSelector`, `OpacitySlider`, `EraserModeSegment`, `ShapeTypeRow`, `StickyColorRow`, `TextSizeSegment`, `ConnectorStyleRow`, `HighlighterToggle`.
- **States:** pen, highlighter, eraser (stroke/object), shape, sticky note, connector, dark theme, selected / pressed / disabled per control.
- **Phone layout:** compact bottom sheet docked above the tool dock; canvas stays visible above it.
- **Tablet layout:** the same options attach to the tool rail as a strip under the top bar (see `c3db2b32927f426b92693b681c8a68f6`) or as a side popover.
- **Implementation notes:** tool options are preferences on the tool, not on the board, until a stroke or object is committed. Sticky colours come from the pastel set; text on pastel is always `--color-foreground`.

---

## 5. Object Inspector

**Screens:** `254394229e3b4d9cb5cab8ed5f81295e` (single sticky), `09257e3781f74a04ae667828f46cbd06` (locked), `97eb55a9afaa4771b2541b5cf3e85611` (multi-selection), `fb60524f75524695829dde0176725b4a` (selected stroke), `b295dcadc44a4056b8b4eee01a1a7d8b` (dark).

- **Purpose:** act on the current selection without hunting through menus.
- **Entry points:** selecting a non-text object, opening the inspector affordance on tablet, or long-pressing a selection.
- **Exit points:** tapping empty canvas (deselects and closes), `Done`/drag down, or any destructive action which closes with feedback.
- **Primary action:** context dependent — `Duplicate` on a single object, `Group` on a multi-selection; `Delete` stays destructive red and never the default.
- **Components:** `ObjectInspectorSheet`, `InspectorHeader`, `ObjectTypeLabel`, `MultiSelectCountBadge`, `InspectorPrimaryActions`, `InspectorActionRow`, `InspectorStyleRow`, `AlignmentActions`, `LockedObjectBadge`, `DisabledCommentRow`.
- **States:** single selection, locked selection, multi-selection, stroke selection (style rather than text actions), dark theme, disabled rows.
- **Phone layout:** bottom sheet connected visually to the selection; primary actions in one row, secondary actions in a stacked list with icon + label + chevron.
- **Tablet layout:** persistent right `InspectorPanel` in landscape with the same content, stacked; in portrait it collapses to an edge affordance.
- **Implementation notes:** text and sticky notes open the editor on tap instead of this sheet. The comments row is a deliberate, disabled placeholder for the future cloud phase and must stay non-functional in the MVP.

---

## 6. Text Editing

**Screens:** `ca2f050f1e3e4eb5b5723649d2c4d78b` (placement + typing), `cbda22e61d154cfea5804e7c059148c6` (long paragraph), `28921bcdfe984f01b308c14105473699` (discard empty text).

- **Purpose:** type on the canvas in place, with the keyboard up.
- **Entry points:** text tool + canvas tap; tapping an existing text object.
- **Exit points:** `Done`, tapping outside the object, or `Cancel` (removes an object that has no text).
- **Primary action:** `Done` (commits one undoable command).
- **Components:** `TextObjectEditor`, `FloatingTextToolbar`, `FontSizeStepper`, `AlignmentControl`, `ColorSwatchRow`, `KeyboardSafeCanvas`, `DiscardEmptyObjectDialog`.
- **States:** placement, typing with caret, long paragraph with auto-expanding object, empty-object discard dialog.
- **Phone layout:** compact floating toolbar pinned directly above the keyboard; the canvas pans or temporarily zooms so the caret is never under the keyboard.
- **Tablet layout:** the toolbar floats next to the object rather than above the keyboard; the hardware keyboard keeps the canvas still.
- **Implementation notes:** commit-on-done and commit-on-blur both exist, so the empty-object check runs on blur; cancel removes the object only when the text is empty, otherwise it reverts. Respect Dynamic Type in the object's text style.

---

## 7. Sticky Note Editing

**Screens:** `6200e65d938e4991913e3473eb677a3a` (mint note creation), `8c77b3601c2746ef8422673287492cdc` (editing a butter note).

- **Purpose:** capture a short thought with immediate keyboard focus and a colour that carries meaning.
- **Entry points:** sticky tool + canvas tap (creates at standard size and focuses), tapping an existing note.
- **Exit points:** `Done`, tapping outside, or `Cancel`.
- **Primary action:** `Done`; the note resizes to fit after text entry.
- **Components:** `StickyNoteEditor`, `StickyNoteObject`, `StickyTextToolbar`, `StickyColorRow`, `TextSizeSegment`, `KeyboardSafeCanvas`.
- **States:** creation with immediate focus, editing existing content, colour change, dark theme.
- **Phone layout:** standard 12-radius note, toolbar above the keyboard, canvas panned so the note stays visible.
- **Tablet layout:** unchanged note geometry; toolbar floats beside the note.
- **Implementation notes:** every pastel must keep `#134E4A` text at 4.5:1 or better; the note must not be resized by the keyboard, only re-positioned in the viewport.

---

## 8. Image Source

**Screens:** `fab94284a16244ef9193f7c6ad95a372` (selection), `1c1d66d66a7d414895698b23610ecba9` (camera permission denied).

- **Purpose:** choose where an image comes from, with a clear privacy promise.
- **Entry points:** image tool in the dock/rail, or `Insert image` from the insert menu.
- **Exit points:** `Take photo` → camera; `Choose from library` → library; close → back to the editor.
- **Primary action:** the two large source cards; library remains available when the camera is denied.
- **Components:** `ImageSourceScreen`, `SourceActionCard`, `OnDeviceOcrNotice`, `PermissionDeniedNotice`, `OpenSettingsLink`.
- **States:** idle, camera permission denied, (library permission denied by parity).
- **Phone layout:** sheet/screen with two full-width outlined cards above one explanatory line.
- **Tablet layout:** two cards side by side inside a centred modal.
- **Implementation notes:** the OCR notice states that recognition runs on device and images are not uploaded. Do not gate image placement behind OCR.

---

## 9. Image Crop and Rotate

**Screens:** `919178ddd0124e41bb0b92669fe41292` (default), `f8d9c01f86c243ae9ca81a039007b783` (dragging a handle), `f8012b06820b4dc7b7008b276e4db2d9` (landscape right rail).

- **Purpose:** get the useful part of the image onto the board.
- **Entry points:** after choosing a photo.
- **Exit points:** `Continue` → place image / OCR review; `Cancel` → Image Source or editor.
- **Primary action:** `Continue` (accent orange).
- **Components:** `ImageCropScreen`, `CropRectOverlay`, `CropHandle`, `CropToolbar`, `AspectRatioSelector`, `RotateFlipControls`, `ResetAction`.
- **States:** default, handle dragging, landscape, (aspect locked by parity).
- **Phone layout:** image full bleed, toolbar above the safe area, dimmed outside-region, rule-of-thirds toggle.
- **Tablet layout:** toolbar moves to a right rail in landscape; the crop area is centred with generous margins.
- **Implementation notes:** keep the original asset and the crop metadata separate; the crop is non-destructive and re-editable.

---

## 10. OCR Review

**Screens:** `296818b2a3ff46dc99992319720ef3ca` (loading), `7a71b8d641ee4beaaf0baa98347d916b` (success), `bcaf2c46de5e4374a0a477d444f7712a` (editing), `ca3e9ee6473d46dc8aad56c9d0317146` (no text found), `12566d8752054a35994f7b30db52d509` (error).

- **Purpose:** turn an imported image into editable canvas text where the device supports it.
- **Entry points:** after crop/continue, or from an image already on the board.
- **Exit points:** `Add text to board` (primary), `Add image only` (secondary), retry, cancel.
- **Primary action:** `Add text to board`.
- **Components:** `OcrReviewScreen`, `ImagePreviewCard`, `OcrProgressIndicator`, `ExtractedTextEditor`, `CharacterCount`, `OcrEmptyState`, `OcrErrorState`, `PrivacyNotice`, `AddTextToBoardButton`, `AddImageOnlyButton`.
- **States:** recognising, success, editing, no text found, recognition error.
- **Phone layout:** image preview card on top, editable text below, actions pinned above the keyboard region; nothing scrolls under the actions.
- **Tablet layout:** image on the left, editable text on the right.
- **Implementation notes:** the text field is the source of truth for the canvas object — only the edited text is committed. `Add image only` must work in every state, including error. No upload, no network call.

---

## 11. Export Sheet

**Screens:** `448fc2aebad24dc6b78542d6ee59c07d` (default), `7f2bedb453454067932025fb7c5b2a71` (in progress), `f7a93481b9424db08a13a58b2e545c3f` (success), `59bdf36e4e354ab7b658899b5839a736` (error), `4b5e22d499934f61a6acf018f98d17bf` (dark, PDF selected).

- **Purpose:** get a board out of the app as an image, a document, or a restorable backup.
- **Entry points:** editor overflow menu, board card overflow, tablet inspector.
- **Exit points:** `Export`, `Share` (system share sheet), `Done`, close.
- **Primary action:** `Export` (accent orange).
- **Components:** `ExportSheet`, `ExportScopeSegment`, `ExportFormatRow`, `ExportFormatOption`, `ExportProgressBar`, `ExportSuccessState`, `ExportErrorState`, `ShareAction`, `BackupExplainer`.
- **States:** default, in progress, success, error, dark theme.
- **Phone layout:** compact sheet, scope segment then format rows with size estimates, actions at the bottom above the safe area.
- **Tablet layout:** centred 16-radius modal at 480 max width.
- **Implementation notes:** the editor must stay interactive during long exports — render on the Skia surface, not a blocking bridge call. `.flowcanvas.json` is the only restorable format; the sheet must say so.

---

## 12. Import Board

**Screens:** `a87f551ab2dd4220b33d142a969169b3` (file selection), `1805a35a45184591820872714e632e0b` (validating), `45da8d876d43444e96c21cb9a2454d5b` (invalid file), `a5826707074744038d94ec91ab44f7fa` (migration required).

- **Purpose:** restore a board from an editable `.flowcanvas.json` backup.
- **Entry points:** `Import board` on Home empty state and from the Home header overflow.
- **Exit points:** after a successful import the new board opens in the editor; `Cancel` returns to Home.
- **Primary action:** `Choose file`, then `Import as new board` when a migration is needed.
- **Components:** `ImportBoardScreen`, `BackupFilePickerCard`, `RecentBackupRow`, `FileValidationState`, `InvalidFileError`, `MigrationNotice`, `BackupVersionBadge`, `TechnicalDetailsDisclosure`.
- **States:** file selection, validating, invalid file, migration required, (importing by parity).
- **Phone layout:** single column with the picker card at the top and a recent-files list below.
- **Tablet layout:** centred 480-wide column inside a modal.
- **Implementation notes:** validate the schema version before opening; a migration always creates a **new** board and never overwrites an existing one; the source file stays untouched. Never surface raw parser output outside the collapsed technical details.

---

## 13. Settings

**Screens:** `19e8afc9f21c433491a19127b8606313` (light), `1698d1f45b5c45ac9517a5c1df0927cc` (dark), `f626195e4e1944efbb367ceada2a82db` (iPad portrait).

- **Purpose:** local preferences only — there is no account to manage.
- **Entry points:** settings icon on Home, `/settings` deep link.
- **Exit points:** back chevron / system back → Home.
- **Primary action:** none; every row acts immediately. Destructive action lives at the bottom in `Data`.
- **Components:** `SettingsScreen`, `SettingsSection`, `SettingsRow`, `SettingsValueRow`, `SettingsToggleRow`, `ThemeSelector`, `DefaultCanvasBackgroundRow`, `DefaultPenColorRow`, `DefaultPenWidthRow`, `DestructiveSettingsRow`, `AboutRow`, `PrivacyRow`.
- **States:** light, dark, tablet wide column, toggles on/off, destructive row.
- **Phone layout:** grouped rows with 1px dividers and no card shadows; sections `Appearance`, `Canvas`, `Interaction`, `Export`, `About`, `Data`.
- **Tablet layout:** one column at a 32 gutter with a wider row measure; not a stretched phone list.
- **Implementation notes:** theme, canvas default, pen defaults, haptics and export preference are the whole surface. Reduced motion follows the system and is shown read-only. No account, profile, subscription or team sections may ever appear here.

---

## 14. Clear Local Data

**Screens:** `e098012f70de496892414e73fd75201d` (confirmation).

- **Purpose:** irreversibly delete every board and preference on this device, with a deliberate speed bump.
- **Entry points:** `Clear all local data` in Settings `Data` section.
- **Exit points:** `Delete everything` (destructive) or `Cancel` → Settings.
- **Primary action:** `Delete everything` (destructive red, enabled only after the acknowledgement checkbox).
- **Components:** `ClearLocalDataDialog`, `ConfirmDestructiveCheckbox`, `DestructiveButton`, `CancelButton`, `ScrimOverlay`.
- **States:** unchecked (destructive disabled at 40% opacity), checked and enabled.
- **Phone layout:** 16-radius dialog centred over a 12% scrim, title, consequence paragraph, checkbox row, two buttons stacked with the destructive action last.
- **Tablet layout:** the same dialog at a 480 max width; never full-screen.
- **Implementation notes:** the checkbox acknowledgement is a design addition beyond `docs/screen-architecture.md` — see `design/stitch-notes.md`. After success return to Home, which must now be in its empty state.

---

## Coverage check against the brief

| Brief item | Screens | Status |
|---|---|---|
| 1 Home / Boards (empty, populated, loading, error, delete) | 5 + 3 tablet | complete |
| 2 New Board (immediate + optional customisation) | 4 | complete |
| 3 Board Editor (empty, drawing, selected, multi, phone, tablet) | 5 + 4 tablet | complete |
| 4 Tool Options (pen, highlighter, eraser, shapes, sticky, connectors) | 7 | complete |
| 5 Object Inspector | 5 | complete |
| 6 Text Editing (keyboard-safe) | 3 | complete |
| 7 Sticky Note Editing (keyboard-safe) | 2 | complete |
| 8 Image Source (camera + library) | 2 | complete |
| 9 Image Crop and Rotate | 3 | complete |
| 10 OCR Review (loading, success, editable, none, error) | 5 | complete |
| 11 Export Sheet (PNG, JPEG, PDF, JSON, share) | 5 | complete |
| 12 Import Board (selection, validation, invalid, migration) | 4 | complete |
| 13 Settings | 3 | complete |
| 14 Clear Local Data Confirmation | 1 | complete |

61 screens total. Gaps and deviations are listed in `design/stitch-notes.md`.
