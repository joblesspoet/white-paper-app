/**
 * Pure selection geometry and object transforms.
 *
 * Everything here works in canvas coordinates. The viewport only decides how
 * large handles should look on screen and where a gesture point lands, so a
 * resize or rotation behaves identically at 0.5×, 1×, or 4× zoom.
 *
 * The selection box for one object follows its rotation; a multi-selection box
 * is the axis-aligned union of every object's rotated bounds.
 */

import {
  measureTextBlock,
  rotatePoint,
  type CanvasObject,
  type ObjectGeometryPatch,
  type ScreenRect,
} from './document.ts';
import { canvasToScreen, type Point, type Viewport } from './viewport.ts';

export type CanvasRect = { x: number; y: number; width: number; height: number };
export type ResizeHandle = 'nw' | 'ne' | 'se' | 'sw';
export type SelectionHandle = ResizeHandle | 'rotate';
export type ActionRailPlacement = 'right' | 'left' | 'inside';
export type ActionRail = {
  x: number;
  y: number;
  width: number;
  height: number;
  placement: ActionRailPlacement;
};

/** Visible handle square, in screen points. */
export const SELECTION_HANDLE_SCREEN = 12;
/** Finger-sized hit area around a handle, in screen points. */
export const SELECTION_HANDLE_HIT_SCREEN = 22;
/** Gap between the top edge and the rotate handle, in screen points. */
export const ROTATE_HANDLE_OFFSET_SCREEN = 36;
/** A resize never shrinks an object below this on-screen size. */
export const MIN_RESIZE_SCREEN = 24;
/** Width and height of one selection action button, in screen points. */
export const ACTION_RAIL_ACTION_SCREEN = 44;
/** Gap between the selection edge and the action rail, in screen points. */
export const ACTION_RAIL_GAP_SCREEN = 12;
/** Minimum distance between the action rail and the canvas edge, in screen points. */
export const ACTION_RAIL_EDGE_SCREEN = 8;
/** Border stroke of the rail, so its box can be measured before it renders. */
const ACTION_RAIL_BORDER_SCREEN = 1;

export const RESIZE_HANDLES: readonly ResizeHandle[] = ['nw', 'ne', 'se', 'sw'];

/** The four corners of an object's rotated box, in nw/ne/se/sw order. */
export function objectCorners(object: CanvasObject): Point[] {
  'worklet';
  const corners: Point[] = [
    { x: object.x, y: object.y },
    { x: object.x + object.width, y: object.y },
    { x: object.x + object.width, y: object.y + object.height },
    { x: object.x, y: object.y + object.height },
  ];
  if (object.rotation === 0) return corners;
  const centre = { x: object.x + object.width / 2, y: object.y + object.height / 2 };
  return corners.map((corner) => rotatePoint(corner, centre, object.rotation));
}

/** Axis-aligned bounds of one rotated object. */
export function objectBounds(object: CanvasObject): CanvasRect {
  'worklet';
  if (object.rotation === 0) {
    return { x: object.x, y: object.y, width: object.width, height: object.height };
  }
  const corners = objectCorners(object);
  let left = corners[0].x;
  let top = corners[0].y;
  let right = corners[0].x;
  let bottom = corners[0].y;
  for (let index = 1; index < corners.length; index += 1) {
    left = Math.min(left, corners[index].x);
    top = Math.min(top, corners[index].y);
    right = Math.max(right, corners[index].x);
    bottom = Math.max(bottom, corners[index].y);
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** Axis-aligned union of several objects, or null when nothing is selected. */
export function selectionBounds(objects: readonly CanvasObject[]): CanvasRect | null {
  'worklet';
  if (objects.length === 0) return null;
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const object of objects) {
    const bounds = objectBounds(object);
    left = Math.min(left, bounds.x);
    top = Math.min(top, bounds.y);
    right = Math.max(right, bounds.x + bounds.width);
    bottom = Math.max(bottom, bounds.y + bounds.height);
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * Points for the selection outline. A single object keeps its rotated corners;
 * a multi-selection uses the axis-aligned union.
 */
export function selectionCorners(objects: readonly CanvasObject[]): Point[] {
  'worklet';
  if (objects.length === 1) return objectCorners(objects[0]);
  const bounds = selectionBounds(objects);
  if (!bounds) return [];
  return [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ];
}

/** Handle centres in canvas coordinates. Multi-selections have no handles. */
export function selectionHandlePositions(
  objects: readonly CanvasObject[],
  rotateOffset: number,
): Record<SelectionHandle, Point> | null {
  'worklet';
  if (objects.length !== 1) return null;
  const corners = objectCorners(objects[0]);
  const centre = {
    x: objects[0].x + objects[0].width / 2,
    y: objects[0].y + objects[0].height / 2,
  };
  const topMiddle = {
    x: (corners[0].x + corners[1].x) / 2,
    y: (corners[0].y + corners[1].y) / 2,
  };
  let dx = topMiddle.x - centre.x;
  let dy = topMiddle.y - centre.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) {
    dx = 0;
    dy = -1;
  } else {
    dx /= length;
    dy /= length;
  }
  return {
    nw: corners[0],
    ne: corners[1],
    se: corners[2],
    sw: corners[3],
    rotate: {
      x: topMiddle.x + dx * rotateOffset,
      y: topMiddle.y + dy * rotateOffset,
    },
  };
}

/** The handle under a canvas-space point, or null. */
export function handleAtPoint(
  objects: readonly CanvasObject[],
  point: Point,
  tolerance: number,
  rotateOffset: number,
): SelectionHandle | null {
  'worklet';
  const handles = selectionHandlePositions(objects, rotateOffset);
  if (!handles) return null;
  const order: readonly SelectionHandle[] = [...RESIZE_HANDLES, 'rotate'];
  for (const handle of order) {
    const position = handles[handle];
    if (Math.hypot(point.x - position.x, point.y - position.y) <= tolerance) return handle;
  }
  return null;
}

/** Objects whose axis-aligned bounds intersect a marquee rectangle. */
export function objectsInRect(
  objects: readonly CanvasObject[],
  rect: CanvasRect,
): CanvasObject[] {
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  return objects.filter((object) => {
    const bounds = objectBounds(object);
    return (
      bounds.x <= right &&
      bounds.x + bounds.width >= rect.x &&
      bounds.y <= bottom &&
      bounds.y + bounds.height >= rect.y
    );
  });
}

export function canvasRectToScreen(rect: CanvasRect, viewport: Viewport): ScreenRect {
  const origin = canvasToScreen({ x: rect.x, y: rect.y }, viewport);
  return {
    x: origin.x,
    y: origin.y,
    width: rect.width * viewport.scale,
    height: rect.height * viewport.scale,
  };
}

/**
 * Place the contextual action rail beside a selection in screen space.
 *
 * The rail is a vertical stack, so it never covers the rotate handle above the
 * selection. It prefers the right side, flips to the left when the right edge
 * would overflow, and only falls back to the inside edge when neither side
 * fits. The result is clamped inside the canvas, so the actions stay reachable
 * for objects near an edge.
 */
export function selectionActionRail(
  rect: CanvasRect,
  actionCount: number,
  canvasWidth: number,
  canvasHeight: number,
): ActionRail {
  const count = Math.max(1, Math.round(actionCount));
  const width = ACTION_RAIL_ACTION_SCREEN + ACTION_RAIL_BORDER_SCREEN * 2;
  const height = ACTION_RAIL_ACTION_SCREEN * count + ACTION_RAIL_BORDER_SCREEN * 2;
  const rightX = rect.x + rect.width + ACTION_RAIL_GAP_SCREEN;
  const leftX = rect.x - ACTION_RAIL_GAP_SCREEN - width;

  let x: number;
  let placement: ActionRailPlacement;
  if (rightX + width <= canvasWidth - ACTION_RAIL_EDGE_SCREEN) {
    x = rightX;
    placement = 'right';
  } else if (leftX >= ACTION_RAIL_EDGE_SCREEN) {
    x = leftX;
    placement = 'left';
  } else {
    x = rect.x + rect.width - width - ACTION_RAIL_EDGE_SCREEN;
    placement = 'inside';
  }

  const maxX = canvasWidth - width - ACTION_RAIL_EDGE_SCREEN;
  x = maxX >= ACTION_RAIL_EDGE_SCREEN ? Math.max(ACTION_RAIL_EDGE_SCREEN, Math.min(x, maxX)) : ACTION_RAIL_EDGE_SCREEN;

  const centredY = rect.y + rect.height / 2 - height / 2;
  const maxY = canvasHeight - height - ACTION_RAIL_EDGE_SCREEN;
  const y = maxY >= ACTION_RAIL_EDGE_SCREEN ? Math.max(ACTION_RAIL_EDGE_SCREEN, Math.min(centredY, maxY)) : ACTION_RAIL_EDGE_SCREEN;

  return { x, y, width, height, placement };
}

/**
 * Resize one object from a corner handle. The opposite corner stays fixed in
 * world space, even when the object is rotated. Text re-wraps and its height is
 * derived from the new width instead of the pointer.
 */
export function resizeObject(
  object: CanvasObject,
  handle: ResizeHandle,
  point: Point,
  minSize = 1,
): Required<Pick<ObjectGeometryPatch, 'x' | 'y' | 'width' | 'height' | 'rotation'>> {
  const minimum = Math.max(1, minSize);
  const centre = { x: object.x + object.width / 2, y: object.y + object.height / 2 };
  // Work in the object's unrotated frame; the opposite corner is the anchor.
  const local = object.rotation === 0 ? point : rotatePoint(point, centre, -object.rotation);

  const west = handle === 'nw' || handle === 'sw';
  const north = handle === 'nw' || handle === 'ne';
  const anchorLocal = {
    x: west ? object.x + object.width : object.x,
    y: north ? object.y + object.height : object.y,
  };

  const width = Math.max(
    minimum,
    west ? anchorLocal.x - local.x : local.x - anchorLocal.x,
  );
  // Text re-wraps; images and math formulas scale proportionally so pixels and
  // math notation are never stretched. Shapes and connectors take the pointer-driven box.
  const lockedAspect =
    (object.type === 'image' || object.type === 'math') && object.width > 0
      ? object.height / object.width
      : null;
  const height = object.type === 'text'
    ? measureTextBlock(object.text, object.fontSize, width, object.fontWeight, object.fontStyle).height
    : lockedAspect !== null
      ? Math.max(minimum, width * lockedAspect)
      : Math.max(minimum, north ? anchorLocal.y - local.y : local.y - anchorLocal.y);

  const left = west ? anchorLocal.x - width : anchorLocal.x;
  const top = north ? anchorLocal.y - height : anchorLocal.y;

  // The anchor stays put in world space. Rotate the vector from the anchor to
  // the new box centre so a rotated object grows away from the fixed corner.
  const anchorWorld = rotatePoint(anchorLocal, centre, object.rotation);
  const vectorToCentre = rotatePoint(
    { x: left + width / 2 - anchorLocal.x, y: top + height / 2 - anchorLocal.y },
    { x: 0, y: 0 },
    object.rotation,
  );
  const newCentre = {
    x: anchorWorld.x + vectorToCentre.x,
    y: anchorWorld.y + vectorToCentre.y,
  };

  return {
    x: newCentre.x - width / 2,
    y: newCentre.y - height / 2,
    width,
    height,
    rotation: object.rotation,
  };
}

/** Wrap degrees into (-180, 180]. */
export function normalizeRotation(degrees: number): number {
  'worklet';
  let value = degrees % 360;
  if (value > 180) value -= 360;
  if (value <= -180) value += 360;
  return value;
}

/** Angle of a canvas point from a centre, in degrees. */
export function pointerAngle(point: Point, centre: Point): number {
  'worklet';
  return (Math.atan2(point.y - centre.y, point.x - centre.x) * 180) / Math.PI;
}

/**
 * Rotation that keeps the object's angle under the finger at gesture start.
 * Near a 15° step the angle snaps, which makes straight objects easy to reset
 * without forcing a modifier key.
 */
export function rotationFromPointer(centre: Point, point: Point, offset: number): number {
  const raw = normalizeRotation(pointerAngle(point, centre) + offset);
  const snapped = Math.round(raw / 15) * 15;
  const value = Math.abs(raw - snapped) <= 3 ? snapped : raw;
  return Math.round(value * 10) / 10;
}
