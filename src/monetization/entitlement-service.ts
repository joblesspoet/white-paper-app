/**
 * Pure Entitlement, Limit & Ad-Cooldown Evaluation Engine.
 *
 * Evaluates user capabilities from persisted `MonetizationState` + `TIER_LIMITS`
 * so both the React Native UI and Node verification scripts run identical checks.
 */

import type { InstrumentKind } from '../canvas/geometry-box.ts';
import type { BoardStyle, MonetizationState } from '../persistence/schema.ts';
import {
  AD_POLICY_CONSTANTS,
  CONSUMABLE_LIVE_PASS_LIMITS,
  TIER_LIMITS,
  resolveUserPlanTier,
  type RevenueCatEntitlementId,
  type TierFeatureLimits,
  type UserPlanTier,
} from './iap-catalog.ts';

export type RewardedFeatureKey =
  | 'extra_board'
  | 'multi_page'
  | 'pdf_import'
  | 'multi_page_export'
  | 'board_styles'
  | 'geometry_pro'
  | 'math_stem'
  | 'active_recall'
  | 'face_cam'
  | 'board_only_live_class';

export const REWARDED_FEATURE_META: Record<
  RewardedFeatureKey,
  { title: string; rewardLabel: string; description: string; proSuggestion: 'offline_studio' | 'teacher_pro' }
> = {
  extra_board: {
    title: 'Board Limit Reached',
    rewardLabel: 'Watch short ad for +1 board slot',
    description: 'Free accounts include 5 boards. Watch a quick ad for +1 extra board slot or unlock unlimited boards.',
    proSuggestion: 'offline_studio',
  },
  multi_page: {
    title: 'Multi-Page Boards',
    rewardLabel: 'Watch short ad to unlock for 24h',
    description: 'Add multiple pages to any board and organize worksheets with the Page Sorter.',
    proSuggestion: 'offline_studio',
  },
  pdf_import: {
    title: 'PDF Worksheet Markup',
    rewardLabel: 'Watch short ad to unlock for 24h',
    description: 'Import multi-page PDFs as locked background worksheets for pen & sticky-note markup.',
    proSuggestion: 'offline_studio',
  },
  multi_page_export: {
    title: 'Multi-Page PDF Export',
    rewardLabel: 'Watch short ad to unlock for 24h',
    description: 'Export every page of your board into one crisp multi-page PDF.',
    proSuggestion: 'offline_studio',
  },
  board_styles: {
    title: 'Ruled & Isometric Paper',
    rewardLabel: 'Watch short ad to unlock for 24h',
    description: 'Unlock lined notebook paper and 60° isometric geometry grids.',
    proSuggestion: 'offline_studio',
  },
  geometry_pro: {
    title: 'Full Geometry Box',
    rewardLabel: 'Watch short ad to unlock for 24h',
    description: 'Unlock the Protractor, Compass, and Set Squares with magnetic edge snapping.',
    proSuggestion: 'offline_studio',
  },
  math_stem: {
    title: 'Math & STEM Studio',
    rewardLabel: 'Watch short ad to unlock for 24h',
    description: 'Unlock the Math Formula Builder, Function Plotter, Table Charts, and Stylus Palm Rejection.',
    proSuggestion: 'offline_studio',
  },
  active_recall: {
    title: 'Active Recall & Voice Pins',
    rewardLabel: 'Watch short ad to unlock for 24h',
    description: 'Unlock Reveal Tape, Stage Curtain/Spotlight, Voice Pins, Flashcards, and OCR Explode.',
    proSuggestion: 'offline_studio',
  },
  face_cam: {
    title: 'Face-Cam & Unlimited HD Video',
    rewardLabel: 'Watch short ad to try Face-Cam (24h)',
    description: 'Upgrade to Teacher Pro for unlimited 1080p HD Lesson Videos, Face-Cam PiP, and no watermark.',
    proSuggestion: 'teacher_pro',
  },
  board_only_live_class: {
    title: '1-on-1 Live Whiteboard',
    rewardLabel: 'Watch short ad to host (45 min · 1 student)',
    description: 'Sync your whiteboard live 1-on-1 via 6-digit code & QR (no audio). Or upgrade for unlimited 1-on-1 hosting.',
    proSuggestion: 'teacher_pro',
  },
};

export type PaywallTrigger =
  | { reason: 'upgrade' }
  | { reason: 'remove_ads' }
  | { reason: 'board_limit'; currentCount: number; maxBoards: number }
  | { reason: 'feature'; feature: RewardedFeatureKey }
  | { reason: 'lesson_recorder_hd' }
  | { reason: 'live_voice'; remainingTrials: number; passesRemaining: number };

export function isEntitlementCacheValid(
  state: MonetizationState,
  nowMs = Date.now(),
): boolean {
  if (state.activeEntitlements.length === 0) return false;
  if (!state.cachedExpiresAt) return true;
  const expMs = Date.parse(state.cachedExpiresAt);
  if (!Number.isFinite(expMs)) return true;
  return expMs > nowMs;
}

export function getActiveEntitlements(
  state: MonetizationState,
  nowMs = Date.now(),
): RevenueCatEntitlementId[] {
  if (!isEntitlementCacheValid(state, nowMs)) return [];
  return [...state.activeEntitlements];
}

export function getEffectiveTier(
  state: MonetizationState,
  nowMs = Date.now(),
): UserPlanTier {
  return resolveUserPlanTier(getActiveEntitlements(state, nowMs));
}

export function getEffectiveLimits(
  state: MonetizationState,
  nowMs = Date.now(),
): TierFeatureLimits {
  return TIER_LIMITS[getEffectiveTier(state, nowMs)];
}

export function isRewardedUnlockActive(
  state: MonetizationState,
  feature: RewardedFeatureKey,
  nowMs = Date.now(),
): boolean {
  const iso = state.rewardedUnlocks[feature];
  if (!iso) return false;
  const expMs = Date.parse(iso);
  return Number.isFinite(expMs) && expMs > nowMs;
}

export type FeatureAccessResult = {
  allowed: boolean;
  via: 'tier' | 'rewarded_ad' | 'locked';
  rewardExpiresAt?: string;
};

export function hasFeatureAccess(
  state: MonetizationState,
  feature: RewardedFeatureKey,
  nowMs = Date.now(),
): FeatureAccessResult {
  const limits = getEffectiveLimits(state, nowMs);
  let unlockedByTier = false;
  switch (feature) {
    case 'extra_board':
      unlockedByTier = limits.maxBoards === null;
      break;
    case 'multi_page':
      unlockedByTier = limits.maxPagesPerBoard === null;
      break;
    case 'pdf_import':
      unlockedByTier = limits.pdfImportEnabled;
      break;
    case 'multi_page_export':
      unlockedByTier = limits.multiPageExportEnabled;
      break;
    case 'board_styles':
      unlockedByTier =
        limits.allowedBoardStyles.includes('ruled') &&
        limits.allowedBoardStyles.includes('isometric');
      break;
    case 'geometry_pro':
      unlockedByTier = limits.allowedGeometryTools.includes('protractor');
      break;
    case 'math_stem':
      unlockedByTier = limits.advancedStemEnabled;
      break;
    case 'active_recall':
      unlockedByTier = limits.activeRecallEnabled;
      break;
    case 'face_cam':
      unlockedByTier = limits.faceCamPipEnabled;
      break;
    case 'board_only_live_class':
      unlockedByTier = limits.boardOnlyLiveClass.enabled && !limits.boardOnlyLiveClass.requiresRewardedAd;
      break;
  }

  if (unlockedByTier) {
    return { allowed: true, via: 'tier' };
  }
  if (isRewardedUnlockActive(state, feature, nowMs)) {
    return {
      allowed: true,
      via: 'rewarded_ad',
      rewardExpiresAt: state.rewardedUnlocks[feature],
    };
  }
  return { allowed: false, via: 'locked' };
}

export function getEffectiveMaxBoards(
  state: MonetizationState,
  nowMs = Date.now(),
): number | null {
  const limits = getEffectiveLimits(state, nowMs);
  if (limits.maxBoards === null) return null;
  return limits.maxBoards + Math.max(0, state.bonusBoardSlots);
}

export function canCreateBoard(
  state: MonetizationState,
  currentBoardCount: number,
  nowMs = Date.now(),
): { allowed: boolean; maxBoards: number | null; currentCount: number } {
  const maxBoards = getEffectiveMaxBoards(state, nowMs);
  if (maxBoards === null) {
    return { allowed: true, maxBoards: null, currentCount: currentBoardCount };
  }
  return {
    allowed: currentBoardCount < maxBoards,
    maxBoards,
    currentCount: currentBoardCount,
  };
}

export function canAddBoardPage(
  state: MonetizationState,
  currentPageCount: number,
  nowMs = Date.now(),
): boolean {
  const limits = getEffectiveLimits(state, nowMs);
  if (limits.maxPagesPerBoard === null) return true;
  if (isRewardedUnlockActive(state, 'multi_page', nowMs)) return true;
  return currentPageCount < limits.maxPagesPerBoard;
}

export function canUseBoardStyle(
  state: MonetizationState,
  style: BoardStyle,
  nowMs = Date.now(),
): boolean {
  const limits = getEffectiveLimits(state, nowMs);
  if (limits.allowedBoardStyles.includes(style)) return true;
  return isRewardedUnlockActive(state, 'board_styles', nowMs);
}

export function canUseGeometryTool(
  state: MonetizationState,
  instrument: InstrumentKind,
  nowMs = Date.now(),
): boolean {
  const limits = getEffectiveLimits(state, nowMs);
  if (limits.allowedGeometryTools.includes(instrument)) return true;
  return isRewardedUnlockActive(state, 'geometry_pro', nowMs);
}

export type LiveClassMode = 'board-only' | 'voice';

export type LiveClassModeAccess = {
  allowed: boolean;
  mode: LiveClassMode;
  maxStudents: number;
  maxSessionMinutes: number;
  ephemeralIntervalMs: number;
  requiresRewardedAd: boolean;
  /** True when starting this Voice session consumes 1 free lifetime trial. */
  willUseTrial: boolean;
  /** True when starting this Voice session consumes 1 Live Pass credit. */
  willConsumePass: boolean;
  remainingVoiceTrials: number;
  passesRemaining: number;
  reason?: string;
};

export function evaluateLiveClassModeAccess(
  state: MonetizationState,
  mode: LiveClassMode,
  nowMs = Date.now(),
): LiveClassModeAccess {
  const limits = getEffectiveLimits(state, nowMs);
  const remainingVoiceTrials = Math.max(
    0,
    limits.liveVoiceClass.lifetimeTrialCount - state.hostedVoiceTrialCount,
  );
  const passesRemaining = Math.max(0, state.liveClassPasses);

  if (mode === 'board-only') {
    const unlockedByAd = isRewardedUnlockActive(state, 'board_only_live_class', nowMs);
    const needsAd = limits.boardOnlyLiveClass.requiresRewardedAd && !unlockedByAd;
    return {
      allowed: !needsAd,
      mode: 'board-only',
      maxStudents: limits.boardOnlyLiveClass.maxStudents,
      maxSessionMinutes: limits.boardOnlyLiveClass.maxSessionMinutes,
      ephemeralIntervalMs: limits.boardOnlyLiveClass.ephemeralIntervalMs,
      requiresRewardedAd: needsAd,
      willUseTrial: false,
      willConsumePass: false,
      remainingVoiceTrials,
      passesRemaining,
      reason: needsAd
        ? 'Watch 1 short ad to unlock a 45-min 1-on-1 Live Whiteboard session.'
        : undefined,
    };
  }

  // mode === 'voice' (LiveKit + Supabase)
  if (limits.tier === 'teacher_pro') {
    return {
      allowed: true,
      mode: 'voice',
      maxStudents: limits.liveVoiceClass.maxStudents,
      maxSessionMinutes: limits.liveVoiceClass.maxSessionMinutes,
      ephemeralIntervalMs: 33,
      requiresRewardedAd: false,
      willUseTrial: false,
      willConsumePass: false,
      remainingVoiceTrials,
      passesRemaining,
    };
  }

  if (passesRemaining > 0) {
    return {
      allowed: true,
      mode: 'voice',
      maxStudents: CONSUMABLE_LIVE_PASS_LIMITS.maxStudentsPerRoom,
      maxSessionMinutes: CONSUMABLE_LIVE_PASS_LIMITS.maxSessionMinutes,
      ephemeralIntervalMs: 50,
      requiresRewardedAd: false,
      willUseTrial: false,
      willConsumePass: true,
      remainingVoiceTrials,
      passesRemaining,
    };
  }

  if (remainingVoiceTrials > 0) {
    return {
      allowed: true,
      mode: 'voice',
      maxStudents: limits.liveVoiceClass.maxStudents,
      maxSessionMinutes: limits.liveVoiceClass.maxSessionMinutes,
      ephemeralIntervalMs: 66,
      requiresRewardedAd: false,
      willUseTrial: true,
      willConsumePass: false,
      remainingVoiceTrials,
      passesRemaining,
    };
  }

  return {
    allowed: false,
    mode: 'voice',
    maxStudents: limits.liveVoiceClass.maxStudents,
    maxSessionMinutes: limits.liveVoiceClass.maxSessionMinutes,
    ephemeralIntervalMs: 66,
    requiresRewardedAd: false,
    willUseTrial: false,
    willConsumePass: false,
    remainingVoiceTrials: 0,
    passesRemaining: 0,
    reason: 'Your 3 free 1-on-1 Live Voice trials are used. Upgrade to Teacher Pro or get 1-on-1 Live Voice Passes.',
  };
}

export function shouldShowPostExportInterstitial(
  state: MonetizationState,
  nowMs = Date.now(),
): boolean {
  const limits = getEffectiveLimits(state, nowMs);
  if (!limits.adsEnabled) return false;
  if (!state.lastInterstitialAt) return true;
  const lastMs = Date.parse(state.lastInterstitialAt);
  if (!Number.isFinite(lastMs)) return true;
  return nowMs - lastMs >= AD_POLICY_CONSTANTS.interstitialCooldownMs;
}
