/**
 * Canvas viewport model.
 *
 * The viewport maps canvas (document) coordinates to screen coordinates:
 *
 *   screen = canvas * scale + offset
 *   canvas = (screen - offset) / scale
 *
 * `x` and `y` are the screen-space translation of the canvas origin; `scale`
 * is the zoom factor. Keeping the model pure makes it testable without React
 * Native and keeps the gesture worklets and the UI in agreement.
 */

export type Point = { x: number; y: number };

export type Viewport = {
  /** Screen-space x offset of the canvas origin. */
  x: number;
  /** Screen-space y offset of the canvas origin. */
  y: number;
  /** Zoom factor, clamped to [MIN_ZOOM, MAX_ZOOM]. */
  scale: number;
};

/** Lower zoom limit: the board can shrink to half size. */
export const MIN_ZOOM = 0.5;
/** Upper zoom limit: enough detail for ink without blurring the grid. */
export const MAX_ZOOM = 4;

export const IDENTITY_VIEWPORT: Viewport = { x: 0, y: 0, scale: 1 };

/** Clamp a zoom factor to the supported range. */
export function clampScale(scale: number): number {
  'worklet';
  if (!Number.isFinite(scale)) return IDENTITY_VIEWPORT.scale;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
}

/** Convert a screen (gesture) point into canvas space. */
export function screenToCanvas(point: Point, viewport: Viewport): Point {
  'worklet';
  return {
    x: (point.x - viewport.x) / viewport.scale,
    y: (point.y - viewport.y) / viewport.scale,
  };
}

/** Convert a canvas (document) point into screen space. */
export function canvasToScreen(point: Point, viewport: Viewport): Point {
  'worklet';
  return {
    x: point.x * viewport.scale + viewport.x,
    y: point.y * viewport.scale + viewport.y,
  };
}

/** Translate the viewport by a screen-space delta. */
export function panViewport(viewport: Viewport, dx: number, dy: number): Viewport {
  'worklet';
  return { ...viewport, x: viewport.x + dx, y: viewport.y + dy };
}

/**
 * Zoom around a screen-space focal point while keeping the canvas point under
 * that focal point fixed. This is what makes pinch zoom feel anchored instead
 * of pulling the board toward the screen center.
 */
export function zoomViewportAt(viewport: Viewport, focal: Point, nextScale: number): Viewport {
  'worklet';
  const scale = clampScale(nextScale);
  const anchor = screenToCanvas(focal, viewport);
  return {
    x: focal.x - anchor.x * scale,
    y: focal.y - anchor.y * scale,
    scale,
  };
}

/** The reset-viewport action: origin at the top-left, 100% zoom. */
export function resetViewport(): Viewport {
  'worklet';
  return { ...IDENTITY_VIEWPORT };
}

/** Used to show the reset action only when the view has moved. */
export function isIdentityViewport(viewport: Viewport): boolean {
  'worklet';
  return (
    Math.abs(viewport.x) < 0.5 &&
    Math.abs(viewport.y) < 0.5 &&
    Math.abs(viewport.scale - IDENTITY_VIEWPORT.scale) < 0.001
  );
}
