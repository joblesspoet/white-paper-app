import { useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  ERASER_SIZES,
  INK_OPACITIES,
  INK_WIDTHS,
  type FreehandTool,
} from '../canvas/ink';
import { isCustomColor, PEN_COLORS, textColorValue } from '../canvas/document';
import { radii, spacing, touchTarget, typography, type ThemeColors } from '../theme';
import { ColorPicker } from './ColorPicker';
import { EraserIcon, HighlighterIcon, PenIcon } from './icons';

export type InkSheetTool = FreehandTool | 'eraser';

type InkOptionsSheetProps = {
  theme: ThemeColors;
  dark: boolean;
  tool: InkSheetTool;
  color: string;
  width: number;
  opacity: number;
  eraserRadius: number;
  bottomOffset: number;
  onToolChange: (tool: FreehandTool) => void;
  onColorChange: (color: string) => void;
  onWidthChange: (width: number) => void;
  onOpacityChange: (opacity: number) => void;
  onEraserRadiusChange: (radius: number) => void;
  onClose: () => void;
};

/**
 * Compact ink options sheet: a small popover above the dock so the canvas keeps
 * most of the screen, with every choice visible instead of hidden in menus.
 */
export function InkOptionsSheet({
  theme,
  dark,
  tool,
  color,
  width,
  opacity,
  eraserRadius,
  bottomOffset,
  onToolChange,
  onColorChange,
  onWidthChange,
  onOpacityChange,
  onEraserRadiusChange,
  onClose,
}: InkOptionsSheetProps) {
  const { height: windowHeight } = useWindowDimensions();
  const [customOpen, setCustomOpen] = useState(false);
  const customColor = isCustomColor(color);
  const maxSheetHeight = Math.max(240, windowHeight - bottomOffset - spacing.lg);
  const title = tool === 'eraser' ? 'Eraser' : tool === 'highlighter' ? 'Highlighter' : 'Pen';
  const selectedChip = { backgroundColor: theme.primary, borderColor: theme.primary };
  const selectedText = { color: theme.surface };

  return (
    <>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      />
      <View style={[styles.layer, { bottom: bottomOffset }]} pointerEvents="box-none">
        <View
          accessibilityViewIsModal
          accessibilityLabel={`${title} options`}
          style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <ScrollView
            style={{ maxHeight: maxSheetHeight }}
            contentContainerStyle={styles.sheetContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.foreground }]}>{title} options</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Done with ink options"
              onPress={onClose}
              style={({ pressed }) => [styles.done, pressed && styles.pressed]}
            >
              <Text style={[styles.doneText, { color: theme.primary }]}>Done</Text>
            </Pressable>
          </View>

          {tool === 'eraser' ? (
            <>
              <Text style={[styles.label, { color: theme.foreground }]}>Eraser size</Text>
              <View style={styles.row}>
                {ERASER_SIZES.map((size) => {
                  const selected = eraserRadius === size;
                  return (
                    <Pressable
                      key={size}
                      accessibilityRole="radio"
                      accessibilityLabel={`Eraser size ${size}`}
                      accessibilityState={{ selected }}
                      onPress={() => onEraserRadiusChange(size)}
                      style={({ pressed }) => [
                        styles.sizeChip,
                        { borderColor: selected ? theme.primary : theme.border },
                        selected && selectedChip,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View
                        style={[
                          styles.eraserPreview,
                          {
                            width: size / 2,
                            height: size / 2,
                            borderRadius: size / 2,
                            borderColor: selected ? theme.surface : theme.foreground,
                          },
                        ]}
                      />
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[styles.note, { color: theme.foreground }]}>Tap or drag over a stroke to remove it.</Text>
            </>
          ) : (
            <>
              <View style={styles.row}>
                <ToolChoice
                  theme={theme}
                  label="Pen"
                  icon={<PenIcon size={20} color={tool === 'pen' ? theme.surface : theme.foreground} />}
                  selected={tool === 'pen'}
                  onPress={() => onToolChange('pen')}
                />
                <ToolChoice
                  theme={theme}
                  label="Highlighter"
                  icon={<HighlighterIcon size={20} color={tool === 'highlighter' ? theme.surface : theme.foreground} />}
                  selected={tool === 'highlighter'}
                  onPress={() => onToolChange('highlighter')}
                />
              </View>

              <Text style={[styles.label, { color: theme.foreground }]}>Color</Text>
              <View style={styles.row}>
                {PEN_COLORS.map((entry) => {
                  const value = textColorValue(entry.key, dark);
                  const selected = color === value;
                  return (
                    <Pressable
                      key={entry.key}
                      accessibilityRole="radio"
                      accessibilityLabel={`Ink color ${entry.name}`}
                      accessibilityState={{ selected }}
                      onPress={() => onColorChange(value)}
                      style={({ pressed }) => [
                        styles.swatch,
                        { borderColor: selected ? theme.primary : theme.border },
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={[styles.swatchFill, { backgroundColor: value }]} />
                    </Pressable>
                  );
                })}
                <Pressable
                  accessibilityRole="radio"
                  accessibilityLabel="Custom ink colour"
                  accessibilityState={{ selected: customColor }}
                  onPress={() => setCustomOpen((open) => !open)}
                  style={({ pressed }) => [
                    styles.swatch,
                    { borderColor: customColor ? theme.primary : theme.border },
                    pressed && styles.pressed,
                  ]}
                >
                  <View
                    style={[
                      styles.swatchFill,
                      styles.swatchCenter,
                      { backgroundColor: customColor ? color : theme.muted },
                    ]}
                  >
                    {!customColor && <Text style={[styles.plus, { color: theme.foreground }]}>+</Text>}
                  </View>
                </Pressable>
              </View>

              {customOpen && (
                <ColorPicker
                  theme={theme}
                  value={color}
                  background={theme.surface}
                  onChange={onColorChange}
                  onClose={() => setCustomOpen(false)}
                />
              )}

              <Text style={[styles.label, { color: theme.foreground }]}>Width</Text>
              <View style={styles.row}>
                {INK_WIDTHS.map((option) => {
                  const selected = width === option;
                  return (
                    <Pressable
                      key={option}
                      accessibilityRole="radio"
                      accessibilityLabel={`Stroke width ${option}`}
                      accessibilityState={{ selected }}
                      onPress={() => onWidthChange(option)}
                      style={({ pressed }) => [
                        styles.chip,
                        { borderColor: selected ? theme.primary : theme.border },
                        selected && selectedChip,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={[styles.widthPreview, { height: Math.max(2, option), backgroundColor: selected ? theme.surface : color }]} />
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.label, { color: theme.foreground }]}>Opacity</Text>
              <View style={styles.row}>
                {INK_OPACITIES.map((option) => {
                  const selected = opacity === option;
                  return (
                    <Pressable
                      key={option}
                      accessibilityRole="radio"
                      accessibilityLabel={`Opacity ${Math.round(option * 100)} percent`}
                      accessibilityState={{ selected }}
                      onPress={() => onOpacityChange(option)}
                      style={({ pressed }) => [
                        styles.chip,
                        { borderColor: selected ? theme.primary : theme.border },
                        selected && selectedChip,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={[styles.chipText, selected ? selectedText : { color: theme.foreground }]}>
                        {Math.round(option * 100)}%
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
          </ScrollView>
        </View>
      </View>
    </>
  );
}

function ToolChoice({
  theme,
  label,
  icon,
  selected,
  onPress,
}: {
  theme: ThemeColors;
  label: string;
  icon: ReactNode;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} tool`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.toolChoice,
        { borderColor: selected ? theme.primary : theme.border },
        selected && { backgroundColor: theme.primary },
        pressed && styles.pressed,
      ]}
    >
      {icon}
      <Text style={[styles.toolChoiceText, { color: selected ? theme.surface : theme.foreground }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: spacing.md },
  sheet: { width: '100%', maxWidth: 460, borderWidth: 1, borderRadius: radii.md, padding: spacing.md },
  sheetContent: { gap: spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { ...typography.bodyStrong },
  done: { minHeight: touchTarget, justifyContent: 'center', paddingHorizontal: spacing.sm },
  doneText: { ...typography.bodyStrong },
  label: { ...typography.caption, marginTop: spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  toolChoice: { minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: spacing.md },
  toolChoiceText: { ...typography.caption },
  swatch: { width: touchTarget, height: touchTarget, borderRadius: radii.sm, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  swatchFill: { width: 26, height: 26, borderRadius: 13 },
  swatchCenter: { alignItems: 'center', justifyContent: 'center' },
  plus: { ...typography.bodyStrong, lineHeight: 20 },
  chip: { minWidth: touchTarget, minHeight: touchTarget, borderWidth: 1, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm },
  chipText: { ...typography.caption },
  widthPreview: { width: 24, borderRadius: 6 },
  sizeChip: { width: touchTarget + 8, height: touchTarget + 8, borderWidth: 1, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  eraserPreview: { borderWidth: 2 },
  note: { ...typography.caption, opacity: 0.72 },
  pressed: { opacity: 0.65 },
});
