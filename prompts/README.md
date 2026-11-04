# Implementation session prompts

Use one prompt per OpenCode session, in numeric order. Start each session from the project root and tell the agent to read `README.md`, `docs/task-status.md`, `docs/agent-workflow.md`, and the selected prompt.

Rules:
- Complete only the selected task.
- Preserve planning documents and existing work.
- Run and test the app before finishing.
- Update `docs/task-status.md` with verification and the next task.
- Do not mark a task complete if it was not verified.

Sequence:
1. Bootstrap
2. Navigation
3. Home boards
4. Board creation
5. Editor shell
6. Canvas viewport
7. Ink drawing
8. Undo/redo
9. Text and sticky notes
10. Shapes/connectors
11. Selection/transforms
12. Local persistence
13. Image import
14. Local OCR
15. Export/import
16. Settings
17. Responsive tablet support
18. Quality hardening
