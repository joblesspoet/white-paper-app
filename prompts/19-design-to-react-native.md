# Session 19 — Design-to-React-Native screen converter

You are implementing the FlowCanvas app one approved Stitch screen at a time.

## Session contract

Work on exactly one screen per session. Select the next eligible screen automatically from the design handoff and `docs/task-status.md`. Do not implement multiple screens in one session.

Before changing code:

1. Run `pwd` and confirm the project root.
2. Read `README.md`.
3. Read `docs/task-status.md`.
4. Read `docs/agent-workflow.md`.
5. Read `docs/screen-architecture.md`.
6. Read `design-system/flowcanvas/MASTER.md`.
7. Read `design/stitch-project.md`, `design/screen-inventory.md`, `design/component-handoff.md`, `design/flows.md`, and `design/tokens.md` when present.
8. Inspect the current source tree and existing navigation.
9. Discover the Stitch MCP tools and inspect the approved next screen preview if available.

If the design handoff does not exist, is incomplete, or has no approved next screen, stop and report what is missing. Do not invent a screen or create a new Stitch project.

## Screen selection

Select the next screen in this order unless `docs/task-status.md` explicitly specifies another next task:

1. Home / Boards → `Home`
2. Board creation → `Home` create flow
3. Board Editor shell → `BoardEditor`
4. Canvas viewport → `BoardEditor`
5. Tool options → `BoardEditor`
6. Ink drawing → `BoardEditor`
7. Text and sticky notes → `BoardEditor`
8. Shapes and connectors → `BoardEditor`
9. Object inspector → `BoardEditor`
10. Image source → `ImageSource`
11. Image crop → `ImageCrop`
12. OCR review → `OcrReview`
13. Export → `BoardEditor` sheet
14. Import board → `Home` flow
15. Settings → `Settings`
16. Responsive tablet refinement
17. Quality hardening

Implement only the selected screen or feature slice. If a shared foundation is required, implement only the minimum reusable foundation needed by the selected slice and document it.

## Before implementation: design analysis

Analyze the selected Stitch screen and write a short implementation plan before coding:

- Approved Stitch screen ID and preview used.
- Screen purpose and route.
- Phone and tablet variants.
- Component hierarchy.
- Interactive states.
- Required data and local state.
- Required assets.
- Accessibility behavior.
- Existing components that can be reused.
- New reusable components that should be extracted.

Do not copy Stitch HTML, CSS, or generated web code. Use it only as a visual reference.

## Shared design foundation

Create or reuse a centralized theme foundation before screen styling. Do not put global tokens inside a screen file.

Preferred structure:

```text
src/
  theme/
    colors.ts
    typography.ts
    spacing.ts
    radii.ts
    shadows.ts
    icons.ts
    themes.ts
    index.ts
  components/
    primitives/
    common/
  screens/
  navigation/
  hooks/
  types/
```

If the project uses a different structure, follow its convention and document the mapping.

The theme must provide:

- Light and dark semantic colors.
- Background, surface, elevated surface, text, muted text, border, primary, on-primary, accent, destructive, focus, and disabled tokens.
- Typography roles: display, title, heading, body, label, caption, button, and numeric/monospace where needed.
- Font family constants and a loading strategy for custom fonts.
- Spacing scale based on 4/8dp rhythm.
- Border radii.
- Elevation/shadow presets with platform-safe fallbacks.
- Icon sizes.
- Minimum touch target size.
- Z-index/layer constants where required.

Use the master design system as the starting point. Preserve its visual intent, but adapt web-only values to React Native. Use semantic tokens rather than raw hex values in screen styles.

If custom fonts are not already configured, use Expo-compatible font loading and ensure the app has a safe fallback while fonts load. Do not block the app indefinitely on a font failure.

## Reusable component rules

Create reusable components only when they have a stable responsibility or are reused by two or more screens. Avoid both extremes: do not duplicate a shared pattern, and do not create meaningless one-line wrappers.

Every reusable component must have:

- A focused responsibility.
- Typed props.
- A predictable controlled/uncontrolled behavior decision.
- Accessibility labels/roles/states.
- Pressed, focused, disabled, and loading states where relevant.
- Minimum 44pt interactive area.
- Theme-token-based styles.
- Platform-safe behavior.
- A small testable API.

Prefer these component categories:

- `Button`, `IconButton`, `TextButton`.
- `Screen`, `Section`, `Card`, `Surface`.
- `Sheet`, `Dialog`, `ListRow`, `EmptyState`.
- `Text`, `Heading`, `Label` typography primitives.
- Domain components such as `BoardCard`, `BoardGrid`, `EditorTopBar`, and `CanvasToolDock`.

Use `StyleSheet.create` or the project’s established styling system. Do not use inline style objects for static styles. Keep dynamic styles small and memoizable.

## Memoization and performance rules

Apply memoization deliberately, not mechanically:

- Wrap pure reusable leaf components in `React.memo` when they receive stable props and render frequently or appear in lists.
- Use `useCallback` for callbacks passed to memoized children or virtualized lists.
- Use `useMemo` for expensive derived data, layout calculations, and stable style variants—not for trivial values.
- Keep object and array props stable where practical.
- Avoid creating functions, large objects, or arrays inside list render paths.
- Use `FlatList`/`FlashList` for board collections instead of mapping unbounded arrays into a `ScrollView`.
- Do not memoize components that depend on frequently changing context unless the design improves performance.
- Do not hide stale-state bugs with memoization.
- For canvas work, keep high-frequency gesture state out of React render state when possible.

After implementation, explain which components were memoized and why.

## Implementation rules

- Use React Native and Expo primitives, not HTML or web CSS.
- Reuse the existing navigation and state architecture.
- Keep the MVP local-only: no auth, AI, cloud sync, collaboration, or subscriptions.
- Use `useWindowDimensions()` for responsive layout.
- Tablet is a responsive variant of the same route, not a new route.
- Respect safe areas, keyboard avoidance, Dynamic Type, reduced motion, and orientation.
- Use vector icons from the project’s chosen icon family; never use emoji as structural icons.
- Keep the canvas dominant in editor layouts.
- Do not add placeholder features that are not in the approved design or current task.
- Do not silently change the master design system; document necessary deviations.

## Verification gate

Before marking the selected screen complete:

1. Run the app.
2. Test the primary happy path.
3. Test required empty/loading/error/disabled states for the slice.
4. Test phone layout.
5. Test tablet layout if the screen has one.
6. Test light and dark theme.
7. Test accessibility labels and touch targets.
8. Run TypeScript validation.
9. Run lint and tests if configured.
10. Compare the implementation with the Stitch preview.
11. Check for unrelated changes.
12. Update `docs/task-status.md`.

Use `implemented-unverified` if the app could not be run or tested. Never claim visual parity without checking the reference.

## Required handoff

At the end, report:

```md
## Screen implemented

## Stitch reference

## Files changed

## Reusable components created or reused

## Theme/token changes

## Memoization decisions

## Verification

## Visual differences

## Known issues

## Next screen
```

Then stop. Do not begin the next screen in this session.
