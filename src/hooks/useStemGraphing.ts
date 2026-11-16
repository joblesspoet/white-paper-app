import { useCallback, useMemo } from 'react';

import {
  buildTableStatsSummaryCard,
  computeTableColumnStats,
  createChartObjectFromTable,
  extractTableNumericData,
  type ChartKind,
} from '../canvas/chart-generator';
import { isPlottableMathLatex } from '../canvas/function-plotter';
import {
  createFunctionPlotObject,
  type CanvasObject,
  type DocumentCommand,
  type FunctionPlotObject,
  type MathObject,
  type TableObject,
} from '../canvas/document';

export type UseStemGraphingParams = {
  selectedObjects: readonly CanvasObject[];
  isReadOnly?: boolean;
  dispatchCommand: (command: DocumentCommand, transient?: boolean) => void;
  commitPending: () => void;
  setSelectedIds: (ids: string[]) => void;
};

export function useStemGraphing({
  selectedObjects,
  isReadOnly = false,
  dispatchCommand,
  commitPending,
  setSelectedIds,
}: UseStemGraphingParams) {
  const singleObject = selectedObjects.length === 1 ? selectedObjects[0] : null;

  const plottableMath = useMemo<MathObject | null>(() => {
    if (isReadOnly || !singleObject || singleObject.type !== 'math') return null;
    return isPlottableMathLatex(singleObject.latex) ? singleObject : null;
  }, [isReadOnly, singleObject]);

  const selectedFunctionPlot = useMemo<FunctionPlotObject | null>(() => {
    if (isReadOnly || !singleObject || singleObject.type !== 'function-plot') return null;
    return singleObject;
  }, [isReadOnly, singleObject]);

  const numericTable = useMemo<TableObject | null>(() => {
    if (isReadOnly || !singleObject || singleObject.type !== 'table') return null;
    return extractTableNumericData(singleObject).isNumeric ? singleObject : null;
  }, [isReadOnly, singleObject]);

  const handlePlotMathObject = useCallback(() => {
    if (!plottableMath || isReadOnly) return;
    const id = `plot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const plot = createFunctionPlotObject({
      id,
      latex: plottableMath.latex,
      colorKey: plottableMath.colorKey,
      sourceMathId: plottableMath.id,
      point: {
        x: plottableMath.x + plottableMath.width / 2,
        y: plottableMath.y + plottableMath.height + 148,
      },
    });
    if (!plot) return;
    dispatchCommand({ type: 'object.insert', object: plot });
    setSelectedIds([plot.id]);
  }, [dispatchCommand, isReadOnly, plottableMath, setSelectedIds]);

  const handleUpdatePlotParam = useCallback(
    (paramName: string, value: number, transient = false) => {
      if (!selectedFunctionPlot || isReadOnly) return;
      const clamped = Math.round(Math.max(-5, Math.min(5, value)) * 100) / 100;
      dispatchCommand(
        {
          type: 'object.update',
          id: selectedFunctionPlot.id,
          functionPlot: {
            params: { ...selectedFunctionPlot.params, [paramName]: clamped },
          },
        },
        transient,
      );
      if (!transient) commitPending();
    },
    [commitPending, dispatchCommand, isReadOnly, selectedFunctionPlot],
  );

  const handleCommitPlotChanges = useCallback(() => {
    commitPending();
  }, [commitPending]);

  const handleTogglePlotTangent = useCallback(() => {
    if (!selectedFunctionPlot || isReadOnly) return;
    dispatchCommand({
      type: 'object.update',
      id: selectedFunctionPlot.id,
      functionPlot: {
        showTangent: !selectedFunctionPlot.showTangent,
      },
    });
  }, [dispatchCommand, isReadOnly, selectedFunctionPlot]);

  const handleUpdateTangentX = useCallback(
    (tangentX: number, transient = false) => {
      if (!selectedFunctionPlot || isReadOnly) return;
      const clamped =
        Math.round(
          Math.max(selectedFunctionPlot.xMin, Math.min(selectedFunctionPlot.xMax, tangentX)) * 100,
        ) / 100;
      dispatchCommand(
        {
          type: 'object.update',
          id: selectedFunctionPlot.id,
          functionPlot: { tangentX: clamped },
        },
        transient,
      );
      if (!transient) commitPending();
    },
    [commitPending, dispatchCommand, isReadOnly, selectedFunctionPlot],
  );

  const handleGenerateChart = useCallback(
    (chartType: ChartKind) => {
      if (!numericTable || isReadOnly) return;
      const id = `chart-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const chart = createChartObjectFromTable({
        id,
        table: numericTable,
        chartType,
      });
      if (!chart) return;
      dispatchCommand({ type: 'object.insert', object: chart });
      setSelectedIds([chart.id]);
    },
    [dispatchCommand, isReadOnly, numericTable, setSelectedIds],
  );

  const handleComputeTableStats = useCallback(() => {
    if (!numericTable || isReadOnly) return;
    const stats = computeTableColumnStats(numericTable);
    const id = `stats-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const card = buildTableStatsSummaryCard(numericTable, stats, id);
    if (!card) return;
    dispatchCommand({ type: 'object.insert', object: card });
    setSelectedIds([card.id]);
  }, [dispatchCommand, isReadOnly, numericTable, setSelectedIds]);

  return {
    plottableMath,
    selectedFunctionPlot,
    numericTable,
    handlePlotMathObject,
    handleUpdatePlotParam,
    handleCommitPlotChanges,
    handleTogglePlotTangent,
    handleUpdateTangentX,
    handleGenerateChart,
    handleComputeTableStats,
  };
}
