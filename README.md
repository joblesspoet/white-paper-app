# FlowCanvas / Whiteboard App

A mobile-first collaborative whiteboard that turns rough ideas into structured plans and actions.

> **Product promise:** Capture ideas naturally, then turn them into something useful.

## Product scope

The app supports an infinite canvas with handwriting, sticky notes, shapes, arrows, voice capture, AI organization, collaboration, history, and exports.

## Planning documents

- [Architecture](docs/architecture.md) — system design, services, data flow, and security
- [Feature plan](docs/feature-plan.md) — feature-by-feature implementation sequence
- [Local OCR](docs/ocr.md) — OCR engine evaluation, on-device flow, and limitations
- [AI cost model](docs/ai-cost-model.md) — assumptions, usage scenarios, and estimated monthly costs
- [MVP roadmap](docs/roadmap.md) — milestones, acceptance criteria, and delivery order

## Recommended initial stack

| Layer | Recommendation |
|---|---|
| Mobile app | React Native + Expo + TypeScript |
| Canvas | `@shopify/react-native-skia` with a normalized document model |
| Navigation/state | Expo Router + Zustand + TanStack Query |
| Backend | Supabase: Postgres, Auth, Storage, Realtime, Edge Functions |
| Sync | Supabase Realtime initially; durable operation log for conflict recovery |
| AI orchestration | Supabase Edge Functions with provider adapters |
| AI | OpenAI-compatible text/vision model + speech-to-text provider |
| Monitoring | Sentry + PostHog |
| Billing | RevenueCat for mobile subscriptions |
| Delivery | EAS Build/Submit/Update + GitHub Actions |

## First implementation principle

Do not store the board as a single giant JSON blob. Store a versioned document plus small, append-only operations. This makes undo, history, collaboration, offline recovery, and analytics possible without rewriting the entire board.

## Current project structure

Expo-managed app using Expo Router file-based routes on a single native stack.

```text
app/
  _layout.tsx     root stack, header theme, safe-area provider
  index.tsx       Home / Boards (placeholder)
  editor.tsx      Board editor (canvas, tools, objects, undo/redo)
  settings.tsx    Settings (placeholder)
src/
  theme.ts        design-system tokens
  canvas/         pure canvas logic: viewport, ink, document/objects, history, colours
  media/          image picking, crop geometry, and the durable local media store
  ocr/            on-device recognition adapter, review model, and text placement
  persistence/    SQLite schema, migrations, and the board repository
  components/     shared UI (buttons, icon family, canvas, option sheets, image/OCR flows)
assets/           icons and splash assets
docs/             planning, architecture, and task status
design-system/    design system master file
prompts/          per-session task prompts
```

```bash
npm install
npm start          # Expo dev server (Expo Go, SDK 58)
npm run typecheck  # tsc --noEmit
npm test           # viewport, ink, object/history, image, and OCR checks (plain Node)
```

Image import (camera/photo picker, crop, rotate) and SQLite persistence run in Expo
Go. Local text recognition uses `expo-mlkit-ocr`, a native module, so OCR needs a
development build (`npx expo run:ios` / `npx expo run:android` or EAS Build). In
Expo Go the review screen reports that recognition is unavailable and the image
can still be added with `Add image only`.

Working state, decisions, and the next slice are tracked in [docs/task-status.md](docs/task-status.md).

## Proposed first commands

```bash
npx create-expo-app@latest . --template tabs
npm install zustand @tanstack/react-query zod
npx expo install @shopify/react-native-skia expo-sqlite expo-file-system expo-haptics
```

These were the original planning commands and are kept for history; the project was bootstrapped with the `blank-typescript` template and Expo Router was added in the navigation slice (see `docs/task-status.md`).

The implementation should begin only after confirming the target platforms, authentication requirements, and whether real-time collaboration is required in the MVP.
