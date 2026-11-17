import { memo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { LiveClassModeAccess } from '../../monetization/entitlement-service';
import { radii, spacing, touchTarget, typography, type ThemeColors } from '../../theme';
import { ProBadge } from './ProBadge';

type LiveClassModeModalProps = {
  visible: boolean;
  boardOnlyAccess: LiveClassModeAccess;
  voiceAccess: LiveClassModeAccess;
  theme: ThemeColors;
  reducedMotion?: boolean;
  onStartBoardOnly: () => void;
  onStartWithVoice: () => void;
  onUpgrade: () => void;
  onClose: () => void;
};

/**
 * Lets teachers pick Board-Only Live Sync ($0 LiveKit cost) vs Live Class + Voice
 * (LiveKit), highlighting trials, passes, and Rewarded Ad unlock clearly.
 */
export const LiveClassModeModal = memo(function LiveClassModeModal({
  visible,
  boardOnlyAccess,
  voiceAccess,
  theme,
  reducedMotion = false,
  onStartBoardOnly,
  onStartWithVoice,
  onUpgrade,
  onClose,
}: LiveClassModeModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reducedMotion ? 'none' : 'fade'}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
          onPress={() => undefined}
        >
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: theme.foreground }]}>Start 1-on-1 Live Session</Text>
              <ProBadge label="STUDENTS JOIN FREE" variant="trial" theme={theme} />
            </View>
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
              <Text style={[styles.closeText, { color: theme.primary }]}>Cancel</Text>
            </Pressable>
          </View>

          <Text style={[styles.subtitle, { color: theme.foreground }]}>
            Private 1-on-1 tutoring with real-time collaborative whiteboard & interactive audio.
          </Text>

          {/* Option 1: Board-Only Live Sync (Supabase only) */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start 1-on-1 Board Sync"
            onPress={onStartBoardOnly}
            style={({ pressed }) => [
              styles.optionCard,
              { backgroundColor: theme.background, borderColor: theme.border },
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.optionTop}>
              <Text style={[styles.optionTitle, { color: theme.foreground }]}>
                1-on-1 Board Sync (No Voice)
              </Text>
              <ProBadge
                label={boardOnlyAccess.requiresRewardedAd ? 'FREE VIA AD' : 'READY'}
                variant={boardOnlyAccess.requiresRewardedAd ? 'ad' : 'live'}
                theme={theme}
              />
            </View>
            <Text style={[styles.optionDesc, { color: theme.foreground }]}>
              Real-time 1-on-1 whiteboard sync via 6-digit code & QR · Zero voice lag ·{' '}
              {boardOnlyAccess.maxSessionMinutes} min.
            </Text>
            <Text style={[styles.optionAction, { color: theme.primary }]}>
              {boardOnlyAccess.requiresRewardedAd
                ? 'Watch 1 short ad to start 1-on-1 session →'
                : 'Start 1-on-1 Session →'}
            </Text>
          </Pressable>

          {/* Option 2: Live Class + Voice (LiveKit + Supabase) */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start 1-on-1 Live Voice Tutoring"
            onPress={voiceAccess.allowed ? onStartWithVoice : onUpgrade}
            style={({ pressed }) => [
              styles.optionCard,
              {
                backgroundColor: theme.background,
                borderColor: voiceAccess.allowed ? theme.primary : theme.accent,
                borderWidth: 1.5,
              },
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.optionTop}>
              <Text style={[styles.optionTitle, { color: theme.foreground }]}>
                1-on-1 Live Voice Tutoring
              </Text>
              <ProBadge
                label={
                  voiceAccess.willConsumePass
                    ? `${voiceAccess.passesRemaining} PASSES`
                    : voiceAccess.willUseTrial
                      ? `${voiceAccess.remainingVoiceTrials} FREE LEFT`
                      : voiceAccess.allowed
                        ? 'TEACHER PRO'
                        : 'PRO / PASS'
                }
                variant={voiceAccess.allowed ? 'live' : 'pro'}
                theme={theme}
              />
            </View>
            <Text style={[styles.optionDesc, { color: theme.foreground }]}>
              Two-way live audio + real-time whiteboard. Unmute student directly from your board or when they raise hand · {voiceAccess.maxSessionMinutes} min/session.
            </Text>
            <Text
              style={[
                styles.optionAction,
                { color: voiceAccess.allowed ? theme.primary : theme.accent },
              ]}
            >
              {voiceAccess.willUseTrial
                ? `Start Free 1-on-1 Voice Trial (${voiceAccess.remainingVoiceTrials} left) →`
                : voiceAccess.willConsumePass
                  ? `Use 1 Tutoring Pass (${voiceAccess.passesRemaining} left) →`
                  : voiceAccess.allowed
                    ? 'Start 1-on-1 Live Tutoring →'
                    : 'Upgrade to Teacher Pro or Buy Passes →'}
            </Text>
          </Pressable>
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
    maxWidth: 440,
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
  titleRow: {
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
  subtitle: {
    ...typography.caption,
    opacity: 0.85,
  },
  optionCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: 6,
    minHeight: touchTarget,
  },
  optionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  optionTitle: {
    ...typography.bodyStrong,
    fontSize: 15,
    flex: 1,
  },
  optionDesc: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.85,
  },
  optionAction: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  pressed: {
    opacity: 0.78,
  },
});
