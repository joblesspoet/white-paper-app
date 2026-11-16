/**
 * TEMPORARY debugging probe. Forwards a line to a listener on the host
 * (10.0.2.2 is the Android emulator alias for the host machine) so we can see
 * exactly how far JS gets before the Live Classroom sheet freezes.
 *
 * Delete this file once the freeze is fixed.
 */
export function fcprobe(message: string): void {
  try {
    void fetch(
      `http://127.0.0.1:9099/log?m=${encodeURIComponent(`${Date.now()} ${message}`)}`,
    ).catch(() => undefined);
  } catch {
    // Never let a debug probe break the app.
  }
}
