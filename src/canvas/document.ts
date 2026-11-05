/**
 * Text and sticky-note canvas objects, plus the board document they live in.
 *
 * Objects are stored in canvas (document) coordinates and never in screen
 * coordinates, so panning and zooming cannot move or resize them. Every
 * mutation goes through `applyCommand`, which returns an unchanged document
 * when a command is a no-op: the undo history relies on that reference equality
 * to avoid empty undo steps.
 *
 * Not in this slice: shapes, connectors, images, persistence.
 */

import {
  applyChange,
  commitChange,
  createHistory,
  redo as redoHistory,
  undo as undoHistory,
  type History,
} from './history.ts';
import { eraseStrokesAt, type InkStroke } from './ink.ts';
import { canvasToScreen, type Point, type Viewport } from './viewport.ts';

// ---------------------------------------------------------------- palettes

export type TextColorKey = 'ink' | 'teal' | 'orange' | 'blue' | 'red' | 'amber';
export type StickyColorKey = 'butter' | 'blush' | 'mint' | 'sky' | 'lilac';

export type TextColorToken = {
  key: TextColorKey;
  name: string;
  /** Colour used in the light theme (the canvas is near-white). */
  light: string;
  /** Colour used in the dark theme (the canvas is near-black). */
  dark: string;
};

/**
 * Text palette. Each light/dark pair clears WCAG AA (4.5:1) against its own
 * canvas background; `scripts/verify-objects.mts` asserts it so a future colour
 * change cannot silently make text unreadable.
 */
export const TEXT_COLORS: readonly TextColorToken[] = [
  { key: 'ink', name: 'Ink', light: '#134E4A', dark: '#E6F4F1' },
  { key: 'teal', name: 'Teal', light: '#0F766E', dark: '#2DD4BF' },
  { key: 'orange', name: 'Orange', light: '#C2410C', dark: '#FB923C' },
  { key: 'blue', name: 'Blue', light: '#1D4ED8', dark: '#60A5FA' },
  { key: 'red', name: 'Red', light: '#B91C1C', dark: '#F87171' },
  { key: 'amber', name: 'Amber', light: '#B45309', dark: '#FBBF24' },
] as const;

export type StickyColorToken = {
  key: StickyColorKey;
  name: string;
  /** Note paper colour; identical in both themes because the note is a surface. */
  fill: string;
};

/** Soft pastels from `design/tokens.md`. */
export const STICKY_COLORS: readonly StickyColorToken[] = [
  { key: 'butter', name: 'Butter', fill: '#FDE68A' },
  { key: 'blush', name: 'Blush', fill: '#FECDD3' },
  { key: 'mint', name: 'Mint', fill: '#BBF7D0' },
  { key: 'sky', name: 'Sky', fill: '#BAE6FD' },
  { key: 'lilac', name: 'Lilac', fill: '#DDD6FE' },
] as const;

/** Every pastel carries the same deep teal ink, which keeps 6.7:1 or better. */
export const STICKY_TEXT_COLOR = '#134E4A';

// ------------------------------------------------------------ object model

export type ObjectStylePatch = {
  colorKey?: string;
  fontSize?: number;
};

type CanvasObjectBase = {
  id: string;
  /** Canvas-space position of the top-left corner. */
  x: number;
  y: number;
  /** Canvas-space size; text objects grow downwards as the text wraps. */
  width: number;
  height: number;
  /** Reserved for the selection/transform slice; always 0 today. */
  rotation: number;
  text: string;
  fontSize: number;
};

export type TextObject = CanvasObjectBase & { type: 'text'; colorKey: TextColorKey };
export type StickyObject = CanvasObjectBase & { type: 'sticky'; colorKey: StickyColorKey };
export type CanvasObject = TextObject | StickyObject;
export type CanvasObjectType = CanvasObject['type'];

export const TEXT_WIDTH = 160;
export const STICKY_WIDTH = 112;
export const STICKY_HEIGHT = 112;
export const OBJECT_PADDING = 8;

export const TEXT_FONT_SIZES = [14, 18, 24] as const;
export const STICKY_FONT_SIZES = [12, 16, 20] as const;
export const DEFAULT_TEXT_FONT_SIZE = 18;
export const DEFAULT_STICKY_FONT_SIZE = 16;
export const DEFAULT_TEXT_COLOR: TextColorKey = 'ink';
export const DEFAULT_STICKY_COLOR: StickyColorKey = 'butter';

/** Size chips read S/M/L instead of raw points. */
export const SIZE_LABELS = ['S', 'M', 'L'] as const;

/** Average glyph width of the platform UI font as a fraction of the font size. */
export const AVG_GLYPH_WIDTH_RATIO = 0.55;

/** Line height used by both the canvas renderer and the in-place editor. */
export function textLineHeight(fontSize: number): number {
  'worklet';
  return Math.round(fontSize * 1.35);
}

/**
 * Estimate the rendered block of text in canvas units. Exact glyph metrics are
 * not available without measuring a rendered view, and the value is only used
 * for the object's hit box and selection frame.
 */
export function measureTextBlock(
  text: string,
  fontSize: number,
  width: number,
): { lines: number; height: number } {
  'worklet';
  const usable = Math.max(fontSize, width - OBJECT_PADDING * 2);
  const perLine = Math.max(1, Math.floor(usable / (fontSize * AVG_GLYPH_WIDTH_RATIO)));
  const lines = text.length === 0
    ? 1
    : text.split('\n').reduce((total, line) => total + Math.max(1, Math.ceil(line.length / perLine)), 0);
  return { lines, height: lines * textLineHeight(fontSize) + OBJECT_PADDING * 2 };
}

export type CreateObjectInput = {
  id: string;
  /** Tap point in canvas space; the object is centred on it. */
  point: Point;
  colorKey?: string;
  fontSize?: number;
};

export function createTextObject({
  id,
  point,
  colorKey = DEFAULT_TEXT_COLOR,
  fontSize = DEFAULT_TEXT_FONT_SIZE,
}: CreateObjectInput): TextObject {
  const { height } = measureTextBlock('', fontSize, TEXT_WIDTH);
  return {
    id,
    type: 'text',
    text: '',
    x: Math.round(point.x - TEXT_WIDTH / 2),
    y: Math.round(point.y - height / 2),
    width: TEXT_WIDTH,
    height,
    rotation: 0,
    colorKey: colorKey as TextColorKey,
    fontSize,
  };
}

export function createStickyObject({
  id,
  point,
  colorKey = DEFAULT_STICKY_COLOR,
  fontSize = DEFAULT_STICKY_FONT_SIZE,
}: CreateObjectInput): StickyObject {
  return {
    id,
    type: 'sticky',
    text: '',
    x: Math.round(point.x - STICKY_WIDTH / 2),
    y: Math.round(point.y - STICKY_HEIGHT / 2),
    width: STICKY_WIDTH,
    height: STICKY_HEIGHT,
    rotation: 0,
    colorKey: colorKey as StickyColorKey,
    fontSize,
  };
}

/**
 * Apply new text. Text objects grow and shrink with their content; a sticky
 * note keeps its standard paper size and clips nothing but its own box.
 */
export function withObjectText(object: CanvasObject, text: string): CanvasObject {
  if (object.text === text) return object;
  if (object.type === 'sticky') return { ...object, text };
  return {
    ...object,
    text,
    height: measureTextBlock(text, object.fontSize, object.width).height,
  };
}

/** Apply colour and/or text size, keeping the hit box in step with the text. */
export function withObjectStyle(object: CanvasObject, patch: ObjectStylePatch): CanvasObject {
  const colorKey = patch.colorKey ?? object.colorKey;
  const fontSize = patch.fontSize ?? object.fontSize;
  if (colorKey === object.colorKey && fontSize === object.fontSize) return object;
  if (object.type === 'text') {
    return {
      ...object,
      colorKey: colorKey as TextColorKey,
      fontSize,
      height: measureTextBlock(object.text, fontSize, object.width).height,
    };
  }
  return { ...object, colorKey: colorKey as StickyColorKey, fontSize };
}

// --------------------------------------------------------------- rendering

/** Note paper colour, or undefined for a transparent text object. */
export function objectFill(object: CanvasObject): string | undefined {
  if (object.type !== 'sticky') return undefined;
  return STICKY_COLORS.find((entry) => entry.key === object.colorKey)?.fill ?? STICKY_COLORS[0].fill;
}

/** Text colour resolved for the current theme. */
export function objectTextColor(object: CanvasObject, dark: boolean): string {
  if (object.type === 'sticky') return STICKY_TEXT_COLOR;
  const token = TEXT_COLORS.find((entry) => entry.key === object.colorKey) ?? TEXT_COLORS[0];
  return dark ? token.dark : token.light;
}

/** Same lookup as `objectTextColor`, for palettes shown in the options sheet. */
export function textColorValue(key: string, dark: boolean): string {
  const token = TEXT_COLORS.find((entry) => entry.key === key) ?? TEXT_COLORS[0];
  return dark ? token.dark : token.light;
}

export function stickyColorValue(key: string): string {
  return STICKY_COLORS.find((entry) => entry.key === key)?.fill ?? STICKY_COLORS[0].fill;
}

// ------------------------------------------------------------- hit testing

export type ScreenRect = { x: number; y: number; width: number; height: number };

/** True when a canvas-space point is inside the object's box. */
export function objectContainsPoint(object: CanvasObject, point: Point): boolean {
  'worklet';
  return (
    point.x >= object.x &&
    point.x <= object.x + object.width &&
    point.y >= object.y &&
    point.y <= object.y + object.height
  );
}

/** Topmost object under a canvas-space point, or null. */
export function objectAtPoint(objects: readonly CanvasObject[], point: Point): CanvasObject | null {
  'worklet';
  for (let index = objects.length - 1; index >= 0; index -= 1) {
    if (objectContainsPoint(objects[index], point)) return objects[index];
  }
  return null;
}

/** The object's box in screen coordinates for the given viewport. */
export function objectScreenRect(object: CanvasObject, viewport: Viewport): ScreenRect {
  'worklet';
  const origin = canvasToScreen({ x: object.x, y: object.y }, viewport);
  return {
    x: origin.x,
    y: origin.y,
    width: object.width * viewport.scale,
    height: object.height * viewport.scale,
  };
}

// ------------------------------------------------------- keyboard handling

export const EDIT_MARGIN = 16;

export type KeepVisibleInput = {
  /** Object box in window coordinates. */
  object: ScreenRect;
  /** Canvas view box in window coordinates. */
  canvas: ScreenRect;
  viewport: Viewport;
  /** Window height covered at the bottom (keyboard plus the editing toolbar). */
  bottomInset: number;
  margin?: number;
};

/**
 * Translate the viewport just enough to keep an editing object inside the part
 * of the canvas the keyboard does not cover. The object keeps its canvas
 * position: only the viewport moves, so nothing on the board changes.
 */
export function keepObjectAboveKeyboard({
  object,
  canvas,
  viewport,
  bottomInset,
  margin = EDIT_MARGIN,
}: KeepVisibleInput): Viewport {
  const top = canvas.y + margin;
  const bottom = Math.max(top + 1, canvas.y + canvas.height - Math.max(0, bottomInset) - margin);
  const left = canvas.x + margin;
  const right = Math.max(left + 1, canvas.x + canvas.width - margin);

  let dx = 0;
  if (object.x < left) dx = left - object.x;
  else if (object.x + object.width > right) dx = right - (object.x + object.width);

  let dy = 0;
  if (object.height > bottom - top) {
    // Taller than the free band: keep the bottom edge (where the caret sits) visible.
    dy = bottom - (object.y + object.height);
  } else {
    if (object.y + object.height > bottom) dy = bottom - (object.y + object.height);
    if (object.y + dy < top) dy = top - object.y;
  }

  if (dx === 0 && dy === 0) return viewport;
  return { x: viewport.x + dx, y: viewport.y + dy, scale: viewport.scale };
}

/** Keyboard height relative to a canvas that may not reach the window bottom. */
export function keyboardOverlap(
  keyboardHeight: number,
  canvas: ScreenRect,
  windowHeight: number,
): number {
  const belowCanvas = Math.max(0, windowHeight - (canvas.y + canvas.height));
  return Math.max(0, keyboardHeight - belowCanvas);
}

// ----------------------------------------------------------------- document

export type CanvasDocument = {
  strokes: InkStroke[];
  objects: CanvasObject[];
};

export const EMPTY_DOCUMENT: CanvasDocument = { strokes: [], objects: [] };

export function documentHasContent(document: CanvasDocument): boolean {
  return document.strokes.length > 0 || document.objects.length > 0;
}

export function findObject(document: CanvasDocument, id: string): CanvasObject | null {
  return document.objects.find((object) => object.id === id) ?? null;
}

export type DocumentCommand =
  | { type: 'ink.add'; stroke: InkStroke }
  | { type: 'ink.erase'; point: Point; radius: number }
  | { type: 'object.insert'; object: CanvasObject }
  | { type: 'object.update'; id: string; text?: string; colorKey?: string; fontSize?: number }
  | { type: 'object.move'; id: string; x: number; y: number }
  | { type: 'object.delete'; id: string };

function mapObject(
  document: CanvasDocument,
  id: string,
  update: (object: CanvasObject) => CanvasObject,
): CanvasDocument {
  const index = document.objects.findIndex((object) => object.id === id);
  if (index === -1) return document;
  const next = update(document.objects[index]);
  if (next === document.objects[index]) return document;
  const objects = [...document.objects];
  objects[index] = next;
  return { ...document, objects };
}

/** Apply one command to a document, returning the same document when nothing changed. */
export function applyCommand(document: CanvasDocument, command: DocumentCommand): CanvasDocument {
  switch (command.type) {
    case 'ink.add':
      return { ...document, strokes: [...document.strokes, command.stroke] };
    case 'ink.erase': {
      const result = eraseStrokesAt(document.strokes, command.point, command.radius);
      return result.erasedIds.length === 0 ? document : { ...document, strokes: result.strokes };
    }
    case 'object.insert':
      return { ...document, objects: [...document.objects, command.object] };
    case 'object.update':
      return mapObject(document, command.id, (object) => {
        let next = object;
        if (command.text !== undefined) next = withObjectText(next, command.text);
        return withObjectStyle(next, { colorKey: command.colorKey, fontSize: command.fontSize });
      });
    case 'object.move':
      return mapObject(document, command.id, (object) =>
        object.x === command.x && object.y === command.y
          ? object
          : { ...object, x: command.x, y: command.y },
      );
    case 'object.delete': {
      const objects = document.objects.filter((object) => object.id !== command.id);
      return objects.length === document.objects.length ? document : { ...document, objects };
    }
    default:
      return document;
  }
}

export type DocumentAction =
  | { type: 'command'; command: DocumentCommand; transient?: boolean }
  | { type: 'commit' }
  | { type: 'undo' }
  | { type: 'redo' };

export type DocumentHistory = History<CanvasDocument>;

/**
 * What committing an in-place edit should do. Empty text never becomes a board
 * object: a brand new empty object is dropped silently, and an existing object
 * whose text was cleared is deleted (undo brings it back).
 */
export function editingCommit(object: CanvasObject, isNew: boolean): DocumentCommand | null {
  const text = object.text.trim();
  if (text.length === 0) {
    return isNew ? null : { type: 'object.delete', id: object.id };
  }
  if (isNew) return { type: 'object.insert', object: { ...object, text } };
  return {
    type: 'object.update',
    id: object.id,
    text,
    colorKey: object.colorKey,
    fontSize: object.fontSize,
  };
}

/**
 * One reducer owns ink and objects so undo/redo is chronological across both:
 * a note created between two strokes undoes in the same order the user made it.
 */
export function documentReducer(state: DocumentHistory, action: DocumentAction): DocumentHistory {
  switch (action.type) {
    case 'command':
      return applyChange(state, applyCommand(state.present, action.command), action.transient ?? false);
    case 'commit':
      return commitChange(state);
    case 'undo':
      return undoHistory(state);
    case 'redo':
      return redoHistory(state);
    default:
      return state;
  }
}

export function createDocumentHistory(document: CanvasDocument = EMPTY_DOCUMENT): DocumentHistory {
  return createHistory(document);
}
