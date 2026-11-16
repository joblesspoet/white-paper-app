import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { ThemeColors } from '../../theme';
import { FlowCanvasLogoIcon, ImportIcon, SettingsIcon } from '../icons';
import { homeHeaderStyles as styles } from './HomeHeader.styles';

type HomeHeaderProps = {
  theme: ThemeColors;
  paddingLeft: number;
  paddingRight: number;
  isCompactHeight: boolean;
  isTablet: boolean;
  boardCount: number;
  onImportPress: () => void;
  onSettingsPress: () => void;
};

export const HomeHeader = memo(function HomeHeader({
  theme,
  paddingLeft,
  paddingRight,
  isCompactHeight,
  isTablet,
  boardCount,
  onImportPress,
  onSettingsPress,
}: HomeHeaderProps) {
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
