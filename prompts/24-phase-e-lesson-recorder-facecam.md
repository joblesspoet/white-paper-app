# Session 24 — Phase E: Lesson Recorder & Floating Face-Cam

Read `README.md`, `docs/task-status.md`, `docs/agent-workflow.md`, `docs/phase-e-lesson-recorder-facecam.md`, and `docs/screen-architecture.md`. Inspect `app/editor.tsx`, `src/media/image-picker.ts`, and `src/export/share.ts` before making changes.

Implement only Phase E:
1. **Floating Face-Cam Bubble (`src/recorder/facecam-model.ts`, `src/components/FaceCamBubble.tsx`):** draggable front/back camera picture-in-picture bubble with magnetic corner snapping, size presets (`88pt`, `124pt`, `164pt`), circle vs rounded-card toggle, mirror toggle, and permission-denied guidance with `Open Settings`.
2. **Lesson Recorder & Replay Engine (`src/recorder/lesson-recorder.ts`, `src/recorder/native-recorder.ts`, `src/components/LessonRecorderBar.tsx`):**
   - In-editor recording HUD (`Rec ● MM:SS`, `Pause/Resume`, `Stop`, quality selector `480p`/`720p`/`1080p`, microphone toggle).
   - Lazy native screen/audio capture adapter (`requireOptionalNativeModule`) that never crashes in Expo Go, paired with a deterministic timestamped canvas timeline recorder (capturing initial state, commands, viewport, laser trails, and page switches) and an interactive in-app Lesson Replay player (`0.5×`–`2×` scrubber) plus share handoff.

Add `scripts/verify-lesson-recorder.mts` and wire `npm run test:lesson-recorder` into `npm test`. Run `npm run typecheck`, `npm test`, and bundle checks. Update `docs/task-status.md`; next task is Session 25 — Phase F: Live Classroom Broadcasting.
