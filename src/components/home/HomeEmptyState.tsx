import { memo, useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors, type ThemeColors } from '../../theme';
import {
  BoardIcon,
  BroadcastIcon,
  ImportIcon,
  PlusIcon,
  SearchIcon,
  ShieldCheckIcon,
} from '../icons';
import { homeEmptyStateStyles as styles } from './HomeEmptyState.styles';

type HomeEmptyStateProps = {
  ready: boolean;
  hasAnyBoards: boolean;
  searchQuery: string;
  columns: number;
  cardWidth: number;
  theme: ThemeColors;
  isDark: boolean;
  reducedMotion: boolean;
  onCreateBoard: () => void;
  onOpenJoinClass: () => void;
  onStartImport: () => void;
  onClearSearch: () => void;
};

const SkeletonGrid = memo(function SkeletonGrid({
  columns,
  cardWidth,
  theme,
  reducedMotion,
}: {
  columns: number;
  cardWidth: number;
  theme: ThemeColors;
  reducedMotion: boolean;
}) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (reducedMotion) {
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(withTiming(0.55, { duration: 750 }), -1, true);
    return () => cancelAnimation(pulse);
  }, [pulse, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  const count = Math.max(4, columns * 2);
  const items = Array.from({ length: count }, (_, idx) => idx);

  return (
    <View style={styles.skeletonWrap} accessibilityLabel="Loading local boards">
      <View style={styles.skeletonGrid}>
        {items.map((idx) => (
          <Animated.View
            key={idx}
            style={[
              styles.skeletonCard,
              animatedStyle,
              {
                width: cardWidth,
                borderColor: theme.border,
                backgroundColor: theme.surface,
              },
            ]}
          >
            <View style={[styles.skeletonThumb, { backgroundColor: theme.muted }]} />
            <View style={styles.skeletonFooter}>
              <View style={[styles.skeletonLineLg, { backgroundColor: theme.muted }]} />
              <View style={[styles.skeletonLineSm, { backgroundColor: theme.muted }]} />
            </View>
          </Animated.View>
        ))}
      </View>
      <Text style={[styles.loadingCaption, { color: theme.foreground }]}>
        Opening your boards…
      </Text>
    </View>
  );
});

export const HomeEmptyState = memo(function HomeEmptyState({
  ready,
  hasAnyBoards,
  searchQuery,
  columns,
  cardWidth,
  theme,
  isDark,
  reducedMotion,
  onCreateBoard,
  onOpenJoinClass,
  onStartImport,
  onClearSearch,
}: HomeEmptyStateProps) {
  if (!ready) {
    return (
      <SkeletonGrid
        columns={columns}
        cardWidth={cardWidth}
        theme={theme}
        reducedMotion={reducedMotion}
      />
    );
  }

  if (hasAnyBoards && searchQuery.trim().length > 0) {
    return (
      <View style={[styles.empty, { borderColor: theme.border, backgroundColor: theme.surface }]}>
        <View
          style={[
            styles.dashedFrame,
            {
              borderColor: theme.border,
              backgroundColor: isDark ? theme.darkBackground : colors.background,
            },
          ]}
        >
          <SearchIcon size={34} color={theme.primary} />
        </View>
        <Text style={[styles.emptyTitle, { color: theme.foreground }]}>No matching boards</Text>
        <Text style={[styles.emptyBody, { color: theme.foreground }]}>
          Nothing on this device matches “{searchQuery.trim()}”.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search filter"
          onPress={onClearSearch}
          style={({ pressed }) => [
            styles.secondaryAction,
            { borderColor: theme.primary, backgroundColor: theme.muted },
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={[styles.secondaryActionText, { color: theme.primary }]}>Clear search</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.empty, { borderColor: theme.border, backgroundColor: theme.surface }]}>
      <View
        style={[
          styles.dashedFrame,
          {
            borderColor: theme.border,
            backgroundColor: isDark ? theme.darkBackground : colors.background,
          },
        ]}
      >
        <BoardIcon size={38} color={theme.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.foreground }]}>Your canvas is ready</Text>
      <Text style={[styles.emptyBody, { color: theme.foreground }]}>
        FlowCanvas stores your infinite whiteboards directly on this device for offline sketching,
        math, and teaching.
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create your first board"
        onPress={onCreateBoard}
        style={({ pressed }) => [
          styles.primaryButton,
          { backgroundColor: theme.accent },
          pressed && styles.buttonPressed,
        ]}
      >
        <PlusIcon size={20} color={colors.onAccent} />
        <Text style={styles.primaryButtonText}>New board</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Import a board"
        onPress={onStartImport}
        style={({ pressed }) => [
          styles.secondaryAction,
          { borderColor: theme.border, backgroundColor: theme.background },
          pressed && styles.buttonPressed,
        ]}
      >
        <ImportIcon size={18} color={theme.primary} />
        <Text style={[styles.secondaryActionText, { color: theme.foreground }]}>Import board</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Join live class"
        onPress={onOpenJoinClass}
        style={({ pressed }) => [
          styles.secondaryAction,
          { borderColor: theme.primary, backgroundColor: theme.background },
          pressed && styles.buttonPressed,
        ]}
      >
        <BroadcastIcon size={18} color={theme.primary} />
        <Text style={[styles.secondaryActionText, { color: theme.primary }]}>Join live class</Text>
      </Pressable>

      <View
        style={[
          styles.offlinePill,
          { borderColor: theme.border, backgroundColor: theme.muted },
        ]}
      >
        <ShieldCheckIcon size={14} color={theme.primary} />
        <Text style={[styles.offlineText, { color: theme.foreground }]}>
          Local-only storage · Works offline
        </Text>
      </View>
    </View>
  );
});
