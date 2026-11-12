# Architecture

## 1. Product architecture

FlowCanvas has five client-facing modes:

1. **Capture** — pen (with stylus pressure & palm rejection), laser pointer, text, sticky note, 45+ 2D/3D/STEM shapes, table, math equation, image, voice/lesson recording, camera & multi-page PDF import.
2. **Draft & Measure** — interactive Skia Geometry Box (Ruler, Protractor, Compass, Set Square), teaching canvas grids (`blank`, `dots`, `grid`, `ruled`, `isometric`), floating scientific calculator, and classroom timer.
3. **Understand** — on-device OCR, hold-to-snap shape recognition, lasso handwritten ink-to-text conversion, object grouping.
4. **Organize** — multi-page boards (`board_pages`), locked PDF worksheet backgrounds, AI-generated structure, summaries, task extraction.
5. **Teach & Act** — in-app lesson video/replay recorder with floating face-cam bubble, Live Classroom broadcasting (6-digit code & QR code join, Raise Hand, Pass-the-Marker, Student Boards gallery), multi-page PDF export, and `.flowcanvas.json` backups.

The system keeps drawing and teaching utilities 100% responsive even when the network and cloud services are unavailable.

## 2. High-level system

```text
React Native mobile app
  ├─ Canvas renderer (Skia: strokes, 2D/3D shapes, tables, math, laser, geometry box)
  ├─ Teaching utilities (Floating Timer, Scientific Calculator, Face-Cam, Lesson Recorder)
  ├─ Local document store (SQLite: boards, multi-page board_pages, canvas_objects, media_assets)
  ├─ On-device intelligence (ML Kit / Vision OCR, hold-to-snap shape recognizer, math layout)
  ├─ Classroom transport adapter (LocalLoopbackTransport + SupabaseRealtimeTransport)
  └─ AI action client
          │ HTTPS / WebSocket
          ▼
Optional cloud & live-classroom layer
  ├─ Live Classroom Realtime channels (6-digit code / QR join, zero-account student mode)
  ├─ Auth (optional for cloud workspaces)
  ├─ Postgres + Row Level Security
  ├─ Storage (board media and exports)
  └─ Edge Functions (AI gateway, webhooks, exports)
          │
          ├─ AI provider APIs
          ├─ Push notifications
          └─ RevenueCat / analytics / error tracking
```

## 3. Mobile application layers

### Presentation
- Expo Router for screens and deep links (`flowcanvas://join?code=...`).
- Skia canvas for rendering objects, pressure-sensitive ink, ephemeral laser trails, and interactive Geometry Box overlays.
- Gesture Handler + Reanimated for pan, pinch, stylus/palm filtering, selection, transform, and floating widget dragging.
- Accessibility actions for selecting, editing, and navigating objects and classroom tools without drawing gestures.

### Domain
- `BoardDocument`: per-page strokes and typed `CanvasObject` collection.
- `BoardPageRecord`: ordered page within a board (`order_index`, `document`, `viewport`, optional locked PDF `backgroundAssetId`).
- `CanvasObject`: `text`, `sticky`, `shape` (45+ 2D/3D/graph/STEM kinds), `connector`, `image` (with optional `locked` background flag and `ocr`), `table` (rows, columns, cells), and `math` (LaTeX subset + layout AST).
- Ephemeral overlays: `EphemeralLaserStroke`, `GeometryInstrumentState` (`ruler`, `protractor`, `compass`, `set-square`), `TimerState`, `CalculatorState`, `FaceCamState`, and `LessonRecordingTimeline`.
- `Operation`: append-only mutation with `id`, `actorId`, `deviceId`, `clientSeq`, timestamp, and payload.
- Commands (`stroke.add`, `strokes.erase`, `object.create`, `object.update`, `object.delete`, `objects.geometry`, `batch`).

### Data
- SQLite for offline boards, pending operations, cached thumbnails, and sync checkpoints.
- TanStack Query for server state and retries.
- Zustand for ephemeral UI state such as selection, tool, viewport, and modal state.
- Zod schemas shared between client and Edge Functions.

## 4. Board data model

```text
workspaces
  id, name, owner_id, plan, created_at
workspace_members
  workspace_id, user_id, role
boards
  id, workspace_id, title, cover, created_by, current_revision, archived_at
board_pages
  id, board_id, name, order_index
canvas_objects
  id, page_id, type, parent_id, x, y, width, height, rotation,
  z_index, content_json, style_json, deleted_at, revision
board_operations
  id, board_id, page_id, actor_id, device_id, client_seq,
  operation_type, payload_json, created_at
board_snapshots
  id, board_id, revision, document_json, created_at
board_comments
  id, board_id, object_id, author_id, body, resolved_at
ai_jobs
  id, board_id, user_id, job_type, input_refs, status,
  provider, usage_json, output_json, error_code, created_at
media_assets
  id, board_id, owner_id, storage_path, mime_type, bytes, metadata_json
```

The exact schema should be refined after interaction prototypes. Use Postgres RLS so every query is scoped to a workspace membership, not merely a client-provided board ID.

## 5. Sync and conflict strategy

1. Every local change is immediately applied optimistically to SQLite and the canvas.
2. The change is appended to an operation queue.
3. The sync worker uploads operations in `clientSeq` order.
4. The server validates membership, object ownership, and operation schema.
5. Realtime broadcasts accepted operations to connected clients.
6. A periodic snapshot compacts old operations.
7. On reconnect, the client downloads operations after its checkpoint and replays them.

For MVP, use last-write-wins for scalar fields and operation-level conflict handling for object movement. Do not attempt collaborative text editing until a real use case requires it. Ink strokes should be immutable objects; deleting or transforming a stroke is safer than mutating its points.

## 6. AI gateway

Never call paid AI providers directly from the mobile client. The Edge Function should:

- authenticate the user;
- verify board membership and selected-object access;
- remove unnecessary board data;
- enforce plan quotas and rate limits;
- select a model by task;
- redact or hash telemetry where possible;
- persist usage and job status;
- return structured JSON validated by Zod;
- support retries and idempotency keys.

Suggested AI actions:

| Action | Input | Output |
|---|---|---|
| Summarize section | selected text/object IDs | summary + key points |
| Organize board | board region | groups + suggested layout |
| Extract tasks | notes and connectors | task title, owner, due-date candidate |
| Find gaps | selected flow | questions and risks |
| Generate layout | object bounding boxes | positions and group frames |
| Transcribe voice | audio asset | transcript + extracted objects |
| Convert sketch | image/ink objects | typed shape hierarchy |

Use model/provider adapters so OpenAI, Anthropic, Google, or a self-hosted model can be changed without changing the app.

## 7. Security and privacy

- Supabase Auth with Apple, Google, and email magic link as appropriate.
- Postgres RLS on every tenant-owned table.
- Signed, short-lived media URLs.
- Encrypt sensitive local data where supported by the target platform.
- Avoid sending the whole board to AI by default; send only selected objects and nearby context.
- Explicit consent before audio/camera processing.
- Delete AI inputs and generated artifacts according to the user’s plan and privacy settings.
- Audit events for sharing, export, membership, and AI processing.

## 8. Observability

- Sentry: crashes, sync failures, AI failures, performance traces.
- PostHog: activation, first-board creation, AI action conversion, retention, feature usage.
- Structured server logs with request ID, user ID hash, job ID, latency, provider, tokens, and cost.
- Alerts for sync backlog, provider failures, storage growth, and abnormal AI spend.

## 9. Why this stack

React Native/Expo gives fast iOS and Android delivery. Skia is appropriate for a high-performance drawing surface. SQLite and an operation queue make offline work reliable. Supabase avoids prematurely managing separate auth, database, storage, and realtime services. Edge Functions provide a controlled boundary for AI, quotas, and provider changes.
