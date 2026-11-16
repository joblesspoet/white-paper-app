import { memo, useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type ListRenderItemInfo,
} from 'react-native';

import type { FunctionPlotObject } from '../canvas/document';
import { evaluateFunctionPlot } from '../canvas/function-plotter';
import type { ThemeColors } from '../theme';
import { functionPlotControlsStyles as styles } from './FunctionPlotControls.styles';

type SliderRowItem = {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  isTangent?: boolean;
};

export type FunctionPlotControlsProps = {
  plot: FunctionPlotObject;
  theme: ThemeColors;
  compact?: boolean;
  onChangeParam: (name: string, value: number, transient?: boolean) => void;
  onChangeTangentX: (x0: number, transient?: boolean) => void;
  onToggleTangent: () => void;
  onCommit: () => void;
};

const STEP_HIT_SLOP = { top: 7, bottom: 7, left: 4, right: 4 } as const;

const ParameterSliderRow = memo(function ParameterSliderRow({
  item,
  theme,
  onChange,
  onCommit,
}: {
  item: SliderRowItem;
  theme: ThemeColors;
  onChange: (item: SliderRowItem, nextValue: number, transient: boolean) => void;
  onCommit: () => void;
}) {
  const [trackWidth, setTrackWidth] = useState(120);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const w = event.nativeEvent.layout.width;
    if (w > 10) setTrackWidth(w);
  }, []);

  const valueFromLocation = useCallback(
    (locationX: number) => {
      const ratio = Math.max(0, Math.min(1, locationX / Math.max(1, trackWidth)));
      const raw = item.min + ratio * (item.max - item.min);
      return Math.round(raw * 10) / 10;
    },
    [item.max, item.min, trackWidth],
  );

  const handleTouchMove = useCallback(
    (event: GestureResponderEvent) => {
      onChange(item, valueFromLocation(event.nativeEvent.locationX), true);
    },
    [item, onChange, valueFromLocation],
  );

  const handleTouchRelease = useCallback(
    (event: GestureResponderEvent) => {
      onChange(item, valueFromLocation(event.nativeEvent.locationX), false);
      onCommit();
    },
    [item, onChange, onCommit, valueFromLocation],
  );

  const handleDecrement = useCallback(() => {
    onChange(item, Math.max(item.min, Math.round((item.value - item.step) * 10) / 10), false);
  }, [item, onChange]);

  const handleIncrement = useCallback(() => {
    onChange(item, Math.min(item.max, Math.round((item.value + item.step) * 10) / 10), false);
  }, [item, onChange]);

  const pct = Math.max(
    0,
    Math.min(100, ((item.value - item.min) / Math.max(0.01, item.max - item.min)) * 100),
  );

  return (
    <View style={styles.sliderRow}>
      <Text style={[styles.paramBadge, { color: theme.foreground }]}>
        {item.label}={item.value.toFixed(1)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Decrease ${item.label}`}
        hitSlop={STEP_HIT_SLOP}
        onPress={handleDecrement}
        style={({ pressed }) => [
          styles.stepButton,
          { borderColor: theme.border, backgroundColor: theme.background },
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.stepText, { color: theme.foreground }]}>−</Text>
      </Pressable>

      <View
        onLayout={handleLayout}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={handleTouchMove}
        onResponderMove={handleTouchMove}
        onResponderRelease={handleTouchRelease}
        accessibilityRole="adjustable"
        accessibilityLabel={`${item.label} slider`}
        style={styles.trackWrap}
      >
        <View style={[styles.trackBg, { backgroundColor: theme.border }]}>
          <View style={[styles.trackFill, { width: `${pct}%`, backgroundColor: theme.primary }]} />
          <View style={[styles.thumb, { left: `${pct}%`, backgroundColor: theme.primary }]} />
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Increase ${item.label}`}
        hitSlop={STEP_HIT_SLOP}
        onPress={handleIncrement}
        style={({ pressed }) => [
          styles.stepButton,
          { borderColor: theme.border, backgroundColor: theme.background },
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.stepText, { color: theme.foreground }]}>+</Text>
      </Pressable>
    </View>
  );
});

export const FunctionPlotControls = memo(function FunctionPlotControls({
  plot,
  theme,
  compact = false,
  onChangeParam,
  onChangeTangentX,
  onToggleTangent,
  onCommit,
}: FunctionPlotControlsProps) {
  const sampled = useMemo(() => evaluateFunctionPlot(plot), [plot]);

  const sliderItems = useMemo<SliderRowItem[]>(() => {
    const items: SliderRowItem[] = plot.parameterNames.map((name) => ({
      id: `param-${name}`,
      label: name,
      value: plot.params[name] ?? 1,
      min: -5,
      max: 5,
      step: 0.5,
    }));
    if (plot.showTangent) {
      items.push({
        id: 'tangent-x0',
        label: 'x₀',
        value: plot.tangentX,
        min: plot.xMin,
        max: plot.xMax,
        step: 0.5,
        isTangent: true,
      });
    }
    return items;
  }, [plot.parameterNames, plot.params, plot.showTangent, plot.tangentX, plot.xMax, plot.xMin]);

  const handleSliderChange = useCallback(
    (item: SliderRowItem, nextValue: number, transient: boolean) => {
      if (item.isTangent) {
        onChangeTangentX(nextValue, transient);
      } else {
        onChangeParam(item.label, nextValue, transient);
      }
    },
    [onChangeParam, onChangeTangentX],
  );

  const keyExtractor = useCallback((item: SliderRowItem) => item.id, []);

  const renderSlider = useCallback(
    ({ item }: ListRenderItemInfo<SliderRowItem>) => (
      <ParameterSliderRow
        item={item}
        theme={theme}
        onChange={handleSliderChange}
        onCommit={onCommit}
      />
    ),
    [handleSliderChange, onCommit, theme],
  );

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Text numberOfLines={1} style={[styles.title, { color: theme.foreground }]}>
          Graph: {plot.latex}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Toggle tangent line"
          accessibilityState={{ selected: plot.showTangent }}
          onPress={onToggleTangent}
          style={({ pressed }) => [
            styles.tangentToggle,
            {
              borderColor: plot.showTangent ? theme.primary : theme.border,
              backgroundColor: plot.showTangent ? `${theme.primary}1F` : theme.background,
            },
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.tangentLabel,
              { color: plot.showTangent ? theme.primary : theme.foreground },
            ]}
          >
            {plot.showTangent ? 'Tangent On' : 'Tangent'}
          </Text>
        </Pressable>
      </View>

      {sliderItems.length > 0 && (
        <FlatList
          data={sliderItems}
          keyExtractor={keyExtractor}
          renderItem={renderSlider}
          scrollEnabled={sliderItems.length > (compact ? 2 : 3)}
          style={styles.sliderList}
          showsVerticalScrollIndicator={false}
        />
      )}

      {sampled.keyPoints.length > 0 && (
        <View style={styles.keyPointsRow}>
          {sampled.keyPoints.slice(0, 4).map((kp, idx) => (
            <View
              key={`${kp.kind}-${idx}`}
              style={[
                styles.keyPointChip,
                { borderColor: theme.border, backgroundColor: theme.background },
              ]}
            >
              <Text style={[styles.keyPointText, { color: theme.foreground }]}>
                {kp.kind === 'root' ? 'Root' : kp.kind === 'y-intercept' ? 'y-int' : 'Ext'}:{' '}
                {kp.label}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
});
