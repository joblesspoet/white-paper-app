/**
 * Command-based undo/redo.
 *
 * Every board mutation is expressed as a command that knows how to both apply
 * itself and revert itself. The history stores those commands, never copies of
 * the whole document, so undo is one inverse operation instead of a snapshot
 * restore.
 *
 * A gesture that produces many intermediate states (a drag, an eraser sweep)
 * runs its commands as transient changes. They are collected in `pending` and
 * committed as one batched command, so undo steps over the whole gesture rather
 * than one pointer sample.
 */

/** Older commands are dropped so a long session cannot grow without bound. */
export const HISTORY_LIMIT = 100;

export type CommandType = 'create' | 'update' | 'delete' | 'batch';

export type HistoryCommand<T> = {
  /** What the command does, kept explicit for tests, labels, and sync later. */
  type: CommandType;
  /** Human-readable description; used by the toolbar's accessibility hints. */
  label?: string;
  apply(document: T): T;
  revert(document: T): T;
  /**
   * Fold a follow-up transient command into this one. Used by drags so a long
   * gesture stores one move command, not one per pointer sample. Returning
   * undefined means the commands cannot be combined.
   */
  merge?(next: HistoryCommand<T>): HistoryCommand<T> | undefined;
};

export type History<T> = {
  past: HistoryCommand<T>[];
  present: T;
  future: HistoryCommand<T>[];
  /** Commands collected during the current transient gesture. */
  pending: HistoryCommand<T>[] | null;
  /** The document before the first transient command of the open gesture. */
  pendingPresent: T | null;
  /** Used to drop a gesture that ends exactly where it started. */
  equals: (left: T, right: T) => boolean;
};

export function createHistory<T>(
  present: T,
  equals: (left: T, right: T) => boolean = Object.is,
): History<T> {
  return { past: [], present, future: [], pending: null, pendingPresent: null, equals };
}

function pushPast<T>(past: HistoryCommand<T>[], entry: HistoryCommand<T>): HistoryCommand<T>[] {
  const next = [...past, entry];
  return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next;
}

/** Collect several commands into the single entry one undo step should remove. */
export function batchCommand<T>(commands: readonly HistoryCommand<T>[]): HistoryCommand<T> {
  if (commands.length === 1) return commands[0];
  return {
    type: 'batch',
    label: `${commands.length} changes`,
    apply(document) {
      return commands.reduce((state, command) => command.apply(state), document);
    },
    revert(document) {
      return [...commands]
        .reverse()
        .reduce((state, command) => command.revert(state), document);
    },
  };
}

/**
 * Apply one command. Pass `transient` for intermediate states of an open
 * gesture: the command is held in `pending` until `commitChange` groups it with
 * the rest of the gesture. A command that leaves the document unchanged is
 * ignored, so it cannot create an empty undo step.
 */
export function executeCommand<T>(
  history: History<T>,
  command: HistoryCommand<T>,
  transient = false,
): History<T> {
  const next = command.apply(history.present);
  if (next === history.present) return history;

  if (transient) {
    let pending = history.pending ? [...history.pending] : [];
    const previous = pending[pending.length - 1];
    const merged = previous?.merge?.(command);
    if (merged) pending[pending.length - 1] = merged;
    else pending = [...pending, command];
    return {
      past: history.past,
      present: next,
      future: history.future,
      pending,
      pendingPresent: history.pendingPresent ?? history.present,
      equals: history.equals,
    };
  }

  // A committed command that follows transient changes belongs to the same
  // user action; keep it in one undo entry.
  const commands = history.pending ? [...history.pending, command] : [command];
  return {
    past: pushPast(history.past, batchCommand(commands)),
    present: next,
    future: [],
    pending: null,
    pendingPresent: null,
    equals: history.equals,
  };
}

/**
 * Close an open gesture. A gesture that ended where it started leaves no undo
 * step and keeps the redo stack intact.
 */
export function commitChange<T>(history: History<T>): History<T> {
  const pending = history.pending;
  if (!pending || pending.length === 0) return history;
  if (history.pendingPresent !== null && history.equals(history.pendingPresent, history.present)) {
    return { ...history, pending: null, pendingPresent: null };
  }
  return {
    past: pushPast(history.past, batchCommand(pending)),
    present: history.present,
    future: [],
    pending: null,
    pendingPresent: null,
    equals: history.equals,
  };
}

export function undo<T>(history: History<T>): History<T> {
  const committed = commitChange(history);
  const command = committed.past[committed.past.length - 1];
  if (!command) return history;
  return {
    past: committed.past.slice(0, -1),
    present: command.revert(committed.present),
    future: [command, ...committed.future],
    pending: null,
    pendingPresent: null,
    equals: committed.equals,
  };
}

export function redo<T>(history: History<T>): History<T> {
  const committed = commitChange(history);
  const command = committed.future[0];
  if (!command) return committed;
  return {
    past: pushPast(committed.past, command),
    present: command.apply(committed.present),
    future: committed.future.slice(1),
    pending: null,
    pendingPresent: null,
    equals: committed.equals,
  };
}

function pendingHasChanges<T>(history: History<T>): boolean {
  return (
    history.pending !== null &&
    history.pending.length > 0 &&
    history.pendingPresent !== null &&
    !history.equals(history.pendingPresent, history.present)
  );
}

export function canUndo<T>(history: History<T>): boolean {
  return history.past.length > 0 || pendingHasChanges(history);
}

/** Redo is only available when no unfinished gesture is changing the board. */
export function canRedo<T>(history: History<T>): boolean {
  return history.future.length > 0 && !pendingHasChanges(history);
}

/** Label for the next undo, for toolbar hints and future history menus. */
export function nextUndoLabel<T>(history: History<T>): string | null {
  if (pendingHasChanges(history) && history.pending) return batchCommand(history.pending).label ?? null;
  return history.past[history.past.length - 1]?.label ?? null;
}

/** Label for the next redo, for toolbar hints and future history menus. */
export function nextRedoLabel<T>(history: History<T>): string | null {
  return history.future[0]?.label ?? null;
}
