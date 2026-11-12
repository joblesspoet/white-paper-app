# Screen and feature architecture

This document defines the screen map before implementation. We will build and test one vertical slice at a time. The MVP remains local-only: no auth, backend, realtime collaboration, or AI.

## Product navigation decision

Use a simple stack-based navigation flow rather than tabs for the first MVP.

```text
AppRoot
 ├─ HomeScreen
 │   ├─ BoardSearchScreen (later, optional)
 │   ├─ BoardOptionsSheet
 │   ├─ ImportBoardScreen
 │   └─ JoinClassModal (Phase F: 6-digit code & student name)
 ├─ BoardEditorScreen
 │   ├─ ToolPickerSheet & InkingQuickTray (with Laser Pointer & Palm Rejection toggle)
 │   ├─ ObjectInspectorSheet / EditorInspectorPanel (Table, Math, Locked object actions)
 │   ├─ InsertMenuSheet (QuickCreationSheet: 45+ 2D/3D/STEM shapes, Table, Math, Utilities, PDF import)
 │   ├─ FloatingTimer & FloatingCalculator (Phase A: draggable classroom widgets)
 │   ├─ GeometryBoxOverlay (Phase B: Skia Ruler, Protractor, Compass, Set Square)
 │   ├─ MathKeyboardSheet (Phase C: structured equation builder)
 │   ├─ PageNavigator & PageSorterSheet (Phase D: multi-page board switcher & PDF markup)
 │   ├─ FaceCamBubble & LessonRecorderBar (Phase E: PiP camera & lesson recording/replay)
 │   ├─ LiveClassHostSheet & ClassroomHud (Phase F: 6-digit code, QR, Raise Hand, Student Boards)
 │   ├─ ImageImportFlow
 │   │   ├─ ImageSourceScreen
 │   │   ├─ ImageCropScreen
 │   │   └─ OcrReviewScreen
 │   ├─ ExportSheet (Single page, Selection, or All pages PDF/Backup)
 │   └─ BoardSettingsSheet
 └─ AppSettingsScreen
```

### Why no bottom tabs initially?

The central activity is editing a board. Tabs would add navigation weight without providing distinct top-level destinations. Home is the collection area; the editor is a focused full-screen workspace. We can add tabs later if templates, shared boards, and account settings become major areas.

### Route map (implemented)

Navigation is Expo Router file-based routing on a single native stack. `unstable_settings.anchor = 'index'` keeps Home underneath deep-linked routes, so back always returns Home.

| Route | File | Screen |
|---|---|---|
| `/` | `app/index.tsx` | Home / Boards (own safe-area header) |
| `/editor` | `app/editor.tsx` | Board editor |
| `/settings` | `app/settings.tsx` | App settings |

Sheets and flows in the map below become routes or modal routes in later slices; none exist yet.

## Screen 1: Home / Boards

### Purpose
The entry point for discovering and creating local boards.

### Primary user jobs
- Continue a recent board.
- Create a blank board.
- Import a board backup.
- Rename, duplicate, export, or delete a board.
- See when a board was last edited.

### Layout
- Safe-area header: FlowCanvas wordmark/title and settings icon.
- Primary CTA: `New board`.
- Optional search field when more than five boards exist.
- Recent boards displayed as a two-column adaptive grid on phones/tablets.
- Each board card contains thumbnail, title, relative modified date, and overflow menu.
- Empty state explains the first action and shows one prominent CTA.

### States
- First launch / empty.
- Populated.
- Loading local database.
- Corrupt-board recovery.
- Importing.
- Delete confirmation.

### Components
`HomeHeader`, `NewBoardButton`, `BoardGrid`, `BoardCard`, `BoardMenu`, `EmptyBoardsState`, `ImportButton`.

### Data contract
```ts
type BoardSummary = {
  id: string;
  title: string;
  thumbnailUri?: string;
  updatedAt: string;
  objectCount: number;
};
```

## Screen 2: New Board flow

### Default behavior
Tapping `New board` immediately creates a board named `Untitled board` and opens the editor. The title can be changed later. Avoid a form for the common path.

### Optional configuration
A secondary `Customize` action may choose:
- Blank canvas or subtle dot grid.
- Canvas background color.
- Portrait or landscape starting frame.

Do not block board creation with these options.

## Screen 3: Board editor

### Purpose
The canvas is the product. UI must stay out of the way while preserving discoverability.

### Layout zones
- Top bar: back, editable board title, undo, redo, overflow.
- Canvas: full remaining viewport, rendered by Skia.
- Floating tool dock: pen, eraser, select, text, sticky, shape, connector, image.
- Contextual bottom sheet: appears only when a tool needs options.
- Mini-map: hidden by default; optional on tablet or large boards.

### Editor modes
```ts
type EditorMode =
  | 'select'
  | 'pen'
  | 'highlighter'
  | 'eraser'
  | 'text'
  | 'sticky'
  | 'shape'
  | 'connector'
  | 'image';
```

### Core interaction rules
- One primary gesture per canvas mode.
- Two-finger pan/zoom must remain available while drawing where platform behavior permits.
- Selected objects show a clear bounding box and handles.
- Tool changes never modify the board.
- Every mutation creates one undoable command.
- Canvas remains usable in landscape and on tablets.

### Canvas viewport model (implemented)
```ts
type Viewport = { x: number; y: number; scale: number };
// screen = canvas * scale + offset
// canvas = (screen - offset) / scale
```
- Zoom is clamped to 0.5×–4×.
- One-finger drag pans in Select mode; during drawing/erasing/text placement, two fingers pan and pinch together.
- Pinch zoom anchors the canvas point under the gesture focal point, so the board does not drift toward the screen center.
- `Reset view` returns the viewport to the origin at 100%.
- Temporary debug grid points and colored canvas-space markers prove that screen ↔ canvas conversion stays correct while panning and zooming.

### Editor states
- Empty board guidance.
- Normal editing.
- Object selected.
- Multi-selection.
- Saving locally.
- Recovered unsaved changes.
- Exporting.
- OCR/image processing.

## Screen 4: Tool picker and tool options

### Tool dock
Use icon plus short label on first use; collapse to icons after the user has interacted. All icons must use one vector family and have at least 44pt touch targets.

### Options by tool
- Pen/highlighter: color, stroke width, opacity.
- Eraser: stroke/object mode.
- Shape: shape type, fill, border, color.
- Connector: line, arrow, elbow connector.
- Sticky note: color and text size.

Options should be a compact bottom sheet, not a full navigation screen.

## Screen 5: Object inspector

Appears after selecting one or more objects.

Actions:
- Delete.
- Duplicate.
- Bring forward/send backward.
- Group/ungroup.
- Lock/unlock.
- Change color/style.
- Add comment placeholder for future cloud phase (not functional in MVP).

For text and sticky notes, tapping the object enters direct editing rather than opening the inspector first.

## Screen 6: Text and sticky note editing

### Text
- Tap canvas to place a text object.
- Open native keyboard.
- Provide font size, alignment, and color options.
- Commit on Done or tapping outside.
- Cancel removes an empty object.

### Sticky note
- Create at a standard size.
- Immediate keyboard focus.
- Resize after text entry.
- Preserve readable contrast for every note color.

### Keyboard behavior
- Keyboard must not cover the active object.
- Editor pans or temporarily zooms to keep the editing target visible.
- Return focus predictably after dismissal.

### Canvas objects (implemented)

```ts
type CanvasObject =
  | { type: 'text'; colorKey: TextColorKey; fontSize: number; text: string; x, y, width, height, rotation }
  | { type: 'sticky'; colorKey: StickyColorKey; fontSize: number; text: string; x, y, width, height, rotation };

type CanvasDocument = { strokes: InkStroke[]; objects: CanvasObject[] };
```

- `src/canvas/document.ts` holds the object model, the palettes, the hit test, and one `applyCommand` reducer. Positions and sizes are canvas units, so panning and zooming never move or resize an object.
- Tap-to-create with the text or sticky tool centres the object on the canvas point under the finger; the note is a fixed 112×112 standard size, a text object is 160 wide and grows downwards as the text wraps.
- The in-place editor is a real `TextInput` positioned over the object and scaled with the viewport, so the caret sits where the text will land. Font size and colour are changed from the sheet that floats above the keyboard.
- Committing: `Done`, a tap on the canvas, a tool change, the title field, back, or blur. All of them go through one path (`editingCommit`), and an empty object is discarded instead of stored.
- Keyboard safety: when the keyboard appears the viewport is panned (never zoomed) so the edited object sits inside the band above the keyboard and the style sheet. The object keeps its board position.
- Selection: in Select mode a touch selects, a drag moves the whole selection (one undo step), and a tap on the already selected text or sticky note enters editing. A single object shows a rotation-aware outline with four 12pt corner handles and a rotate stem; resizing re-wraps text, keeps the opposite corner fixed, and respects a 24pt minimum. The rotate handle keeps the angle under the finger and snaps near 15°. A long-press on empty canvas then a drag draws a marquee for a multi-selection, whose axis-aligned union box can be moved, duplicated, or deleted. A vertical action rail sits beside the selection, vertically centred: it prefers the right side, flips to the left near the right canvas edge, and only overlaps the selection when neither side fits, so it never covers the rotate stem above the selection. The rail exposes accessible `Edit`, `Style`, `Duplicate`, and `Delete` actions; `Edit` and `Style` appear for one object only.
- Every transform and multi-object action is one history command: a resize/rotate/multi-move gesture merges its samples into one entry, and multi-duplicate/delete use one batched entry.
- Sticky pastels (`butter`, `blush`, `mint`, `sky`, `lilac`) always carry `#134E4A` text; text colours have a light and a dark variant. Both sets are asserted at 4.5:1 or better in `scripts/verify-objects.mts`.
- Ink and objects share one history (`src/canvas/history.ts`): a drag or an eraser sweep is a single entry, and undo steps back through ink and notes in the order they were made.

Not in this slice: images, OCR, persistence, grouping, and alignment guides.

## Screen 7: Image import and OCR flow

```text
Insert image
  → Choose Camera or Photo Library
  → Crop/rotate image
  → Place image or Run OCR
  → OCR review/edit
  → Add extracted text to canvas
```

### Image source screen
Use two large actions: `Take photo` and `Choose from library`. Explain that OCR runs on-device where supported.

### Crop screen
- Crop rectangle.
- Rotate.
- Reset.
- Confirm and cancel.
- Preserve original asset separately from crop metadata.

### OCR review screen
- Image preview on top or left depending on orientation.
- Editable extracted text field.
- `Add text to board` primary action.
- `Add image only` secondary action.
- Clear error state if recognition fails.

OCR is an enhancement, never a gate for placing an image.

## Screen 8: Export and import

### Export sheet
- Export visible board.
- Export selected region.
- PNG.
- JPEG.
- PDF.
- Share.

Show estimated operation status for large boards and never freeze the editor.

### Board backup
- Export editable `.flowcanvas.json` file.
- Import from file picker.
- Validate schema version before opening.
- If migration is needed, create a new board rather than overwriting an existing one.

## Screen 9: Settings

MVP settings:
- Theme: system/light/dark.
- Default canvas background.
- Default pen color and width.
- Haptics on/off.
- Reduced motion respect is automatic.
- Export format preference.
- About and privacy information.
- Clear all local data with destructive confirmation.

## Tablet and responsive rules

- Phone: floating tool dock near the bottom, compact top bar.
- Tablet portrait: tool dock may become a vertical rail.
- Tablet landscape: persistent left tool rail and right inspector panel are allowed.
- Do not simply stretch phone cards; increase gutters and use two-pane layouts where useful.
- Keep canvas as the dominant surface at every breakpoint.

## Implementation slices

1. Bootstrap app and render a Home placeholder.
2. Add navigation stack and Home board list with in-memory data.
3. Add editor route with static canvas surface.
4. Add Skia viewport and pan/zoom.
5. Add ink drawing and undo/redo.
6. Add text, sticky, shape, and selection objects.
7. Replace in-memory state with local persistence.
8. Add image import and placement.
9. Add OCR adapter and review screen.
10. Add export/import and settings.
11. Test phone, tablet, landscape, accessibility, and crash recovery.
12. **Phase A (`docs/phase-a-teaching-utilities.md`):** Laser pointer (`laser`), teaching canvas grids (`grid`, `ruled`, `isometric`), `FloatingTimer`, and `FloatingCalculator` (`Paste to board`).
13. **Phase B (`docs/phase-b-geometry-shapes-tables.md`):** `GeometryBoxOverlay` (`Ruler`, `Protractor`, `Compass`, `Set Square`), 45+ 2D/3D/graph/STEM shapes, and `TableObject` with in-place cell editing.
14. **Phase C (`docs/phase-c-math-recognition-stylus.md`):** `MathObject` & `MathKeyboardSheet`, `350 ms` hold-to-snap shape recognition, lasso ink-to-text OCR, stylus pressure strokes, and palm rejection.
15. **Phase D (`docs/phase-d-multipage-pdf-annotation.md`):** `PageNavigator` & `PageSorterSheet` over `board_pages`, locked PDF worksheet backgrounds, multi-page PDF import, and multi-page PDF/backup export.
16. **Phase E (`docs/phase-e-lesson-recorder-facecam.md`):** `FaceCamBubble` PiP camera, `LessonRecorderBar` (`480p`/`720p`/`1080p`), and deterministic 60 FPS lesson replay.
17. **Phase F (`docs/phase-f-live-classroom.md`):** `LiveClassHostSheet` (6-digit code & QR code), `JoinClassModal` on Home, `ClassroomHud`, Raise Hand queue, Pass-the-Marker, and Student Boards gallery.
18. **Quality hardening (`prompts/18-quality-hardening.md`):** release-readiness pass across all slices.

Each slice should be runnable, manually tested, and committed before starting the next slice.
