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

## Milestone 4 — local MVP hardening

**Deliverables:** export/import, local PDF/image sharing, board thumbnails, crash recovery, performance testing.

**Quality bar:** a user can use the complete app without an account or network connection.

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
