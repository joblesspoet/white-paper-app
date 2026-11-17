# FlowCanvas Monetization, IAP Catalog, Limits & Ads Plan

**Branch:** `feat/iap-monetization`  
**Billing Provider:** RevenueCat (`react-native-purchases`)  
**Ad Provider:** Google AdMob (`react-native-google-mobile-ads`)  
**Product Goal:** Maximize downloads and purchase conversion with low, accessible prices while ensuring LiveKit + Supabase costs never go negative.

---

## 1. Monetization Strategy Summary

1. **Generous Free + Smart Ads** — Free users get a full-featured infinite whiteboard and basic teaching tools so downloads, ratings, and classroom sharing grow organically. Ads only appear in non-disruptive places (Home banner, post-export interstitial cooldown, and optional Rewarded "Try Pro 24h" ads). **Students joining a Live Class never see ads.**
2. **Low-Priced Non-Consumables (`$1.99` / `$4.99`)** — All **$0-server-cost** local features (multi-page boards, PDF markup, Geometry Box, STEM plotter/charts, Active Recall) can be owned forever via a one-time unlock. High conversion, ~70–85% margin.
3. **Consumable Live Class Passes (`$1.99` / `$4.99`)** — Occasional tutors can buy 5 or 20 Live Class passes pay-as-you-go without a subscription. Each pass pays for its LiveKit + Supabase usage.
4. **Affordable Subscription (`$3.99/mo` or `$24.99/yr`)** — **Teacher Pro** unlocks **Live Classroom Hosting (LiveKit Voice + Supabase Sync)**, **HD Lesson Video Recording + Floating Face-Cam**, **all Offline Studio tools**, and **Ad-Free**.

---

## 2. IAP Catalog (Development & Production)

Defined in [`src/monetization/iap-catalog.ts`](../src/monetization/iap-catalog.ts).

### A. Non-Consumables (One-Time Purchases)

| Key | Price (USD) | Dev Store ID (iOS / Android) | Prod Store ID (iOS / Android) | Entitlements |
|---|---|---|---|---|
| `remove_ads` | `$1.99` | `com.joblesspoet.flowcanvas.dev.iap.remove_ads` / `flowcanvas_dev_remove_ads` | `com.joblesspoet.flowcanvas.iap.remove_ads` / `flowcanvas_remove_ads` | `ad_free` |
| `offline_studio` | `$4.99` | `com.joblesspoet.flowcanvas.dev.iap.offline_studio` / `flowcanvas_dev_offline_studio` | `com.joblesspoet.flowcanvas.iap.offline_studio` / `flowcanvas_offline_studio` | `ad_free`, `offline_studio` |

### B. Consumables (Live Class Session Credits)

| Key | Price (USD) | Dev Store ID (iOS / Android) | Prod Store ID (iOS / Android) | Credits Granted |
|---|---|---|---|---|
| `live_class_5_pack` | `$1.99` | `com.joblesspoet.flowcanvas.dev.consumable.live_5` / `flowcanvas_dev_live_5` | `com.joblesspoet.flowcanvas.consumable.live_5` / `flowcanvas_live_5` | `5` Live Class Passes (60 min, 25 students) |
| `live_class_20_pack` | `$4.99` | `com.joblesspoet.flowcanvas.dev.consumable.live_20` / `flowcanvas_dev_live_20` | `com.joblesspoet.flowcanvas.consumable.live_20` / `flowcanvas_live_20` | `20` Live Class Passes (60 min, 25 students) |

### C. Auto-Renewable Subscriptions

| Key | Price (USD) | Dev Store ID (iOS / Android Product + Base Plan) | Prod Store ID (iOS / Android Product + Base Plan) | Entitlements |
|---|---|---|---|---|
| `teacher_pro_monthly` | `$3.99/mo` | `com.joblesspoet.flowcanvas.dev.sub.teacher_pro.monthly` / `flowcanvas_dev_teacher_pro` (`monthly-base`) | `com.joblesspoet.flowcanvas.sub.teacher_pro.monthly` / `flowcanvas_teacher_pro` (`monthly-base`) | `ad_free`, `offline_studio`, `teacher_pro` |
| `teacher_pro_annual` | `$24.99/yr` *(~$2.08/mo)* | `com.joblesspoet.flowcanvas.dev.sub.teacher_pro.annual` / `flowcanvas_dev_teacher_pro` (`annual-base`) | `com.joblesspoet.flowcanvas.sub.teacher_pro.annual` / `flowcanvas_teacher_pro` (`annual-base`) | `ad_free`, `offline_studio`, `teacher_pro` |

### D. RevenueCat Offerings & Environment Separation

- **Offerings:** `default_dev` (Development) and `default` (Production).
- **Environment variables (`.env`):**
  - `EXPO_PUBLIC_IAP_ENV=development | production`
  - `EXPO_PUBLIC_REVENUECAT_IOS_KEY_DEV` / `EXPO_PUBLIC_REVENUECAT_IOS_KEY_PROD`
  - `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY_DEV` / `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY_PROD`
  - `EXPO_PUBLIC_ADMOB_BANNER_ID_*`, `EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID_*`, `EXPO_PUBLIC_ADMOB_REWARDED_ID_*` (Google test unit IDs in dev, live unit IDs in prod).
- **Local Dev Testing:** Use RevenueCat Test Store + Xcode `.storekit` local configuration on iOS and License Testing on Android Internal Testing.

---

## 3. Free vs. Paid Feature Limits Matrix

| Feature Area | Free (`free`) | Remove Ads (`ad_free`) | Offline Studio (`offline_studio`) | Live Pass (`consumable`) | Teacher Pro (`teacher_pro` Sub) |
|---|---|---|---|---|---|
| **Local Boards** | **5 boards** (+1 via Rewarded Ad) | **15 boards** | **Unlimited** | — | **Unlimited** |
| **Pages per Board (`PageNavigator`)** | **1 page** | **1 page** | **Unlimited** | — | **Unlimited** |
| **Core Drawing, Sticky Notes, Text, Image Crop, OCR** | Unlimited | Unlimited | Unlimited | — | Unlimited |
| **Teaching Utilities (Laser, Timer, Calculator)** | Included | Included | Included | — | Included |
| **Canvas Backgrounds** | `blank`, `dots`, `grid` | `blank`, `dots`, `grid` | All 5 (`+ ruled`, `+ isometric`) | — | All 5 |
| **Geometry Box** | `Ruler` only *(others 24h via Rewarded Ad)* | `Ruler` only | **All** (Ruler, Protractor, Compass, Set Squares) | — | **All** |
| **53 Shapes, Tables, Math Builder, Function Plotter, Charts** | Basic shapes/tables *(STEM tools 24h via Rewarded Ad)* | Basic shapes/tables | **Full STEM Suite** | — | **Full STEM Suite** |
| **Hold-to-Snap, Stylus Pressure, Palm Rejection** | Standard ink *(24h via Rewarded Ad)* | Standard ink | **Full Stylus Suite** | — | **Full Stylus Suite** |
| **PDF Import & Multi-Page PDF Export** | Locked *(3-page trial via Rewarded Ad)* | Locked | **Full (up to 30 pages/PDF)** | — | **Full (up to 30 pages/PDF)** |
| **Active Recall (Reveal Tape, Curtain, Voice Pins, Flashcards, OCR Explode)** | Locked *(24h via Rewarded Ad)* | Locked | **Full Active Recall** | — | **Full Active Recall** |
| **Lesson Video Recorder + Floating Face-Cam (`Phase E`)** | **60s preview** (or via Rewarded Ad) | **60s preview** | **90s preview** (60 FPS local replay only) | — | **Unlimited HD (`480p`/`720p`/`1080p`) + Face-Cam** |
| **Join Live Class as Student** | **Free & Ad-Free** | **Free & Ad-Free** | **Free & Ad-Free** | **Free & Ad-Free** | **Free & Ad-Free** |
| **Host Live Class (`Phase F` — LiveKit + Supabase)** | **3 lifetime trials** (max **10 students**, **20 min**) | **3 lifetime trials** (max 10 students, 20 min) | **3 lifetime trials** (max 10 students, 20 min) | **1 Pass = 1 Class** (max **25 students**, **60 min**) | **Unlimited Board Sync** + **25 Voice hrs/mo** (max **40 students**, **120 min/session**) |
| **Ads** | Home banner + post-export interstitial + rewarded | **None** | **None** | **None during class** | **None** |

---

## 4. Required Pre-Integration Adjustments (Must Complete Before Payment Wiring)

### 1. Cost & Security Guardrails for LiveKit + Supabase
- **Opt-In Live Voice Toggle (`Board-Only Sync` vs `Live Class + Voice`):**
  - Currently [`useEditorLiveClass.ts`](../src/hooks/editor/useEditorLiveClass.ts) connects LiveKit automatically on host start and student join. Change this so **Board Sync (Supabase)** starts immediately, and **LiveKit Voice** connects only when the teacher enables **"Live Voice"** (saving 50–80% of LiveKit minutes for in-room/projector teachers).
- **Server-Side Verification in `livekit-token` (`supabase/functions/livekit-token/index.ts`):**
  - Remove open `--no-verify-jwt` minting without entitlement checks.
  - Validate the host's RevenueCat entitlement (via RevenueCat REST API or webhook-synced Supabase `user_entitlements` table) or consume 1 Live Class Pass atomically before minting a teacher token.
  - Reduce token `exp` from `4 hours` (`60 * 60 * 4`) to match the tier (`20 min` trial, `65 min` consumable pass, `125 min` Teacher Pro) and enforce monthly voice-hour caps.
- **Throttle Supabase Realtime Fan-Out (`src/classroom/protocol.ts`):**
  - Dynamically lower `EPHEMERAL_STREAM_INTERVAL_MS` frequency (e.g., from 30 Hz to 15 Hz when `participants.length > 15`).
  - Only broadcast `student.board.update` when a student's scratchpad actually changes (dirty flag) or when the teacher opens the Student Gallery tab.

### 2. Stable User Identity & Consumable Pass Ledger
- **Anonymous RevenueCat IDs work** for Subscriptions and Non-Consumables (`Restore Purchases` restores them via Apple/Google ID).
- **Consumable Live Class Passes (`live_class_5_pack`, `live_class_20_pack`)** are **NOT** automatically restored by Apple/Google after app reinstall.
- **Required Adjustment:** Create a lightweight Supabase table (`user_wallets`: `user_id`, `live_class_passes`, `trial_classes_used`, `voice_minutes_used_month`, `updated_at`) backed by RevenueCat Webhooks (`INITIAL_PURCHASE`, `NON_RENEWING_PURCHASE`, `RENEWAL`, `EXPIRATION`) plus optional Sign in with Apple / Google for cross-device pass sync.

### 3. Local SQLite Persistence (Migration 5 in `src/persistence/schema.ts`)
Add local tracking for offline-first enforcement & grace periods:
- `hosted_trial_count` (replaces the hardcoded `0` default in [`entitlement.ts`](../src/classroom/entitlement.ts))
- `cached_tier` + `cached_entitlements_expires_at` (allows offline Pro tools to work on airplanes/classrooms without Wi-Fi for a 7-day grace window)
- `rewarded_unlocks_json` (stores 24-hour unlock timestamps per gated feature key)
- `last_interstitial_shown_at` (enforces the 8-minute ad cooldown)

### 4. AdMob, ATT & Store Policy Adjustments
- **Never show ads:** on the active drawing canvas (`app/editor.tsx`), during Live Class hosting, or to Students in `JoinClassModal` / Student Live Editor mode.
- **iOS Info.plist (`app.json`):** Add `GADApplicationIdentifier`, `SKAdNetworkItems`, and `NSUserTrackingUsageDescription` (only if requesting ATT for personalized ads; alternatively serve non-personalized contextual ads to skip ATT friction).
- **GDPR / UMP Consent:** Integrate Google UMP consent dialog on launch for EEA/UK users before initializing AdMob.
- **Expo Go Fallback:** Just like `native-recorder.ts` and `audio-adapter.ts`, wrap `react-native-purchases` and `react-native-google-mobile-ads` behind safe lazy `require()` adapters so `npm test` (Node) and Expo Go continue running without crashes.

### 5. App Store & Google Play Compliance UI
- **Restore Purchases** button in Settings (`app/settings.tsx`) and on the Paywall modal (mandatory for Apple App Review).
- **Manage Subscription** link + **Terms of Use (EULA)** & **Privacy Policy** links on the Paywall modal.
- Clear renewal/pricing text before purchase buttons.

---

## 5. Highlighting Paid Features in the UI (Implementation Sequence)

1. **Step 1 — Entitlement & Usage Service (`src/monetization/`)**
   - Build `entitlement-service.ts` merging RevenueCat status, Rewarded Ad 24h unlocks, and SQLite counters (`canCreateBoard`, `canAddPage`, `canUseTool`, `canRecordVideo`, `canHostLiveClass`).
2. **Step 2 — Visual `PRO` / `LIVE` Badges & Trial Counters**
   - **Home (`app/index.tsx`):** Board counter pill (`3 / 5 free boards`) + subtle `Upgrade` pill in header + Home bottom Banner Ad (hidden for `ad_free`+).
   - **QuickCreationSheet & EditorToolRail:** Small `PRO` pill on `PDF Import`, `Protractor/Compass/Set Square`, `Math`, `Reveal Tape`, `Voice Pin`, `Curtain/Spotlight`, `Flashcards`, and `HD Video` on `Lesson Recorder` / `Face-Cam`.
   - **PageNavigator & BoardStyleModal:** `PRO` badge on `+ Add Page` (when pages >= 1) and `Ruled` / `Isometric` backgrounds.
   - **ExportSheet:** `PRO` badge on `All pages` scope and `PDF` multi-page export; trigger cooldown Interstitial Ad after PNG/JPEG share on Free tier.
   - **EditorTopBar (`Live Class` button):** Show remaining trials (`3 free left`) or Live Pass count before opening `LiveClassHostSheet`.
3. **Step 3 — Paywall Modal & Rewarded Ad Choice**
   - When a Free user taps a `PRO` offline tool: show a friendly sheet with **"Watch Short Ad (Try Free 24h)"** OR **"Unlock Forever ($4.99)"** / **"Go Teacher Pro ($3.99/mo)"**.
   - When a Free user taps **Record Video** or **Host Live Class** (after 3 trials): show the **Teacher Pro** subscription cards (`Monthly $3.99` / `Annual $24.99 — Save 48%`) + **Live Class Pass Packs** (`5 for $1.99` / `20 for $4.99`).
4. **Step 4 — RevenueCat + AdMob Native Wiring & Supabase Webhook**
   - Install `react-native-purchases` and `react-native-google-mobile-ads`, configure EAS Dev Build, wire RevenueCat Webhook to Supabase, and lock down `livekit-token`.
