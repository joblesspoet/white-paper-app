import { memo, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { type ThemeColors } from '../theme';
import { actionIslandStyles as styles } from './ActionIsland.styles';
import type { InkTool } from './CanvasViewport';
import type { InkingTool } from './InkingQuickTray';
import {
  EraserIcon,
  HandIcon,
  HighlighterIcon,
  LaserIcon,
  PenIcon,
  PlusIcon,
  SelectIcon,
} from './icons';

/**
 * Height of the bottom capsule pill. Sheets that belong to the island (ink
 * quick tray, style sheets) sit at `bottom + ACTION_ISLAND_HEIGHT` so they
 * stack above it instead of covering it.
 */
export const ACTION_ISLAND_HEIGHT = 54;

/** The Draw anchor shows the inking tool it will resume, not a fixed pen. */
const INK_ICON = {
  pen: PenIcon,
  highlighter: HighlighterIcon,
  eraser: EraserIcon,
  laser: LaserIcon,
} as const;

/** Tools reachable through the insert sheet. */
const INSERT_TOOLS: readonly InkTool[] = ['text', 'sticky', 'shape', 'connector', 'image'];

type ActionIslandProps = {
  theme: ThemeColors;
  /** Distance from the bottom of the screen, already safe-area adjusted. */
  bottom: number;
  activeTool: InkTool;
  /** The inking tool the Draw anchor resumes when no inking tool is active. */
  inkTool: InkingTool;
  /** Current pen colour, shown as a dot on the Draw anchor. */
  inkColor: string;
  /** True while the insert sheet is open, so the anchor can report expansion. */
  insertOpen: boolean;
  onSelect: () => void;
  onPan: () => void;
  onDraw: () => void;
  onInsert: () => void;
};

/**
 * Tier one of the two-tier mobile action island: four sleek pill anchors
 * (`Select`, `Pan`, `Draw`, and `Insert`) keeping core navigation and inking
 * one tap away while object creation lives inside `+`.
 */
export const ActionIsland = memo(function ActionIsland({
  theme,
  bottom,
  activeTool,
  inkTool,
  inkColor,
  insertOpen,
  onSelect,
  onPan,
  onDraw,
  onInsert,
}: ActionIslandProps) {
  const isDrawActive =
    activeTool === 'pen' ||
    activeTool === 'highlighter' ||
    activeTool === 'eraser' ||
    activeTool === 'laser';
  const isInsertActive = insertOpen || INSERT_TOOLS.includes(activeTool);
  const InkIcon = INK_ICON[inkTool];

  return (
    <View style={[styles.container, { bottom }]} pointerEvents="box-none">
      <View
        accessibilityRole="toolbar"
        accessibilityLabel="Board tools"
        style={[
          styles.pill,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Anchor
          theme={theme}
          label="Select"
          selected={activeTool === 'select'}
          onPress={onSelect}
          accessibilityHint="Tap or drag objects on the board"
        >
          {(color) => <SelectIcon size={18} color={color} />}
        </Anchor>

        <Anchor
          theme={theme}
          label="Pan"
          selected={activeTool === 'pan'}
          onPress={onPan}
          accessibilityHint="Drag with one finger to scroll around the canvas"
        >
          {(color) => <HandIcon size={18} color={color} />}
        </Anchor>

        <Anchor
          theme={theme}
          label="Draw"
          selected={isDrawActive}
          onPress={onDraw}
          accessibilityHint="Pen, highlighter, and eraser; tap again for stroke options"
        >
          {(color) => (
            <View style={styles.iconWrap}>
              <InkIcon size={18} color={color} />
              <View
                style={[
                  styles.dot,
                  { backgroundColor: inkTool === 'eraser' ? theme.foreground : inkColor },
                ]}
              />
            </View>
          )}
        </Anchor>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Insert object"
          accessibilityHint="Opens the insert sheet for notes, text, shapes, math, and utilities"
          accessibilityState={{ selected: isInsertActive, expanded: insertOpen }}
          onPress={onInsert}
          style={({ pressed }) => [
            styles.insert,
            { backgroundColor: theme.primary, borderColor: theme.primary },
            isInsertActive && styles.insertActive,
            pressed && styles.pressed,
          ]}
        >
          <PlusIcon size={18} color={theme.onPrimary} />
          <Text style={[styles.label, { color: theme.onPrimary }]} numberOfLines={1}>
            Insert
          </Text>
        </Pressable>
      </View>
    </View>
  );
});

function Anchor({
  theme,
  label,
  selected,
  onPress,
  accessibilityHint,
  children,
}: {
  theme: ThemeColors;
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityHint: string;
  children: (color: string) => ReactNode;
}) {
  const color = selected ? theme.primary : theme.foreground;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.anchor,
        selected && {
          backgroundColor: `${theme.primary}1A`,
          borderColor: `${theme.primary}66`,
        },
        pressed && styles.pressed,
      ]}
    >
      {children(color)}
      <Text style={[styles.label, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}
