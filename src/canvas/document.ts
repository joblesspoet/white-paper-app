/**
 * Canvas objects and the board document they live in.
 *
 * Text, sticky notes, shapes, and connectors are stored in canvas (document)
 * coordinates and never in screen coordinates, so panning and zooming cannot
 * move or resize them. Every mutation goes through `applyCommand`, which returns
 * an unchanged document when a command is a no-op: the undo history relies on
 * that reference equality to avoid empty undo steps.
 *
 * Not in this slice: images, persistence, grouping, or cloud sync.
 */

import { isHexColor, readableTextColor } from './colors.ts';
import {
  batchCommand,
  commitChange,
  createHistory,
  executeCommand,
  redo as redoHistory,
  undo as undoHistory,
  type History,
  type HistoryCommand,
} from './history.ts';
import { eraseStrokesAt, type InkStroke } from './ink.ts';
import {
  DEFAULT_CONNECTOR_STROKE_WIDTH,
  DEFAULT_SHAPE_STROKE_WIDTH,
  connectorPolyline,
  distanceToPolyline,
  geometryFromPoints,
  linePoints,
  strokeHitTolerance,
  type ConnectorStyle,
  type LineDirection,
  type ShapeGeometry,
  type ShapeKind,
} from './shapes.ts';
import { canvasToScreen, type Point, type Viewport } from './viewport.ts';

export {
  CONNECTOR_STROKE_WIDTHS,
  DEFAULT_CONNECTOR_STROKE_WIDTH,
  DEFAULT_SHAPE_STROKE_WIDTH,
  MIN_SHAPE_SIZE_SCREEN,
  SHAPE_STROKE_WIDTHS,
  STROKE_WIDTH_LABELS,
  arrowHeadSize,
  connectorPolyline,
  geometryFromPoints,
  linePoints,
  polylinePathData,
  arrowHeadPathData,
  distanceToPolyline,
  type ConnectorStyle,
  type LineDirection,
  type ShapeKind,
} from './shapes.ts';

// ---------------------------------------------------------------- palettes

export type TextColorKey =
  | 'ink'
  | 'slate'
  | 'teal'
  | 'cyan'
  | 'blue'
  | 'indigo'
  | 'violet'
  | 'purple'
  | 'pink'
  | 'rose'
  | 'red'
  | 'orange'
  | 'amber'
  | 'lime'
  | 'green'
  | 'brown';

export type StickyColorKey =
  | 'butter'
  | 'lemon'
  | 'peach'
  | 'coral'
  | 'blush'
  | 'rose'
  | 'lilac'
  | 'lavender'
  | 'periwinkle'
  | 'sky'
  | 'aqua'
  | 'mint'
  | 'lime'
  | 'sand'
  | 'stone';

export type TextColorToken = {
  key: TextColorKey;
  name: string;
  /** Colour used in the light theme (the canvas is near-white). */
  light: string;
  /** Colour used in the dark theme (the canvas is near-black). */
  dark: string;
};

/**
 * Shared canvas palette. Pen, text, and shapes all draw from this list; each
 * light/dark pair clears WCAG AA (4.5:1) against its own canvas background.
 * `scripts/verify-objects.mts` asserts every pair so a future colour change
 * cannot silently make text unreadable.
 */
export const CANVAS_COLORS: readonly TextColorToken[] = [
  { key: 'ink', name: 'Ink', light: '#134E4A', dark: '#E6F4F1' },
  { key: 'slate', name: 'Slate', light: '#334155', dark: '#94A3B8' },
  { key: 'teal', name: 'Teal', light: '#0F766E', dark: '#2DD4BF' },
  { key: 'cyan', name: 'Cyan', light: '#0E7490', dark: '#22D3EE' },
  { key: 'blue', name: 'Blue', light: '#1D4ED8', dark: '#60A5FA' },
  { key: 'indigo', name: 'Indigo', light: '#4338CA', dark: '#818CF8' },
  { key: 'violet', name: 'Violet', light: '#6D28D9', dark: '#A78BFA' },
  { key: 'purple', name: 'Purple', light: '#7E22CE', dark: '#C084FC' },
  { key: 'pink', name: 'Pink', light: '#BE185D', dark: '#F472B6' },
  { key: 'rose', name: 'Rose', light: '#BE123C', dark: '#FB7185' },
  { key: 'red', name: 'Red', light: '#B91C1C', dark: '#F87171' },
  { key: 'orange', name: 'Orange', light: '#C2410C', dark: '#FB923C' },
  { key: 'amber', name: 'Amber', light: '#B45309', dark: '#FBBF24' },
  { key: 'lime', name: 'Lime', light: '#4D7C0F', dark: '#A3E635' },
  { key: 'green', name: 'Green', light: '#15803D', dark: '#4ADE80' },
  { key: 'brown', name: 'Brown', light: '#92400E', dark: '#E0A96D' },
] as const;

/** Text, pen, and shape tools all expose the same complete palette. */
export const TEXT_COLORS = CANVAS_COLORS;
export const PEN_COLORS = CANVAS_COLORS;
export const SHAPE_COLORS = CANVAS_COLORS;

export type StickyColorToken = {
  key: StickyColorKey;
  name: string;
  /** Note paper colour; identical in both themes because the note is a surface. */
  fill: string;
};

/** Soft pastels from `design/tokens.md`, extended so notes share the full hue range. */
export const STICKY_COLORS: readonly StickyColorToken[] = [
  { key: 'butter', name: 'Butter', fill: '#FDE68A' },
  { key: 'lemon', name: 'Lemon', fill: '#FEF08A' },
  { key: 'peach', name: 'Peach', fill: '#FED7AA' },
  { key: 'coral', name: 'Coral', fill: '#FDA4AF' },
  { key: 'blush', name: 'Blush', fill: '#FECDD3' },
  { key: 'rose', name: 'Rose', fill: '#FBCFE8' },
  { key: 'lilac', name: 'Lilac', fill: '#DDD6FE' },
  { key: 'lavender', name: 'Lavender', fill: '#E9D5FF' },
  { key: 'periwinkle', name: 'Periwinkle', fill: '#C7D2FE' },
  { key: 'sky', name: 'Sky', fill: '#BAE6FD' },
  { key: 'aqua', name: 'Aqua', fill: '#CCFBF1' },
  { key: 'mint', name: 'Mint', fill: '#BBF7D0' },
  { key: 'lime', name: 'Lime', fill: '#D9F99D' },
  { key: 'sand', name: 'Sand', fill: '#F5E6D3' },
  { key: 'stone', name: 'Stone', fill: '#E2E8F0' },
] as const;

/** Every pastel carries the same deep teal ink, which keeps 6.7:1 or better. */
export const STICKY_TEXT_COLOR = '#134E4A';

/**
 * Shape fills reuse the sticky-note pastels: they are quiet enough to sit behind
 * ink and text, and they are independent of the light/dark canvas theme.
 * `null` means an unfilled outline.
 */
export const SHAPE_FILLS = STICKY_COLORS;
export const DEFAULT_SHAPE_FILL: string | null = null;
export const DEFAULT_SHAPE_COLOR: TextColorKey = 'ink';
export const DEFAULT_CONNECTOR_COLOR: TextColorKey = 'ink';
export const DEFAULT_SHAPE_KIND: ShapeKind = 'rectangle';
export const DEFAULT_CONNECTOR_STYLE: ConnectorStyle = 'arrow';

// ------------------------------------------------------------ object model

export type TextWeight = 'normal' | 'bold';
export type TextSlant = 'normal' | 'italic';

export type ObjectStylePatch = {
  colorKey?: string;
  fontSize?: number;
  fontWeight?: TextWeight;
  fontStyle?: TextSlant;
  fillKey?: string | null;
  strokeWidth?: number;
  /** Change a shape's geometry kind (rectangle, ellipse, line). */
  shape?: ShapeKind;
  /** Change a connector's routing style (line, arrow, elbow). */
  style?: ConnectorStyle;
};

type CanvasObjectBase = {
  id: string;
  /** Canvas-space position of the top-left corner. */
  x: number;
  y: number;
  /** Canvas-space size; text objects grow downwards as the text wraps. */
  width: number;
  height: number;
  /** Clockwise rotation in degrees around the object's centre. */
  rotation: number;
  /** Present only on textual objects; optional here for backwards-compatible inspection. */
  text?: string;
  /** Present only on textual objects; optional here for backwards-compatible inspection. */
  fontSize?: number;
};

export type TextObject = CanvasObjectBase & {
  type: 'text';
  text: string;
  fontSize: number;
  colorKey: string;
  fontWeight?: TextWeight;
  fontStyle?: TextSlant;
};
export type StickyObject = CanvasObjectBase & {
  type: 'sticky';
  text: string;
  fontSize: number;
  colorKey: string;
  fontWeight?: TextWeight;
  fontStyle?: TextSlant;
};
export type ShapeObject = CanvasObjectBase &
  ShapeGeometry & {
    type: 'shape';
    shape: ShapeKind;
    /** Border colour, stored as a palette key or custom `#rrggbb`. */
    colorKey: string;
    /** Fill colour, or `null` for an outline-only shape. */
    fillKey: string | null;
    strokeWidth: number;
  };
export type ConnectorObject = CanvasObjectBase &
  ShapeGeometry & {
    type: 'connector';
    style: ConnectorStyle;
    /** Line and arrow colour, stored as a palette key or custom `#rrggbb`. */
    colorKey: string;
    strokeWidth: number;
  };
export type CanvasObject = TextObject | StickyObject | ShapeObject | ConnectorObject;
export type CanvasObjectType = CanvasObject['type'];
export type TextualObject = TextObject | StickyObject;
export type GeometricObject = ShapeObject | ConnectorObject;

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
  fontWeight: TextWeight = 'normal',
  fontStyle: TextSlant = 'normal',
): { lines: number; height: number } {
  'worklet';
  const usable = Math.max(fontSize, width - OBJECT_PADDING * 2);
  // Bold glyphs are wider; italic is close enough to keep the same ratio.
  const glyphRatio = AVG_GLYPH_WIDTH_RATIO * (fontWeight === 'bold' ? 1.08 : 1) * (fontStyle === 'italic' ? 1.02 : 1);
  const perLine = Math.max(1, Math.floor(usable / (fontSize * glyphRatio)));
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
  fontWeight?: TextWeight;
  fontStyle?: TextSlant;
};

export function createTextObject({
  id,
  point,
  colorKey = DEFAULT_TEXT_COLOR,
  fontSize = DEFAULT_TEXT_FONT_SIZE,
  fontWeight = 'normal',
  fontStyle = 'normal',
}: CreateObjectInput): TextObject {
  const { height } = measureTextBlock('', fontSize, TEXT_WIDTH, fontWeight, fontStyle);
  return {
    id,
    type: 'text',
    text: '',
    x: Math.round(point.x - TEXT_WIDTH / 2),
    y: Math.round(point.y - height / 2),
    width: TEXT_WIDTH,
    height,
    rotation: 0,
    colorKey,
    fontSize,
    fontWeight,
    fontStyle,
  };
}

export function createStickyObject({
  id,
  point,
  colorKey = DEFAULT_STICKY_COLOR,
  fontSize = DEFAULT_STICKY_FONT_SIZE,
  fontWeight = 'normal',
  fontStyle = 'normal',
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
    colorKey,
    fontSize,
    fontWeight,
    fontStyle,
  };
}

export type CreateShapeInput = {
  id: string;
  shape: ShapeKind;
  /** Canvas-space point where the drag began. */
  start: Point;
  /** Canvas-space point where the drag currently ends. */
  end: Point;
  colorKey?: string;
  fillKey?: string | null;
  strokeWidth?: number;
};

export function createShapeObject({
  id,
  shape,
  start,
  end,
  colorKey = DEFAULT_SHAPE_COLOR,
  fillKey = DEFAULT_SHAPE_FILL,
  strokeWidth = DEFAULT_SHAPE_STROKE_WIDTH,
}: CreateShapeInput): ShapeObject {
  const geometry = geometryFromPoints(start, end);
  return {
    id,
    type: 'shape',
    shape,
    ...geometry,
    rotation: 0,
    colorKey,
    // A line has no interior, so it never stores a fill.
    fillKey: shape === 'line' ? null : fillKey,
    strokeWidth,
  };
}

export type CreateConnectorInput = {
  id: string;
  style?: ConnectorStyle;
  start: Point;
  end: Point;
  colorKey?: string;
  strokeWidth?: number;
};

export function createConnectorObject({
  id,
  style = DEFAULT_CONNECTOR_STYLE,
  start,
  end,
  colorKey = DEFAULT_CONNECTOR_COLOR,
  strokeWidth = DEFAULT_CONNECTOR_STROKE_WIDTH,
}: CreateConnectorInput): ConnectorObject {
  return {
    id,
    type: 'connector',
    style,
    ...geometryFromPoints(start, end),
    rotation: 0,
    colorKey,
    strokeWidth,
  };
}

/** Text and sticky notes are the only objects with an in-place text editor. */
export function isTextualObject(object: CanvasObject): object is TextualObject {
  'worklet';
  return object.type === 'text' || object.type === 'sticky';
}

/** Shapes and connectors are rendered by Skia rather than as native views. */
export function isGeometricObject(object: CanvasObject): object is GeometricObject {
  'worklet';
  return object.type === 'shape' || object.type === 'connector';
}

/**
 * Apply new text. Text objects grow and shrink with their content; a sticky
 * note keeps its standard paper size and clips nothing but its own box.
 */
export function withObjectText(object: CanvasObject, text: string): CanvasObject {
  if (!isTextualObject(object) || object.text === text) return object;
  if (object.type === 'sticky') return { ...object, text };
  return {
    ...object,
    text,
    height: measureTextBlock(text, object.fontSize, object.width, object.fontWeight, object.fontStyle).height,
  };
}

/** Apply colour, size, weight, and slant, keeping the text hit box in step. */
export function withObjectStyle(object: CanvasObject, patch: ObjectStylePatch): CanvasObject {
  const colorKey = patch.colorKey ?? object.colorKey;
  if (object.type === 'text') {
    const fontSize = patch.fontSize ?? object.fontSize;
    const fontWeight = patch.fontWeight ?? object.fontWeight ?? 'normal';
    const fontStyle = patch.fontStyle ?? object.fontStyle ?? 'normal';
    if (
      colorKey === object.colorKey &&
      fontSize === object.fontSize &&
      fontWeight === (object.fontWeight ?? 'normal') &&
      fontStyle === (object.fontStyle ?? 'normal')
    ) {
      return object;
    }
    return {
      ...object,
      colorKey,
      fontSize,
      fontWeight,
      fontStyle,
      height: measureTextBlock(object.text, fontSize, object.width, fontWeight, fontStyle).height,
    };
  }
  if (object.type === 'sticky') {
    const fontSize = patch.fontSize ?? object.fontSize;
    const fontWeight = patch.fontWeight ?? object.fontWeight ?? 'normal';
    const fontStyle = patch.fontStyle ?? object.fontStyle ?? 'normal';
    if (
      colorKey === object.colorKey &&
      fontSize === object.fontSize &&
      fontWeight === (object.fontWeight ?? 'normal') &&
      fontStyle === (object.fontStyle ?? 'normal')
    ) {
      return object;
    }
    return { ...object, colorKey, fontSize, fontWeight, fontStyle };
  }
  if (object.type === 'shape') {
    const shape = patch.shape ?? object.shape;
    const fillKey = patch.fillKey !== undefined ? patch.fillKey : object.fillKey;
    const strokeWidth = patch.strokeWidth ?? object.strokeWidth;
    if (
      colorKey === object.colorKey &&
      shape === object.shape &&
      fillKey === object.fillKey &&
      strokeWidth === object.strokeWidth
    ) {
      return object;
    }
    return { ...object, shape, colorKey, fillKey: shape === 'line' ? null : fillKey, strokeWidth };
  }
  const style = patch.style ?? object.style;
  const strokeWidth = patch.strokeWidth ?? object.strokeWidth;
  if (colorKey === object.colorKey && style === object.style && strokeWidth === object.strokeWidth) return object;
  return { ...object, style, colorKey, strokeWidth };
}

export type ObjectGeometryPatch = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  /** Clockwise degrees around the object's centre. */
  rotation?: number;
  /** Line/connector direction, preserved when a resize flips an axis. */
  direction?: LineDirection;
};

/**
 * Apply a geometry change. A text object re-wraps when its width changes and
 * keeps the measured height otherwise, so moving text never undoes a layout
 * correction. Sticky, shape, and connector boxes take the provided size.
 */
export function withObjectGeometry(object: CanvasObject, patch: ObjectGeometryPatch): CanvasObject {
  const width = Math.max(1, patch.width ?? object.width);
  const widthChanged = width !== object.width;
  const height = Math.max(
    1,
    object.type === 'text' && widthChanged
      ? measureTextBlock(object.text, object.fontSize, width, object.fontWeight, object.fontStyle).height
      : patch.height ?? object.height,
  );
  const x = patch.x ?? object.x;
  const y = patch.y ?? object.y;
  const rotation = patch.rotation ?? object.rotation;
  const direction =
    object.type === 'shape' || object.type === 'connector'
      ? patch.direction ?? object.direction
      : undefined;
  if (
    x === object.x &&
    y === object.y &&
    width === object.width &&
    height === object.height &&
    rotation === object.rotation &&
    direction === (object.type === 'shape' || object.type === 'connector' ? object.direction : undefined)
  ) {
    return object;
  }
  if (object.type === 'shape' || object.type === 'connector') {
    return { ...object, x, y, width, height, rotation, direction: direction ?? object.direction };
  }
  return { ...object, x, y, width, height, rotation };
}

/** Canvas-space offset applied to a duplicated object. */
export const DUPLICATE_OFFSET = 16;

/**
 * Copy an object at a fresh id, offset slightly so the duplicate is visible
 * above the original and can be dragged away immediately.
 */
export function duplicateObject(
  object: CanvasObject,
  id: string,
  offset = DUPLICATE_OFFSET,
): CanvasObject {
  return { ...object, id, x: object.x + offset, y: object.y + offset };
}

// --------------------------------------------------------------- rendering

/** Shape fill colour, or undefined for an outline-only shape. */
export function objectFill(object: CanvasObject): string | undefined {
  if (object.type === 'sticky') return stickyColorValue(object.colorKey);
  if (object.type === 'shape' && object.fillKey) return stickyColorValue(object.fillKey);
  return undefined;
}

/** Text or shape-stroke colour, resolved against the current theme. */
export function objectTextColor(object: CanvasObject, dark: boolean): string {
  if (object.type === 'sticky') {
    if (isHexColor(object.colorKey)) {
      return readableTextColor(object.colorKey, [STICKY_TEXT_COLOR, '#FFFFFF']);
    }
    return STICKY_TEXT_COLOR;
  }
  return textColorValue(object.colorKey, dark);
}

/** Resolve a stored palette key or custom `#rrggbb` value for the current theme. */
export function textColorValue(key: string, dark: boolean): string {
  if (isHexColor(key)) return key;
  const token = TEXT_COLORS.find((entry) => entry.key === key) ?? TEXT_COLORS[0];
  return dark ? token.dark : token.light;
}

/** True when an object or swatch holds a custom colour instead of a palette key. */
export function isCustomColor(key: string): boolean {
  return isHexColor(key);
}

/** Find the palette key behind a stored colour, so theme changes can remap it. */
export function textColorKeyForValue(value: string): string | null {
  const token = TEXT_COLORS.find((entry) => entry.light === value || entry.dark === value);
  return token?.key ?? null;
}

export function stickyColorValue(key: string): string {
  if (isHexColor(key)) return key;
  return STICKY_COLORS.find((entry) => entry.key === key)?.fill ?? STICKY_COLORS[0].fill;
}

// ------------------------------------------------------------- hit testing

export type ScreenRect = { x: number; y: number; width: number; height: number };

/** Rotate a canvas-space point around a canvas-space centre by degrees. */
export function rotatePoint(point: Point, centre: Point, degrees: number): Point {
  'worklet';
  if (degrees === 0) return point;
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = point.x - centre.x;
  const dy = point.y - centre.y;
  return {
    x: centre.x + dx * cos - dy * sin,
    y: centre.y + dx * sin + dy * cos,
  };
}

/** True when a canvas-space point is inside an object's rendered area. */
export function objectContainsPoint(object: CanvasObject, point: Point): boolean {
  'worklet';
  // Hit testing happens in the object's unrotated frame, so a rotated object
  // behaves exactly like its rendered version at every zoom level.
  const local = object.rotation === 0
    ? point
    : rotatePoint(
        point,
        { x: object.x + object.width / 2, y: object.y + object.height / 2 },
        -object.rotation,
      );
  if (object.type === 'shape') {
    if (object.shape === 'ellipse') {
      const radiusX = object.width / 2;
      const radiusY = object.height / 2;
      if (radiusX <= 0 || radiusY <= 0) return false;
      const dx = (local.x - (object.x + radiusX)) / radiusX;
      const dy = (local.y - (object.y + radiusY)) / radiusY;
      return dx * dx + dy * dy <= 1;
    }
    if (object.shape === 'line') {
      const { start, end } = linePoints(
        object.x,
        object.y,
        object.width,
        object.height,
        object.direction,
      );
      return distanceToPolyline(local, [start, end]) <= strokeHitTolerance(object.strokeWidth);
    }
  }
  if (object.type === 'connector') {
    const points = connectorPolyline(
      object.style,
      object.x,
      object.y,
      object.width,
      object.height,
      object.direction,
    );
    return distanceToPolyline(local, points) <= strokeHitTolerance(object.strokeWidth);
  }
  return (
    local.x >= object.x &&
    local.x <= object.x + object.width &&
    local.y >= object.y &&
    local.y <= object.y + object.height
  );
}

/**
 * Topmost object under a canvas-space point, or null. Text and sticky notes are
 * native views layered above the Skia canvas, so they always win over shapes and
 * connectors even when a shape was inserted later.
 */
export function objectAtPoint(objects: readonly CanvasObject[], point: Point): CanvasObject | null {
  'worklet';
  for (let index = objects.length - 1; index >= 0; index -= 1) {
    const object = objects[index];
    if (isTextualObject(object) && objectContainsPoint(object, point)) return object;
  }
  for (let index = objects.length - 1; index >= 0; index -= 1) {
    const object = objects[index];
    if (!isTextualObject(object) && objectContainsPoint(object, point)) return object;
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
  | {
      type: 'object.update';
      id: string;
      text?: string;
      colorKey?: string;
      fontSize?: number;
      fontWeight?: TextWeight;
      fontStyle?: TextSlant;
      fillKey?: string | null;
      strokeWidth?: number;
      shape?: ShapeKind;
      style?: ConnectorStyle;
    }
  | { type: 'object.move'; id: string; x: number; y: number }
  | {
      type: 'objects.geometry';
      updates: ReadonlyArray<{ id: string } & ObjectGeometryPatch>;
      /** Accessibility/history verb, for example `Move` or `Rotate`. */
      label?: string;
    }
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
        return withObjectStyle(next, {
          colorKey: command.colorKey,
          fontSize: command.fontSize,
          fontWeight: command.fontWeight,
          fontStyle: command.fontStyle,
          fillKey: command.fillKey,
          strokeWidth: command.strokeWidth,
          shape: command.shape,
          style: command.style,
        });
      });
    case 'object.move':
      return mapObject(document, command.id, (object) =>
        object.x === command.x && object.y === command.y
          ? object
          : { ...object, x: command.x, y: command.y },
      );
    case 'objects.geometry': {
      const updates = new Map(command.updates.map((update) => [update.id, update]));
      let changed = false;
      const objects = document.objects.map((object) => {
        const update = updates.get(object.id);
        if (!update) return object;
        const next = withObjectGeometry(object, update);
        if (next !== object) changed = true;
        return next;
      });
      return changed ? { ...document, objects } : document;
    }
    case 'object.delete': {
      const objects = document.objects.filter((object) => object.id !== command.id);
      return objects.length === document.objects.length ? document : { ...document, objects };
    }
    default:
      return document;
  }
}

function objectEquals(left: CanvasObject, right: CanvasObject): boolean {
  if (left === right) return true;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every(
    (key) => (left as Record<string, unknown>)[key] === (right as Record<string, unknown>)[key],
  );
}

function strokeEquals(left: InkStroke, right: InkStroke): boolean {
  if (left === right) return true;
  if (
    left.id !== right.id ||
    left.tool !== right.tool ||
    left.color !== right.color ||
    left.width !== right.width ||
    left.opacity !== right.opacity ||
    left.createdAt !== right.createdAt ||
    left.points.length !== right.points.length
  ) {
    return false;
  }
  for (let index = 0; index < left.points.length; index += 1) {
    if (
      left.points[index].x !== right.points[index].x ||
      left.points[index].y !== right.points[index].y
    ) {
      return false;
    }
  }
  return true;
}

/** True when two documents would render identically. */
export function documentsEqual(left: CanvasDocument, right: CanvasDocument): boolean {
  if (left === right) return true;
  if (left.strokes.length !== right.strokes.length) return false;
  if (left.objects.length !== right.objects.length) return false;
  for (let index = 0; index < left.strokes.length; index += 1) {
    if (!strokeEquals(left.strokes[index], right.strokes[index])) return false;
  }
  for (let index = 0; index < left.objects.length; index += 1) {
    if (!objectEquals(left.objects[index], right.objects[index])) return false;
  }
  return true;
}

type MoveHistoryCommand = HistoryCommand<CanvasDocument> & {
  move: { id: string; from: Point; to: Point };
};

/** A move that can fold the next move of the same object into one drag step. */
function moveHistoryCommand(id: string, label: string, from: Point, to: Point): MoveHistoryCommand {
  return {
    type: 'update',
    label,
    apply(current) {
      let changed = false;
      const objects = current.objects.map((object) => {
        if (object.id !== id) return object;
        if (object.x === to.x && object.y === to.y) return object;
        changed = true;
        return { ...object, x: to.x, y: to.y };
      });
      return changed ? { ...current, objects } : current;
    },
    revert(current) {
      let changed = false;
      const objects = current.objects.map((object) => {
        if (object.id !== id) return object;
        if (object.x === from.x && object.y === from.y) return object;
        changed = true;
        return { ...object, x: from.x, y: from.y };
      });
      return changed ? { ...current, objects } : current;
    },
    move: { id, from, to },
    merge(next) {
      const other = next as MoveHistoryCommand;
      if (!other.move || other.move.id !== id) return undefined;
      return moveHistoryCommand(id, label, from, other.move.to);
    },
  };
}

type GeometryHistoryCommand = HistoryCommand<CanvasDocument> & {
  geometry: { verb: string; before: CanvasObject[]; after: CanvasObject[] };
};

function sameObjectIds(left: readonly CanvasObject[], right: readonly CanvasObject[]): boolean {
  if (left.length !== right.length) return false;
  const ids = new Set(left.map((object) => object.id));
  return right.every((object) => ids.has(object.id));
}

/**
 * Restore only the transform fields from a snapshot. Text, colour, and style
 * stay with the current object, and a move does not roll back a text height
 * corrected by layout measurement.
 */
type GeometryField = 'x' | 'y' | 'width' | 'height' | 'rotation' | 'direction';

function changedGeometryFields(before: CanvasObject, after: CanvasObject): GeometryField[] {
  const fields: GeometryField[] = [];
  if (before.x !== after.x) fields.push('x');
  if (before.y !== after.y) fields.push('y');
  if (before.width !== after.width) fields.push('width');
  if (before.height !== after.height) fields.push('height');
  if (before.rotation !== after.rotation) fields.push('rotation');
  if (
    (before.type === 'shape' || before.type === 'connector') &&
    (after.type === 'shape' || after.type === 'connector') &&
    before.direction !== after.direction
  ) {
    fields.push('direction');
  }
  return fields;
}

function withGeometryFields(
  object: CanvasObject,
  snapshot: CanvasObject,
  fields: readonly GeometryField[],
): CanvasObject {
  let next = object;
  for (const field of fields) {
    if (field === 'direction') {
      if (next.type !== 'shape' && next.type !== 'connector') continue;
      if (snapshot.type !== 'shape' && snapshot.type !== 'connector') continue;
      if (next.direction === snapshot.direction) continue;
      next = { ...next, direction: snapshot.direction };
      continue;
    }
    if (next[field] === snapshot[field]) continue;
    next = { ...next, [field]: snapshot[field] };
  }
  return next;
}

/**
 * One history entry for a whole selection transform. Every frame supplies the
 * latest absolute geometry, and consecutive frames merge into this single
 * command, so a resize, rotate, or multi-object drag is one undo step.
 */
function geometryHistoryCommand(
  verb: string,
  before: CanvasObject[],
  after: CanvasObject[],
): GeometryHistoryCommand {
  const label = before.length === 1
    ? `${verb} ${before[0].type}`
    : `${verb} ${before.length} objects`;
  const beforeById = new Map(before.map((object) => [object.id, object]));
  const afterById = new Map(after.map((object) => [object.id, object]));
  const fieldsById = new Map<string, GeometryField[]>();
  for (const original of before) {
    const next = afterById.get(original.id);
    if (!next) continue;
    const fields = changedGeometryFields(original, next);
    if (fields.length > 0) fieldsById.set(original.id, fields);
  }
  return {
    type: 'update',
    label,
    apply(current) {
      let changed = false;
      const objects = current.objects.map((object) => {
        const snapshot = afterById.get(object.id);
        const fields = fieldsById.get(object.id);
        if (!snapshot || !fields) return object;
        const next = withGeometryFields(object, snapshot, fields);
        if (next !== object) changed = true;
        return next;
      });
      return changed ? { ...current, objects } : current;
    },
    revert(current) {
      let changed = false;
      const objects = current.objects.map((object) => {
        const snapshot = beforeById.get(object.id);
        const fields = fieldsById.get(object.id);
        if (!snapshot || !fields) return object;
        const next = withGeometryFields(object, snapshot, fields);
        if (next !== object) changed = true;
        return next;
      });
      return changed ? { ...current, objects } : current;
    },
    geometry: { verb, before, after },
    merge(next) {
      const other = next as GeometryHistoryCommand;
      if (!other.geometry || other.geometry.verb !== verb) return undefined;
      if (!sameObjectIds(before, other.geometry.before)) return undefined;
      return geometryHistoryCommand(verb, before, other.geometry.after);
    },
  };
}

/**
 * Turn a document command into an undoable history command. The inverse data
 * (a removed stroke, the previous object fields, an original index) is captured
 * here, against the document the command is about to change.
 */
export function prepareDocumentCommand(
  document: CanvasDocument,
  command: DocumentCommand,
): HistoryCommand<CanvasDocument> | null {
  switch (command.type) {
    case 'ink.add': {
      const stroke = command.stroke;
      return {
        type: 'create',
        label: stroke.tool === 'highlighter' ? 'Add highlighter stroke' : 'Add stroke',
        apply: (current) => applyCommand(current, command),
        revert: (current) => {
          const strokes = current.strokes.filter((entry) => entry.id !== stroke.id);
          return strokes.length === current.strokes.length ? current : { ...current, strokes };
        },
      };
    }
    case 'ink.erase': {
      const result = eraseStrokesAt(document.strokes, command.point, command.radius);
      if (result.erasedIds.length === 0) return null;
      const erasedIds = new Set(result.erasedIds);
      const erased = result.erasedIds.map((id) => ({
        index: document.strokes.findIndex((stroke) => stroke.id === id),
        stroke: document.strokes.find((stroke) => stroke.id === id)!,
      }));
      return {
        type: 'delete',
        label: erased.length === 1 ? 'Erase stroke' : `Erase ${erased.length} strokes`,
        apply: (current) => {
          const strokes = current.strokes.filter((stroke) => !erasedIds.has(stroke.id));
          return strokes.length === current.strokes.length ? current : { ...current, strokes };
        },
        revert: (current) => {
          const strokes = [...current.strokes];
          for (const entry of [...erased].sort((left, right) => left.index - right.index)) {
            if (strokes.some((stroke) => stroke.id === entry.stroke.id)) continue;
            strokes.splice(Math.min(entry.index, strokes.length), 0, entry.stroke);
          }
          return { ...current, strokes };
        },
      };
    }
    case 'object.insert': {
      const object = command.object;
      return {
        type: 'create',
        label: `Add ${object.type}`,
        apply: (current) => applyCommand(current, command),
        revert: (current) => {
          const objects = current.objects.filter((entry) => entry.id !== object.id);
          return objects.length === current.objects.length ? current : { ...current, objects };
        },
      };
    }
    case 'object.update': {
      const before = findObject(document, command.id);
      if (!before) return null;
      if (applyCommand(document, command) === document) return null;
      return {
        type: 'update',
        label: `Edit ${before.type}`,
        apply: (current) => applyCommand(current, command),
        revert: (current) => ({
          ...current,
          objects: current.objects.map((object) => (object.id === before.id ? before : object)),
        }),
      };
    }
    case 'object.move': {
      const before = findObject(document, command.id);
      if (!before) return null;
      if (before.x === command.x && before.y === command.y) return null;
      return moveHistoryCommand(
        command.id,
        `Move ${before.type}`,
        { x: before.x, y: before.y },
        { x: command.x, y: command.y },
      );
    }
    case 'objects.geometry': {
      const before: CanvasObject[] = [];
      const after: CanvasObject[] = [];
      for (const update of command.updates) {
        const object = findObject(document, update.id);
        if (!object) continue;
        const next = withObjectGeometry(object, update);
        if (next === object) continue;
        before.push(object);
        after.push(next);
      }
      if (after.length === 0) return null;
      return geometryHistoryCommand(command.label ?? 'Transform', before, after);
    }
    case 'object.delete': {
      const index = document.objects.findIndex((object) => object.id === command.id);
      if (index === -1) return null;
      const removed = document.objects[index];
      return {
        type: 'delete',
        label: `Delete ${removed.type}`,
        apply: (current) => applyCommand(current, command),
        revert: (current) => {
          if (current.objects.some((object) => object.id === removed.id)) return current;
          const objects = [...current.objects];
          objects.splice(Math.min(index, objects.length), 0, removed);
          return { ...current, objects };
        },
      };
    }
    default:
      return null;
  }
}

export type DocumentAction =
  | { type: 'command'; command: DocumentCommand; transient?: boolean }
  /** Apply several commands as one undo step (multi-delete, multi-duplicate). */
  | { type: 'commands'; commands: readonly DocumentCommand[] }
  | { type: 'commit' }
  | { type: 'undo' }
  | { type: 'redo' }
  /** Correct a text object's height from the real rendered line count. */
  | { type: 'measure'; id: string; height: number };

export type DocumentHistory = History<CanvasDocument>;

/**
 * What committing an in-place edit should do. Empty text never becomes a board
 * object: a brand new empty object is dropped silently, and an existing object
 * whose text was cleared is deleted (undo brings it back).
 */
export function editingCommit(object: CanvasObject, isNew: boolean): DocumentCommand | null {
  if (!isTextualObject(object)) return null;
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
    fontWeight: object.fontWeight,
    fontStyle: object.fontStyle,
  };
}

/**
 * One reducer owns ink and objects so undo/redo is chronological across both:
 * a note created between two strokes undoes in the same order the user made it.
 */
export function documentReducer(state: DocumentHistory, action: DocumentAction): DocumentHistory {
  switch (action.type) {
    case 'command': {
      const command = prepareDocumentCommand(state.present, action.command);
      return command ? executeCommand(state, command, action.transient ?? false) : state;
    }
    case 'commands': {
      const prepared: HistoryCommand<CanvasDocument>[] = [];
      let present = state.present;
      for (const command of action.commands) {
        const preparedCommand = prepareDocumentCommand(present, command);
        if (!preparedCommand) continue;
        prepared.push(preparedCommand);
        present = preparedCommand.apply(present);
      }
      if (prepared.length === 0) return state;
      return executeCommand(state, batchCommand(prepared), false);
    }
    case 'commit':
      return commitChange(state);
    case 'undo':
      return undoHistory(state);
    case 'redo':
      return redoHistory(state);
    case 'measure': {
      const object = findObject(state.present, action.id);
      if (!object || object.type !== 'text') return state;
      const height = Math.max(1, Math.round(action.height));
      if (Math.abs(object.height - height) < 1) return state;
      // Measured layout is derived data, not an edit: it corrects the hit box
      // without adding an undo step or clearing redo.
      return {
        ...state,
        present: mapObject(state.present, action.id, (current) =>
          current.type === 'text' ? { ...current, height } : current,
        ),
      };
    }
    default:
      return state;
  }
}

export function createDocumentHistory(document: CanvasDocument = EMPTY_DOCUMENT): DocumentHistory {
  return createHistory(document, documentsEqual);
}
