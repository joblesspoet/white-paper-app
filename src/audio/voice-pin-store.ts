/**
 * Durable local storage for Spatial Voice-Pin audio clips (`media/<boardId>/audio/<assetId>.m4a`).
 */

import { Directory, File, Paths } from 'expo-file-system';

import { safeBoardSegment } from '../media/image-crop';
import {
  DEFAULT_VOICE_PIN_COLOR,
  MAX_VOICE_PIN_DURATION_MS,
  VOICE_PIN_HEIGHT,
  VOICE_PIN_PEAK_COUNT,
  VOICE_PIN_WIDTH,
  createVoicePinObject,
  formatVoiceDuration,
  normalizeWaveformPeaks,
  voicePinStoragePath,
  type CreateVoicePinInput,
} from './voice-pin-model';

export {
  DEFAULT_VOICE_PIN_COLOR,
  MAX_VOICE_PIN_DURATION_MS,
  VOICE_PIN_HEIGHT,
  VOICE_PIN_PEAK_COUNT,
  VOICE_PIN_WIDTH,
  createVoicePinObject,
  formatVoiceDuration,
  normalizeWaveformPeaks,
  voicePinStoragePath,
  type CreateVoicePinInput,
};

const MEDIA_ROOT = 'media';

export type StoredAudioAsset = {
  assetId: string;
  storagePath: string;
  uri: string;
  mimeType: string;
  bytes: number;
};

function randomAudioAssetId(): string {
  return `voice-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function ensureAudioDirectory(boardId: string): Directory {
  const safeBoard = safeBoardSegment(boardId);
  const dir = new Directory(Paths.document, MEDIA_ROOT, safeBoard, 'audio');
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

export function resolveVoicePinUri(storagePath: string): string {
  return new File(Paths.document, ...storagePath.split('/')).uri;
}

export async function storeVoicePinAudioFile(input: {
  boardId: string;
  sourceUri: string;
  assetId?: string;
  mimeType?: string;
  extension?: string;
}): Promise<StoredAudioAsset> {
  const assetId = input.assetId ?? randomAudioAssetId();
  const ext = input.extension ?? 'm4a';
  const dir = ensureAudioDirectory(input.boardId);
  const destination = new File(dir, `${assetId}.${ext}`);
  const source = new File(input.sourceUri);
  if (source.exists) {
    if (destination.exists) destination.delete();
    await source.copy(destination);
  }
  const storagePath = voicePinStoragePath(input.boardId, assetId, ext);
  return {
    assetId,
    storagePath,
    uri: destination.uri,
    mimeType: input.mimeType ?? 'audio/m4a',
    bytes: destination.exists ? (destination.size ?? 0) : 0,
  };
}

export async function deleteVoicePinAudioFile(storagePath: string): Promise<void> {
  try {
    const file = new File(Paths.document, ...storagePath.split('/'));
    if (file.exists) file.delete();
  } catch {
    // Cleanup is best effort.
  }
}
