import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BoardIcon, MoreIcon } from './icons';
import { colors, radii, spacing, touchTarget, typography } from '../theme';

export type BoardSummary = {
  id: string;
  title: string;
  updatedAt: string;
  objectCount: number;
};

type BoardCardProps = {
  board: BoardSummary;
  onPress: () => void;
  onMenuPress: () => void;
};

export const BoardCard = memo(function BoardCard({ board, onPress, onMenuPress }: BoardCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open board ${board.title}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.thumbnail}>
        <BoardIcon size={28} color={colors.primary} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`More options for ${board.title}`}
          hitSlop={8}
          onPress={onMenuPress}
          style={styles.menu}
        >
          <MoreIcon />
        </Pressable>
      </View>
      <Text style={styles.title} numberOfLines={1}>{board.title}</Text>
      <Text style={styles.meta}>{board.updatedAt} · {board.objectCount} objects</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: { flex: 1, minWidth: 0, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.surface, overflow: 'hidden' },
  pressed: { opacity: 0.78 },
  thumbnail: { height: 112, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.muted },
  menu: { position: 'absolute', top: spacing.sm, right: spacing.sm, width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.bodyStrong, color: colors.foreground, marginHorizontal: spacing.md, marginTop: spacing.md },
  meta: { ...typography.caption, color: colors.primary, marginHorizontal: spacing.md, marginTop: spacing.xs, marginBottom: spacing.md },
});