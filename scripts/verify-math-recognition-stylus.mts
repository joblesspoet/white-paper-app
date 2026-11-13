import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

import {
  createDocumentHistory,
  createMathObject,
  documentReducer,
  documentsEqual,
  findObject,
  withObjectMath,
  withObjectStyle,
} from '../src/canvas/document.ts';
import {
  buildVariableWidthStrokePath,
  createInkStroke,
  hasVariablePressure,
  inkPathData,
  pressureWidthMultiplier,
  shouldAcceptInkPointer,
} from '../src/canvas/ink.ts';
import { layoutMathExpression } from '../src/canvas/math-layout.ts';
import {
  MATH_KEYPAD_TABS,
  MATH_QUICK_FORMULAS,
  latexToDisplayText,
} from '../src/canvas/math-model.ts';
import {
  classifyInkStroke,
  inkStrokesBoundingBox,
  recognizedShapeToObject,
  strokesInRect,
} from '../src/canvas/recognition.ts';
import type { Point } from '../src/canvas/viewport.ts';
import type { PersistenceDatabase } from '../src/persistence/database.ts';
import {
  insertBoard,
  loadAppPreferences,
  loadBoardDocument,
  parseInkStroke,
  saveAppPreference,
  saveBoardDocument,
} from '../src/persistence/repository.ts';
import {
  DEFAULT_APP_PREFERENCES,
  DEFAULT_BOARD_SETTINGS,
  MIGRATIONS,
} from '../src/persistence/schema.ts';

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
    withTransactionAsync: async (task: () => Promise<void>) => {
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
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

// ---------------------------------------------------------------------------
// 1. Math Formula Builder & Layout Engine
// ---------------------------------------------------------------------------

function testMathLayoutAndTemplates(): void {
  assert.equal(MATH_QUICK_FORMULAS.length, 12);
  const domains = new Set(MATH_QUICK_FORMULAS.map((f) => f.domain));
  assert.ok(domains.has('algebra'));
  assert.ok(domains.has('trig'));
  assert.ok(domains.has('calculus'));
  assert.ok(domains.has('matrices'));

  assert.equal(MATH_KEYPAD_TABS.length, 5);

  // Quadratic formula: fraction vinculum + radical hook/overbar + glyphs
  const quad = layoutMathExpression('x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}', 22);
  assert.ok(quad.width > 60 && quad.height > 30);
  assert.ok(quad.paths.length >= 2, 'Expected vinculum bar + radical path');
  assert.ok(quad.glyphs.some((g) => g.text === '±'));
  assert.ok(quad.glyphs.some((g) => g.text === 'x' && g.italic === true));

  // Nested fraction & radical
  const nested = layoutMathExpression('\\sqrt{\\frac{1}{2}}', 22);
  assert.ok(nested.paths.length >= 2);
  assert.ok(nested.height > 28);

  // Integral & summation vector contours + limits
  const integral = layoutMathExpression('\\int_{a}^{b} f(x)\\,dx = F(b) - F(a)', 22);
  assert.ok(integral.paths.length >= 1, 'Expected integral contour SVG path');
  assert.ok(integral.glyphs.some((g) => g.text === 'a'));
  assert.ok(integral.glyphs.some((g) => g.text === 'b'));

  const sum = layoutMathExpression('\\sum_{i=1}^{n} i^2', 22);
  assert.ok(sum.paths.length >= 1, 'Expected summation contour SVG path');

  // Matrix 2x2 and 3x3
  const mat2 = layoutMathExpression('\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}', 22);
  assert.ok(mat2.paths.length >= 2, 'Expected left & right matrix bracket paths');
  assert.ok(mat2.glyphs.some((g) => g.text === 'd'));

  const mat3 = layoutMathExpression(
    '\\begin{bmatrix} 1 & 2 & 3 \\\\ 4 & 5 & 6 \\\\ 7 & 8 & 9 \\end{bmatrix}',
    20,
  );
  assert.ok(mat3.height > mat2.height);

  // Absolute value & vector arrow & Greek symbols
  const absVec = layoutMathExpression('|\\vec{v}| = \\sqrt{\\alpha^2 + \\theta^2}', 22);
  assert.ok(absVec.paths.length >= 3);
  assert.ok(absVec.glyphs.some((g) => g.text === 'α'));
  assert.ok(absVec.glyphs.some((g) => g.text === 'θ'));

  // All 12 quick formulas lay out cleanly without throwing
  for (const formula of MATH_QUICK_FORMULAS) {
    const res = layoutMathExpression(formula.latex, 22);
    assert.ok(res.width > 0 && res.height > 0, `Formula ${formula.id} failed layout`);
    assert.ok(latexToDisplayText(formula.latex).length > 0);
  }
}

async function testMathObjectHistoryAndPersistence(): Promise<void> {
  let history = createDocumentHistory();
  const mathObj = createMathObject({
    id: 'math-1',
    point: { x: 200, y: 150 },
    latex: 'a^2 + b^2 = c^2',
  });
  history = documentReducer(history, {
    type: 'command',
    command: { type: 'object.insert', object: mathObj },
  });
  assert.equal(findObject(history.present, 'math-1')?.type, 'math');

  history = documentReducer(history, {
    type: 'command',
    command: { type: 'object.update', id: 'math-1', latex: '\\frac{dy}{dx} = 2x' },
  });
  const updated = findObject(history.present, 'math-1');
  assert.equal(updated?.type, 'math');
  if (updated?.type === 'math') {
    assert.equal(updated.latex, '\\frac{dy}{dx} = 2x');
  }

  // Undo reverts to Pythagorean latex
  history = documentReducer(history, { type: 'undo' });
  const reverted = findObject(history.present, 'math-1');
  assert.equal(reverted?.type === 'math' ? reverted.latex : '', 'a^2 + b^2 = c^2');

  // Redo + style update
  history = documentReducer(history, { type: 'redo' });
  const styled = withObjectStyle(findObject(history.present, 'math-1')!, { fontSize: 28 });
  assert.ok(styled.height >= updated!.height);
  assert.equal(withObjectMath(mathObj, mathObj.latex), mathObj);

  // SQLite round-trip
  const db = openTestDb();
  await insertBoard(db, {
    id: 'board-math',
    title: 'Math Board',
    createdAt: '2026-11-13T00:00:00.000Z',
    settings: DEFAULT_BOARD_SETTINGS,
  });
  await saveBoardDocument(db, 'board-math', history.present, null);
  const loaded = await loadBoardDocument(db, 'board-math');
  assert.ok(documentsEqual(loaded.document, history.present));
}

// ---------------------------------------------------------------------------
// 2. Smart Shape & Handwriting Recognition
// ---------------------------------------------------------------------------

function sampleSegment(a: Point, b: Point, steps: number, jitter = 0): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const wave = jitter > 0 ? Math.sin(i * 1.7) * jitter : 0;
    pts.push({
      x: a.x + (b.x - a.x) * t + wave,
      y: a.y + (b.y - a.y) * t - wave,
    });
  }
  return pts;
}

function testShapeRecognition(): void {
  // 1. Line
  const linePts = sampleSegment({ x: 10, y: 20 }, { x: 210, y: 120 }, 24, 1.5);
  const lineRes = classifyInkStroke(linePts);
  assert.equal(lineRes?.kind, 'line');

  // 2. Arrow (shaft + arrowhead hook)
  const arrowPts = [
    ...sampleSegment({ x: 20, y: 100 }, { x: 200, y: 100 }, 20, 0.5),
    ...sampleSegment({ x: 200, y: 100 }, { x: 180, y: 84 }, 6, 0),
    ...sampleSegment({ x: 200, y: 100 }, { x: 180, y: 116 }, 6, 0),
  ];
  const arrowRes = classifyInkStroke(arrowPts);
  assert.equal(arrowRes?.kind, 'arrow');
  if (arrowRes) {
    const conn = recognizedShapeToObject('snap-arrow', arrowRes, {
      colorKey: '#111827',
      strokeWidth: 4,
    });
    assert.equal(conn.type, 'connector');
  }

  // 3. Circle / Ellipse
  const circlePts: Point[] = [];
  for (let i = 0; i <= 40; i += 1) {
    const angle = (i / 40) * Math.PI * 2;
    const r = 60 + Math.sin(i * 2.3) * 2;
    circlePts.push({ x: 150 + Math.cos(angle) * r, y: 150 + Math.sin(angle) * r });
  }
  assert.equal(classifyInkStroke(circlePts)?.kind, 'ellipse');

  // 4. Rectangle
  const rectPts = [
    ...sampleSegment({ x: 40, y: 40 }, { x: 200, y: 40 }, 12, 1),
    ...sampleSegment({ x: 200, y: 40 }, { x: 200, y: 140 }, 10, 1),
    ...sampleSegment({ x: 200, y: 140 }, { x: 40, y: 140 }, 12, 1),
    ...sampleSegment({ x: 40, y: 140 }, { x: 40, y: 40 }, 10, 1),
  ];
  assert.equal(classifyInkStroke(rectPts)?.kind, 'rectangle');

  // 5. Diamond
  const diamondPts = [
    ...sampleSegment({ x: 120, y: 20 }, { x: 200, y: 100 }, 10, 0.5),
    ...sampleSegment({ x: 200, y: 100 }, { x: 120, y: 180 }, 10, 0.5),
    ...sampleSegment({ x: 120, y: 180 }, { x: 40, y: 100 }, 10, 0.5),
    ...sampleSegment({ x: 40, y: 100 }, { x: 120, y: 20 }, 10, 0.5),
  ];
  assert.equal(classifyInkStroke(diamondPts)?.kind, 'diamond');

  // 6. Triangles (equilateral + right)
  const eqTriPts = [
    ...sampleSegment({ x: 120, y: 20 }, { x: 200, y: 160 }, 10, 0.5),
    ...sampleSegment({ x: 200, y: 160 }, { x: 40, y: 160 }, 10, 0.5),
    ...sampleSegment({ x: 40, y: 160 }, { x: 120, y: 20 }, 10, 0.5),
  ];
  assert.equal(classifyInkStroke(eqTriPts)?.kind, 'triangle-equilateral');

  const rightTriPts = [
    ...sampleSegment({ x: 40, y: 20 }, { x: 40, y: 160 }, 10, 0),
    ...sampleSegment({ x: 40, y: 160 }, { x: 180, y: 160 }, 10, 0),
    ...sampleSegment({ x: 180, y: 160 }, { x: 40, y: 20 }, 10, 0),
  ];
  assert.equal(classifyInkStroke(rightTriPts)?.kind, 'triangle-right');

  // 7. Non-geometric scribble must NOT be falsely snapped
  const scribblePts: Point[] = [];
  for (let i = 0; i < 60; i += 1) {
    scribblePts.push({
      x: 50 + i * 3 + Math.sin(i * 1.9) * 35,
      y: 100 + Math.cos(i * 1.3) * 45,
    });
  }
  assert.equal(classifyInkStroke(scribblePts), null);

  // 8. Lasso ink selection & bounding box
  const strokeA = createInkStroke({
    id: 's-a',
    tool: 'pen',
    point: { x: 50, y: 50 },
    color: '#111827',
    width: 4,
    opacity: 1,
  });
  const strokeB = createInkStroke({
    id: 's-b',
    tool: 'pen',
    point: { x: 500, y: 500 },
    color: '#111827',
    width: 4,
    opacity: 1,
  });
  const matched = strokesInRect([strokeA, strokeB], { x: 0, y: 0, width: 120, height: 120 });
  assert.deepEqual(
    matched.map((s) => s.id),
    ['s-a'],
  );
  const box = inkStrokesBoundingBox(matched, 24);
  assert.ok(box && box.width >= 48 && box.height >= 48);
}

// ---------------------------------------------------------------------------
// 3. Stylus Pressure Ribbon & Palm Rejection
// ---------------------------------------------------------------------------

async function testStylusPressureAndPalmRejection(): Promise<void> {
  // Legacy uniform-width compatibility
  const legacyPoints = [{ x: 0, y: 0 }, { x: 40, y: 10 }, { x: 80, y: 0 }];
  assert.equal(hasVariablePressure(legacyPoints), false);
  assert.ok(inkPathData(legacyPoints).startsWith('M 0 0'));

  // Pressure-sensitive points
  const pressurePoints = [
    { x: 0, y: 0, pressure: 0.1 },
    { x: 40, y: 0, pressure: 0.5 },
    { x: 80, y: 0, pressure: 1.0 },
  ];
  assert.equal(hasVariablePressure(pressurePoints), true);
  assert.ok(Math.abs(pressureWidthMultiplier(0) - 0.45) < 1e-6);
  assert.ok(Math.abs(pressureWidthMultiplier(1) - 1.45) < 1e-6);
  const ribbon = buildVariableWidthStrokePath(pressurePoints, 6);
  assert.ok(ribbon.startsWith('M ') && ribbon.endsWith(' Z'));

  // Pressure preserved in parseInkStroke
  const strokeWithPressure = {
    ...createInkStroke({
      id: 'p-1',
      tool: 'pen',
      point: pressurePoints[0],
      color: '#111827',
      width: 4,
      opacity: 1,
    }),
    points: pressurePoints,
  };
  const parsed = parseInkStroke(JSON.stringify(strokeWithPressure));
  assert.equal(parsed?.points[2].pressure, 1.0);

  // Palm rejection filter
  assert.equal(shouldAcceptInkPointer('touch', false), true);
  assert.equal(shouldAcceptInkPointer('stylus', false), true);
  assert.equal(shouldAcceptInkPointer('touch', true), false);
  assert.equal(shouldAcceptInkPointer('stylus', true), true);
  assert.equal(shouldAcceptInkPointer('mouse', true), true);

  // Preferences persistence round-trip
  const db = openTestDb();
  const initial = await loadAppPreferences(db);
  assert.equal(initial.stylusOnlyDrawing, DEFAULT_APP_PREFERENCES.stylusOnlyDrawing);
  assert.equal(initial.pressureSensitivity, DEFAULT_APP_PREFERENCES.pressureSensitivity);
  assert.equal(initial.holdToSnapShapes, DEFAULT_APP_PREFERENCES.holdToSnapShapes);

  await saveAppPreference(db, 'stylusOnlyDrawing', true);
  await saveAppPreference(db, 'pressureSensitivity', false);
  await saveAppPreference(db, 'holdToSnapShapes', false);
  const updated = await loadAppPreferences(db);
  assert.equal(updated.stylusOnlyDrawing, true);
  assert.equal(updated.pressureSensitivity, false);
  assert.equal(updated.holdToSnapShapes, false);
}

async function main(): Promise<void> {
  testMathLayoutAndTemplates();
  await testMathObjectHistoryAndPersistence();
  testShapeRecognition();
  await testStylusPressureAndPalmRejection();
  console.log('verify-math-recognition-stylus: all checks passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
