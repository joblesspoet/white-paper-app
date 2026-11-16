import { memo, useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { TidyMode } from '../canvas/auto-layout';
import type { ChartKind } from '../canvas/chart-generator';
import type { FunctionPlotObject } from '../canvas/document';
import type { ThemeColors } from '../theme';
import { FunctionPlotControls } from './FunctionPlotControls';
import { stemInspectorSectionStyles as styles } from './StemInspectorSection.styles';

export type StemInspectorSectionProps = {
  theme: ThemeColors;
  canTidySelection: boolean;
  canPlotMath: boolean;
  canChartTable: boolean;
  selectedFunctionPlot: FunctionPlotObject | null;
  onTidyLayout?: (mode: TidyMode) => void;
  onPlotMath?: () => void;
  onGenerateChart?: (chartType: ChartKind) => void;
  onComputeTableStats?: () => void;
  onUpdatePlotParam?: (name: string, value: number, transient?: boolean) => void;
  onUpdateTangentX?: (x0: number, transient?: boolean) => void;
  onTogglePlotTangent?: () => void;
  onCommitPlotChanges?: () => void;
};

const HIT_SLOP = { top: 4, bottom: 4, left: 2, right: 2 } as const;

export const StemInspectorSection = memo(function StemInspectorSection({
  theme,
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
}: StemInspectorSectionProps) {
  const handleGrid = useCallback(() => onTidyLayout?.('grid'), [onTidyLayout]);
  const handleRow = useCallback(() => onTidyLayout?.('row'), [onTidyLayout]);
  const handleCol = useCallback(() => onTidyLayout?.('column'), [onTidyLayout]);

  const handleBar = useCallback(() => onGenerateChart?.('bar'), [onGenerateChart]);
  const handleLine = useCallback(() => onGenerateChart?.('line'), [onGenerateChart]);
  const handlePie = useCallback(() => onGenerateChart?.('pie'), [onGenerateChart]);

  if (!canTidySelection && !canPlotMath && !canChartTable && !selectedFunctionPlot) {
    return null;
  }

  return (
    <View style={styles.section}>
      {canTidySelection && onTidyLayout && (
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.foreground }]}>Tidy Up Layout</Text>
          <View style={styles.row}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tidy grid"
              hitSlop={HIT_SLOP}
              onPress={handleGrid}
              style={({ pressed }) => [
                styles.chipButton,
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
                styles.chipButton,
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
                styles.chipButton,
                { borderColor: theme.border, backgroundColor: theme.background },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.chipText, { color: theme.foreground }]}>Align col</Text>
            </Pressable>
          </View>
        </View>
      )}

      {canPlotMath && onPlotMath && (
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.foreground }]}>STEM Graphing</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Plot graph"
            onPress={onPlotMath}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: theme.primary },
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryText}>Plot graph</Text>
          </Pressable>
        </View>
      )}

      {canChartTable && onGenerateChart && onComputeTableStats && (
        <View style={styles.section}>
          <Text style={[styles.label, { color: theme.foreground }]}>Data & Charts</Text>
          <View style={styles.row}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Generate bar chart"
              hitSlop={HIT_SLOP}
              onPress={handleBar}
              style={({ pressed }) => [
                styles.chipButton,
                { borderColor: theme.border, backgroundColor: theme.background },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.chipText, { color: theme.foreground }]}>Bar chart</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Generate line chart"
              hitSlop={HIT_SLOP}
              onPress={handleLine}
              style={({ pressed }) => [
                styles.chipButton,
                { borderColor: theme.border, backgroundColor: theme.background },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.chipText, { color: theme.foreground }]}>Line chart</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Generate pie chart"
              hitSlop={HIT_SLOP}
              onPress={handlePie}
              style={({ pressed }) => [
                styles.chipButton,
                { borderColor: theme.border, backgroundColor: theme.background },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.chipText, { color: theme.foreground }]}>Pie chart</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Compute column statistics"
              hitSlop={HIT_SLOP}
              onPress={onComputeTableStats}
              style={({ pressed }) => [
                styles.chipButton,
                { borderColor: theme.primary, backgroundColor: `${theme.primary}1A` },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.chipText, { color: theme.primary }]}>Column stats</Text>
            </Pressable>
          </View>
        </View>
      )}

      {selectedFunctionPlot &&
        onUpdatePlotParam &&
        onUpdateTangentX &&
        onTogglePlotTangent &&
        onCommitPlotChanges && (
          <FunctionPlotControls
            plot={selectedFunctionPlot}
            theme={theme}
            onChangeParam={onUpdatePlotParam}
            onChangeTangentX={onUpdateTangentX}
            onToggleTangent={onTogglePlotTangent}
            onCommit={onCommitPlotChanges}
          />
        )}
    </View>
  );
});
