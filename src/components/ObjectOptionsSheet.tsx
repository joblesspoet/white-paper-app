import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  SIZE_LABELS,
  STICKY_COLORS,
  STICKY_FONT_SIZES,
  TEXT_COLORS,
  TEXT_FONT_SIZES,
  textColorValue,
} from '../canvas/document';
import { radii, spacing, touchTarget, typography, type ThemeColors } from '../theme';

type ObjectOptionsSheetProps = {
  theme: ThemeColors;
  dark: boolean;
  kind: 'text' | 'sticky';
  colorKey: string;
  fontSize: number;
  /** Distance from the bottom of the screen, so the sheet clears the keyboard. */
  bottomOffset: number;
  doneLabel: string;
  doneHint?: string;
  /** Hidden while editing: the canvas tap commits instead of the scrim. */
  showScrim?: boolean;
  onColorChange: (key: string) => void;
  onFontSizeChange: (size: number) => void;
  onDone: () => void;
  onHeightChange?: (height: number) => void;
};

/**
 * Compact style sheet shared by the text tool, the sticky-note tool, and the
 * in-place editor. Colour and text size are the only two properties this slice
 * promises, so they stay visible instead of hiding behind a second menu.
 */
export function ObjectOptionsSheet({
  theme,
  dark,
  kind,
  colorKey,
  fontSize,
  bottomOffset,
  doneLabel,
  doneHint,
  showScrim = true,
  onColorChange,
  onFontSizeChange,
  onDone,
  onHeightChange,
}: ObjectOptionsSheetProps) {
  const isSticky = kind === 'sticky';
  const title = isSticky ? 'Sticky note' : 'Text';
  const sizes = isSticky ? STICKY_FONT_SIZES : TEXT_FONT_SIZES;
  const selectedChip = { backgroundColor: theme.primary, borderColor: theme.primary };

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
      <View style={[styles.layer, { bottom: bottomOffset }]} pointerEvents="box-none">
        <View
          accessibilityViewIsModal
          accessibilityLabel={`${title} options`}
          onLayout={(event) => onHeightChange?.(event.nativeEvent.layout.height)}
          style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}
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
          </View>

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
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: spacing.md },
  sheet: { width: '100%', maxWidth: 460, borderWidth: 1, borderRadius: radii.md, padding: spacing.md, gap: spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { ...typography.bodyStrong },
  done: { minHeight: touchTarget, justifyContent: 'center', paddingHorizontal: spacing.sm },
  doneText: { ...typography.bodyStrong },
  label: { ...typography.caption, marginTop: spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  swatch: { width: touchTarget, height: touchTarget, borderRadius: radii.sm, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  swatchFill: { width: 26, height: 26, borderRadius: 13 },
  chip: { minWidth: touchTarget, minHeight: touchTarget, borderWidth: 1, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm },
  chipText: { ...typography.bodyStrong },
  pressed: { opacity: 0.65 },
});
