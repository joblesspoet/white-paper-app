# Implementation session prompts

Use one prompt per OpenCode session, following the active execution sequence below. Start each session from the project root and tell the agent to read `README.md`, `docs/task-status.md`, `docs/agent-workflow.md`, and the selected prompt.

Rules:
- Complete only the selected task.
- Preserve planning documents and existing work.
- Run and test the app before finishing.
- Update `docs/task-status.md` with verification and the next task.
- Do not mark a task complete if it was not verified.

## Completed core MVP sequence (Sessions 01–17)
1. `01-bootstrap.md` — Bootstrap (completed)
2. `02-navigation.md` — Navigation (completed)
3. `03-home-boards.md` — Home boards (completed)
4. `04-board-creation.md` — Board creation (completed)
5. `05-editor-shell.md` — Editor shell (completed)
6. `06-canvas-viewport.md` — Canvas viewport (completed)
7. `07-ink-drawing.md` — Ink drawing (completed)
8. `08-undo-redo.md` — Undo/redo (completed)
9. `09-text-sticky-notes.md` — Text and sticky notes (completed)
10. `10-shapes-connectors.md` — Shapes/connectors (completed)
11. `11-selection-transforms.md` — Selection/transforms (completed)
12. `12-local-persistence.md` — Local persistence (completed)
13. `13-image-import.md` — Image import (completed)
14. `14-local-ocr.md` — Local OCR (completed)
15. `15-export-import.md` — Export/import (completed)
16. `16-settings.md` — Settings (completed)
17. `17-responsive-tablet.md` — Responsive tablet support (completed)

## Active Smart Teaching & Differentiation sequence (Sessions 20–27)
20. `20-phase-a-teaching-utilities.md` — Phase A: Smart Teaching & Presentation Utilities (Laser pointer, Grid/Ruled/Isometric backgrounds, Floating Timer, Floating Scientific Calculator)
21. `21-phase-b-geometry-shapes-tables.md` — Phase B: Interactive Geometry Box (Ruler, Protractor, Compass, Set Square), 45+ 2D/3D/STEM Shapes & Table Creator
22. `22-phase-c-math-recognition-stylus.md` — Phase C: Math Formula Builder, Hold-to-Snap Shape & Ink-to-Text Recognition, Stylus Pressure & Palm Rejection
23. `23-phase-d-multipage-pdf-annotation.md` — Phase D: Multi-Page Boards & Multi-Page PDF Annotation / Export
24. `24-phase-e-lesson-recorder-facecam.md` — Phase E: Floating Face-Cam Bubble & In-App Lesson Recorder / Replay
25. `25-phase-f-live-classroom.md` — Phase F: Live Classroom Broadcasting (6-Digit Code & QR Join, Raise Hand, Student Boards)
26. `26-phase-g-interactive-stem-mindmap.md` — Phase G: Magnetic Mind-Mapping, Live STEM Function Plotter, Table-to-Chart & Spatial OCR Explode
27. `27-phase-h-active-recall-voice-presenter.md` — Phase H: Tap-to-Reveal Answer Tape, Stage Curtain, Voice-Pin Stickers, Presenter Teleprompter Layer & Live Pop-Quiz Polls

## Paused until after Phase H (Sessions 18–19)
18. `18-quality-hardening.md` — Quality hardening *(paused until Sessions 20–27 are implemented and verified)*
19. `19-design-to-react-native.md` — Design-to-React-Native screen converter *(paused until Sessions 20–27 are implemented and verified)*
