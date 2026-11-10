import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { stickyColorValue } from '../canvas/document';
import { spacing, typography, type ThemeColors } from '../theme';
import type { InkTool } from './CanvasViewport';
import type { InkingTool } from './InkingQuickTray';
import { EraserIcon, HighlighterIcon, PenIcon, PlusIcon, SelectIcon, StickyIcon } from './icons';

/**
 * Height of the bottom capsule pill. Sheets that belong to the island (ink
 * quick tray, style sheets) sit at `bottom + ACTION_ISLAND_HEIGHT` so they
 * stack above it instead of covering it.
 */
export const ACTION_ISLAND_HEIGHT = 58;

/** The Draw anchor shows the inking tool it will resume, not a fixed pen. */
const INK_ICON = {
  pen: PenIcon,
  highlighter: HighlighterIcon,
  eraser: EraserIcon,
} as const;

/** Tools that are only reachable through the insert sheet. */
const INSERT_TOOLS: readonly InkTool[] = ['text', 'shape', 'connector', 'image'];

type ActionIslandProps = {
  theme: ThemeColors;
  /** Distance from the bottom of the screen, already safe-area adjusted. */
  bottom: number;
  activeTool: InkTool;
  /** The inking tool the Draw anchor resumes when no inking tool is active. */
  inkTool: InkingTool;
  /** Current pen colour, shown as a dot on the Draw anchor. */
  inkColor: string;
  /** Current note pastel, shown as a dot on the Note anchor. */
  stickyColorKey: string;
  /** True while the insert sheet is open, so the anchor can report expansion. */
  insertOpen: boolean;
  onSelect: () => void;
  onDraw: () => void;
  onSticky: () => void;
  onInsert: () => void;
};

/**
 * Tier one of the two-tier action island: four 48pt anchors covering the
 * entire tool set. Selection, inking, sticky notes, and object insertion are
 * one tap away; the ninth tool no longer needs its own crammed button because
 * tier two (the insert sheet) holds them all.
 */
export function ActionIsland({
  theme,
  bottom,
  activeTool,
  inkTool,
  inkColor,
  stickyColorKey,
  insertOpen,
  onSelect,
  onDraw,
  onSticky,
  onInsert,
}: ActionIslandProps) {
  const isDrawActive = activeTool === 'pen' || activeTool === 'highlighter' || activeTool === 'eraser';
  const isStickyActive = activeTool === 'sticky';
  // Objects picked from the insert sheet keep the anchor lit so the user can
  // see where the armed tool came from.
  const isInsertActive = insertOpen || INSERT_TOOLS.includes(activeTool);
  const InkIcon = INK_ICON[inkTool];

  return (
    <View style={[styles.container, { bottom }]} pointerEvents="box-none">
      <View
        accessibilityRole="toolbar"
        accessibilityLabel="Board tools"
        style={[styles.pill, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        <Anchor
          theme={theme}
          label="Select"
          selected={activeTool === 'select'}
          onPress={onSelect}
          accessibilityHint="Tap or drag objects on the board"
        >
          {(color) => <SelectIcon size={22} color={color} />}
        </Anchor>

        <Divider color={theme.border} />

        <Anchor
          theme={theme}
          label="Draw"
          selected={isDrawActive}
          onPress={onDraw}
          accessibilityHint="Pen, highlighter, and eraser; tap again for stroke options"
        >
          {(color) => (
            <View>
              <InkIcon size={22} color={color} />
              <View
                style={[
                  styles.dot,
                  { backgroundColor: inkTool === 'eraser' ? theme.foreground : inkColor },
                ]}
              />
            </View>
          )}
        </Anchor>

        <Divider color={theme.border} />

        <Anchor
          theme={theme}
          label="Note"
          selected={isStickyActive}
          onPress={onSticky}
          accessibilityHint="Add a sticky note; tap again for colours and text size"
        >
          {(color) => (
            <View>
              <StickyIcon size={22} color={color} />
              <View style={[styles.dot, { backgroundColor: stickyColorValue(stickyColorKey) }]} />
            </View>
          )}
        </Anchor>

        <Divider color={theme.border} />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Insert object"
          accessibilityHint="Opens the insert sheet for text, shapes, connectors, and photos"
          accessibilityState={{ selected: isInsertActive, expanded: insertOpen }}
          onPress={onInsert}
          style={({ pressed }) => [
            styles.insert,
            { backgroundColor: theme.primary, borderColor: theme.primary },
            isInsertActive && styles.insertActive,
            pressed && styles.pressed,
          ]}
        >
          <PlusIcon size={22} color={theme.onPrimary} />
          <Text style={[styles.label, { color: theme.onPrimary }]} numberOfLines={1}>
            Insert
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

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
        selected && { backgroundColor: theme.primary + '1F', borderColor: theme.primary },
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

function Divider({ color }: { color: string }) {
  return <View style={[styles.divider, { backgroundColor: color }]} />;
}

const styles = StyleSheet.create({
  container: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 10 },
  // Flat design: depth comes from the 1px border, never a drop shadow.
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    gap: 2,
  },
  anchor: {
    minWidth: 56,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  insert: {
    minWidth: 56,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
  },
  insertActive: { borderColor: '#FFFFFF66' },
  label: { ...typography.caption, fontSize: 10, fontWeight: '600', textAlign: 'center' },
  divider: { width: 1, height: 26, opacity: 0.6 },
  dot: { position: 'absolute', bottom: -3, right: -4, width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: '#FFFFFF' },
  pressed: { opacity: 0.7 },
});
