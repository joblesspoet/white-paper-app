# Screen and feature architecture

This document defines the screen map before implementation. We will build and test one vertical slice at a time. The MVP remains local-only: no auth, backend, realtime collaboration, or AI.

## Product navigation decision

Use a simple stack-based navigation flow rather than tabs for the first MVP.

```text
AppRoot
 ├─ HomeScreen
 │   ├─ BoardSearchScreen (later, optional)
 │   ├─ BoardOptionsSheet
 │   └─ ImportBoardScreen
 ├─ BoardEditorScreen
 │   ├─ ToolPickerSheet
 │   ├─ ObjectInspectorSheet
 │   ├─ InsertMenuSheet
 │   ├─ ImageImportFlow
 │   │   ├─ ImageSourceScreen
 │   │   ├─ ImageCropScreen
 │   │   └─ OcrReviewScreen
 │   ├─ ExportSheet
 │   └─ BoardSettingsSheet
 └─ AppSettingsScreen
```

### Why no bottom tabs initially?

The central activity is editing a board. Tabs would add navigation weight without providing distinct top-level destinations. Home is the collection area; the editor is a focused full-screen workspace. We can add tabs later if templates, shared boards, and account settings become major areas.

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

Each slice should be runnable, manually tested, and committed before starting the next slice.
