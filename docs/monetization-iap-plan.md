# FlowCanvas Monetization, IAP Catalog, Limits & Ads Plan

**Branch:** `feat/iap-competitive-pricing`  
**Billing Provider:** RevenueCat (`react-native-purchases`)  
**Ad Provider:** Google AdMob (`react-native-google-mobile-ads`)  
**Product Goal:** Beat competitors (`Explain Everything`, `Whiteboard.fi`, `Goodnotes`, `Notability`, `Draw & Teach`) on downloads and purchase conversion with low, accessible prices + PPP regional pricing, while keeping LiveKit & Supabase unit economics strictly positive.

---

## 1. Monetization Strategy Summary (Competitive Positioning)

1. **Generous Free + Smart Ads + 1-on-1 Live Whiteboard** — Free users get an infinite whiteboard, **4-minute 480p Lesson Video Recording** (with subtle `"Made with FlowCanvas"` corner watermark for viral sharing), and **1-on-1 Board Sync** (1 student, 45 min, Supabase-only at `$0` LiveKit cost via 1 Rewarded Ad). **Students joining a 1-on-1 session never see ads.**
2. **Low-Priced Non-Consumables (`$1.99` / `$4.99`)** — All **$0-server-cost** local features (multi-page boards, PDF markup, Geometry Box, STEM plotter/charts, Active Recall) can be owned forever via a one-time unlock—undercutting Goodnotes/Notability (`$12–$36/yr`) at ~70–85% margin.
3. **Consumable 1-on-1 Tutoring Passes (`$1.99` / `$4.99`)** — Private tutors buy 5 or 20 Live 1-on-1 Voice Tutoring passes pay-as-you-go without a subscription (covers LiveKit + Supabase per session).
4. **Competitive Subscription (`$2.99/mo` or `$19.99/yr` with 7-Day Free Trial)** — **Teacher Pro** beats Explain Everything (`$9.99/mo`) and Whiteboard.fi Pro (`$5–$7/mo`), unlocking **Unlimited 1-on-1 Live Voice Tutoring (35 hrs/mo)**, **Unlimited 1080p HD Video + Floating Face-Cam (no watermark)**, **all Offline Studio tools**, and **Ad-Free**.

---

## 2. IAP Catalog (Development & Production)

Defined in [`src/monetization/iap-catalog.ts`](../src/monetization/iap-catalog.ts).

### A. Non-Consumables (One-Time Purchases)

| Key | Price (USD Tier 1) | Dev Store ID (iOS / Android) | Prod Store ID (iOS / Android) | Entitlements |
|---|---|---|---|---|
| `remove_ads` | `$1.99` | `com.joblesspoet.flowcanvas.dev.iap.remove_ads` / `flowcanvas_dev_remove_ads` | `com.joblesspoet.flowcanvas.iap.remove_ads` / `flowcanvas_remove_ads` | `ad_free` |
| `offline_studio` | `$4.99` | `com.joblesspoet.flowcanvas.dev.iap.offline_studio` / `flowcanvas_dev_offline_studio` | `com.joblesspoet.flowcanvas.iap.offline_studio` / `flowcanvas_offline_studio` | `ad_free`, `offline_studio` |

### B. Consumables (1-on-1 Live Voice Tutoring Session Credits)

| Key | Price (USD Tier 1) | Dev Store ID (iOS / Android) | Prod Store ID (iOS / Android) | Credits Granted |
|---|---|---|---|---|
| `live_class_5_pack` | `$1.99` | `com.joblesspoet.flowcanvas.dev.consumable.live_5` / `flowcanvas_dev_live_5` | `com.joblesspoet.flowcanvas.consumable.live_5` / `flowcanvas_live_5` | `5` Live 1-on-1 Voice Passes (60 min each) |
| `live_class_20_pack` | `$4.99` | `com.joblesspoet.flowcanvas.dev.consumable.live_20` / `flowcanvas_dev_live_20` | `com.joblesspoet.flowcanvas.consumable.live_20` / `flowcanvas_live_20` | `20` Live 1-on-1 Voice Passes (60 min each) |

### C. Auto-Renewable Subscriptions

| Key | Price (USD Tier 1) | Intro Offer | Dev Store ID (iOS / Android Product + Base Plan + Offer) | Prod Store ID (iOS / Android Product + Base Plan + Offer) | Entitlements |
|---|---|---|---|---|---|
| `teacher_pro_monthly` | `$2.99/mo` | None | `com.joblesspoet.flowcanvas.dev.sub.teacher_pro.monthly` / `flowcanvas_dev_teacher_pro` (`monthly-base`) | `com.joblesspoet.flowcanvas.sub.teacher_pro.monthly` / `flowcanvas_teacher_pro` (`monthly-base`) | `ad_free`, `offline_studio`, `teacher_pro` |
| `teacher_pro_annual` | `$19.99/yr` *(~$1.67/mo)* | **7-day free trial** | `com.joblesspoet.flowcanvas.dev.sub.teacher_pro.annual` / `flowcanvas_dev_teacher_pro` (`annual-base`, `annual-7day-trial`) | `com.joblesspoet.flowcanvas.sub.teacher_pro.annual` / `flowcanvas_teacher_pro` (`annual-base`, `annual-7day-trial`) | `ad_free`, `offline_studio`, `teacher_pro` |

### D. Purchasing Power Parity (PPP) Regional Pricing
Configure regional pricing in App Store Connect and Google Play Console (`REGIONAL_PPP_GUIDELINES` in `iap-catalog.ts`):
- **Tier 1 (US, UK, EU, CA, AU):** `100%` (`$2.99/mo`, `$19.99/yr`, `$4.99` Studio)
- **Tier 2 (BR, MX, TR, MY, PL):** `~60%` (`~$1.79/mo`, `~$11.99/yr`, `~$2.99` Studio)
- **Tier 3 (PK, IN, ID, PH, EG, NG):** `~45%` (`~$1.35/mo`, `~$8.99/yr`, `~$2.25` Studio)
*(Board-Only Live Sync defaults to `off` for LiveKit audio so Tier 3 users remain profitable.)*

### E. RevenueCat Offerings & Environment Separation
- **Offerings:** `default_dev` (Development) and `default` (Production).
- **Environment variables (`.env`):**
  - `EXPO_PUBLIC_IAP_ENV=development | production`
  - `EXPO_PUBLIC_REVENUECAT_IOS_KEY_DEV` / `EXPO_PUBLIC_REVENUECAT_IOS_KEY_PROD`
  - `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY_DEV` / `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY_PROD`
  - `EXPO_PUBLIC_ADMOB_BANNER_ID_*`, `EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID_*`, `EXPO_PUBLIC_ADMOB_REWARDED_ID_*`
- **Local Dev Testing:** Use RevenueCat Test Store + Xcode `.storekit` local configuration on iOS and License Testing on Android Internal Testing.

---

## 3. Free vs. Paid Feature Limits Matrix

| Feature Area | Free (`free`) | Remove Ads (`ad_free`) | Offline Studio (`offline_studio`) | Live Voice Pass (`consumable`) | Teacher Pro (`teacher_pro` Sub) |
|---|---|---|---|---|---|
| **Local Boards** | **5 boards** (+1 via Rewarded Ad) | **15 boards** | **Unlimited** | — | **Unlimited** |
| **Pages per Board (`PageNavigator`)** | **1 page** | **1 page** | **Unlimited** | — | **Unlimited** |
| **Core Drawing, Sticky Notes, Text, Image Crop, OCR** | Unlimited | Unlimited | Unlimited | — | Unlimited |
| **Teaching Utilities (Laser, Timer, Calculator)** | Included | Included | Included | — | Included |
| **Canvas Backgrounds** | `blank`, `dots`, `grid` | `blank`, `dots`, `grid` | All 5 (`+ ruled`, `+ isometric`) | — | All 5 |
| **Geometry Box** | `Ruler` only *(others 24h via Rewarded Ad)* | `Ruler` only | **All** (Ruler, Protractor, Compass, Set Squares) | — | **All** |
| **53 Shapes, Tables, Math Builder, Plotter, Charts** | Basic shapes/tables *(STEM 24h via Rewarded Ad)* | Basic shapes/tables | **Full STEM Suite** | — | **Full STEM Suite** |
| **Hold-to-Snap, Stylus Pressure, Palm Rejection** | Standard ink *(24h via Rewarded Ad)* | Standard ink | **Full Stylus Suite** | — | **Full Stylus Suite** |
| **PDF Import & Multi-Page PDF Export** | Locked *(3-page trial via Rewarded Ad)* | Locked | **Full (up to 30 pages/PDF)** | — | **Full (up to 30 pages/PDF)** |
| **Active Recall (Reveal Tape, Curtain, Voice Pins, Flashcards, OCR Explode)** | Locked *(24h via Rewarded Ad)* | Locked | **Full Active Recall** | — | **Full Active Recall** |
| **Lesson Video Recorder + Floating Face-Cam (`Phase E`)** | **4-min (240s)** at `480p` + subtle watermark *(no Face-Cam)* | **4-min** at `480p` + watermark | **5-min** at `480p` + watermark | — | **Unlimited HD (`480p`/`720p`/`1080p`) + Face-Cam + No Watermark** |
| **Join Live Class as Student** | **Free & Ad-Free** | **Free & Ad-Free** | **Free & Ad-Free** | **Free & Ad-Free** | **Free & Ad-Free** |
| **1-on-1 Board Sync (Supabase only, $0 LiveKit)** | **Unlocked per session via 1 Rewarded Ad** (1 student, **45 min**, 15 Hz) | **No ads** (1 student, **60 min**) | **No ads** (1 student, **90 min**) | — | **Unlimited** (1 student, **180 min**, 30 Hz) |
| **1-on-1 Live Voice Tutoring (`Phase F` — LiveKit + Supabase)** | **3 lifetime trials** (1 student, **30 min**) | **3 lifetime trials** (1 student, 30 min) | **3 lifetime trials** (1 student, 45 min) | **1 Pass = 1 Session** (1 student, **60 min**) | **35 Voice hrs/mo** (1 student, **180 min/session**) |
| **Ads** | Home banner + post-export interstitial + rewarded | **None** | **None** | **None during class** | **None** |

---

## 4. Required Pre-Integration Adjustments (Must Complete Before Payment Wiring)

### 1. Cost & Security Guardrails for LiveKit + Supabase
- **Split Board-Only Sync vs. LiveKit Voice (`useEditorLiveClass.ts`):**
  - Currently [`useEditorLiveClass.ts`](../src/hooks/editor/useEditorLiveClass.ts) auto-connects LiveKit on host start and student join. Change the host flow so teachers choose **"Board Sync Only"** (Supabase only, `$0` LiveKit cost—default for in-room/projector classes) or **"Live Class + Voice"** (connects LiveKit only when toggled on).
- **Server-Side Verification in `livekit-token` (`supabase/functions/livekit-token/index.ts`):**
  - Remove open `--no-verify-jwt` minting without entitlement checks.
  - Validate the host's RevenueCat entitlement (via RevenueCat REST API or webhook-synced Supabase `user_wallets` table) or consume 1 Live Voice Pass atomically before minting a teacher token.
  - Reduce token `exp` from `4 hours` (`60 * 60 * 4`) to match the tier (`20 min` trial, `65 min` pass, `125 min` Teacher Pro) and enforce monthly voice-hour caps.
- **Throttle Supabase Realtime Fan-Out (`src/classroom/protocol.ts`):**
  - Respect tier `ephemeralIntervalMs` (`66 ms` = 15 Hz on Free/Ad-Free, `50 ms` on Studio, `33 ms` on Teacher Pro when `participants <= 15`, auto-throttling above 15).
  - Only broadcast `student.board.update` when a student's scratchpad actually changes (dirty check) or when the teacher opens the Student Gallery tab.

### 2. Free 4-Minute Lesson Recorder Watermark (`Phase E`)
- Add a subtle `"Made with FlowCanvas"` corner watermark flag when `lessonRecorderWatermark === true` and enforce `lessonRecorderMaxSeconds` (`240s` free, `300s` studio, unlimited on `teacher_pro`) + max `480p` quality cap in [`lesson-recorder.ts`](../src/recorder/lesson-recorder.ts) & [`LessonRecorderBar.tsx`](../src/components/LessonRecorderBar.tsx).

### 3. Stable User Identity & Consumable Pass Ledger
- **Anonymous RevenueCat IDs work** for Subscriptions and Non-Consumables (`Restore Purchases` restores them via Apple/Google ID).
- **Consumable Live Voice Passes (`live_class_5_pack`, `live_class_20_pack`)** are **NOT** automatically restored by Apple/Google after app reinstall.
- **Required Adjustment:** Create a Supabase table (`user_wallets`: `user_id`, `live_class_passes`, `trial_classes_used`, `voice_minutes_used_month`, `updated_at`) updated by RevenueCat Webhooks (`INITIAL_PURCHASE`, `NON_RENEWING_PURCHASE`, `RENEWAL`, `EXPIRATION`) plus optional Sign in with Apple / Google for cross-device pass sync.

### 4. Local SQLite Persistence (Migration 5 in `src/persistence/schema.ts`)
Add local tracking for offline-first enforcement & grace periods:
- `hosted_trial_count` (replaces the hardcoded `0` default in [`entitlement.ts`](../src/classroom/entitlement.ts))
- `cached_tier` + `cached_entitlements_expires_at` (7-day offline grace cache so Pro users aren't locked out without Wi-Fi)
- `rewarded_unlocks_json` (stores 24-hour unlock timestamps per gated feature key + Board-Only live pass)
- `last_interstitial_shown_at` (enforces the 8-minute ad cooldown)

### 5. AdMob, ATT & Store Policy Adjustments
- **Never show ads:** on the active drawing canvas (`app/editor.tsx`), during Live Class hosting, or to Students in `JoinClassModal` / Student Live Editor mode.
- **iOS `Info.plist` (`app.json`):** Add `GADApplicationIdentifier`, `SKAdNetworkItems`, and `NSUserTrackingUsageDescription` (or serve non-personalized contextual ads to avoid ATT prompt friction).
- **GDPR / UMP Consent:** Integrate Google UMP consent dialog on launch for EEA/UK users before initializing AdMob.
- **Expo Go Fallback:** Wrap `react-native-purchases` and `react-native-google-mobile-ads` behind safe lazy `require()` adapters (like `native-recorder.ts` and `audio-adapter.ts`) so `npm test` and Expo Go never crash.

### 6. App Store & Google Play Compliance UI
- **Restore Purchases** button in Settings (`app/settings.tsx`) and on the Paywall modal (mandatory for Apple App Review).
- **Manage Subscription** link + **Terms of Use (EULA)** & **Privacy Policy** links on the Paywall modal.
- Clear 7-day free trial + auto-renewal price disclosure before the Subscribe CTA.

---

## 5. Highlighting Paid Features in the UI (Implementation Sequence)

1. **Step 1 — Entitlement & Usage Service (`src/monetization/`)**
   - Build `entitlement-service.ts` merging RevenueCat status, Rewarded Ad 24h unlocks, and SQLite counters (`canCreateBoard`, `canAddPage`, `canUseTool`, `canRecordVideo`, `canHostLiveClass`).
2. **Step 2 — Visual `PRO` / `LIVE` Badges & Trial Counters**
   - **Home (`app/index.tsx`):** Board counter pill (`3 / 5 free boards`) + subtle `Upgrade` pill in header + Home bottom Banner Ad (hidden for `ad_free`+).
   - **QuickCreationSheet & EditorToolRail:** Small `PRO` pill on `PDF Import`, `Protractor/Compass/Set Square`, `Math`, `Reveal Tape`, `Voice Pin`, `Curtain/Spotlight`, `Flashcards`, and `HD` badge on `Face-Cam` / `Lesson Recorder` (>4 min or 720p/1080p).
   - **PageNavigator & BoardStyleModal:** `PRO` badge on `+ Add Page` (when pages >= 1) and `Ruled` / `Isometric` backgrounds.
   - **ExportSheet:** `PRO` badge on `All pages` scope and `PDF` multi-page export; trigger cooldown Interstitial Ad after PNG/JPEG share on Free tier.
   - **LiveClassHostSheet / EditorTopBar (`Live Class`):** Let teachers choose **Board Sync Only** (Rewarded Ad on Free / unlimited on paid) vs **Live Class + Voice** (shows `3 voice trials left` or Live Pass count).
3. **Step 3 — Paywall Modal & Rewarded Ad Choice**
   - Tapping a `PRO` offline tool shows **"Watch Short Ad (Try Free 24h)"** OR **"Unlock Forever ($4.99)"** / **"Start 7-Day Free Trial ($19.99/yr)"**.
   - Tapping **HD Video / Face-Cam** or **Live Voice** (after 3 trials) shows **Teacher Pro** (`$19.99/yr` with 7-day free trial highlighted, or `$2.99/mo`) + **Live Voice Pass Packs** (`5 for $1.99` / `20 for $4.99`).
4. **Step 4 — RevenueCat + AdMob Native Wiring & Supabase Webhook**
   - Install `react-native-purchases` and `react-native-google-mobile-ads`, configure EAS Dev Build, wire RevenueCat Webhook to Supabase, and lock down `livekit-token`.
