# Session 27 — Phase H: Active Recall Reveal Tape, Voice Pins & Presenter Teleprompter Layer

Read `README.md`, `docs/task-status.md`, `docs/agent-workflow.md`, `docs/phase-h-active-recall-voice-presenter.md`, and `docs/screen-architecture.md`. Inspect `src/canvas/document.ts`, `src/export/export-service.ts`, and `src/classroom/protocol.ts` before making changes.

Implement only Phase H:
1. **Tap-to-Reveal Answer Tape & Stage Curtain / Spotlight (`src/canvas/reveal-tape.ts`, `src/components/StageCurtainOverlay.tsx`):**
   - Add `RevealTapeObject` (`isRevealed`, `label`, `colorKey`) to mask answers/formulas on the canvas and toggle reveal on tap, plus `Reset all tapes` in the editor overflow menu.
   - Add the draggable `StageCurtainOverlay` (pull-down window shade and spotlight focus cutout).
2. **Spatial Voice-Pin Stickers (`src/audio/voice-pin-store.ts`, `VoicePinObject`):**
   - Add `VoicePinObject` (`audioAssetId`, `storagePath`, `durationMs`, `waveformPeaks`, `transcript`) with a lazy native audio recording/playback adapter, Skia waveform pill rendering, SQLite `media_assets` persistence, and `.flowcanvas.json` backup support.
3. **Presenter-Only Teleprompter Layer (`isPrivate` on `CanvasObjectBase`):**
   - Allow marking canvas objects as `Presenter-only (Private)` (dashed teal border + eye-slash badge), automatically stripping `isPrivate` objects from student Live Classroom broadcasts and default PNG/JPEG/PDF exports while keeping them in local SQLite and backups.
4. **Live Classroom Pop-Quiz Poll & Flashcard Study Mode (`src/classroom/poll-model.ts`, `src/components/FlashcardStudyModal.tsx`):**
   - Add `poll.start`, `poll.vote`, and `poll.close` to Live Classroom with one-tap `Insert results chart on board`.
   - Add `FlashcardStudyModal` to study reveal-taped items and connected sticky-note pairs as a swipeable flashcard deck.

Add `scripts/verify-active-recall-presenter.mts` and wire `npm run test:active-recall-presenter` into `npm test`. Run `npm run typecheck`, `npm test`, and bundle checks. Update `docs/task-status.md`; next task is Session 18 — Quality hardening (resumed after Phase H).
