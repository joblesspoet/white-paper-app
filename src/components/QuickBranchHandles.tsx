import { memo, useCallback, useMemo } from 'react';
import { Pressable, Text } from 'react-native';

import {
  CARDINAL_PORTS,
  getObjectPortPoint,
  type CardinalDirection,
} from '../canvas/connectors';
import type { ShapeObject, StickyObject } from '../canvas/document';
import { canvasToScreen, type Viewport } from '../canvas/viewport';
import type { ThemeColors } from '../theme';
import {
  QUICK_BRANCH_PILL_SIZE,
  quickBranchHandlesStyles as styles,
} from './QuickBranchHandles.styles';

export type QuickBranchHandlesProps = {
  object: StickyObject | ShapeObject;
  viewport: Viewport;
  canvasWidth: number;
  canvasHeight: number;
  theme: ThemeColors;
  onBranch: (direction: CardinalDirection) => void;
};

const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;

const QuickBranchPill = memo(function QuickBranchPill({
  direction,
  left,
  top,
  theme,
  onBranch,
}: {
  direction: CardinalDirection;
  left: number;
  top: number;
  theme: ThemeColors;
  onBranch: (direction: CardinalDirection) => void;
}) {
  const handlePress = useCallback(() => {
    onBranch(direction);
  }, [direction, onBranch]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Quick branch ${direction}`}
      accessibilityHint={`Creates a connected node ${direction} of the selected object`}
      hitSlop={HIT_SLOP}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.pill,
        {
          left,
          top,
          backgroundColor: theme.surface,
          borderColor: theme.primary,
        },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.pillLabel, { color: theme.primary }]}>+</Text>
    </Pressable>
  );
});

export const QuickBranchHandles = memo(function QuickBranchHandles({
  object,
  viewport,
  canvasWidth,
  canvasHeight,
  theme,
  onBranch,
}: QuickBranchHandlesProps) {
  const handles = useMemo(() => {
    if (canvasWidth <= 0 || canvasHeight <= 0) return [];
    const centerScreen = canvasToScreen(
      { x: object.x + object.width / 2, y: object.y + object.height / 2 },
      viewport,
    );
    const half = QUICK_BRANCH_PILL_SIZE / 2;

    return CARDINAL_PORTS.map((direction) => {
      const portScreen = canvasToScreen(getObjectPortPoint(object, direction), viewport);
      const dx = portScreen.x - centerScreen.x;
      const dy = portScreen.y - centerScreen.y;
      const len = Math.hypot(dx, dy) || 1;
      // Keep top pill clear of the 36pt rotate handle stem.
      const outward = direction === 'top' ? 60 : 22;
      const rawX = portScreen.x + (dx / len) * outward - half;
      const rawY = portScreen.y + (dy / len) * outward - half;
      const left = Math.max(6, Math.min(canvasWidth - QUICK_BRANCH_PILL_SIZE - 6, rawX));
      const top = Math.max(6, Math.min(canvasHeight - QUICK_BRANCH_PILL_SIZE - 6, rawY));
      return { direction, left, top };
    });
  }, [canvasHeight, canvasWidth, object, viewport]);

  return (
    <>
      {handles.map((item) => (
        <QuickBranchPill
          key={item.direction}
          direction={item.direction}
          left={item.left}
          top={item.top}
          theme={theme}
          onBranch={onBranch}
        />
      ))}
    </>
  );
});
