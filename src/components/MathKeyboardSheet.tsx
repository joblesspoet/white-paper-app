import {
  Canvas,
  FontSlant,
  FontWeight,
  Group,
  Paragraph,
  Path,
  Skia,
  TextAlign,
} from '@shopify/react-native-skia';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { layoutMathExpression } from '../canvas/math-layout';
import {
  MATH_KEYPAD_TABS,
  MATH_QUICK_FORMULAS,
  type MathKeyItem,
  type MathKeypadTab,
  type MathQuickFormula,
} from '../canvas/math-model';
import type { ThemeColors } from '../theme';
import { styles } from './MathKeyboardSheet.styles';

type MathKeyboardSheetProps = {
  visible: boolean;
  theme: ThemeColors;
  initialLatex?: string;
  isEditing?: boolean;
  onSubmit: (latex: string) => void;
  onClose: () => void;
};

type TabId = MathKeypadTab['id'];

const MathTabChip = memo(function MathTabChip({
  tab,
  selected,
  theme,
  onSelect,
}: {
  tab: MathKeypadTab;
  selected: boolean;
  theme: ThemeColors;
  onSelect: (id: TabId) => void;
}) {
  const handlePress = useCallback(() => onSelect(tab.id), [onSelect, tab.id]);
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={tab.label}
      accessibilityState={{ selected }}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.tabChip,
        {
          borderColor: selected ? theme.primary : theme.border,
          backgroundColor: selected ? theme.primary : theme.background,
        },
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.tabChipText,
          { color: selected ? theme.surface : theme.foreground },
        ]}
      >
        {tab.label}
      </Text>
    </Pressable>
  );
});

const MathKeyButton = memo(function MathKeyButton({
  item,
  theme,
  onPressKey,
}: {
  item: MathKeyItem;
  theme: ThemeColors;
  onPressKey: (item: MathKeyItem) => void;
}) {
  const handlePress = useCallback(() => onPressKey(item), [item, onPressKey]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.accessibilityLabel}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.keyBtn,
        { borderColor: theme.border, backgroundColor: theme.background },
        pressed && styles.pressed,
      ]}
    >
      <Text numberOfLines={1} style={[styles.keyLabel, { color: theme.foreground }]}>
        {item.label}
      </Text>
    </Pressable>
  );
});

const MathFormulaRow = memo(function MathFormulaRow({
  item,
  theme,
  onSelectFormula,
}: {
  item: MathQuickFormula;
  theme: ThemeColors;
  onSelectFormula: (latex: string) => void;
}) {
  const handlePress = useCallback(() => onSelectFormula(item.latex), [item.latex, onSelectFormula]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Insert ${item.title}`}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.formulaCard,
        { borderColor: theme.border, backgroundColor: theme.background },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.formulaTitle, { color: theme.primary }]}>{item.title}</Text>
      <Text numberOfLines={1} style={[styles.formulaPreview, { color: theme.foreground }]}>
        {item.previewLabel}
      </Text>
    </Pressable>
  );
});

export const MathKeyboardSheet = memo(function MathKeyboardSheet({
  visible,
  theme,
  initialLatex = '',
  isEditing = false,
  onSubmit,
  onClose,
}: MathKeyboardSheetProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [latex, setLatex] = useState(initialLatex);
  const [selection, setSelection] = useState<{ start: number; end: number }>({
    start: initialLatex.length,
    end: initialLatex.length,
  });
  const [activeTab, setActiveTab] = useState<TabId>('algebra');

  useEffect(() => {
    if (visible) {
      setLatex(initialLatex);
      setSelection({ start: initialLatex.length, end: initialLatex.length });
    }
  }, [initialLatex, visible]);

  const centered = windowWidth >= 600;
  const numColumns = windowWidth >= 480 ? 5 : 4;
  const previewWidth = Math.min(520, windowWidth - 48);
  const previewHeight = 88;
  const previewFontSize = 22;

  const layout = useMemo(() => layoutMathExpression(latex, previewFontSize), [latex]);

  const vectorPath = useMemo(() => {
    if (!layout.vectorPathsSvg) return null;
    return Skia.Path.MakeFromSVGString(layout.vectorPathsSvg);
  }, [layout.vectorPathsSvg]);

  const glyphParagraphs = useMemo(() => {
    return layout.glyphs.map((glyph) => {
      const builder = Skia.ParagraphBuilder.Make({ textAlign: TextAlign.Left });
      builder.pushStyle({
        color: Skia.Color(theme.foreground),
        fontSize: glyph.fontSize,
        fontStyle: {
          weight: glyph.bold ? FontWeight.Bold : FontWeight.Normal,
          slant: glyph.italic ? FontSlant.Italic : FontSlant.Upright,
        },
      });
      builder.addText(glyph.text);
      const para = builder.build();
      const paraWidth = Math.max(24, glyph.fontSize * glyph.text.length + 12);
      para.layout(paraWidth);
      return { glyph, para, width: paraWidth };
    });
  }, [layout.glyphs, theme.foreground]);

  const previewTransform = useMemo(() => {
    const scaleX = layout.width > previewWidth - 24 ? (previewWidth - 24) / layout.width : 1;
    const scaleY = layout.height > previewHeight - 16 ? (previewHeight - 16) / layout.height : 1;
    const scale = Math.min(1, scaleX, scaleY);
    const tx = (previewWidth - layout.width * scale) / 2;
    const ty = (previewHeight - layout.height * scale) / 2;
    return [{ translateX: tx }, { translateY: ty }, { scale }];
  }, [layout.height, layout.width, previewWidth]);

  const currentTabKeys = useMemo(() => {
    return MATH_KEYPAD_TABS.find((t) => t.id === activeTab)?.keys ?? [];
  }, [activeTab]);

  const handleInsertKey = useCallback(
    (item: MathKeyItem) => {
      setLatex((prev) => {
        const start = Math.max(0, Math.min(prev.length, selection.start));
        const end = Math.max(start, Math.min(prev.length, selection.end));
        const next = prev.slice(0, start) + item.insertLatex + prev.slice(end);
        const nextCursor = start + item.insertLatex.length + (item.cursorBack ?? 0);
        const clamped = Math.max(0, Math.min(next.length, nextCursor));
        setSelection({ start: clamped, end: clamped });
        return next;
      });
    },
    [selection.end, selection.start],
  );

  const handleSelectFormula = useCallback((formulaLatex: string) => {
    setLatex(formulaLatex);
    setSelection({ start: formulaLatex.length, end: formulaLatex.length });
  }, []);

  const handleBackspace = useCallback(() => {
    setLatex((prev) => {
      if (prev.length === 0) return prev;
      const start = Math.max(0, Math.min(prev.length, selection.start));
      const end = Math.max(start, Math.min(prev.length, selection.end));
      if (end > start) {
        const next = prev.slice(0, start) + prev.slice(end);
        setSelection({ start, end: start });
        return next;
      }
      if (start === 0) return prev;
      const next = prev.slice(0, start - 1) + prev.slice(start);
      setSelection({ start: start - 1, end: start - 1 });
      return next;
    });
  }, [selection.end, selection.start]);

  const handleClear = useCallback(() => {
    setLatex('');
    setSelection({ start: 0, end: 0 });
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = latex.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  }, [latex, onSubmit]);

  const renderKeyItem = useCallback(
    ({ item }: { item: MathKeyItem }) => (
      <MathKeyButton item={item} theme={theme} onPressKey={handleInsertKey} />
    ),
    [handleInsertKey, theme],
  );

  const renderFormulaItem = useCallback(
    ({ item }: { item: MathQuickFormula }) => (
      <MathFormulaRow item={item} theme={theme} onSelectFormula={handleSelectFormula} />
    ),
    [handleSelectFormula, theme],
  );

  const keyExtractorKey = useCallback((item: MathKeyItem) => item.id, []);
  const keyExtractorFormula = useCallback((item: MathQuickFormula) => item.id, []);

  const canSubmit = latex.trim().length > 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        style={[styles.backdrop, centered && styles.backdropCentered]}
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          accessibilityViewIsModal
          accessibilityLabel={isEditing ? 'Edit math formula' : 'Insert math formula'}
          style={[
            styles.sheet,
            centered && styles.sheetCentered,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              maxHeight: Math.round(windowHeight * 0.88),
              paddingBottom: centered ? spacing.md : Math.max(insets.bottom, 16),
            },
          ]}
        >
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <Text style={[styles.title, { color: theme.foreground }]}>
              {isEditing ? 'Edit Math Formula' : 'Math Formula Builder'}
            </Text>
            <View style={styles.headerActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                onPress={onClose}
                style={({ pressed }) => [
                  styles.headerBtn,
                  { borderColor: theme.border },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.headerBtnText, { color: theme.foreground }]}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isEditing ? 'Update formula' : 'Insert formula'}
                accessibilityState={{ disabled: !canSubmit }}
                disabled={!canSubmit}
                onPress={handleSubmit}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { backgroundColor: canSubmit ? theme.primary : theme.border },
                  pressed && canSubmit && styles.pressed,
                ]}
              >
                <Text style={[styles.primaryBtnText, { color: theme.surface }]}>
                  {isEditing ? 'Update' : 'Insert'}
                </Text>
              </Pressable>
            </View>
          </View>

          <View
            style={[
              styles.previewCard,
              { backgroundColor: theme.background, borderColor: theme.border },
            ]}
          >
            {latex.trim().length === 0 ? (
              <Text style={[styles.previewPlaceholder, { color: theme.foreground }]}>
                Tap symbols or a formula below to preview
              </Text>
            ) : (
              <Canvas style={{ width: previewWidth, height: previewHeight }}>
                <Group transform={previewTransform}>
                  {vectorPath ? (
                    <Path
                      path={vectorPath}
                      color={theme.foreground}
                      style="stroke"
                      strokeWidth={Math.max(1.2, previewFontSize * 0.065)}
                      strokeCap="round"
                      strokeJoin="round"
                    />
                  ) : null}
                  {glyphParagraphs.map((entry, idx) => (
                    <Paragraph
                      key={`${idx}-${entry.glyph.text}`}
                      paragraph={entry.para}
                      x={entry.glyph.x}
                      y={entry.glyph.y}
                      width={entry.width}
                    />
                  ))}
                </Group>
              </Canvas>
            )}
          </View>

          <View style={styles.inputRow}>
            <TextInput
              accessibilityLabel="LaTeX formula input"
              value={latex}
              onChangeText={setLatex}
              selection={selection}
              onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
              placeholder="e.g. \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}"
              placeholderTextColor={theme.foreground + '70'}
              autoCapitalize="none"
              autoCorrect={false}
              style={[
                styles.latexInput,
                {
                  color: theme.foreground,
                  backgroundColor: theme.background,
                  borderColor: theme.border,
                },
              ]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Backspace"
              onPress={handleBackspace}
              style={({ pressed }) => [
                styles.iconActionBtn,
                { borderColor: theme.border, backgroundColor: theme.background },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.iconActionText, { color: theme.foreground }]}>⌫</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear formula"
              onPress={handleClear}
              style={({ pressed }) => [
                styles.iconActionBtn,
                { borderColor: theme.border, backgroundColor: theme.background },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.iconActionText, { color: theme.foreground }]}>Clear</Text>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsContainer}
          >
            {MATH_KEYPAD_TABS.map((tab) => (
              <MathTabChip
                key={tab.id}
                tab={tab}
                selected={activeTab === tab.id}
                theme={theme}
                onSelect={setActiveTab}
              />
            ))}
          </ScrollView>

          <View style={styles.listArea}>
            {activeTab === 'formulas' ? (
              <FlatList
                key="formulas-list"
                data={MATH_QUICK_FORMULAS}
                keyExtractor={keyExtractorFormula}
                renderItem={renderFormulaItem}
                showsVerticalScrollIndicator={false}
                initialNumToRender={8}
                maxToRenderPerBatch={8}
                windowSize={5}
              />
            ) : (
              <FlatList
                key={`keys-grid-${activeTab}-${numColumns}`}
                data={currentTabKeys}
                keyExtractor={keyExtractorKey}
                renderItem={renderKeyItem}
                numColumns={numColumns}
                columnWrapperStyle={styles.keyColumnWrapper}
                contentContainerStyle={styles.keyGridContent}
                showsVerticalScrollIndicator={false}
                initialNumToRender={16}
                maxToRenderPerBatch={12}
                windowSize={5}
              />
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
});

const spacing = { md: 16 };
