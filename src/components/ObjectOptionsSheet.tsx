import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  SIZE_LABELS,
  STICKY_COLORS,
  STICKY_FONT_SIZES,
  TEXT_COLORS,
  TEXT_FONT_SIZES,
  isCustomColor,
  stickyColorValue,
  textColorValue,
  type TextSlant,
  type TextWeight,
} from '../canvas/document';
import type { ToolOptionsVariant } from '../responsive/layout';
import { radii, spacing, touchTarget, typography, type ThemeColors } from '../theme';
import { ColorPicker } from './ColorPicker';

type ObjectOptionsSheetProps = {
  theme: ThemeColors;
  dark: boolean;
  kind: 'text' | 'sticky';
  colorKey: string;
  fontSize: number;
  fontWeight: TextWeight;
  fontStyle: TextSlant;
  /** Distance from the bottom of the screen, so the sheet clears the keyboard or dock. */
  bottomOffset: number;
  variant?: ToolOptionsVariant;
  leftOffset?: number;
  topOffset?: number;
  maxWidth?: number;
  doneLabel: string;
  doneHint?: string;
  /** Hidden while editing: the canvas tap commits instead of the scrim. */
  showScrim?: boolean;
  onColorChange: (key: string) => void;
  onFontSizeChange: (size: number) => void;
  onFontWeightChange: (weight: TextWeight) => void;
  onFontStyleChange: (style: TextSlant) => void;
  onDone: () => void;
  onHeightChange?: (height: number) => void;
};

/**
 * Compact style sheet shared by the text tool, the sticky-note tool, and the
 * in-place editor. Docked at the bottom on phones or anchored beside the left
 * tool rail on tablets.
 */
export function ObjectOptionsSheet({
  theme,
  dark,
  kind,
  colorKey,
  fontSize,
  fontWeight,
  fontStyle,
  bottomOffset,
  variant = 'bottom-sheet',
  leftOffset = spacing.md,
  topOffset = spacing.md,
  maxWidth = 460,
  doneLabel,
  doneHint,
  showScrim = true,
  onColorChange,
  onFontSizeChange,
  onFontWeightChange,
  onFontStyleChange,
  onDone,
  onHeightChange,
}: ObjectOptionsSheetProps) {
  const isSticky = kind === 'sticky';
  const title = isSticky ? 'Sticky note' : 'Text';
  const sizes = isSticky ? STICKY_FONT_SIZES : TEXT_FONT_SIZES;
  const selectedChip = { backgroundColor: theme.primary, borderColor: theme.primary };
  const { height: windowHeight } = useWindowDimensions();
  const [customOpen, setCustomOpen] = useState(false);
  const customColor = isCustomColor(colorKey);
  const currentColor = customColor
    ? colorKey
    : isSticky
      ? stickyColorValue(colorKey)
      : textColorValue(colorKey, dark);
  const isPopover = variant === 'rail-popover';
  const maxSheetHeight = isPopover
    ? Math.max(220, windowHeight - topOffset - bottomOffset - 80)
    : Math.max(180, windowHeight - bottomOffset - 72);

  return (
    <>
      {showScrim && (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onDone}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        />
      )}
      <View
        style={
          isPopover
            ? [styles.popoverLayer, { left: leftOffset, top: topOffset }]
            : [styles.layer, { bottom: bottomOffset }]
        }
        pointerEvents="box-none"
      >
        <View
          accessibilityViewIsModal
          accessibilityLabel={`${title} options`}
          onLayout={(event) => onHeightChange?.(event.nativeEvent.layout.height)}
          style={[
            styles.sheet,
            {
              maxWidth: isPopover ? Math.min(380, maxWidth) : maxWidth,
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}
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
                accessibilityLabel={doneLabel}
                accessibilityHint={doneHint}
                onPress={onDone}
                style={({ pressed }) => [styles.done, pressed && styles.pressed]}
              >
                <Text style={[styles.doneText, { color: theme.primary }]}>{doneLabel}</Text>
              </Pressable>
            </View>

            <Text style={[styles.label, { color: theme.foreground }]}>{isSticky ? 'Note color' : 'Text color'}</Text>
            <View style={styles.row}>
              {isSticky
                ? STICKY_COLORS.map((entry) => {
                    const selected = colorKey === entry.key;
                    return (
                      <Pressable
                        key={entry.key}
                        accessibilityRole="radio"
                        accessibilityLabel={`Note color ${entry.name}`}
                        accessibilityState={{ selected }}
                        onPress={() => onColorChange(entry.key)}
                        style={({ pressed }) => [
                          styles.swatch,
                          { borderColor: selected ? theme.primary : theme.border },
                          pressed && styles.pressed,
                        ]}
                      >
                        <View style={[styles.swatchFill, { backgroundColor: entry.fill }]} />
                      </Pressable>
                    );
                  })
                : TEXT_COLORS.map((entry) => {
                    const selected = colorKey === entry.key;
                    return (
                      <Pressable
                        key={entry.key}
                        accessibilityRole="radio"
                        accessibilityLabel={`Text color ${entry.name}`}
                        accessibilityState={{ selected }}
                        onPress={() => onColorChange(entry.key)}
                        style={({ pressed }) => [
                          styles.swatch,
                          { borderColor: selected ? theme.primary : theme.border },
                          pressed && styles.pressed,
                        ]}
                      >
                        <View style={[styles.swatchFill, { backgroundColor: textColorValue(entry.key, dark) }]} />
                      </Pressable>
                    );
                  })}
              <Pressable
                accessibilityRole="radio"
                accessibilityLabel="Custom colour"
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
                    { backgroundColor: customColor ? colorKey : theme.muted },
                  ]}
                >
                  {!customColor && <Text style={[styles.plus, { color: theme.foreground }]}>+</Text>}
                </View>
              </Pressable>
            </View>

            {customOpen && (
              <ColorPicker
                theme={theme}
                value={currentColor}
                background={isSticky ? currentColor : theme.surface}
                checkContrast={!isSticky}
                onChange={onColorChange}
                onClose={() => setCustomOpen(false)}
              />
            )}

            <Text style={[styles.label, { color: theme.foreground }]}>Text size</Text>
            <View style={styles.row}>
              {sizes.map((size, index) => {
                const selected = fontSize === size;
                return (
                  <Pressable
                    key={size}
                    accessibilityRole="radio"
                    accessibilityLabel={`Text size ${size}`}
                    accessibilityState={{ selected }}
                    onPress={() => onFontSizeChange(size)}
                    style={({ pressed }) => [
                      styles.chip,
                      { borderColor: selected ? theme.primary : theme.border },
                      selected && selectedChip,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.chipText, { color: selected ? theme.surface : theme.foreground }]}>
                      {SIZE_LABELS[index]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.label, { color: theme.foreground }]}>Text style</Text>
            <View style={styles.row}>
              <Pressable
                accessibilityRole="switch"
                accessibilityLabel="Bold"
                accessibilityState={{ checked: fontWeight === 'bold' }}
                onPress={() => onFontWeightChange(fontWeight === 'bold' ? 'normal' : 'bold')}
                style={({ pressed }) => [
                  styles.chip,
                  { borderColor: fontWeight === 'bold' ? theme.primary : theme.border },
                  fontWeight === 'bold' && selectedChip,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    styles.boldGlyph,
                    { color: fontWeight === 'bold' ? theme.surface : theme.foreground },
                  ]}
                >
                  B
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="switch"
                accessibilityLabel="Italic"
                accessibilityState={{ checked: fontStyle === 'italic' }}
                onPress={() => onFontStyleChange(fontStyle === 'italic' ? 'normal' : 'italic')}
                style={({ pressed }) => [
                  styles.chip,
                  { borderColor: fontStyle === 'italic' ? theme.primary : theme.border },
                  fontStyle === 'italic' && selectedChip,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    styles.italicGlyph,
                    { color: fontStyle === 'italic' ? theme.surface : theme.foreground },
                  ]}
                >
                  I
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: spacing.md, zIndex: 25 },
  popoverLayer: { position: 'absolute', zIndex: 25 },
  sheet: { width: '100%', maxWidth: 460, borderWidth: 1, borderRadius: radii.md, padding: spacing.md },
  sheetContent: { gap: spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { ...typography.bodyStrong },
  done: { minHeight: touchTarget, minWidth: touchTarget, alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: spacing.sm },
  doneText: { ...typography.bodyStrong },
  label: { ...typography.caption, marginTop: spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  swatch: { width: touchTarget, height: touchTarget, borderRadius: radii.sm, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  swatchFill: { width: 26, height: 26, borderRadius: 13 },
  swatchCenter: { alignItems: 'center', justifyContent: 'center' },
  plus: { ...typography.bodyStrong, lineHeight: 20 },
  chip: { minWidth: touchTarget, minHeight: touchTarget, borderWidth: 1, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm },
  chipText: { ...typography.bodyStrong },
  boldGlyph: { fontWeight: 'bold' },
  italicGlyph: { fontStyle: 'italic' },
  pressed: { opacity: 0.65 },
});
