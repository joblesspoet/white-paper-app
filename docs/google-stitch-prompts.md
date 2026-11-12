# Google Stitch UI/UX prompts

Use these prompts to generate design concepts. Stitch output is a design reference; implementation must follow the component and interaction rules in `docs/screen-architecture.md` and the tokens in `design-system/flowcanvas/MASTER.md`.

## Master product prompt

Design a polished mobile and tablet app called **FlowCanvas**, a local-first infinite whiteboard for capturing ideas and organizing visual thoughts. This is an MVP with no login, no cloud sync, no AI, and no social features. Users can create local boards, draw with a pen, add text and sticky notes, insert shapes and arrows, import images, run on-device OCR, edit extracted text, and export boards as PNG, JPEG, PDF, or editable JSON.

Use a calm, tactile, editorial productivity aesthetic: warm off-white canvas, deep teal primary color, orange action accent, dark teal text, and restrained pastel note colors. Use flat design with clean lines, minimal shadows, generous spacing, and no gradients. Use Calistoga for expressive headings and Inter for UI/body text, or close mobile-safe equivalents. Use only consistent vector icons, never emoji icons. All controls must have accessible labels and 44pt minimum touch targets.

Design for iPhone 15-sized portrait, a small Android phone, iPad portrait, and iPad landscape. Respect safe areas, Dynamic Type, dark mode, reduced motion, and thumb reach. Make the canvas the dominant surface. Use a stack navigation model rather than bottom tabs. Create reusable components, states, empty states, loading states, error states, confirmation dialogs, and interaction prototypes for the important flows.

## Prompt 1 — Home / Boards screen

Create the FlowCanvas Home screen for a local-only whiteboard app. Show a safe-area header with the FlowCanvas name and a settings icon, a prominent `New board` button, and a responsive grid of recent board cards. Each card includes a simple canvas thumbnail, board title, last edited time, and an overflow menu for rename, duplicate, export, and delete. Include a beautiful first-launch empty state with a short explanation and one clear CTA. Show light and dark mode, populated and empty states, delete confirmation, and tablet layouts. Keep the screen calm and content-focused; do not add login, onboarding carousels, bottom tabs, or AI features.

## Prompt 2 — Board editor screen

Design the main FlowCanvas whiteboard editor. The canvas occupies nearly the entire screen and uses a subtle warm off-white background with an optional light dot grid. Add a compact top bar with back, editable board title, undo, redo, and overflow actions. Add a floating tool dock with select, pen, highlighter, eraser, text, sticky note, shape, connector, and image tools. Use clear selected/pressed/disabled states. Show an empty-board hint, an active ink drawing state, an object-selected state, and a multi-selection state. The design must work in portrait and landscape, with a vertical tool rail option for tablets. Avoid dense controls and avoid making the canvas look like a traditional form or dashboard.

## Prompt 3 — Tool options and object inspector

Design contextual bottom sheets for FlowCanvas. First show pen options: color swatches, stroke width, opacity, and highlighter toggle. Then show a selected sticky note with actions for duplicate, delete, lock, bring forward, send backward, and style. Use a compact, thumb-friendly layout with 44pt targets and clear hierarchy. The sheet should feel connected to the selected object and must not obscure the entire canvas. Include keyboard-safe behavior and dark mode. Use vector icons and text labels where an icon could be ambiguous.

## Prompt 4 — Image and OCR flow

Design a three-step local image-to-text flow for FlowCanvas: (1) image source screen with `Take photo` and `Choose from library`, (2) crop and rotate screen with confirm/cancel, and (3) OCR review screen showing the image preview and an editable extracted text field. Explain that text recognition runs on-device where supported. The primary action is `Add text to board`; the secondary action is `Add image only`. Include recognition loading, no-text-found, permission denied, and OCR error states. Never imply that OCR is required to place an image. Make the flow feel fast, trustworthy, and privacy-conscious.

## Prompt 5 — Export and settings

Design the FlowCanvas export bottom sheet and local settings screen. Export actions include visible board, selected region, PNG, JPEG, PDF, share, and editable `.flowcanvas.json` backup. Show progress for large exports and a success state. Settings include theme, canvas background, default pen settings, haptics, export preference, about/privacy, and clear local data. Use destructive confirmation for clearing data. Keep settings simple and avoid account or subscription sections.

## Prototype interaction prompt

Create a clickable prototype for these flows: Home → New board → Editor; Editor → Pen options → draw; Editor → Sticky note → type → save; Editor → Image → Crop → OCR review → Add text to board; Editor → Export → Share. Include back behavior, cancel behavior, undo/redo feedback, keyboard presentation, loading states, and error recovery. Prioritize fast, predictable interactions over decorative animation.

## Prompt 6 — Phase A: Teaching utilities (Laser, Timer, Calculator & Grids)

Design the FlowCanvas smart teaching utilities inside the board editor while preserving the flat design system (`#F0FDFA` light / `#0B2B28` dark canvas, `#0D9488` teal primary, `#EA580C` orange accent, 1px `#99F6E4` borders, zero drop shadows). Show:
1. A decaying glowing red/teal **Laser Pointer** stroke trail on a math square-grid (`grid`) or isometric (`isometric`) canvas background.
2. A compact, draggable **Floating Classroom Timer** card (`MM:SS`, `1m`/`5m`/`10m` presets, progress bar, `Start/Pause`, `Pin to board`, and minimized pill state).
3. A draggable **Floating Scientific Calculator** card (`sin`, `cos`, `tan`, `DEG/RAD`, `√`, `xʸ`, `π`, expression preview, and a primary `Paste to board` action).

## Prompt 7 — Phase B: Geometry Box, 45+ 2D/3D Shapes & Table Creator

Design the FlowCanvas drafting and structured diagramming surfaces:
1. **Interactive Geometry Box overlay** on the canvas: translucent flat-bordered **Ruler** (with cm ticks and live angle badge `30.0°`), **Protractor** (`0°–180°` arc with ray handles), **Compass** (needle pivot + pencil arm sweeping an arc), and **Set Square** triangle.
2. **Categorized Shape & STEM Picker sheet:** tabs for `2D Polygons`, `3D Solids` (cube, cylinder, cone, pyramid with dashed hidden edges), `Graphs & Venn` (4-quadrant axes, 2/3-set Venn), and `STEM Stamps` (resistor, capacitor, battery, beaker, atom).
3. **Canvas Table Object (`TableObject`):** a selected `4×3` table with teal header tint, in-place cell text editing, and selection rail actions (`+ Row`, `+ Col`, `Header`, `Style`, `Delete`).

## Prompt 8 — Phase C: Math Formula Builder, Smart Recognition & Stylus Controls

Design the FlowCanvas **Math Keyboard Sheet** and smart ink states:
1. Bottom/popover **Math Formula Builder** with live equation preview (`\frac{-b \pm \sqrt{b^2 - 4ac}}{2a}`), category tabs (`Fractions & Powers`, `Calculus & Sums`, `Matrices`, `Greek & Logic`, `Quick Formulas`), and `Insert formula` CTA.
2. **Hold-to-Snap toast/indicator** showing a rough hand-drawn circle snapping into a crisp vector ellipse, and a `Convert ink to text` action on lasso-selected handwriting.
3. **Stylus & Palm Rejection controls** in `InkingQuickTray` (`Stylus-only drawing` toggle and pressure-sensitive fountain pen mode).

## Prompt 9 — Phase D: Multi-Page Switcher & PDF Worksheet Markup

Design the FlowCanvas multi-page and PDF annotation experience:
1. Compact top-right **Page Navigator pill** (`< Page 2 / 5 > +`) and slide-up **Page Sorter Sheet** showing page thumbnails, page titles, `Add page`, `Duplicate`, reorder handles, and `Import PDF for markup`.
2. **PDF Import Range modal** allowing teachers to import all or selected pages of a `.pdf` worksheet into locked background pages with highlighter and red-pen grading annotations on top.

## Prompt 10 — Phase E & F: Lesson Recorder, Face-Cam & Live Classroom Broadcast

Design the FlowCanvas recording and live classroom surfaces:
1. **Floating Face-Cam Bubble** (circular `124pt` camera feed with `2px` teal ring docked in the corner) and top-center **Lesson Recorder HUD** (`Rec ● 04:12`, mic level, `Pause`, `Stop`, quality badge `720p`).
2. **Live Class Host Sheet:** large 6-digit classroom code (`482 - 910`), scannable QR code card, student roster with **Raise Hand (`👋`)** badges, per-student `Pass the Marker` (`Allow to draw`) toggle, `Student Boards Gallery` grid, and `Lock class` switch.
3. **Student Join Modal** on Home: zero-account entry with 6-digit code input and display name field.
