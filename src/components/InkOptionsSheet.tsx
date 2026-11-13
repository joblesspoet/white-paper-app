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
import {
  LASER_COLOR_LIST,
  isLaserPresetKey,
  resolveLaserPalette,
  type LaserColorKey,
} from '../canvas/laser';
import type { ToolOptionsVariant } from '../responsive/layout';
import { radii, spacing, touchTarget, typography, type ThemeColors } from '../theme';
import { ColorPicker } from './ColorPicker';
import { EraserIcon, HighlighterIcon, PenIcon } from './icons';

export type InkSheetTool = FreehandTool | 'eraser' | 'laser';

type InkOptionsSheetProps = {
  theme: ThemeColors;
  dark: boolean;
  tool: InkSheetTool;
  color: string;
  width: number;
  opacity: number;
  eraserRadius: number;
  laserColorKey?: LaserColorKey;
  stylusOnlyDrawing?: boolean;
  holdToSnapShapes?: boolean;
  bottomOffset: number;
  variant?: ToolOptionsVariant;
  leftOffset?: number;
  topOffset?: number;
  maxWidth?: number;
  onToolChange: (tool: FreehandTool) => void;
  onColorChange: (color: string) => void;
  onWidthChange: (width: number) => void;
  onOpacityChange: (opacity: number) => void;
  onEraserRadiusChange: (radius: number) => void;
  onLaserColorChange?: (colorKey: LaserColorKey) => void;
  onToggleStylusOnly?: () => void;
  onToggleHoldToSnap?: () => void;
  onClose: () => void;
};

/**
 * Compact ink options sheet: a small popover above the dock on phones or beside
 * the left tool rail on tablets so the canvas keeps most of the screen.
 */
export function InkOptionsSheet({
  theme,
  dark,
  tool,
  color,
  width,
  opacity,
  eraserRadius,
  laserColorKey = 'red',
  stylusOnlyDrawing = false,
  holdToSnapShapes = true,
  bottomOffset,
  variant = 'bottom-sheet',
  leftOffset = spacing.md,
  topOffset = spacing.md,
  maxWidth = 460,
  onToolChange,
  onColorChange,
  onWidthChange,
  onOpacityChange,
  onEraserRadiusChange,
  onLaserColorChange,
  onToggleStylusOnly,
  onToggleHoldToSnap,
  onClose,
}: InkOptionsSheetProps) {
  const { height: windowHeight } = useWindowDimensions();
  const [customOpen, setCustomOpen] = useState(false);
  const customColor = isCustomColor(color);
  const isPopover = variant === 'rail-popover';
  const maxSheetHeight = isPopover
    ? Math.max(220, windowHeight - topOffset - bottomOffset - 80)
    : Math.max(180, windowHeight - bottomOffset - 72);
  const title =
    tool === 'eraser'
      ? 'Eraser'
      : tool === 'highlighter'
        ? 'Highlighter'
        : tool === 'laser'
          ? 'Laser'
          : 'Pen';
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
                accessibilityLabel="Done with ink options"
                onPress={onClose}
                style={({ pressed }) => [styles.done, pressed && styles.pressed]}
              >
                <Text style={[styles.doneText, { color: theme.primary }]}>Done</Text>
              </Pressable>
            </View>

            {tool === 'laser' ? (
              <>
                <Text style={[styles.label, { color: theme.foreground }]}>Laser color</Text>
                <View style={styles.row}>
                  {LASER_COLOR_LIST.map((entry) => {
                    const selected = laserColorKey === entry.key;
                    return (
                      <Pressable
                        key={entry.key}
                        accessibilityRole="radio"
                        accessibilityLabel={entry.label}
                        accessibilityState={{ selected }}
                        onPress={() => onLaserColorChange?.(entry.key)}
                        style={({ pressed }) => [
                          styles.chip,
                          {
                            flexDirection: 'row',
                            borderColor: selected ? theme.primary : theme.border,
                            paddingHorizontal: spacing.md,
                            gap: 8,
                          },
                          selected && selectedChip,
                          pressed && styles.pressed,
                        ]}
                      >
                        <View
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: 7,
                            backgroundColor: entry.halo,
                            borderWidth: 1.5,
                            borderColor: entry.core,
                          }}
                        />
                        <Text style={[styles.chipText, { color: selected ? theme.surface : theme.foreground }]}>
                          {entry.key === 'red' ? 'Red' : entry.key === 'teal' ? 'Teal' : 'Amber'}
                        </Text>
                      </Pressable>
                    );
                  })}
                  {(() => {
                    const customLaser = !isLaserPresetKey(laserColorKey);
                    const customPalette = resolveLaserPalette(laserColorKey);
                    return (
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityLabel="Custom laser color"
                        accessibilityState={{ selected: customLaser }}
                        onPress={() => setCustomOpen((open) => !open)}
                        style={({ pressed }) => [
                          styles.chip,
                          {
                            flexDirection: 'row',
                            borderColor: customLaser ? theme.primary : theme.border,
                            paddingHorizontal: spacing.md,
                            gap: 8,
                          },
                          customLaser && selectedChip,
                          pressed && styles.pressed,
                        ]}
                      >
                        <View
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: 7,
                            backgroundColor: customLaser ? customPalette.halo : theme.muted,
                            borderWidth: 1.5,
                            borderColor: customLaser ? customPalette.core : theme.border,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        />
                        <Text style={[styles.chipText, { color: customLaser ? theme.surface : theme.foreground }]}>
                          Custom
                        </Text>
                      </Pressable>
                    );
                  })()}
                </View>
                {customOpen && (
                  <ColorPicker
                    theme={theme}
                    value={resolveLaserPalette(laserColorKey).halo}
                    background={theme.surface}
                    checkContrast={false}
                    onChange={(picked) => onLaserColorChange?.(picked)}
                    onClose={() => setCustomOpen(false)}
                  />
                )}
                <Text style={[styles.note, { color: theme.foreground }]}>
                  Ephemeral trail fades over 1.2s without saving to board history.
                </Text>
              </>
            ) : tool === 'eraser' ? (
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

                {(onToggleStylusOnly || onToggleHoldToSnap) && (
                  <>
                    <Text style={[styles.label, { color: theme.foreground }]}>Stylus & Smart Ink</Text>
                    <View style={styles.row}>
                      {onToggleStylusOnly && (
                        <Pressable
                          accessibilityRole="switch"
                          accessibilityLabel="Stylus-only drawing"
                          accessibilityState={{ checked: stylusOnlyDrawing }}
                          onPress={onToggleStylusOnly}
                          style={({ pressed }) => [
                            styles.chip,
                            { borderColor: stylusOnlyDrawing ? theme.primary : theme.border },
                            stylusOnlyDrawing && selectedChip,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              stylusOnlyDrawing ? selectedText : { color: theme.foreground },
                            ]}
                          >
                            Stylus-only
                          </Text>
                        </Pressable>
                      )}
                      {onToggleHoldToSnap && (
                        <Pressable
                          accessibilityRole="switch"
                          accessibilityLabel="Hold to snap shapes"
                          accessibilityState={{ checked: holdToSnapShapes }}
                          onPress={onToggleHoldToSnap}
                          style={({ pressed }) => [
                            styles.chip,
                            { borderColor: holdToSnapShapes ? theme.primary : theme.border },
                            holdToSnapShapes && selectedChip,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              holdToSnapShapes ? selectedText : { color: theme.foreground },
                            ]}
                          >
                            Hold-to-snap
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </>
                )}
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
