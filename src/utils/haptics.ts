import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

type NativeHapticsModule = {
  notificationAsync?: (type: string) => Promise<void>;
  selectionAsync?: () => Promise<void>;
  impactAsync?: (style: string) => Promise<void>;
};

let hapticsModule: NativeHapticsModule | null | undefined = undefined;

function getHapticsModule(): NativeHapticsModule | null {
  if (hapticsModule !== undefined) return hapticsModule;
  if (Platform.OS === 'web') {
    hapticsModule = null;
    return null;
  }
  try {
    hapticsModule = requireOptionalNativeModule<NativeHapticsModule>('ExpoHaptics');
  } catch {
    hapticsModule = null;
  }
  return hapticsModule;
}

export async function triggerHapticFeedback(
  type: 'selection' | 'impact' | 'warning' | 'error' = 'selection',
  enabled = true,
): Promise<void> {
  if (!enabled) return;
  try {
    const module = getHapticsModule();
    if (!module) return;
    if (type === 'selection' && typeof module.selectionAsync === 'function') {
      await module.selectionAsync();
    } else if (type === 'impact' && typeof module.impactAsync === 'function') {
      await module.impactAsync('light');
    } else if (type === 'warning' && typeof module.notificationAsync === 'function') {
      await module.notificationAsync('warning');
    } else if (type === 'error' && typeof module.notificationAsync === 'function') {
      await module.notificationAsync('error');
    }
  } catch {
    // Non-critical; ignore.
  }
}
