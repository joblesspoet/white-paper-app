import { memo, useCallback, useMemo } from 'react';
import { Pressable, Text, View, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import type { BoardSettings, BoardStyle } from '../persistence/schema';
import { colors, type ThemeColors } from '../theme';
import { boardCardStyles as styles } from './BoardCard.styles';
import { BoardIcon, MoreIcon } from './icons';

export type BoardSummary = {
  id: string;
  title: string;
  updatedAt: string;
  objectCount: number;
  settings?: BoardSettings;
};

type BoardCardProps = {
  board: BoardSummary;
  width?: number;
  theme?: ThemeColors;
  selected?: boolean;
  onPress: (boardId: string) => void;
  onMenuPress: (board: BoardSummary) => void;
};

const STYLE_LABELS: Record<BoardStyle, string> = {
  blank: 'Blank',
  dots: 'Dot grid',
  grid: 'Grid',
  ruled: 'Ruled',
  isometric: 'Isometric',
};

const ThumbnailPattern = memo(function ThumbnailPattern({
  boardStyle,
  strokeColor,
  hasObjects,
  primaryColor,
  accentColor,
}: {
  boardStyle: BoardStyle;
  strokeColor: string;
  hasObjects: boolean;
  primaryColor: string;
  accentColor: string;
}) {
  const dots = useMemo(() => {
    const items: Array<{ x: number; y: number }> = [];
    for (let x = 16; x <= 184; x += 24) {
      for (let y = 16; y <= 96; y += 24) {
        items.push({ x, y });
      }
    }
    return items;
  }, []);

  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 200 112"
      preserveAspectRatio="xMidYMid slice"
      style={styles.thumbnailPattern}
    >
      {boardStyle === 'dots' &&
        dots.map((dot, idx) => (
          <Circle key={idx} cx={dot.x} cy={dot.y} r={1.2} fill={strokeColor} opacity={0.45} />
        ))}

      {boardStyle === 'grid' && (
        <>
          {[24, 48, 72, 96].map((y) => (
            <Line key={`h-${y}`} x1={0} y1={y} x2={200} y2={y} stroke={strokeColor} strokeWidth={0.75} opacity={0.35} />
          ))}
          {[28, 56, 84, 112, 140, 168].map((x) => (
            <Line key={`v-${x}`} x1={x} y1={0} x2={x} y2={112} stroke={strokeColor} strokeWidth={0.75} opacity={0.35} />
          ))}
        </>
      )}

      {boardStyle === 'ruled' &&
        [24, 44, 64, 84].map((y) => (
          <Line key={`r-${y}`} x1={12} y1={y} x2={188} y2={y} stroke={strokeColor} strokeWidth={1} opacity={0.4} />
        ))}

      {boardStyle === 'isometric' &&
        [0, 36, 72, 108, 144, 180].map((x) => (
          <Path
            key={`iso-${x}`}
            d={`M ${x} 0 L ${x + 56} 112 M ${x + 56} 0 L ${x} 112`}
            stroke={strokeColor}
            strokeWidth={0.75}
            opacity={0.28}
          />
        ))}

      {hasObjects && (
        <>
          <Rect x={34} y={24} width={46} height={36} rx={5} fill="#FDE68A" stroke={primaryColor} strokeWidth={1.2} />
          <Line x1={42} y1={36} x2={70} y2={36} stroke="#134E4A" strokeWidth={1.6} strokeLinecap="round" opacity={0.65} />
          <Line x1={42} y1={44} x2={64} y2={44} stroke="#134E4A" strokeWidth={1.6} strokeLinecap="round" opacity={0.45} />
          <Rect x={116} y={48} width={48} height={36} rx={5} fill="#BBF7D0" stroke={primaryColor} strokeWidth={1.2} />
          <Path
            d="M 80 42 C 98 42, 98 66, 116 66"
            stroke={primaryColor}
            strokeWidth={1.8}
            strokeDasharray="3 3"
            fill="none"
          />
          <Path
            d="M 42 84 Q 68 70, 96 86"
            stroke={accentColor}
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
          />
        </>
      )}
    </Svg>
  );
});

export const BoardCard = memo(function BoardCard({
  board,
  width,
  theme = colors,
  selected = false,
  onPress,
  onMenuPress,
}: BoardCardProps) {
  const boardBg = board.settings?.background ?? 'light';
  const boardStyle = board.settings?.style ?? 'dots';

  const thumbBg =
    boardBg === 'dark'
      ? colors.darkBackground
      : boardBg === 'white'
        ? colors.onPrimary
        : colors.background;

  const patternStroke = boardBg === 'dark' ? colors.darkPrimary : theme.primary;
  const menuIconColor = boardBg === 'dark' ? colors.darkForeground : theme.foreground;

  const handleOpen = useCallback(() => {
    onPress(board.id);
  }, [board.id, onPress]);

  const handleMenu = useCallback(
    (event: GestureResponderEvent) => {
      event.stopPropagation?.();
      onMenuPress(board);
    },
    [board, onMenuPress],
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open board ${board.title}`}
      onPress={handleOpen}
      style={({ pressed }) => [
        styles.card,
        {
          borderColor: selected ? theme.primary : theme.border,
          borderWidth: selected ? 2 : 1,
          backgroundColor: theme.surface,
        },
        width !== undefined ? { width, maxWidth: width } : styles.cardFlex,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.thumbnail, { backgroundColor: thumbBg, borderBottomColor: theme.border }]}>
        <ThumbnailPattern
          boardStyle={boardStyle}
          strokeColor={patternStroke}
          hasObjects={board.objectCount > 0}
          primaryColor={theme.primary}
          accentColor={theme.accent}
        />
        {board.objectCount === 0 && <BoardIcon size={26} color={patternStroke} />}
        <View
          style={[
            styles.styleBadge,
            {
              backgroundColor: boardBg === 'dark' ? colors.darkSurface : theme.surface,
              borderColor: boardBg === 'dark' ? colors.darkBorder : theme.border,
            },
          ]}
        >
          <Text
            style={[
              styles.styleBadgeText,
              { color: boardBg === 'dark' ? colors.darkForeground : theme.foreground },
            ]}
          >
            {STYLE_LABELS[boardStyle]}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`More options for ${board.title}`}
          hitSlop={6}
          onPress={handleMenu}
          style={({ pressed }) => [
            styles.menu,
            {
              backgroundColor:
                boardBg === 'dark' ? 'rgba(16, 59, 55, 0.85)' : 'rgba(240, 253, 250, 0.85)',
            },
            pressed && styles.menuPressed,
          ]}
        >
          <MoreIcon size={20} color={menuIconColor} />
        </Pressable>
      </View>

      <View style={styles.footer}>
        <Text style={[styles.title, { color: theme.foreground }]} numberOfLines={1}>
          {board.title}
        </Text>
        <View style={styles.metaRow}>
          <Text style={[styles.meta, { color: theme.primary }]} numberOfLines={1}>
            {board.updatedAt}
          </Text>
          <Text style={[styles.objectBadge, { color: theme.foreground }]} numberOfLines={1}>
            {board.objectCount} {board.objectCount === 1 ? 'item' : 'items'}
          </Text>
        </View>
      </View>
    </Pressable>
  );
});
