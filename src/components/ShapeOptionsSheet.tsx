import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { isCustomColor, SHAPE_COLORS, SHAPE_FILLS } from '../canvas/document';
import { CONNECTOR_STROKE_WIDTHS, SHAPE_STROKE_WIDTHS, STROKE_WIDTH_LABELS, type ConnectorStyle, type ShapeKind } from '../canvas/shapes';
import type { ToolOptionsVariant } from '../responsive/layout';
import { radii, spacing, touchTarget, typography, type ThemeColors } from '../theme';
import { ColorPicker } from './ColorPicker';
import { EllipseIcon, LineIcon, PlusIcon, RectangleIcon } from './icons';

type Props = {
  theme: ThemeColors;
  mode: 'shape' | 'connector';
  shapeKind: ShapeKind;
  shapeColorKey: string;
  shapeFillKey: string | null;
  shapeStrokeWidth: number;
  connectorStyle: ConnectorStyle;
  connectorColorKey: string;
  connectorStrokeWidth: number;
  /** Distance from the bottom of the screen, so the sheet clears the tool dock. */
  bottomOffset: number;
  variant?: ToolOptionsVariant;
  leftOffset?: number;
  topOffset?: number;
  maxWidth?: number;
  onShapeKind: (value: ShapeKind) => void;
  onShapeColor: (value: string) => void;
  onShapeFill: (value: string | null) => void;
  onShapeStrokeWidth: (value: number) => void;
  onConnectorStyle: (value: ConnectorStyle) => void;
  onConnectorColor: (value: string) => void;
  onConnectorStrokeWidth: (value: number) => void;
  onDone: () => void;
};

const SHAPE_CHOICES = [
  { kind: 'rectangle', label: 'Rectangle', Icon: RectangleIcon },
  { kind: 'ellipse', label: 'Ellipse', Icon: EllipseIcon },
  { kind: 'line', label: 'Line', Icon: LineIcon },
] as const satisfies ReadonlyArray<{ kind: ShapeKind; label: string; Icon: typeof RectangleIcon }>;

/** Compact shape/connector sheet: docked above the island on phone or beside the rail on tablet. */
export function ShapeOptionsSheet({
  theme, mode, shapeKind, shapeColorKey, shapeFillKey, shapeStrokeWidth,
  connectorStyle, connectorColorKey, connectorStrokeWidth, bottomOffset,
  variant = 'bottom-sheet',
  leftOffset = spacing.md,
  topOffset = spacing.md,
  maxWidth = 460,
  onShapeKind, onShapeColor, onShapeFill, onShapeStrokeWidth,
  onConnectorStyle, onConnectorColor, onConnectorStrokeWidth, onDone,
}: Props) {
  const shape = mode === 'shape';
  const widths = shape ? SHAPE_STROKE_WIDTHS : CONNECTOR_STROKE_WIDTHS;
  const { height: windowHeight } = useWindowDimensions();
  const [customTarget, setCustomTarget] = useState<'fill' | 'stroke' | null>(null);

  const customFill = shapeFillKey ? isCustomColor(shapeFillKey) : false;
  const strokeColorKey = shape ? shapeColorKey : connectorColorKey;
  const customStroke = isCustomColor(strokeColorKey);
  const isPopover = variant === 'rail-popover';

  const maxSheetHeight = isPopover
    ? Math.max(220, windowHeight - topOffset - bottomOffset - 80)
    : Math.max(180, windowHeight - bottomOffset - 72);

  return (
    <View
      style={
        isPopover
          ? [styles.popoverLayer, { left: leftOffset, top: topOffset }]
          : [styles.layer, { bottom: bottomOffset }]
      }
      pointerEvents="box-none"
    >
      <View
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
            <Text style={[styles.title, { color: theme.foreground }]}>{shape ? 'Shape options' : 'Connector options'}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Done"
              onPress={onDone}
              style={styles.done}
            >
              <Text style={[styles.doneText, { color: theme.primary }]}>Done</Text>
            </Pressable>
          </View>
          {customTarget === 'fill' ? (
            <ColorPicker
              theme={theme}
              value={customFill && shapeFillKey ? shapeFillKey : '#BBF7D0'}
              background={theme.background}
              checkContrast={false}
              onChange={(hex) => onShapeFill(hex)}
              onClose={() => setCustomTarget(null)}
            />
          ) : customTarget === 'stroke' ? (
            <ColorPicker
              theme={theme}
              value={customStroke ? strokeColorKey : '#134E4A'}
              background={theme.background}
              checkContrast={false}
              onChange={(hex) => (shape ? onShapeColor(hex) : onConnectorColor(hex))}
              onClose={() => setCustomTarget(null)}
            />
          ) : (
            <>
              {shape ? (
                <>
                  <Text style={[styles.label, { color: theme.foreground }]}>Shape</Text>
                  <View style={styles.row}>
                    {SHAPE_CHOICES.map(({ kind, label, Icon }) => (
                      <ShapeChoice key={kind} label={label} Icon={Icon} selected={shapeKind === kind} theme={theme} onPress={() => onShapeKind(kind)} />
                    ))}
                  </View>
                  <Text style={[styles.label, { color: theme.foreground }]}>Fill</Text>
                  <View style={styles.row}>
                    <Choice label="None" selected={shapeFillKey === null} theme={theme} onPress={() => onShapeFill(null)} />
                    {SHAPE_FILLS.slice(0, 8).map((entry) => (
                      <Pressable
                        key={entry.key}
                        accessibilityRole="radio"
                        accessibilityLabel={`Fill ${entry.name}`}
                        onPress={() => onShapeFill(entry.key)}
                        style={[
                          styles.swatch,
                          {
                            backgroundColor: entry.fill,
                            borderColor: shapeFillKey === entry.key ? theme.primary : theme.border,
                          },
                        ]}
                      />
                    ))}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={customFill ? `Custom fill ${shapeFillKey}` : 'Choose custom fill color'}
                      onPress={() => setCustomTarget('fill')}
                      style={[
                        styles.swatch,
                        styles.customSwatch,
                        {
                          borderColor: customFill ? theme.primary : theme.border,
                          backgroundColor: customFill && shapeFillKey ? shapeFillKey : theme.muted,
                        },
                      ]}
                    >
                      {!customFill && <PlusIcon size={16} color={theme.foreground} />}
                    </Pressable>
                  </View>
                  <Text style={[styles.label, { color: theme.foreground }]}>Border color</Text>
                  <View style={styles.row}>
                    {SHAPE_COLORS.map((entry) => (
                      <Pressable
                        key={entry.key}
                        accessibilityRole="radio"
                        accessibilityLabel={`Border color ${entry.name}`}
                        onPress={() => onShapeColor(entry.key)}
                        style={[
                          styles.swatch,
                          {
                            backgroundColor: entry.light,
                            borderColor: shapeColorKey === entry.key ? theme.primary : theme.border,
                          },
                        ]}
                      />
                    ))}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={customStroke ? `Custom border color ${shapeColorKey}` : 'Choose custom border color'}
                      onPress={() => setCustomTarget('stroke')}
                      style={[
                        styles.swatch,
                        styles.customSwatch,
                        {
                          borderColor: customStroke ? theme.primary : theme.border,
                          backgroundColor: customStroke ? shapeColorKey : theme.muted,
                        },
                      ]}
                    >
                      {!customStroke && <PlusIcon size={16} color={theme.foreground} />}
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  <Text style={[styles.label, { color: theme.foreground }]}>Connector style</Text>
                  <View style={styles.row}>
                    {(['line', 'arrow', 'elbow'] as ConnectorStyle[]).map((value) => (
                      <Choice key={value} label={value} selected={connectorStyle === value} theme={theme} onPress={() => onConnectorStyle(value)} />
                    ))}
                  </View>
                  <Text style={[styles.label, { color: theme.foreground }]}>Color</Text>
                  <View style={styles.row}>
                    {SHAPE_COLORS.map((entry) => (
                      <Pressable
                        key={entry.key}
                        accessibilityRole="radio"
                        accessibilityLabel={`Connector color ${entry.name}`}
                        onPress={() => onConnectorColor(entry.key)}
                        style={[
                          styles.swatch,
                          {
                            backgroundColor: entry.light,
                            borderColor: connectorColorKey === entry.key ? theme.primary : theme.border,
                          },
                        ]}
                      />
                    ))}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={customStroke ? `Custom connector color ${connectorColorKey}` : 'Choose custom connector color'}
                      onPress={() => setCustomTarget('stroke')}
                      style={[
                        styles.swatch,
                        styles.customSwatch,
                        {
                          borderColor: customStroke ? theme.primary : theme.border,
                          backgroundColor: customStroke ? connectorColorKey : theme.muted,
                        },
                      ]}
                    >
                      {!customStroke && <PlusIcon size={16} color={theme.foreground} />}
                    </Pressable>
                  </View>
                </>
              )}
              <Text style={[styles.label, { color: theme.foreground }]}>Stroke</Text>
              <View style={styles.row}>
                {widths.map((value, index) => (
                  <Choice
                    key={value}
                    label={STROKE_WIDTH_LABELS[index]}
                    selected={(shape ? shapeStrokeWidth : connectorStrokeWidth) === value}
                    theme={theme}
                    onPress={() => (shape ? onShapeStrokeWidth(value) : onConnectorStrokeWidth(value))}
                  />
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

function ShapeChoice({ label, Icon, selected, theme, onPress }: { label: string; Icon: typeof RectangleIcon; selected: boolean; theme: ThemeColors; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress} style={[styles.choice, { borderColor: selected ? theme.primary : theme.border }, selected && { backgroundColor: theme.primary }]}>
      <Icon size={22} color={selected ? theme.surface : theme.foreground} />
    </Pressable>
  );
}

function Choice({ label, selected, theme, onPress }: { label: string; selected: boolean; theme: ThemeColors; onPress: () => void }) { return <Pressable accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress} style={[styles.choice, { borderColor: selected ? theme.primary : theme.border }, selected && { backgroundColor: theme.primary }]}><Text style={{ color: selected ? theme.surface : theme.foreground }}>{label}</Text></Pressable>; }

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: spacing.md, zIndex: 25 },
  popoverLayer: { position: 'absolute', zIndex: 25 },
  sheet: { width: '100%', maxWidth: 460, borderWidth: 1, borderRadius: radii.md, padding: spacing.md },
  sheetContent: { gap: spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { ...typography.bodyStrong },
  done: { minHeight: touchTarget, minWidth: touchTarget, alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: spacing.sm },
  doneText: { ...typography.bodyStrong },
  label: { ...typography.caption },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  choice: { minWidth: touchTarget, minHeight: touchTarget, paddingHorizontal: spacing.sm, borderWidth: 1, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: touchTarget, height: touchTarget, borderRadius: radii.sm, borderWidth: 2 },
  customSwatch: { alignItems: 'center', justifyContent: 'center' },
});
