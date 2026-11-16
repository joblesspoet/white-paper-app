import { memo, useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { TidyMode } from '../canvas/auto-layout';
import type { ChartKind } from '../canvas/chart-generator';
import type { FunctionPlotObject } from '../canvas/document';
import type { ThemeColors } from '../theme';
import { FunctionPlotControls } from './FunctionPlotControls';
import { phoneStemSelectionBarStyles as styles } from './PhoneStemSelectionBar.styles';

export type PhoneStemSelectionBarProps = {
  theme: ThemeColors;
  bottomOffset: number;
  canTidySelection: boolean;
  canPlotMath: boolean;
  canChartTable: boolean;
  selectedFunctionPlot: FunctionPlotObject | null;
  onTidyLayout: (mode: TidyMode) => void;
  onPlotMath: () => void;
  onGenerateChart: (chartType: ChartKind) => void;
  onComputeTableStats: () => void;
  onUpdatePlotParam: (name: string, value: number, transient?: boolean) => void;
  onUpdateTangentX: (x0: number, transient?: boolean) => void;
  onTogglePlotTangent: () => void;
  onCommitPlotChanges: () => void;
};

const HIT_SLOP = { top: 4, bottom: 4, left: 2, right: 2 } as const;

export const PhoneStemSelectionBar = memo(function PhoneStemSelectionBar({
  theme,
  bottomOffset,
  canTidySelection,
  canPlotMath,
  canChartTable,
  selectedFunctionPlot,
  onTidyLayout,
  onPlotMath,
  onGenerateChart,
  onComputeTableStats,
  onUpdatePlotParam,
  onUpdateTangentX,
  onTogglePlotTangent,
  onCommitPlotChanges,
}: PhoneStemSelectionBarProps) {
  const handleGrid = useCallback(() => onTidyLayout('grid'), [onTidyLayout]);
  const handleRow = useCallback(() => onTidyLayout('row'), [onTidyLayout]);
  const handleCol = useCallback(() => onTidyLayout('column'), [onTidyLayout]);
  const handleBar = useCallback(() => onGenerateChart('bar'), [onGenerateChart]);
  const handleLine = useCallback(() => onGenerateChart('line'), [onGenerateChart]);
  const handlePie = useCallback(() => onGenerateChart('pie'), [onGenerateChart]);

  if (!canTidySelection && !canPlotMath && !canChartTable && !selectedFunctionPlot) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={[styles.wrapper, { bottom: bottomOffset }]}>
      {selectedFunctionPlot ? (
        <FunctionPlotControls
          plot={selectedFunctionPlot}
          theme={theme}
          compact
          onChangeParam={onUpdatePlotParam}
          onChangeTangentX={onUpdateTangentX}
          onToggleTangent={onTogglePlotTangent}
          onCommit={onCommitPlotChanges}
        />
      ) : (
        <View
          style={[
            styles.compactCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          {canTidySelection && (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tidy grid"
                hitSlop={HIT_SLOP}
                onPress={handleGrid}
                style={({ pressed }) => [
                  styles.chip,
                  { borderColor: theme.border, backgroundColor: theme.background },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.chipText, { color: theme.foreground }]}>Tidy grid</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Align row"
                hitSlop={HIT_SLOP}
                onPress={handleRow}
                style={({ pressed }) => [
                  styles.chip,
                  { borderColor: theme.border, backgroundColor: theme.background },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.chipText, { color: theme.foreground }]}>Align row</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Align column"
                hitSlop={HIT_SLOP}
                onPress={handleCol}
                style={({ pressed }) => [
                  styles.chip,
                  { borderColor: theme.border, backgroundColor: theme.background },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.chipText, { color: theme.foreground }]}>Align col</Text>
              </Pressable>
            </>
          )}

          {canPlotMath && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Plot graph"
              hitSlop={HIT_SLOP}
              onPress={onPlotMath}
              style={({ pressed }) => [
                styles.primaryChip,
                { backgroundColor: theme.primary },
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.primaryChipText}>Plot graph</Text>
            </Pressable>
          )}

          {canChartTable && (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Generate bar chart"
                hitSlop={HIT_SLOP}
                onPress={handleBar}
                style={({ pressed }) => [
                  styles.chip,
                  { borderColor: theme.border, backgroundColor: theme.background },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.chipText, { color: theme.foreground }]}>Bar</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Generate line chart"
                hitSlop={HIT_SLOP}
                onPress={handleLine}
                style={({ pressed }) => [
                  styles.chip,
                  { borderColor: theme.border, backgroundColor: theme.background },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.chipText, { color: theme.foreground }]}>Line</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Generate pie chart"
                hitSlop={HIT_SLOP}
                onPress={handlePie}
                style={({ pressed }) => [
                  styles.chip,
                  { borderColor: theme.border, backgroundColor: theme.background },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.chipText, { color: theme.foreground }]}>Pie</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Compute column statistics"
                hitSlop={HIT_SLOP}
                onPress={onComputeTableStats}
                style={({ pressed }) => [
                  styles.chip,
                  { borderColor: theme.primary, backgroundColor: `${theme.primary}1A` },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.chipText, { color: theme.primary }]}>Stats</Text>
              </Pressable>
            </>
          )}
        </View>
      )}
    </View>
  );
});
