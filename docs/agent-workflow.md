# OpenCode workflow for feature-by-feature development

## Recommended rule

Use the current session for planning and for one small implementation task. Start a fresh session for each meaningful feature slice, not necessarily every tiny checkbox.

A good feature slice is independently runnable and testable, for example:

- Project bootstrap
- Navigation shell
- Home board list
- Canvas viewport
- Ink drawing
- Text and sticky notes
- Local persistence
- Image import
- OCR flow
- Export/import

Do not use one long session for the entire application. Long sessions accumulate assumptions, stale implementation details, and unrelated context. The agent may begin optimizing for earlier decisions that have since changed.

## When to stay in the current session

Stay in the current session when:

- You are still clarifying the same feature.
- The task is small and directly related to the current implementation.
- You need to fix a regression caused by the current task.
- You have not yet run and verified the current slice.
- The context is still focused and the agent can clearly summarize the state.

Examples:

```text
Create the Home screen
→ run it
→ fix layout issue
→ test empty state
```

These belong in one session.

## When to start a new session

Start a new session when:

- A feature slice has been implemented and verified.
- You are moving to a different module.
- The conversation becomes large or contains many obsolete decisions.
- The agent starts repeating questions or forgetting constraints.
- You need a different design/architecture discussion.
- You are debugging an issue unrelated to the current feature.
- You want a clean review of existing code.

Examples:

```text
Session 1: bootstrap and navigation
Session 2: Home screen
Session 3: canvas viewport
Session 4: drawing tools
Session 5: persistence
```

## Source of truth between sessions

The filesystem is the durable memory. Never depend on conversation history alone.

After every completed slice, update:

1. `docs/task-status.md` — current task, status, test result, next task.
2. Relevant architecture or feature document.
3. `README.md` if setup commands or project structure changed.
4. Code comments only for non-obvious decisions.

The status file should remain short and factual.

## Required handoff format

At the end of each session, write a handoff containing:

```md
## Completed
- What was implemented.

## Files changed
- Important files and their purpose.

## Verification
- Commands run.
- Device/simulator tested.
- Result.

## Known issues
- Unresolved problems only.

## Decisions
- Decisions that future work must preserve.

## Next task
- Exactly one next feature slice.
```

The next session should read, in order:

1. `README.md`
2. `docs/task-status.md`
3. The relevant architecture document
4. The current source files

Then it should inspect the code before making changes.

## One-task contract

Every implementation session should have one primary objective:

```text
Implement [one feature slice], verify it, and update task status.
```

The agent may fix bugs required by that objective, but should not begin the next module. If it discovers unrelated work, record it under `Known issues` or `Backlog`.

## Context budget policy

Do not wait until the context is exhausted. Begin a new session when the conversation feels difficult to summarize in a few paragraphs or when more than one major module is being discussed.

Practical limits:

- One feature slice per session.
- Keep the active task to roughly 1–3 hours of implementation work.
- Prefer 5–15 focused tool calls over broad exploration.
- Avoid pasting large generated files into chat; inspect files through tools.
- Keep decisions in repository documents, not only in messages.

## Verification gate

A feature is not complete merely because code was written. Before starting a new session:

- Run the app.
- Exercise the primary flow manually.
- Test at least one empty/loading/error state when applicable.
- Run typecheck/lint/tests available for the project.
- Check the diff for unrelated changes.
- Update `docs/task-status.md`.

If verification cannot be performed, mark the task `blocked` or `implemented-unverified`, not `complete`.

## Suggested session sequence

### Session 0 — planning
Create the task list, architecture, design system, and Stitch prompts.

### Session 1 — bootstrap
Create the Expo project, install dependencies, run the default app, and verify the environment.

### Session 2 — navigation
Create the stack and placeholder screens; verify Home → Editor → back.

### Session 3 — Home
Implement local board list, empty state, create, rename, duplicate, and delete.

### Session 4 — editor shell
Implement editor chrome, tool dock, viewport state, and static canvas.

### Session 5 — canvas
Implement Skia rendering, pan, zoom, and coordinate conversion.

### Session 6 — ink
Implement pen, highlighter, eraser, and undo/redo.

### Session 7 — objects
Implement text, sticky notes, shapes, selection, transform, and deletion.

### Session 8 — persistence
Implement local storage, autosave, recovery, and migrations.

### Session 9 — images
Implement image picker, camera, crop, and image objects.

### Session 10 — OCR
Implement the OCR adapter, review screen, editable text, and placement.

### Session 11 — export
Implement PNG/JPEG/PDF/JSON export and JSON import.

### Session 12 — settings and hardening
Implement preferences, responsive layouts, accessibility, and release checks.

## Important distinction

A new OpenCode session does not mean a new project or new branch. It is only a clean reasoning context. The code, documents, git history, and task status remain the continuity mechanism.

Use worktrees or branches only when experimenting with risky alternatives or parallel work. For the sequential MVP, one working directory and one verified feature at a time is simpler.
