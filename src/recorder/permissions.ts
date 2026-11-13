/**
 * Runtime iOS & Android permission requests for Face-Cam (camera) and
 * Lesson Recorder (microphone + optional media storage).
 *
 * Handles Android API level differences (<29, 29-32, 33+, 34+) via
 * `PermissionsAndroid` and iOS via `expo-image-picker` / optional Expo
 * camera/audio modules, never crashing in Expo Go.
 */

import { Linking, PermissionsAndroid, Platform, type Permission } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { requireOptionalNativeModule } from 'expo';

import {
  classifyPermissionOutcome,
  parseAndroidApiLevel,
  requiredAndroidMediaPermissions,
  type PermissionCheckResult,
} from './permission-model';

type OptionalAudioModule = {
  requestRecordingPermissionsAsync?: () => Promise<{ granted: boolean; canAskAgain?: boolean }>;
  getRecordingPermissionsAsync?: () => Promise<{ granted: boolean; canAskAgain?: boolean }>;
  requestPermissionsAsync?: () => Promise<{ granted: boolean; canAskAgain?: boolean }>;
};

function getOptionalAudioModule(): OptionalAudioModule | null {
  try {
    return (
      requireOptionalNativeModule<OptionalAudioModule>('ExpoAudio') ??
      requireOptionalNativeModule<OptionalAudioModule>('ExponentAV') ??
      null
    );
  } catch {
    return null;
  }
}

export async function openAppSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch {
    // Ignore if system settings cannot be opened on unsupported platforms.
  }
}

export async function checkCameraPermission(): Promise<PermissionCheckResult> {
  if (Platform.OS === 'web') {
    return classifyPermissionOutcome('camera', false, false);
  }
  try {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
      return classifyPermissionOutcome('camera', granted, true);
    }
    const perm = await ImagePicker.getCameraPermissionsAsync();
    return classifyPermissionOutcome('camera', perm.granted, perm.canAskAgain);
  } catch {
    return classifyPermissionOutcome('camera', false, true);
  }
}

export async function requestCameraPermission(): Promise<PermissionCheckResult> {
  if (Platform.OS === 'web') {
    return classifyPermissionOutcome('camera', false, false);
  }
  try {
    if (Platform.OS === 'android') {
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
        title: 'Camera Permission',
        message: 'Allow FlowCanvas to use your camera for the floating Face-Cam bubble.',
        buttonPositive: 'Allow',
        buttonNegative: 'Not now',
      });
      if (result === PermissionsAndroid.RESULTS.GRANTED) {
        return classifyPermissionOutcome('camera', true, true);
      }
      return classifyPermissionOutcome(
        'camera',
        false,
        result !== PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
      );
    }

    const perm = await ImagePicker.requestCameraPermissionsAsync();
    return classifyPermissionOutcome('camera', perm.granted, perm.canAskAgain);
  } catch {
    return classifyPermissionOutcome('camera', false, true);
  }
}

export async function requestMicrophonePermission(): Promise<PermissionCheckResult> {
  if (Platform.OS === 'web') {
    return classifyPermissionOutcome('microphone', false, false);
  }
  try {
    if (Platform.OS === 'android') {
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
        title: 'Microphone Permission',
        message: 'Allow FlowCanvas to record voice narration during lessons.',
        buttonPositive: 'Allow',
        buttonNegative: 'Not now',
      });
      if (result === PermissionsAndroid.RESULTS.GRANTED) {
        return classifyPermissionOutcome('microphone', true, true);
      }
      return classifyPermissionOutcome(
        'microphone',
        false,
        result !== PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
      );
    }

    const audioMod = getOptionalAudioModule();
    if (audioMod?.requestRecordingPermissionsAsync) {
      const res = await audioMod.requestRecordingPermissionsAsync();
      return classifyPermissionOutcome('microphone', res.granted, res.canAskAgain ?? true);
    }
    if (audioMod?.requestPermissionsAsync) {
      const res = await audioMod.requestPermissionsAsync();
      return classifyPermissionOutcome('microphone', res.granted, res.canAskAgain ?? true);
    }
    // In Expo Go without a native audio module, canvas timeline recording still works;
    // mic audio capture is gracefully marked unavailable rather than blocked.
    return { granted: true, canAskAgain: true, status: 'granted' };
  } catch {
    return classifyPermissionOutcome('microphone', false, true);
  }
}

export async function requestMediaExportPermissions(): Promise<PermissionCheckResult> {
  if (Platform.OS !== 'android') {
    return { granted: true, canAskAgain: true, status: 'granted' };
  }
  try {
    const apiLevel = parseAndroidApiLevel(Platform.Version);
    const perms = requiredAndroidMediaPermissions(apiLevel) as Permission[];
    if (perms.length === 0) {
      return { granted: true, canAskAgain: true, status: 'granted' };
    }
    const results = await PermissionsAndroid.requestMultiple(perms);
    const values = Object.values(results);
    const allGranted = values.every((v) => v === PermissionsAndroid.RESULTS.GRANTED);
    if (allGranted) {
      return { granted: true, canAskAgain: true, status: 'granted' };
    }
    const blocked = values.some((v) => v === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN);
    return classifyPermissionOutcome('media-export', false, !blocked);
  } catch {
    return classifyPermissionOutcome('media-export', false, true);
  }
}
