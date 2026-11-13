/**
 * Pure cross-platform permission policy helpers for iOS and Android API levels.
 * Kept free of React Native imports so it can be unit-tested in plain Node.
 */

export type PermissionKind = 'camera' | 'microphone' | 'media-export';
export type PermissionOutcomeStatus = 'granted' | 'denied' | 'blocked';

export type PermissionCheckResult = {
  granted: boolean;
  canAskAgain: boolean;
  status: PermissionOutcomeStatus;
  message?: string;
};

/**
 * Normalizes `Platform.Version` on Android (number on modern RN, string on some
 * older builds/tests) into an integer API level.
 */
export function parseAndroidApiLevel(version: string | number | undefined | null): number {
  if (typeof version === 'number' && Number.isFinite(version)) return Math.floor(version);
  if (typeof version === 'string') {
    const parsed = Number.parseInt(version, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 33;
}

/**
 * Returns the Android runtime permissions needed when exporting/saving a
 * recorded lesson video to shared device storage across Android versions:
 * - Android 13+ (API 33+): scoped `READ_MEDIA_VIDEO` & `READ_MEDIA_AUDIO`
 * - Android 10–12 (API 29–32): `READ_EXTERNAL_STORAGE` (scoped storage writes via MediaStore/SAF)
 * - Android <= 9 (API <= 28): `READ_EXTERNAL_STORAGE` & `WRITE_EXTERNAL_STORAGE`
 */
export function requiredAndroidMediaPermissions(apiLevel: number): string[] {
  if (apiLevel >= 33) {
    return [
      'android.permission.READ_MEDIA_VIDEO',
      'android.permission.READ_MEDIA_AUDIO',
    ];
  }
  if (apiLevel >= 29) {
    return ['android.permission.READ_EXTERNAL_STORAGE'];
  }
  return [
    'android.permission.READ_EXTERNAL_STORAGE',
    'android.permission.WRITE_EXTERNAL_STORAGE',
  ];
}

export function permissionDeniedCopy(kind: PermissionKind, canAskAgain: boolean): string {
  const label =
    kind === 'camera'
      ? 'Camera'
      : kind === 'microphone'
        ? 'Microphone'
        : 'Media storage';
  const purpose =
    kind === 'camera'
      ? 'show your Face-Cam bubble'
      : kind === 'microphone'
        ? 'record voice narration'
        : 'save recorded lessons';
  return canAskAgain
    ? `${label} access is needed to ${purpose}.`
    : `${label} access is off. Enable it in system Settings to ${purpose}.`;
}

export function classifyPermissionOutcome(
  kind: PermissionKind,
  granted: boolean,
  canAskAgain: boolean,
): PermissionCheckResult {
  if (granted) {
    return { granted: true, canAskAgain: true, status: 'granted' };
  }
  return {
    granted: false,
    canAskAgain,
    status: canAskAgain ? 'denied' : 'blocked',
    message: permissionDeniedCopy(kind, canAskAgain),
  };
}
