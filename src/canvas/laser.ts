/**
 * Ephemeral laser pointer model.
 *
 * Laser strokes live strictly in transient UI state: they never enter
 * `CanvasDocument.strokes`, never push to `History`, and never trigger SQLite
 * autosave. Once released, a stroke decays linearly to 0 over `LASER_DECAY_MS`.
 */

import type { Point } from './viewport';

export type LaserPresetKey = 'red' | 'teal' | 'amber';
export type LaserColorKey = LaserPresetKey | (string & {});

export type LaserPoint = {
  x: number;
  y: number;
  timestampMs: number;
};

export type EphemeralLaserStroke = {
  id: string;
  colorKey: LaserColorKey;
  points: readonly LaserPoint[];
  releasedAtMs: number | null;
};

export const LASER_DECAY_MS = 1200;
export const LASER_HOLD_MS = 350;

export const LASER_HALO_WIDTH = 10;
export const LASER_HALO_OPACITY = 0.28;
export const LASER_CORE_WIDTH = 3.5;
export const LASER_CORE_OPACITY = 0.95;

export const LASER_COLORS: Record<
  LaserPresetKey,
  { key: LaserPresetKey; label: string; halo: string; core: string }
> = {
  red: { key: 'red', label: 'Red laser', halo: '#EF4444', core: '#FCA5A5' },
  teal: { key: 'teal', label: 'Neon teal laser', halo: '#14B8A6', core: '#99F6E4' },
  amber: { key: 'amber', label: 'Solar amber laser', halo: '#F59E0B', core: '#FDE68A' },
};

export const LASER_COLOR_LIST = [
  LASER_COLORS.red,
  LASER_COLORS.teal,
  LASER_COLORS.amber,
] as const;

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function tintHexTowardWhite(hex: string, ratio: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mix = (channel: number) => Math.round(channel + (255 - channel) * ratio);
  const toHex = (channel: number) => mix(channel).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function isLaserPresetKey(key: string): key is LaserPresetKey {
  return key === 'red' || key === 'teal' || key === 'amber';
}

export function resolveLaserPalette(colorKey: LaserColorKey): { halo: string; core: string } {
  if (isLaserPresetKey(colorKey)) {
    const preset = LASER_COLORS[colorKey];
    return { halo: preset.halo, core: preset.core };
  }
  if (HEX_COLOR_RE.test(colorKey)) {
    return {
      halo: colorKey.toUpperCase(),
      core: tintHexTowardWhite(colorKey, 0.72),
    };
  }
  return { halo: LASER_COLORS.red.halo, core: LASER_COLORS.red.core };
}

export function createLaserStroke(
  id: string,
  colorKey: LaserColorKey,
  point: Point,
  nowMs = Date.now(),
): EphemeralLaserStroke {
  return {
    id,
    colorKey,
    points: [{ x: point.x, y: point.y, timestampMs: nowMs }],
    releasedAtMs: null,
  };
}

export function appendLaserPoint(
  stroke: EphemeralLaserStroke,
  point: Point,
  nowMs = Date.now(),
  minDistance = 0,
): EphemeralLaserStroke {
  const last = stroke.points[stroke.points.length - 1];
  if (last && Math.hypot(point.x - last.x, point.y - last.y) < minDistance) {
    return stroke;
  }
  return {
    ...stroke,
    points: [...stroke.points, { x: point.x, y: point.y, timestampMs: nowMs }],
  };
}

export function releaseLaserStroke(
  stroke: EphemeralLaserStroke,
  nowMs = Date.now(),
): EphemeralLaserStroke {
  return {
    ...stroke,
    releasedAtMs: nowMs,
  };
}

/**
 * Returns 1 while actively held, then decays linearly from 1 to 0 over
 * `LASER_DECAY_MS` (1200 ms) after `releasedAtMs`.
 */
export function laserStrokeOpacity(stroke: EphemeralLaserStroke, nowMs: number): number {
  if (stroke.releasedAtMs === null) return 1;
  const elapsed = nowMs - stroke.releasedAtMs;
  if (elapsed <= 0) return 1;
  if (elapsed >= LASER_DECAY_MS) return 0;
  return 1 - elapsed / LASER_DECAY_MS;
}

export function pruneExpiredLaserStrokes(
  strokes: readonly EphemeralLaserStroke[],
  nowMs: number,
): readonly EphemeralLaserStroke[] {
  return strokes.filter((stroke) => laserStrokeOpacity(stroke, nowMs) > 0);
}
