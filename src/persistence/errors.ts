import { LocalStoreVersionError } from './database.ts';

/**
 * A storage failure must never crash the canvas. The UI shows this message and
 * keeps the in-memory document usable; the next edit retries the write.
 */
export function storageErrorMessage(error: unknown): string {
  if (error instanceof LocalStoreVersionError) return error.message;
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  return 'The local board store could not be opened.';
}
