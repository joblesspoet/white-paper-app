# MVP roadmap

## Milestone 1 — canvas proof of concept

**Deliverables:** mobile canvas, pan/zoom, pen, sticky note, shape, selection, undo/redo.

**Quality bar:** smooth interaction on a mid-range test device; no lost edits when switching tools.

## Milestone 2 — local-first app

**Deliverables:** SQLite document store, operation queue, board list, offline reopen, crash recovery.

**Quality bar:** kill and relaunch during edits without losing acknowledged local work.

## Milestone 3 — image capture and local OCR

**Deliverables:** camera/photo import, crop/rotate, local OCR, editable OCR review, image/text placement.

**Quality bar:** OCR failure never blocks image placement; users can correct extracted text before insertion.

## Milestone 4 — local MVP & responsive tablet support (completed)

**Deliverables:** export/import, local PDF/image sharing, settings, responsive phone/tablet layouts across 13 device profiles.

**Quality bar:** a user can use the complete local app on phones and tablets in portrait and landscape without an account or network connection.

## Milestone 4A — smart teaching & presentation utilities (Session 20 / Phase A)

**Deliverables:** decaying laser pointer tool, `grid` / `ruled` / `isometric` canvas backgrounds, floating classroom timer/stopwatch, and floating scientific calculator with `Paste to board`.

**Quality bar:** all utilities operate smoothly at 60 FPS without polluting undo history unless explicitly pinned/pasted to the board.

## Milestone 4B — geometry box, 45+ 2D/3D shapes & tables (Session 21 / Phase B)

**Deliverables:** interactive Skia Ruler, Protractor, Compass, Set Square with magnetic edge/arc snapping, 45+ 2D/3D/graph/STEM shapes, and `TableObject` with in-place cell editing.

**Quality bar:** ruler-snapped strokes and 3D/table objects survive undo/redo, SQLite relaunch, and PNG/JPEG/PDF export with 1:1 fidelity.

## Milestone 4C — math formulas, smart recognition & stylus polish (Session 22 / Phase C)

**Deliverables:** `MathObject` equation builder, `350 ms` hold-to-snap shape recognition, lasso ink-to-text OCR, stylus pressure strokes, and palm-rejection mode.

**Quality bar:** hold-to-snap never falsely converts normal handwriting, and Undo restores the original freehand stroke if desired.

## Milestone 4D — multi-page boards & multi-page PDF annotation (Session 23 / Phase D)

**Deliverables:** multi-page switcher & page sorter over `board_pages`, locked background objects, multi-page PDF import for worksheet markup, and multi-page PDF/backup export.

**Quality bar:** switching pages never loses unsaved edits, and locked PDF worksheet backgrounds cannot be accidentally dragged while annotating.

## Milestone 4E — lesson recorder & floating face-cam (Session 24 / Phase E)

**Deliverables:** draggable face-cam picture-in-picture bubble, in-editor lesson recording HUD (`480p`/`720p`/`1080p`), deterministic canvas + audio lesson replay, and native video export adapter.

**Quality bar:** recording never freezes canvas drawing, and missing native screen-capture modules in Expo Go degrade gracefully to deterministic canvas replay.

## Milestone 4F — live classroom broadcasting (Session 25 / Phase F)

**Deliverables:** 6-digit code & QR code live class host sheet, zero-account student join flow, real-time stroke/laser/page sync, Raise Hand queue, Pass-the-Marker student drawing permission, Student Boards gallery, and Lock Class.

**Quality bar:** view-only students can never mutate the teacher's board unless explicitly granted write access, and automated multi-peer tests pass via `LocalLoopbackTransport`.

## Milestone 4G — interactive STEM, magnetic mind-mapping & spatial OCR explode (Session 26 / Phase G)

**Deliverables:** magnetic port-bound connectors, `+` quick-branch handles, Lasso `Tidy up` auto-layout, `MathObject` live function plotter with parameter sliders, `TableObject` vector chart generator, and spatial multi-sticky OCR explosion.

**Quality bar:** bound connectors never detach during moves/rotations/undo, and function plotting handles asymptotes (`1/x`, `tan(x)`) without NaN/Infinity rendering artifacts.

## Milestone 4H — active recall reveal tape, voice pins & presenter layer (Session 27 / Phase H)

**Deliverables:** `RevealTapeObject` & `StageCurtainOverlay`, `VoicePinObject` audio stickers, `isPrivate` presenter-only teleprompter layer, Live Class `A/B/C/D` pop-quiz polls, and 1-Thumb Flashcard Study Mode.

**Quality bar:** `isPrivate` objects never leak to student classroom broadcasts or default image/PDF exports.

## Milestone 4I — quality hardening (Session 18, resumed after Phase H)

**Deliverables:** end-to-end release readiness pass across core MVP + Phases A–H, error boundaries, accessibility audit, memory/performance stress tests, and final verification.

## Milestone 5 — authentication and cloud foundation

**Deliverables:** authentication, Postgres schema, RLS, storage, sync, revisions, optional local-board migration.

**Quality bar:** security tests prove users cannot read or mutate another workspace’s board.

## Milestone 6 — AI assistant

**Deliverables:** selected-region summary, task extraction, usage quotas, AI job history, cost logging.

**Quality bar:** structured response validation, retry safety, undo for generated objects, spend limit.

## Milestone 7 — beta collaboration

**Deliverables:** sharing roles, comments, presence, realtime object operations, conflict state.

**Quality bar:** two-device editing test suite and clear offline/reconnect UX.

## Definition of done for public MVP

- Tested on supported iOS and Android devices.
- Auth, RLS, deletion, export, and sharing flows covered by automated tests.
- Offline edits recover after app restart.
- AI actions have quotas, logging, and graceful provider failure states.
- Sentry crash monitoring and product analytics are active.
- Privacy policy explains board, image, audio, and AI processing.
- App Store and Play Store metadata, screenshots, and subscription terms are ready.

## Decisions to confirm before implementation

1. iOS only for first beta, or iOS and Android together?
2. Is real-time multi-user editing part of MVP or beta phase?
3. Which AI provider is preferred, and are user board contents allowed to leave your infrastructure?
4. Will the product target individual creators, education, or teams first?
5. Free plan plus Pro subscription, or invite-only paid beta?
