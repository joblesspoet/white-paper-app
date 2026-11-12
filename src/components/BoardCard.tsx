import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BoardIcon, MoreIcon } from './icons';
import { colors, radii, spacing, touchTarget, typography, type ThemeColors } from '../theme';

export type BoardSummary = {
  id: string;
  title: string;
  updatedAt: string;
  objectCount: number;
};

type BoardCardProps = {
  board: BoardSummary;
  width?: number;
  theme?: ThemeColors;
  onPress: () => void;
  onMenuPress: () => void;
};

export const BoardCard = memo(function BoardCard({
  board,
  width,
  theme = colors,
  onPress,
  onMenuPress,
}: BoardCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open board ${board.title}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          borderColor: theme.border,
          backgroundColor: theme.surface,
        },
        width !== undefined ? { width, maxWidth: width } : styles.cardFlex,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.thumbnail, { backgroundColor: theme.muted }]}>
        <BoardIcon size={28} color={theme.primary} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`More options for ${board.title}`}
          hitSlop={8}
          onPress={onMenuPress}
          style={styles.menu}
        >
          <MoreIcon color={theme.foreground} />
        </Pressable>
      </View>
      <Text style={[styles.title, { color: theme.foreground }]} numberOfLines={1}>
        {board.title}
      </Text>
      <Text style={[styles.meta, { color: theme.primary }]} numberOfLines={1}>
        {board.updatedAt} · {board.objectCount} {board.objectCount === 1 ? 'object' : 'objects'}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: { minWidth: 0, borderWidth: 1, borderRadius: radii.md, overflow: 'hidden' },
  cardFlex: { flex: 1 },
  pressed: { opacity: 0.78 },
  thumbnail: { height: 112, alignItems: 'center', justifyContent: 'center' },
  menu: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.bodyStrong, marginHorizontal: spacing.md, marginTop: spacing.md },
  meta: { ...typography.caption, marginHorizontal: spacing.md, marginTop: spacing.xs, marginBottom: spacing.md },
});
