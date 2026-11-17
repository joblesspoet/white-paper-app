import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { ThemeColors } from '../../theme';
import type { UserPlanTier } from '../../monetization/iap-catalog';
import { FlowCanvasLogoIcon, ImportIcon, SettingsIcon } from '../icons';
import { ProBadge } from '../monetization/ProBadge';
import { homeHeaderStyles as styles } from './HomeHeader.styles';

type HomeHeaderProps = {
  theme: ThemeColors;
  paddingLeft: number;
  paddingRight: number;
  isCompactHeight: boolean;
  isTablet: boolean;
  boardCount: number;
  planTier: UserPlanTier;
  onUpgradePress: () => void;
  onImportPress: () => void;
  onSettingsPress: () => void;
};

const TIER_PILL_LABEL: Record<UserPlanTier, string> = {
  free: 'Go Pro',
  ad_free: 'Ad-Free',
  offline_studio: 'Studio',
  teacher_pro: 'Teacher Pro',
};

export const HomeHeader = memo(function HomeHeader({
  theme,
  paddingLeft,
  paddingRight,
  isCompactHeight,
  isTablet,
  boardCount,
  planTier,
  onUpgradePress,
  onImportPress,
  onSettingsPress,
}: HomeHeaderProps) {
  const isPaid = planTier !== 'free';
  return (
    <View
      style={[
        styles.header,
        isCompactHeight && styles.headerCompact,
        {
          paddingLeft,
          paddingRight,
          borderBottomColor: theme.border,
          backgroundColor: theme.background,
        },
      ]}
    >
      <View style={styles.brandRow}>
        <View
          style={[
            styles.logoBadge,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <FlowCanvasLogoIcon size={22} color={theme.primary} />
        </View>
        <View style={styles.wordmarkWrap}>
          <View style={styles.titleRow}>
            <Text
              style={[
                styles.wordmark,
                isCompactHeight && styles.wordmarkCompact,
                { color: theme.foreground },
              ]}
              numberOfLines={1}
            >
              FlowCanvas
            </Text>
            {isTablet && (
              <View
                style={[
                  styles.localPill,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <View style={[styles.localDot, { backgroundColor: theme.primary }]} />
                <Text style={[styles.localPillText, { color: theme.foreground }]}>
                  Local · {boardCount} {boardCount === 1 ? 'board' : 'boards'}
                </Text>
              </View>
            )}
          </View>
          {!isCompactHeight && (
            <Text style={[styles.subtitle, { color: theme.primary }]} numberOfLines={1}>
              Your ideas, in motion.
            </Text>
          )}
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isPaid ? `Current plan: ${TIER_PILL_LABEL[planTier]}` : 'Upgrade to Pro'}
          onPress={onUpgradePress}
          style={({ pressed }) => [
            styles.upgradeButton,
            {
              borderColor: isPaid ? theme.primary : theme.accent,
              backgroundColor: isPaid ? `${theme.primary}16` : `${theme.accent}18`,
            },
            pressed && styles.iconButtonPressed,
          ]}
        >
          <ProBadge
            label={planTier === 'free' ? 'PRO' : 'ACTIVE'}
            variant={isPaid ? 'live' : 'pro'}
            theme={theme}
            compact
          />
          <Text
            style={[
              styles.upgradeText,
              { color: isPaid ? theme.primary : theme.accent },
            ]}
          >
            {TIER_PILL_LABEL[planTier]}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Import a board backup"
          onPress={onImportPress}
          style={({ pressed }) => [
            styles.iconButton,
            { borderColor: theme.border, backgroundColor: theme.surface },
            pressed && styles.iconButtonPressed,
          ]}
        >
          <ImportIcon size={20} color={theme.foreground} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open settings"
          onPress={onSettingsPress}
          style={({ pressed }) => [
            styles.iconButton,
            { borderColor: theme.border, backgroundColor: theme.surface },
            pressed && styles.iconButtonPressed,
          ]}
        >
          <SettingsIcon size={22} color={theme.foreground} />
        </Pressable>
      </View>
    </View>
  );
});
