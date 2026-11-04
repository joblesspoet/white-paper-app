# Session 00 — Generate FlowCanvas design in Google Stitch

You are working in the FlowCanvas project root:

`~/Desktop/antigravity-apps/white-board-app`

## Goal

Use the connected Google Stitch MCP to create the initial complete FlowCanvas design project, generate the MVP screens, retrieve previews where supported, and save a local design handoff. Do not implement React Native code in this session.

## Read these files first

1. `README.md`
2. `docs/task-status.md`
3. `docs/screen-architecture.md`
4. `docs/google-stitch-prompts.md`
5. `design-system/flowcanvas/MASTER.md`

Use these files as the source of truth. Do not invent a different product scope or visual system.

## MCP instructions

1. Confirm the `stitch` MCP server is available.
2. Discover the available Stitch tools and their schemas before calling them.
3. Use the correct project-creation tool to create a new project named `FlowCanvas`.
4. Use the product brief below as the project-generation prompt.
5. Do not expose, print, or save API keys.
6. Do not delete or modify existing Stitch projects.
7. Do not modify the local React Native source code.

If the Stitch MCP is unavailable, stop and report the exact error. Do not simulate successful generation.

## Product brief to send to Stitch

Create a polished mobile and tablet app called **FlowCanvas**, a local-first infinite whiteboard for capturing ideas and organizing visual thoughts.

This is an MVP with:

- No authentication
- No accounts
- No cloud sync
- No AI
- No real-time collaboration
- No subscriptions
- No social features
- Local boards stored on the device
- Offline use as a core requirement
- On-device OCR where supported
- Image import and export

Target platforms:

- iPhone
- Android phone
- iPad
- Android tablet
- Portrait and landscape orientations

Use stack navigation, not bottom tabs.

Visual direction:

- Calm, tactile, editorial productivity tool
- Minimal flat design
- Warm off-white canvas
- Deep teal primary color
- Orange action accent
- Dark teal text
- Soft pastel sticky-note colors
- Clean lines
- Minimal shadows
- No gradients
- No glassmorphism
- No emoji icons
- One consistent vector icon family
- Minimum 44pt touch targets
- Strong accessible contrast
- Light and dark themes
- Respect safe areas and Dynamic Type

Use the persisted FlowCanvas design system as the visual authority:
`design-system/flowcanvas/MASTER.md`

Create these MVP screens and states:

1. Home / Boards — first launch, populated, loading, error, delete confirmation
2. New Board — immediate creation flow and optional customization
3. Board Editor — empty, drawing, selected object, multi-selection, phone and tablet layouts
4. Tool Options — pen, highlighter, eraser, shapes, sticky notes, connectors
5. Object Inspector — selected object actions
6. Text Editing — keyboard-safe editing state
7. Sticky Note Editing — keyboard-safe editing state
8. Image Source — camera and photo library
9. Image Crop and Rotate
10. OCR Review — loading, success, editable text, no text found, error
11. Export Sheet — PNG, JPEG, PDF, editable JSON, share
12. Import Board — file selection, validation, invalid file, migration
13. Settings
14. Clear Local Data Confirmation

Core flows:

- Home → New board → Editor
- Home → Open existing board → Editor
- Editor → Pen → Draw
- Editor → Sticky note → Type → Save
- Editor → Text → Type → Save
- Editor → Image → Choose → Crop → Place
- Editor → Image → OCR → Review → Add text to canvas
- Editor → Export → Format → Share
- Home → Import editable board backup
- Settings → Clear local data → Confirm

The editor must be the dominant experience. Use a floating tool dock on phones, a vertical tool rail on tablets, and an optional inspector panel on large landscape screens.

Do not add login, profile, avatars, AI buttons, cloud badges, team controls, collaboration indicators, subscription screens, or chat.

Create reusable design tokens for colors, typography, spacing, corner radius, borders, elevation, icon sizes, touch targets, interaction states, and light/dark themes. Name screens and components clearly for a future React Native implementation.

## After generation

1. Retrieve the Stitch project identifier and URL if available.
2. List every generated screen and its identifier.
3. Retrieve screenshots/previews for the key screens if the MCP supports it.
4. Retrieve HTML/code only as a design reference if available; do not copy it into the React Native app.
5. Create these local files without API keys:

- `design/stitch-project.md`
- `design/screen-inventory.md`
- `design/flows.md`
- `design/tokens.md`
- `design/stitch-notes.md`

`design/stitch-project.md` must contain the project ID, URL, screen IDs, and generation date.

`design/screen-inventory.md` must contain, for every screen: purpose, entry points, exit points, primary action, components, states, phone layout, tablet layout, and implementation notes.

`design/flows.md` must contain the approved navigation and primary user flows.

`design/tokens.md` must record the Stitch tokens only if they are compatible with `design-system/flowcanvas/MASTER.md`. If Stitch conflicts with the master system, document the conflict in `design/stitch-notes.md`; do not silently replace the master system.

`design/stitch-notes.md` must contain missing screens, inconsistencies, responsive concerns, and decisions requiring review.

## Verification and status

Do not mark the app implementation as complete because this session only creates design references. Update `docs/task-status.md` with:

- Current phase: Stitch design generation
- Completed: design project and local handoff files
- Verification: Stitch project/screen IDs and retrieved previews
- Known issues: unresolved design issues
- Next task: review and refine Home / Boards in Stitch

At the end, report the project ID, screen IDs, local files created, previews retrieved, and any errors. Stop after the design handoff is saved.
