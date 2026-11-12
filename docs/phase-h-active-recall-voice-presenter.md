# Phase H — Active Recall Reveal Tape, Voice Pins & Presenter Teleprompter Layer

## Scope and product goal

Phase H completes FlowCanvas's market differentiation with four signature teaching, study, and active-participation tools that no standard mobile whiteboard offers:

1. **Tap-to-Reveal Answer Tape & Stage Curtain / Spotlight Shade** — cover answers or steps on the board with interactive scratch-off/peelable tape or a pull-down window curtain for active recall and step-by-step lesson pacing.
2. **Spatial Voice-Pin Annotations (`VoicePinObject`)** — drop compact audio feedback pins (`🎤 0:12`) directly onto student worksheets, diagrams, or sticky notes for fast voice grading and voice-memo capture.
3. **Presenter-Only "Private Teleprompter Layer" (`isPrivate`)** — mark any sticky note, text block, or hint on the canvas as `Presenter-only` so the teacher sees it on their screen while recording or teaching live, while students and public exports never see it.
4. **Live Classroom Pop-Quiz Poll (`A / B / C / D`) & Flashcard Study Mode** — launch a 1-tap instant multiple-choice poll to connected Live Class students with a live response bar chart on the teacher's board, or study any board's reveal tapes / connected notes as swipeable flashcards.

## 1. Tap-to-Reveal Answer Tape & Stage Curtain (`src/canvas/reveal-tape.ts`, `src/components/StageCurtainOverlay.tsx`)

### Tap-to-Reveal Tape (`RevealTapeObject`)
Add `RevealTapeObject` to `CanvasObject` in `src/canvas/document.ts`:
```ts
export type RevealTapeObject = {
  id: string;
  type: 'reveal-tape';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  colorKey: StickyColorKey;
  label?: string; // e.g. "Tap to reveal answer" or "?"
  isRevealed: boolean;
  isPrivate?: boolean;
};
```
- **Creation:** select the `Reveal Tape` tool (or `Cover with tape` on any selected text/math object) to draw a patterned pastel mask rectangle over an answer or formula step.
- **Interaction:** in `Select` or presentation mode, tapping a `RevealTapeObject` toggles `isRevealed` with a smooth opacity/peel transition and haptic tick (`src/utils/haptics.ts`) so the hidden text/math underneath becomes visible. `Reset all tapes` in the top overflow menu re-covers all tapes on the page for the next class period.

### Stage Curtain & Spotlight Shade (`src/components/StageCurtainOverlay.tsx`)
- Ephemeral presentation overlay with two modes:
  - **Window Curtain:** full-width opaque teal-tinted shade with a draggable bottom/top handle (`48pt` hit target) that teachers pull down to reveal a worked solution line by line.
  - **Spotlight Focus:** dims the canvas (`75%` dark scrim) except for a draggable, resizable circular/rectangular spotlight window over the active diagram.

## 2. Spatial Voice-Pin Stickers (`src/audio/voice-pin-store.ts`, `src/canvas/document.ts`)

### Data model
Add `VoicePinObject` to `CanvasObject`:
```ts
export type VoicePinObject = {
  id: string;
  type: 'voice-pin';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  audioAssetId: string;
  storagePath: string;
  durationMs: number;
  waveformPeaks: readonly number[]; // 16 normalized [0..1] amplitude bars
  transcript?: string;
  colorKey: TextColorKey;
};
```
- **Recording & playback:** uses a lazy optional native audio adapter (`requireOptionalNativeModule`) so Expo Go or permission-denied environments degrade gracefully with a clear message and never crash.
- **Durable storage:** audio clips save under `media/<boardId>/audio/<assetId>.m4a` and register in SQLite `media_assets` and `.flowcanvas.json` base64 backups alongside images.
- **Canvas rendering:** compact pill (`136×44pt`) rendered on Skia with a play/pause icon, 16-bar mini waveform, and duration label (`0:14`).

## 3. Presenter-Only Teleprompter Layer (`isPrivate` on `CanvasObjectBase`)

- Add `isPrivate?: boolean` to `CanvasObjectBase` (`src/canvas/document.ts`).
- Any sticky note, text block, or shape can be toggled as **`Presenter-only (Private)`** from the selection action rail / tablet inspector.
- **Visual distinction:** renders on the teacher's canvas at `82%` opacity with a dashed teal border and a corner `Private` eye-slash badge; a quick toggle in the editor top bar (`Hide presenter notes`) lets the teacher preview exactly what students see.
- **Privacy guarantee:**
  - Automatically stripped from `snapshot.sync` and `command.broadcast` messages sent to students in Phase F Live Classrooms!
  - Excluded by default from PNG, JPEG, and PDF exports in `src/export/export-service.ts` (unless `Include presenter notes` is explicitly checked in `ExportSheet`).

## 4. Live Classroom Pop-Quiz Poll & Flashcard Deck Mode (`src/classroom/poll-model.ts`, `src/components/FlashcardStudyModal.tsx`)

### Live Class Pop-Quiz (`A / B / C / D` / `True–False`)
- Extends Phase F (`src/classroom/protocol.ts`) with `poll.start`, `poll.vote`, and `poll.close` messages.
- Teacher taps `Start Quick Poll` (`A/B/C/D` or `True/False`, optional correct answer key) → students see an interactive voting card on their screens → teacher sees live vote counts and can tap **`Insert results chart on board`** to drop the final bar chart onto the canvas.

### 1-Thumb Flashcard Study Mode (`src/components/FlashcardStudyModal.tsx`)
- Automatically extracts study cards from the current board:
  - every `RevealTapeObject` paired with the text/math object beneath it (`Prompt = uncovered surroundings`, `Answer = hidden under tape`);
  - every parent sticky note connected via a Phase G magnetic arrow to a child sticky note (`Front = parent note`, `Back = child note`).
- Presents a clean, swipeable card deck modal (`Know it` / `Review again`) for students reviewing a board on their phone.

## Verification (`scripts/verify-active-recall-presenter.mts`)

Add `npm run test:active-recall-presenter` covering:
- `RevealTapeObject` creation, tap-to-reveal toggle, `resetAllRevealTapes`, and spatial detection of objects covered beneath a tape.
- `VoicePinObject` serialization, SQLite persistence, waveform normalization, and `.flowcanvas.json` backup round-trip.
- Presenter-only (`isPrivate`) filtering: verifying `filterPublicDocument` strips `isPrivate` objects from Live Classroom student broadcasts and default PNG/JPEG/PDF exports while keeping them intact in local SQLite and `.flowcanvas.json` backups.
- Live Pop-Quiz vote aggregation (preventing duplicate votes per `peerId`, computing percentages, and generating a canvas chart object) and Flashcard deck extraction from reveal tapes and connected sticky notes.
