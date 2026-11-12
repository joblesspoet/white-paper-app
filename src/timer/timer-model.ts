/**
 * Pure state machine for the floating classroom timer and stopwatch.
 */

import {
  createStickyObject,
  DEFAULT_STICKY_COLOR,
  type DocumentCommand,
  type StickyObject,
} from '../canvas/document.ts';
import type { Point } from '../canvas/viewport';

export type TimerMode = 'countdown' | 'stopwatch';
export type TimerStatus = 'idle' | 'running' | 'paused' | 'completed';

export type TimerState = {
  mode: TimerMode;
  status: TimerStatus;
  durationMs: number;
  remainingMs: number;
  elapsedMs: number;
  laps: readonly number[];
};

export const TIMER_PRESETS_SECONDS = [60, 180, 300, 600, 900] as const;
export const DEFAULT_TIMER_DURATION_MS = 5 * 60 * 1000;
export const MAX_TIMER_DURATION_MS = 99 * 60 * 1000 + 59 * 1000;

export function createTimerState(durationMs = DEFAULT_TIMER_DURATION_MS): TimerState {
  const clamped = Math.max(0, Math.min(MAX_TIMER_DURATION_MS, Math.round(durationMs)));
  return {
    mode: 'countdown',
    status: 'idle',
    durationMs: clamped,
    remainingMs: clamped,
    elapsedMs: 0,
    laps: [],
  };
}

export function setTimerMode(state: TimerState, mode: TimerMode): TimerState {
  if (state.mode === mode) return state;
  return {
    ...state,
    mode,
    status: 'idle',
  };
}

export function selectTimerPreset(state: TimerState, seconds: number): TimerState {
  const durationMs = Math.max(1000, Math.min(MAX_TIMER_DURATION_MS, Math.round(seconds * 1000)));
  return {
    ...state,
    mode: 'countdown',
    status: 'idle',
    durationMs,
    remainingMs: durationMs,
  };
}

export function startTimer(state: TimerState): TimerState {
  if (state.mode === 'countdown') {
    if (state.remainingMs <= 0) {
      if (state.durationMs <= 0) return state;
      return {
        ...state,
        status: 'running',
        remainingMs: state.durationMs,
      };
    }
    return { ...state, status: 'running' };
  }
  return { ...state, status: 'running' };
}

export function pauseTimer(state: TimerState): TimerState {
  if (state.status !== 'running') return state;
  return { ...state, status: 'paused' };
}

export function resetTimer(state: TimerState): TimerState {
  if (state.mode === 'countdown') {
    return {
      ...state,
      status: 'idle',
      remainingMs: state.durationMs,
    };
  }
  return {
    ...state,
    status: 'idle',
    elapsedMs: 0,
    laps: [],
  };
}

/**
 * Adjusts countdown time by `deltaMs` (e.g., +60_000 for +1m, -30_000 for -30s),
 * clamping to `[0, MAX_TIMER_DURATION_MS]`.
 */
export function adjustTimerDuration(state: TimerState, deltaMs: number): TimerState {
  if (state.mode !== 'countdown') return state;
  const nextRemaining = Math.max(0, Math.min(MAX_TIMER_DURATION_MS, state.remainingMs + deltaMs));
  const nextDuration = Math.max(nextRemaining, Math.min(MAX_TIMER_DURATION_MS, state.durationMs + deltaMs));
  const nextStatus: TimerStatus =
    nextRemaining === 0
      ? state.status === 'running'
        ? 'completed'
        : 'idle'
      : state.status === 'completed'
        ? 'paused'
        : state.status;
  return {
    ...state,
    durationMs: nextDuration,
    remainingMs: nextRemaining,
    status: nextStatus,
  };
}

export function tickTimer(state: TimerState, deltaMs: number): TimerState {
  if (state.status !== 'running' || deltaMs <= 0) return state;
  if (state.mode === 'countdown') {
    const nextRemaining = Math.max(0, state.remainingMs - deltaMs);
    if (nextRemaining === 0) {
      return {
        ...state,
        remainingMs: 0,
        status: 'completed',
      };
    }
    return {
      ...state,
      remainingMs: nextRemaining,
    };
  }

  return {
    ...state,
    elapsedMs: Math.min(MAX_TIMER_DURATION_MS, state.elapsedMs + deltaMs),
  };
}

export function recordLap(state: TimerState): TimerState {
  if (state.mode !== 'stopwatch') return state;
  return {
    ...state,
    laps: [...state.laps, state.elapsedMs],
  };
}

export function formatTimerMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatStopwatchMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function timerDisplayMs(state: TimerState): number {
  return state.mode === 'countdown' ? state.remainingMs : state.elapsedMs;
}

export function timerFormattedDisplay(state: TimerState): string {
  return state.mode === 'countdown'
    ? formatTimerMs(state.remainingMs)
    : formatStopwatchMs(state.elapsedMs);
}

export function timerProgress(state: TimerState): number {
  if (state.mode !== 'countdown' || state.durationMs <= 0) return 0;
  return Math.max(0, Math.min(1, state.remainingMs / state.durationMs));
}

export function formatTimerPinText(state: TimerState, label?: string): string {
  const timeText =
    state.mode === 'countdown'
      ? formatTimerMs(state.remainingMs > 0 ? state.remainingMs : state.durationMs)
      : formatStopwatchMs(state.elapsedMs);
  const prefix = state.mode === 'countdown' ? 'Timer' : 'Stopwatch';
  const suffix = label?.trim() ? ` — ${label.trim()}` : '';
  return `${prefix}: ${timeText}${suffix}`;
}

export function createTimerPinObject(
  state: TimerState,
  center: Point,
  id: string,
  colorKey: string = DEFAULT_STICKY_COLOR,
  label?: string,
): StickyObject {
  const base = createStickyObject({
    id,
    point: center,
    colorKey,
    fontWeight: 'bold',
  });
  return {
    ...base,
    text: formatTimerPinText(state, label),
  };
}

export function createTimerPinCommand(
  state: TimerState,
  center: Point,
  id: string,
  colorKey: string = DEFAULT_STICKY_COLOR,
  label?: string,
): DocumentCommand {
  return {
    type: 'object.insert',
    object: createTimerPinObject(state, center, id, colorKey, label),
  };
}
