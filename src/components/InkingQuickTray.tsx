import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { isCustomColor, PEN_COLORS } from '../canvas/document';
import type { FreehandTool } from '../canvas/ink';
import {
  LASER_COLOR_LIST,
  isLaserPresetKey,
  resolveLaserPalette,
  type LaserColorKey,
} from '../canvas/laser';
import { radii, spacing, typography, type ThemeColors } from '../theme';
import { ColorPicker } from './ColorPicker';
import { EraserIcon, HighlighterIcon, LaserIcon, PenIcon, PlusIcon, StyleIcon } from './icons';

export type InkingTool = FreehandTool | 'eraser' | 'laser';

type InkingQuickTrayProps = {
  theme: ThemeColors;
  dark: boolean;
  activeTool: InkingTool;
  color: string;
  strokeWidth: number;
  eraserRadius: number;
  laserColorKey?: LaserColorKey;
  stylusOnlyDrawing?: boolean;
  bottomOffset: number;
  onToolChange: (tool: InkingTool) => void;
  onColorChange: (color: string) => void;
  onWidthChange: (width: number) => void;
  onEraserRadiusChange: (radius: number) => void;
  onLaserColorChange?: (colorKey: LaserColorKey) => void;
  onToggleStylusOnly?: () => void;
  onOpenFullOptions: () => void;
};

const PEN_WIDTH_PRESETS = [2, 4, 8, 12];
const ERASER_PRESETS = [12, 24, 36];

export function InkingQuickTray({
  theme,
  dark,
  activeTool,
  color,
  strokeWidth,
  eraserRadius,
  laserColorKey = 'red',
  stylusOnlyDrawing = false,
  bottomOffset,
  onToolChange,
  onColorChange,
  onWidthChange,
  onEraserRadiusChange,
  onLaserColorChange,
  onToggleStylusOnly,
  onOpenFullOptions,
}: InkingQuickTrayProps) {
  const [customColorOpen, setCustomColorOpen] = useState(false);
  const isEraser = activeTool === 'eraser';
  const isLaser = activeTool === 'laser';
  const customColor = isCustomColor(color);

  const toolSegment = (
    <View style={[styles.toolSegment, { borderColor: theme.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Pen tool"
        accessibilityState={{ selected: activeTool === 'pen' }}
        onPress={() => onToolChange('pen')}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        style={[
          styles.toolButton,
          activeTool === 'pen' && { backgroundColor: theme.primary + '1F', borderColor: theme.primary },
        ]}
      >
        <PenIcon size={20} color={activeTool === 'pen' ? theme.primary : theme.foreground} />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Highlighter tool"
        accessibilityState={{ selected: activeTool === 'highlighter' }}
        onPress={() => onToolChange('highlighter')}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        style={[
          styles.toolButton,
          activeTool === 'highlighter' && { backgroundColor: theme.primary + '1F', borderColor: theme.primary },
        ]}
      >
        <HighlighterIcon size={20} color={activeTool === 'highlighter' ? theme.primary : theme.foreground} />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Eraser tool"
        accessibilityState={{ selected: activeTool === 'eraser' }}
        onPress={() => onToolChange('eraser')}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        style={[
          styles.toolButton,
          activeTool === 'eraser' && { backgroundColor: theme.primary + '1F', borderColor: theme.primary },
        ]}
      >
        <EraserIcon size={20} color={activeTool === 'eraser' ? theme.primary : theme.foreground} />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Laser pointer tool"
        accessibilityState={{ selected: activeTool === 'laser' }}
        onPress={() => onToolChange('laser')}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        style={[
          styles.toolButton,
          activeTool === 'laser' && { backgroundColor: theme.primary + '1F', borderColor: theme.primary },
        ]}
      >
        <LaserIcon size={20} color={activeTool === 'laser' ? theme.primary : theme.foreground} />
      </Pressable>
    </View>
  );

  const sizeSegment = (
    <View style={styles.sizeSegment}>
      <Text style={[styles.segmentLabel, { color: theme.foreground }]}>
        {isEraser ? 'Size' : 'Width'}
      </Text>
      {isEraser
        ? ERASER_PRESETS.map((radius) => {
          const selected = Math.abs(eraserRadius - radius) < 6;
          return (
            <Pressable
              key={radius}
              accessibilityRole="button"
              accessibilityLabel={`Eraser size ${radius}`}
              accessibilityState={{ selected }}
              onPress={() => onEraserRadiusChange(radius)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              style={[
                styles.sizeButton,
                selected && { borderColor: theme.primary, backgroundColor: theme.primary + '18' },
              ]}
            >
              <View
                style={{
                  width: Math.min(18, radius / 2),
                  height: Math.min(18, radius / 2),
                  borderRadius: radius / 4,
                  backgroundColor: selected ? theme.primary : theme.foreground,
                }}
              />
            </Pressable>
          );
        })
        : PEN_WIDTH_PRESETS.map((width) => {
          const selected = strokeWidth === width;
          return (
            <Pressable
              key={width}
              accessibilityRole="button"
              accessibilityLabel={`Stroke width ${width}`}
              accessibilityState={{ selected }}
              onPress={() => onWidthChange(width)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              style={[
                styles.sizeButton,
                selected && { borderColor: theme.primary, backgroundColor: theme.primary + '18' },
              ]}
            >
              <View
                style={{
                  width: Math.max(4, width * 1.5),
                  height: Math.max(4, width * 1.5),
                  borderRadius: (width * 1.5) / 2,
                  backgroundColor: selected ? theme.primary : theme.foreground,
                }}
              />
            </Pressable>
          );
        })}
    </View>
  );

  const optionsButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open detailed ink options"
      accessibilityHint="Opens opacity, all palette colors, and advanced sliders"
      onPress={onOpenFullOptions}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      style={({ pressed }) => [styles.optionsButton, pressed && styles.pressed]}
    >
      <StyleIcon size={18} color={theme.foreground} />
    </Pressable>
  );

  return (
    <View style={[styles.floatingContainer, { bottom: bottomOffset }]} pointerEvents="box-none">
      <View style={[styles.trayCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {customColorOpen ? (
          <View style={styles.colorPickerWrapper}>
            <ColorPicker
              theme={theme}
              value={
                isLaser
                  ? resolveLaserPalette(laserColorKey).halo
                  : customColor
                    ? color
                    : theme.primary
              }
              background={theme.background}
              checkContrast={false}
              onChange={(picked) => {
                if (isLaser) onLaserColorChange?.(picked);
                else onColorChange(picked);
              }}
              onClose={() => setCustomColorOpen(false)}
            />
          </View>
        ) : (
          // Two rows instead of one long strip: the single-row tray demanded
          // ~480pt and always ran off the right edge of a phone.
          <View style={styles.rows}>
            <View style={styles.row}>
              {toolSegment}
              {!isLaser && sizeSegment}
              {isEraser && optionsButton}
            </View>

            {isLaser && (
              <View style={styles.row}>
                {LASER_COLOR_LIST.map((entry) => {
                  const selected = laserColorKey === entry.key;
                  const shortName = entry.key === 'red' ? 'Red' : entry.key === 'teal' ? 'Teal' : 'Amber';
                  return (
                    <Pressable
                      key={entry.key}
                      accessibilityRole="button"
                      accessibilityLabel={entry.label}
                      accessibilityState={{ selected }}
                      onPress={() => onLaserColorChange?.(entry.key)}
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                      style={[
                        styles.laserChip,
                        {
                          borderColor: selected ? theme.primary : theme.border,
                          backgroundColor: selected ? theme.primary + '1F' : theme.background,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.laserDot,
                          { backgroundColor: entry.halo, borderColor: entry.core },
                        ]}
                      />
                      <Text
                        style={[
                          styles.laserChipText,
                          { color: selected ? theme.primary : theme.foreground },
                        ]}
                      >
                        {shortName}
                      </Text>
                    </Pressable>
                  );
                })}
                {(() => {
                  const customLaser = !isLaserPresetKey(laserColorKey);
                  const customPalette = resolveLaserPalette(laserColorKey);
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        customLaser ? `Custom laser color ${customPalette.halo}` : 'Choose custom laser color'
                      }
                      accessibilityState={{ selected: customLaser }}
                      onPress={() => setCustomColorOpen(true)}
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                      style={[
                        styles.laserChip,
                        {
                          borderColor: customLaser ? theme.primary : theme.border,
                          backgroundColor: customLaser ? theme.primary + '1F' : theme.background,
                        },
                      ]}
                    >
                      {customLaser ? (
                        <View
                          style={[
                            styles.laserDot,
                            { backgroundColor: customPalette.halo, borderColor: customPalette.core },
                          ]}
                        />
                      ) : (
                        <PlusIcon size={14} color={theme.foreground} />
                      )}
                      <Text
                        style={[
                          styles.laserChipText,
                          { color: customLaser ? theme.primary : theme.foreground },
                        ]}
                      >
                        Custom
                      </Text>
                    </Pressable>
                  );
                })()}
                {optionsButton}
              </View>
            )}

            {!isEraser && !isLaser && (
              <View style={styles.row}>
                <View style={[styles.colorSegment, { borderColor: theme.border }]}>
                  {PEN_COLORS.slice(0, 4).map((entry) => {
                    const swatchColor = dark ? entry.dark : entry.light;
                    const selected = !customColor && (color === swatchColor || color === entry.light || color === entry.dark);
                    return (
                      <Pressable
                        key={entry.key}
                        accessibilityRole="button"
                        accessibilityLabel={`Color ${entry.name}`}
                        accessibilityState={{ selected }}
                        onPress={() => onColorChange(swatchColor)}
                        hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                        style={[
                          styles.colorSwatch,
                          { backgroundColor: swatchColor },
                          selected && { borderColor: theme.primary, borderWidth: 2.5, transform: [{ scale: 1.15 }] },
                        ]}
                      />
                    );
                  })}

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={customColor ? `Custom color ${color}` : 'Choose custom color'}
                    onPress={() => setCustomColorOpen(true)}
                    hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                    style={[
                      styles.colorSwatch,
                      styles.customColorSwatch,
                      {
                        borderColor: customColor ? theme.primary : theme.border,
                        backgroundColor: customColor ? color : theme.muted,
                      },
                      customColor && { borderWidth: 2.5, transform: [{ scale: 1.15 }] },
                    ]}
                  >
                    {!customColor && <PlusIcon size={14} color={theme.foreground} />}
                  </Pressable>
                </View>
                {onToggleStylusOnly && (
                  <Pressable
                    accessibilityRole="switch"
                    accessibilityLabel="Stylus-only drawing"
                    accessibilityState={{ checked: stylusOnlyDrawing }}
                    onPress={onToggleStylusOnly}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                    style={[
                      styles.laserChip,
                      {
                        borderColor: stylusOnlyDrawing ? theme.primary : theme.border,
                        backgroundColor: stylusOnlyDrawing ? theme.primary + '1F' : theme.background,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.laserChipText,
                        { color: stylusOnlyDrawing ? theme.primary : theme.foreground },
                      ]}
                    >
                      Stylus
                    </Text>
                  </Pressable>
                )}
                {optionsButton}
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 15,
  },
  trayCard: {
    maxWidth: 420,
    marginHorizontal: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  rows: { gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  toolSegment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingRight: spacing.xs,
    borderRightWidth: 1,
  },
  toolButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sizeSegment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.xs,
  },
  segmentLabel: { ...typography.caption, fontSize: 11, fontWeight: '600', opacity: 0.6 },
  sizeButton: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSegment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: spacing.xs,
    paddingRight: spacing.xs,
    borderLeftWidth: 1,
  },
  colorSwatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  customColorSwatch: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  laserChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  laserDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
  },
  laserChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  optionsButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
  },
  colorPickerWrapper: {
    minWidth: 280,
    padding: spacing.xs,
  },
  pressed: {
    opacity: 0.65,
  },
});

