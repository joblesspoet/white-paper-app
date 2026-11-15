/**
 * Live Classroom Monetization / Entitlement Gate.
 *
 * Students always join Live Classes for free via 6-digit code or QR code.
 * Hosting a Live Class as a teacher is gated here so RevenueCat
 * (`react-native-purchases`) can be wired in one place before App Store launch.
 */

export const LIVE_CLASS_FREE_TRIAL_LIMIT = 3;

export type LiveClassEntitlement = {
  canHost: boolean;
  tier: 'pro' | 'trial' | 'locked';
  remainingFreeClasses: number;
  reason?: string;
};

/**
 * Currently returns `canHost: true` for local testing and Phase F verification.
 * Swap this implementation with RevenueCat customerInfo entitlement checks
 * when ready for production billing.
 */
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
    reason: 'Upgrade to Teacher Pro to host unlimited Live Classes.',
  };
}
