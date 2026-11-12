# Flows and navigation

Approved navigation and primary user flows for the FlowCanvas MVP.
Authority: `docs/screen-architecture.md` and `docs/task-status.md`. Stitch screens are the visual reference, not a scope change.

## Navigation model

One native stack. No bottom tabs, ever, in this MVP.

```text
AppRoot (stack)
 ├─ /                      HomeScreen                  own safe-area header
 ├─ /editor                BoardEditorScreen           native header hidden in favour of the editor top bar
 ├─ /settings              AppSettingsScreen           native header back affordance
 └─ modal routes (later)   NewBoardSheet, BoardMenuSheet, DeleteBoardDialog,
                           ImportBoardScreen, ToolOptionsSheet, ObjectInspectorSheet,
                           TextObjectEditor, StickyNoteEditor,
                           ImageSourceScreen, ImageCropScreen, OcrReviewScreen,
                           ExportSheet, ClearLocalDataDialog
```

Implemented today: `/`, `/editor`, `/settings` on one stack with `unstable_settings.anchor = 'index'`, so back always returns Home (see `docs/task-status.md`).

Sheets and dialogs in the map above are Stitch design references only; none exist in code yet.

### Presentation rules

| Surface | Presentation | Why |
|---|---|---|
| Home, Editor, Settings | push on the stack | real destinations |
| New board customisation | bottom sheet over Home | optional, never blocking |
| Board overflow menu | anchored sheet/popover | short-lived, contextual |
| Delete board | dialog over Home | destructive confirmation |
| Tool options, Object inspector | bottom sheet over the editor | must not hide the canvas |
| Text / sticky editing | in-canvas editor + floating toolbar | keeps the object in context |
| Image source, crop, OCR review | modal flow inside the editor stack | 3-step task with clear cancel |
| Export | bottom sheet over the editor | editor stays alive |
| Import board | modal flow from Home | returns to Home on cancel |
| Clear local data | dialog over Settings | destructive confirmation |

## Primary user flows

### 1. Home → New board → Editor
1. Home shows the grid (or empty state).
2. Tap `New board` — pressed state, no form.
3. A board `Untitled board` is created locally and a `Creating board` skeleton card appears.
4. The editor opens on an empty canvas with the empty-board hint.
5. Back returns to Home with the new card at the top of the grid.

Optional branch: `Customize` opens `NewBoardSheet` (canvas style, background, frame orientation) → `Create board`, or `Use defaults`. Cancel returns to Home and creates nothing.

### 2. Home → Open existing board → Editor
1. Tap a `BoardCard` (whole card is the target, overflow is separate).
2. Editor loads the board document and its object list.
3. Back returns to Home, updating the card's relative modified time.

Failure branch: a corrupt board shows `CorruptBoardCard` with recover-or-remove. Recovery never silently deletes data.

### 3. Editor → Pen → Draw
1. Tap `Pen` in the dock/rail (or it is already active).
2. Optionally tap again for `ToolOptionsSheet` (colour, width, opacity, highlighter toggle) → `Done`.
3. Draw. One stroke = one undoable command.
4. `Undo` / `Redo` in the top bar reflect stroke granularity.
5. Two-finger pan/zoom stays available while drawing.

### 4. Editor → Sticky note → Type → Save
1. Tap `Sticky note`.
2. Tap canvas — a standard-size note is created and focused immediately.
3. Keyboard rises; the canvas pans so the note stays visible; toolbar shows colour and text size.
4. Type. `Done` commits one command; `Cancel` removes the empty note.
5. Tapping an existing note re-enters editing directly (never via the inspector).

### 5. Editor → Text → Type → Save
1. Tap `Text`, then tap canvas — a caret appears.
2. Floating toolbar: font size, alignment, colour.
3. `Done` commits. Tapping outside commits. `Cancel` on an empty object discards it after a `Discard` confirmation.
4. The caret never hides under the keyboard.

### 6. Editor → Image → Choose → Crop → Place
1. Tap `Image` → `ImageSourceScreen` (`Take photo` / `Choose from library`) with the on-device notice.
2. `ImageCropScreen`: crop, rotate, flip, reset, aspect → `Continue`.
3. Around the flow, the choice is `Place image` or `Run OCR`.
4. The image lands on the canvas as a selectable object.
Camera permission denied: the library path stays fully available.

### 7. Editor → Image → OCR → Review → Add text to canvas
1. From crop (or an image on the canvas) → `OcrReviewScreen`.
2. `Recognising text on device` progress; actions disabled; cancel available.
3. Success: editable extracted text, then `Add text to board`.
4. No text found / error: `Add image only` remains the guaranteed escape hatch.
5. Only the edited text is committed, as a new text object near the image.

### 8. Editor → Export → Format → Share
1. Editor overflow (or board card overflow) → `ExportSheet`.
2. Scope: `Visible board` or `Selected region`.
3. Format: PNG, JPEG, PDF, or editable `.flowcanvas.json`.
4. `Export` → progress (editor stays responsive) → success with file name and size.
5. `Share` opens the system share sheet. Error state offers `Try again`.

### 9. Home → Import editable board backup
1. `Import board` → `ImportBoardScreen`.
2. `Choose file` → `.flowcanvas.json` from the file picker.
3. Validating state, then one of:
   - valid → the board opens in the editor;
   - invalid → `InvalidFileError` with `Choose another file`;
   - older schema → `MigrationNotice` → `Import as new board` (never overwrites; source file untouched).

### 10. Settings → Clear local data → Confirm
1. Settings `Data` → `Clear all local data` (destructive row).
2. `ClearLocalDataDialog` with the consequence paragraph and an acknowledgement checkbox.
3. `Delete everything` is enabled only after acknowledgement.
4. Everything local is deleted; the app returns to Home in its empty state.

### 11. Editor → Smart Teaching Utilities (Phase A)
1. **Laser pointer:** tap `Draw` → select `Laser` in `InkingQuickTray` (or tablet rail) → drag across the canvas. A glowing trail follows the finger/stylus and fades to `0%` opacity over `1200 ms` after release without adding an undo entry.
2. **Floating Timer:** `Insert` → `Utilities` → `Timer` opens `FloatingTimer`. Choose a preset (`1m`, `5m`, `10m`) or `Stopwatch` → `Start`. Minimize to a `104×40pt` corner pill while drawing, or tap `Pin to board` to place a summary note on the canvas.
3. **Floating Calculator:** `Insert` → `Utilities` → `Calculator` opens `FloatingCalculator`. Evaluate standard/scientific expressions (`sin(30°) × 12`) → tap `Paste to board` to insert `sin(30°) × 12 = 6` at the viewport center as one undoable command.

### 12. Editor → Geometry Box, 2D/3D Shapes & Table Creator (Phase B)
1. **Geometry Box:** `Insert` → `Geometry Box` toggles `Ruler`, `Protractor`, `Compass`, or `Set Square` on the Skia overlay. Drag to move, drag rotation handle to angle, and draw with `Pen` near the ruler/set-square edge to snap dead-straight measured lines, or sweep arcs with the compass/protractor.
2. **45+ Shapes & STEM Stamps:** `Insert` → `Shapes` opens categorized tabs (`2D Polygons`, `3D Solids`, `Graphs & Venn`, `STEM Stamps`). Tap or drag on canvas to place.
3. **Table Creator:** `Insert` → `Table` (`3×3` default) places a `TableObject`. Tap any cell on a selected table to edit cell text in place; use selection rail actions (`+ Row`, `- Row`, `+ Col`, `- Col`, `Header`) to adjust structure.

### 13. Editor → Math Formula, Smart Recognition & Stylus Polish (Phase C)
1. **Math Formula Builder:** `Insert` → `Math Formula` opens `MathKeyboardSheet`. Build fractions, roots, integrals, or matrices with live preview → `Insert formula` commits a vector `MathObject` on the canvas. Tap an existing `MathObject` to re-edit.
2. **Hold-to-Snap Shape:** draw a rough circle, rectangle, triangle, line, or arrow with `Pen` and hold still for `350 ms` at stroke end → stroke snaps into a crisp `ShapeObject`/`ConnectorObject`. Pressing `Undo` once reverts to the original freehand stroke.
3. **Lasso Ink-to-Text:** select handwritten strokes → tap `Convert to text` → review in `OcrReviewScreen` → `Replace with text` or `Add text beside`.

### 14. Editor → Multi-Page Boards & PDF Annotation (Phase D)
1. **Page navigation:** use the top-right `PageNavigator` pill (`< 1 / 3 > +`) to switch or add pages, or tap `1 / 3` to open `PageSorterSheet` (add, duplicate, reorder, delete pages).
2. **PDF Import for markup:** `Insert` / Overflow → `Import PDF` → pick `.pdf` → select page range → pages are added with locked worksheet backgrounds ready for pen and highlighter annotation.
3. **Multi-Page Export:** `ExportSheet` → scope `All pages` → exports a multi-page PDF or multi-page `.flowcanvas.json` backup.

### 15. Editor → Face-Cam & Lesson Recorder (Phase E)
1. Toggle `Face-Cam` to show a draggable, corner-snapping picture-in-picture bubble (`88pt`/`124pt`/`164pt`).
2. Tap `Record Lesson` → choose `480p`/`720p`/`1080p` and mic toggle → `3-2-1` countdown → `LessonRecorderBar` shows `Rec ● MM:SS`, `Pause`, and `Stop`.
3. `Stop` opens the Lesson Review & Replay modal to scrub/replay at `0.5×–2×` or share the recorded video/lesson package.

### 16. Live Classroom Host & Zero-Account Student Join (Phase F)
1. **Teacher Host:** in Editor, tap `Live Class` → `Start Live Class` generates a 6-digit room code and QR code in `LiveClassHostSheet`. Teacher draws, uses laser, and switches pages; everything streams live to connected students. Teacher can answer `👋 Raise Hand` requests by toggling `Allow to draw` (`Pass the Marker`), inspect the `Student Boards Gallery`, or `Lock class`.
2. **Student Join:** on Home, tap `Join live class` → enter 6-digit code + display name (no login required) → opens the live classroom board in `View-only` mode with `👋 Raise Hand` and `My Scratchpad` toggle.

## Back, cancel, and interruption rules

- System back and the header back chevron behave identically. `anchor = 'index'` guarantees Home underneath.
- Every sheet and dialog dismisses on scrim tap when nothing is unsaved.
- Unsaved text or sticky content commits on dismiss; only empty objects are discarded.
- Export and OCR survive backgrounding; a kill mid-export leaves the board unchanged.
- No flow requires a network connection at any point.
