/**
 * Central IAP Catalog, RevenueCat Entitlements & Tier Limits (Dev & Production).
 *
 * Pure TypeScript (no React Native or native SDK imports) so it can be
 * imported by both the mobile app, Supabase Edge Functions, and Node tests.
 */

import type { InstrumentKind } from '../canvas/geometry-box.ts';
import type { BoardStyle } from '../persistence/schema.ts';
import type { VideoQuality } from '../recorder/lesson-recorder.ts';

export type IapEnvironment = 'development' | 'production';

export type RevenueCatEntitlementId = 'ad_free' | 'offline_studio' | 'teacher_pro';

export type UserPlanTier = 'free' | 'ad_free' | 'offline_studio' | 'teacher_pro';

export type IapProductKind = 'non_consumable' | 'consumable' | 'subscription';

export type IapProductDefinition = {
  /** Stable internal key used in UI & analytics. */
  key:
    | 'remove_ads'
    | 'offline_studio'
    | 'live_class_5_pack'
    | 'live_class_20_pack'
    | 'teacher_pro_monthly'
    | 'teacher_pro_annual';
  kind: IapProductKind;
  title: string;
  subtitle: string;
  /** Reference USD display price before store localization / PPP adjustments. */
  referenceUsdPrice: string;
  /** Introductory free-trial duration in days (subscriptions only). */
  introTrialDays?: number;
  /** Store product IDs per environment. */
  storeIds: {
    development: {
      ios: string;
      androidProductId: string;
      androidBasePlanId?: string;
      androidOfferId?: string;
    };
    production: {
      ios: string;
      androidProductId: string;
      androidBasePlanId?: string;
      androidOfferId?: string;
    };
  };
  /** RevenueCat Offering package identifier. */
  revenueCatPackageId: string;
  /** Entitlements unlocked when purchased (subscriptions & non-consumables). */
  grantsEntitlements: readonly RevenueCatEntitlementId[];
  /** Number of Live Class + Voice session credits granted (consumables only). */
  grantsLiveClassPasses?: number;
};

export const REVENUECAT_OFFERING_IDS = {
  development: 'default_dev',
  production: 'default',
} as const;

export const REVENUECAT_ENTITLEMENT_IDS: readonly RevenueCatEntitlementId[] = [
  'ad_free',
  'offline_studio',
  'teacher_pro',
] as const;

export const IAP_PRODUCTS: readonly IapProductDefinition[] = [
  {
    key: 'remove_ads',
    kind: 'non_consumable',
    title: 'Remove Ads',
    subtitle: 'Ad-free Home & Export + up to 15 local boards + ad-free Board-Only Live Sync',
    referenceUsdPrice: '$1.99',
    storeIds: {
      development: {
        ios: 'com.joblesspoet.flowcanvas.dev.iap.remove_ads',
        androidProductId: 'flowcanvas_dev_remove_ads',
      },
      production: {
        ios: 'com.joblesspoet.flowcanvas.iap.remove_ads',
        androidProductId: 'flowcanvas_remove_ads',
      },
    },
    revenueCatPackageId: 'remove_ads',
    grantsEntitlements: ['ad_free'],
  },
  {
    key: 'offline_studio',
    kind: 'non_consumable',
    title: 'Offline Studio Pack',
    subtitle: 'Unlimited boards/pages, PDF markup, Geometry Box, Math, Plotter & Active Recall (no ads)',
    referenceUsdPrice: '$4.99',
    storeIds: {
      development: {
        ios: 'com.joblesspoet.flowcanvas.dev.iap.offline_studio',
        androidProductId: 'flowcanvas_dev_offline_studio',
      },
      production: {
        ios: 'com.joblesspoet.flowcanvas.iap.offline_studio',
        androidProductId: 'flowcanvas_offline_studio',
      },
    },
    revenueCatPackageId: 'offline_studio',
    grantsEntitlements: ['ad_free', 'offline_studio'],
  },
  {
    key: 'live_class_5_pack',
    kind: 'consumable',
    title: '5 Live 1-on-1 Tutoring Passes',
    subtitle: 'Host 5 private 1-on-1 live voice sessions (60 min each)',
    referenceUsdPrice: '$1.99',
    storeIds: {
      development: {
        ios: 'com.joblesspoet.flowcanvas.dev.consumable.live_5',
        androidProductId: 'flowcanvas_dev_live_5',
      },
      production: {
        ios: 'com.joblesspoet.flowcanvas.consumable.live_5',
        androidProductId: 'flowcanvas_live_5',
      },
    },
    revenueCatPackageId: 'live_class_5_pack',
    grantsEntitlements: [],
    grantsLiveClassPasses: 5,
  },
  {
    key: 'live_class_20_pack',
    kind: 'consumable',
    title: '20 Live 1-on-1 Tutoring Passes',
    subtitle: 'Host 20 private 1-on-1 live voice sessions (60 min each)',
    referenceUsdPrice: '$4.99',
    storeIds: {
      development: {
        ios: 'com.joblesspoet.flowcanvas.dev.consumable.live_20',
        androidProductId: 'flowcanvas_dev_live_20',
      },
      production: {
        ios: 'com.joblesspoet.flowcanvas.consumable.live_20',
        androidProductId: 'flowcanvas_live_20',
      },
    },
    revenueCatPackageId: 'live_class_20_pack',
    grantsEntitlements: [],
    grantsLiveClassPasses: 20,
  },
  {
    key: 'teacher_pro_monthly',
    kind: 'subscription',
    title: 'Teacher Pro Monthly',
    subtitle: '1-on-1 Live Voice Tutoring, Unlimited HD Video + Face-Cam & all Studio tools',
    referenceUsdPrice: '$2.99/mo',
    storeIds: {
      development: {
        ios: 'com.joblesspoet.flowcanvas.dev.sub.teacher_pro.monthly',
        androidProductId: 'flowcanvas_dev_teacher_pro',
        androidBasePlanId: 'monthly-base',
      },
      production: {
        ios: 'com.joblesspoet.flowcanvas.sub.teacher_pro.monthly',
        androidProductId: 'flowcanvas_teacher_pro',
        androidBasePlanId: 'monthly-base',
      },
    },
    revenueCatPackageId: '$rc_monthly',
    grantsEntitlements: ['ad_free', 'offline_studio', 'teacher_pro'],
  },
  {
    key: 'teacher_pro_annual',
    kind: 'subscription',
    title: 'Teacher Pro Annual',
    subtitle: '7-day free trial, then ~$1.67/mo — 1-on-1 Live Voice, HD Video + Face-Cam & all Studio tools',
    referenceUsdPrice: '$19.99/yr',
    introTrialDays: 7,
    storeIds: {
      development: {
        ios: 'com.joblesspoet.flowcanvas.dev.sub.teacher_pro.annual',
        androidProductId: 'flowcanvas_dev_teacher_pro',
        androidBasePlanId: 'annual-base',
        androidOfferId: 'annual-7day-trial',
      },
      production: {
        ios: 'com.joblesspoet.flowcanvas.sub.teacher_pro.annual',
        androidProductId: 'flowcanvas_teacher_pro',
        androidBasePlanId: 'annual-base',
        androidOfferId: 'annual-7day-trial',
      },
    },
    revenueCatPackageId: '$rc_annual',
    grantsEntitlements: ['ad_free', 'offline_studio', 'teacher_pro'],
  },
] as const;

export type BoardOnlyLiveClassLimits = {
  enabled: boolean;
  /** Free users unlock a 30-min Board-Only session by watching 1 Rewarded Ad ($0 LiveKit cost). */
  requiresRewardedAd: boolean;
  maxStudents: number;
  maxSessionMinutes: number;
  /** Ephemeral broadcast interval in ms (66 ms = ~15 Hz to keep Supabase message volume low). */
  ephemeralIntervalMs: number;
};

export type LiveVoiceClassLimits = {
  lifetimeTrialCount: number;
  maxStudents: number;
  maxSessionMinutes: number;
  /** Fair-use monthly LiveKit voice hours cap (0 if only consumable passes/trials apply). */
  monthlyVoiceHoursCap: number;
};

export type TierFeatureLimits = {
  tier: UserPlanTier;
  /** Null means unlimited. */
  maxBoards: number | null;
  /** Null means unlimited. */
  maxPagesPerBoard: number | null;
  allowedBoardStyles: readonly BoardStyle[];
  allowedGeometryTools: readonly InstrumentKind[];
  pdfImportEnabled: boolean;
  /** Max pages per PDF import on this tier (null = cap only by technical safety limit 30). */
  maxPdfImportPages: number | null;
  multiPageExportEnabled: boolean;
  advancedStemEnabled: boolean;
  activeRecallEnabled: boolean;
  /** Unlimited 720p/1080p HD lesson video recording without watermark. */
  lessonVideoUnlimitedEnabled: boolean;
  /** Max free lesson recorder seconds on non-subscribed tiers (null = unlimited). */
  lessonRecorderMaxSeconds: number | null;
  /** Highest video resolution allowed on this tier. */
  lessonRecorderMaxQuality: VideoQuality;
  /** Adds a subtle "Made with FlowCanvas" corner watermark on non-subscribed recordings. */
  lessonRecorderWatermark: boolean;
  /** Floating Face-Cam PiP bubble during recordings. */
  faceCamPipEnabled: boolean;
  /** Lightweight Supabase-only Live Class (no LiveKit audio cost). */
  boardOnlyLiveClass: BoardOnlyLiveClassLimits;
  /** Full LiveKit Voice + Supabase Live Class limits. */
  liveVoiceClass: LiveVoiceClassLimits;
  adsEnabled: boolean;
  rewardedAd24hUnlockSupported: boolean;
};

export const TIER_LIMITS: Record<UserPlanTier, TierFeatureLimits> = {
  free: {
    tier: 'free',
    maxBoards: 5,
    maxPagesPerBoard: 1,
    allowedBoardStyles: ['blank', 'dots', 'grid'],
    allowedGeometryTools: ['ruler'],
    pdfImportEnabled: false,
    maxPdfImportPages: 0,
    multiPageExportEnabled: false,
    advancedStemEnabled: false,
    activeRecallEnabled: false,
    lessonVideoUnlimitedEnabled: false,
    lessonRecorderMaxSeconds: 240, // 4-minute free recording (matches/beats 3-min Explain Everything)
    lessonRecorderMaxQuality: '480p',
    lessonRecorderWatermark: true,
    faceCamPipEnabled: false,
    boardOnlyLiveClass: {
      enabled: true,
      requiresRewardedAd: true,
      maxStudents: 1, // 1-on-1 Private Tutoring session
      maxSessionMinutes: 45,
      ephemeralIntervalMs: 66,
    },
    liveVoiceClass: {
      lifetimeTrialCount: 3,
      maxStudents: 1, // 1-on-1 Private Tutoring session
      maxSessionMinutes: 30,
      monthlyVoiceHoursCap: 1.5,
    },
    adsEnabled: true,
    rewardedAd24hUnlockSupported: true,
  },
  ad_free: {
    tier: 'ad_free',
    maxBoards: 15,
    maxPagesPerBoard: 1,
    allowedBoardStyles: ['blank', 'dots', 'grid'],
    allowedGeometryTools: ['ruler'],
    pdfImportEnabled: false,
    maxPdfImportPages: 0,
    multiPageExportEnabled: false,
    advancedStemEnabled: false,
    activeRecallEnabled: false,
    lessonVideoUnlimitedEnabled: false,
    lessonRecorderMaxSeconds: 240,
    lessonRecorderMaxQuality: '480p',
    lessonRecorderWatermark: true,
    faceCamPipEnabled: false,
    boardOnlyLiveClass: {
      enabled: true,
      requiresRewardedAd: false,
      maxStudents: 1,
      maxSessionMinutes: 60,
      ephemeralIntervalMs: 66,
    },
    liveVoiceClass: {
      lifetimeTrialCount: 3,
      maxStudents: 1,
      maxSessionMinutes: 30,
      monthlyVoiceHoursCap: 1.5,
    },
    adsEnabled: false,
    rewardedAd24hUnlockSupported: false,
  },
  offline_studio: {
    tier: 'offline_studio',
    maxBoards: null,
    maxPagesPerBoard: null,
    allowedBoardStyles: ['blank', 'dots', 'grid', 'ruled', 'isometric'],
    allowedGeometryTools: ['ruler', 'protractor', 'compass', 'set-square-45', 'set-square-30-60'],
    pdfImportEnabled: true,
    maxPdfImportPages: 30,
    multiPageExportEnabled: true,
    advancedStemEnabled: true,
    activeRecallEnabled: true,
    lessonVideoUnlimitedEnabled: false,
    lessonRecorderMaxSeconds: 300, // 5-minute 480p preview; HD + Face-Cam in Teacher Pro
    lessonRecorderMaxQuality: '480p',
    lessonRecorderWatermark: true,
    faceCamPipEnabled: false,
    boardOnlyLiveClass: {
      enabled: true,
      requiresRewardedAd: false,
      maxStudents: 1,
      maxSessionMinutes: 90,
      ephemeralIntervalMs: 50,
    },
    liveVoiceClass: {
      lifetimeTrialCount: 3,
      maxStudents: 1,
      maxSessionMinutes: 45,
      monthlyVoiceHoursCap: 2.5,
    },
    adsEnabled: false,
    rewardedAd24hUnlockSupported: false,
  },
  teacher_pro: {
    tier: 'teacher_pro',
    maxBoards: null,
    maxPagesPerBoard: null,
    allowedBoardStyles: ['blank', 'dots', 'grid', 'ruled', 'isometric'],
    allowedGeometryTools: ['ruler', 'protractor', 'compass', 'set-square-45', 'set-square-30-60'],
    pdfImportEnabled: true,
    maxPdfImportPages: 30,
    multiPageExportEnabled: true,
    advancedStemEnabled: true,
    activeRecallEnabled: true,
    lessonVideoUnlimitedEnabled: true,
    lessonRecorderMaxSeconds: null,
    lessonRecorderMaxQuality: '1080p',
    lessonRecorderWatermark: false,
    faceCamPipEnabled: true,
    boardOnlyLiveClass: {
      enabled: true,
      requiresRewardedAd: false,
      maxStudents: 1,
      maxSessionMinutes: 180,
      ephemeralIntervalMs: 33,
    },
    liveVoiceClass: {
      lifetimeTrialCount: 3,
      maxStudents: 1,
      maxSessionMinutes: 180,
      monthlyVoiceHoursCap: 35,
    },
    adsEnabled: false,
    rewardedAd24hUnlockSupported: false,
  },
};

export const CONSUMABLE_LIVE_PASS_LIMITS = {
  maxStudentsPerRoom: 1,
  maxSessionMinutes: 60,
} as const;

export const AD_POLICY_CONSTANTS = {
  /** Minimum gap between post-export interstitial ads on the Free tier. */
  interstitialCooldownMs: 8 * 60 * 1000,
  /** Duration of a temporary Pro-tool unlock earned from watching 1 Rewarded Ad. */
  rewardedUnlockDurationMs: 24 * 60 * 60 * 1000,
  /** Students joining a Live Class never see ads. */
  showAdsInStudentLiveMode: false,
  /** Never show banners or interstitials over the active drawing canvas. */
  showAdsOnActiveCanvas: false,
} as const;

/**
 * Purchasing Power Parity (PPP) target multipliers for App Store Connect &
 * Google Play Console regional pricing to boost conversion in emerging markets.
 * Keep Board-Only default + 25h LiveKit cap so Tier 3 prices remain profitable.
 */
export const REGIONAL_PPP_GUIDELINES = [
  {
    band: 'tier_1',
    exampleMarkets: ['US', 'CA', 'UK', 'AU', 'EU'],
    priceMultiplier: 1.0,
    teacherProMonthlyUsdEq: '$2.99',
    teacherProAnnualUsdEq: '$19.99',
    offlineStudioUsdEq: '$4.99',
  },
  {
    band: 'tier_2',
    exampleMarkets: ['BR', 'MX', 'TR', 'MY', 'PL'],
    priceMultiplier: 0.6,
    teacherProMonthlyUsdEq: '~$1.79',
    teacherProAnnualUsdEq: '~$11.99',
    offlineStudioUsdEq: '~$2.99',
  },
  {
    band: 'tier_3',
    exampleMarkets: ['PK', 'IN', 'ID', 'PH', 'EG', 'NG'],
    priceMultiplier: 0.45,
    teacherProMonthlyUsdEq: '~$1.35',
    teacherProAnnualUsdEq: '~$8.99',
    offlineStudioUsdEq: '~$2.25',
  },
] as const;

export function resolveIapEnvironment(rawEnv?: string): IapEnvironment {
  return rawEnv?.trim().toLowerCase() === 'production' ? 'production' : 'development';
}

export function resolveUserPlanTier(
  entitlements: readonly RevenueCatEntitlementId[],
): UserPlanTier {
  if (entitlements.includes('teacher_pro')) return 'teacher_pro';
  if (entitlements.includes('offline_studio')) return 'offline_studio';
  if (entitlements.includes('ad_free')) return 'ad_free';
  return 'free';
}
