import { memo, useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  Text,
  View,
  type ListRenderItemInfo,
} from 'react-native';

import {
  SHAPE_CATALOG,
  SHAPE_CATEGORIES,
  shapesByCategory,
  type ShapeCatalogEntry,
  type ShapeCategory,
  type ShapeKind,
} from '../canvas/document';
import { type ThemeColors } from '../theme';
import { styles } from './ShapeCatalogPicker.styles';
import { ShapePreviewIcon } from './ShapePreviewIcon';

type ShapeCatalogPickerProps = {
  theme: ThemeColors;
  selectedShape?: ShapeKind;
  showLabels?: boolean;
  onSelectShape: (kind: ShapeKind) => void;
};

type ShapeTileProps = {
  entry: ShapeCatalogEntry;
  selected: boolean;
  showLabel: boolean;
  theme: ThemeColors;
  onPress: (kind: ShapeKind) => void;
};

const ShapeTile = memo(function ShapeTile({
  entry,
  selected,
  showLabel,
  theme,
  onPress,
}: ShapeTileProps) {
  const handlePress = useCallback(() => {
    onPress(entry.kind);
  }, [entry.kind, onPress]);

  return (
    <Pressable
      accessibilityRole={showLabel ? 'button' : 'radio'}
      accessibilityState={showLabel ? undefined : { selected }}
      accessibilityLabel={`Draw ${entry.label}`}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.tile,
        !showLabel && styles.tileCompact,
        {
          backgroundColor: selected ? theme.muted : theme.background,
          borderColor: selected ? theme.primary : theme.border,
        },
        pressed && styles.pressed,
      ]}
    >
      <ShapePreviewIcon
        kind={entry.kind}
        size={showLabel ? 22 : 18}
        color={selected ? theme.primary : theme.foreground}
      />
      {showLabel ? (
        <Text
          style={[
            styles.tileLabel,
            { color: selected ? theme.primary : theme.foreground },
          ]}
          numberOfLines={1}
        >
          {entry.label}
        </Text>
      ) : null}
    </Pressable>
  );
});

const keyExtractor = (item: ShapeCatalogEntry) => item.kind;

/**
 * Reusable, memoized 53-shape category browser with an optimized `FlatList` grid.
 * Shared by `QuickCreationSheet` and `ShapeOptionsSheet`.
 */
export const ShapeCatalogPicker = memo(function ShapeCatalogPicker({
  theme,
  selectedShape,
  showLabels = true,
  onSelectShape,
}: ShapeCatalogPickerProps) {
  const [category, setCategory] = useState<ShapeCategory>(
    () => (selectedShape ? SHAPE_CATALOG[selectedShape]?.category : undefined) ?? 'basic',
  );

  const items = useMemo(() => shapesByCategory(category), [category]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ShapeCatalogEntry>) => (
      <ShapeTile
        entry={item}
        selected={selectedShape === item.kind}
        showLabel={showLabels}
        theme={theme}
        onPress={onSelectShape}
      />
    ),
    [onSelectShape, selectedShape, showLabels, theme],
  );

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryRow}
      >
        {SHAPE_CATEGORIES.map((cat) => {
          const active = category === cat.id;
          return (
            <Pressable
              key={cat.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setCategory(cat.id)}
              style={[
                styles.categoryChip,
                {
                  backgroundColor: active ? theme.primary : theme.background,
                  borderColor: active ? theme.primary : theme.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  { color: active ? '#FFFFFF' : theme.foreground },
                ]}
              >
                {cat.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <FlatList
        data={items}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        numColumns={4}
        scrollEnabled={false}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.gridContent}
        initialNumToRender={16}
        maxToRenderPerBatch={16}
        windowSize={3}
        removeClippedSubviews
      />
    </View>
  );
});
