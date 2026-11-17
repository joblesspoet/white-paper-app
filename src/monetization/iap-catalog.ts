/**
 * Central IAP Catalog, RevenueCat Entitlements & Tier Limits (Dev & Production).
 *
 * Pure TypeScript (no React Native or native SDK imports) so it can be
 * imported by both the mobile app, Supabase Edge Functions, and Node tests.
 */

import type { InstrumentKind } from '../canvas/geometry-box.ts';
import type { BoardStyle } from '../persistence/schema.ts';

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
  /** Reference USD display price before store localization. */
  referenceUsdPrice: string;
  /** Store product IDs per environment. */
  storeIds: {
    development: {
      ios: string;
      androidProductId: string;
      androidBasePlanId?: string;
    };
    production: {
      ios: string;
      androidProductId: string;
      androidBasePlanId?: string;
    };
  };
  /** RevenueCat Offering package identifier. */
  revenueCatPackageId: string;
  /** Entitlements unlocked when purchased (subscriptions & non-consumables). */
  grantsEntitlements: readonly RevenueCatEntitlementId[];
  /** Number of Live Class session credits granted (consumables only). */
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
    subtitle: 'Ad-free Home & Export + up to 15 local boards',
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
    title: '5 Live Class Passes',
    subtitle: 'Host 5 live classes (up to 60 min & 25 students each, voice + sync)',
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
    title: '20 Live Class Passes',
    subtitle: 'Host 20 live classes (up to 60 min & 25 students each, voice + sync)',
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
    subtitle: 'Live Classroom (40 students), HD Lesson Video + Face-Cam & all Offline Studio tools',
    referenceUsdPrice: '$3.99/mo',
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
    subtitle: 'Best value (~$2.08/mo) — Live Classroom, HD Video + Face-Cam & all Studio tools',
    referenceUsdPrice: '$24.99/yr',
    storeIds: {
      development: {
        ios: 'com.joblesspoet.flowcanvas.dev.sub.teacher_pro.annual',
        androidProductId: 'flowcanvas_dev_teacher_pro',
        androidBasePlanId: 'annual-base',
      },
      production: {
        ios: 'com.joblesspoet.flowcanvas.sub.teacher_pro.annual',
        androidProductId: 'flowcanvas_teacher_pro',
        androidBasePlanId: 'annual-base',
      },
    },
    revenueCatPackageId: '$rc_annual',
    grantsEntitlements: ['ad_free', 'offline_studio', 'teacher_pro'],
  },
] as const;

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
  /** Full 720p/1080p video recording + Face-Cam PiP. */
  lessonVideoRecorderEnabled: boolean;
  /** Max free preview seconds for lesson recorder on non-subscribed tiers (0 = locked). */
  lessonRecorderPreviewSeconds: number;
  liveClassTrialCount: number;
  liveClassMaxStudents: number;
  liveClassMaxSessionMinutes: number;
  /** Fair-use monthly LiveKit voice hours cap (0 if only consumable passes/trials apply). */
  monthlyLiveVoiceHoursCap: number;
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
    lessonVideoRecorderEnabled: false,
    lessonRecorderPreviewSeconds: 60,
    liveClassTrialCount: 3,
    liveClassMaxStudents: 10,
    liveClassMaxSessionMinutes: 20,
    monthlyLiveVoiceHoursCap: 1,
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
    lessonVideoRecorderEnabled: false,
    lessonRecorderPreviewSeconds: 60,
    liveClassTrialCount: 3,
    liveClassMaxStudents: 10,
    liveClassMaxSessionMinutes: 20,
    monthlyLiveVoiceHoursCap: 1,
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
    lessonVideoRecorderEnabled: false,
    lessonRecorderPreviewSeconds: 90,
    liveClassTrialCount: 3,
    liveClassMaxStudents: 10,
    liveClassMaxSessionMinutes: 20,
    monthlyLiveVoiceHoursCap: 1,
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
    lessonVideoRecorderEnabled: true,
    lessonRecorderPreviewSeconds: 0,
    liveClassTrialCount: 3,
    liveClassMaxStudents: 40,
    liveClassMaxSessionMinutes: 120,
    monthlyLiveVoiceHoursCap: 25,
    adsEnabled: false,
    rewardedAd24hUnlockSupported: false,
  },
};

export const CONSUMABLE_LIVE_PASS_LIMITS = {
  maxStudentsPerRoom: 25,
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
