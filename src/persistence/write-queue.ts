/**
 * One process-wide write queue for the local board store.
 *
 * Board creation, title edits, autosave, and viewport saves can all be in flight
 * at once (for example when Home creates a board and immediately opens the
 * editor). SQLite serializes statements, but not the read-then-write logic in
 * our repository, so queue the whole task instead.
 */
let tail: Promise<unknown> = Promise.resolve();

export function enqueuePersistenceWrite<T>(task: () => Promise<T>): Promise<T> {
  const result = tail.then(task);
  // Keep the chain alive after a failed write so later edits can still retry.
  tail = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

/** Wait for every write queued so far; used before a deliberate reload. */
export function whenPersistenceWritesSettled(): Promise<void> {
  return tail.then(
    () => undefined,
    () => undefined,
  );
}
