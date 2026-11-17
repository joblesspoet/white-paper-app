import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { type ThemeColors } from '../../theme';

export type ProBadgeVariant = 'pro' | 'hd' | 'live' | 'trial' | 'ad';

type ProBadgeProps = {
  label?: string;
  variant?: ProBadgeVariant;
  theme: ThemeColors;
  compact?: boolean;
};

export const ProBadge = memo(function ProBadge({
  label = 'PRO',
  variant = 'pro',
  theme,
  compact = false,
}: ProBadgeProps) {
  const isAccent = variant === 'pro' || variant === 'hd';
  const bg =
    variant === 'trial'
      ? `${theme.primary}1F`
      : variant === 'ad'
        ? theme.muted
        : isAccent
          ? theme.accent
          : theme.primary;
  const fg =
    variant === 'trial'
      ? theme.primary
      : variant === 'ad'
        ? theme.foreground
        : isAccent
          ? theme.onAccent
          : theme.onPrimary;

  return (
    <View
      style={[
        styles.badge,
        compact && styles.badgeCompact,
        {
          backgroundColor: bg,
          borderColor: variant === 'trial' || variant === 'ad' ? theme.border : bg,
        },
      ]}
    >
      <Text style={[styles.text, compact && styles.textCompact, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  badge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeCompact: {
    borderRadius: 5,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  text: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  textCompact: {
    fontSize: 8,
    letterSpacing: 0.2,
  },
});
