/// <reference types="node" />

import assert from 'node:assert/strict';

import {
  DUPLICATE_OFFSET,
  EMPTY_DOCUMENT,
  applyCommand,
  createDocumentHistory,
  createShapeObject,
  createStickyObject,
  createTextObject,
  documentReducer,
  duplicateObject,
  findObject,
  measureTextBlock,
  objectContainsPoint,
  rotatePoint,
  type CanvasDocument,
  type CanvasObject,
  type DocumentCommand,
  type DocumentHistory,
} from '../src/canvas/document.ts';
import {
  MIN_RESIZE_SCREEN,
  RESIZE_HANDLES,
  canvasRectToScreen,
  handleAtPoint,
  normalizeRotation,
  objectBounds,
  objectCorners,
  objectsInRect,
  pointerAngle,
  resizeObject,
  rotationFromPointer,
  selectionActionRail,
  selectionBounds,
  selectionCorners,
  selectionHandlePositions,
} from '../src/canvas/selection.ts';
import type { Point, Viewport } from '../src/canvas/viewport.ts';

function close(actual: number, expected: number, epsilon = 1e-6, message?: string) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    message ?? `expected ${expected}, got ${actual}`,
  );
}

function closePoint(actual: Point, expected: Point, epsilon = 1e-6) {
  close(actual.x, expected.x, epsilon, `x: expected ${expected.x}, got ${actual.x}`);
  close(actual.y, expected.y, epsilon, `y: expected ${expected.y}, got ${actual.y}`);
}

function sticky(id: string, x: number, y: number, overrides: Partial<CanvasObject> = {}): CanvasObject {
  return {
    ...createStickyObject({ id, point: { x: 0, y: 0 } }),
    x,
    y,
    ...overrides,
  } as CanvasObject;
}

function run(
  history: DocumentHistory,
  command: DocumentCommand,
  transient = false,
): DocumentHistory {
  return documentReducer(history, { type: 'command', command, transient });
}

// ------------------------------------------------------------ rotated bounds

const square = sticky('square', 100, 80);
assert.deepEqual(objectCorners(square), [
  { x: 100, y: 80 },
  { x: 212, y: 80 },
  { x: 212, y: 192 },
  { x: 100, y: 192 },
]);
assert.deepEqual(objectBounds(square), { x: 100, y: 80, width: 112, height: 112 });

const rotatedSquare = sticky('rotated', 100, 80, { rotation: 45 });
const centre = { x: 156, y: 136 };
const rotatedCorners = objectCorners(rotatedSquare);
for (let index = 0; index < 4; index += 1) {
  closePoint(rotatedCorners[index], rotatePoint(objectCorners(square)[index], centre, 45));
}
const rotatedBounds = objectBounds(rotatedSquare);
close(rotatedBounds.x, centre.x - 112 / Math.SQRT2);
close(rotatedBounds.y, centre.y - 112 / Math.SQRT2);
close(rotatedBounds.width, 112 * Math.SQRT2);
close(rotatedBounds.height, 112 * Math.SQRT2);

// A multi-selection box is the axis-aligned union of every rotated bound.
const far = sticky('far', 500, 400, { rotation: 15 });
const union = selectionBounds([rotatedSquare, far]);
const farBounds = objectBounds(far);
assert.ok(union);
close(union!.x, Math.min(rotatedBounds.x, farBounds.x));
close(union!.y, Math.min(rotatedBounds.y, farBounds.y));
close(union!.width, Math.max(rotatedBounds.x + rotatedBounds.width, farBounds.x + farBounds.width) - union!.x);
close(union!.height, Math.max(rotatedBounds.y + rotatedBounds.height, farBounds.y + farBounds.height) - union!.y);
assert.deepEqual(selectionCorners([rotatedSquare]), rotatedCorners, 'one object keeps its rotated corners');
assert.deepEqual(
  selectionCorners([rotatedSquare, far]),
  [
    { x: union!.x, y: union!.y },
    { x: union!.x + union!.width, y: union!.y },
    { x: union!.x + union!.width, y: union!.y + union!.height },
    { x: union!.x, y: union!.y + union!.height },
  ],
  'a multi-selection uses the union box',
);
assert.equal(selectionBounds([]), null);

// ------------------------------------------------------------ rotated hit testing

// Rotating a point by the object angle moves it from local space into world
// space; the inverse test must still accept it.
const worldInside = rotatePoint({ x: 156, y: 90 }, centre, 45);
assert.equal(objectContainsPoint(rotatedSquare, worldInside), true);
assert.equal(objectContainsPoint(rotatedSquare, worldInside), true);
assert.equal(objectContainsPoint(rotatedSquare, { x: 100, y: 80 }), false, 'the unrotated corner is outside a rotated note');
assert.equal(objectContainsPoint(rotatedSquare, centre), true, 'the centre always hits');

// Line and connector hit testing works in the rotated frame too.
const line = createShapeObject({
  id: 'line',
  shape: 'line',
  start: { x: 0, y: 0 },
  end: { x: 100, y: 0 },
});
const rotatedLine: CanvasObject = { ...line, height: 1, rotation: 45 };
const lineCentre = { x: 50, y: 0.5 };
const onRotatedLine = rotatePoint({ x: 80, y: 0.5 }, lineCentre, 45);
assert.equal(objectContainsPoint(rotatedLine, onRotatedLine), true);
assert.equal(objectContainsPoint(rotatedLine, { x: 70, y: 0 }), false, 'the old unrotated line is not the new one');

// ----------------------------------------------------------------- handles

const handles = selectionHandlePositions([rotatedSquare], 36);
assert.ok(handles);
closePoint(handles!.nw, rotatedCorners[0]);
closePoint(handles!.ne, rotatedCorners[1]);
closePoint(handles!.se, rotatedCorners[2]);
closePoint(handles!.sw, rotatedCorners[3]);
close(Math.hypot(handles!.rotate.x - (rotatedCorners[0].x + rotatedCorners[1].x) / 2, handles!.rotate.y - (rotatedCorners[0].y + rotatedCorners[1].y) / 2), 36);
assert.equal(selectionHandlePositions([rotatedSquare, far], 36), null, 'multi-selection has no corner handles');

for (const handle of [...RESIZE_HANDLES, 'rotate'] as const) {
  assert.equal(handleAtPoint([rotatedSquare], handles![handle], 1, 36), handle);
}
assert.equal(handleAtPoint([rotatedSquare], { x: 0, y: 0 }, 1, 36), null);
assert.equal(handleAtPoint([rotatedSquare, far], handles!.nw, 1, 36), null);

// -------------------------------------------------------------- resize maths

// An unrotated resize keeps the opposite corner anchored and ignores the
// object's position (the old version assumed x/y were zero).
const unrotatedResize = resizeObject(square, 'nw', { x: 90, y: 70 });
close(unrotatedResize.x, 90);
close(unrotatedResize.y, 70);
close(unrotatedResize.width, 122);
close(unrotatedResize.height, 122);
close(unrotatedResize.rotation, 0);
const oppositeCorner = objectCorners({ ...square, ...unrotatedResize } as CanvasObject)[2];
closePoint(oppositeCorner, { x: 212, y: 192 }, 1e-6);

// Every corner anchors the corner diagonally across from it.
for (const handle of RESIZE_HANDLES) {
  const result = resizeObject(rotatedSquare, handle, rotatePoint({ x: 100, y: 80 }, centre, 45));
  const resultCorners = objectCorners({ ...rotatedSquare, ...result });
  const anchors = { nw: 2, ne: 3, se: 0, sw: 1 } as const;
  closePoint(resultCorners[anchors[handle]], rotatedCorners[anchors[handle]], 1e-6);
  close(result.rotation, 45);
}

// A west resize can never invert the box; it clamps to the minimum size.
const squeezed = resizeObject(square, 'nw', { x: 500, y: 500 }, 24);
close(squeezed.width, 24);
close(squeezed.height, 24);
closePoint(objectCorners({ ...square, ...squeezed } as CanvasObject)[2], { x: 212, y: 192 }, 1e-6);

// Text re-wraps: the height comes from the measured block, not the pointer.
const text = {
  ...createTextObject({ id: 'text', point: { x: 0, y: 0 } }),
  text: 'one two three four five six seven eight nine ten eleven twelve',
  x: 100,
  y: 50,
} as CanvasObject;
const textWidth = 220;
const textResizeSe = resizeObject(text, 'se', { x: 100 + textWidth, y: 400 });
close(textResizeSe.width, textWidth);
close(textResizeSe.height, measureTextBlock((text as typeof text & { text: string }).text, 18, textWidth).height);
close(textResizeSe.x, 100);
close(textResizeSe.y, 50, 1e-6, 'south-east keeps the north-west anchor');

// Minimum size scales with zoom, so the on-screen handle never collapses.
const minAtTwo = MIN_RESIZE_SCREEN / 2;
const smallResize = resizeObject(square, 'se', { x: -999, y: -999 }, minAtTwo);
close(smallResize.width, minAtTwo);
close(smallResize.height, minAtTwo);

// ------------------------------------------------------------------ rotation

assert.equal(normalizeRotation(0), 0);
assert.equal(normalizeRotation(190), -170);
assert.equal(normalizeRotation(-190), 170);
assert.equal(normalizeRotation(180), 180);
assert.equal(normalizeRotation(-180), 180);
close(pointerAngle({ x: 1, y: 0 }, { x: 0, y: 0 }), 0);
close(pointerAngle({ x: 0, y: 1 }, { x: 0, y: 0 }), 90);

// The angle under the finger is preserved from the gesture's first sample.
const rotationCentre = { x: 50, y: 50 };
const startPointer = { x: 100, y: 50 };
const startOffset = 20 - pointerAngle(startPointer, rotationCentre);
const movedPointer = rotatePoint(startPointer, rotationCentre, 90);
close(rotationFromPointer(rotationCentre, movedPointer, startOffset), 110, 1e-6);

// Near a 15° step the value snaps, which makes straight objects easy to reset.
const anglePoint = (degrees: number) => ({
  x: 50 + Math.cos((degrees * Math.PI) / 180),
  y: 50 + Math.sin((degrees * Math.PI) / 180),
});
close(rotationFromPointer(rotationCentre, anglePoint(88), 0), 90);
close(rotationFromPointer(rotationCentre, anglePoint(80), 0), 80);

// ------------------------------------------------------------------ marquee

const first = sticky('first', 0, 0);
const second = sticky('second', 500, 500);
const marqueeSelection = objectsInRect([first, second], { x: -5, y: -5, width: 50, height: 50 });
assert.deepEqual(marqueeSelection.map((object) => object.id), ['first']);
assert.deepEqual(
  objectsInRect([first, second], { x: 400, y: 400, width: 400, height: 400 }).map((object) => object.id),
  ['second'],
  'a marquee intersects the object bounds',
);
assert.deepEqual(objectsInRect([first, second], { x: 300, y: 300, width: 100, height: 100 }), []);

// Rotation-aware marquee bounds: a 45° note reaches further than its box.
const diagonalMarquee = objectsInRect([rotatedSquare], { x: 60, y: 40, width: 20, height: 20 });
assert.equal(diagonalMarquee.length, 1, 'the marquee uses the rotated bounds');
assert.deepEqual(objectsInRect([rotatedSquare], { x: 60, y: 240, width: 20, height: 20 }), []);

// -------------------------------------------------- screen-space conversion

for (const viewport of [
  { x: 0, y: 0, scale: 1 },
  { x: 150, y: -80, scale: 2 },
  { x: -420, y: 260, scale: 0.5 },
  { x: 90, y: 40, scale: 4 },
] satisfies Viewport[]) {
  const rect = { x: 10, y: 20, width: 30, height: 40 };
  const screen = canvasRectToScreen(rect, viewport);
  close(screen.x, 10 * viewport.scale + viewport.x);
  close(screen.y, 20 * viewport.scale + viewport.y);
  close(screen.width, 30 * viewport.scale);
  close(screen.height, 40 * viewport.scale);
}

// -------------------------------------------------- selection action rail

// A rail centred beside a normal selection stays on the right, clear of the
// rotate handle above the object.
const railRight = selectionActionRail({ x: 100, y: 100, width: 120, height: 80 }, 4, 400, 800);
assert.equal(railRight.placement, 'right');
assert.equal(railRight.width, 46);
assert.equal(railRight.height, 4 * 44 + 2);
assert.equal(railRight.x, 100 + 120 + 12, 'the rail sits just right of the selection');
assert.equal(railRight.y, 100 + 40 - railRight.height / 2, 'the rail is vertically centred');

// Near the right edge it flips to the left instead of leaving the canvas.
const railLeft = selectionActionRail({ x: 300, y: 400, width: 80, height: 60 }, 3, 400, 800);
assert.equal(railLeft.placement, 'left');
assert.equal(railLeft.x, 300 - 12 - 46);

// A selection that spans the canvas falls back to the inside edge.
const railInside = selectionActionRail({ x: 4, y: 100, width: 392, height: 80 }, 2, 400, 800);
assert.equal(railInside.placement, 'inside');
assert.ok(railInside.x >= 8 && railInside.x + railInside.width <= 392, 'the rail stays inside the canvas');

// Vertical clamping keeps the actions reachable for objects at the top or bottom.
const railTop = selectionActionRail({ x: 20, y: -200, width: 60, height: 40 }, 4, 400, 500);
assert.equal(railTop.y, 8);
const railBottom = selectionActionRail({ x: 20, y: 900, width: 60, height: 40 }, 4, 400, 500);
assert.equal(railBottom.y, 500 - railBottom.height - 8);

// A side rail never covers the rotate handle, which sits 36pt above the top
// edge at the selection's horizontal centre, with a 22pt hit area.
const rotateClear = selectionActionRail({ x: 120, y: 200, width: 60, height: 24 }, 4, 400, 800);
const rotateCentreX = 120 + 60 / 2;
assert.ok(rotateClear.x > rotateCentreX + 11, 'a side rail never overlaps the top-centre rotate handle');

// ------------------------------------------------------------- duplicate

const duplicate = duplicateObject(first, 'copy');
assert.equal(duplicate.id, 'copy');
assert.equal(duplicate.x, first.x + DUPLICATE_OFFSET);
assert.equal(duplicate.y, first.y + DUPLICATE_OFFSET);
assert.equal(first.x, 0, 'the original is not mutated');
assert.equal(duplicate.type, first.type);
assert.equal(duplicate.width, first.width);
assert.deepEqual(duplicateObject(first, 'far-copy', 40), { ...first, id: 'far-copy', x: 40, y: 40 });

// ------------------------------------------------------ transform history

const baseDocument: CanvasDocument = {
  ...EMPTY_DOCUMENT,
  objects: [sticky('a', 100, 100), sticky('b', 300, 200)],
};

// A multi-object move is one undo step even though it sends a sample per frame.
let history = createDocumentHistory(baseDocument);
for (const [dx, dy] of [[5, 2], [18, 9], [40, 20]] as const) {
  history = run(history, {
    type: 'objects.geometry',
    label: 'Move',
    updates: [
      { id: 'a', x: 100 + dx, y: 100 + dy },
      { id: 'b', x: 300 + dx, y: 200 + dy },
    ],
  }, true);
}
assert.equal(history.past.length, 0, 'an open gesture is not on the undo stack');
assert.equal(history.pending?.length, 1, 'every frame merges into one pending transform');
history = documentReducer(history, { type: 'commit' });
assert.equal(history.past.length, 1, 'the whole multi-move is one undo step');
assert.equal(findObject(history.present, 'a')?.x, 140);
assert.equal(findObject(history.present, 'b')?.x, 340);
history = documentReducer(history, { type: 'undo' });
assert.equal(findObject(history.present, 'a')?.x, 100);
assert.equal(findObject(history.present, 'b')?.x, 300);
assert.equal(findObject(history.present, 'a')?.y, 100);
history = documentReducer(history, { type: 'redo' });
assert.equal(findObject(history.present, 'a')?.x, 140);
assert.equal(findObject(history.present, 'b')?.y, 220);

// A resize that returns exactly to its start adds no entry at all.
let noopResize = createDocumentHistory(baseDocument);
noopResize = run(noopResize, {
  type: 'objects.geometry',
  label: 'Resize',
  updates: [{ id: 'a', width: 140, height: 140 }],
}, true);
noopResize = run(noopResize, {
  type: 'objects.geometry',
  label: 'Resize',
  updates: [{ id: 'a', width: 112, height: 112 }],
}, true);
noopResize = documentReducer(noopResize, { type: 'commit' });
assert.equal(noopResize.past.length, 0, 'a gesture that ends where it started records nothing');
assert.equal(findObject(noopResize.present, 'a')?.width, 112);

// A resize and rotate are each one undo step too.
let transformHistory = createDocumentHistory(baseDocument);
transformHistory = run(transformHistory, {
  type: 'objects.geometry',
  label: 'Resize',
  updates: [{ id: 'a', ...resizeObject(sticky('a', 100, 100), 'se', { x: 260, y: 260 }) }],
}, true);
transformHistory = run(transformHistory, {
  type: 'objects.geometry',
  label: 'Rotate',
  updates: [{ id: 'a', rotation: 30 }],
}, true);
transformHistory = documentReducer(transformHistory, { type: 'commit' });
assert.equal(transformHistory.past.length, 1, 'one gesture is one entry across resize samples');
assert.equal(findObject(transformHistory.present, 'a')?.rotation, 30);
transformHistory = documentReducer(transformHistory, { type: 'undo' });
assert.equal(findObject(transformHistory.present, 'a')?.rotation, 0);
assert.equal(findObject(transformHistory.present, 'a')?.width, 112);

// Two consecutive gestures stay separate: committing the first closes it.
let twoGestures = createDocumentHistory(baseDocument);
twoGestures = run(twoGestures, {
  type: 'objects.geometry',
  label: 'Move',
  updates: [{ id: 'a', x: 110, y: 100 }],
}, true);
twoGestures = documentReducer(twoGestures, { type: 'commit' });
twoGestures = run(twoGestures, {
  type: 'objects.geometry',
  label: 'Move',
  updates: [{ id: 'a', x: 120, y: 100 }],
}, true);
twoGestures = documentReducer(twoGestures, { type: 'commit' });
assert.equal(twoGestures.past.length, 2, 'a new gesture does not merge into the previous one');
twoGestures = documentReducer(twoGestures, { type: 'undo' });
assert.equal(findObject(twoGestures.present, 'a')?.x, 110);

// A measured text height survives undoing a transform: geometry history
// restores only the box, not a stale copy of the whole object.
let measuredTransform = createDocumentHistory({
  ...EMPTY_DOCUMENT,
  objects: [
    {
      ...createTextObject({ id: 'measured', point: { x: 0, y: 0 } }),
      text: 'measure me',
      x: 100,
      y: 50,
    },
  ],
});
measuredTransform = run(measuredTransform, {
  type: 'objects.geometry',
  label: 'Move',
  updates: [{ id: 'measured', x: 140, y: 90 }],
}, true);
measuredTransform = documentReducer(measuredTransform, { type: 'commit' });
measuredTransform = documentReducer(measuredTransform, { type: 'measure', id: 'measured', height: 240 });
assert.equal(findObject(measuredTransform.present, 'measured')?.height, 240);
measuredTransform = documentReducer(measuredTransform, { type: 'undo' });
assert.equal(findObject(measuredTransform.present, 'measured')?.x, 100);
assert.equal(findObject(measuredTransform.present, 'measured')?.height, 240, 'undoing the move keeps the measured height');

// ------------------------------------------------- multi delete and duplicate

let multiDelete = createDocumentHistory(baseDocument);
multiDelete = documentReducer(multiDelete, {
  type: 'commands',
  commands: [
    { type: 'object.delete', id: 'a' },
    { type: 'object.delete', id: 'b' },
  ],
});
assert.equal(multiDelete.present.objects.length, 0);
assert.equal(multiDelete.past.length, 1, 'a multi-delete is one undo step');
multiDelete = documentReducer(multiDelete, { type: 'undo' });
assert.deepEqual(multiDelete.present.objects.map((object) => object.id), ['a', 'b'], 'undo restores order');
multiDelete = documentReducer(multiDelete, { type: 'redo' });
assert.equal(multiDelete.present.objects.length, 0);

let multiDuplicate = createDocumentHistory(baseDocument);
const copies = [
  duplicateObject(findObject(baseDocument, 'a')!, 'a-copy'),
  duplicateObject(findObject(baseDocument, 'b')!, 'b-copy'),
];
multiDuplicate = documentReducer(multiDuplicate, {
  type: 'commands',
  commands: copies.map((object) => ({ type: 'object.insert' as const, object })),
});
assert.equal(multiDuplicate.present.objects.length, 4);
assert.equal(multiDuplicate.past.length, 1, 'a multi-duplicate is one undo step');
assert.deepEqual(multiDuplicate.present.objects.map((object) => object.id), ['a', 'b', 'a-copy', 'b-copy']);
multiDuplicate = documentReducer(multiDuplicate, { type: 'undo' });
assert.equal(multiDuplicate.present.objects.length, 2, 'undo removes every copy');
multiDuplicate = documentReducer(multiDuplicate, { type: 'redo' });
assert.equal(multiDuplicate.present.objects.length, 4, 'redo restores every copy');

// Duplicating one object is still one history entry through the same action.
let singleDuplicate = createDocumentHistory(baseDocument);
singleDuplicate = documentReducer(singleDuplicate, {
  type: 'commands',
  commands: [{ type: 'object.insert', object: duplicateObject(first, 'single-copy') }],
});
assert.equal(singleDuplicate.past.length, 1);
singleDuplicate = documentReducer(singleDuplicate, { type: 'undo' });
assert.equal(findObject(singleDuplicate.present, 'single-copy'), null);

// --------------------------------------------------------------- application

// The end-to-end path the viewport uses: select a rotated object, resize it
// from a handle, then rotate from the handle stem.
const applied = applyCommand(EMPTY_DOCUMENT, { type: 'object.insert', object: rotatedSquare });
const selected = findObject(applied, 'rotated')!;
const selectedHandles = selectionHandlePositions([selected], 36)!;
assert.equal(handleAtPoint([selected], selectedHandles.nw, 2, 36), 'nw');
const appliedResize = resizeObject(selected, 'nw', rotatePoint({ x: 90, y: 70 }, centre, 45));
const resizedDocument = applyCommand(applied, {
  type: 'objects.geometry',
  updates: [{ id: selected.id, ...appliedResize }],
});
const resizedObject = findObject(resizedDocument, 'rotated')!;
closePoint(objectCorners(resizedObject)[2], rotatedCorners[2], 1e-6);
close(resizedObject.rotation, 45);
assert.ok(objectContainsPoint(resizedObject, rotatePoint({ x: 100, y: 80 }, centre, 45)), 'the resized rotated object still hit-tests');

console.log('selection checks passed: rotated bounds and hit testing, handles, resize anchors, rotation, marquee, screen conversion, action rail placement, duplicate, multi-transform undo/redo');
