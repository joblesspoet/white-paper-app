# Session 25 — Phase F: Live Classroom Broadcasting (6-Digit Code & QR Join)

Read `README.md`, `docs/task-status.md`, `docs/agent-workflow.md`, `docs/phase-f-live-classroom.md`, `docs/architecture.md`, and `docs/screen-architecture.md`. Inspect `app/index.tsx`, `app/editor.tsx`, and `src/canvas/document.ts` before making changes.

Implement only Phase F:
1. **Classroom Transport & Protocol (`src/classroom/protocol.ts`, `src/classroom/transport.ts`, `src/classroom/classroom-session.ts`):**
   - Implement schema-validated envelopes (`snapshot.sync`, `command.broadcast`, `ephemeral.stream`, `classroom.control`, `student.board.update`).
   - Provide `SupabaseRealtimeTransport` (when `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` are configured) and `LocalLoopbackTransport` for offline multi-peer simulation and verification.
2. **Teacher Host Flow (`src/components/LiveClassHostSheet.tsx`, `src/components/ClassroomHud.tsx`):**
   - Generate a 6-digit numeric room code and an SVG QR code (`react-native-svg`) with deep-link support (`flowcanvas://join?code=...`).
   - Broadcast teacher strokes, objects, laser pointer, Geometry Box, timer, and page switches in real time.
   - Manage the student roster, **Raise Hand (`👋`)** queue, per-student **Pass the Marker (`can-draw`)** permission grant/revoke, **Student Boards Gallery** preview & showcase, and **Lock Class** toggle.
3. **Zero-Account Student Join Flow (`src/components/JoinClassModal.tsx`, `app/index.tsx`, `app/editor.tsx`):**
   - Add `Join live class` on Home where students enter the 6-digit code and display name with no account required.
   - Support `View-only` live board following, `👋 Raise Hand`, switching to `My Scratchpad`, and drawing on the shared board when granted `can-draw`.

Add `scripts/verify-live-classroom.mts` and wire `npm run test:live-classroom` into `npm test`. Run `npm run typecheck`, `npm test`, and bundle checks. Update `docs/task-status.md`; next task is Session 26 — Phase G: Magnetic Mind-Mapping, Live STEM Graphing & Spatial OCR Explode.
