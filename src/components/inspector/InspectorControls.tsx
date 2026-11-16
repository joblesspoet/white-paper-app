import { memo, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  isCustomColor,
  SHAPE_STROKE_WIDTHS,
  STICKY_COLORS,
  STICKY_FONT_SIZES,
  stickyColorValue,
  TABLE_FONT_SIZES,
  TEXT_COLORS,
  TEXT_FONT_SIZES,
  textColorValue,
  type ConnectorObject,
  type ObjectStylePatch,
  type ShapeKind,
  type ShapeObject,
  type TableObject,
  type TextSlant,
  type TextualObject,
  type TextWeight,
} from '../../canvas/document';
import type { ConnectorStyle } from '../../canvas/shapes';
import type { ThemeColors } from '../../theme';
import { ColorPicker } from '../ColorPicker';
import { editorInspectorStyles as styles } from '../EditorInspectorPanel.styles';
import {
  ConnectorIcon,
  ElbowIcon,
  EllipseIcon,
  LineIcon,
  PlusIcon,
  RectangleIcon,
} from '../icons';

const SHAPES: ReadonlyArray<{ kind: ShapeKind; label: string; Icon: typeof RectangleIcon }> = [
  { kind: 'rectangle', label: 'Rectangle', Icon: RectangleIcon },
  { kind: 'ellipse', label: 'Ellipse', Icon: EllipseIcon },
  { kind: 'line', label: 'Line', Icon: LineIcon },
];

const CONNECTORS: ReadonlyArray<{
  style: ConnectorStyle;
  label: string;
  Icon: typeof ConnectorIcon;
}> = [
  { style: 'arrow', label: 'Arrow', Icon: ConnectorIcon },
  { style: 'line', label: 'Line', Icon: LineIcon },
  { style: 'elbow', label: 'Elbow', Icon: ElbowIcon },
];

const TextColorSwatches = memo(function TextColorSwatches({
  theme,
  dark,
  activeKey,
  pickerOpen,
  accessibilityPrefix,
  onSelectColor,
  onToggleCustomPicker,
  onClosePicker,
}: {
  theme: ThemeColors;
  dark: boolean;
  activeKey: string;
  pickerOpen: boolean;
  accessibilityPrefix: string;
  onSelectColor: (key: string) => void;
  onToggleCustomPicker?: () => void;
  onClosePicker?: () => void;
}) {
  const custom = isCustomColor(activeKey);
  return (
    <>
      <View style={styles.swatchRow}>
        {TEXT_COLORS.map((entry) => {
          const selected = !custom && entry.key === activeKey;
          return (
            <Pressable
              key={entry.key}
              accessibilityRole="button"
              accessibilityLabel={`${entry.name} ${accessibilityPrefix}`}
              accessibilityState={{ selected }}
              onPress={() => onSelectColor(entry.key)}
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
        {onToggleCustomPicker && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              custom
                ? `Custom ${accessibilityPrefix} ${activeKey}`
                : `Custom ${accessibilityPrefix} colour`
            }
            accessibilityState={{ selected: custom || pickerOpen }}
            onPress={onToggleCustomPicker}
            style={styles.swatchButton}
          >
            <View
              style={[
                styles.swatch,
                styles.customSwatch,
                {
                  backgroundColor: custom ? activeKey : theme.muted,
                  borderColor: custom || pickerOpen ? theme.primary : theme.border,
                  borderWidth: custom || pickerOpen ? 3 : 1,
                },
              ]}
            >
              {!custom && <PlusIcon size={14} color={theme.foreground} />}
            </View>
          </Pressable>
        )}
      </View>
      {pickerOpen && onClosePicker && (
        <ColorPicker
          theme={theme}
          value={textColorValue(activeKey, dark)}
          background={theme.background}
          onChange={onSelectColor}
          onClose={onClosePicker}
        />
      )}
    </>
  );
});

const ChipButton = memo(function ChipButton({
  label,
  accessibilityLabel,
  selected,
  theme,
  icon,
  isSwitch,
  onPress,
}: {
  label: string;
  accessibilityLabel?: string;
  selected: boolean;
  theme: ThemeColors;
  icon?: ReactNode;
  isSwitch?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={isSwitch ? 'switch' : 'button'}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={isSwitch ? { checked: selected } : { selected }}
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderColor: selected ? theme.primary : theme.border,
          backgroundColor: selected ? theme.muted : theme.surface,
        },
      ]}
    >
      {icon}
      <Text style={[styles.chipLabel, { color: selected ? theme.primary : theme.foreground }]}>
        {label}
      </Text>
    </Pressable>
  );
});

export const InspectorTextualSection = memo(function InspectorTextualSection({
  object,
  theme,
  dark,
  customPickerTarget,
  onTogglePicker,
  onClosePicker,
  onUpdateStyle,
}: {
  object: TextualObject;
  theme: ThemeColors;
  dark: boolean;
  customPickerTarget: 'color' | 'fill' | null;
  onTogglePicker: (target: 'color' | 'fill') => void;
  onClosePicker: () => void;
  onUpdateStyle: (id: string, patch: ObjectStylePatch) => void;
}) {
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
        {sticky ? (
          <>
            <View style={styles.swatchRow}>
              {STICKY_COLORS.map((entry) => {
                const selected = !custom && entry.key === object.colorKey;
                return (
                  <Pressable
                    key={entry.key}
                    accessibilityRole="button"
                    accessibilityLabel={`${entry.name} sticky note`}
                    accessibilityState={{ selected }}
                    onPress={() => onUpdateStyle(object.id, { colorKey: entry.key })}
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
                  custom ? `Custom colour ${object.colorKey}` : 'Custom colour'
                }
                accessibilityState={{ selected: custom || customPickerTarget === 'color' }}
                onPress={() => onTogglePicker('color')}
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
                checkContrast={false}
                onChange={(hex) => onUpdateStyle(object.id, { colorKey: hex })}
                onClose={onClosePicker}
              />
            )}
          </>
        ) : (
          <TextColorSwatches
            theme={theme}
            dark={dark}
            activeKey={object.colorKey}
            pickerOpen={customPickerTarget === 'color'}
            accessibilityPrefix="text"
            onSelectColor={(key) => onUpdateStyle(object.id, { colorKey: key })}
            onToggleCustomPicker={() => onTogglePicker('color')}
            onClosePicker={onClosePicker}
          />
        )}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: theme.foreground }]}>Typography</Text>
        <View style={styles.chipRow}>
          {sizes.map((size) => (
            <ChipButton
              key={size}
              label={`${size}pt`}
              accessibilityLabel={`Font size ${size}`}
              selected={size === object.fontSize}
              theme={theme}
              onPress={() => onUpdateStyle(object.id, { fontSize: size })}
            />
          ))}
        </View>
        <View style={styles.chipRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Bold"
            accessibilityState={{ selected: object.fontWeight === 'bold' }}
            onPress={() => {
              const nextWeight: TextWeight =
                object.fontWeight === 'bold' ? 'normal' : 'bold';
              onUpdateStyle(object.id, { fontWeight: nextWeight });
            }}
            style={[
              styles.chip,
              {
                borderColor: object.fontWeight === 'bold' ? theme.primary : theme.border,
                backgroundColor: object.fontWeight === 'bold' ? theme.muted : theme.surface,
              },
            ]}
          >
            <Text
              style={[
                styles.chipLabel,
                styles.boldPreview,
                { color: object.fontWeight === 'bold' ? theme.primary : theme.foreground },
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
              onUpdateStyle(object.id, { fontStyle: nextSlant });
            }}
            style={[
              styles.chip,
              {
                borderColor: object.fontStyle === 'italic' ? theme.primary : theme.border,
                backgroundColor: object.fontStyle === 'italic' ? theme.muted : theme.surface,
              },
            ]}
          >
            <Text
              style={[
                styles.chipLabel,
                styles.italicPreview,
                { color: object.fontStyle === 'italic' ? theme.primary : theme.foreground },
              ]}
            >
              I
            </Text>
          </Pressable>
        </View>
      </View>
    </>
  );
});

export const InspectorShapeSection = memo(function InspectorShapeSection({
  object,
  theme,
  dark,
  customPickerTarget,
  onTogglePicker,
  onClosePicker,
  onUpdateStyle,
}: {
  object: ShapeObject;
  theme: ThemeColors;
  dark: boolean;
  customPickerTarget: 'color' | 'fill' | null;
  onTogglePicker: (target: 'color' | 'fill') => void;
  onClosePicker: () => void;
  onUpdateStyle: (id: string, patch: ObjectStylePatch) => void;
}) {
  const customFill = Boolean(object.fillKey && isCustomColor(object.fillKey));

  return (
    <>
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: theme.foreground }]}>Shape Type</Text>
        <View style={styles.chipRow}>
          {SHAPES.map(({ kind, label, Icon }) => {
            const selected = object.shape === kind;
            return (
              <ChipButton
                key={kind}
                label={label}
                selected={selected}
                theme={theme}
                icon={<Icon size={16} color={selected ? theme.primary : theme.foreground} />}
                onPress={() => onUpdateStyle(object.id, { shape: kind })}
              />
            );
          })}
        </View>
      </View>

      {object.shape !== 'line' && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.foreground }]}>Fill</Text>
          <View style={styles.swatchRow}>
            <ChipButton
              label="None"
              accessibilityLabel="No fill"
              selected={object.fillKey === null}
              theme={theme}
              onPress={() => onUpdateStyle(object.id, { fillKey: null })}
            />
            {STICKY_COLORS.map((entry) => {
              const selected = object.fillKey === entry.key;
              return (
                <Pressable
                  key={entry.key}
                  accessibilityRole="button"
                  accessibilityLabel={`${entry.name} fill`}
                  accessibilityState={{ selected }}
                  onPress={() => onUpdateStyle(object.id, { fillKey: entry.key })}
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
              onPress={() => onTogglePicker('fill')}
              style={styles.swatchButton}
            >
              <View
                style={[
                  styles.swatch,
                  styles.customSwatch,
                  {
                    backgroundColor: customFill && object.fillKey ? object.fillKey : theme.muted,
                    borderColor:
                      customFill || customPickerTarget === 'fill' ? theme.primary : theme.border,
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
              value={object.fillKey ? stickyColorValue(object.fillKey) : STICKY_COLORS[0].fill}
              background={theme.background}
              checkContrast={false}
              onChange={(hex) => onUpdateStyle(object.id, { fillKey: hex })}
              onClose={onClosePicker}
            />
          )}
        </View>
      )}

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: theme.foreground }]}>Border Color</Text>
        <TextColorSwatches
          theme={theme}
          dark={dark}
          activeKey={object.colorKey}
          pickerOpen={customPickerTarget === 'color'}
          accessibilityPrefix="stroke"
          onSelectColor={(key) => onUpdateStyle(object.id, { colorKey: key })}
          onToggleCustomPicker={() => onTogglePicker('color')}
          onClosePicker={onClosePicker}
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: theme.foreground }]}>Stroke Width</Text>
        <View style={styles.chipRow}>
          {SHAPE_STROKE_WIDTHS.map((strokeWidth) => (
            <ChipButton
              key={strokeWidth}
              label={`${strokeWidth}px`}
              accessibilityLabel={`Stroke width ${strokeWidth}`}
              selected={strokeWidth === object.strokeWidth}
              theme={theme}
              onPress={() => onUpdateStyle(object.id, { strokeWidth })}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: theme.foreground }]}>Measurements</Text>
        <View style={styles.chipRow}>
          <ChipButton
            label={object.showMeasurements ? 'On' : 'Off'}
            accessibilityLabel="Show geometric measurements"
            selected={Boolean(object.showMeasurements)}
            isSwitch
            theme={theme}
            onPress={() =>
              onUpdateStyle(object.id, { showMeasurements: !object.showMeasurements })
            }
          />
        </View>
      </View>
    </>
  );
});

export const InspectorTableSection = memo(function InspectorTableSection({
  table,
  theme,
  dark,
  onTableAction,
  onUpdateStyle,
}: {
  table: TableObject;
  theme: ThemeColors;
  dark: boolean;
  onTableAction?: (id: string, action: 'add-row' | 'remove-row' | 'add-col' | 'remove-col') => void;
  onUpdateStyle: (id: string, patch: ObjectStylePatch) => void;
}) {
  return (
    <>
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: theme.foreground }]}>
          Rows & Columns ({table.rows}×{table.columns})
        </Text>
        <View style={styles.chipRow}>
          <ChipButton
            label="+ Row"
            accessibilityLabel="Add table row"
            selected={false}
            theme={theme}
            onPress={() => onTableAction?.(table.id, 'add-row')}
          />
          <ChipButton
            label="− Row"
            accessibilityLabel="Remove table row"
            selected={false}
            theme={theme}
            onPress={() => onTableAction?.(table.id, 'remove-row')}
          />
          <ChipButton
            label="+ Col"
            accessibilityLabel="Add table column"
            selected={false}
            theme={theme}
            onPress={() => onTableAction?.(table.id, 'add-col')}
          />
          <ChipButton
            label="− Col"
            accessibilityLabel="Remove table column"
            selected={false}
            theme={theme}
            onPress={() => onTableAction?.(table.id, 'remove-col')}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: theme.foreground }]}>Header</Text>
        <View style={styles.chipRow}>
          <ChipButton
            label="Header Row"
            selected={table.hasHeaderRow}
            isSwitch
            theme={theme}
            onPress={() => onUpdateStyle(table.id, { hasHeaderRow: !table.hasHeaderRow })}
          />
          <ChipButton
            label="Fill Header"
            selected={table.fillHeader}
            isSwitch
            theme={theme}
            onPress={() => onUpdateStyle(table.id, { fillHeader: !table.fillHeader })}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: theme.foreground }]}>Font Size</Text>
        <View style={styles.chipRow}>
          {TABLE_FONT_SIZES.map((fs) => (
            <ChipButton
              key={fs}
              label={`${fs}pt`}
              selected={fs === table.fontSize}
              theme={theme}
              onPress={() => onUpdateStyle(table.id, { fontSize: fs })}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: theme.foreground }]}>Color</Text>
        <TextColorSwatches
          theme={theme}
          dark={dark}
          activeKey={table.colorKey}
          pickerOpen={false}
          accessibilityPrefix="table"
          onSelectColor={(key) => onUpdateStyle(table.id, { colorKey: key })}
        />
      </View>
    </>
  );
});

export const InspectorConnectorSection = memo(function InspectorConnectorSection({
  object,
  theme,
  dark,
  customPickerTarget,
  onTogglePicker,
  onClosePicker,
  onUpdateStyle,
}: {
  object: ConnectorObject;
  theme: ThemeColors;
  dark: boolean;
  customPickerTarget: 'color' | 'fill' | null;
  onTogglePicker: (target: 'color' | 'fill') => void;
  onClosePicker: () => void;
  onUpdateStyle: (id: string, patch: ObjectStylePatch) => void;
}) {
  return (
    <>
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: theme.foreground }]}>Connector Style</Text>
        <View style={styles.chipRow}>
          {CONNECTORS.map(({ style, label, Icon }) => {
            const selected = object.style === style;
            return (
              <ChipButton
                key={style}
                label={label}
                selected={selected}
                theme={theme}
                icon={<Icon size={16} color={selected ? theme.primary : theme.foreground} />}
                onPress={() => onUpdateStyle(object.id, { style })}
              />
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: theme.foreground }]}>Color</Text>
        <TextColorSwatches
          theme={theme}
          dark={dark}
          activeKey={object.colorKey}
          pickerOpen={customPickerTarget === 'color'}
          accessibilityPrefix="stroke"
          onSelectColor={(key) => onUpdateStyle(object.id, { colorKey: key })}
          onToggleCustomPicker={() => onTogglePicker('color')}
          onClosePicker={onClosePicker}
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: theme.foreground }]}>Stroke Width</Text>
        <View style={styles.chipRow}>
          {SHAPE_STROKE_WIDTHS.map((strokeWidth) => (
            <ChipButton
              key={strokeWidth}
              label={`${strokeWidth}px`}
              accessibilityLabel={`Stroke width ${strokeWidth}`}
              selected={strokeWidth === object.strokeWidth}
              theme={theme}
              onPress={() => onUpdateStyle(object.id, { strokeWidth })}
            />
          ))}
        </View>
      </View>
    </>
  );
});
