/// <reference types="node" />

import assert from 'node:assert/strict';

import {
  appendInkPoint,
  createInkStroke,
  DEFAULT_ERASER_RADIUS,
  eraseStrokesAt,
  eraserRadiusForScale,
  HIGHLIGHTER_MAX_OPACITY,
  HIGHLIGHTER_WIDTH_MULTIPLIER,
  inkPathData,
  MIN_POINT_DISTANCE_SCREEN,
  strokeIntersectsPoint,
  type InkStroke,
} from '../src/canvas/ink.ts';
import { screenToCanvas, type Viewport } from '../src/canvas/viewport.ts';

function close(actual: number, expected: number, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${expected}, got ${actual}`);
}

function assertPoint(actual: { x: number; y: number }, expected: { x: number; y: number }) {
  close(actual.x, expected.x);
  close(actual.y, expected.y);
}

function pen(overrides: Partial<InkStroke> = {}): InkStroke {
  return {
    ...createInkStroke({
      id: 'stroke-1',
      tool: 'pen',
      point: { x: 0, y: 0 },
      color: '#134E4A',
      width: 4,
      opacity: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
    }),
    ...overrides,
  };
}

// Drawing at a zoomed, panned viewport stores the same canvas point under the finger.
for (const viewport of [
  { x: 0, y: 0, scale: 1 },
  { x: 180, y: -90, scale: 2.5 },
  { x: -420, y: 260, scale: 0.5 },
] satisfies Viewport[]) {
  const screen = { x: 240, y: 380 };
  const canvasPoint = screenToCanvas(screen, viewport);
  const stroke = createInkStroke({
    id: `stroke-${viewport.scale}`,
    tool: 'pen',
    point: canvasPoint,
    color: '#134E4A',
    width: 4,
    opacity: 1,
  });
  assertPoint(stroke.points[0], canvasPoint);
}

// Tool changes capture the selected style with the stroke, not the current UI state.
const highlighter = createInkStroke({
  id: 'highlighter-1',
  tool: 'highlighter',
  point: { x: 10, y: 20 },
  color: '#F59E0B',
  width: 4,
  opacity: 1,
});
close(highlighter.width, 4 * HIGHLIGHTER_WIDTH_MULTIPLIER);
close(highlighter.opacity, HIGHLIGHTER_MAX_OPACITY);
assert.equal(highlighter.tool, 'highlighter');
assert.equal(pen().width, 4);

// Sampling skips duplicate points, which keeps a tap from becoming a heavy pile.
const sampled = appendInkPoint(pen(), { x: 0.2, y: 0 }, MIN_POINT_DISTANCE_SCREEN);
assert.equal(sampled.points.length, 1);
const appended = appendInkPoint(sampled, { x: 3, y: 4 }, MIN_POINT_DISTANCE_SCREEN);
assert.equal(appended.points.length, 2);
assert.notEqual(appended, sampled, 'appending returns a new immutable stroke');

// Path generation smooths intermediate samples and still renders a dot.
assert.equal(inkPathData([]), '');
assert.match(inkPathData([{ x: 5, y: 6 }]), /^M 5 6 L 5\.01 6$/);
const smooth = inkPathData([{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 0 }]);
assert.equal(smooth, 'M 0 0 Q 10 10 15 5 L 20 0');
assert.ok(!smooth.includes('NaN'));

// Erasing hits the body of a stroke between samples, not just stored points.
const line = pen({ points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] });
assert.equal(strokeIntersectsPoint(line, { x: 50, y: 3.5 }, 2), true);
assert.equal(strokeIntersectsPoint(line, { x: 50, y: 5 }, 2), false);
assert.equal(strokeIntersectsPoint(line, { x: 120, y: 0 }, 2), false);

// A wide highlighter is easier to erase across its rendered band.
const wide = highlighter;
assert.equal(strokeIntersectsPoint(wide, { x: 10 + wide.width / 2 - 1, y: 20 }, 0), true);
assert.equal(strokeIntersectsPoint(wide, { x: 10 + wide.width / 2 + 1, y: 20 }, 0), false);

// Erase returns the surviving strokes and the ids the reducer should record.
const survivor = pen({ id: 'survivor', points: [{ x: 0, y: 300 }, { x: 100, y: 300 }] });
const erased = eraseStrokesAt([line, survivor], { x: 50, y: 0 }, 2);
assert.deepEqual(erased.erasedIds, ['stroke-1']);
assert.deepEqual(erased.strokes, [survivor]);
assert.equal(erased.strokes[0], survivor, 'untouched strokes keep their identity');
const noHit = eraseStrokesAt([survivor], { x: 50, y: 0 }, 2);
assert.deepEqual(noHit.erasedIds, []);
assert.equal(noHit.strokes[0], survivor, 'no hit keeps the same stroke instances');

// The eraser keeps a constant screen size: at 2x it covers half the canvas units.
close(eraserRadiusForScale(DEFAULT_ERASER_RADIUS, 1), DEFAULT_ERASER_RADIUS);
close(eraserRadiusForScale(DEFAULT_ERASER_RADIUS, 2), DEFAULT_ERASER_RADIUS / 2);
close(eraserRadiusForScale(DEFAULT_ERASER_RADIUS, 0.5), DEFAULT_ERASER_RADIUS * 2);

// Zoomed erasing: a 24pt finger at 2x zoom covers a 12-unit canvas radius.
const zoomed = { x: 100, y: 50, scale: 2 } satisfies Viewport;
const eraserCanvasPoint = screenToCanvas({ x: 300, y: 250 }, zoomed);
assertPoint(eraserCanvasPoint, { x: 100, y: 100 });
const zoomedStroke = pen({ points: [{ x: 100, y: 100 }, { x: 200, y: 100 }] });
const zoomedResult = eraseStrokesAt([zoomedStroke], eraserCanvasPoint, eraserRadiusForScale(24, 2));
assert.deepEqual(zoomedResult.erasedIds, ['stroke-1']);

// A nearby parallel stroke outside the 12-unit band survives the same gesture.
const nearby = pen({ id: 'nearby', points: [{ x: 100, y: 120 }, { x: 200, y: 120 }] });
const untouched = eraseStrokesAt([nearby], eraserCanvasPoint, eraserRadiusForScale(24, 2));
assert.deepEqual(untouched.erasedIds, []);

console.log('ink checks passed: zoomed drawing, tool styles, smoothing, erasing, eraser scaling');
