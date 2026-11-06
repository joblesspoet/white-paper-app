/// <reference types="node" />

import assert from 'node:assert/strict';

import {
  EMPTY_DOCUMENT,
  applyCommand,
  createDocumentHistory,
  documentReducer,
  documentsEqual,
  prepareDocumentCommand,
  type CanvasDocument,
  type DocumentCommand,
} from '../src/canvas/document.ts';
import { canRedo, canUndo, nextRedoLabel, nextUndoLabel } from '../src/canvas/history.ts';
import { createInkStroke } from '../src/canvas/ink.ts';

function run(
  history: ReturnType<typeof createDocumentHistory>,
  command: DocumentCommand,
  transient = false,
) {
  return documentReducer(history, { type: 'command', command, transient });
}

function stroke(id: string, x = 0, y = 0) {
  return createInkStroke({
    id,
    tool: 'pen',
    point: { x, y },
    color: '#134E4A',
    width: 4,
    opacity: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
  });
}

function documentWith(...ids: string[]): CanvasDocument {
  return ids.reduce(
    (document, id, index) =>
      applyCommand(document, { type: 'ink.add', stroke: stroke(id, index * 100, 0) }),
    EMPTY_DOCUMENT,
  );
}

// -------------------------------------------------------------- initial state

let history = createDocumentHistory();
assert.equal(canUndo(history), false, 'a fresh board cannot undo');
assert.equal(canRedo(history), false, 'a fresh board cannot redo');
assert.equal(history.past.length, 0);
assert.equal(history.future.length, 0);

// ------------------------------------------------------- multiple ink strokes

history = run(history, { type: 'ink.add', stroke: stroke('one', 0, 0) });
history = run(history, { type: 'ink.add', stroke: stroke('two', 100, 0) });
history = run(history, { type: 'ink.add', stroke: stroke('three', 200, 0) });

assert.deepEqual(history.present.strokes.map((entry) => entry.id), ['one', 'two', 'three']);
assert.equal(history.past.length, 3, 'each completed stroke is one undo step');
assert.equal(canUndo(history), true);
assert.equal(canRedo(history), false);
assert.equal(nextUndoLabel(history), 'Add stroke');
assert.equal(nextRedoLabel(history), null);

history = documentReducer(history, { type: 'undo' });
assert.deepEqual(history.present.strokes.map((entry) => entry.id), ['one', 'two']);
assert.equal(history.future.length, 1);
assert.equal(canRedo(history), true);
assert.equal(nextRedoLabel(history), 'Add stroke');

history = documentReducer(history, { type: 'undo' });
assert.deepEqual(history.present.strokes.map((entry) => entry.id), ['one']);

history = documentReducer(history, { type: 'redo' });
assert.deepEqual(history.present.strokes.map((entry) => entry.id), ['one', 'two']);

history = documentReducer(history, { type: 'redo' });
assert.deepEqual(
  history.present.strokes.map((entry) => entry.id),
  ['one', 'two', 'three'],
  'redo replays commands in order',
);
assert.equal(canRedo(history), false);

assert.equal(
  documentReducer(history, { type: 'redo' }),
  history,
  'redo with an empty stack is a no-op',
);

// ---------------------------------------------------------- erase and undo

let eraseHistory = createDocumentHistory(documentWith('a', 'b', 'c'));
eraseHistory = run(eraseHistory, { type: 'ink.erase', point: { x: 0, y: 0 }, radius: 6 }, true);
eraseHistory = run(eraseHistory, { type: 'ink.erase', point: { x: 100, y: 0 }, radius: 6 }, true);

assert.equal(eraseHistory.past.length, 0, 'a sweep in progress is not on the undo stack yet');
assert.equal(canUndo(eraseHistory), true, 'an open gesture can still be undone');
assert.equal(eraseHistory.pending?.length, 2);

eraseHistory = documentReducer(eraseHistory, { type: 'commit' });
assert.deepEqual(eraseHistory.present.strokes.map((entry) => entry.id), ['c']);
assert.equal(eraseHistory.past.length, 1, 'the whole eraser sweep is one undo step');

eraseHistory = documentReducer(eraseHistory, { type: 'undo' });
assert.deepEqual(
  eraseHistory.present.strokes.map((entry) => entry.id),
  ['a', 'b', 'c'],
  'undo restores every erased stroke in its original order',
);
assert.equal(canRedo(eraseHistory), true);

eraseHistory = documentReducer(eraseHistory, { type: 'redo' });
assert.deepEqual(
  eraseHistory.present.strokes.map((entry) => entry.id),
  ['c'],
  'redo erases the same strokes again',
);

// An eraser command that catches two strokes in one sample is still one command.
let multiErase = createDocumentHistory(documentWith('left', 'right'));
multiErase = run(multiErase, { type: 'ink.erase', point: { x: 50, y: 0 }, radius: 100 });
assert.equal(multiErase.present.strokes.length, 0);
multiErase = documentReducer(multiErase, { type: 'undo' });
assert.deepEqual(multiErase.present.strokes.map((entry) => entry.id), ['left', 'right']);

// A miss records nothing.
let miss = createDocumentHistory(documentWith('safe'));
const missed = run(miss, { type: 'ink.erase', point: { x: 900, y: 900 }, radius: 4 });
assert.equal(missed, miss, 'an eraser miss keeps the same history');
assert.equal(missed.past.length, 0);
assert.equal(canUndo(missed), false);

// Undo while a sweep is still open commits the gesture and then reverts it.
let openSweep = createDocumentHistory(documentWith('open'));
openSweep = run(openSweep, { type: 'ink.erase', point: { x: 0, y: 0 }, radius: 6 }, true);
openSweep = documentReducer(openSweep, { type: 'undo' });
assert.deepEqual(openSweep.present.strokes.map((entry) => entry.id), ['open']);
assert.equal(openSweep.pending, null);
assert.equal(canRedo(openSweep), true);

// ------------------------------------------------------ new edit clears redo

let redoHistory = createDocumentHistory();
redoHistory = run(redoHistory, { type: 'ink.add', stroke: stroke('kept', 0, 0) });
redoHistory = run(redoHistory, { type: 'ink.add', stroke: stroke('removed', 100, 0) });
redoHistory = documentReducer(redoHistory, { type: 'undo' });
assert.equal(redoHistory.present.strokes.length, 1);
assert.equal(canRedo(redoHistory), true);

redoHistory = run(redoHistory, { type: 'ink.add', stroke: stroke('new', 400, 0) });
assert.equal(canRedo(redoHistory), false, 'a new edit clears the redo stack');
assert.equal(redoHistory.future.length, 0);
assert.deepEqual(redoHistory.present.strokes.map((entry) => entry.id), ['kept', 'new']);

// Redo is disabled while an unfinished gesture is changing the board, because
// committing that gesture would clear the redo stack.
let pendingRedo = createDocumentHistory();
pendingRedo = run(pendingRedo, { type: 'ink.add', stroke: stroke('first', 0, 0) });
pendingRedo = run(pendingRedo, { type: 'ink.add', stroke: stroke('second', 100, 0) });
pendingRedo = documentReducer(pendingRedo, { type: 'undo' });
assert.equal(canRedo(pendingRedo), true);
pendingRedo = run(pendingRedo, { type: 'ink.erase', point: { x: 0, y: 0 }, radius: 6 }, true);
assert.equal(canRedo(pendingRedo), false, 'redo is unavailable while a new gesture is open');
pendingRedo = documentReducer(pendingRedo, { type: 'commit' });
assert.equal(canRedo(pendingRedo), false, 'committing a new gesture leaves redo cleared');

// --------------------------------------------------------- command payloads

const addCommand = prepareDocumentCommand(EMPTY_DOCUMENT, {
  type: 'ink.add',
  stroke: stroke('typed-create'),
});
assert.equal(addCommand?.type, 'create');

const eraseDocument = documentWith('typed-delete');
const eraseCommand = prepareDocumentCommand(eraseDocument, {
  type: 'ink.erase',
  point: { x: 0, y: 0 },
  radius: 6,
});
assert.equal(eraseCommand?.type, 'delete');

// Two documents that look the same compare equal, which lets a drag that
// returns to its start be discarded instead of becoming an empty undo step.
assert.equal(documentsEqual(documentWith('same'), documentWith('same')), true);
assert.equal(documentsEqual(documentWith('one'), documentWith('two')), false);

// ------------------------------------------------------------- bounded stack

let bounded = createDocumentHistory();
for (let index = 0; index < 250; index += 1) {
  bounded = run(bounded, { type: 'ink.add', stroke: stroke(`bounded-${index}`, index * 10, 0) });
}
assert.ok(bounded.past.length <= 100, `history bounded, got ${bounded.past.length}`);
assert.equal(bounded.present.strokes.length, 250);

console.log('history checks passed: command stacks, multiple strokes, erase sweeps, undo/redo, redo clearing, bounded history');
