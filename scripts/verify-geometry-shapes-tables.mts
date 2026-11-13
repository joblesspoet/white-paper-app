import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

import {
  ALL_SHAPE_KINDS,
  SHAPE_CATALOG,
  buildShapeRenderPrimitives,
  createDocumentHistory,
  createShapeObject,
  createTableObject,
  documentReducer,
  documentsEqual,
  findObject,
  objectContainsPoint,
  tableCellAtPoint,
  tableCellRect,
  withTableCellText,
  withTableColumnAdded,
  withTableColumnRemoved,
  withTableRowAdded,
  withTableRowRemoved,
} from '../src/canvas/document.ts';
import {
  buildCompassArcPoints,
  buildProtractorAngleGeometry,
  createDefaultInstrument,
  projectPointToLockedRulerEdge,
  projectPointToRulerEdge,
  projectPointToSetSquareEdge,
  setSquareVertices,
  snapAngleDeg,
  type ProtractorState,
  type RulerState,
  type SetSquareState,
} from '../src/canvas/geometry-box.ts';
import type { PersistenceDatabase } from '../src/persistence/database.ts';
import {
  insertBoard,
  loadBoardDocument,
  parseCanvasObject,
  saveBoardDocument,
} from '../src/persistence/repository.ts';
import { DEFAULT_BOARD_SETTINGS, MIGRATIONS } from '../src/persistence/schema.ts';

function openTestDb(): PersistenceDatabase {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  for (const migration of MIGRATIONS) {
    for (const stmt of migration.statements) {
      db.exec(stmt);
    }
    db.exec(`PRAGMA user_version = ${migration.version};`);
  }
  return {
    async execAsync(sql: string) {
      db.exec(sql);
    },
    async runAsync(sql: string, params: readonly unknown[] = []) {
      const stmt = db.prepare(sql);
      const res = stmt.run(...(params as (string | number | null | Uint8Array)[]));
      return { changes: Number(res.changes), lastInsertRowId: Number(res.lastInsertRowid) };
    },
    async getFirstAsync<T>(sql: string, params: readonly unknown[] = []): Promise<T | null> {
      const stmt = db.prepare(sql);
      const row = stmt.get(...(params as (string | number | null | Uint8Array)[]));
      return (row as T | undefined) ?? null;
    },
    async getAllAsync<T>(sql: string, params: readonly unknown[] = []): Promise<T[]> {
      const stmt = db.prepare(sql);
      return stmt.all(...(params as (string | number | null | Uint8Array)[])) as T[];
    },
    async withTransactionAsync<T>(fn: () => Promise<T>): Promise<T> {
      db.exec('BEGIN IMMEDIATE');
      try {
        const result = await fn();
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

// ------------------------------------------------------------ 1. Geometry Box
assert.equal(snapAngleDeg(43.5), 45);
assert.equal(snapAngleDeg(-28.2), -30);
assert.equal(snapAngleDeg(37), 37);

const ruler: RulerState = {
  kind: 'ruler',
  x: 100,
  y: 100,
  angleDeg: 0,
  length: 300,
  width: 56,
};
// Top edge is at y = 100 - 28 = 72
const topSnap = projectPointToRulerEdge({ x: 120, y: 60 }, ruler, 28);
assert.ok(topSnap);
assert.equal(topSnap.edge, 'top');
assert.ok(Math.abs(topSnap.snappedPoint.x - 120) < 1e-6);
assert.ok(Math.abs(topSnap.snappedPoint.y - 72) < 1e-6);

// Bottom edge is at y = 128
const bottomSnap = projectPointToRulerEdge({ x: 80, y: 140 }, ruler, 28);
assert.ok(bottomSnap);
assert.equal(bottomSnap.edge, 'bottom');
assert.ok(Math.abs(bottomSnap.snappedPoint.y - 128) < 1e-6);

// Outside snap distance returns null
assert.equal(projectPointToRulerEdge({ x: 100, y: 10 }, ruler, 28), null);

// Locked edge clamps along ruler span
const locked = projectPointToLockedRulerEdge({ x: 500, y: 200 }, ruler, 'top');
assert.ok(Math.abs(locked.snappedPoint.x - 250) < 1e-6);
assert.ok(Math.abs(locked.snappedPoint.y - 72) < 1e-6);

// Set Square 45° and 30°-60°
const sq45: SetSquareState = createDefaultInstrument('set-square-45', { x: 200, y: 200 }) as SetSquareState;
const verts45 = setSquareVertices(sq45);
assert.equal(verts45.length, 3);
const sqSnap = projectPointToSetSquareEdge(
  { x: verts45[0].x + 5, y: verts45[0].y - 20 },
  sq45,
  28,
);
assert.ok(sqSnap);

// Protractor & Compass
const protractor = createDefaultInstrument('protractor', { x: 0, y: 0 }) as ProtractorState;
const angleGeo = buildProtractorAngleGeometry(protractor);
assert.equal(angleGeo.sweepDeg, 45);
assert.ok(angleGeo.arcPoints.length >= 12);

const arcPts = buildCompassArcPoints({ x: 50, y: 50 }, 100, 0, 90, 16);
assert.equal(arcPts.length, 17);
assert.ok(Math.abs(arcPts[0].x - 150) < 1e-6);
assert.ok(Math.abs(arcPts[16].y - 150) < 1e-6);

// ------------------------------------------------------------ 2. 53 Shapes
assert.ok(ALL_SHAPE_KINDS.length >= 52, `Expected >= 52 shapes, got ${ALL_SHAPE_KINDS.length}`);

for (const kind of ALL_SHAPE_KINDS) {
  const primitives = buildShapeRenderPrimitives(kind, 10, 20, 120, 80, 'tlbr', true);
  assert.ok(primitives.solidStrokeSvg.length > 0, `Missing solidStrokeSvg for ${kind}`);
  if (SHAPE_CATALOG[kind].category === 'solid-3d') {
    assert.ok(primitives.dashedStrokeSvg && primitives.dashedStrokeSvg.length > 0, `Missing dashedStrokeSvg for 3D solid ${kind}`);
  }
  const shapeObj = createShapeObject({
    id: `shape-${kind}`,
    shape: kind,
    start: { x: 10, y: 20 },
    end: { x: 130, y: 100 },
  });
  assert.equal(
    objectContainsPoint(shapeObj, { x: 70, y: 60 }),
    true,
    `Center hit failed for ${kind}`,
  );
  assert.equal(
    objectContainsPoint(shapeObj, { x: 500, y: 500 }),
    false,
    `Outside hit should be false for ${kind}`,
  );
}

const measuredRect = buildShapeRenderPrimitives('rectangle', 0, 0, 100, 50, 'tlbr', true);
assert.equal(measuredRect.measurementLabels?.length, 2);
const measuredTri = buildShapeRenderPrimitives('triangle-right', 0, 0, 30, 40, 'tlbr', true);
assert.ok(measuredTri.measurementLabels?.some((l) => l.text === '90°'));
assert.ok(measuredTri.measurementLabels?.some((l) => l.text === '50'));

// ------------------------------------------------------------ 3. TableObject
let table = createTableObject({
  id: 'tbl-1',
  point: { x: 200, y: 200 },
  rows: 3,
  columns: 3,
});
assert.equal(table.rows, 3);
assert.equal(table.columns, 3);
assert.equal(table.cells.length, 9);

const c12Rect = tableCellRect(table, 1, 2);
const hit12 = tableCellAtPoint(table, {
  x: c12Rect.x + c12Rect.width / 2,
  y: c12Rect.y + c12Rect.height / 2,
});
assert.deepEqual(hit12, { row: 1, col: 2 });

// Rotation-aware cell hit testing (90° clockwise around table center)
const rotatedTable = { ...table, rotation: 90 };
// Top-left cell (0, 0) rotated 90° CW around center moves to top-right area
const c00Rect = tableCellRect(table, 0, 0);
const localDx = c00Rect.x + c00Rect.width / 2 - (table.x + table.width / 2);
const localDy = c00Rect.y + c00Rect.height / 2 - (table.y + table.height / 2);
const rotatedPt = {
  x: table.x + table.width / 2 - localDy,
  y: table.y + table.height / 2 + localDx,
};
assert.deepEqual(tableCellAtPoint(rotatedTable, rotatedPt), { row: 0, col: 0 });

// Cell text + structural edits preserve data
table = withTableCellText(table, 0, 0, 'Element');
table = withTableCellText(table, 1, 1, 'H2O');
table = withTableRowAdded(table);
assert.equal(table.rows, 4);
assert.equal(table.cells[0].text, 'Element');
assert.equal(table.cells[4].text, 'H2O');

table = withTableColumnAdded(table);
assert.equal(table.columns, 4);
assert.equal(table.cells[0].text, 'Element');
assert.equal(table.cells[1 * 4 + 1].text, 'H2O');

table = withTableColumnRemoved(table);
assert.equal(table.columns, 3);
assert.equal(table.cells[1 * 3 + 1].text, 'H2O');

table = withTableRowRemoved(table);
assert.equal(table.rows, 3);
assert.equal(table.cells[1 * 3 + 1].text, 'H2O');

// Undo / Redo for TableObject
let hist = createDocumentHistory();
hist = documentReducer(hist, {
  type: 'command',
  command: { type: 'object.insert', object: table },
});
assert.equal(hist.present.objects.length, 1);

const updatedCells = withTableCellText(table, 2, 2, 'CO2').cells;
hist = documentReducer(hist, {
  type: 'command',
  command: {
    type: 'object.update',
    id: table.id,
    table: { cells: updatedCells },
  },
});
assert.equal((findObject(hist.present, table.id) as typeof table).cells[8].text, 'CO2');

hist = documentReducer(hist, { type: 'undo' });
assert.equal((findObject(hist.present, table.id) as typeof table).cells[8].text, '');

hist = documentReducer(hist, { type: 'redo' });
assert.equal((findObject(hist.present, table.id) as typeof table).cells[8].text, 'CO2');

// SQLite persistence round-trip for new shapes + TableObject
const db = openTestDb();
const boardId = 'board-phase-b';
await insertBoard(db, {
  id: boardId,
  title: 'Phase B Test Board',
  settings: DEFAULT_BOARD_SETTINGS,
  createdAt: '2026-11-13T10:00:00.000Z',
});

const cubeShape = createShapeObject({
  id: 'shape-cube',
  shape: 'cube',
  start: { x: 20, y: 20 },
  end: { x: 140, y: 140 },
});
cubeShape.showMeasurements = true;

const docToSave = {
  strokes: [],
  objects: [cubeShape, findObject(hist.present, table.id)!],
};
await saveBoardDocument(db, boardId, docToSave, { x: 0, y: 0, scale: 1 });
const loaded = await loadBoardDocument(db, boardId);
assert.equal(documentsEqual(docToSave, loaded.document), true);

// Malformed table JSON is safely rejected
assert.equal(
  parseCanvasObject(
    JSON.stringify({
      id: 'bad-tbl',
      type: 'table',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      rotation: 0,
      rows: 0,
      columns: 2,
      cells: [],
    }),
  ),
  null,
);

console.log(
  `geometry-shapes-tables checks passed: geometry box snapping/arcs, ${ALL_SHAPE_KINDS.length} shapes + measurements, TableObject hit-test/edits/undo/SQLite`,
);
