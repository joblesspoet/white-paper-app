# Session 23 — Phase D: Multi-Page Boards & Multi-Page PDF Annotation

Read `README.md`, `docs/task-status.md`, `docs/agent-workflow.md`, `docs/phase-d-multipage-pdf-annotation.md`, `docs/screen-architecture.md`, and `src/persistence/schema.ts`. Inspect `src/persistence/repository.ts`, `src/export/export-service.ts`, `src/export/backup.ts`, and `app/editor.tsx` before making changes.

Implement only Phase D:
1. **Multi-Page Board Switcher & Page Sorter (`src/persistence/repository.ts`, `src/components/PageNavigator.tsx`):** activate multi-page support on top of the `board_pages` table (`createPage`, `duplicatePage`, `renamePage`, `reorderPages`, `deletePage` with single-page guard). Add the compact `< Page X / N > +` navigator pill and slide-up Page Sorter sheet in `app/editor.tsx`. Flush pending autosaves cleanly when switching pages.
2. **Locked background objects & Multi-Page PDF Import (`src/pdf/pdf-import-service.ts`):** add `locked?: boolean` to `CanvasObjectBase` so locked background worksheet images cannot be accidentally dragged by normal single-finger `Select` gestures, and implement PDF import (`expo-document-picker` + page range selection + per-page `board_pages` creation with locked page backgrounds and graceful Expo Go fallback).
3. **Multi-Page PDF & Backup Export (`src/export/export-service.ts`, `src/export/backup.ts`):** add `All pages` scope to `ExportSheet` so `exportBoardPdf` renders all board pages in `order_index` order into a multi-page PDF, and upgrade `.flowcanvas.json` backups to preserve and restore all board pages while keeping v1 single-page backup import compatible.

Add `scripts/verify-multipage-pdf.mts` and wire `npm run test:multipage-pdf` into `npm test`. Run `npm run typecheck`, `npm test`, and bundle checks. Update `docs/task-status.md`; next task is Session 24 — Phase E: Lesson Recorder & Floating Face-Cam.
