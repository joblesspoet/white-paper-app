import { Group, Line as SkiaLine, Rect, RoundedRect, vec } from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import {
  tableCellRect,
  tableColumnWidths,
  tableRowHeight,
  textColorValue,
  type TableObject,
} from '../../canvas/document';
import { styles } from '../CanvasViewport.styles';

export const TableCellsOverlay = memo(function TableCellsOverlay({
  object,
  dark,
  editingCell,
  offsetX,
  offsetY,
  scale,
}: {
  object: TableObject;
  dark: boolean;
  editingCell: { row: number; col: number } | null;
  offsetX: SharedValue<number>;
  offsetY: SharedValue<number>;
  scale: SharedValue<number>;
}) {
  const color = textColorValue(object.colorKey, dark);
  const frame = useAnimatedStyle(() => ({
    left: object.x * scale.value + offsetX.value,
    top: object.y * scale.value + offsetY.value,
    width: object.width * scale.value,
    height: object.height * scale.value,
    transform: [{ rotate: `${object.rotation}deg` }],
  }));

  const rowH = useMemo(() => tableRowHeight(object), [object]);
  const widths = useMemo(() => tableColumnWidths(object), [object]);

  return (
    <Animated.View pointerEvents="none" style={[styles.object, frame]}>
      {Array.from({ length: object.rows }, (_, r) =>
        Array.from({ length: object.columns }, (__, c) => {
          const cell = object.cells[r * object.columns + c];
          const isEditing = editingCell?.row === r && editingCell?.col === c;
          if (!cell?.text || isEditing) return null;
          const rect = tableCellRect(object, r, c);
          const relLeftPct = ((rect.x - object.x) / Math.max(1, object.width)) * 100;
          const relTopPct = ((rect.y - object.y) / Math.max(1, object.height)) * 100;
          const relWPct = (widths[c] / Math.max(1, object.width)) * 100;
          const relHPct = (rowH / Math.max(1, object.height)) * 100;
          const isHeader = object.hasHeaderRow && r === 0;
          return (
            <View
              key={`${r}-${c}`}
              style={[
                styles.tableCellOverlay,
                {
                  left: `${relLeftPct}%`,
                  top: `${relTopPct}%`,
                  width: `${relWPct}%`,
                  height: `${relHPct}%`,
                },
              ]}
            >
              <Text
                numberOfLines={3}
                style={{
                  color,
                  fontSize: Math.max(9, object.fontSize),
                  fontWeight: isHeader ? '700' : '400',
                  textAlign: cell.align ?? 'left',
                }}
              >
                {cell.text}
              </Text>
            </View>
          );
        }),
      )}
    </Animated.View>
  );
});

export const TableObjectView = memo(function TableObjectView({
  object,
  dark,
}: {
  object: TableObject;
  dark: boolean;
}) {
  const borderColor = textColorValue(object.colorKey, dark);
  const origin = useMemo(
    () => ({
      x: object.x + object.width / 2,
      y: object.y + object.height / 2,
    }),
    [object.height, object.width, object.x, object.y],
  );
  const transform = useMemo(
    () =>
      object.rotation === 0
        ? undefined
        : [{ rotate: (object.rotation * Math.PI) / 180 }],
    [object.rotation],
  );
  const rowH = useMemo(() => tableRowHeight(object), [object]);
  const widths = useMemo(() => tableColumnWidths(object), [object]);

  const colLines = useMemo(() => {
    const lines: number[] = [];
    let accX = object.x;
    for (let c = 0; c < object.columns - 1; c += 1) {
      accX += widths[c];
      lines.push(accX);
    }
    return lines;
  }, [object.columns, object.x, widths]);

  return (
    <Group origin={origin} transform={transform}>
      {object.hasHeaderRow && object.fillHeader && object.rows >= 1 ? (
        <Rect
          x={object.x}
          y={object.y}
          width={object.width}
          height={rowH}
          color={borderColor}
          opacity={0.12}
          style="fill"
        />
      ) : null}
      {Array.from({ length: Math.max(0, object.rows - 1) }, (_, idx) => {
        const ly = object.y + (idx + 1) * rowH;
        return (
          <SkiaLine
            key={`r-${idx}`}
            p1={vec(object.x, ly)}
            p2={vec(object.x + object.width, ly)}
            color={borderColor}
            strokeWidth={1}
            opacity={0.45}
          />
        );
      })}
      {colLines.map((lx, idx) => (
        <SkiaLine
          key={`c-${idx}`}
          p1={vec(lx, object.y)}
          p2={vec(lx, object.y + object.height)}
          color={borderColor}
          strokeWidth={1}
          opacity={0.45}
        />
      ))}
      <RoundedRect
        x={object.x}
        y={object.y}
        width={object.width}
        height={object.height}
        r={6}
        color={borderColor}
        style="stroke"
        strokeWidth={1.5}
      />
    </Group>
  );
});
