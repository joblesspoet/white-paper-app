# Stitch tokens

Only tokens that are compatible with `design-system/flowcanvas/MASTER.md` are recorded here.
Where Stitch drifted from the master system, the drift is listed in `design/stitch-notes.md` and the master value still wins.

**Rule: `design-system/flowcanvas/MASTER.md` is the authority. This file records what Stitch actually produced so an implementation can be checked against the master, not so it can replace it.**

## Design system asset

| Field | Value |
|---|---|
| Asset | `assets/15027755881686384024` |
| Display name | `FlowCanvas Design System` |
| Version | `1` |
| colorMode | `LIGHT` (dark is a per-screen variant, not a second asset) |
| colorVariant | `TONAL_SPOT` |
| customColor / seed | `#0D9488` |
| headlineFont | `PLAYFAIR_DISPLAY` |
| bodyFont | `INTER` |
| labelFont | `INTER` |
| roundness | `ROUND_EIGHT` |
| designMd | matches the master palette, spacing, radius, elevation and forbidden-pattern rules |

Two things are worth knowing about the asset:

- The Stitch API accepts `typography` and `spacing` maps on create but does not echo them back on read, so they are unverifiable from `list_design_systems`. The authoritative type and spacing scales remain the ones in the master file and in `src/theme.ts`.
- Stitch rejects `headlineFontFamily` / `bodyFontFamily` with `Request contains an invalid argument`; only the font enums are accepted.

## Colors — compatible with the master

These are the master values and they are what Stitch used.

| Token | Hex | Master role | Observed in previews |
|---|---|---|---|
| `color-primary` | `#0D9488` | Primary | 47 / 61 |
| `color-on-primary` | `#FFFFFF` | On primary | 61 / 61 |
| `color-secondary` | `#14B8A6` | Secondary | 4 / 61 |
| `color-accent` | `#EA580C` | Accent / CTA | 29 / 61 |
| `color-background` | `#F0FDFA` | Background (canvas) | 58 / 61 |
| `color-foreground` | `#134E4A` | Foreground (text) | 53 / 61 |
| `color-muted` | `#E8F1F4` | Muted surface | 45 / 61 |
| `color-border` | `#99F6E4` | Border | 13 / 61 |
| `color-destructive` | `#DC2626` | Destructive | 7 / 61 |
| `color-ring` | `#0D9488` | Focus ring | shares primary |

"Observed in previews" is a measured count of exact-pixel matches across the 61 downloaded PNGs at a 3x downsample. Low counts are a signal, not automatically an error — `color-border` at 13/61 means the border is frequently drawn as a lighter tint or a different hairline colour instead of the master border (see `stitch-notes.md`).

## Sticky note pastels — compatible with the master

| Token | Hex | Text | Observed |
|---|---|---|---|
| `note-butter` | `#FDE68A` | `#134E4A` | 14 / 61 |
| `note-blush` | `#FECDD3` | `#134E4A` | not sampled |
| `note-mint` | `#BBF7D0` | `#134E4A` | 11 / 61 |
| `note-sky` | `#BAE6FD` | `#134E4A` | not sampled |
| `note-lilac` | `#DDD6FE` | `#134E4A` | present (4.3% of the populated Home preview) |

All pastels carry `#134E4A` text, which keeps contrast at 4.5:1 or better.

## Dark theme — compatible with the master, partly verified

Dark tokens were supplied to Stitch in the design system `designMd` and several screens follow them exactly.

| Token | Hex | Verified on |
|---|---|---|
| `dark-canvas` | `#0B2B28` | Settings dark (37.4%), Inspector dark (57.0%) |
| `dark-surface` | `#103B37` | Home tablet dark (1.4%) |
| `dark-elevated` | `#164A45` | supplied, not confirmed by sampling |
| `dark-primary` | `#2DD4BF` | supplied, not confirmed by sampling |
| `dark-accent` | `#FB923C` | supplied, not confirmed by sampling |
| `dark-border` | `#1F5F58` | supplied, not confirmed by sampling |
| `dark-text` | `#E6F4F1` | supplied, not confirmed by sampling |

Three dark screens landed on different, darker values (`#030C0B`, `#061413`, `#051816`). That is an inconsistency, recorded in `stitch-notes.md`; do not adopt those values.

## Typography — compatible with the master

| Level | Family | Size / line | Weight |
|---|---|---|---|
| display | Playfair Display | 34 / 40 | 700 |
| title | Playfair Display | 28 / 34 | 700 |
| heading | Inter | 22 / 28 | 600 |
| subtitle | Inter | 17 / 24 | 600 |
| body | Inter | 16 / 24 | 400 |
| callout | Inter | 15 / 20 | 500 |
| caption | Inter | 13 / 18 | 500 |
| label | Inter | 13 / 18 | 600 |

The master specifies **Calistoga** for headings with Inter for body — "or close mobile-safe equivalents". Calistoga is not in Stitch's font enum, so `PLAYFAIR_DISPLAY` was used as the editorial-serif stand-in. This is the one intentional substitution; `docs/task-status.md` already notes that neither Calistoga nor Inter is installed in the app yet, so headings currently render in the platform system font.

## Spacing — compatible with the master

| Token | Value | Master name |
|---|---|---|
| `space-xs` | 4 | `--space-xs` |
| `space-sm` | 8 | `--space-sm` |
| `space-md` | 16 | `--space-md` |
| `space-lg` | 24 | `--space-lg` |
| `space-xl` | 32 | `--space-xl` |
| `space-2xl` | 48 | `--space-2xl` |
| `space-3xl` | 64 | `--space-3xl` |

Gutters: 16 on phones, 32 on tablets.

## Radius — compatible with the master

| Token | Value | Master usage |
|---|---|---|
| `radius-control` | 8 | buttons, inputs, segmented controls |
| `radius-card` | 12 | cards, sheets, sticky notes |
| `radius-modal` | 16 | dialogs and modals |
| `radius-full` | 999 | pills, swatches, avatars (none in MVP) |

Stitch's asset-level `roundness` is a single value (`ROUND_EIGHT`); the 12 and 16 tiers come from the master file and must be applied per component.

## Elevation — compatible with the master

| Token | Value |
|---|---|
| `elevation-none` | no shadow |
| `border-hairline` | 1px `--color-border` |
| `scrim` | `rgba(19, 78, 74, 0.12)` |

Master's CSS shadow tokens (`--shadow-sm` … `--shadow-xl`) and its `backdrop-filter: blur` modal overlay are **not** adopted. They contradict the master's own "Flat Design / no shadows / no gradients" rule and the mobile rules in `docs/task-status.md`. Documented in `stitch-notes.md`.

## Icon sizes and touch targets

| Token | Value |
|---|---|
| `icon-sm` | 20 |
| `icon-md` | 24 |
| `icon-lg` | 28 |
| `target-min` | 44 |
| `target-dock` | 48 |
| `stroke-icon` | 2 |

One vector family only, no emoji, icon-only controls always carry an accessible label.

## Interaction states

| State | Spec |
|---|---|
| rest | no change |
| pressed | 8% foreground overlay, 150 ms |
| selected | 1px `--color-primary` border + primary tint fill |
| disabled | 40% opacity |
| focus | 2px `--color-ring`, 3:1 minimum |
| motion | 150–200 ms ease-out, transform-free, honour reduced motion |

## Not recorded here

The following appeared in Stitch output but conflict with the master, so they are **not** tokens:

- `#1C1917` (near-black) used as text/icon colour on the empty editor.
- `#F1F5F9` (slate-100) used as a panel/placeholder surface in 22 previews.
- `#FEF2F2` (red-50) used as an error tint.
- `#FEF08A` (yellow-200) used instead of `note-butter` `#FDE68A`.
- `#E2E8F0` input border — present in the master's `.input` example, but not in the master palette table; treat the input border as `--color-border`.

Details and recommendations for each are in `design/stitch-notes.md`.
