/**
 * Live Classroom Monetization / Entitlement Gate.
 *
 * Students always join Live Classes for free via 6-digit code or QR code.
 * Bridges the legacy Live Classroom entitlement helper with the unified
 * `src/monetization/` catalog and SQLite-backed `MonetizationState`.
 */

import { TIER_LIMITS } from '../monetization/iap-catalog.ts';
import {
  evaluateLiveClassModeAccess,
  type LiveClassMode,
} from '../monetization/entitlement-service.ts';
import type { MonetizationState } from '../persistence/schema.ts';

export const LIVE_CLASS_FREE_TRIAL_LIMIT = TIER_LIMITS.free.liveVoiceClass.lifetimeTrialCount;

export type LiveClassEntitlement = {
  canHost: boolean;
  tier: 'pro' | 'trial' | 'locked';
  remainingFreeClasses: number;
  reason?: string;
};

export function getLiveClassEntitlement(
  hostedTrialCount = 0,
  hasProSubscription = true,
): LiveClassEntitlement {
  if (hasProSubscription) {
    return {
      canHost: true,
      tier: 'pro',
      remainingFreeClasses: LIVE_CLASS_FREE_TRIAL_LIMIT,
    };
  }
  const remaining = Math.max(0, LIVE_CLASS_FREE_TRIAL_LIMIT - hostedTrialCount);
  if (remaining > 0) {
    return {
      canHost: true,
      tier: 'trial',
      remainingFreeClasses: remaining,
    };
  }
  return {
    canHost: false,
    tier: 'locked',
    remainingFreeClasses: 0,
    reason: 'Upgrade to Teacher Pro or buy Live Voice Passes to host Live Classes.',
  };
}

export function getClassroomEntitlementFromState(
  state: MonetizationState,
  mode: LiveClassMode = 'voice',
  nowMs = Date.now(),
) {
  return evaluateLiveClassModeAccess(state, mode, nowMs);
}
