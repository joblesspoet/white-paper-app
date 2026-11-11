/**
 * Local media store for imported images.
 *
 * The untouched original and every derived (cropped/rotated) copy are written
 * under the app's document directory. Canvas objects and `media_assets` rows
 * store paths relative to that directory, because an app container path can
 * change across reinstalls and updates.
 *
 * Working copies used by the crop screen live in the cache directory and are
 * deleted when the flow finishes; only the original and the placed copy are
 * durable.
 */

import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { ImageCrop, ImageRotation } from '../canvas/document.ts';
import {
  MAX_WORKING_DIMENSION,
  cropMetadata,
  ocrSourceSize,
  rotatedSize,
  safeBoardSegment,
  type PixelRect,
} from './image-crop.ts';

export { MAX_WORKING_DIMENSION, cropMetadata, safeBoardSegment };

const MEDIA_ROOT = 'media';
const WORKING_ROOT = 'flowcanvas-images';

export type StoredImageAsset = {
  assetId: string;
  /** Path relative to the document directory, for example `media/<board>/originals/x.jpg`. */
  storagePath: string;
  /** Absolute URI for the current app container. */
  uri: string;
  mimeType: string;
  bytes: number;
  width: number;
  height: number;
};

export type WorkingImage = {
  /** Cache URI; not durable. */
  uri: string;
  width: number;
  height: number;
  mimeType: string;
};

function randomId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function ensureDirectory(directory: Directory): void {
  if (!directory.exists) directory.create({ intermediates: true, idempotent: true });
}

function mediaRoot(): Directory {
  const directory = new Directory(Paths.document, MEDIA_ROOT);
  ensureDirectory(directory);
  return directory;
}

function workingRoot(): Directory {
  const directory = new Directory(Paths.cache, WORKING_ROOT);
  ensureDirectory(directory);
  return directory;
}

function extensionFor(mimeType: string | undefined, fileName?: string | null): string {
  const known: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/heic': 'heic',
    'image/heif': 'heif',
  };
  if (mimeType && known[mimeType.toLowerCase()]) return known[mimeType.toLowerCase()];
  const fromName = fileName?.match(/\.([a-zA-Z0-9]+)$/)?.[1];
  return fromName ? fromName.toLowerCase() : 'jpg';
}

function formatForMime(mimeType: string | undefined): SaveFormat {
  return mimeType?.toLowerCase() === 'image/png' ? SaveFormat.PNG : SaveFormat.JPEG;
}

function mimeForFormat(format: SaveFormat): string {
  return format === SaveFormat.PNG ? 'image/png' : 'image/jpeg';
}

/** Absolute URI for a stored relative path in the current app container. */
export function resolveMediaUri(storagePath: string): string {
  return new File(Paths.document, ...storagePath.split('/')).uri;
}

/**
 * Copy an imported or generated file into the durable media store. The caller
 * decides whether it is an `originals` or `images` entry.
 */
export async function storeImageFile(input: {
  boardId: string;
  sourceUri: string;
  mimeType?: string;
  fileName?: string | null;
  folder: 'originals' | 'images';
  width: number;
  height: number;
  assetId?: string;
}): Promise<StoredImageAsset> {
  const assetId = input.assetId ?? `asset-${randomId()}`;
  const board = safeBoardSegment(input.boardId);
  const root = mediaRoot();
  const folder = new Directory(root, board, input.folder);
  ensureDirectory(folder);

  const extension = extensionFor(input.mimeType, input.fileName);
  const destination = new File(folder, `${assetId}.${extension}`);
  const source = new File(input.sourceUri);
  await source.copy(destination);

  const storagePath = `${MEDIA_ROOT}/${board}/${input.folder}/${destination.name}`;
  return {
    assetId,
    storagePath,
    uri: destination.uri,
    mimeType: input.mimeType ?? mimeForFormat(SaveFormat.JPEG),
    bytes: destination.size,
    width: Math.max(1, Math.round(input.width)),
    height: Math.max(1, Math.round(input.height)),
  };
}

/**
 * Downsample the picked file into a cache working copy. This also normalises
 * formats that the crop pipeline cannot reliably decode, and keeps peak memory
 * bounded for very large camera images.
 */
export async function prepareWorkingImage(
  sourceUri: string,
  mimeType?: string,
): Promise<WorkingImage> {
  const format = formatForMime(mimeType);
  const context = ImageManipulator.manipulate(sourceUri, {
    maxWidth: MAX_WORKING_DIMENSION,
    maxHeight: MAX_WORKING_DIMENSION,
  });
  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({ compress: 0.95, format });
  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
    mimeType: mimeForFormat(format),
  };
}

/** Rotate the working copy a quarter-turn clockwise. */
export async function rotateWorkingImage(
  workingUri: string,
  rotation: ImageRotation = 90,
): Promise<WorkingImage> {
  const context = ImageManipulator.manipulate(workingUri, {
    maxWidth: MAX_WORKING_DIMENSION,
    maxHeight: MAX_WORKING_DIMENSION,
  });
  context.rotate(rotation);
  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({ compress: 0.95, format: SaveFormat.JPEG });
  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
    mimeType: 'image/jpeg',
  };
}

/** Crop the working copy to an integer pixel rectangle. */
export async function cropWorkingImage(
  workingUri: string,
  crop: PixelRect,
  mimeType?: string,
): Promise<WorkingImage> {
  const format = formatForMime(mimeType);
  const context = ImageManipulator.manipulate(workingUri, {
    maxWidth: MAX_WORKING_DIMENSION,
    maxHeight: MAX_WORKING_DIMENSION,
  });
  context.crop({
    originX: Math.max(0, Math.round(crop.x)),
    originY: Math.max(0, Math.round(crop.y)),
    width: Math.max(1, Math.round(crop.width)),
    height: Math.max(1, Math.round(crop.height)),
  });
  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({ compress: 0.92, format });
  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
    mimeType: mimeForFormat(format),
  };
}

/**
 * Build the recognizer's private copy from the sharpest pixels available.
 *
 * The placed asset is a compressed JPEG, so OCR gets a lossless PNG of the same
 * crop instead: rotate → crop → enlarge small crops. The caller picks the
 * source (the untouched original while it still matches the working size,
 * otherwise the rotated working copy); the file is deleted with the flow's
 * other cache files.
 */
export async function prepareOcrImage(input: {
  sourceUri: string;
  sourceWidth: number;
  sourceHeight: number;
  /** Clockwise rotation applied before cropping; 0 when the source is already rotated. */
  rotation?: ImageRotation;
  /** Crop rectangle in rotated source pixels; omitted for the whole image. */
  crop?: PixelRect | null;
}): Promise<WorkingImage> {
  const rotation = input.rotation ?? 0;
  const rotated = rotatedSize(input.sourceWidth, input.sourceHeight, rotation);
  const originX = Math.min(
    Math.max(0, Math.round(input.crop?.x ?? 0)),
    Math.max(0, rotated.width - 1),
  );
  const originY = Math.min(
    Math.max(0, Math.round(input.crop?.y ?? 0)),
    Math.max(0, rotated.height - 1),
  );
  const cropWidth = Math.max(
    1,
    Math.min(rotated.width - originX, Math.round(input.crop?.width ?? rotated.width)),
  );
  const cropHeight = Math.max(
    1,
    Math.min(rotated.height - originY, Math.round(input.crop?.height ?? rotated.height)),
  );
  const fullImage =
    originX === 0 && originY === 0 && cropWidth === rotated.width && cropHeight === rotated.height;
  const target = ocrSourceSize(cropWidth, cropHeight);

  // The caller only passes sources that are already capped at
  // MAX_WORKING_DIMENSION, so decoding at full size stays bounded.
  const context = ImageManipulator.manipulate(input.sourceUri);
  if (rotation !== 0) context.rotate(rotation);
  if (!fullImage) context.crop({ originX, originY, width: cropWidth, height: cropHeight });
  if (target.width !== cropWidth || target.height !== cropHeight) {
    context.resize({ width: target.width, height: target.height });
  }

  const rendered = await context.renderAsync();
  // PNG is lossless: no second JPEG pass on the pixels the recognizer reads.
  const result = await rendered.saveAsync({ format: SaveFormat.PNG });
  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
    mimeType: 'image/png',
  };
}

/** Delete a cache or document file. Missing files are not an error. */
export async function deleteFile(uri: string): Promise<void> {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Cleanup is best effort; an orphaned cache file is harmless.
  }
}

export async function deleteStoredAsset(storagePath: string): Promise<void> {
  await deleteFile(resolveMediaUri(storagePath));
}
