/// <reference types="node" />

import assert from 'node:assert/strict';

import { contrastRatio, hexToHsv, hsvToHex, isHexColor, isReadableOn, readableTextColor } from '../src/canvas/colors.ts';
import {
  DEFAULT_STICKY_FONT_SIZE,
  DEFAULT_TEXT_FONT_SIZE,
  EMPTY_DOCUMENT,
  PEN_COLORS,
  SHAPE_COLORS,
  STICKY_COLORS,
  STICKY_TEXT_COLOR,
  TEXT_COLORS,
  TEXT_WIDTH,
  applyCommand,
  createDocumentHistory,
  createStickyObject,
  createTextObject,
  documentReducer,
  editingCommit,
  findObject,
  isCustomColor,
  keepObjectAboveKeyboard,
  keyboardOverlap,
  measureTextBlock,
  objectAtPoint,
  objectFill,
  objectScreenRect,
  objectTextColor,
  textColorKeyForValue,
  textColorValue,
  textLineHeight,
  withObjectStyle,
  withObjectText,
  type CanvasDocument,
  type CanvasObject,
  type TextObject,
  type DocumentCommand,
} from '../src/canvas/document.ts';
import { canRedo, canUndo } from '../src/canvas/history.ts';
import { createInkStroke } from '../src/canvas/ink.ts';
import { canvasToScreen, screenToCanvas, type Viewport } from '../src/canvas/viewport.ts';
import { colors } from '../src/theme.ts';

function close(actual: number, expected: number, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${expected}, got ${actual}`);
}

/** Apply commands to a history the same way the editor does. */
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

function textObject(text = 'Hello', overrides: Partial<TextObject> = {}): TextObject {
  return { ...createTextObject({ id: 'text-1', point: { x: 0, y: 0 } }), text, ...overrides };
}

function stickyObject(text = 'Note') {
  return { ...createStickyObject({ id: 'sticky-1', point: { x: 0, y: 0 } }), text };
}

// ---------------------------------------------------------------- creation

// A tap creates the object centred on the tapped canvas point at any zoom level.
for (const viewport of [
  { x: 0, y: 0, scale: 1 },
  { x: 150, y: -80, scale: 2 },
  { x: -420, y: 260, scale: 0.5 },
  { x: 90, y: 40, scale: 4 },
] satisfies Viewport[]) {
  const tapScreen = { x: 200, y: 320 };
  const tapCanvas = screenToCanvas(tapScreen, viewport);
  const text = createTextObject({ id: 'text', point: tapCanvas });
  const sticky = createStickyObject({ id: 'sticky', point: tapCanvas });
  for (const object of [text, sticky]) {
    const centre = { x: object.x + object.width / 2, y: object.y + object.height / 2 };
    // Positions are rounded to whole canvas units, so allow half a unit of drift.
    const epsilon = 0.5 * viewport.scale + 1e-6;
    const screenCentre = canvasToScreen(centre, viewport);
    close(screenCentre.x, tapScreen.x, epsilon);
    close(screenCentre.y, tapScreen.y, epsilon);
  }
  // The box also stays the same canvas size: zooming never resizes the object.
  assert.equal(text.width, TEXT_WIDTH);
  assert.equal(screenToCanvas(canvasToScreen({ x: text.width, y: 0 }, viewport), viewport).x, TEXT_WIDTH);
}

// New objects start empty with the requested style.
const freshText = createTextObject({ id: 'a', point: { x: 40, y: 40 }, colorKey: 'teal', fontSize: 24 });
assert.equal(freshText.text, '');
assert.equal(freshText.colorKey, 'teal');
assert.equal(freshText.fontSize, 24);
assert.equal(freshText.rotation, 0);
const freshSticky = createStickyObject({ id: 'b', point: { x: 0, y: 0 } });
assert.equal(freshSticky.colorKey, 'butter');
assert.equal(freshSticky.fontSize, DEFAULT_STICKY_FONT_SIZE);
assert.equal(freshSticky.width, freshSticky.height, 'a sticky note is square');

// --------------------------------------------------------------- measuring

// Text objects grow downwards to fit their content and shrink back again.
assert.equal(measureTextBlock('', DEFAULT_TEXT_FONT_SIZE, TEXT_WIDTH).lines, 1);
const oneLine = measureTextBlock('Hello', DEFAULT_TEXT_FONT_SIZE, TEXT_WIDTH);
const threeLines = measureTextBlock('one\ntwo\nthree', DEFAULT_TEXT_FONT_SIZE, TEXT_WIDTH);
assert.equal(threeLines.lines, 3);
assert.equal(threeLines.height, 3 * textLineHeight(DEFAULT_TEXT_FONT_SIZE) + 16);
assert.ok(threeLines.height > oneLine.height);
const longLine = measureTextBlock('x'.repeat(200), DEFAULT_TEXT_FONT_SIZE, TEXT_WIDTH);
assert.ok(longLine.lines > 1, 'a long line wraps inside the object width');

const grown = withObjectText(textObject(''), 'one\ntwo\nthree') as CanvasObject;
assert.equal(grown.height, threeLines.height);
const shrunk = withObjectText(grown, 'one');
assert.equal(shrunk.height, oneLine.height);
assert.equal(withObjectText(grown, grown.text ?? ''), grown, 'editing to the same text is a no-op');

// Font size changes re-measure text objects but leave the sticky paper alone.
const bigger = withObjectStyle(grown, { fontSize: 24 }) as CanvasObject;
assert.equal(bigger.fontSize, 24);
assert.ok(bigger.height > grown.height);
const resizedSticky = withObjectStyle(stickyObject(), { fontSize: 20 });
assert.equal(resizedSticky.height, stickyObject().height, 'sticky paper keeps its size');
assert.equal(withObjectStyle(grown, {}), grown, 'no style change keeps the same object');

// Bold and italic are stored on textual objects and re-measure the text block.
const bolded = withObjectStyle(grown, { fontWeight: 'bold' }) as TextObject;
assert.equal(bolded.fontWeight, 'bold');
assert.equal(bolded.fontStyle, 'normal');
assert.ok(bolded.height >= grown.height, 'bold text never shrinks its hit box');
const slanted = withObjectStyle(bolded, { fontStyle: 'italic' }) as TextObject;
assert.equal(slanted.fontStyle, 'italic');
assert.equal(slanted.fontWeight, 'bold', 'weight survives a slant change');
const resetWeight = withObjectStyle(slanted, { fontWeight: 'normal', fontStyle: 'normal' }) as TextObject;
assert.equal(resetWeight.fontWeight, 'normal');
assert.equal(resetWeight.fontStyle, 'normal');
const boldNote = withObjectStyle(stickyObject(), { fontWeight: 'bold', fontStyle: 'italic' }) as ReturnType<typeof stickyObject>;
assert.equal(boldNote.type, 'sticky');
assert.equal(boldNote.fontWeight, 'bold');
assert.equal(boldNote.fontStyle, 'italic');
assert.equal(boldNote.height, stickyObject().height, 'bold sticky text keeps the paper size');
const freshBold = createTextObject({ id: 'bold', point: { x: 0, y: 0 }, fontWeight: 'bold', fontStyle: 'italic' });
assert.equal(freshBold.fontWeight, 'bold');
assert.equal(freshBold.fontStyle, 'italic');

// ----------------------------------------------------------------- palette

// Sticky notes always use the dark note ink, and every pastel is readable with it.
for (const entry of STICKY_COLORS) {
  const note = { ...stickyObject(), colorKey: entry.key } as CanvasObject;
  assert.equal(objectTextColor(note, false), STICKY_TEXT_COLOR);
  assert.equal(objectTextColor(note, true), STICKY_TEXT_COLOR);
  assert.equal(objectFill(note), entry.fill);
  assert.ok(
    isReadableOn(STICKY_TEXT_COLOR, entry.fill),
    `${entry.key} note text must clear 4.5:1, got ${contrastRatio(STICKY_TEXT_COLOR, entry.fill).toFixed(2)}`,
  );
}

// Text colours are readable on the canvas in both themes.
for (const entry of TEXT_COLORS) {
  const text = { ...textObject(), colorKey: entry.key } as CanvasObject;
  assert.ok(
    isReadableOn(objectTextColor(text, false), colors.background),
    `${entry.key} text on the light canvas is ${contrastRatio(objectTextColor(text, false), colors.background).toFixed(2)}:1`,
  );
  assert.ok(
    isReadableOn(objectTextColor(text, true), colors.darkBackground),
    `${entry.key} text on the dark canvas is ${contrastRatio(objectTextColor(text, true), colors.darkBackground).toFixed(2)}:1`,
  );
}
assert.equal(objectFill(textObject()), undefined, 'text objects have no fill');

// ------------------------------------------------------- custom colours

// A custom hex is stored verbatim and survives theme changes unchanged.
assert.equal(isHexColor('#FF00AA'), true);
assert.equal(isHexColor('FF00AA'), false, 'the leading hash is required');
assert.equal(isCustomColor('#FF00AA'), true);
assert.equal(isCustomColor('teal'), false);
assert.equal(textColorValue('#FF00AA', false), '#FF00AA');
assert.equal(textColorValue('#FF00AA', true), '#FF00AA');
assert.equal(textColorKeyForValue('#FF00AA'), null, 'custom colours are never remapped');

const customText = { ...textObject(), colorKey: '#FF00AA' } as CanvasObject;
assert.equal(objectTextColor(customText, false), '#FF00AA');
assert.equal(objectTextColor(customText, true), '#FF00AA');

// A custom note fill keeps its own ink legible instead of forcing teal on black.
const darkNote = { ...stickyObject(), colorKey: '#111827' } as CanvasObject;
assert.equal(objectFill(darkNote), '#111827');
assert.equal(objectTextColor(darkNote, false), '#FFFFFF');
const lightNote = { ...stickyObject(), colorKey: '#FFF7CC' } as CanvasObject;
assert.equal(objectFill(lightNote), '#FFF7CC');
assert.equal(objectTextColor(lightNote, false), STICKY_TEXT_COLOR);
assert.ok(
  isReadableOn(objectTextColor(darkNote, true), objectFill(darkNote)!),
  'custom note ink must clear 4.5:1',
);

// The picker's HSV model round-trips the primaries exactly.
assert.equal(hsvToHex(hexToHsv('#FF0000')), '#FF0000');
assert.equal(hsvToHex(hexToHsv('#00FF00')), '#00FF00');
assert.equal(hsvToHex(hexToHsv('#0000FF')), '#0000FF');
assert.equal(hsvToHex({ h: 0, s: 0, v: 0 }), '#000000');
assert.equal(hsvToHex({ h: 210, s: 0, v: 1 }), '#FFFFFF');
assert.equal(readableTextColor('#111827', ['#134E4A', '#FFFFFF']), '#FFFFFF');

// ------------------------------------------------------------- hit testing

const lower = { ...stickyObject('lower'), id: 'lower', x: 0, y: 0 };
const upper = { ...stickyObject('upper'), id: 'upper', x: 40, y: 40 };
const objects = [lower, upper];
assert.equal(objectAtPoint(objects, { x: 10, y: 10 })?.id, 'lower');
assert.equal(objectAtPoint(objects, { x: 60, y: 60 })?.id, 'upper', 'topmost object wins');
assert.equal(objectAtPoint(objects, { x: 400, y: 400 }), null);
assert.equal(objectAtPoint(objects, { x: 0, y: 0 })?.id, 'lower', 'edges are inside the box');

// ----------------------------------------------------------------- commands

let document: CanvasDocument = EMPTY_DOCUMENT;
const placed = textObject('hello');
document = applyCommand(document, { type: 'object.insert', object: placed });
assert.equal(document.objects.length, 1);
assert.equal(document, applyCommand(document, { type: 'object.move', id: 'text-1', x: placed.x, y: placed.y }), 'unmoved object keeps the document');
assert.equal(document, applyCommand(document, { type: 'object.delete', id: 'nope' }), 'unknown id keeps the document');
assert.equal(document, applyCommand(document, { type: 'ink.erase', point: { x: 999, y: 999 }, radius: 4 }), 'a miss keeps the document');

const moved = applyCommand(document, { type: 'object.move', id: 'text-1', x: 120, y: 60 });
assert.equal(moved.objects[0].x, 120);
assert.equal(moved.objects[0].y, 60);
assert.equal(moved.objects[0].width, document.objects[0].width, 'moving never resizes');

const styled = applyCommand(moved, { type: 'object.update', id: 'text-1', text: 'hello world', colorKey: 'red', fontSize: 24 });
const styledObject = findObject(styled, 'text-1');
assert.ok(styledObject);
assert.equal(styledObject.text, 'hello world');
assert.equal(styledObject.colorKey, 'red');
assert.equal(styledObject.fontSize, 24);

// Weight and slant travel through the update command like the other style fields.
const styledBold = applyCommand(styled, {
  type: 'object.update',
  id: 'text-1',
  fontWeight: 'bold',
  fontStyle: 'italic',
});
const boldObject = findObject(styledBold, 'text-1');
assert.ok(boldObject && boldObject.type === 'text');
assert.equal(boldObject.fontWeight, 'bold');
assert.equal(boldObject.fontStyle, 'italic');

const erased = applyCommand(document, { type: 'ink.add', stroke: stroke('s1') });
const afterErase = applyCommand(erased, { type: 'ink.erase', point: { x: 0, y: 0 }, radius: 10 });
assert.equal(afterErase.strokes.length, 0);

// ------------------------------------------------------------ empty objects

// Tapping the canvas and typing nothing leaves no object and no undo step.
assert.equal(editingCommit({ ...createTextObject({ id: 'new', point: { x: 0, y: 0 } }) }, true), null);
assert.equal(editingCommit({ ...createStickyObject({ id: 'new', point: { x: 0, y: 0 } }), text: '   ' }, true), null);

// Clearing an existing object deletes it, which undo can restore.
const cleared = editingCommit({ ...textObject(''), }, false);
assert.deepEqual(cleared, { type: 'object.delete', id: 'text-1' });

// Committing typed text inserts once, with trimmed text and the chosen style.
const committed = editingCommit({ ...textObject(' hi '), colorKey: 'teal', fontSize: 24 }, true);
assert.ok(committed && committed.type === 'object.insert');
assert.equal(committed.object.text, 'hi');
assert.equal(committed.object.colorKey, 'teal');
const updated = editingCommit(textObject('edited'), false);
assert.ok(updated && updated.type === 'object.update');
assert.equal(updated.text, 'edited');
const boldUpdate = editingCommit(textObject('edited', { fontWeight: 'bold', fontStyle: 'italic' }), false);
assert.ok(boldUpdate && boldUpdate.type === 'object.update');
assert.equal(boldUpdate.fontWeight, 'bold');
assert.equal(boldUpdate.fontStyle, 'italic');

// ------------------------------------------------------------ undo history

// One completed edit is exactly one undo step.
let history = createDocumentHistory();
assert.equal(canUndo(history), false);
history = run(history, committed!);
assert.equal(history.present.objects.length, 1);
assert.equal(canUndo(history), true);
history = documentReducer(history, { type: 'undo' });
assert.equal(history.present.objects.length, 0, 'undo removes the inserted object');
assert.equal(canRedo(history), true);
history = documentReducer(history, { type: 'redo' });
assert.equal(history.present.objects.length, 1, 'redo restores it');

// Real text layout corrects the estimated height without adding an undo step.
const measuredHeight = 123;
const measured = documentReducer(history, { type: 'measure', id: 'text-1', height: measuredHeight });
assert.equal(findObject(measured.present, 'text-1')?.height, measuredHeight);
assert.equal(measured.past.length, history.past.length, 'measuring is not an undoable edit');
assert.equal(canRedo(measured), canRedo(history), 'measuring keeps redo available');
assert.equal(
  documentReducer(measured, { type: 'measure', id: 'text-1', height: measuredHeight }),
  measured,
  'the same measured height keeps the state',
);

// A drag hands in many transient moves but records one undo step from the grab point.
const dragged = textObject('drag');
history = createDocumentHistory(applyCommand(EMPTY_DOCUMENT, { type: 'object.insert', object: dragged }));
history = run(history, { type: 'object.move', id: 'text-1', x: 10, y: 10 }, true);
history = run(history, { type: 'object.move', id: 'text-1', x: 40, y: 30 }, true);
history = run(history, { type: 'object.move', id: 'text-1', x: 80, y: 50 }, true);
assert.equal(history.past.length, 0, 'a gesture in progress is not on the undo stack yet');
history = documentReducer(history, { type: 'commit' });
assert.equal(history.past.length, 1, 'the whole drag is one entry');
assert.equal(findObject(history.present, 'text-1')?.x, 80);
history = documentReducer(history, { type: 'undo' });
assert.equal(findObject(history.present, 'text-1')?.x, dragged.x, 'undo returns the object to where the drag started');

// A long drag is folded into one pending command, not one per pointer sample.
let longDrag = createDocumentHistory(applyCommand(EMPTY_DOCUMENT, { type: 'object.insert', object: dragged }));
for (let step = 1; step <= 50; step += 1) {
  longDrag = run(longDrag, { type: 'object.move', id: 'text-1', x: 80 + step, y: 50 + step }, true);
}
assert.equal(longDrag.pending?.length, 1, 'consecutive moves of one object are coalesced');
longDrag = documentReducer(longDrag, { type: 'commit' });
assert.equal(longDrag.past.length, 1);
longDrag = documentReducer(longDrag, { type: 'undo' });
assert.equal(findObject(longDrag.present, 'text-1')?.x, dragged.x);
longDrag = documentReducer(longDrag, { type: 'redo' });
assert.equal(findObject(longDrag.present, 'text-1')?.x, 130);

// Touching an object without moving it records nothing and keeps redo available.
const tapped = textObject('tap');
history = createDocumentHistory();
history = run(history, { type: 'object.insert', object: tapped });
history = documentReducer(history, { type: 'undo' });
const redoable = history;
assert.equal(canRedo(history), true);
history = run(history, { type: 'object.move', id: 'text-1', x: tapped.x, y: tapped.y }, true);
history = documentReducer(history, { type: 'commit' });
assert.equal(history.past.length, 0, 'a touch that moved nothing adds no undo step');
assert.equal(canRedo(history), true, 'a no-op gesture keeps the redo stack');

// An eraser sweep collapses into one undo step too.
history = createDocumentHistory(applyCommand(EMPTY_DOCUMENT, { type: 'ink.add', stroke: stroke('s1') }));
history = run(history, { type: 'ink.erase', point: { x: 0, y: 0 }, radius: 10 }, true);
history = run(history, { type: 'ink.erase', point: { x: 1, y: 0 }, radius: 10 }, true);
history = documentReducer(history, { type: 'commit' });
assert.equal(history.present.strokes.length, 0);
assert.equal(history.past.length, 1);
history = documentReducer(history, { type: 'undo' });
assert.equal(history.present.strokes.length, 1, 'undo restores the erased stroke');

// Ink and objects share one chronological history.
history = createDocumentHistory();
history = run(history, { type: 'ink.add', stroke: stroke('ink-1') });
history = run(history, editingCommit(textObject('note'), true)!);
history = run(history, { type: 'ink.add', stroke: stroke('ink-2') });
assert.equal(history.past.length, 3, 'three commands, three undo steps');
history = documentReducer(history, { type: 'undo' });
assert.equal(history.present.strokes.length, 1);
assert.equal(history.present.objects.length, 1, 'undo hits the newest change first');
history = documentReducer(history, { type: 'undo' });
assert.equal(history.present.objects.length, 0);
history = documentReducer(history, { type: 'undo' });
assert.equal(history.present.strokes.length, 0);
assert.equal(canUndo(history), false);

// A new edit after undo clears the redo stack.
history = documentReducer(history, { type: 'redo' });
assert.equal(canRedo(history), true);
history = run(history, editingCommit(textObject('newer'), true)!);
assert.equal(canRedo(history), false);
assert.equal(redoable.present.objects.length, 0);

// Deleting and undoing restores the object, and the history stays bounded.
history = createDocumentHistory(applyCommand(EMPTY_DOCUMENT, { type: 'object.insert', object: textObject('keep me') }));
history = run(history, { type: 'object.delete', id: 'text-1' });
assert.equal(history.present.objects.length, 0);
history = documentReducer(history, { type: 'undo' });
assert.equal(findObject(history.present, 'text-1')?.text, 'keep me');
for (let index = 0; index < 250; index += 1) {
  history = run(history, { type: 'ink.add', stroke: stroke(`bounded-${index}`) });
}
assert.ok(history.past.length <= 100, `history bounded, got ${history.past.length}`);

// ------------------------------------------------------ keyboard visibility

const canvas = { x: 0, y: 100, width: 390, height: 600 };
const keyboard = 320;

// The keyboard covers part of the window; only the covered part of the canvas counts.
close(keyboardOverlap(320, canvas, 900), 320 - (900 - 700));
close(keyboardOverlap(100, canvas, 700), 100, 1e-9);
close(keyboardOverlap(80, { ...canvas, height: 500 }, 700), 0, 1e-9);

// An object hidden behind the keyboard pans up until it sits above it.
for (const viewport of [
  { x: 0, y: 0, scale: 0.5 },
  { x: 0, y: 0, scale: 1 },
  { x: 0, y: 0, scale: 2 },
  { x: 120, y: -60, scale: 4 },
] satisfies Viewport[]) {
  // Deep enough that the note sits behind the keyboard at every zoom level.
  const object = createStickyObject({ id: 'note', point: { x: 120, y: 900 } });
  const rect = objectScreenRect(object, viewport);
  const before = {
    x: canvas.x + rect.x,
    y: canvas.y + rect.y,
    width: rect.width,
    height: rect.height,
  };
  const next = keepObjectAboveKeyboard({ object: before, canvas, viewport, bottomInset: keyboard });
  const usableTop = canvas.y + 16;
  const usableBottom = canvas.y + canvas.height - keyboard - 16;
  const afterRect = objectScreenRect(object, next);
  close(canvas.y + afterRect.y + afterRect.height, usableBottom, 1e-6);
  if (rect.height <= usableBottom - usableTop) {
    assert.ok(canvas.y + afterRect.y >= usableTop, 'the object stays below the top bar');
  }
  assert.equal(next.scale, viewport.scale, 'keeping the object visible never zooms');
  assert.ok(afterRect.y < rect.y, 'the viewport moved the object up, it did not move the object');
}

// An object already above the keyboard leaves the viewport alone.
const visible = { x: canvas.x + 20, y: canvas.y + 20, width: 100, height: 100 };
const untouched = keepObjectAboveKeyboard({ object: visible, canvas, viewport: { x: 12, y: 34, scale: 1.5 }, bottomInset: keyboard });
assert.deepEqual(untouched, { x: 12, y: 34, scale: 1.5 });

// An object wider than the canvas is pulled back inside horizontally.
const wide = { x: canvas.x + 300, y: canvas.y + 20, width: 300, height: 100 };
const pulled = keepObjectAboveKeyboard({ object: wide, canvas, viewport: { x: 0, y: 0, scale: 1 }, bottomInset: keyboard });
assert.equal(wide.x + pulled.x + wide.width, canvas.x + canvas.width - 16, 'the right edge is pulled inside');

// A note taller than the free band keeps its bottom edge (the caret) on screen.
const tall = { x: canvas.x + 20, y: canvas.y + 150, width: 100, height: 400 };
const tallViewport = keepObjectAboveKeyboard({ object: tall, canvas, viewport: { x: 0, y: 0, scale: 1 }, bottomInset: keyboard });
close(tall.y + tallViewport.y + tall.height, canvas.y + canvas.height - keyboard - 16, 1e-9);

// ---------------------------------------------------------------- defaults

assert.equal(DEFAULT_TEXT_FONT_SIZE, 18);
assert.equal(freshSticky.text, '');
assert.ok(STICKY_COLORS.length >= 3, 'stickies ship with a usable colour set');
assert.ok(TEXT_COLORS.length >= 12, 'the shared canvas palette is complete');
assert.equal(PEN_COLORS, TEXT_COLORS, 'pen and text expose the same colours');
assert.equal(SHAPE_COLORS, TEXT_COLORS, 'shapes will expose the same colours');
assert.ok(STICKY_COLORS.length >= 12, 'sticky notes ship with a full pastel range');

console.log('object checks passed: creation, measuring, contrast, hit testing, commands, empty objects, keyboard panning, undo/redo');
