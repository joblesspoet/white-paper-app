# Task status

## Current phase
Stitch design generation. Design project and local handoff files created; app implementation not started for this phase.

## Current task
Session 00 — generate the FlowCanvas design project in Google Stitch and save the local design handoff.

## Status
`complete` (design reference only — the app implementation is **not** complete)

## Completed slices
- Product MVP scope defined: local-only, no auth, no AI.
- Screen architecture documented.
- Google Stitch prompts documented.
- Global design system generated and persisted.
- Agent/session workflow documented.
- Expo app scaffolded with Expo-managed workflow, TypeScript strict mode, status bar, and safe-area support.
- Stack navigation shell on Expo Router with Home, Board Editor, and Settings placeholder screens.
- Stitch design project `FlowCanvas` created with 61 screens across the 14 MVP screen groups, a project design system asset derived from `design-system/flowcanvas/MASTER.md`, 61 downloaded previews, and the five local design handoff documents.

## Files changed in Session 00 (design only)
- `design/stitch-project.md` — new. Project ID, URL, design-system asset, all 61 screen IDs, screenshot file resources, preview paths, MCP tool list, generation date.
- `design/screen-inventory.md` — new. Per-screen purpose, entry/exit points, primary action, components, states, phone and tablet layout, implementation notes, coverage table.
- `design/flows.md` — new. Navigation model, presentation rules, and the ten primary user flows.
- `design/tokens.md` — new. Stitch tokens that are compatible with the master, with measured evidence; incompatible values are explicitly not recorded as tokens.
- `design/stitch-notes.md` — new. Missing screens, Stitch limitations, master-file conflicts, responsive concerns, and decisions requiring review.
- `design/previews/*.png` — new. 61 preview screenshots (13 MB).
- `docs/task-status.md` — this file.
- No file under `app/`, `src/`, or `assets/` was created or modified. No React Native code was written in this session.

## Verification
- Stitch MCP `stitch` confirmed available at `https://stitch.googleapis.com/mcp`; 16 tools discovered and their schemas read before use.
- Project created: `projects/18433233690962903854`, title `FlowCanvas`, type `PROJECT_DESIGN`, created 2026-11-04T17:10:53Z. `list_projects` reported 14 pre-existing projects; none were opened, modified, or deleted.
- Design system asset created: `assets/15027755881686384024`, seeded with `#0D9488`, `INTER` body/label, `PLAYFAIR_DISPLAY` headline, `ROUND_EIGHT`, and a `designMd` carrying the master palette, spacing, radius, elevation, icon, touch-target and forbidden-pattern rules.
- 61 screens generated across all 14 MVP screen groups.
- Screen IDs verified individually with `get_screen` for all 61. Note: `list_screens` and `get_project().screenInstances` cap at 25 entries and expose no pagination, so the inventory was reassembled from generation responses.
- 61 of 61 previews retrieved and saved to `design/previews/` (13 MB). The `:download` endpoint returns a JSON envelope with a base64 `dataString`; files were decoded to real PNGs and verified as `PNG image data`.
- Palette compliance measured by exact-pixel sampling of all 61 previews: primary `#0D9488` 47/61, background `#F0FDFA` 58/61, foreground `#134E4A` 53/61, accent `#EA580C` 29/61, muted `#E8F1F4` 45/61, border `#99F6E4` 13/61, destructive `#DC2626` 7/61.
- Destructive colour confirmed present on the delete-board dialog and the clear-local-data dialog.
- One `generate_screen_from_text` call returned HTTP 502; its 7 screens existed server-side afterwards and were recovered via `get_screen`, not retried, per the tool contract.
- HTML/code references were located (`htmlCode.name` per screen) but not copied into the app and not stored locally.
- No API key appears in any file under `design/` or in this document.

## Known issues
- ESLint/Prettier are still not configured. Add them in the quality-hardening slice.
- Calistoga/Inter are specified by the design system but no font package is installed; screens use the platform system font with the design-system weights and sizes.
- Stitch has no Calistoga font, so `PLAYFAIR_DISPLAY` is used as the editorial heading stand-in. Needs confirmation (see `design/stitch-notes.md`).
- `design-system/flowcanvas/MASTER.md` contradicts itself: flat-design guidance alongside four shadow depths and a `backdrop-filter: blur` modal overlay. Stitch followed the flat rule; the master file should be corrected.
- Pure white `#FFFFFF` surfaces appear in all 61 previews although the master reserves white for `--color-on-primary`. Widespread minor drift, not yet resolved.
- Off-system colours appear in Stitch output: `#1C1917` (4 previews), `#F1F5F9` (22), `#FEF2F2` (error tint), and `#FEF08A` instead of `--note-butter` `#FDE68A` (7). Roundness/typography tiers cannot be expressed at asset level.
- Dark-theme canvas is inconsistent across screens: `#0B2B28` on some, `#030C0B`/`#061413`/`#051816` on others.
- `update_design_system` fails for this project with `Request contains an invalid argument`, so the design system cannot be edited in place. Four unused probe assets remain in the project; there is no delete-design-system tool.
- `TABLET` generations are reported back as `DESKTOP`, and reported screen dimensions are unreliable (all four tablet editor screens report 2560x2048).
- Landscape phone is not designed; tablet layouts are single wide compositions and are not proven at 1024/1366 breakpoints.
- Undesigned states: editor saving / recovered-unsaved, search-filtered Home, import in progress, library permission denied, OCR dark theme, clear-data unchecked state. Listed in `design/stitch-notes.md`.
- Pre-existing, unchanged: Expo Go's Android "Tools" bubble overlaps the Home settings icon; `npm audit` reports 5 moderate transitive vulnerabilities; the Android emulator needs `-partition-size 8192 -wipe-data`.

## Decisions
- Expo-managed workflow, Expo SDK 58, React Native 0.88.1, React 19.3.0, TypeScript 6.0.3 (`strict`).
- Navigation is Expo Router file-based routes on one native stack (`app/` directory). No tabs.
- Route names are `index` (Home), `editor` (Board Editor), `settings` (Settings); keep `/editor` and `/settings` as the paths later slices link to.
- `unstable_settings.anchor = 'index'` in the root layout keeps Home under deep-linked routes, so back always returns to Home.
- Home hides the native header and renders its own safe-area header; other screens use the native header for back affordances.
- `react-native-safe-area-context` remains the single source of insets; screens pad the bottom edge with `useSafeAreaInsets`.
- Shared tokens live in `src/theme.ts`; screens must not hardcode design-system colors or spacing.
- Icons come from one local `react-native-svg` family in `src/components/icons.tsx`. No emoji icons, no per-screen icon fonts.
- Flat design: borders and color shifts only, no shadows or gradients.
- Stitch output is a **design reference only**. Generated HTML/code is not copied into the React Native app, and `design-system/flowcanvas/MASTER.md` remains the token authority; where Stitch conflicts with it, the conflict is documented rather than adopted.

## Next task
Session: review and refine Home / Boards in Stitch. Settle the white-surface question, the border token usage, and the missing search/no-results state there first, since Home sets the visual grammar the other 13 groups copied. Then close the undesigned states listed in `design/stitch-notes.md`.
