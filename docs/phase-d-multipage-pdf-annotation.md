# Phase D — Multi-Page Boards & Multi-Page PDF Annotation

## Scope and product goal

Phase D activates the multi-page board model that was already provisioned in SQLite migration 1 (`board_pages` table in `src/persistence/schema.ts`) and adds full PDF document import, page-by-page annotation, and multi-page PDF export—a flagship workflow in `com.teachingboard.aitricker` for marking up worksheets, slides, and textbooks.

1. **Multi-Page Board Switcher & Page Sorter (`src/components/PageNavigator.tsx`)** — navigate between pages (`Page 1 / N`), add blank pages, duplicate, rename, reorder, and delete pages with per-page undo history and independent or shared viewport state.
2. **Multi-Page PDF Import & Annotation (`src/pdf/pdf-import-service.ts`)** — pick a local `.pdf` file via `expo-document-picker`, rasterize each selected page into a durable media asset, and create corresponding `board_pages` with locked background worksheet images ready for pen, highlighter, sticky note, and shape markup.
3. **Multi-Page PDF & Backup Export (`src/export/export-service.ts`, `src/export/backup.ts`)** — export either the current page or all pages of a board into a single multi-page PDF document, and preserve all pages in `.flowcanvas.json` backups.

## 1. Multi-Page Board Architecture (`src/persistence/repository.ts`, `src/canvas/document.ts`)

### SQLite schema & repository contract
`board_pages` already exists in `src/persistence/schema.ts`:
```sql
CREATE TABLE IF NOT EXISTS board_pages (
  id TEXT PRIMARY KEY NOT NULL,
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)
```
Extend `src/persistence/repository.ts` so a board's full state includes an ordered array of pages:
```ts
export type BoardPageRecord = {
  id: string;
  boardId: string;
  name: string;
  orderIndex: number;
  document: CanvasDocument;
  viewport: Viewport;
  backgroundAssetId?: string;
};
```
- **Migration 4 (optional column addition):** add `viewport_json TEXT` and `background_asset_id TEXT` to `board_pages` so each page can optionally remember its own camera position and locked PDF page background.
- **Backward compatibility:** single-page boards created in earlier slices automatically hydrate their `order_index = 0` page (`Page 1`) without data loss.

### Editor Page Navigator UI (`src/components/PageNavigator.tsx`)
- **Compact page pill:** anchored in the top-right canvas margin or beside the top bar (`<  1 / 4  >  +`), using `44×44pt` touch targets.
- **Page Sorter Sheet / Drawer:** tapping `1 / 4` opens the Page Sorter showing page cards with object/stroke counts, page title, `Add page`, `Duplicate page`, `Move up/down`, and `Delete page` (preventing deletion of the last remaining page).
- Switching pages flushes any pending debounced autosave on the outgoing page before hydrating the incoming page.

## 2. Multi-Page PDF Import & Worksheet Markup (`src/pdf/pdf-import-service.ts`)

### Import lifecycle
```text
Insert / Overflow → Import PDF for markup
  → Pick .pdf via expo-document-picker
  → Page range preview modal (All pages or custom range, max 30 pages per import batch)
  → Render each PDF page to durable JPEG/PNG in media/<boardId>/pdf-pages/
  → Create one board_page per imported PDF page with a locked background ImageObject
  → Jump to first imported page ready for pen / highlighter / sticky annotation
```
- **Locked background worksheet mode:** add `locked?: boolean` to `CanvasObjectBase` (`src/canvas/document.ts`). A locked PDF page image renders beneath strokes and annotations, cannot be accidentally dragged by single-finger `Select` gestures, and can be unlocked/relocked from the object inspector if needed.
- **Graceful fallback:** if native PDF page rasterization is unavailable in Expo Go, show an honest capability banner explaining that native PDF page rendering requires a development build while keeping standard image and `.flowcanvas.json` import available.

## 3. Multi-Page PDF & Backup Export (`src/export/export-service.ts`, `src/export/backup.ts`)

- **Export Sheet scope options:**
  - `Current page (visible)`
  - `Current selection`
  - `All pages (PDF / Backup)`
- **Multi-Page PDF generation:** `exportBoardPdf` iterates through all pages in `orderIndex` order, renders each page offscreen via Skia (`Skia.Surface.MakeOffscreen`) with event-loop yielding between pages, and composes a multi-page HTML print document with `page-break-after: always` passed to `Print.printToFileAsync`.
- **Multi-Page `.flowcanvas.json` backup:** version 2 backup schema embeds `pages: BoardPageBackup[]` while keeping a `document` mirror of page 0 so v1 readers or legacy checks remain predictable, and migrating v1 single-page backups seamlessly into a 1-page board on import.

## Verification (`scripts/verify-multipage-pdf.mts`)

Add `npm run test:multipage-pdf` covering:
- Multi-page CRUD in SQLite (`createPage`, `duplicatePage`, `reorderPages`, `deletePage`, guard against deleting the sole remaining page, and `order_index` integrity).
- Locked background object hit-test filtering (confirming locked PDF background images are skipped by normal drag selection unless explicitly targeted in the inspector, while annotations on top select and move normally).
- Multi-page PDF HTML/print layout assembly and progress reporting across multiple pages.
- Versioned `.flowcanvas.json` backup export and import round-trip preserving all pages, page order, objects, strokes, and embedded media assets.
