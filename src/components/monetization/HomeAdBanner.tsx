import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { radii, spacing, type ThemeColors } from '../../theme';

type HomeAdBannerProps = {
  theme: ThemeColors;
  bottomInset: number;
  onRemoveAds: () => void;
};

/**
 * Non-intrusive Home-only ad banner slot for the Free tier.
 * Never rendered inside the active drawing canvas or Student Live Class mode.
 */
export const HomeAdBanner = memo(function HomeAdBanner({
  theme,
  bottomInset,
  onRemoveAds,
}: HomeAdBannerProps) {
  return (
    <View
      accessibilityRole="region"
      accessibilityLabel="Sponsored banner"
      style={[
        styles.wrap,
        {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          paddingBottom: Math.max(spacing.xs, bottomInset),
        },
      ]}
    >
      <View style={[styles.adSlot, { backgroundColor: theme.muted, borderColor: theme.border }]}>
        <View style={styles.adMeta}>
          <View style={[styles.adTag, { borderColor: theme.border, backgroundColor: theme.surface }]}>
            <Text style={[styles.adTagText, { color: theme.foreground }]}>AD</Text>
          </View>
          <Text style={[styles.adText, { color: theme.foreground }]} numberOfLines={1}>
            Free tier · AdMob Banner Slot
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Remove ads for $1.99"
          onPress={onRemoveAds}
          style={({ pressed }) => [
            styles.removeBtn,
            { backgroundColor: theme.primary },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.removeBtnText, { color: theme.onPrimary }]}>No Ads · $1.99</Text>
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  adSlot: {
    minHeight: 48,
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  adMeta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  adTag: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  adTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  adText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  removeBtn: {
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    minHeight: 32,
    justifyContent: 'center',
  },
  removeBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.78,
  },
});
