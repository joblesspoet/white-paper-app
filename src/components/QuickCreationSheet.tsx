import { useEffect, useState, type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { STICKY_COLORS, STICKY_TEXT_COLOR, TEXT_COLORS, type ShapeKind } from '../canvas/document';
import { type ConnectorStyle } from '../canvas/shapes';
import { radii, spacing, touchTarget, typography, type ThemeColors } from '../theme';
import { ColorPicker } from './ColorPicker';
import {
  CalculatorIcon,
  ConnectorIcon,
  ElbowIcon,
  EllipseIcon,
  ImageIcon,
  LineIcon,
  PlusIcon,
  RectangleIcon,
  StickyIcon,
  TimerIcon,
} from './icons';

export type InsertToolRequest =
  | { type: 'sticky'; colorKey?: string }
  | { type: 'text'; colorKey?: string }
  | { type: 'shape'; shape: ShapeKind }
  | { type: 'connector'; style: ConnectorStyle }
  | { type: 'image' }
  | { type: 'timer' }
  | { type: 'calculator' };

type QuickCreationSheetProps = {
  theme: ThemeColors;
  dark: boolean;
  visible: boolean;
  onClose: () => void;
  onSelectInsert: (request: InsertToolRequest) => void;
  /** Opens the full shape/connector style sheet after arming the tool. */
  onOpenShapeOptions: (kind: 'shape' | 'connector') => void;
  /** Opens the full text/sticky style sheet after arming the tool. */
  onOpenObjectOptions: (kind: 'text' | 'sticky') => void;
};

/** Quick pastels in the note row; the full range lives in the style sheet. */
const NOTE_SWATCHES = STICKY_COLORS.slice(0, 6);
/** Quick text colours in the text row. */
const TEXT_SWATCHES = TEXT_COLORS.slice(0, 6);

/**
 * Tier two of the two-tier action island: a slide-up sheet holding every
 * object the board can create. It keeps the bottom pill at four anchors while
 * giving new object types (tables, frames, templates) an obvious home.
 */
export function QuickCreationSheet({
  theme,
  dark,
  visible,
  onClose,
  onSelectInsert,
  onOpenShapeOptions,
  onOpenObjectOptions,
}: QuickCreationSheetProps) {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [customPickerTarget, setCustomPickerTarget] = useState<'sticky' | 'text' | null>(null);
  /** Draft colour while the custom picker is open; applied when it is confirmed. */
  const [customColor, setCustomColor] = useState<string>(theme.primary);

  // The sheet stays mounted between openings, so a half-finished colour pick
  // must not be waiting for the user next time they insert something.
  useEffect(() => {
    if (!visible) setCustomPickerTarget(null);
  }, [visible]);

  const maxSheetHeight = Math.min(windowHeight * 0.8, 560);

  /** Every insert path closes the sheet before the canvas is touched. */
  const insert = (request: InsertToolRequest) => {
    onSelectInsert(request);
    onClose();
  };

  /** Seed the picker with the row's default so it opens on a usable colour. */
  const openCustomPicker = (target: 'sticky' | 'text') => {
    setCustomColor(target === 'sticky' ? STICKY_COLORS[0].fill : theme.primary);
    setCustomPickerTarget(target);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View
        style={[
          styles.layer,
          {
            paddingLeft: insets.left,
            paddingRight: insets.right,
          },
        ]}
      >
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(19, 78, 74, 0.24)' }]}
          onPress={onClose}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        />

        <View
          accessibilityViewIsModal
          accessibilityLabel="Insert object"
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              paddingBottom: insets.bottom + spacing.md,
            },
          ]}
        >
          <View style={styles.handleWrap}>
            <View style={[styles.handle, { backgroundColor: theme.border }]} />
          </View>

          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: theme.foreground }]}>
                {customPickerTarget ? 'Custom colour' : 'Insert object'}
              </Text>
              <Text style={[styles.subtitle, { color: theme.foreground }]}>
                {customPickerTarget
                  ? 'Choose a colour, then tap Done in the picker to place it.'
                  : 'Pick an item, then tap the board to place it.'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={customPickerTarget ? 'Back to insert options' : 'Close insert sheet'}
              onPress={customPickerTarget ? () => setCustomPickerTarget(null) : onClose}
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
            >
              <Text style={[styles.closeText, { color: theme.primary }]}>
                {customPickerTarget ? 'Cancel' : 'Done'}
              </Text>
            </Pressable>
          </View>

          <ScrollView
            style={{ maxHeight: maxSheetHeight }}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {customPickerTarget ? (
              <View style={styles.customSection}>
                <Text style={[styles.customHint, { color: theme.foreground }]}>
                  {customPickerTarget === 'sticky'
                    ? 'Tap Done in the picker to add a note in this colour.'
                    : 'Tap Done in the picker to start typing in this colour.'}
                </Text>
                <ColorPicker
                  theme={theme}
                  value={customColor}
                  background={theme.background}
                  checkContrast={false}
                  onChange={setCustomColor}
                  onClose={() => {
                    const target = customPickerTarget;
                    setCustomPickerTarget(null);
                    insert({ type: target, colorKey: customColor });
                  }}
                />
              </View>
            ) : (
              <>
                {/* ---------------------------------------- Text & notes */}
                <Section
                  theme={theme}
                  label="Text & notes"
                  action={{
                    label: 'Styles',
                    accessibilityLabel: 'Text and note styles',
                    onPress: () => {
                      onClose();
                      onOpenObjectOptions('text');
                    },
                  }}
                >
                  <View style={styles.row}>
                    <Card
                      theme={theme}
                      accessibilityLabel="Add text block"
                      accessibilityHint="Type a heading or paragraph on the board"
                      title="Text block"
                      caption="Headings and paragraphs"
                      icon={
                        <Text style={[styles.textPreview, { color: theme.primary }]} accessibilityElementsHidden>
                          Aa
                        </Text>
                      }
                      onPress={() => insert({ type: 'text' })}
                    />
                    <Card
                      theme={theme}
                      accessibilityLabel="Add sticky note"
                      accessibilityHint="Places a note in the current pastel"
                      title="Sticky note"
                      caption="Pin a quick thought"
                      icon={<StickyIcon size={20} color={STICKY_TEXT_COLOR} />}
                      iconBackground={NOTE_SWATCHES[0].fill}
                      onPress={() => insert({ type: 'sticky' })}
                    />
                  </View>

                  <SwatchRow
                    theme={theme}
                    label="Note"
                    addLabel="Pick a custom note colour"
                    onAdd={() => openCustomPicker('sticky')}
                  >
                    {NOTE_SWATCHES.map((entry) => (
                      <Swatch
                        key={entry.key}
                        accessibilityLabel={`Add ${entry.name.toLowerCase()} sticky note`}
                        color={entry.fill}
                        borderColor={theme.border}
                        onPress={() => insert({ type: 'sticky', colorKey: entry.key })}
                      />
                    ))}
                  </SwatchRow>

                  <SwatchRow
                    theme={theme}
                    label="Text"
                    addLabel="Pick a custom text colour"
                    onAdd={() => openCustomPicker('text')}
                  >
                    {TEXT_SWATCHES.map((entry) => (
                      <Swatch
                        key={entry.key}
                        accessibilityLabel={`Add text in ${entry.name.toLowerCase()}`}
                        color={dark ? entry.dark : entry.light}
                        borderColor={theme.border}
                        onPress={() => insert({ type: 'text', colorKey: entry.key })}
                      />
                    ))}
                  </SwatchRow>
                </Section>

                {/* ---------------------------------------------- Shapes */}
                <Section
                  theme={theme}
                  label="Shapes"
                  action={{
                    label: 'Styles',
                    accessibilityLabel: 'Shape style options',
                    onPress: () => {
                      onClose();
                      onOpenShapeOptions('shape');
                    },
                  }}
                >
                  <View style={styles.row}>
                    <Tile
                      theme={theme}
                      accessibilityLabel="Draw a rectangle"
                      label="Rectangle"
                      icon={<RectangleIcon size={22} color={theme.primary} />}
                      onPress={() => insert({ type: 'shape', shape: 'rectangle' })}
                    />
                    <Tile
                      theme={theme}
                      accessibilityLabel="Draw an ellipse"
                      label="Ellipse"
                      icon={<EllipseIcon size={22} color={theme.primary} />}
                      onPress={() => insert({ type: 'shape', shape: 'ellipse' })}
                    />
                    <Tile
                      theme={theme}
                      accessibilityLabel="Draw a straight line"
                      label="Line"
                      icon={<LineIcon size={22} color={theme.primary} />}
                      onPress={() => insert({ type: 'shape', shape: 'line' })}
                    />
                  </View>
                </Section>

                {/* ------------------------------------------ Connectors */}
                <Section
                  theme={theme}
                  label="Connectors"
                  action={{
                    label: 'Styles',
                    accessibilityLabel: 'Connector style options',
                    onPress: () => {
                      onClose();
                      onOpenShapeOptions('connector');
                    },
                  }}
                >
                  <View style={styles.row}>
                    <Tile
                      theme={theme}
                      accessibilityLabel="Draw a straight arrow connector"
                      label="Arrow"
                      icon={<ConnectorIcon size={22} color={theme.primary} />}
                      onPress={() => insert({ type: 'connector', style: 'arrow' })}
                    />
                    <Tile
                      theme={theme}
                      accessibilityLabel="Draw a plain line connector"
                      label="Line"
                      icon={<LineIcon size={22} color={theme.primary} />}
                      onPress={() => insert({ type: 'connector', style: 'line' })}
                    />
                    <Tile
                      theme={theme}
                      accessibilityLabel="Draw an elbow connector"
                      label="Elbow"
                      icon={<ElbowIcon size={22} color={theme.primary} />}
                      onPress={() => insert({ type: 'connector', style: 'elbow' })}
                    />
                  </View>
                </Section>

                {/* ----------------------------------------------- Media */}
                <Section theme={theme} label="Media">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Add a photo from the camera or library"
                    accessibilityHint="Crop, rotate, and place an image on the board"
                    onPress={() => insert({ type: 'image' })}
                    style={({ pressed }) => [
                      styles.mediaCard,
                      { backgroundColor: theme.background, borderColor: theme.border },
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={[styles.iconPill, { backgroundColor: theme.primary + '18' }]}>
                      <ImageIcon size={20} color={theme.primary} />
                    </View>
                    <View style={styles.cardText}>
                      <Text style={[styles.cardTitle, { color: theme.foreground }]}>Photo</Text>
                      <Text style={[styles.cardCaption, { color: theme.foreground + '99' }]}>
                        Take a picture or choose one from the library
                      </Text>
                    </View>
                  </Pressable>
                </Section>

                {/* ------------------------------------------- Utilities */}
                <Section theme={theme} label="Utilities">
                  <View style={styles.row}>
                    <Tile
                      theme={theme}
                      accessibilityLabel="Open floating classroom timer"
                      label="Timer"
                      icon={<TimerIcon size={22} color={theme.primary} />}
                      onPress={() => insert({ type: 'timer' })}
                    />
                    <Tile
                      theme={theme}
                      accessibilityLabel="Open floating scientific calculator"
                      label="Calculator"
                      icon={<CalculatorIcon size={22} color={theme.primary} />}
                      onPress={() => insert({ type: 'calculator' })}
                    />
                  </View>
                </Section>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Section({
  theme,
  label,
  action,
  children,
}: {
  theme: ThemeColors;
  label: string;
  action?: { label: string; accessibilityLabel: string; onPress: () => void };
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionLabel, { color: theme.foreground }]}>{label}</Text>
        {action && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={action.accessibilityLabel}
            onPress={action.onPress}
            style={({ pressed }) => [styles.sectionAction, pressed && styles.pressed]}
          >
            <Text style={[styles.sectionActionText, { color: theme.primary }]}>{action.label}</Text>
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}

function Card({
  theme,
  accessibilityLabel,
  accessibilityHint,
  title,
  caption,
  icon,
  iconBackground,
  onPress,
}: {
  theme: ThemeColors;
  accessibilityLabel: string;
  accessibilityHint: string;
  title: string;
  caption: string;
  icon: ReactNode;
  iconBackground?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.background, borderColor: theme.border },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.iconPill, { backgroundColor: iconBackground ?? theme.primary + '18' }]}>
        {icon}
      </View>
      <View style={styles.cardText}>
        <Text style={[styles.cardTitle, { color: theme.foreground }]} numberOfLines={1}>{title}</Text>
        <Text style={[styles.cardCaption, { color: theme.foreground + '99' }]} numberOfLines={2}>
          {caption}
        </Text>
      </View>
    </Pressable>
  );
}

function Tile({
  theme,
  accessibilityLabel,
  label,
  icon,
  onPress,
}: {
  theme: ThemeColors;
  accessibilityLabel: string;
  label: string;
  icon: ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: theme.background, borderColor: theme.border },
        pressed && styles.pressed,
      ]}
    >
      {icon}
      <Text style={[styles.tileLabel, { color: theme.foreground }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

function SwatchRow({
  theme,
  label,
  addLabel,
  onAdd,
  children,
}: {
  theme: ThemeColors;
  label: string;
  addLabel: string;
  onAdd: () => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.swatchGroup}>
      <Text style={[styles.swatchLabel, { color: theme.foreground }]}>{label}</Text>
      <View style={styles.swatchRow}>
        {children}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={addLabel}
          onPress={onAdd}
          style={({ pressed }) => [styles.swatch, pressed && styles.pressed]}
        >
          <View
            style={[
              styles.swatchChip,
              styles.swatchAdd,
              { borderColor: theme.border, backgroundColor: theme.muted },
            ]}
          >
            <PlusIcon size={12} color={theme.foreground} />
          </View>
        </Pressable>
      </View>
    </View>
  );
}

function Swatch({
  accessibilityLabel,
  color,
  borderColor,
  onPress,
}: {
  accessibilityLabel: string;
  color: string;
  borderColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.swatch, pressed && styles.pressed]}
    >
      <View style={[styles.swatchChip, { backgroundColor: color, borderColor }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  layer: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  handleWrap: { alignItems: 'center', paddingVertical: spacing.sm },
  handle: { width: 36, height: 4, borderRadius: 2 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerText: { flex: 1, gap: 2 },
  title: { ...typography.subtitle, fontWeight: '700' },
  subtitle: { ...typography.caption, opacity: 0.7 },
  closeButton: { minHeight: touchTarget, justifyContent: 'center', paddingHorizontal: spacing.sm },
  closeText: { ...typography.bodyStrong },
  content: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.md },
  customSection: { gap: spacing.sm, paddingVertical: spacing.xs },
  customHint: { ...typography.caption, fontSize: 11, opacity: 0.7 },
  section: { gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: {
    ...typography.caption,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.7,
  },
  sectionAction: { minHeight: touchTarget, justifyContent: 'center', paddingHorizontal: spacing.xs },
  sectionActionText: { ...typography.caption, fontWeight: '600' },
  row: { flexDirection: 'row', gap: spacing.sm },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.sm,
    minHeight: 64,
  },
  cardText: { flex: 1, gap: 2 },
  cardTitle: { ...typography.caption, fontWeight: '600', fontSize: 14 },
  cardCaption: { ...typography.caption, fontSize: 11 },
  iconPill: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textPreview: { fontSize: 17, fontWeight: '700' },
  tile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: touchTarget + 16,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  tileLabel: { ...typography.caption, fontSize: 11, fontWeight: '600' },
  mediaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.sm,
    minHeight: 64,
  },
  swatchGroup: { gap: 2 },
  // Wraps rather than clips on the narrowest phones (~320pt), where seven
  // 44pt targets no longer fit on one line.
  swatchRow: { flexDirection: 'row', alignItems: 'center', gap: 2, flexWrap: 'wrap' },
  swatchLabel: { ...typography.caption, fontSize: 11, fontWeight: '600', opacity: 0.7 },
  // A 44pt tap area wrapping a 26pt chip: the row stays compact without
  // shrinking the target below the design minimum.
  swatch: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' },
  swatchChip: { width: 26, height: 26, borderRadius: 999, borderWidth: 1 },
  swatchAdd: { alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
});
