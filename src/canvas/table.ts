/**
 * Pure geometry and data helpers for `TableObject` canvas objects.
 */

import type { Point } from './viewport.ts';

export type TableCell = {
  text: string;
  align?: 'left' | 'center' | 'right';
};

export type TableObjectBase = {
  id: string;
  type: 'table';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  rows: number;
  columns: number;
  /** Normalized column width ratios summing to 1.0 (e.g. [0.33, 0.33, 0.34]). */
  columnRatios: readonly number[];
  /** Row-major cell matrix of length `rows * columns`. */
  cells: readonly TableCell[];
  hasHeaderRow: boolean;
  colorKey: string;
  fillHeader: boolean;
  fontSize: number;
};

export const DEFAULT_TABLE_CELL_WIDTH = 96;
export const DEFAULT_TABLE_ROW_HEIGHT = 40;
export const DEFAULT_TABLE_FONT_SIZE = 14;
export const DEFAULT_TABLE_COLOR = 'ink';
export const MAX_TABLE_ROWS = 12;
export const MAX_TABLE_COLUMNS = 8;
export const TABLE_FONT_SIZES = [12, 14, 18] as const;

export const TABLE_PRESETS: ReadonlyArray<{ rows: number; columns: number; label: string }> = [
  { rows: 2, columns: 2, label: '2×2' },
  { rows: 3, columns: 3, label: '3×3' },
  { rows: 4, columns: 3, label: '4×3' },
  { rows: 4, columns: 4, label: '4×4' },
] as const;

export function equalColumnRatios(columns: number): number[] {
  const safeCols = Math.max(1, Math.min(MAX_TABLE_COLUMNS, Math.round(columns)));
  const base = 1 / safeCols;
  const ratios = Array.from({ length: safeCols }, () => base);
  const sumExceptLast = ratios.slice(0, -1).reduce((a, b) => a + b, 0);
  ratios[safeCols - 1] = Math.max(0.01, 1 - sumExceptLast);
  return ratios;
}

export function normalizeColumnRatios(ratios: readonly number[], columns: number): number[] {
  const safeCols = Math.max(1, columns);
  if (ratios.length !== safeCols) return equalColumnRatios(safeCols);
  const total = ratios.reduce((acc, v) => acc + (Number.isFinite(v) && v > 0 ? v : 0), 0);
  if (total <= 0) return equalColumnRatios(safeCols);
  return ratios.map((v) => (Number.isFinite(v) && v > 0 ? v / total : 1 / safeCols));
}

export type CreateTableInput = {
  id: string;
  /** Center point in canvas space where the table is placed. */
  point: Point;
  rows: number;
  columns: number;
  colorKey?: string;
  hasHeaderRow?: boolean;
  fillHeader?: boolean;
  fontSize?: number;
};

export function createTableObject({
  id,
  point,
  rows,
  columns,
  colorKey = DEFAULT_TABLE_COLOR,
  hasHeaderRow = true,
  fillHeader = true,
  fontSize = DEFAULT_TABLE_FONT_SIZE,
}: CreateTableInput): TableObjectBase {
  const safeRows = Math.max(1, Math.min(MAX_TABLE_ROWS, Math.round(rows)));
  const safeCols = Math.max(1, Math.min(MAX_TABLE_COLUMNS, Math.round(columns)));
  const width = safeCols * DEFAULT_TABLE_CELL_WIDTH;
  const height = safeRows * DEFAULT_TABLE_ROW_HEIGHT;
  const cells: TableCell[] = Array.from({ length: safeRows * safeCols }, () => ({ text: '' }));
  return {
    id,
    type: 'table',
    x: Math.round(point.x - width / 2),
    y: Math.round(point.y - height / 2),
    width,
    height,
    rotation: 0,
    rows: safeRows,
    columns: safeCols,
    columnRatios: equalColumnRatios(safeCols),
    cells,
    hasHeaderRow,
    colorKey,
    fillHeader,
    fontSize,
  };
}

export function tableColumnWidths(table: TableObjectBase): number[] {
  const ratios = normalizeColumnRatios(table.columnRatios, table.columns);
  return ratios.map((r) => table.width * r);
}

export function tableRowHeight(table: TableObjectBase): number {
  return table.height / Math.max(1, table.rows);
}

/** Unrotated canvas-space bounding box of cell `(row, col)`. */
export function tableCellRect(
  table: TableObjectBase,
  row: number,
  col: number,
): { x: number; y: number; width: number; height: number } {
  const widths = tableColumnWidths(table);
  const rowH = tableRowHeight(table);
  let cellX = table.x;
  for (let c = 0; c < col; c += 1) {
    cellX += widths[c] ?? 0;
  }
  return {
    x: cellX,
    y: table.y + row * rowH,
    width: widths[col] ?? 0,
    height: rowH,
  };
}

function rotatePointLocal(point: Point, centre: Point, degrees: number): Point {
  if (degrees === 0) return point;
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = point.x - centre.x;
  const dy = point.y - centre.y;
  return {
    x: centre.x + dx * cos - dy * sin,
    y: centre.y + dx * sin + dy * cos,
  };
}

/**
 * Rotation-aware cell hit test: returns `{ row, col }` if `point` (in canvas
 * space) falls inside `table`, or `null` otherwise.
 */
export function tableCellAtPoint(
  table: TableObjectBase,
  point: Point,
): { row: number; col: number } | null {
  const local = table.rotation === 0
    ? point
    : rotatePointLocal(
        point,
        { x: table.x + table.width / 2, y: table.y + table.height / 2 },
        -table.rotation,
      );
  if (
    local.x < table.x ||
    local.x > table.x + table.width ||
    local.y < table.y ||
    local.y > table.y + table.height
  ) {
    return null;
  }
  const rowH = tableRowHeight(table);
  const row = Math.max(0, Math.min(table.rows - 1, Math.floor((local.y - table.y) / rowH)));
  const widths = tableColumnWidths(table);
  let accX = table.x;
  for (let col = 0; col < table.columns; col += 1) {
    accX += widths[col];
    if (local.x <= accX || col === table.columns - 1) {
      return { row, col };
    }
  }
  return { row, col: table.columns - 1 };
}

export function withTableCellText<T extends TableObjectBase>(
  table: T,
  row: number,
  col: number,
  text: string,
): T {
  if (row < 0 || row >= table.rows || col < 0 || col >= table.columns) return table;
  const idx = row * table.columns + col;
  const existing = table.cells[idx];
  if (existing && existing.text === text) return table;
  const cells = table.cells.map((cell, i) => (i === idx ? { ...cell, text } : cell));
  return { ...table, cells };
}

export function withTableRowAdded<T extends TableObjectBase>(table: T): T {
  if (table.rows >= MAX_TABLE_ROWS) return table;
  const rowH = tableRowHeight(table);
  const newCells = Array.from({ length: table.columns }, () => ({ text: '' }));
  return {
    ...table,
    rows: table.rows + 1,
    height: Math.round(table.height + rowH),
    cells: [...table.cells, ...newCells],
  };
}

export function withTableRowRemoved<T extends TableObjectBase>(table: T): T {
  if (table.rows <= 1) return table;
  const rowH = tableRowHeight(table);
  return {
    ...table,
    rows: table.rows - 1,
    height: Math.max(24, Math.round(table.height - rowH)),
    cells: table.cells.slice(0, (table.rows - 1) * table.columns),
  };
}

export function withTableColumnAdded<T extends TableObjectBase>(table: T): T {
  if (table.columns >= MAX_TABLE_COLUMNS) return table;
  const nextCols = table.columns + 1;
  const avgWidth = table.width / table.columns;
  const nextCells: TableCell[] = [];
  for (let r = 0; r < table.rows; r += 1) {
    for (let c = 0; c < table.columns; c += 1) {
      nextCells.push(table.cells[r * table.columns + c] ?? { text: '' });
    }
    nextCells.push({ text: '' });
  }
  return {
    ...table,
    columns: nextCols,
    width: Math.round(table.width + avgWidth),
    columnRatios: equalColumnRatios(nextCols),
    cells: nextCells,
  };
}

export function withTableColumnRemoved<T extends TableObjectBase>(table: T): T {
  if (table.columns <= 1) return table;
  const nextCols = table.columns - 1;
  const lastColWidth = table.width * (table.columnRatios[table.columns - 1] ?? 1 / table.columns);
  const nextCells: TableCell[] = [];
  for (let r = 0; r < table.rows; r += 1) {
    for (let c = 0; c < nextCols; c += 1) {
      nextCells.push(table.cells[r * table.columns + c] ?? { text: '' });
    }
  }
  return {
    ...table,
    columns: nextCols,
    width: Math.max(48, Math.round(table.width - lastColWidth)),
    columnRatios: equalColumnRatios(nextCols),
    cells: nextCells,
  };
}

export function tableEquals(left: TableObjectBase, right: TableObjectBase): boolean {
  if (
    left.id !== right.id ||
    left.x !== right.x ||
    left.y !== right.y ||
    left.width !== right.width ||
    left.height !== right.height ||
    left.rotation !== right.rotation ||
    left.rows !== right.rows ||
    left.columns !== right.columns ||
    left.hasHeaderRow !== right.hasHeaderRow ||
    left.colorKey !== right.colorKey ||
    left.fillHeader !== right.fillHeader ||
    left.fontSize !== right.fontSize ||
    left.columnRatios.length !== right.columnRatios.length ||
    left.cells.length !== right.cells.length
  ) {
    return false;
  }
  for (let i = 0; i < left.columnRatios.length; i += 1) {
    if (left.columnRatios[i] !== right.columnRatios[i]) return false;
  }
  for (let i = 0; i < left.cells.length; i += 1) {
    if (
      left.cells[i].text !== right.cells[i].text ||
      left.cells[i].align !== right.cells[i].align
    ) {
      return false;
    }
  }
  return true;
}
