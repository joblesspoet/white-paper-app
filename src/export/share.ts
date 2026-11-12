/**
 * Native share-sheet wrapper.
 *
 * `expo-sharing` is the only dependency here. The wrapper keeps the rest of the
 * app free of its types and lets the pure classifier in `share-outcome.ts`
 * stay testable.
 */

import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { classifyShareResult, type ShareResult } from './share-outcome';

export type ShareInput = {
  uri: string;
  mimeType?: string;
  uti?: string;
  dialogTitle?: string;
};

/** True when the native share sheet exists on this device. */
export async function isShareAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return await Sharing.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Open the share sheet for a local file. Resolves to a classified outcome
 * instead of throwing, so callers can show a banner instead of an alert.
 */
export async function shareFile(input: ShareInput): Promise<ShareResult> {
  try {
    await Sharing.shareAsync(input.uri, {
      mimeType: input.mimeType,
      UTI: input.uti,
      dialogTitle: input.dialogTitle,
    });
    return classifyShareResult(null);
  } catch (error) {
    return classifyShareResult(error);
  }
}

export { classifyShareResult, type ShareOutcome, type ShareResult } from './share-outcome';