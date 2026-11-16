import { memo, useCallback, useEffect, useState, type ReactNode } from 'react';
import { Pressable, Switch, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { AppTheme } from '../../persistence/schema';
import { colors, type ThemeColors } from '../../theme';
import { ChevronRightIcon } from '../icons';
import { settingsRowStyles as styles } from './SettingsRow.styles';

type SettingsNavRowProps = {
  label: string;
  subtitle: string;
  value?: string;
  accessibilityLabel: string;
  accessibilityHint?: string;
  destructive?: boolean;
  hasDivider?: boolean;
  leftIcon?: ReactNode;
  rightAccessory?: ReactNode;
  theme: ThemeColors;
  onPress: () => void;
};

export const SettingsNavRow = memo(function SettingsNavRow({
  label,
  subtitle,
  value,
  accessibilityLabel,
  accessibilityHint,
  destructive = false,
  hasDivider = false,
  leftIcon,
  rightAccessory,
  theme,
  onPress,
}: SettingsNavRowProps) {
  const accentColor = destructive ? theme.destructive : theme.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        hasDivider && [styles.divider, { borderTopColor: theme.border }],
        pressed && styles.rowPressed,
      ]}
    >
      <View style={styles.rowLeft}>
        <View style={styles.titleRow}>
          {leftIcon}
          <Text
            style={[
              styles.rowLabel,
              { color: destructive ? theme.destructive : theme.foreground },
            ]}
          >
            {label}
          </Text>
        </View>
        <Text style={[styles.rowSubtitle, { color: theme.foreground }]}>{subtitle}</Text>
      </View>

      <View style={styles.rowRight}>
        {rightAccessory}
        {value ? (
          <Text style={[styles.rowValue, { color: theme.foreground }]}>{value}</Text>
        ) : null}
        <ChevronRightIcon size={18} color={accentColor} />
      </View>
    </Pressable>
  );
});

type SettingsToggleRowProps = {
  label: string;
  subtitle: string;
  value: boolean;
  hasDivider?: boolean;
  theme: ThemeColors;
  onValueChange: (enabled: boolean) => void;
};

export const SettingsToggleRow = memo(function SettingsToggleRow({
  label,
  subtitle,
  value,
  hasDivider = false,
  theme,
  onValueChange,
}: SettingsToggleRowProps) {
  return (
    <View
      style={[
        styles.row,
        hasDivider && [styles.divider, { borderTopColor: theme.border }],
      ]}
    >
      <View style={styles.rowLeft}>
        <Text style={[styles.rowLabel, { color: theme.foreground }]}>{label}</Text>
        <Text style={[styles.rowSubtitle, { color: theme.foreground }]}>{subtitle}</Text>
      </View>
      <Switch
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityState={{ checked: value }}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.border, true: theme.primary }}
        thumbColor={colors.onPrimary}
      />
    </View>
  );
});

const THEME_MODES: ReadonlyArray<{ key: AppTheme; label: string }> = [
  { key: 'system', label: 'System' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
];

type ThemeSegmentControlProps = {
  mode: AppTheme;
  isDark: boolean;
  reducedMotion: boolean;
  theme: ThemeColors;
  onSelect: (mode: AppTheme) => void;
};

export const ThemeSegmentControl = memo(function ThemeSegmentControl({
  mode,
  isDark,
  reducedMotion,
  theme,
  onSelect,
}: ThemeSegmentControlProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const activeIndex = Math.max(
    0,
    THEME_MODES.findIndex((item) => item.key === mode),
  );
  const segmentWidth = trackWidth > 6 ? (trackWidth - 6) / THEME_MODES.length : 0;
  const translateX = useSharedValue(0);

  useEffect(() => {
    if (segmentWidth <= 0) return;
    const target = activeIndex * segmentWidth;
    if (reducedMotion) {
      translateX.value = target;
    } else {
      translateX.value = withTiming(target, {
        duration: 180,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [activeIndex, reducedMotion, segmentWidth, translateX]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  }, []);

  const pillAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={styles.themeRow}>
      <View style={styles.themeRowHeader}>
        <Text style={[styles.rowLabel, { color: theme.foreground }]}>Theme</Text>
        <Text style={[styles.rowSubtitle, { color: theme.foreground }]}>
          {isDark ? 'Dark mode active' : 'Light mode active'}
        </Text>
      </View>

      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Application theme"
        onLayout={handleLayout}
        style={[
          styles.segmentContainer,
          { backgroundColor: isDark ? '#0A2522' : theme.muted },
        ]}
      >
        {segmentWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.segmentPill,
              pillAnimatedStyle,
              { width: segmentWidth, backgroundColor: theme.primary },
            ]}
          />
        )}
        {THEME_MODES.map((item) => {
          const active = mode === item.key;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${item.label} theme`}
              style={styles.segmentButton}
              onPress={() => onSelect(item.key)}
            >
              <Text
                style={[
                  styles.segmentButtonText,
                  {
                    color: active ? colors.onPrimary : theme.foreground,
                    fontWeight: active ? '700' : '500',
                  },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});
