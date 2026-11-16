/**
 * Numeric extraction, column summary statistics, and vector Bar / Line / Pie
 * chart geometry generator for `TableObject` canvas objects.
 *
 * Pure TypeScript so the live Skia renderer, offscreen PNG/PDF export,
 * inspector actions, and Node tests share the exact same geometry.
 */

import type { StickyObject } from './document.ts';
import { STICKY_TEXT_COLOR } from './document.ts';
import type { TableObjectBase } from './table.ts';
import type { Point } from './viewport.ts';

export type ChartKind = 'bar' | 'line' | 'pie';

export type ChartSeries = {
  name: string;
  values: number[];
  colorKey: string;
};

export type ChartObjectBase = {
  type: 'chart';
  chartType: ChartKind;
  title: string;
  labels: string[];
  series: ChartSeries[];
  colorKey: string;
  sourceTableId?: string;
};

export type ColumnStatistics = {
  columnIndex: number;
  label: string;
  count: number;
  sum: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  stdDev: number;
};

export type ExtractedTableData = {
  labels: string[];
  series: ChartSeries[];
  isNumeric: boolean;
};

export const DEFAULT_CHART_WIDTH = 280;
export const DEFAULT_CHART_HEIGHT = 210;
export const CHART_SERIES_COLORS = ['teal', 'blue', 'amber', 'violet', 'rose', 'green'] as const;

export function parseNumericCell(raw: string): number | null {
  const cleaned = raw.trim().replace(/[$,%\s]/g, '').replace(/,/g, '');
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

/**
 * Extracts category labels (column 0) and numeric data series from a `TableObject`.
 * Falls back to using column 0 itself as a numeric series if the table is a
 * single-column numeric list.
 */
export function extractTableNumericData(table: TableObjectBase): ExtractedTableData {
  const startRow = table.hasHeaderRow && table.rows > 1 ? 1 : 0;
  const rowCount = Math.max(0, table.rows - startRow);
  if (rowCount === 0) {
    return { labels: [], series: [], isNumeric: false };
  }

  const getCellText = (r: number, c: number): string =>
    (table.cells[r * table.columns + c]?.text ?? '').trim();

  const labels: string[] = [];
  for (let r = startRow; r < table.rows; r += 1) {
    const rawLabel = getCellText(r, 0);
    labels.push(rawLabel || `Row ${r + 1}`);
  }

  const startCol = table.columns > 1 ? 1 : 0;
  const series: ChartSeries[] = [];
  let totalNumericValues = 0;

  for (let c = startCol; c < table.columns; c += 1) {
    const values: number[] = [];
    let validInCol = 0;
    for (let r = startRow; r < table.rows; r += 1) {
      const parsed = parseNumericCell(getCellText(r, c));
      if (parsed !== null) {
        validInCol += 1;
        values.push(parsed);
      } else {
        values.push(0);
      }
    }
    if (validInCol > 0) {
      totalNumericValues += validInCol;
      const headerName = table.hasHeaderRow ? getCellText(0, c) : '';
      series.push({
        name: headerName || `Series ${series.length + 1}`,
        values,
        colorKey: CHART_SERIES_COLORS[series.length % CHART_SERIES_COLORS.length],
      });
    }
  }

  return {
    labels,
    series,
    isNumeric: series.length > 0 && totalNumericValues >= 2,
  };
}

/**
 * Computes `Sum`, `Mean`, `Median`, `Min`, `Max`, and `Std Dev` for every
 * numeric column in `table`.
 */
export function computeTableColumnStats(table: TableObjectBase): ColumnStatistics[] {
  const startRow = table.hasHeaderRow && table.rows > 1 ? 1 : 0;
  const stats: ColumnStatistics[] = [];
  const getCellText = (r: number, c: number): string =>
    (table.cells[r * table.columns + c]?.text ?? '').trim();

  for (let c = 0; c < table.columns; c += 1) {
    const nums: number[] = [];
    for (let r = startRow; r < table.rows; r += 1) {
      const parsed = parseNumericCell(getCellText(r, c));
      if (parsed !== null) nums.push(parsed);
    }
    if (nums.length === 0) continue;

    const sorted = [...nums].sort((a, b) => a - b);
    const sum = nums.reduce((acc, v) => acc + v, 0);
    const mean = sum / nums.length;
    const mid = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    const variance = nums.reduce((acc, v) => acc + (v - mean) ** 2, 0) / nums.length;
    const stdDev = Math.sqrt(variance);
    const header = table.hasHeaderRow ? getCellText(0, c) : '';

    stats.push({
      columnIndex: c,
      label: header || `Col ${c + 1}`,
      count: nums.length,
      sum,
      mean,
      median,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      stdDev,
    });
  }

  return stats;
}

function fmtStat(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/\.?0+$/, '');
}

/**
 * Creates a formatted statistics summary `StickyObject` card placed cleanly
 * beside `table`.
 */
export function buildTableStatsSummaryCard(
  table: TableObjectBase,
  stats: readonly ColumnStatistics[],
  id: string,
): StickyObject | null {
  if (stats.length === 0) return null;
  const blocks = stats.map(
    (col) =>
      `${col.label} (n=${col.count})\n` +
      `Sum: ${fmtStat(col.sum)} · Mean: ${fmtStat(col.mean)}\n` +
      `Med: ${fmtStat(col.median)} · SD: ${fmtStat(col.stdDev)}\n` +
      `Min/Max: ${fmtStat(col.min)} / ${fmtStat(col.max)}`,
  );
  const text = blocks.join('\n\n');
  const lines = text.split('\n').length;
  const width = 236;
  const height = Math.max(124, lines * 18 + 20);

  return {
    id,
    type: 'sticky',
    text,
    x: Math.round(table.x + table.width + 24),
    y: Math.round(table.y),
    width,
    height,
    rotation: 0,
    colorKey: 'aqua',
    fontSize: 13,
    fontWeight: 'normal',
    fontStyle: 'normal',
  };
}

export function createChartObjectFromTable(input: {
  id: string;
  table: TableObjectBase;
  chartType: ChartKind;
  colorKey?: string;
}): ChartObjectBase & {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
} | null {
  const extracted = extractTableNumericData(input.table);
  if (!extracted.isNumeric) return null;
  const title =
    input.chartType === 'bar'
      ? 'Bar Chart'
      : input.chartType === 'line'
        ? 'Line Chart'
        : 'Pie Chart';

  return {
    id: input.id,
    type: 'chart',
    chartType: input.chartType,
    title,
    labels: extracted.labels,
    series: extracted.series,
    colorKey: input.colorKey ?? input.table.colorKey,
    sourceTableId: input.table.id,
    x: Math.round(input.table.x + input.table.width + 24),
    y: Math.round(input.table.y),
    width: DEFAULT_CHART_WIDTH,
    height: DEFAULT_CHART_HEIGHT,
    rotation: 0,
  };
}

// -------------------------------------------------- vector chart primitives

export type ChartBarPrimitive = {
  x: number;
  y: number;
  width: number;
  height: number;
  colorKey: string;
};

export type ChartLinePrimitive = {
  points: Point[];
  colorKey: string;
};

export type ChartPieSlicePrimitive = {
  pathSvg: string;
  colorKey: string;
  label: string;
  percentLabel: string;
  labelPos: Point;
};

export type ChartRenderPrimitives = {
  plotArea: { x: number; y: number; width: number; height: number };
  bars: ChartBarPrimitive[];
  lines: ChartLinePrimitive[];
  pieSlices: ChartPieSlicePrimitive[];
  xLabels: ReadonlyArray<{ text: string; x: number; y: number }>;
  yTicks: ReadonlyArray<{ label: string; y: number }>;
};

const n = (v: number): string => String(Math.round(v * 100) / 100);

function pieSliceArcSvg(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const span = endAngle - startAngle;
  if (span >= Math.PI * 1.999) {
    return (
      `M ${n(cx - r)} ${n(cy)} ` +
      `A ${n(r)} ${n(r)} 0 1 0 ${n(cx + r)} ${n(cy)} ` +
      `A ${n(r)} ${n(r)} 0 1 0 ${n(cx - r)} ${n(cy)} Z`
    );
  }
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);
  const largeArc = span > Math.PI ? 1 : 0;
  return `M ${n(cx)} ${n(cy)} L ${n(x1)} ${n(y1)} A ${n(r)} ${n(r)} 0 ${largeArc} 1 ${n(x2)} ${n(y2)} Z`;
}

/**
 * Generates shared vector chart primitives for Skia live rendering and
 * offscreen PNG/JPEG/PDF export.
 */
export function buildChartRenderPrimitives(
  chart: ChartObjectBase & { x: number; y: number; width: number; height: number },
): ChartRenderPrimitives {
  const padLeft = 38;
  const padRight = 16;
  const padTop = 30;
  const padBottom = 28;
  const plotArea = {
    x: chart.x + padLeft,
    y: chart.y + padTop,
    width: Math.max(40, chart.width - padLeft - padRight),
    height: Math.max(40, chart.height - padTop - padBottom),
  };

  if (chart.chartType === 'pie') {
    const firstSeries = chart.series[0]?.values ?? [];
    const positives = firstSeries.map((v) => Math.max(0, v));
    const total = positives.reduce((acc, v) => acc + v, 0);
    const pieSlices: ChartPieSlicePrimitive[] = [];

    if (total > 0) {
      const cx = chart.x + chart.width * 0.42;
      const cy = chart.y + padTop + (chart.height - padTop - 16) / 2;
      const radius = Math.max(20, Math.min(chart.width * 0.28, (chart.height - padTop - 20) * 0.46));
      let angle = -Math.PI / 2;

      positives.forEach((val, idx) => {
        if (val <= 0) return;
        const sweep = (val / total) * Math.PI * 2;
        const mid = angle + sweep / 2;
        const pct = Math.round((val / total) * 100);
        pieSlices.push({
          pathSvg: pieSliceArcSvg(cx, cy, radius, angle, angle + sweep),
          colorKey: CHART_SERIES_COLORS[idx % CHART_SERIES_COLORS.length],
          label: chart.labels[idx] ?? `Item ${idx + 1}`,
          percentLabel: `${pct}%`,
          labelPos: {
            x: cx + radius * 0.62 * Math.cos(mid),
            y: cy + radius * 0.62 * Math.sin(mid),
          },
        });
        angle += sweep;
      });
    }

    return { plotArea, bars: [], lines: [], pieSlices, xLabels: [], yTicks: [] };
  }

  const allValues = chart.series.flatMap((s) => s.values);
  const rawMax = Math.max(1, ...allValues);
  const rawMin = Math.min(0, ...allValues);
  const span = Math.max(1e-3, rawMax - rawMin);

  const yForValue = (v: number): number =>
    plotArea.y + plotArea.height - ((v - rawMin) / span) * plotArea.height;

  const yTicks = [rawMin, (rawMin + rawMax) / 2, rawMax].map((v) => ({
    label: fmtStat(v),
    y: yForValue(v),
  }));

  const count = Math.max(1, chart.labels.length);
  const stepX = plotArea.width / count;
  const xLabels = chart.labels.map((text, idx) => ({
    text: text.slice(0, 8),
    x: plotArea.x + stepX * idx + stepX / 2,
    y: plotArea.y + plotArea.height + 14,
  }));

  if (chart.chartType === 'bar') {
    const seriesCount = Math.max(1, chart.series.length);
    const groupWidth = stepX * 0.72;
    const barWidth = Math.max(4, groupWidth / seriesCount);
    const baselineY = yForValue(0);
    const bars: ChartBarPrimitive[] = [];

    chart.series.forEach((s, sIdx) => {
      for (let i = 0; i < count; i += 1) {
        const val = s.values[i] ?? 0;
        const valY = yForValue(val);
        const top = Math.min(baselineY, valY);
        const h = Math.max(2, Math.abs(baselineY - valY));
        const x =
          plotArea.x +
          i * stepX +
          (stepX - groupWidth) / 2 +
          sIdx * barWidth;
        bars.push({
          x,
          y: top,
          width: Math.max(3, barWidth - 2),
          height: h,
          colorKey: s.colorKey,
        });
      }
    });

    return { plotArea, bars, lines: [], pieSlices: [], xLabels, yTicks };
  }

  // 'line' chart
  const lines: ChartLinePrimitive[] = chart.series.map((s) => ({
    colorKey: s.colorKey,
    points: chart.labels.map((_, idx) => ({
      x: plotArea.x + stepX * idx + stepX / 2,
      y: yForValue(s.values[idx] ?? 0),
    })),
  }));

  return { plotArea, bars: [], lines, pieSlices: [], xLabels, yTicks };
}

export function chartLegendColorFallback(): string {
  return STICKY_TEXT_COLOR;
}
