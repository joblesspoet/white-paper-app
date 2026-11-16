/**
 * Pure Spatial Voice-Pin Sticker model, waveform normalization, and duration
 * formatting helpers. Kept free of Expo/RN imports for direct Node testing.
 */

import type { TextColorKey, VoicePinObject } from '../canvas/document.ts';
import type { Point } from '../canvas/viewport.ts';
import { safeBoardSegment } from '../media/image-crop.ts';

export const VOICE_PIN_WIDTH = 136;
export const VOICE_PIN_HEIGHT = 44;
export const VOICE_PIN_PEAK_COUNT = 16;
export const DEFAULT_VOICE_PIN_COLOR: TextColorKey = 'teal';
/** Per-pin recording limit: 5 minutes so .flowcanvas.json backups stay bounded. */
export const MAX_VOICE_PIN_DURATION_MS = 5 * 60 * 1000;

export function normalizeWaveformPeaks(
  samples: readonly number[] | undefined | null,
  barCount: number = VOICE_PIN_PEAK_COUNT,
): number[] {
  const targetCount = Math.max(1, Math.round(barCount));
  if (!samples || samples.length === 0) {
    return Array.from({ length: targetCount }, (_, i) =>
      Number((0.22 + 0.45 * Math.abs(Math.sin((i + 1) * 0.7))).toFixed(3)),
    );
  }

  const sanitized = samples.map((value) => {
    if (!Number.isFinite(value)) return 0;
    // Handle dBFS metering (-60..0) as well as linear [0..1] amplitudes.
    if (value < 0) {
      const clampedDb = Math.max(-60, Math.min(0, value));
      return (clampedDb + 60) / 60;
    }
    return Math.max(0, Math.min(1, value));
  });

  const peaks: number[] = [];
  for (let i = 0; i < targetCount; i += 1) {
    const start = Math.floor((i * sanitized.length) / targetCount);
    const end = Math.max(start + 1, Math.floor(((i + 1) * sanitized.length) / targetCount));
    let maxVal = 0;
    for (let j = start; j < end && j < sanitized.length; j += 1) {
      if (sanitized[j] > maxVal) maxVal = sanitized[j];
    }
    peaks.push(Number(Math.max(0.08, Math.min(1, maxVal)).toFixed(3)));
  }
  return peaks;
}

export function formatVoiceDuration(durationMs: number): string {
  const safeMs = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 0;
  const totalSeconds = Math.max(1, Math.round(safeMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function voicePinStoragePath(
  boardId: string,
  assetId: string,
  extension: string = 'm4a',
): string {
  const safeBoard = safeBoardSegment(boardId);
  const safeAsset = assetId.replace(/[^a-zA-Z0-9._-]+/g, '-');
  const safeExt = extension.replace(/[^a-zA-Z0-9]+/g, '').toLowerCase() || 'm4a';
  return `media/${safeBoard}/audio/${safeAsset}.${safeExt}`;
}

export type CreateVoicePinInput = {
  id: string;
  point: Point;
  audioAssetId: string;
  storagePath: string;
  durationMs: number;
  waveformPeaks?: readonly number[];
  transcript?: string;
  colorKey?: string;
  isPrivate?: boolean;
};

export function createVoicePinObject({
  id,
  point,
  audioAssetId,
  storagePath,
  durationMs,
  waveformPeaks,
  transcript,
  colorKey = DEFAULT_VOICE_PIN_COLOR,
  isPrivate,
}: CreateVoicePinInput): VoicePinObject {
  return {
    id,
    type: 'voice-pin',
    x: Math.round(point.x - VOICE_PIN_WIDTH / 2),
    y: Math.round(point.y - VOICE_PIN_HEIGHT / 2),
    width: VOICE_PIN_WIDTH,
    height: VOICE_PIN_HEIGHT,
    rotation: 0,
    audioAssetId,
    storagePath,
    durationMs: Math.max(200, Math.round(durationMs)),
    waveformPeaks: normalizeWaveformPeaks(waveformPeaks, VOICE_PIN_PEAK_COUNT),
    colorKey,
    ...(transcript && transcript.trim().length > 0 ? { transcript: transcript.trim() } : {}),
    ...(isPrivate ? { isPrivate: true } : {}),
  };
}
