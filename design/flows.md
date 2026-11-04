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

## Back, cancel, and interruption rules

- System back and the header back chevron behave identically. `anchor = 'index'` guarantees Home underneath.
- Every sheet and dialog dismisses on scrim tap when nothing is unsaved.
- Unsaved text or sticky content commits on dismiss; only empty objects are discarded.
- Export and OCR survive backgrounding; a kill mid-export leaves the board unchanged.
- No flow requires a network connection at any point.
