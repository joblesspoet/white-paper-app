# Task status

## Current phase
Canvas viewport.

## Status
`implemented-unverified` — The viewport model, screen ↔ canvas conversion utilities, pan, pinch-to-zoom, 0.5×–4× zoom limits, focal-point zoom anchoring, reset-viewport action, and temporary debug grid/markers are implemented. The editor renders on the iOS simulator; gesture input itself could not be exercised in this environment.

## Completed slices
- Expo Router stack with Home, Editor, and Settings routes.
- Editor native header replaced with an in-app safe-area top bar.
- Editable board title field, back navigation, undo/redo affordances, and overflow affordance.
- Responsive phone floating bottom tool dock and tablet vertical tool rail.
- Empty canvas guidance placeholder with light/dark theme support.
- Canvas viewport: pure viewport model in `src/canvas/viewport.ts`, Skia grid and canvas-space coordinate markers, live zoom/center HUD, and a `Reset view` action.
- Select tool pans when the drag starts on empty canvas; two fingers pan and zoom during drawing and placement tools.
- Interactive controls use accessibility labels and 44pt minimum targets.
- Ink tools and text/sticky notes from later slices remain in the codebase and were preserved.

## Verification
- `npx tsc --noEmit` passes.
- `npm run test:viewport` passes: screen ↔ canvas round-trip at 0.5×, 0.75×, 1×, 2.5×, and 4×; pan translation at every zoom level; zoom clamping; focal-point anchoring across 0.5×–4×; reset.
- `npx expo export --platform ios` bundles successfully (2032 modules).
- Expo Go on the iPhone 16 simulator opened the editor at 100% zoom with HUD reading `center 180, 304`; the Reset view control, debug markers, and all tool dock buttons were visible.
- Simulator logs are free of Reanimated shared-value render warnings after moving the Skia transform to a derived value.
- No ESLint config or lint script exists in this project.

## Known issues
- Pan and pinch gestures were not exercised with simulator/device input; verify on hardware before marking complete.
- Debug grid points and coordinate markers are temporary and should be removed when ink drawing lands.
- Web export needs `react-dom` and `react-native-web`; it is not configured for this slice.
- Board, ink, and object state are in-memory only and reset on reload.

## Next task
Next: implement ink drawing.
