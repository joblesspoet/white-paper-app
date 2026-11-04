# Stitch notes: missing screens, inconsistencies, decisions for review

Session 00 output. Nothing here is implemented. Items marked **Decision needed** require a human call before the matching implementation slice.

## Generation summary

- 61 screens across 14 groups, one Stitch project, one design system asset.
- Generation was sequenced: the full product brief was used for group 1, then each group was prompted with the same palette, type and forbidden-pattern preamble plus the design system asset, so the visual system stayed stable.
- One `generate_screen_from_text` call returned an HTTP 502. The generation had actually succeeded server-side (all 7 Tool Options screens existed afterwards), so it was not retried; the screens were recovered with `get_screen` / `list_screens`.

## Missing screens

| Gap | Detail | Recommendation |
|---|---|---|
| Editor saving state | `docs/screen-architecture.md` lists "saving locally" and "recovered unsaved changes" as editor states. Neither was generated (the brief's 14 groups do not include them). | **Decision needed** — generate in the review pass, or accept as implementation-only states. |
| Board-level search results | Home's search field is designed but there is no filtered / no-results state. | Add to the Home refinement session. |
| Export "selected region" interaction | The scope segment exists, but there is no screen showing the selection handoff on the canvas. | Implementation detail; no new screen strictly required. |
| Import "importing" progress | File selection, validating, invalid and migration exist; the final import-in-progress state does not. | Reuse the `Validating` card with a determinate bar. |
| Library permission denied | Only camera permission denied was drawn. | Parity: same `PermissionDeniedNotice` component. |
| OCR dark theme | OCR Review has no dark variant, while most other groups do. | Add in the review pass. |
| Clear-data unchecked state | Only the enabled state was drawn. The suggestion list offered the unchecked variant. | Add in the review pass — it is the more important state for safety review. |
| Onboarding / first-run explanation | Intentionally absent. Home's empty state carries it. | Keep absent. |

No screen exists for login, profile, avatars, AI, cloud sync, teams, collaboration, subscriptions or chat — as required. Several Stitch suggestion chips proposed exactly those directions (for example "export React Native component specs", "add a template picker"); they were declined.

## Stitch-side limitations

1. **`list_screens` and `get_project` both cap at 25 entries** while the project holds 61 screens, and neither exposes a page token or page size. The full inventory had to be reassembled from generation responses and verified one screen at a time with `get_screen`.
2. **`TABLET` generations are reported back as `DESKTOP`.** All 12 tablet screens carry `deviceType: DESKTOP`. Do not read `DESKTOP` as "web" when reviewing.
3. **Reported screen dimensions are unreliable.** The four tablet editor screens all report `2560x2048` regardless of the portrait/landscape composition in the image. Use the preview PNGs, not the metadata, when checking layout.
4. **`update_design_system` fails** for this project with `Request contains an invalid argument` even when replaying the exact payload `create_design_system` accepted. The design system therefore cannot be edited in place.
5. **Four unused design-system assets** are left in the project (`FC typography`, `FC spacing`, `FC designmd`, and an initial partial `FlowCanvas Design System`) because argument probing was needed to find the rejected `*FontFamily` fields and Stitch exposes no delete-design-system tool. `assets/15027755881686384024` is the real one; the others are inert. **Decision needed** — leave them (harmless) or recreate the project cleanly.
6. **Typography and spacing maps are write-only.** They are accepted on create but not returned by `list_design_systems`, so the type scale cannot be verified from the API.

## Inconsistencies against `design-system/flowcanvas/MASTER.md`

Measured on the 61 downloaded previews. These need review; none should be silently adopted into `src/theme.ts`.

### Colors

- **Pure white surfaces throughout.** `#FFFFFF` appears in 61/61 previews, usually as card and sheet surface. The master reserves white for `--color-on-primary`; card and sheet surfaces should be `--color-background` or `--color-muted`. This is the single most widespread drift.
- **Off-system neutrals.** `#1C1917` (4 previews) as text/icon colour on the empty editor; `#F1F5F9` slate-100 (22 previews) as panels and placeholders. Neither is in the master palette. Text should be `--color-foreground`, panels `--color-muted`.
- **Sticky butter drift.** Both `#FDE68A` (master, 14 previews) and `#FEF08A` (yellow-200, 7 previews) are in use. One pastel token must win — the master value.
- **Border colour under-used.** `--color-border` `#99F6E4` appears in only 13/61 previews; borders are frequently lighter tints. Since flat design relies on borders for depth, this matters more here than elsewhere.
- **Error tints.** `#FEF2F2` (red-50) is used as an error background. It is a reasonable derived tint of `--color-destructive` and could be added to the master as `--color-destructive-surface`, but it is not in the master today. **Decision needed.**
- **Secondary colour barely used.** `--color-secondary` `#14B8A6` appears in 4/61 previews. Not a defect, but the token is close to dead weight in the current designs.
- **Inconsistent dark canvas.** Dark screens use `#0B2B28` (matches the supplied dark token) on some screens and `#030C0B` / `#061413` / `#051816` on others. Pick one — the supplied `#0B2B28`.

### Typography

- **Calistoga is unavailable in Stitch.** `PLAYFAIR_DISPLAY` was used as the editorial stand-in. This is an accepted substitution per the master's "or close mobile-safe equivalents" clause, but it is a substitution and should be confirmed. **Decision needed.**
- The design-system asset accepts one `roundness` value, so the master's 8 / 12 / 16 radius tiers are not expressed at asset level. They must be applied per component from the master.

### Elevation and effects

- The master file contradicts itself: its style guideline says **Flat Design, no shadows, no gradients**, while its component specs use `box-shadow` at four depths and a `backdrop-filter: blur(4px)` modal overlay. Stitch followed the flat rule, which is correct for this app and matches `docs/task-status.md`. The shadow tokens and the blurred overlay are **rejected**, and the master file should eventually be corrected.
- The master also specifies `cursor: pointer`, hover states and `translateY` hover lifts — web-only patterns that do not apply to a React Native touch target. Rejected for mobile.

### Behaviour and scope

- **Acknowledgement checkbox on Clear Local Data** (`e098012f70de496892414e73fd75201d`) goes beyond `docs/screen-architecture.md`, which specifies only a destructive confirmation. It is a good safety pattern but it is new scope. **Decision needed** — keep it or simplify to confirm/cancel.
- **"Comments coming later" disabled row** in the Object Inspector matches the architecture's forward-looking placeholder, but it puts a cloud-phase concept in front of MVP users. Consider hiding it entirely until the cloud phase exists. **Decision needed.**
- **Search field on Home** is designed visible in the populated state; the architecture says it appears only above five boards. Treat visibility as conditional.
- **Export file-size estimates** ("PNG - about 1.2 MB") are placeholders; real values need a renderer-side estimate.

## Responsive concerns

1. **Tablet layouts are drawn, not proven.** All 12 tablet screens are `DESKTOP`-typed single compositions at 2560px wide. Nothing verifies the 1024/1366 breakpoints, safe areas, or split-view on iPad. The tablet editor rail, the inspector panel and the landscape two-pane Home are concepts; they need a real breakpoint spec before implementation.
2. **Android tablet** is represented by two screens only (editor pen strip, Home dark grid). Android-specific insets, back gesture areas and Material touch feedback are not shown.
3. **Landscape phone** is not covered at all. The architecture requires the canvas to stay usable in landscape; only the crop screen has a landscape variant.
4. **Keyboard-safe behaviour is drawn, not specified.** The text and sticky screens show the canvas panned, but there is no rule for how much the viewport moves, nor a spec for the hardware-keyboard iPad case.
5. **Dynamic Type** is claimed everywhere and demonstrated nowhere. No screen shows large-text reflow, and a 44pt dock with icon-only buttons will need explicit label-collapse behaviour at accessibility sizes.
6. **Home grid density** changes from 2 columns (phone) to 4 (tablet) with no intermediate rule for landscape phones or small tablets.

## Decisions requiring review

1. Confirm `PLAYFAIR_DISPLAY` as the headings stand-in for Calistoga, or choose a different substitution before any font package is installed.
2. Confirm that pure-white card surfaces are rejected in favour of `--color-background` / `--color-muted`.
3. Confirm rejection of the master's shadow tokens and blurred modal overlay, and correct the master file.
4. Confirm or drop the clear-data acknowledgement checkbox.
5. Confirm or drop the disabled "comments" row in the Object Inspector.
6. Confirm `--color-stitch-error-surface` `#FEF2F2` as a new master token, or map error surfaces to `--color-muted` with a destructive border only.
7. Decide whether the four leftover design-system assets stay in the Stitch project.
8. Decide whether missing states (editor saving / recovered, OCR dark, clear-data unchecked, import progress) are generated in the review pass or left to implementation.

## What a reviewer should do next

Per the session plan, the next task is to review and refine **Home / Boards** in Stitch: settle the white-surface question, the border token, and the search/no-results state there first, because Home sets the visual grammar every other screen copied.
