import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Alert } from 'react-native';

import type { InstrumentKind } from '../canvas/geometry-box';
import { PaywallModal } from '../components/monetization/PaywallModal';
import { RewardedAdPromptModal } from '../components/monetization/RewardedAdPromptModal';
import { getLocalDatabase } from '../persistence/expo-store';
import {
  addLiveClassPasses,
  consumeLiveClassPass,
  grantBonusBoardSlot,
  grantRewardedUnlock,
  incrementHostedVoiceTrial,
  loadMonetizationState,
  recordInterstitialShown,
  resetDevMonetizationState,
  updateMonetizationEntitlements,
} from '../persistence/repository';
import {
  DEFAULT_MONETIZATION_STATE,
  type BoardStyle,
  type MonetizationState,
  type PersistedEntitlementId,
} from '../persistence/schema';
import { enqueuePersistenceWrite } from '../persistence/write-queue';
import { usePreferences } from '../settings/preferences-context';
import {
  canAddBoardPage,
  canCreateBoard,
  canUseBoardStyle,
  canUseGeometryTool,
  evaluateLiveClassModeAccess,
  getEffectiveLimits,
  getEffectiveMaxBoards,
  getEffectiveTier,
  hasFeatureAccess,
  shouldShowPostExportInterstitial,
  type FeatureAccessResult,
  type LiveClassMode,
  type LiveClassModeAccess,
  type PaywallTrigger,
  type RewardedFeatureKey,
} from './entitlement-service';
import {
  AD_POLICY_CONSTANTS,
  resolveIapEnvironment,
  type IapEnvironment,
  type IapProductDefinition,
  type TierFeatureLimits,
  type UserPlanTier,
} from './iap-catalog';

type MonetizationContextValue = {
  state: MonetizationState;
  tier: UserPlanTier;
  limits: TierFeatureLimits;
  environment: IapEnvironment;
  ready: boolean;
  showAds: boolean;
  maxBoards: number | null;
  hasFeature: (feature: RewardedFeatureKey) => FeatureAccessResult;
  canCreateAnotherBoard: (currentBoardCount: number) => {
    allowed: boolean;
    maxBoards: number | null;
    currentCount: number;
  };
  canAddAnotherPage: (currentPageCount: number) => boolean;
  canUseStyle: (style: BoardStyle) => boolean;
  canUseGeometry: (instrument: InstrumentKind) => boolean;
  getLiveClassAccess: (mode: LiveClassMode) => LiveClassModeAccess;
  openPaywall: (trigger: PaywallTrigger) => void;
  requestRewardedUnlock: (feature: RewardedFeatureKey, onUnlocked?: () => void) => void;
  promptGatedFeature: (feature: RewardedFeatureKey, onUnlocked?: () => void) => void;
  recordLiveVoiceStart: () => Promise<void>;
  maybeShowPostExportInterstitial: () => Promise<boolean>;
  restorePurchases: () => Promise<void>;
};

const MonetizationContext = createContext<MonetizationContextValue | null>(null);

const OFFLINE_CACHE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

export function MonetizationProvider({ children }: { children: ReactNode }) {
  const { theme, reducedMotion } = usePreferences();
  const [state, setState] = useState<MonetizationState>(DEFAULT_MONETIZATION_STATE);
  const [ready, setReady] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [paywallTrigger, setPaywallTrigger] = useState<PaywallTrigger | null>(null);
  const [rewardedFeature, setRewardedFeature] = useState<RewardedFeatureKey | null>(null);
  const [busyProductKey, setBusyProductKey] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const stateRef = useRef(state);
  stateRef.current = state;
  const pendingRewardCallbackRef = useRef<(() => void) | null>(null);

  const environment: IapEnvironment = useMemo(
    () =>
      resolveIapEnvironment(
        typeof process !== 'undefined' ? process.env?.EXPO_PUBLIC_IAP_ENV : undefined,
      ),
    [],
  );

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const database = await getLocalDatabase();
        const loaded = await loadMonetizationState(database);
        if (!cancelled && mountedRef.current) {
          setState(loaded);
          setReady(true);
        }
      } catch {
        if (!cancelled && mountedRef.current) {
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, []);

  const tier = useMemo(() => getEffectiveTier(state), [state]);
  const limits = useMemo(() => getEffectiveLimits(state), [state]);
  const maxBoards = useMemo(() => getEffectiveMaxBoards(state), [state]);
  const showAds = limits.adsEnabled;

  const hasFeature = useCallback(
    (feature: RewardedFeatureKey) => hasFeatureAccess(state, feature),
    [state],
  );

  const canCreateAnotherBoard = useCallback(
    (currentBoardCount: number) => canCreateBoard(state, currentBoardCount),
    [state],
  );

  const canAddAnotherPage = useCallback(
    (currentPageCount: number) => canAddBoardPage(state, currentPageCount),
    [state],
  );

  const canUseStyle = useCallback(
    (style: BoardStyle) => canUseBoardStyle(state, style),
    [state],
  );

  const canUseGeometry = useCallback(
    (instrument: InstrumentKind) => canUseGeometryTool(state, instrument),
    [state],
  );

  const getLiveClassAccess = useCallback(
    (mode: LiveClassMode) => evaluateLiveClassModeAccess(state, mode),
    [state],
  );

  const openPaywall = useCallback((trigger: PaywallTrigger) => {
    setRewardedFeature(null);
    setPaywallTrigger(trigger);
    setPaywallVisible(true);
  }, []);

  const requestRewardedUnlock = useCallback(
    (feature: RewardedFeatureKey, onUnlocked?: () => void) => {
      pendingRewardCallbackRef.current = onUnlocked ?? null;
      setRewardedFeature(feature);
    },
    [],
  );

  const promptGatedFeature = useCallback(
    (feature: RewardedFeatureKey, onUnlocked?: () => void) => {
      if (limits.rewardedAd24hUnlockSupported) {
        requestRewardedUnlock(feature, onUnlocked);
      } else {
        openPaywall({ reason: 'feature', feature });
      }
    },
    [limits.rewardedAd24hUnlockSupported, openPaywall, requestRewardedUnlock],
  );

  const handleCompleteRewardedAd = useCallback(async () => {
    const feature = rewardedFeature;
    if (!feature) return;
    setRewardedFeature(null);

    await enqueuePersistenceWrite(async () => {
      const database = await getLocalDatabase();
      const updated =
        feature === 'extra_board'
          ? await grantBonusBoardSlot(database, 1)
          : await grantRewardedUnlock(
              database,
              feature,
              new Date(Date.now() + AD_POLICY_CONSTANTS.rewardedUnlockDurationMs).toISOString(),
            );
      if (mountedRef.current) setState(updated);
    });

    const cb = pendingRewardCallbackRef.current;
    pendingRewardCallbackRef.current = null;
    cb?.();
  }, [rewardedFeature]);

  const handlePurchase = useCallback(
    async (product: IapProductDefinition) => {
      if (busyProductKey) return;
      if (environment === 'production') {
        Alert.alert(
          'Billing Not Yet Connected',
          'RevenueCat store billing will be activated once App Store / Google Play product IDs are linked.',
        );
        return;
      }

      setBusyProductKey(product.key);
      try {
        await enqueuePersistenceWrite(async () => {
          const database = await getLocalDatabase();
          let nextState = stateRef.current;
          if (product.kind === 'consumable' && product.grantsLiveClassPasses) {
            nextState = await addLiveClassPasses(database, product.grantsLiveClassPasses);
          } else {
            const merged = Array.from(
              new Set<PersistedEntitlementId>([
                ...nextState.activeEntitlements,
                ...product.grantsEntitlements,
              ]),
            );
            const expiresAt =
              product.kind === 'subscription'
                ? new Date(Date.now() + OFFLINE_CACHE_GRACE_MS).toISOString()
                : null;
            nextState = await updateMonetizationEntitlements(database, merged, expiresAt);
          }
          if (mountedRef.current) setState(nextState);
        });

        setPaywallVisible(false);
        Alert.alert(
          'Unlocked (Dev Sandbox)',
          product.grantsLiveClassPasses
            ? `Added ${product.grantsLiveClassPasses} Live Voice Class Passes.`
            : `${product.title} is now active on this device.`,
        );
      } finally {
        if (mountedRef.current) setBusyProductKey(null);
      }
    },
    [busyProductKey, environment],
  );

  const restorePurchases = useCallback(async () => {
    const database = await getLocalDatabase();
    const reloaded = await loadMonetizationState(database);
    if (mountedRef.current) setState(reloaded);
    const restoredTier = getEffectiveTier(reloaded);
    Alert.alert(
      'Restore Purchases',
      restoredTier === 'free'
        ? 'No active purchases found on this device. Connect RevenueCat in production to restore cross-device StoreKit / Play purchases.'
        : `Restored active plan: ${restoredTier.replace('_', ' ')}.`,
    );
  }, []);

  const handleResetDevPurchases = useCallback(async () => {
    await enqueuePersistenceWrite(async () => {
      const database = await getLocalDatabase();
      const reset = await resetDevMonetizationState(database);
      if (mountedRef.current) setState(reset);
    });
  }, []);

  const recordLiveVoiceStart = useCallback(async () => {
    const access = evaluateLiveClassModeAccess(stateRef.current, 'voice');
    if (access.willConsumePass) {
      await enqueuePersistenceWrite(async () => {
        const database = await getLocalDatabase();
        const res = await consumeLiveClassPass(database);
        if (mountedRef.current) setState(res.state);
      });
    } else if (access.willUseTrial) {
      await enqueuePersistenceWrite(async () => {
        const database = await getLocalDatabase();
        const updated = await incrementHostedVoiceTrial(database);
        if (mountedRef.current) setState(updated);
      });
    }
  }, []);

  const maybeShowPostExportInterstitial = useCallback(async () => {
    if (!shouldShowPostExportInterstitial(stateRef.current)) {
      return false;
    }
    const nowIso = new Date().toISOString();
    await enqueuePersistenceWrite(async () => {
      const database = await getLocalDatabase();
      const updated = await recordInterstitialShown(database, nowIso);
      if (mountedRef.current) setState(updated);
    });
    return true;
  }, []);

  const value = useMemo<MonetizationContextValue>(
    () => ({
      state,
      tier,
      limits,
      environment,
      ready,
      showAds,
      maxBoards,
      hasFeature,
      canCreateAnotherBoard,
      canAddAnotherPage,
      canUseStyle,
      canUseGeometry,
      getLiveClassAccess,
      openPaywall,
      requestRewardedUnlock,
      promptGatedFeature,
      recordLiveVoiceStart,
      maybeShowPostExportInterstitial,
      restorePurchases,
    }),
    [
      state,
      tier,
      limits,
      environment,
      ready,
      showAds,
      maxBoards,
      hasFeature,
      canCreateAnotherBoard,
      canAddAnotherPage,
      canUseStyle,
      canUseGeometry,
      getLiveClassAccess,
      openPaywall,
      requestRewardedUnlock,
      promptGatedFeature,
      recordLiveVoiceStart,
      maybeShowPostExportInterstitial,
      restorePurchases,
    ],
  );

  return (
    <MonetizationContext.Provider value={value}>
      {children}

      <PaywallModal
        visible={paywallVisible}
        trigger={paywallTrigger}
        currentTier={tier}
        liveClassPasses={state.liveClassPasses}
        environment={environment}
        theme={theme}
        reducedMotion={reducedMotion}
        busyProductKey={busyProductKey}
        onPurchase={(product) => void handlePurchase(product)}
        onRestorePurchases={() => void restorePurchases()}
        onResetDevPurchases={
          environment === 'development' ? () => void handleResetDevPurchases() : undefined
        }
        onClose={() => setPaywallVisible(false)}
      />

      <RewardedAdPromptModal
        visible={rewardedFeature !== null}
        feature={rewardedFeature}
        theme={theme}
        reducedMotion={reducedMotion}
        onCompleteAd={() => void handleCompleteRewardedAd()}
        onUpgradePress={() => {
          const feat = rewardedFeature;
          pendingRewardCallbackRef.current = null;
          setRewardedFeature(null);
          if (feat) {
            openPaywall({ reason: 'feature', feature: feat });
          } else {
            openPaywall({ reason: 'upgrade' });
          }
        }}
        onClose={() => {
          pendingRewardCallbackRef.current = null;
          setRewardedFeature(null);
        }}
      />
    </MonetizationContext.Provider>
  );
}

export function useMonetization(): MonetizationContextValue {
  const ctx = useContext(MonetizationContext);
  if (!ctx) {
    throw new Error('useMonetization must be used within a MonetizationProvider');
  }
  return ctx;
}
