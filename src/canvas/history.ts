/**
 * Undo/redo history for immutable documents.
 *
 * Undo entries are document snapshots rather than inverse commands: a board
 * document is small, and snapshots make every command undoable without writing
 * and maintaining a matching inverse for each one.
 *
 * A gesture that produces many intermediate states (a drag, an eraser sweep) is
 * applied as transient changes and keeps one checkpoint: the document as it was
 * before the gesture started. Committing the gesture pushes that single
 * checkpoint, so undo steps over the whole gesture instead of one sample.
 */

/** Older snapshots are dropped so a long session cannot grow without bound. */
export const HISTORY_LIMIT = 100;

export type History<T> = {
  past: T[];
  present: T;
  future: T[];
  /** Document captured before the first transient change of an open gesture. */
  pending: T | null;
};

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], pending: null };
}

function pushPast<T>(past: T[], entry: T): T[] {
  const next = [...past, entry];
  return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next;
}

/**
 * Record a new document state. Pass `transient` for intermediate states of an
 * open gesture: the first transient change takes the checkpoint, later ones
 * only move `present`. A state identical to the current one is ignored so a
 * command that changed nothing cannot create an empty undo step.
 */
export function applyChange<T>(history: History<T>, next: T, transient = false): History<T> {
  if (next === history.present) return history;
  if (!transient) {
    return {
      past: pushPast(history.past, history.pending ?? history.present),
      present: next,
      future: [],
      pending: null,
    };
  }
  return {
    past: history.past,
    present: next,
    future: history.future,
    pending: history.pending ?? history.present,
  };
}

/**
 * Close an open gesture. A gesture that ended where it started leaves no undo
 * step and keeps the redo stack intact.
 */
export function commitChange<T>(history: History<T>): History<T> {
  const pending = history.pending;
  if (pending === null) return history;
  if (pending === history.present) return { ...history, pending: null };
  return {
    past: pushPast(history.past, pending),
    present: history.present,
    future: [],
    pending: null,
  };
}

export function undo<T>(history: History<T>): History<T> {
  const committed = commitChange(history);
  const previous = committed.past[committed.past.length - 1];
  if (!previous) return history;
  return {
    past: committed.past.slice(0, -1),
    present: previous,
    future: [committed.present, ...committed.future],
    pending: null,
  };
}

export function redo<T>(history: History<T>): History<T> {
  const next = history.future[0];
  if (!next) return history;
  return {
    past: pushPast(history.past, history.present),
    present: next,
    future: history.future.slice(1),
    pending: null,
  };
}

export function canUndo<T>(history: History<T>): boolean {
  return history.past.length > 0 || history.pending !== null;
}

export function canRedo<T>(history: History<T>): boolean {
  return history.future.length > 0;
}
