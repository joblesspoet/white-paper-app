import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

import { buildBackgroundLayers } from '../src/canvas/background.ts';
import {
  createDocumentHistory,
  documentReducer,
  isTextualObject,
} from '../src/canvas/document.ts';
import {
  LASER_DECAY_MS,
  appendLaserPoint,
  createLaserStroke,
  laserStrokeOpacity,
  pruneExpiredLaserStrokes,
  releaseLaserStroke,
  resolveLaserPalette,
} from '../src/canvas/laser.ts';
import {
  createCalculatorPasteCommand,
  evaluateExpression,
} from '../src/calculator/calculator-engine.ts';
import {
  getBoard,
  insertBoard,
  updateBoardSettings,
} from '../src/persistence/repository.ts';
import {
  MIGRATIONS,
  parseAppPreferences,
  parseBoardSettings,
  type BoardStyle,
} from '../src/persistence/schema.ts';
import {
  TIMER_PRESETS_SECONDS,
  adjustTimerDuration,
  createTimerPinCommand,
  createTimerState,
  formatTimerMs,
  pauseTimer,
  recordLap,
  resetTimer,
  selectTimerPreset,
  setTimerMode,
  startTimer,
  tickTimer,
} from '../src/timer/timer-model.ts';

function runLaserChecks() {
  let stroke = createLaserStroke('laser-1', 'red', { x: 10, y: 20 }, 1000);
  stroke = appendLaserPoint(stroke, { x: 11, y: 20 }, 1010, 5);
  assert.equal(stroke.points.length, 1, 'minDistance filters near-duplicate laser points');
  stroke = appendLaserPoint(stroke, { x: 25, y: 30 }, 1020, 5);
  assert.equal(stroke.points.length, 2);

  assert.equal(laserStrokeOpacity(stroke, 1500), 1, 'active laser stroke stays at full opacity');

  const released = releaseLaserStroke(stroke, 2000);
  assert.equal(laserStrokeOpacity(released, 2000), 1);
  assert.ok(Math.abs(laserStrokeOpacity(released, 2000 + LASER_DECAY_MS / 2) - 0.5) < 1e-6);
  assert.equal(laserStrokeOpacity(released, 2000 + LASER_DECAY_MS), 0);
  assert.equal(laserStrokeOpacity(released, 2000 + LASER_DECAY_MS + 200), 0);

  const active = createLaserStroke('laser-2', 'teal', { x: 0, y: 0 }, 2500);
  const pruned = pruneExpiredLaserStrokes([released, active], 2000 + LASER_DECAY_MS);
  assert.equal(pruned.length, 1);
  assert.equal(pruned[0]?.id, 'laser-2');

  const customPalette = resolveLaserPalette('#8b5cf6');
  assert.equal(customPalette.halo, '#8B5CF6');
  assert.match(customPalette.core, /^#[0-9A-F]{6}$/);
  const customStroke = createLaserStroke('laser-3', '#8b5cf6', { x: 5, y: 5 }, 3000);
  assert.equal(customStroke.colorKey, '#8b5cf6');
}

async function runBackgroundChecks() {
  const styles: BoardStyle[] = ['blank', 'dots', 'grid', 'ruled', 'isometric'];
  for (const style of styles) {
    const parsed = parseBoardSettings(JSON.stringify({ background: 'light', style, orientation: 'portrait' }));
    assert.equal(parsed.style, style);
    const pref = parseAppPreferences(JSON.stringify({ canvasStyle: style }));
    assert.equal(pref.canvasStyle, style);
  }

  assert.equal(
    parseBoardSettings(JSON.stringify({ style: 'unknown-style' })).style,
    'blank',
    'unknown board styles fall back safely to blank',
  );

  // Real SQLite round-trip
  const db = new DatabaseSync(':memory:');
  for (const migration of MIGRATIONS) {
    for (const stmt of migration.statements) db.exec(stmt);
  }
  const adapter = {
    execAsync: async (sql: string) => { db.exec(sql); },
    runAsync: async (sql: string, params: readonly unknown[] = []) => {
      db.prepare(sql).run(...(params as never[]));
      return { changes: 1, lastInsertRowId: 1 };
    },
    getFirstAsync: async <T,>(sql: string, params: readonly unknown[] = []) =>
      (db.prepare(sql).get(...(params as never[])) as T | undefined) ?? null,
    getAllAsync: async <T,>(sql: string, params: readonly unknown[] = []) =>
      db.prepare(sql).all(...(params as never[])) as T[],
    withTransactionAsync: async (fn: () => Promise<void>) => { await fn(); },
  };

  await insertBoard(adapter, {
    id: 'board-bg-1',
    title: 'Geometry Class',
    settings: { background: 'light', style: 'isometric', orientation: 'landscape' },
    createdAt: '2026-11-13T00:00:00.000Z',
  });
  let loaded = await getBoard(adapter, 'board-bg-1');
  assert.equal(loaded?.settings.style, 'isometric');

  await updateBoardSettings(adapter, 'board-bg-1', {
    background: 'dark',
    style: 'grid',
    orientation: 'portrait',
  });
  loaded = await getBoard(adapter, 'board-bg-1');
  assert.equal(loaded?.settings.style, 'grid');
  assert.equal(loaded?.settings.background, 'dark');
  db.close();

  // Pattern geometry parity
  const bounds = { x: 0, y: 0, width: 300, height: 300 };
  assert.equal(buildBackgroundLayers('blank', bounds).length, 0);
  assert.equal(buildBackgroundLayers('dots', bounds).length, 1);
  assert.equal(buildBackgroundLayers('grid', bounds).length, 2);
  assert.equal(buildBackgroundLayers('ruled', bounds).length, 2);
  assert.equal(buildBackgroundLayers('isometric', bounds).length, 1);
}

function runTimerChecks() {
  let timer = createTimerState();
  assert.equal(timer.durationMs, 300_000);
  assert.equal(TIMER_PRESETS_SECONDS.length, 5);

  timer = selectTimerPreset(timer, 60);
  assert.equal(timer.durationMs, 60_000);
  assert.equal(formatTimerMs(timer.remainingMs), '01:00');

  timer = adjustTimerDuration(timer, 60_000);
  assert.equal(timer.remainingMs, 120_000);
  timer = adjustTimerDuration(timer, -30_000);
  assert.equal(timer.remainingMs, 90_000);

  timer = startTimer(timer);
  assert.equal(timer.status, 'running');
  timer = tickTimer(timer, 45_000);
  assert.equal(timer.remainingMs, 45_000);

  timer = pauseTimer(timer);
  assert.equal(timer.status, 'paused');
  timer = tickTimer(timer, 10_000);
  assert.equal(timer.remainingMs, 45_000, 'paused timer does not tick');

  timer = startTimer(timer);
  timer = tickTimer(timer, 50_000);
  assert.equal(timer.remainingMs, 0);
  assert.equal(timer.status, 'completed');

  timer = resetTimer(timer);
  assert.equal(timer.status, 'idle');
  assert.equal(timer.remainingMs, timer.durationMs);

  // Stopwatch mode
  let sw = setTimerMode(timer, 'stopwatch');
  sw = startTimer(sw);
  sw = tickTimer(sw, 12_500);
  sw = recordLap(sw);
  assert.equal(sw.elapsedMs, 12_500);
  assert.equal(sw.laps.length, 1);

  // Pin to board undo/redo
  let history = createDocumentHistory();
  const cmd = createTimerPinCommand(timer, { x: 200, y: 150 }, 'pin-1');
  history = documentReducer(history, { type: 'command', command: cmd });
  assert.equal(history.present.objects.length, 1);
  const pinned = history.present.objects[0];
  assert.ok(pinned && isTextualObject(pinned) && pinned.type === 'sticky');
  assert.ok(pinned.text.startsWith('Timer: '));

  history = documentReducer(history, { type: 'undo' });
  assert.equal(history.present.objects.length, 0);
}

function runCalculatorChecks() {
  const prec = evaluateExpression('2 + 3 × 4');
  assert.ok(prec.ok && prec.value === 14);

  const parens = evaluateExpression('2(3 + 4)');
  assert.ok(parens.ok && parens.value === 14);

  const degSin = evaluateExpression('sin(30°)', { angleMode: 'DEG' });
  assert.ok(degSin.ok && degSin.value === 0.5 && degSin.formatted === '0.5');

  const radSin = evaluateExpression('sin(pi / 2)', { angleMode: 'RAD' });
  assert.ok(radSin.ok && radSin.value === 1);

  const sci = evaluateExpression('√(144) + 2^3 + log(100) + ln(e) + 4!');
  // 12 + 8 + 2 + 1 + 24 = 47
  assert.ok(sci.ok && sci.value === 47);

  const pct = evaluateExpression('200 × 15%');
  assert.ok(pct.ok && pct.value === 30);

  const ansUse = evaluateExpression('ANS × 2', { ans: 21 });
  assert.ok(ansUse.ok && ansUse.value === 42);

  // Errors
  const divZero = evaluateExpression('10 ÷ 0');
  assert.deepEqual(divZero, { ok: false, error: 'Division by zero' });

  const badSqrt = evaluateExpression('√(-4)');
  assert.deepEqual(badSqrt, { ok: false, error: 'Domain error' });

  const tan90 = evaluateExpression('tan(90)', { angleMode: 'DEG' });
  assert.deepEqual(tan90, { ok: false, error: 'Domain error' });

  const syntaxErr = evaluateExpression('2 +');
  assert.deepEqual(syntaxErr, { ok: false, error: 'Invalid expression' });

  const overflowErr = evaluateExpression('200!');
  assert.deepEqual(overflowErr, { ok: false, error: 'Overflow' });

  // Paste to board undo/redo
  let history = createDocumentHistory();
  const pasteCmd = createCalculatorPasteCommand('sin(30°) × 12', '6', { x: 100, y: 100 }, 'calc-1');
  history = documentReducer(history, { type: 'command', command: pasteCmd });
  assert.equal(history.present.objects.length, 1);
  const pasted = history.present.objects[0];
  assert.ok(pasted && isTextualObject(pasted) && pasted.type === 'text');
  assert.equal(pasted.text, 'sin(30°) × 12 = 6');

  history = documentReducer(history, { type: 'undo' });
  assert.equal(history.present.objects.length, 0);
  history = documentReducer(history, { type: 'redo' });
  assert.equal(history.present.objects.length, 1);
}

async function main() {
  runLaserChecks();
  await runBackgroundChecks();
  runTimerChecks();
  runCalculatorChecks();
  console.log(
    'teaching utilities checks passed: laser decay, 5 board styles + SQLite/export parity, timer/stopwatch + pin, scientific calculator + paste',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
