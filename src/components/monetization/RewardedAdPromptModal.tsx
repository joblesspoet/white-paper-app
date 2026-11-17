import { memo, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import {
  REWARDED_FEATURE_META,
  type RewardedFeatureKey,
} from '../../monetization/entitlement-service';
import { resolveFlowModalLayout } from '../../responsive/layout';
import { radii, spacing, touchTarget, typography, type ThemeColors } from '../../theme';
import { ProBadge } from './ProBadge';

type RewardedAdPromptModalProps = {
  visible: boolean;
  feature: RewardedFeatureKey | null;
  theme: ThemeColors;
  reducedMotion?: boolean;
  onCompleteAd: () => void;
  onUpgradePress: () => void;
  onClose: () => void;
};

const SIMULATED_AD_SECONDS = 2;

export const RewardedAdPromptModal = memo(function RewardedAdPromptModal({
  visible,
  feature,
  theme,
  reducedMotion = false,
  onCompleteAd,
  onUpgradePress,
  onClose,
}: RewardedAdPromptModalProps) {
  const { width, height } = useWindowDimensions();
  const { centeredModal } = resolveFlowModalLayout(width, height);
  const [watching, setWatching] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(SIMULATED_AD_SECONDS);

  useEffect(() => {
    if (!visible) {
      setWatching(false);
      setSecondsLeft(SIMULATED_AD_SECONDS);
    }
  }, [visible]);

  useEffect(() => {
    if (!watching) return;
    if (secondsLeft <= 0) {
      setWatching(false);
      onCompleteAd();
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [onCompleteAd, secondsLeft, watching]);

  if (!feature) return null;
  const meta = REWARDED_FEATURE_META[feature];
  const isLiveOrVideo = meta.proSuggestion === 'teacher_pro';

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reducedMotion ? 'none' : centeredModal ? 'fade' : 'slide'}
      statusBarTranslucent
      onRequestClose={watching ? undefined : onClose}
    >
      <Pressable
        style={styles.scrim}
        onPress={watching ? undefined : onClose}
      >
        <Pressable
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
          onPress={() => undefined}
        >
          <View style={styles.header}>
            <View style={styles.titleWrap}>
              <Text style={[styles.title, { color: theme.foreground }]}>{meta.title}</Text>
              <ProBadge label="PRO" variant="pro" theme={theme} />
            </View>
            {!watching && (
              <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
                <Text style={[styles.closeText, { color: theme.primary }]}>Close</Text>
              </Pressable>
            )}
          </View>

          <Text style={[styles.desc, { color: theme.foreground }]}>{meta.description}</Text>

          {watching ? (
            <View
              style={[
                styles.adPreviewBox,
                { backgroundColor: theme.muted, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.adTitle, { color: theme.foreground }]}>
                Rewarded Ad Preview (Dev)
              </Text>
              <Text style={[styles.adTimer, { color: theme.primary }]}>
                Unlocking in {secondsLeft}s…
              </Text>
            </View>
          ) : (
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={meta.rewardLabel}
                onPress={() => {
                  setSecondsLeft(SIMULATED_AD_SECONDS);
                  setWatching(true);
                }}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { backgroundColor: theme.primary },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.primaryBtnText, { color: theme.onPrimary }]}>
                  {meta.rewardLabel}
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Upgrade to remove ads and unlock Pro"
                onPress={onUpgradePress}
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  { backgroundColor: theme.background, borderColor: theme.border },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.secondaryBtnText, { color: theme.accent }]}>
                  {isLiveOrVideo
                    ? 'Upgrade to Teacher Pro · $19.99/yr (7-day trial)'
                    : 'Unlock Offline Studio Forever · $4.99'}
                </Text>
              </Pressable>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
});

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: 'rgba(11, 43, 40, 0.45)',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  titleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  title: {
    ...typography.subtitle,
  },
  closeText: {
    ...typography.bodyStrong,
    fontSize: 15,
  },
  desc: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.9,
  },
  adPreviewBox: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  adTitle: {
    ...typography.bodyStrong,
    fontSize: 14,
  },
  adTimer: {
    ...typography.title,
    fontSize: 20,
  },
  actions: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  primaryBtn: {
    minHeight: touchTarget,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  primaryBtnText: {
    ...typography.bodyStrong,
    fontSize: 14,
  },
  secondaryBtn: {
    minHeight: touchTarget,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.78,
  },
});
