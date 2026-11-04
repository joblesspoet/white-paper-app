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
