/**
 * User-facing copy for the image source screen. Kept free of native imports so
 * the wording and permission states can be checked without a simulator.
 */

export type ImageSource = 'camera' | 'library';

export const IMAGE_SOURCE_COPY: Record<ImageSource, { title: string; action: string; hint: string }> = {
  camera: {
    title: 'Take a photo',
    action: 'Open camera',
    hint: 'Capture a whiteboard, sketch, or reference photo.',
  },
  library: {
    title: 'Choose from library',
    action: 'Open photos',
    hint: 'Pick an existing image from this device.',
  },
};

export function permissionDeniedMessage(source: ImageSource, canAskAgain: boolean): string {
  const permission = source === 'camera' ? 'Camera' : 'Photo library';
  return canAskAgain
    ? `${permission} access is needed to add an image.`
    : `${permission} access is off. Enable it in system Settings to add an image.`;
}

export function imagePickErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  return 'The image could not be opened. Try another photo.';
}

export function imageImportErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  return 'The image could not be saved on this device.';
}
