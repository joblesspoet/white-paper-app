import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  isCustomColor,
  isTableObject,
  isTextualObject,
  SHAPE_STROKE_WIDTHS,
  STICKY_COLORS,
  STICKY_FONT_SIZES,
  stickyColorValue,
  TABLE_FONT_SIZES,
  TEXT_COLORS,
  TEXT_FONT_SIZES,
  textColorValue,
  type CanvasObject,
  type ObjectStylePatch,
  type ShapeKind,
  type TableObject,
  type TextSlant,
  type TextWeight,
} from '../canvas/document';
import type { ConnectorStyle } from '../canvas/shapes';
import type { InspectorPresentation } from '../responsive/layout';
import { radii, spacing, touchTarget, typography, type ThemeColors } from '../theme';
import { ColorPicker } from './ColorPicker';
import {
  ChevronRightIcon,
  ConnectorIcon,
  DuplicateIcon,
  EditIcon,
  ElbowIcon,
  EllipseIcon,
  LineIcon,
  PlusIcon,
  RectangleIcon,
  StyleIcon,
  TrashIcon,
} from './icons';

type EditorInspectorPanelProps = {
  theme: ThemeColors;
  dark: boolean;
  presentation: Extract<InspectorPresentation, 'docked' | 'overlay' | 'edge-tab'>;
  width: number;
  selectedObjects: CanvasObject[];
  onToggleOpen: () => void;
  onEditTextObject: (id: string) => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
  onUpdateObjectStyle: (id: string, patch: ObjectStylePatch) => void;
  onTableAction?: (id: string, action: 'add-row' | 'remove-row' | 'add-col' | 'remove-col') => void;
};

const SHAPES: ReadonlyArray<{ kind: ShapeKind; label: string; Icon: typeof RectangleIcon }> = [
  { kind: 'rectangle', label: 'Rectangle', Icon: RectangleIcon },
  { kind: 'ellipse', label: 'Ellipse', Icon: EllipseIcon },
  { kind: 'line', label: 'Line', Icon: LineIcon },
];

const CONNECTORS: ReadonlyArray<{ style: ConnectorStyle; label: string; Icon: typeof ConnectorIcon }> = [
  { style: 'arrow', label: 'Arrow', Icon: ConnectorIcon },
  { style: 'line', label: 'Line', Icon: LineIcon },
  { style: 'elbow', label: 'Elbow', Icon: ElbowIcon },
];

function objectTypeLabel(type: CanvasObject['type']): string {
  switch (type) {
    case 'sticky':
      return 'Sticky Note';
    case 'text':
      return 'Text Block';
    case 'shape':
      return 'Shape';
    case 'connector':
      return 'Connector';
    case 'image':
      return 'Image';
    case 'table':
      return 'Table';
    case 'math':
      return 'Math Formula';
  }
}

export function EditorInspectorPanel({
  theme,
  dark,
  presentation,
  width,
  selectedObjects,
  onToggleOpen,
  onEditTextObject,
  onDuplicateSelected,
  onDeleteSelected,
  onUpdateObjectStyle,
  onTableAction,
}: EditorInspectorPanelProps) {
  const [customPickerTarget, setCustomPickerTarget] = useState<'color' | 'fill' | null>(null);

  if (selectedObjects.length === 0) return null;

  const singleObject = selectedObjects.length === 1 ? selectedObjects[0] : null;
  const isTextual = singleObject ? isTextualObject(singleObject) : false;

  if (presentation === 'edge-tab') {
    return (
      <View style={styles.edgeTabContainer} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open object inspector"
          accessibilityHint="Expands the right-side inspector panel for selected objects"
          onPress={onToggleOpen}
          style={({ pressed }) => [
            styles.edgeTab,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
            pressed && styles.pressed,
          ]}
        >
          <StyleIcon size={18} color={theme.primary} />
          <Text style={[styles.edgeTabBadge, { color: theme.foreground }]}>
            {selectedObjects.length}
          </Text>
        </Pressable>
      </View>
    );
  }

  const headerTitle = singleObject
    ? 'Object Inspector'
    : 'Multi-Object Inspector';
  const headerBadge = singleObject
    ? objectTypeLabel(singleObject.type)
    : `${selectedObjects.length} Selected`;

  const renderSingleObjectStyleControls = (object: CanvasObject) => {
    if (isTextualObject(object)) {
      const sticky = object.type === 'sticky';
      const sizes = sticky ? STICKY_FONT_SIZES : TEXT_FONT_SIZES;
      const custom = isCustomColor(object.colorKey);
      const pickerSeed = sticky
        ? stickyColorValue(object.colorKey)
        : textColorValue(object.colorKey, dark);

      return (
        <>
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.foreground }]}>
              {sticky ? 'Note Color' : 'Text Color'}
            </Text>
            <View style={styles.swatchRow}>
              {sticky
                ? STICKY_COLORS.map((entry) => {
                    const selected = !custom && entry.key === object.colorKey;
                    return (
                      <Pressable
                        key={entry.key}
                        accessibilityRole="button"
                        accessibilityLabel={`${entry.name} sticky note`}
                        accessibilityState={{ selected }}
                        onPress={() => onUpdateObjectStyle(object.id, { colorKey: entry.key })}
                        style={styles.swatchButton}
                      >
                        <View
                          style={[
                            styles.swatch,
                            {
                              backgroundColor: entry.fill,
                              borderColor: selected ? theme.primary : theme.border,
                              borderWidth: selected ? 3 : 1,
                            },
                          ]}
                        />
                      </Pressable>
                    );
                  })
                : TEXT_COLORS.map((entry) => {
                    const selected = !custom && entry.key === object.colorKey;
                    const swatchColor = dark ? entry.dark : entry.light;
                    return (
                      <Pressable
                        key={entry.key}
                        accessibilityRole="button"
                        accessibilityLabel={`${entry.name} text`}
                        accessibilityState={{ selected }}
                        onPress={() => onUpdateObjectStyle(object.id, { colorKey: entry.key })}
                        style={styles.swatchButton}
                      >
                        <View
                          style={[
                            styles.swatch,
                            {
                              backgroundColor: swatchColor,
                              borderColor: selected ? theme.primary : theme.border,
                              borderWidth: selected ? 3 : 1,
                            },
                          ]}
                        />
                      </Pressable>
                    );
                  })}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={custom ? `Custom colour ${object.colorKey}` : 'Custom colour'}
                accessibilityState={{ selected: custom || customPickerTarget === 'color' }}
                onPress={() =>
                  setCustomPickerTarget((current) => (current === 'color' ? null : 'color'))
                }
                style={styles.swatchButton}
              >
                <View
                  style={[
                    styles.swatch,
                    styles.customSwatch,
                    {
                      backgroundColor: custom ? object.colorKey : theme.muted,
                      borderColor:
                        custom || customPickerTarget === 'color' ? theme.primary : theme.border,
                      borderWidth: custom || customPickerTarget === 'color' ? 3 : 1,
                    },
                  ]}
                >
                  {!custom && <PlusIcon size={14} color={theme.foreground} />}
                </View>
              </Pressable>
            </View>
            {customPickerTarget === 'color' && (
              <ColorPicker
                theme={theme}
                value={pickerSeed}
                background={theme.background}
                checkContrast={!sticky}
                onChange={(hex) => onUpdateObjectStyle(object.id, { colorKey: hex })}
                onClose={() => setCustomPickerTarget(null)}
              />
            )}
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.foreground }]}>Typography</Text>
            <View style={styles.chipRow}>
              {sizes.map((size) => {
                const selected = size === object.fontSize;
                return (
                  <Pressable
                    key={size}
                    accessibilityRole="button"
                    accessibilityLabel={`Font size ${size}`}
                    accessibilityState={{ selected }}
                    onPress={() => onUpdateObjectStyle(object.id, { fontSize: size })}
                    style={[
                      styles.chip,
                      {
                        borderColor: selected ? theme.primary : theme.border,
                        backgroundColor: selected ? theme.muted : theme.surface,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipLabel,
                        { color: selected ? theme.primary : theme.foreground },
                      ]}
                    >
                      {size}pt
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.chipRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Bold"
                accessibilityState={{ selected: object.fontWeight === 'bold' }}
                onPress={() => {
                  const nextWeight: TextWeight =
                    object.fontWeight === 'bold' ? 'normal' : 'bold';
                  onUpdateObjectStyle(object.id, { fontWeight: nextWeight });
                }}
                style={[
                  styles.chip,
                  {
                    borderColor: object.fontWeight === 'bold' ? theme.primary : theme.border,
                    backgroundColor:
                      object.fontWeight === 'bold' ? theme.muted : theme.surface,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipLabel,
                    styles.boldPreview,
                    {
                      color:
                        object.fontWeight === 'bold' ? theme.primary : theme.foreground,
                    },
                  ]}
                >
                  B
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Italic"
                accessibilityState={{ selected: object.fontStyle === 'italic' }}
                onPress={() => {
                  const nextSlant: TextSlant =
                    object.fontStyle === 'italic' ? 'normal' : 'italic';
                  onUpdateObjectStyle(object.id, { fontStyle: nextSlant });
                }}
                style={[
                  styles.chip,
                  {
                    borderColor: object.fontStyle === 'italic' ? theme.primary : theme.border,
                    backgroundColor:
                      object.fontStyle === 'italic' ? theme.muted : theme.surface,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipLabel,
                    styles.italicPreview,
                    {
                      color:
                        object.fontStyle === 'italic' ? theme.primary : theme.foreground,
                    },
                  ]}
                >
                  I
                </Text>
              </Pressable>
            </View>
          </View>
        </>
      );
    }

    if (object.type === 'shape') {
      const customStroke = isCustomColor(object.colorKey);
      const customFill = Boolean(object.fillKey && isCustomColor(object.fillKey));
      return (
        <>
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.foreground }]}>Shape Type</Text>
            <View style={styles.chipRow}>
              {SHAPES.map(({ kind, label, Icon }) => {
                const selected = object.shape === kind;
                const tint = selected ? theme.primary : theme.foreground;
                return (
                  <Pressable
                    key={kind}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    accessibilityState={{ selected }}
                    onPress={() => onUpdateObjectStyle(object.id, { shape: kind })}
                    style={[
                      styles.chip,
                      {
                        borderColor: selected ? theme.primary : theme.border,
                        backgroundColor: selected ? theme.muted : theme.surface,
                      },
                    ]}
                  >
                    <Icon size={16} color={tint} />
                    <Text style={[styles.chipLabel, { color: tint }]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {object.shape !== 'line' && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: theme.foreground }]}>Fill</Text>
              <View style={styles.swatchRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="No fill"
                  accessibilityState={{ selected: object.fillKey === null }}
                  onPress={() => onUpdateObjectStyle(object.id, { fillKey: null })}
                  style={[
                    styles.chip,
                    {
                      borderColor: object.fillKey === null ? theme.primary : theme.border,
                      backgroundColor: object.fillKey === null ? theme.muted : theme.surface,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipLabel,
                      { color: object.fillKey === null ? theme.primary : theme.foreground },
                    ]}
                  >
                    None
                  </Text>
                </Pressable>
                {STICKY_COLORS.map((entry) => {
                  const selected = object.fillKey === entry.key;
                  return (
                    <Pressable
                      key={entry.key}
                      accessibilityRole="button"
                      accessibilityLabel={`${entry.name} fill`}
                      accessibilityState={{ selected }}
                      onPress={() => onUpdateObjectStyle(object.id, { fillKey: entry.key })}
                      style={styles.swatchButton}
                    >
                      <View
                        style={[
                          styles.swatch,
                          {
                            backgroundColor: entry.fill,
                            borderColor: selected ? theme.primary : theme.border,
                            borderWidth: selected ? 3 : 1,
                          },
                        ]}
                      />
                    </Pressable>
                  );
                })}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    customFill ? `Custom fill ${object.fillKey}` : 'Custom fill colour'
                  }
                  accessibilityState={{ selected: customFill || customPickerTarget === 'fill' }}
                  onPress={() =>
                    setCustomPickerTarget((current) => (current === 'fill' ? null : 'fill'))
                  }
                  style={styles.swatchButton}
                >
                  <View
                    style={[
                      styles.swatch,
                      styles.customSwatch,
                      {
                        backgroundColor:
                          customFill && object.fillKey ? object.fillKey : theme.muted,
                        borderColor:
                          customFill || customPickerTarget === 'fill'
                            ? theme.primary
                            : theme.border,
                        borderWidth: customFill || customPickerTarget === 'fill' ? 3 : 1,
                      },
                    ]}
                  >
                    {!customFill && <PlusIcon size={14} color={theme.foreground} />}
                  </View>
                </Pressable>
              </View>
              {customPickerTarget === 'fill' && (
                <ColorPicker
                  theme={theme}
                  value={
                    object.fillKey ? stickyColorValue(object.fillKey) : STICKY_COLORS[0].fill
                  }
                  background={theme.background}
                  checkContrast={false}
                  onChange={(hex) => onUpdateObjectStyle(object.id, { fillKey: hex })}
                  onClose={() => setCustomPickerTarget(null)}
                />
              )}
            </View>
          )}

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.foreground }]}>Border Color</Text>
            <View style={styles.swatchRow}>
              {TEXT_COLORS.map((entry) => {
                const selected = !customStroke && entry.key === object.colorKey;
                return (
                  <Pressable
                    key={entry.key}
                    accessibilityRole="button"
                    accessibilityLabel={`${entry.name} stroke`}
                    accessibilityState={{ selected }}
                    onPress={() => onUpdateObjectStyle(object.id, { colorKey: entry.key })}
                    style={styles.swatchButton}
                  >
                    <View
                      style={[
                        styles.swatch,
                        {
                          backgroundColor: dark ? entry.dark : entry.light,
                          borderColor: selected ? theme.primary : theme.border,
                          borderWidth: selected ? 3 : 1,
                        },
                      ]}
                    />
                  </Pressable>
                );
              })}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  customStroke ? `Custom stroke ${object.colorKey}` : 'Custom stroke colour'
                }
                accessibilityState={{ selected: customStroke || customPickerTarget === 'color' }}
                onPress={() =>
                  setCustomPickerTarget((current) => (current === 'color' ? null : 'color'))
                }
                style={styles.swatchButton}
              >
                <View
                  style={[
                    styles.swatch,
                    styles.customSwatch,
                    {
                      backgroundColor: customStroke ? object.colorKey : theme.muted,
                      borderColor:
                        customStroke || customPickerTarget === 'color'
                          ? theme.primary
                          : theme.border,
                      borderWidth: customStroke || customPickerTarget === 'color' ? 3 : 1,
                    },
                  ]}
                >
                  {!customStroke && <PlusIcon size={14} color={theme.foreground} />}
                </View>
              </Pressable>
            </View>
            {customPickerTarget === 'color' && (
              <ColorPicker
                theme={theme}
                value={textColorValue(object.colorKey, dark)}
                background={theme.background}
                onChange={(hex) => onUpdateObjectStyle(object.id, { colorKey: hex })}
                onClose={() => setCustomPickerTarget(null)}
              />
            )}
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.foreground }]}>Stroke Width</Text>
            <View style={styles.chipRow}>
              {SHAPE_STROKE_WIDTHS.map((strokeWidth) => {
                const selected = strokeWidth === object.strokeWidth;
                return (
                  <Pressable
                    key={strokeWidth}
                    accessibilityRole="button"
                    accessibilityLabel={`Stroke width ${strokeWidth}`}
                    accessibilityState={{ selected }}
                    onPress={() => onUpdateObjectStyle(object.id, { strokeWidth })}
                    style={[
                      styles.chip,
                      {
                        borderColor: selected ? theme.primary : theme.border,
                        backgroundColor: selected ? theme.muted : theme.surface,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipLabel,
                        { color: selected ? theme.primary : theme.foreground },
                      ]}
                    >
                      {strokeWidth}px
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.foreground }]}>Measurements</Text>
            <View style={styles.chipRow}>
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: Boolean(object.showMeasurements) }}
                accessibilityLabel="Show geometric measurements"
                onPress={() =>
                  onUpdateObjectStyle(object.id, {
                    showMeasurements: !object.showMeasurements,
                  })
                }
                style={[
                  styles.chip,
                  {
                    borderColor: object.showMeasurements ? theme.primary : theme.border,
                    backgroundColor: object.showMeasurements ? theme.muted : theme.surface,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipLabel,
                    { color: object.showMeasurements ? theme.primary : theme.foreground },
                  ]}
                >
                  {object.showMeasurements ? 'On' : 'Off'}
                </Text>
              </Pressable>
            </View>
          </View>
        </>
      );
    }

    if (isTableObject(object)) {
      const table = object as TableObject;
      return (
        <>
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.foreground }]}>
              Rows & Columns ({table.rows}×{table.columns})
            </Text>
            <View style={styles.chipRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add table row"
                onPress={() => onTableAction?.(table.id, 'add-row')}
                style={[styles.chip, { borderColor: theme.border, backgroundColor: theme.surface }]}
              >
                <Text style={[styles.chipLabel, { color: theme.foreground }]}>+ Row</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove table row"
                onPress={() => onTableAction?.(table.id, 'remove-row')}
                style={[styles.chip, { borderColor: theme.border, backgroundColor: theme.surface }]}
              >
                <Text style={[styles.chipLabel, { color: theme.foreground }]}>− Row</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add table column"
                onPress={() => onTableAction?.(table.id, 'add-col')}
                style={[styles.chip, { borderColor: theme.border, backgroundColor: theme.surface }]}
              >
                <Text style={[styles.chipLabel, { color: theme.foreground }]}>+ Col</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove table column"
                onPress={() => onTableAction?.(table.id, 'remove-col')}
                style={[styles.chip, { borderColor: theme.border, backgroundColor: theme.surface }]}
              >
                <Text style={[styles.chipLabel, { color: theme.foreground }]}>− Col</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.foreground }]}>Header</Text>
            <View style={styles.chipRow}>
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: table.hasHeaderRow }}
                onPress={() =>
                  onUpdateObjectStyle(table.id, { hasHeaderRow: !table.hasHeaderRow })
                }
                style={[
                  styles.chip,
                  {
                    borderColor: table.hasHeaderRow ? theme.primary : theme.border,
                    backgroundColor: table.hasHeaderRow ? theme.muted : theme.surface,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipLabel,
                    { color: table.hasHeaderRow ? theme.primary : theme.foreground },
                  ]}
                >
                  Header Row
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: table.fillHeader }}
                onPress={() =>
                  onUpdateObjectStyle(table.id, { fillHeader: !table.fillHeader })
                }
                style={[
                  styles.chip,
                  {
                    borderColor: table.fillHeader ? theme.primary : theme.border,
                    backgroundColor: table.fillHeader ? theme.muted : theme.surface,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipLabel,
                    { color: table.fillHeader ? theme.primary : theme.foreground },
                  ]}
                >
                  Fill Header
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.foreground }]}>Font Size</Text>
            <View style={styles.chipRow}>
              {TABLE_FONT_SIZES.map((fs) => {
                const selected = fs === table.fontSize;
                return (
                  <Pressable
                    key={fs}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => onUpdateObjectStyle(table.id, { fontSize: fs })}
                    style={[
                      styles.chip,
                      {
                        borderColor: selected ? theme.primary : theme.border,
                        backgroundColor: selected ? theme.muted : theme.surface,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipLabel,
                        { color: selected ? theme.primary : theme.foreground },
                      ]}
                    >
                      {fs}pt
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.foreground }]}>Color</Text>
            <View style={styles.swatchRow}>
              {TEXT_COLORS.map((entry) => {
                const selected = entry.key === table.colorKey;
                const swatchColor = dark ? entry.dark : entry.light;
                return (
                  <Pressable
                    key={entry.key}
                    accessibilityRole="button"
                    accessibilityLabel={`Table color ${entry.name}`}
                    onPress={() => onUpdateObjectStyle(table.id, { colorKey: entry.key })}
                    style={styles.swatchButton}
                  >
                    <View
                      style={[
                        styles.swatch,
                        {
                          backgroundColor: swatchColor,
                          borderColor: selected ? theme.primary : theme.border,
                          borderWidth: selected ? 3 : 1,
                        },
                      ]}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>
        </>
      );
    }

    if (object.type === 'connector') {
      const customStroke = isCustomColor(object.colorKey);
      return (
        <>
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.foreground }]}>Connector Style</Text>
            <View style={styles.chipRow}>
              {CONNECTORS.map(({ style, label, Icon }) => {
                const selected = object.style === style;
                const tint = selected ? theme.primary : theme.foreground;
                return (
                  <Pressable
                    key={style}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    accessibilityState={{ selected }}
                    onPress={() => onUpdateObjectStyle(object.id, { style })}
                    style={[
                      styles.chip,
                      {
                        borderColor: selected ? theme.primary : theme.border,
                        backgroundColor: selected ? theme.muted : theme.surface,
                      },
                    ]}
                  >
                    <Icon size={16} color={tint} />
                    <Text style={[styles.chipLabel, { color: tint }]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.foreground }]}>Color</Text>
            <View style={styles.swatchRow}>
              {TEXT_COLORS.map((entry) => {
                const selected = !customStroke && entry.key === object.colorKey;
                return (
                  <Pressable
                    key={entry.key}
                    accessibilityRole="button"
                    accessibilityLabel={`${entry.name} stroke`}
                    accessibilityState={{ selected }}
                    onPress={() => onUpdateObjectStyle(object.id, { colorKey: entry.key })}
                    style={styles.swatchButton}
                  >
                    <View
                      style={[
                        styles.swatch,
                        {
                          backgroundColor: dark ? entry.dark : entry.light,
                          borderColor: selected ? theme.primary : theme.border,
                          borderWidth: selected ? 3 : 1,
                        },
                      ]}
                    />
                  </Pressable>
                );
              })}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  customStroke ? `Custom stroke ${object.colorKey}` : 'Custom stroke colour'
                }
                accessibilityState={{ selected: customStroke || customPickerTarget === 'color' }}
                onPress={() =>
                  setCustomPickerTarget((current) => (current === 'color' ? null : 'color'))
                }
                style={styles.swatchButton}
              >
                <View
                  style={[
                    styles.swatch,
                    styles.customSwatch,
                    {
                      backgroundColor: customStroke ? object.colorKey : theme.muted,
                      borderColor:
                        customStroke || customPickerTarget === 'color'
                          ? theme.primary
                          : theme.border,
                      borderWidth: customStroke || customPickerTarget === 'color' ? 3 : 1,
                    },
                  ]}
                >
                  {!customStroke && <PlusIcon size={14} color={theme.foreground} />}
                </View>
              </Pressable>
            </View>
            {customPickerTarget === 'color' && (
              <ColorPicker
                theme={theme}
                value={textColorValue(object.colorKey, dark)}
                background={theme.background}
                onChange={(hex) => onUpdateObjectStyle(object.id, { colorKey: hex })}
                onClose={() => setCustomPickerTarget(null)}
              />
            )}
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.foreground }]}>Stroke Width</Text>
            <View style={styles.chipRow}>
              {SHAPE_STROKE_WIDTHS.map((strokeWidth) => {
                const selected = strokeWidth === object.strokeWidth;
                return (
                  <Pressable
                    key={strokeWidth}
                    accessibilityRole="button"
                    accessibilityLabel={`Stroke width ${strokeWidth}`}
                    accessibilityState={{ selected }}
                    onPress={() => onUpdateObjectStyle(object.id, { strokeWidth })}
                    style={[
                      styles.chip,
                      {
                        borderColor: selected ? theme.primary : theme.border,
                        backgroundColor: selected ? theme.muted : theme.surface,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipLabel,
                        { color: selected ? theme.primary : theme.foreground },
                      ]}
                    >
                      {strokeWidth}px
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </>
      );
    }

    return null;
  };

  return (
    <View
      accessibilityLabel={headerTitle}
      style={[
        styles.panel,
        presentation === 'overlay' ? styles.overlayPanel : styles.dockedPanel,
        {
          width,
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
      ]}
    >
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <View style={styles.headerTextWrap}>
          <Text style={[styles.headerTitle, { color: theme.foreground }]} numberOfLines={1}>
            {headerTitle}
          </Text>
          <View style={[styles.badge, { backgroundColor: theme.primary + '1A' }]}>
            <Text style={[styles.badgeText, { color: theme.primary }]}>{headerBadge}</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Collapse inspector"
          onPress={onToggleOpen}
          style={({ pressed }) => [styles.collapseButton, pressed && styles.pressed]}
        >
          <ChevronRightIcon size={18} color={theme.foreground} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Quick actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.foreground }]}>Quick Actions</Text>
          <View style={styles.actionRow}>
            {singleObject && isTextual && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit text"
                onPress={() => onEditTextObject(singleObject.id)}
                style={({ pressed }) => [
                  styles.actionButton,
                  { borderColor: theme.border, backgroundColor: theme.background },
                  pressed && styles.pressed,
                ]}
              >
                <EditIcon size={16} color={theme.foreground} />
                <Text style={[styles.actionLabel, { color: theme.foreground }]}>Edit</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                selectedObjects.length === 1
                  ? 'Duplicate selected object'
                  : 'Duplicate selected objects'
              }
              onPress={onDuplicateSelected}
              style={({ pressed }) => [
                styles.actionButton,
                { borderColor: theme.border, backgroundColor: theme.background },
                pressed && styles.pressed,
              ]}
            >
              <DuplicateIcon size={16} color={theme.foreground} />
              <Text style={[styles.actionLabel, { color: theme.foreground }]}>Duplicate</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                selectedObjects.length === 1
                  ? 'Delete selected object'
                  : 'Delete selected objects'
              }
              onPress={onDeleteSelected}
              style={({ pressed }) => [
                styles.actionButton,
                { borderColor: theme.destructive + '40', backgroundColor: theme.destructive + '12' },
                pressed && styles.pressed,
              ]}
            >
              <TrashIcon size={16} color={theme.destructive} />
              <Text style={[styles.actionLabel, { color: theme.destructive }]}>Delete</Text>
            </Pressable>
          </View>
        </View>

        {singleObject ? (
          <>
            {renderSingleObjectStyleControls(singleObject)}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: theme.foreground }]}>Dimensions</Text>
              <View
                style={[
                  styles.metaCard,
                  { backgroundColor: theme.background, borderColor: theme.border },
                ]}
              >
                <View style={styles.metaItem}>
                  <Text style={[styles.metaKey, { color: theme.foreground }]}>Size</Text>
                  <Text style={[styles.metaValue, { color: theme.foreground }]}>
                    {Math.round(singleObject.width)} × {Math.round(singleObject.height)} pt
                  </Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={[styles.metaKey, { color: theme.foreground }]}>Rotation</Text>
                  <Text style={[styles.metaValue, { color: theme.foreground }]}>
                    {Math.round(singleObject.rotation)}°
                  </Text>
                </View>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.foreground }]}>Selection Summary</Text>
            <View
              style={[
                styles.metaCard,
                { backgroundColor: theme.background, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.multiHint, { color: theme.foreground }]}>
                {selectedObjects.length} objects selected. Drag on the canvas to move the group together, or duplicate and delete them in a single step.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderLeftWidth: 1,
  },
  dockedPanel: {
    height: '100%',
  },
  overlayPanel: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 25,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  edgeTabContainer: {
    position: 'absolute',
    right: 0,
    top: spacing.lg,
    zIndex: 24,
  },
  edgeTab: {
    minWidth: touchTarget,
    minHeight: touchTarget * 2,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderTopLeftRadius: radii.md,
    borderBottomLeftRadius: radii.md,
    borderWidth: 1,
    borderRightWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  edgeTabBadge: {
    ...typography.caption,
    fontWeight: '700',
    fontSize: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    gap: spacing.xs,
  },
  headerTextWrap: {
    flex: 1,
    gap: 4,
  },
  headerTitle: {
    ...typography.bodyStrong,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  badgeText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '700',
  },
  collapseButton: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  section: {
    gap: spacing.xs,
  },
  sectionLabel: {
    ...typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    opacity: 0.7,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  actionButton: {
    flex: 1,
    minWidth: 76,
    minHeight: touchTarget,
    borderRadius: radii.sm,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
  },
  actionLabel: {
    ...typography.caption,
    fontWeight: '600',
  },
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
  },
  swatchButton: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  customSwatch: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    minWidth: touchTarget,
    minHeight: touchTarget,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  chipLabel: {
    ...typography.caption,
    fontWeight: '600',
  },
  boldPreview: {
    fontWeight: '700',
  },
  italicPreview: {
    fontStyle: 'italic',
  },
  metaCard: {
    borderRadius: radii.sm,
    borderWidth: 1,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaKey: {
    ...typography.caption,
    opacity: 0.7,
  },
  metaValue: {
    ...typography.caption,
    fontWeight: '600',
  },
  multiHint: {
    ...typography.caption,
    lineHeight: 18,
    opacity: 0.85,
  },
  pressed: {
    opacity: 0.65,
  },
});
