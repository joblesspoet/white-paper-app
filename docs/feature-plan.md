# Feature-by-feature plan

## Phase 0 — product and technical spike

**Goal:** validate the canvas interaction before building backend complexity.

- Define supported devices, portrait/landscape behavior, and target OS versions.
- Prototype pan, pinch, pen, selection, object movement, undo/redo.
- Measure 60 FPS rendering with 500 and 2,000 objects.
- Decide whether handwriting is free ink only or must become editable text.

**Exit criteria:** a user can create and edit a small board without network access.

## Phase 1 — MVP canvas (no auth, no AI)

The MVP is a local-first single-user application. It must be useful without an account, internet connection, AI provider, or backend. Boards are stored on the device and can be exported/imported manually.

### 1. Local board management
- Create, rename, duplicate, and delete boards.
- Recent boards list.
- Board thumbnails generated locally.
- Optional local folders/tags.
- Import/export a board file for backup and device transfer.

### 2. Core canvas
- Infinite canvas with viewport persistence.
- Pen/highlighter/eraser.
- Text, sticky notes, rectangles, circles, connectors.
- Select, multi-select, move, resize, rotate, duplicate, delete.
- Undo/redo and keyboard support where available.

### 3. Local persistence and history
- SQLite board database or a carefully versioned local document store.
- Autosave after mutations with debouncing.
- Undo/redo command history.
- Board snapshots and restore.
- Safe recovery after app termination.

### 4. Image and OCR capture
- Pick an image from the photo library or capture it with the camera.
- Crop, rotate, resize, and place the image on the canvas.
- Run OCR locally using a React Native-compatible OCR package.
- Show extracted text in an editable review screen before placing it on the board.
- Keep the source image and OCR text linked, so the user can re-run or correct extraction.
- Treat OCR as an optional capability because package support differs across iOS and Android.

### 5. Export and sharing
- Export the full board or selected region as PNG/JPEG.
- Generate PDF locally where practical.
- Export/import a versioned JSON board file for backup.
- Use the native share sheet.

**MVP acceptance:** a user can create a board, draw and place content, import an image, extract/edit OCR text locally, close and reopen the app without losing work, undo changes, and export/share the result.

## Phase 1.5 — Smart Teaching & Presentation Differentiation (Phases A–F)

Before final quality hardening (`18-quality-hardening.md`), FlowCanvas expands with six modular teaching, STEM, and live-classroom phases inspired by smart teaching boards (`com.teachingboard.aitricker`):

### Phase A — Smart Teaching & Presentation Utilities ([docs/phase-a-teaching-utilities.md](phase-a-teaching-utilities.md))
- **Laser pointer (`laser`):** glowing Skia pointer trail that decays over `1200 ms` without entering undo history or SQLite.
- **Teaching canvas backgrounds:** `grid` (math graph paper), `ruled` (notebook lines), and `isometric` (3D lattice) in addition to `blank` and `dots`.
- **Floating classroom timer & stopwatch:** draggable countdown/stopwatch widget with presets, visual ring, haptic alert, and `Pin to board`.
- **Floating scientific calculator:** deterministic standard + scientific calculator (`sin`, `cos`, `tan`, `√`, `xʸ`, `log`, `ln`, `π`) with one-tap `Paste to board`.

### Phase B — Interactive Geometry Box, 45+ 2D/3D Shapes & Table Creator ([docs/phase-b-geometry-shapes-tables.md](phase-b-geometry-shapes-tables.md))
- **Interactive Geometry Box:** Skia on-canvas **Ruler**, **Protractor**, **Compass**, and **Set Square (`45°` & `30°–60°`)** with magnetic pen edge snapping and arc sweeping.
- **Expanded 45+ 2D/3D/STEM Shape Library:** 2D polygons, 3D solids (`cube`, `cylinder`, `cone`, `pyramid`, `sphere` with dashed hidden edges), Cartesian axes, Venn diagrams, and STEM schematic stamps.
- **Table Creator (`TableObject`):** configurable rows/columns, column width ratios, header fill, and rotation-aware in-place cell editing.

### Phase C — Math Formula Builder, Smart Recognition & Stylus Polish ([docs/phase-c-math-recognition-stylus.md](phase-c-math-recognition-stylus.md))
- **Math Formula Builder (`MathObject`):** structured equation editor and symbol keypad rendering fractions, roots, exponents, integrals, sums, and matrices on canvas.
- **Hold-to-Snap Shape & Ink-to-Text Recognition:** pausing `350 ms` at stroke end converts rough lines, arrows, circles, rectangles, and triangles into crisp vector shapes; lassoing ink strokes converts handwriting to editable text via on-device OCR.
- **Stylus, S-Pen & Apple Pencil Polish:** per-point pressure sensitivity for variable-width strokes and a palm-rejection `Stylus-only drawing` mode.

### Phase D — Multi-Page Boards & Multi-Page PDF Annotation ([docs/phase-d-multipage-pdf-annotation.md](phase-d-multipage-pdf-annotation.md))
- **Multi-Page Board Switcher:** activates the `board_pages` table with `< Page X / N > +` navigation and a Page Sorter sheet (add, duplicate, reorder, delete pages).
- **Multi-Page PDF Import & Annotation:** import `.pdf` documents into consecutive board pages with locked worksheet backgrounds for pen, highlighter, and sticky-note markup.
- **Multi-Page Export:** export all board pages into a single multi-page PDF or multi-page `.flowcanvas.json` backup.

### Phase E — Lesson Recorder & Floating Face-Cam ([docs/phase-e-lesson-recorder-facecam.md](phase-e-lesson-recorder-facecam.md))
- **Floating Face-Cam Bubble:** draggable, resizable front/back camera picture-in-picture bubble with corner snapping.
- **Lesson Recorder & Replay:** in-editor recording HUD (`Rec ● MM:SS`, Pause, Stop, `480p`/`720p`/`1080p`) combining voice narration, face-cam, and deterministic 60 FPS canvas timeline replay / video export.

### Phase F — Live Classroom Broadcasting ([docs/phase-f-live-classroom.md](phase-f-live-classroom.md))
- **Host Live Class:** 1-tap classroom creation with a **6-digit numeric code** and **QR code** modal.
- **Zero-Account Student Join:** students join from Home with just the 6-digit code and display name.
- **Classroom Controls:** real-time teacher board & laser broadcast, **Raise Hand (`👋`)** queue, **Pass the Marker (`can-draw`)** permission grant, **Student Boards Gallery**, and **Lock Class**.

### Phase G — Magnetic Mind-Mapping, Live STEM Graphing & Spatial OCR Explode ([docs/phase-g-interactive-stem-mindmap.md](phase-g-interactive-stem-mindmap.md))
- **Magnetic Object Connectors & `+` Quick-Branching:** connectors bind to object ports (`top`, `right`, `bottom`, `left`) and auto-follow when objects move; selected sticky notes/shapes show cardinal `+` buttons to spawn connected child nodes in one tap.
- **Lasso "Tidy Up" Auto-Layout:** align 3+ selected objects into a clean grid, horizontal row, or vertical column in one undo step.
- **Live Function Plotter & Table-to-Chart Generator:** plot `MathObject` equations directly onto 2D axes with live coefficient sliders (`a`, `b`, `k`), and generate vector Bar/Line/Pie charts from any numeric `TableObject`.
- **"Explode Photo into Sticky Notes":** use `expo-mlkit-ocr` block bounding boxes to split a whiteboard photo into individual, movable sticky notes preserving their 2D spatial layout.

### Phase H — Active Recall Reveal Tape, Voice Pins & Presenter Teleprompter Layer ([docs/phase-h-active-recall-voice-presenter.md](phase-h-active-recall-voice-presenter.md))
- **Tap-to-Reveal Answer Tape & Stage Curtain / Spotlight:** mask equation answers or steps with interactive peelable tape (`RevealTapeObject`) and pull-down window curtain / spotlight focus overlays.
- **Spatial Voice-Pin Stickers (`VoicePinObject`):** drop compact voice-feedback pins (`🎤 0:12`) with Skia mini waveforms directly onto PDF worksheets or diagrams.
- **Presenter-Only Teleprompter Layer (`isPrivate`):** private teacher notes visible on the presenter's canvas but automatically stripped from student Live Classroom broadcasts and public PNG/PDF exports.
- **Live Classroom Pop-Quiz Poll & Flashcard Study Mode:** 1-tap `A/B/C/D` live classroom polls with instant canvas bar-chart insertion, plus a swipeable Flashcard Study Mode generated from reveal tapes and connected sticky notes.

## Phase 2 — authentication and cloud sync

Authentication should be added after the local core is stable.

### 6. Accounts and workspace
- Email/social sign-in.
- Personal workspace.
- Optional account migration from local boards.

### 7. Cloud sync
- Postgres board storage.
- Realtime updates for a single user across devices.
- Revision history with manual restore.
- Conflict handling and offline operation queue.

## Phase 3 — AI and advanced capture

### 6. Voice-to-canvas
- Record audio with clear consent.
- Upload compressed audio.
- Transcribe asynchronously.
- Show transcript for editing before placing notes.
- Extract action items only after user confirmation.

### 7. Camera/whiteboard import
- Capture or select image.
- Crop, de-skew, remove glare where possible.
- OCR into editable text and preserve source image.

### 8. AI assistant
- Ask about selected content.
- Summarize region.
- Extract tasks.
- Identify questions, risks, and missing steps.
- Always show source objects and allow undo.

### 9. Smart organization
- Detect clusters and suggest frames.
- Clean rough shapes into consistent shapes.
- Offer preview before applying layout changes.

**Acceptance:** AI never silently changes the board; all mutations are previewable and undoable.

## Phase 3 — collaboration

### 10. Sharing and permissions
- Invite by email/link.
- Viewer, commenter, editor roles.
- Revoke access and audit sharing.

### 11. Presence and comments
- Presence indicators and cursors.
- Object comments and mentions.
- Resolve comments.

### 12. Collaborative editing
- Realtime operation broadcast.
- Offline merge and conflict status.
- Snapshot compaction.

**Acceptance:** two users can edit separate objects and see updates without losing local changes.

## Phase 4 — differentiation

### 13. Board time machine
- Timeline scrubber.
- Named checkpoints.
- Compare revisions.
- Restore into a new revision, never destructive overwrite.

### 14. Focus lens
- Select an object and show connected context.
- Hide unrelated regions.
- Return to full board without changing data.

### 15. Prototype mode
- Mark frames as screens.
- Connect frames with arrows.
- Preview as a clickable flow.

### 16. Private thinking layer
- Personal layer on shared board.
- Reveal/share selected items.
- Clear privacy labels in UI.

## Phase 5 — monetization and scale

- Free limits: boards, collaborators, AI actions, export resolution, storage.
- Pro: larger boards, more AI, history, advanced export.
- Team: shared workspace, admin controls, audit, SSO later.
- RevenueCat entitlement checks with server-side plan enforcement.
- Usage dashboard and AI budget controls.

## Recommended build order

1. Canvas spike
2. Local persistence and undo/redo
3. Auth and cloud boards
4. Sync and export
5. Voice/OCR capture
6. AI assistant with one safe action: summarize
7. AI task extraction and organization
8. Sharing and presence
9. History/focus/prototype features

## Out of scope for first release

- Full free-form collaborative rich-text editing
- AR editing of physical boards
- Automatic reminders without confirmation
- Autonomous AI changes
- Enterprise SSO and compliance certifications
- Desktop/web parity
