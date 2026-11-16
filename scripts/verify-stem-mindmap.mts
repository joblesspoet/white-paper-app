import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

import { computeTidyLayout } from '../src/canvas/auto-layout.ts';
import {
  buildChartRenderPrimitives,
  buildTableStatsSummaryCard,
  computeTableColumnStats,
  createChartObjectFromTable,
  extractTableNumericData,
} from '../src/canvas/chart-generator.ts';
import {
  QUICK_BRANCH_GAP,
  buildQuickBranchSpec,
  findNearestPortSnap,
  getObjectPortPoint,
} from '../src/canvas/connectors.ts';
import {
  createConnectorObject,
  createDocumentHistory,
  createFunctionPlotObject,
  createMathObject,
  createStickyObject,
  createTableObject,
  documentReducer,
  documentsEqual,
  findObject,
  linePoints,
  withTableCellText,
  type ConnectorObject,
  type FunctionPlotObject,
  type StickyObject,
} from '../src/canvas/document.ts';
import {
  createFunctionPlotConfig,
  evaluateFunctionPlot,
  isPlottableMathLatex,
  normalizeMathExpression,
  parseMathAst,
  sampleFunctionCurve,
  solveFunctionKeyPoints,
} from '../src/canvas/function-plotter.ts';
import { objectBounds } from '../src/canvas/selection.ts';
import { buildSpatialStickyExplosion } from '../src/ocr/ocr-explode.ts';
import { normalizeOcrResult, ocrReviewStateFromResult } from '../src/ocr/ocr-service.ts';
import type { PersistenceDatabase } from '../src/persistence/database.ts';
import { insertBoard, loadBoardDocument, saveBoardDocument } from '../src/persistence/repository.ts';
import { DEFAULT_BOARD_SETTINGS, MIGRATIONS } from '../src/persistence/schema.ts';

function openTestDb(): PersistenceDatabase {
  const raw = new DatabaseSync(':memory:');
  const db: PersistenceDatabase = {
    execAsync: async (sql: string) => {
      raw.exec(sql);
    },
    runAsync: async (sql: string, params: readonly unknown[] = []) => {
      const stmt = raw.prepare(sql);
      const res = stmt.run(...(params as never[]));
      return {
        changes: Number(res.changes ?? 0),
        lastInsertRowId: Number(res.lastInsertRowid ?? 0),
      };
    },
    getFirstAsync: async <T,>(sql: string, params: readonly unknown[] = []): Promise<T | null> => {
      const stmt = raw.prepare(sql);
      const row = stmt.get(...(params as never[]));
      return (row as T | undefined) ?? null;
    },
    getAllAsync: async <T,>(sql: string, params: readonly unknown[] = []): Promise<T[]> => {
      const stmt = raw.prepare(sql);
      return stmt.all(...(params as never[])) as T[];
    },
    withTransactionAsync: async <T,>(task: () => Promise<T>) => {
      raw.exec('BEGIN');
      try {
        const result = await task();
        raw.exec('COMMIT');
        return result;
      } catch (err) {
        raw.exec('ROLLBACK');
        throw err;
      }
    },
  };

  for (const migration of MIGRATIONS) {
    for (const stmt of migration.statements) {
      raw.exec(stmt);
    }
  }
  raw.exec(`PRAGMA user_version = ${MIGRATIONS[MIGRATIONS.length - 1].version}`);
  return db;
}

function rectsOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
  tol = 0.01,
): boolean {
  return (
    a.x < b.x + b.width - tol &&
    a.x + a.width > b.x + tol &&
    a.y < b.y + b.height - tol &&
    a.y + a.height > b.y + tol
  );
}

async function run() {
  // ------------------------------------------------------------------
  // 1. Magnetic Object Connectors, Snap & + Quick-Branching
  // ------------------------------------------------------------------
  const nodeA = createStickyObject({ id: 'nA', point: { x: 100, y: 100 } });
  const nodeB = createStickyObject({ id: 'nB', point: { x: 340, y: 100 } });

  const rightPortA = getObjectPortPoint(nodeA, 'right');
  const leftPortB = getObjectPortPoint(nodeB, 'left');

  const snapStart = findNearestPortSnap(
    [nodeA, nodeB],
    { x: rightPortA.x + 10, y: rightPortA.y - 5 },
    1,
  );
  assert.ok(snapStart, 'Should snap within 24pt screen threshold');
  assert.equal(snapStart.objectId, 'nA');
  assert.equal(snapStart.port, 'right');

  const farMiss = findNearestPortSnap(
    [nodeA, nodeB],
    { x: rightPortA.x + 80, y: rightPortA.y + 80 },
    1,
  );
  assert.equal(farMiss, null, 'Should not snap outside 24pt threshold');

  const boundConnector = createConnectorObject({
    id: 'conn-1',
    style: 'arrow',
    start: rightPortA,
    end: leftPortB,
    startBinding: { objectId: 'nA', port: 'right' },
    endBinding: { objectId: 'nB', port: 'left' },
  });

  let history = createDocumentHistory({ strokes: [], objects: [nodeA, nodeB, boundConnector] });

  // Move nodeB and verify boundConnector follows automatically
  history = documentReducer(history, {
    type: 'command',
    command: {
      type: 'objects.geometry',
      label: 'Move',
      updates: [{ id: 'nB', x: nodeB.x + 100, y: nodeB.y + 60 }],
    },
  });

  const movedNodeB = findObject(history.present, 'nB')!;
  const updatedConn = findObject(history.present, 'conn-1') as ConnectorObject;
  const connEnds = linePoints(
    updatedConn.x,
    updatedConn.y,
    updatedConn.width,
    updatedConn.height,
    updatedConn.direction,
  );
  const expectedBLeft = getObjectPortPoint(movedNodeB, 'left');
  assert.ok(Math.hypot(connEnds.end.x - expectedBLeft.x, connEnds.end.y - expectedBLeft.y) < 0.01);

  // Rotate nodeB 90 deg and verify port rotation propagation
  history = documentReducer(history, {
    type: 'command',
    command: {
      type: 'objects.geometry',
      label: 'Rotate',
      updates: [{ id: 'nB', rotation: 90 }],
    },
  });
  const rotatedNodeB = findObject(history.present, 'nB')!;
  const rotatedConn = findObject(history.present, 'conn-1') as ConnectorObject;
  const rotatedEnds = linePoints(
    rotatedConn.x,
    rotatedConn.y,
    rotatedConn.width,
    rotatedConn.height,
    rotatedConn.direction,
  );
  const expectedRotatedLeft = getObjectPortPoint(rotatedNodeB, 'left');
  assert.ok(
    Math.hypot(rotatedEnds.end.x - expectedRotatedLeft.x, rotatedEnds.end.y - expectedRotatedLeft.y) <
      0.01,
  );

  // Undo both steps -> connector returns to original endpoints
  history = documentReducer(history, { type: 'undo' });
  history = documentReducer(history, { type: 'undo' });
  const restoredConn = findObject(history.present, 'conn-1') as ConnectorObject;
  const restoredEnds = linePoints(
    restoredConn.x,
    restoredConn.y,
    restoredConn.width,
    restoredConn.height,
    restoredConn.direction,
  );
  assert.ok(Math.hypot(restoredEnds.end.x - leftPortB.x, restoredEnds.end.y - leftPortB.y) < 0.01);

  // Delete nodeB -> clears dangling endBinding; undo restores it
  history = documentReducer(history, {
    type: 'command',
    command: { type: 'object.delete', id: 'nB' },
  });
  const connAfterDelete = findObject(history.present, 'conn-1') as ConnectorObject;
  assert.equal(connAfterDelete.endBinding, undefined);
  history = documentReducer(history, { type: 'undo' });
  const connAfterUndoDelete = findObject(history.present, 'conn-1') as ConnectorObject;
  assert.equal(connAfterUndoDelete.endBinding?.objectId, 'nB');

  // + Quick-Branching in 1 batched undo step
  const branchSpec = buildQuickBranchSpec({
    source: nodeA,
    direction: 'bottom',
    newNodeId: 'branch-node',
    newConnectorId: 'branch-conn',
  });
  assert.equal(branchSpec.child.y - (nodeA.y + nodeA.height), QUICK_BRANCH_GAP);
  assert.equal(branchSpec.connector.startBinding?.port, 'bottom');
  assert.equal(branchSpec.connector.endBinding?.port, 'top');

  history = documentReducer(history, {
    type: 'commands',
    commands: [
      { type: 'object.insert', object: branchSpec.child },
      { type: 'object.insert', object: branchSpec.connector },
    ],
  });
  assert.ok(findObject(history.present, 'branch-node'));
  assert.ok(findObject(history.present, 'branch-conn'));

  history = documentReducer(history, { type: 'undo' });
  assert.equal(findObject(history.present, 'branch-node'), null);
  assert.equal(findObject(history.present, 'branch-conn'), null);

  // ------------------------------------------------------------------
  // 2. Lasso "Tidy Up" Auto-Layout (grid, row, column)
  // ------------------------------------------------------------------
  const cluster = [
    createStickyObject({ id: 't1', point: { x: 100, y: 120 } }),
    createStickyObject({ id: 't2', point: { x: 115, y: 130 } }),
    createStickyObject({ id: 't3', point: { x: 130, y: 110 } }),
    createStickyObject({ id: 't4', point: { x: 145, y: 140 } }),
  ];
  for (const mode of ['grid', 'row', 'column'] as const) {
    const updates = computeTidyLayout(cluster, mode);
    assert.equal(updates.length, 4, `Expected 4 updates for ${mode}`);
    const positioned = cluster.map((obj) => {
      const u = updates.find((item) => item.id === obj.id)!;
      return { ...obj, x: u.x, y: u.y };
    });
    for (let i = 0; i < positioned.length; i += 1) {
      for (let j = i + 1; j < positioned.length; j += 1) {
        assert.ok(
          !rectsOverlap(objectBounds(positioned[i]), objectBounds(positioned[j])),
          `Objects overlapped in ${mode} layout`,
        );
      }
    }
  }

  // ------------------------------------------------------------------
  // 3. Live Function Plotter, Key-Point Solver & Tangent Preview
  // ------------------------------------------------------------------
  assert.equal(isPlottableMathLatex('y = x^2 - 4'), true);
  assert.equal(isPlottableMathLatex('f(x) = \\sin(x)'), true);
  assert.equal(isPlottableMathLatex('a^2 + b^2 = c^2'), false);

  const quadPlot = createFunctionPlotObject({
    id: 'plot-quad',
    point: { x: 200, y: 200 },
    latex: 'y = x^2 - 4',
  });
  assert.ok(quadPlot);
  const quadEval = evaluateFunctionPlot(quadPlot);
  assert.equal(quadEval.branches.length, 1);
  const roots = quadEval.keyPoints.filter((kp) => kp.kind === 'root').map((kp) => kp.x);
  assert.equal(roots.length, 2);
  assert.ok(Math.abs(roots[0] - -2) < 1e-3);
  assert.ok(Math.abs(roots[1] - 2) < 1e-3);
  const yInt = quadEval.keyPoints.find((kp) => kp.kind === 'y-intercept');
  assert.ok(yInt && Math.abs(yInt.y - -4) < 1e-3);
  const vertex = quadEval.keyPoints.find((kp) => kp.kind === 'extrema');
  assert.ok(vertex && Math.abs(vertex.x) < 1e-3 && Math.abs(vertex.y - -4) < 1e-3);

  // Parameter sliders & tangent slope preview
  const paramPlot = createFunctionPlotObject({
    id: 'plot-param',
    point: { x: 200, y: 200 },
    latex: 'y = a \\cdot x^2 + b',
  });
  assert.ok(paramPlot);
  assert.deepEqual(paramPlot.parameterNames, ['a', 'b']);

  let plotHistory = createDocumentHistory({ strokes: [], objects: [paramPlot] });
  plotHistory = documentReducer(plotHistory, {
    type: 'command',
    command: {
      type: 'object.update',
      id: 'plot-param',
      functionPlot: { params: { a: 2, b: -8 }, showTangent: true, tangentX: 1.5 },
    },
  });
  const updatedPlot = findObject(plotHistory.present, 'plot-param') as FunctionPlotObject;
  const paramEval = evaluateFunctionPlot(updatedPlot);
  assert.ok(paramEval.tangent && Math.abs(paramEval.tangent.slope - 6) < 0.05);

  // Asymptote splitting for 1/x and tan(x)
  const invAst = parseMathAst(normalizeMathExpression('y = \\frac{1}{x}').expression)!;
  const invBranches = sampleFunctionCurve(invAst, {}, { xMin: -5, xMax: 5, yMin: -5, yMax: 5 });
  assert.ok(invBranches.length >= 2, '1/x must split across vertical asymptote at x=0');

  const tanAst = parseMathAst(normalizeMathExpression('f(x) = \\tan(x)').expression)!;
  const tanBranches = sampleFunctionCurve(tanAst, {}, { xMin: -4, xMax: 4, yMin: -5, yMax: 5 });
  assert.ok(tanBranches.length >= 3, 'tan(x) must split across ±π/2 asymptotes');

  // ------------------------------------------------------------------
  // 4. Table Statistics & Table-to-Chart Generator
  // ------------------------------------------------------------------
  let table = createTableObject({ id: 'tbl-1', point: { x: 300, y: 300 }, rows: 4, columns: 2 });
  table = withTableCellText(table, 0, 0, 'Quarter');
  table = withTableCellText(table, 0, 1, 'Score');
  table = withTableCellText(table, 1, 0, 'Q1');
  table = withTableCellText(table, 1, 1, '10');
  table = withTableCellText(table, 2, 0, 'Q2');
  table = withTableCellText(table, 2, 1, '20');
  table = withTableCellText(table, 3, 0, 'Q3');
  table = withTableCellText(table, 3, 1, '30');

  const extracted = extractTableNumericData(table);
  assert.equal(extracted.isNumeric, true);
  assert.deepEqual(extracted.labels, ['Q1', 'Q2', 'Q3']);
  assert.deepEqual(extracted.series[0].values, [10, 20, 30]);

  const stats = computeTableColumnStats(table);
  assert.equal(stats.length, 1);
  assert.equal(stats[0].sum, 60);
  assert.equal(stats[0].mean, 20);
  assert.equal(stats[0].median, 20);
  assert.equal(stats[0].min, 10);
  assert.equal(stats[0].max, 30);
  assert.ok(Math.abs(stats[0].stdDev - Math.sqrt(200 / 3)) < 1e-6);

  const statsCard = buildTableStatsSummaryCard(table, stats, 'stats-card');
  assert.ok(statsCard && statsCard.text.includes('Mean: 20'));

  const barChart = createChartObjectFromTable({ id: 'ch-bar', table, chartType: 'bar' })!;
  const lineChart = createChartObjectFromTable({ id: 'ch-line', table, chartType: 'line' })!;
  const pieChart = createChartObjectFromTable({ id: 'ch-pie', table, chartType: 'pie' })!;
  assert.equal(buildChartRenderPrimitives(barChart).bars.length, 3);
  assert.equal(buildChartRenderPrimitives(lineChart).lines[0].points.length, 3);
  assert.equal(buildChartRenderPrimitives(pieChart).pieSlices.length, 3);

  // ------------------------------------------------------------------
  // 5. Spatial OCR Explode
  // ------------------------------------------------------------------
  const ocrRaw = normalizeOcrResult(
    {
      blocks: [
        { text: '!', boundingBox: { x: 0.02, y: 0.02, width: 0.02, height: 0.02 } },
        { text: 'Hypothesis', boundingBox: { x: 0.1, y: 0.1, width: 0.3, height: 0.12 } },
        { text: 'Experiment', boundingBox: { x: 0.55, y: 0.12, width: 0.3, height: 0.12 } },
        { text: 'Conclusion', boundingBox: { x: 0.3, y: 0.65, width: 0.32, height: 0.14 } },
      ],
    },
    'apple-vision',
  );
  const reviewState = ocrReviewStateFromResult(ocrRaw);
  assert.equal(reviewState.regions?.length, 4);

  const exploded = buildSpatialStickyExplosion(
    reviewState.regions ?? [],
    { id: 'img-ocr', x: 0, y: 0, width: 320, height: 240, sourceWidth: 1000, sourceHeight: 750 },
    { idPrefix: 'exp', viewportCenter: { x: 400, y: 300 } },
  );
  assert.equal(exploded.length, 3, 'Noise fragment "!" (< 2 chars) must be filtered out');
  assert.ok(exploded.every((s) => s.sourceImageId === 'img-ocr'));
  for (let i = 0; i < exploded.length; i += 1) {
    for (let j = i + 1; j < exploded.length; j += 1) {
      assert.ok(!rectsOverlap(exploded[i], exploded[j]), 'Exploded sticky notes must not overlap');
    }
  }

  let ocrHist = createDocumentHistory();
  ocrHist = documentReducer(ocrHist, {
    type: 'commands',
    commands: exploded.map((note) => ({ type: 'object.insert' as const, object: note })),
  });
  assert.equal(ocrHist.present.objects.length, 3);
  ocrHist = documentReducer(ocrHist, { type: 'undo' });
  assert.equal(ocrHist.present.objects.length, 0);
  ocrHist = documentReducer(ocrHist, { type: 'redo' });
  assert.equal(ocrHist.present.objects.length, 3);

  // ------------------------------------------------------------------
  // 6. SQLite Persistence Round-Trip
  // ------------------------------------------------------------------
  const db = openTestDb();
  const now = new Date().toISOString();
  await insertBoard(db, {
    id: 'board-g',
    title: 'Phase G STEM Board',
    settings: DEFAULT_BOARD_SETTINGS,
    createdAt: now,
  });
  const fullDoc = {
    strokes: [],
    objects: [
      nodeA,
      nodeB,
      boundConnector,
      createMathObject({ id: 'm1', point: { x: 50, y: 50 }, latex: 'y = x^2 - 4' }),
      updatedPlot,
      barChart,
      exploded[0] as StickyObject,
    ],
  };
  await saveBoardDocument(db, 'board-g', fullDoc, null, now);
  const reloaded = await loadBoardDocument(db, 'board-g');
  assert.ok(
    documentsEqual(fullDoc, reloaded.document),
    'SQLite round-trip must preserve bound connectors, plots, charts, and exploded stickies',
  );

  console.log(
    'stem-mindmap checks passed: magnetic connectors & + branch, tidy layout, function plotter & solver, table stats/charts, spatial OCR explode, SQLite round-trip',
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
