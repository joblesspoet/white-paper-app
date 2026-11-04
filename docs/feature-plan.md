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
