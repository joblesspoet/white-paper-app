/**
 * Share-sheet outcome classification.
 *
 * `expo-sharing.shareAsync` resolves to `void` on every platform and does not
 * expose a cancelled flag reliably. On iOS the sheet just closes; on Android
 * the intent resolves. So a share that returns without throwing is treated as
 * shared, and every thrown path is classified by its message.
 *
 * This module is pure so the classification is testable in Node without the
 * native module.
 */

export type ShareOutcome = 'shared' | 'cancelled' | 'unavailable' | 'failed';

export type ShareResult = {
  outcome: ShareOutcome;
  /** Human message for a success banner or an error alert. */
  message: string;
};

function isUnavailable(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes('not available') || message.includes('unavailable')) return true;
  }
  return false;
}

function isCancelled(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('cancel') ||
      message.includes('usercancel') ||
      message.includes('dismiss') ||
      message.includes('abort')
    );
  }
  return false;
}

/**
 * Classify a share result. A clean resolve is a share; a thrown error is
 * unavailable, cancelled, or a generic failure, in that order.
 */
export function classifyShareResult(error: unknown): ShareResult {
  if (error === undefined || error === null) {
    return {
      outcome: 'shared',
      message: 'Board exported. Choose where to send it.',
    };
  }
  if (isUnavailable(error)) {
    return {
      outcome: 'unavailable',
      message: 'Sharing is not available on this device.',
    };
  }
  if (isCancelled(error)) {
    return {
      outcome: 'cancelled',
      message: 'Share cancelled.',
    };
  }
  return {
    outcome: 'failed',
    message: error instanceof Error
      ? `The share sheet could not open: ${error.message}`
      : 'The share sheet could not open.',
  };
}

/** True when the user actually got the file off the device. */
export function wasShared(outcome: ShareOutcome): boolean {
  return outcome === 'shared';
}