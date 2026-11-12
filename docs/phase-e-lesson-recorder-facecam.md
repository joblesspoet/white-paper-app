# Phase E — Lesson Recorder & Floating Face-Cam

## Scope and product goal

Phase E enables teachers, tutors, and creators to record complete video lessons—combining their canvas strokes, voice explanation, floating teaching utilities, and an optional picture-in-picture face-cam bubble—directly from the FlowCanvas editor (`com.teachingboard.aitricker` Screen Recorder & Face-Cam parity).

1. **Floating Face-Cam Bubble (`src/components/FaceCamBubble.tsx`)** — draggable, resizable front-camera picture-in-picture bubble with quick mute/hide controls and explicit camera permission handling.
2. **Lesson Recorder (`src/recorder/lesson-recorder.ts`, `src/components/LessonRecorderBar.tsx`)** — in-editor recording HUD (`Rec ● MM:SS`, Pause/Resume, Stop, Quality selector `480p`/`720p`/`1080p`) that records audio narration + synchronized canvas frames/events and exports a shareable lesson file.
3. **Deterministic Canvas Replay & Video Export** — dual-mode recording architecture so lessons can be replayed interactively inside FlowCanvas (`Board Time Machine` / `.flowlesson.json`) **and** exported/shared as standard video where native screen/frame encoding is available.

## 1. Floating Face-Cam Bubble (`src/recorder/facecam-model.ts`, `src/components/FaceCamBubble.tsx`)

### Interaction contract
- Toggled from the Editor top bar / `Utilities` sheet (`Face-Cam`).
- Requests front camera permission on demand and shows an actionable permission-denied banner with `Open Settings` if blocked, matching `src/media/image-source.ts`.
- **Geometry & controls:**
  - Draggable anywhere within the canvas safe-area bounds with corner magnetic snapping (top-left, top-right, bottom-left, bottom-right above `ACTION_ISLAND_HEIGHT`).
  - Three size presets: `Small (88pt)`, `Medium (124pt)`, `Large (164pt)` and shape toggle (`Circle` vs `Rounded 16pt Card`).
  - Tap bubble to reveal compact overlay controls: `Flip camera (front/back)`, `Resize`, `Mirror toggle`, and `Close`.
- **Flat design compliance:** framed with a `2px` `--color-primary` (`#0D9488`) ring (or `#DC2626` recording ring when lesson recording is active) and zero drop shadow.

## 2. Lesson Recorder (`src/recorder/lesson-recorder.ts`, `src/components/LessonRecorderBar.tsx`)

### Recording lifecycle
```text
Open Lesson Recorder HUD
  → Choose quality (480p / 720p / 1080p) & Microphone toggle
  → Start Recording (3-2-1 countdown)
  → Record audio stream + timestamped canvas command/pointer frames + viewport/laser/page transitions
  → Pause / Resume at any point
  → Stop Recording
  → Review & Share Modal (Play preview, Save/Share video or .flowlesson replay package, Discard)
```

### Architecture & Expo compatibility
- **Native screen/video capture adapter (`src/recorder/native-recorder.ts`):**
  - Uses lazy `requireOptionalNativeModule` (just like `src/ocr/native-ocr.ts`) so the app never crashes in Expo Go when native screen capture / audio-video muxing modules are absent.
- **Universal deterministic lesson recording (`src/recorder/lesson-recorder.ts`):**
  - Alongside native video capture, the recorder captures a compact timestamped timeline of initial board state + every `HistoryCommand`, viewport pan/zoom sample, laser pointer sample, page switch, and audio track reference.
  - This guarantees that even in environments without native MP4 muxing, a recorded lesson can be **replayed frame-accurately at 60 FPS directly on the Skia canvas** with a timeline scrubber and speed controls (`0.5×`, `1×`, `1.5×`, `2×`).

### Recording HUD (`src/components/LessonRecorderBar.tsx`)
- Compact pill (`44pt` height) anchored at top-center below the editor top bar:
  - Pulsing red status dot (`Recording` / `Paused`), elapsed duration `MM:SS`, microphone level indicator, `Pause/Resume` button (`44×44pt`), and `Stop` button (`44×44pt`).
- Automatically pauses and flushes a recovery checkpoint if the app backgrounds mid-recording.

## Verification (`scripts/verify-lesson-recorder.mts`)

Add `npm run test:lesson-recorder` covering:
- Face-Cam bubble corner snapping, size preset cycling, and safe-area clamping across phone and tablet viewports.
- Lesson recorder state machine (`idle` → `countdown` → `recording` → `paused` → `stopping` → `completed` / `error`), elapsed duration accounting across multiple pause/resume intervals, and resolution dimension calculation (`480p`, `720p`, `1080p`).
- Deterministic lesson timeline recording and playback interpolation (verifying that replaying recorded strokes, laser trails, object moves, and page switches at arbitrary timestamp `t` reproduces the exact canvas state).
- Graceful fallback when native screen/audio recording modules are unavailable or permissions are denied.
