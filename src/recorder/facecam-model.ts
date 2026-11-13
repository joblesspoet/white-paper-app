/**
 * Pure geometry and state model for the Floating Face-Cam PiP bubble.
 * Kept free of React Native / native module imports so it can be unit-tested
 * directly in Node.
 */

export type FaceCamSizePreset = 'small' | 'medium' | 'large';
export type FaceCamShape = 'circle' | 'rounded-card';
export type FaceCamFacing = 'front' | 'back';
export type FaceCamCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type FaceCamPermissionStatus = 'unknown' | 'granted' | 'denied' | 'blocked';

export const FACECAM_SIZE_PRESETS: Record<FaceCamSizePreset, number> = {
  small: 88,
  medium: 124,
  large: 164,
};

export const FACECAM_SIZE_ORDER: readonly FaceCamSizePreset[] = ['small', 'medium', 'large'];

export const FACECAM_EDGE_MARGIN = 12;
export const FACECAM_CARD_RADIUS = 16;
export const FACECAM_RING_WIDTH = 2;
export const FACECAM_IDLE_RING_COLOR = '#0D9488';
export const FACECAM_RECORDING_RING_COLOR = '#DC2626';

export type FaceCamPoint = {
  x: number;
  y: number;
};

export type FaceCamBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type FaceCamState = {
  visible: boolean;
  sizePreset: FaceCamSizePreset;
  shape: FaceCamShape;
  facing: FaceCamFacing;
  mirrored: boolean;
  corner: FaceCamCorner;
  position: FaceCamPoint;
  controlsVisible: boolean;
  permissionStatus: FaceCamPermissionStatus;
  canAskAgain: boolean;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function faceCamSizePt(preset: FaceCamSizePreset): number {
  return FACECAM_SIZE_PRESETS[preset];
}

export function faceCamBorderRadius(shape: FaceCamShape, sizePt: number): number {
  return shape === 'circle' ? sizePt / 2 : FACECAM_CARD_RADIUS;
}

export function faceCamRingColor(isRecording: boolean, primaryColor: string = FACECAM_IDLE_RING_COLOR): string {
  return isRecording ? FACECAM_RECORDING_RING_COLOR : primaryColor;
}

export function cycleFaceCamSize(current: FaceCamSizePreset): FaceCamSizePreset {
  const index = FACECAM_SIZE_ORDER.indexOf(current);
  return FACECAM_SIZE_ORDER[(index + 1) % FACECAM_SIZE_ORDER.length];
}

/**
 * Computes safe-area drag bounds for the Face-Cam bubble inside the editor
 * canvas, reserving `bottomExclusion` (e.g. `ACTION_ISLAND_HEIGHT`) at the
 * bottom so the bubble never obscures the action island.
 */
export function faceCamBounds(
  viewportWidth: number,
  viewportHeight: number,
  sizePt: number,
  bottomExclusion: number = 0,
  margin: number = FACECAM_EDGE_MARGIN,
): FaceCamBounds {
  const minX = margin;
  const minY = margin;
  const maxX = Math.max(minX, viewportWidth - sizePt - margin);
  const maxY = Math.max(minY, viewportHeight - sizePt - bottomExclusion - margin);
  return { minX, maxX, minY, maxY };
}

export function clampFaceCamPosition(
  position: FaceCamPoint,
  viewportWidth: number,
  viewportHeight: number,
  sizePt: number,
  bottomExclusion: number = 0,
  margin: number = FACECAM_EDGE_MARGIN,
): FaceCamPoint {
  const bounds = faceCamBounds(viewportWidth, viewportHeight, sizePt, bottomExclusion, margin);
  return {
    x: clamp(position.x, bounds.minX, bounds.maxX),
    y: clamp(position.y, bounds.minY, bounds.maxY),
  };
}

export function cornerPosition(
  corner: FaceCamCorner,
  viewportWidth: number,
  viewportHeight: number,
  sizePt: number,
  bottomExclusion: number = 0,
  margin: number = FACECAM_EDGE_MARGIN,
): FaceCamPoint {
  const bounds = faceCamBounds(viewportWidth, viewportHeight, sizePt, bottomExclusion, margin);
  switch (corner) {
    case 'top-left':
      return { x: bounds.minX, y: bounds.minY };
    case 'top-right':
      return { x: bounds.maxX, y: bounds.minY };
    case 'bottom-left':
      return { x: bounds.minX, y: bounds.maxY };
    case 'bottom-right':
      return { x: bounds.maxX, y: bounds.maxY };
  }
}

/**
 * Snaps a released bubble position to the nearest magnetic corner inside the
 * safe-area bounds.
 */
export function snapFaceCamToNearestCorner(
  position: FaceCamPoint,
  viewportWidth: number,
  viewportHeight: number,
  sizePt: number,
  bottomExclusion: number = 0,
  margin: number = FACECAM_EDGE_MARGIN,
): { corner: FaceCamCorner; position: FaceCamPoint } {
  const clamped = clampFaceCamPosition(
    position,
    viewportWidth,
    viewportHeight,
    sizePt,
    bottomExclusion,
    margin,
  );
  const bounds = faceCamBounds(viewportWidth, viewportHeight, sizePt, bottomExclusion, margin);
  const midX = (bounds.minX + bounds.maxX) / 2;
  const midY = (bounds.minY + bounds.maxY) / 2;

  const isRight = clamped.x >= midX;
  const isBottom = clamped.y >= midY;

  const corner: FaceCamCorner = isBottom
    ? isRight
      ? 'bottom-right'
      : 'bottom-left'
    : isRight
      ? 'top-right'
      : 'top-left';

  return {
    corner,
    position: cornerPosition(corner, viewportWidth, viewportHeight, sizePt, bottomExclusion, margin),
  };
}

export function createInitialFaceCamState(
  viewportWidth: number = 390,
  viewportHeight: number = 700,
  bottomExclusion: number = 0,
): FaceCamState {
  const sizePreset: FaceCamSizePreset = 'medium';
  const corner: FaceCamCorner = 'bottom-right';
  const sizePt = faceCamSizePt(sizePreset);
  return {
    visible: false,
    sizePreset,
    shape: 'circle',
    facing: 'front',
    mirrored: true,
    corner,
    position: cornerPosition(corner, viewportWidth, viewportHeight, sizePt, bottomExclusion),
    controlsVisible: false,
    permissionStatus: 'unknown',
    canAskAgain: true,
  };
}
