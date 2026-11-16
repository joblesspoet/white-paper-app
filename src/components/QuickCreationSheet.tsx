import { memo, useCallback, useEffect, useMemo, useState } from 'react';
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

import {
  MAX_TABLE_COLUMNS,
  MAX_TABLE_ROWS,
  STICKY_COLORS,
  STICKY_TEXT_COLOR,
  TABLE_PRESETS,
  TEXT_COLORS,
  type ShapeKind,
} from '../canvas/document';
import type { InstrumentKind } from '../canvas/geometry-box';
import { type ConnectorStyle } from '../canvas/shapes';
import { usePreferences } from '../settings/preferences-context';
import { spacing, type ThemeColors } from '../theme';
import { ColorPicker } from './ColorPicker';
import {
  QuickCreationCard,
  QuickCreationSection,
  QuickCreationSwatch,
  QuickCreationSwatchRow,
  QuickCreationTile,
} from './creation/QuickCreationPrimitives';
import {
  CalculatorIcon,
  CompassIcon,
  CompassRulerIcon,
  ConnectorIcon,
  CurtainIcon,
  ElbowIcon,
  FaceCamIcon,
  FlashcardsIcon,
  ImageIcon,
  LineIcon,
  MathSumIcon,
  MicIcon,
  PdfDocIcon,
  PlayLessonIcon,
  ProtractorIcon,
  RecordDotIcon,
  RevealTapeIcon,
  RulerIcon,
  SpotlightIcon,
  StickyIcon,
  TableGridIcon,
  TimerIcon,
} from './icons';
import { styles } from './QuickCreationSheet.styles';
import { ShapeCatalogPicker } from './ShapeCatalogPicker';

export type InsertToolRequest =
  | { type: 'sticky'; colorKey?: string }
  | { type: 'text'; colorKey?: string }
  | { type: 'shape'; shape: ShapeKind }
  | { type: 'connector'; style: ConnectorStyle }
  | { type: 'table'; rows: number; columns: number }
  | { type: 'geometry'; instrument: InstrumentKind }
  | { type: 'math' }
  | { type: 'image' }
  | { type: 'pdf' }
  | { type: 'timer' }
  | { type: 'calculator' }
  | { type: 'facecam' }
  | { type: 'recorder' }
  | { type: 'saved-lessons' }
  | { type: 'reveal-tape' }
  | { type: 'voice-pin' }
  | { type: 'curtain' }
  | { type: 'spotlight' }
  | { type: 'flashcards' };

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
export const QuickCreationSheet = memo(function QuickCreationSheet({
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
  const { reducedMotion } = usePreferences();
  const [customPickerTarget, setCustomPickerTarget] = useState<'sticky' | 'text' | null>(null);
  /** Draft colour while the custom picker is open; applied when it is confirmed. */
  const [customColor, setCustomColor] = useState<string>(theme.primary);
  const [customRows, setCustomRows] = useState(3);
  const [customCols, setCustomCols] = useState(3);

  // The sheet stays mounted between openings, so a half-finished colour pick
  // must not be waiting for the user next time they insert something.
  useEffect(() => {
    if (!visible) setCustomPickerTarget(null);
  }, [visible]);

  const maxSheetHeight = Math.min(windowHeight * 0.8, 560);

  /** Every insert path closes the sheet before the canvas is touched. */
  const insert = useCallback(
    (request: InsertToolRequest) => {
      onSelectInsert(request);
      onClose();
    },
    [onClose, onSelectInsert],
  );

  const handleSelectShape = useCallback(
    (shape: ShapeKind) => {
      insert({ type: 'shape', shape });
    },
    [insert],
  );

  /** Seed the picker with the row's default so it opens on a usable colour. */
  const openCustomPicker = useCallback(
    (target: 'sticky' | 'text') => {
      setCustomColor(target === 'sticky' ? STICKY_COLORS[0].fill : theme.primary);
      setCustomPickerTarget(target);
    },
    [theme.primary],
  );

  const openStickyCustomPicker = useCallback(() => openCustomPicker('sticky'), [openCustomPicker]);
  const openTextCustomPicker = useCallback(() => openCustomPicker('text'), [openCustomPicker]);

  const closeCustomPicker = useCallback(() => setCustomPickerTarget(null), []);
  const handleConfirmCustomColor = useCallback(() => {
    if (!customPickerTarget) return;
    const target = customPickerTarget;
    setCustomPickerTarget(null);
    insert({ type: target, colorKey: customColor });
  }, [customColor, customPickerTarget, insert]);

  const handleDecRows = useCallback(() => setCustomRows((r) => Math.max(1, r - 1)), []);
  const handleIncRows = useCallback(() => setCustomRows((r) => Math.min(MAX_TABLE_ROWS, r + 1)), []);
  const handleDecCols = useCallback(() => setCustomCols((c) => Math.max(1, c - 1)), []);
  const handleIncCols = useCallback(() => setCustomCols((c) => Math.min(MAX_TABLE_COLUMNS, c + 1)), []);
  const handleInsertCustomTable = useCallback(
    () => insert({ type: 'table', rows: customRows, columns: customCols }),
    [customCols, customRows, insert],
  );

  const textSectionAction = useMemo(
    () => ({
      label: 'Styles',
      accessibilityLabel: 'Text and note styles',
      onPress: () => {
        onClose();
        onOpenObjectOptions('text');
      },
    }),
    [onClose, onOpenObjectOptions],
  );

  const shapesSectionAction = useMemo(
    () => ({
      label: 'Styles',
      accessibilityLabel: 'Shape style options',
      onPress: () => {
        onClose();
        onOpenShapeOptions('shape');
      },
    }),
    [onClose, onOpenShapeOptions],
  );

  const connectorsSectionAction = useMemo(
    () => ({
      label: 'Styles',
      accessibilityLabel: 'Connector style options',
      onPress: () => {
        onClose();
        onOpenShapeOptions('connector');
      },
    }),
    [onClose, onOpenShapeOptions],
  );

  const sheetSurfaceStyle = useMemo(
    () => [
      styles.sheet,
      {
        backgroundColor: theme.surface,
        borderColor: theme.border,
        paddingBottom: insets.bottom + spacing.md,
      },
    ],
    [insets.bottom, theme.border, theme.surface],
  );

  const layerPaddingStyle = useMemo(
    () => [styles.layer, { paddingLeft: insets.left, paddingRight: insets.right }],
    [insets.left, insets.right],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reducedMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={layerPaddingStyle}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(19, 78, 74, 0.24)' }]}
          onPress={onClose}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        />

        <View
          accessibilityViewIsModal
          accessibilityLabel="Insert object"
          style={sheetSurfaceStyle}
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
              onPress={customPickerTarget ? closeCustomPicker : onClose}
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
                  onClose={handleConfirmCustomColor}
                />
              </View>
            ) : (
              <>
                {/* ---------------------------------------- Text & notes */}
                <QuickCreationSection
                  theme={theme}
                  label="Text & notes"
                  action={textSectionAction}
                >
                  <View style={styles.row}>
                    <QuickCreationCard
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
                    <QuickCreationCard
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

                  <QuickCreationSwatchRow
                    theme={theme}
                    label="Note"
                    addLabel="Pick a custom note colour"
                    onAdd={openStickyCustomPicker}
                  >
                    {NOTE_SWATCHES.map((entry) => (
                      <QuickCreationSwatch
                        key={entry.key}
                        accessibilityLabel={`Add ${entry.name.toLowerCase()} sticky note`}
                        color={entry.fill}
                        borderColor={theme.border}
                        onPress={() => insert({ type: 'sticky', colorKey: entry.key })}
                      />
                    ))}
                  </QuickCreationSwatchRow>

                  <QuickCreationSwatchRow
                    theme={theme}
                    label="Text"
                    addLabel="Pick a custom text colour"
                    onAdd={openTextCustomPicker}
                  >
                    {TEXT_SWATCHES.map((entry) => (
                      <QuickCreationSwatch
                        key={entry.key}
                        accessibilityLabel={`Add text in ${entry.name.toLowerCase()}`}
                        color={dark ? entry.dark : entry.light}
                        borderColor={theme.border}
                        onPress={() => insert({ type: 'text', colorKey: entry.key })}
                      />
                    ))}
                  </QuickCreationSwatchRow>
                </QuickCreationSection>

                {/* ---------------------------------------------- Shapes */}
                <QuickCreationSection
                  theme={theme}
                  label="Shapes & Diagrams (53)"
                  action={shapesSectionAction}
                >
                  <ShapeCatalogPicker
                    theme={theme}
                    showLabels
                    onSelectShape={handleSelectShape}
                  />
                </QuickCreationSection>

                {/* ---------------------------------------------- Tables */}
                <QuickCreationSection theme={theme} label="Table">
                  <View style={styles.row}>
                    {TABLE_PRESETS.map((preset) => (
                      <QuickCreationTile
                        key={preset.label}
                        theme={theme}
                        accessibilityLabel={`Insert ${preset.label} table`}
                        label={preset.label}
                        icon={<TableGridIcon size={22} color={theme.primary} />}
                        onPress={() =>
                          insert({ type: 'table', rows: preset.rows, columns: preset.columns })
                        }
                      />
                    ))}
                  </View>
                  <View style={styles.customTableRow}>
                    <View style={styles.stepperGroup}>
                      <Text style={[styles.stepperLabel, { color: theme.foreground }]}>
                        Rows: {customRows}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Decrease table rows"
                        onPress={handleDecRows}
                        style={[styles.stepperBtn, { borderColor: theme.border }]}
                      >
                        <Text style={[styles.stepperBtnText, { color: theme.foreground }]}>−</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Increase table rows"
                        onPress={handleIncRows}
                        style={[styles.stepperBtn, { borderColor: theme.border }]}
                      >
                        <Text style={[styles.stepperBtnText, { color: theme.foreground }]}>+</Text>
                      </Pressable>
                    </View>
                    <View style={styles.stepperGroup}>
                      <Text style={[styles.stepperLabel, { color: theme.foreground }]}>
                        Cols: {customCols}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Decrease table columns"
                        onPress={handleDecCols}
                        style={[styles.stepperBtn, { borderColor: theme.border }]}
                      >
                        <Text style={[styles.stepperBtnText, { color: theme.foreground }]}>−</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Increase table columns"
                        onPress={handleIncCols}
                        style={[styles.stepperBtn, { borderColor: theme.border }]}
                      >
                        <Text style={[styles.stepperBtnText, { color: theme.foreground }]}>+</Text>
                      </Pressable>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Insert ${customRows} by ${customCols} table`}
                      onPress={handleInsertCustomTable}
                      style={[styles.insertTableBtn, { backgroundColor: theme.primary }]}
                    >
                      <Text style={styles.insertTableBtnText}>Insert</Text>
                    </Pressable>
                  </View>
                </QuickCreationSection>

                {/* ------------------------------------------ Connectors */}
                <QuickCreationSection
                  theme={theme}
                  label="Connectors"
                  action={connectorsSectionAction}
                >
                  <View style={styles.row}>
                    <QuickCreationTile
                      theme={theme}
                      accessibilityLabel="Draw a straight arrow connector"
                      label="Arrow"
                      icon={<ConnectorIcon size={22} color={theme.primary} />}
                      onPress={() => insert({ type: 'connector', style: 'arrow' })}
                    />
                    <QuickCreationTile
                      theme={theme}
                      accessibilityLabel="Draw a plain line connector"
                      label="Line"
                      icon={<LineIcon size={22} color={theme.primary} />}
                      onPress={() => insert({ type: 'connector', style: 'line' })}
                    />
                    <QuickCreationTile
                      theme={theme}
                      accessibilityLabel="Draw an elbow connector"
                      label="Elbow"
                      icon={<ElbowIcon size={22} color={theme.primary} />}
                      onPress={() => insert({ type: 'connector', style: 'elbow' })}
                    />
                  </View>
                </QuickCreationSection>

                {/* ----------------------------------------------- Media */}
                <QuickCreationSection theme={theme} label="Media">
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

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Import PDF for markup"
                    accessibilityHint="Create locked worksheet pages from a PDF document"
                    onPress={() => insert({ type: 'pdf' })}
                    style={({ pressed }) => [
                      styles.mediaCard,
                      { backgroundColor: theme.background, borderColor: theme.border, marginTop: spacing.xs },
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={[styles.iconPill, { backgroundColor: theme.primary + '18' }]}>
                      <PdfDocIcon size={20} color={theme.primary} />
                    </View>
                    <View style={styles.cardText}>
                      <Text style={[styles.cardTitle, { color: theme.foreground }]}>Import PDF for markup</Text>
                      <Text style={[styles.cardCaption, { color: theme.foreground + '99' }]}>
                        Turn PDF pages into locked background worksheets
                      </Text>
                    </View>
                  </Pressable>
                </QuickCreationSection>

                {/* ------------------------------------------- Utilities */}
                <QuickCreationSection theme={theme} label="Geometry Box & Utilities">
                  <View style={styles.row}>
                    <QuickCreationTile
                      theme={theme}
                      accessibilityLabel="Open ruler"
                      label="Ruler"
                      icon={<RulerIcon size={22} color={theme.primary} />}
                      onPress={() => insert({ type: 'geometry', instrument: 'ruler' })}
                    />
                    <QuickCreationTile
                      theme={theme}
                      accessibilityLabel="Open protractor"
                      label="Protractor"
                      icon={<ProtractorIcon size={22} color={theme.primary} />}
                      onPress={() => insert({ type: 'geometry', instrument: 'protractor' })}
                    />
                    <QuickCreationTile
                      theme={theme}
                      accessibilityLabel="Open compass"
                      label="Compass"
                      icon={<CompassIcon size={22} color={theme.primary} />}
                      onPress={() => insert({ type: 'geometry', instrument: 'compass' })}
                    />
                    <QuickCreationTile
                      theme={theme}
                      accessibilityLabel="Open set square"
                      label="Set Square"
                      icon={<CompassRulerIcon size={22} color={theme.primary} />}
                      onPress={() => insert({ type: 'geometry', instrument: 'set-square-45' })}
                    />
                  </View>
                  <View style={styles.row}>
                    <QuickCreationTile
                      theme={theme}
                      accessibilityLabel="Open floating classroom timer"
                      label="Timer"
                      icon={<TimerIcon size={22} color={theme.primary} />}
                      onPress={() => insert({ type: 'timer' })}
                    />
                    <QuickCreationTile
                      theme={theme}
                      accessibilityLabel="Open floating scientific calculator"
                      label="Calculator"
                      icon={<CalculatorIcon size={22} color={theme.primary} />}
                      onPress={() => insert({ type: 'calculator' })}
                    />
                    <QuickCreationTile
                      theme={theme}
                      accessibilityLabel="Open math formula builder"
                      label="Math f(x)"
                      icon={<MathSumIcon size={22} color={theme.primary} />}
                      onPress={() => insert({ type: 'math' })}
                    />
                  </View>
                  <View style={styles.row}>
                    <QuickCreationTile
                      theme={theme}
                      accessibilityLabel="Toggle floating Face-Cam"
                      label="Face-Cam"
                      icon={<FaceCamIcon size={22} color={theme.primary} />}
                      onPress={() => insert({ type: 'facecam' })}
                    />
                    <QuickCreationTile
                      theme={theme}
                      accessibilityLabel="Open lesson recorder"
                      label="Record"
                      icon={<RecordDotIcon size={22} color={theme.destructive} />}
                      onPress={() => insert({ type: 'recorder' })}
                    />
                    <QuickCreationTile
                      theme={theme}
                      accessibilityLabel="Open saved lessons library"
                      label="Lessons"
                      icon={<PlayLessonIcon size={22} color={theme.primary} />}
                      onPress={() => insert({ type: 'saved-lessons' })}
                    />
                  </View>
                </QuickCreationSection>

                {/* ----------------------------- Active Recall & Presenter */}
                <QuickCreationSection theme={theme} label="Active Recall & Presenter">
                  <View style={styles.row}>
                    <QuickCreationTile
                      theme={theme}
                      accessibilityLabel="Place tap-to-reveal answer tape"
                      label="Reveal Tape"
                      icon={<RevealTapeIcon size={22} color={theme.primary} />}
                      onPress={() => insert({ type: 'reveal-tape' })}
                    />
                    <QuickCreationTile
                      theme={theme}
                      accessibilityLabel="Record spatial voice pin"
                      label="Voice Pin"
                      icon={<MicIcon size={22} color={theme.primary} />}
                      onPress={() => insert({ type: 'voice-pin' })}
                    />
                    <QuickCreationTile
                      theme={theme}
                      accessibilityLabel="Open stage curtain shade"
                      label="Curtain"
                      icon={<CurtainIcon size={22} color={theme.primary} />}
                      onPress={() => insert({ type: 'curtain' })}
                    />
                  </View>
                  <View style={styles.row}>
                    <QuickCreationTile
                      theme={theme}
                      accessibilityLabel="Open spotlight focus shade"
                      label="Spotlight"
                      icon={<SpotlightIcon size={22} color={theme.primary} />}
                      onPress={() => insert({ type: 'spotlight' })}
                    />
                    <QuickCreationTile
                      theme={theme}
                      accessibilityLabel="Study board flashcards"
                      label="Flashcards"
                      icon={<FlashcardsIcon size={22} color={theme.primary} />}
                      onPress={() => insert({ type: 'flashcards' })}
                    />
                  </View>
                </QuickCreationSection>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
});
