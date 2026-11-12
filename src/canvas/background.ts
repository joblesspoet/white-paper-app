/**
 * Pure world-space background pattern generator for teaching canvases.
 *
 * Shared between `CanvasViewport` (live Skia canvas) and `export-service`
 * (offscreen PNG/JPEG/PDF export) so exported boards match the live editor.
 */

import type { BoardStyle } from '../persistence/schema';

export type BackgroundBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type BackgroundLayer = {
  svgPath: string;
  strokeWidth: number;
  opacity: number;
  isMargin?: boolean;
};

export const DOTS_STEP = 24;
export const GRID_MINOR_STEP = 24;
export const GRID_MAJOR_STEP = 120;
export const RULED_LINE_STEP = 32;
export const RULED_MARGIN_X = 64;
export const ISOMETRIC_STEP = 28;

const MAX_LINES_PER_AXIS = 220;

function snapFloor(value: number, step: number): number {
  return Math.floor(value / step) * step;
}

function adaptStep(span: number, baseStep: number): number {
  let step = baseStep;
  while (span / step > MAX_LINES_PER_AXIS) {
    step *= 2;
  }
  return step;
}

function formatNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

/**
 * Generates SVG path layers for the requested `BoardStyle` within `bounds`
 * (in canvas world coordinates). Returns an empty array for `'blank'`.
 */
export function buildBackgroundLayers(
  style: BoardStyle,
  bounds: BackgroundBounds,
): BackgroundLayer[] {
  if (style === 'blank' || bounds.width <= 0 || bounds.height <= 0) {
    return [];
  }

  const minX = bounds.x;
  const maxX = bounds.x + bounds.width;
  const minY = bounds.y;
  const maxY = bounds.y + bounds.height;

  if (style === 'dots') {
    const step = adaptStep(Math.max(bounds.width, bounds.height), DOTS_STEP);
    const startX = snapFloor(minX, step);
    const startY = snapFloor(minY, step);
    const parts: string[] = [];
    for (let x = startX; x <= maxX; x += step) {
      for (let y = startY; y <= maxY; y += step) {
        parts.push(`M ${formatNum(x)} ${formatNum(y)} L ${formatNum(x + 0.01)} ${formatNum(y)}`);
      }
    }
    return parts.length > 0
      ? [{ svgPath: parts.join(' '), strokeWidth: 2.2, opacity: 0.22 }]
      : [];
  }

  if (style === 'grid') {
    const minorStep = adaptStep(Math.max(bounds.width, bounds.height), GRID_MINOR_STEP);
    const majorStep = minorStep === GRID_MINOR_STEP ? GRID_MAJOR_STEP : minorStep * 5;
    const minorParts: string[] = [];
    const majorParts: string[] = [];

    const startX = snapFloor(minX, minorStep);
    for (let x = startX; x <= maxX; x += minorStep) {
      const isMajor = Math.abs(Math.round(x / majorStep) * majorStep - x) < 0.01;
      const seg = `M ${formatNum(x)} ${formatNum(minY)} L ${formatNum(x)} ${formatNum(maxY)}`;
      if (isMajor) majorParts.push(seg);
      else minorParts.push(seg);
    }

    const startY = snapFloor(minY, minorStep);
    for (let y = startY; y <= maxY; y += minorStep) {
      const isMajor = Math.abs(Math.round(y / majorStep) * majorStep - y) < 0.01;
      const seg = `M ${formatNum(minX)} ${formatNum(y)} L ${formatNum(maxX)} ${formatNum(y)}`;
      if (isMajor) majorParts.push(seg);
      else minorParts.push(seg);
    }

    const layers: BackgroundLayer[] = [];
    if (minorParts.length > 0) {
      layers.push({ svgPath: minorParts.join(' '), strokeWidth: 1, opacity: 0.12 });
    }
    if (majorParts.length > 0) {
      layers.push({ svgPath: majorParts.join(' '), strokeWidth: 1.25, opacity: 0.22 });
    }
    return layers;
  }

  if (style === 'ruled') {
    const step = adaptStep(bounds.height, RULED_LINE_STEP);
    const startY = snapFloor(minY, step);
    const lineParts: string[] = [];
    for (let y = startY; y <= maxY; y += step) {
      lineParts.push(`M ${formatNum(minX)} ${formatNum(y)} L ${formatNum(maxX)} ${formatNum(y)}`);
    }

    const layers: BackgroundLayer[] = [];
    if (lineParts.length > 0) {
      layers.push({ svgPath: lineParts.join(' '), strokeWidth: 1, opacity: 0.16 });
    }
    if (RULED_MARGIN_X >= minX && RULED_MARGIN_X <= maxX) {
      layers.push({
        svgPath: `M ${RULED_MARGIN_X} ${formatNum(minY)} L ${RULED_MARGIN_X} ${formatNum(maxY)}`,
        strokeWidth: 1.25,
        opacity: 0.28,
        isMargin: true,
      });
    }
    return layers;
  }

  // 'isometric': 60° equilateral triangular lattice (vertical + ±30° diagonals)
  const step = adaptStep(Math.max(bounds.width, bounds.height), ISOMETRIC_STEP);
  const dx = step * (Math.sqrt(3) / 2);
  const slope = 1 / Math.sqrt(3); // tan(30°)
  const parts: string[] = [];

  // Vertical lines
  const startX = snapFloor(minX, dx);
  for (let x = startX; x <= maxX; x += dx) {
    parts.push(`M ${formatNum(x)} ${formatNum(minY)} L ${formatNum(x)} ${formatNum(maxY)}`);
  }

  // +30° lines: y = intercept + slope * x
  const minPosIntercept = snapFloor(minY - slope * maxX, step);
  const maxPosIntercept = maxY - slope * minX;
  for (let b = minPosIntercept; b <= maxPosIntercept; b += step) {
    const y1 = b + slope * minX;
    const y2 = b + slope * maxX;
    parts.push(`M ${formatNum(minX)} ${formatNum(y1)} L ${formatNum(maxX)} ${formatNum(y2)}`);
  }

  // -30° lines: y = intercept - slope * x
  const minNegIntercept = snapFloor(minY + slope * minX, step);
  const maxNegIntercept = maxY + slope * maxX;
  for (let b = minNegIntercept; b <= maxNegIntercept; b += step) {
    const y1 = b - slope * minX;
    const y2 = b - slope * maxX;
    parts.push(`M ${formatNum(minX)} ${formatNum(y1)} L ${formatNum(maxX)} ${formatNum(y2)}`);
  }

  return parts.length > 0
    ? [{ svgPath: parts.join(' '), strokeWidth: 1, opacity: 0.14 }]
    : [];
}
