/**
 * Pure crop geometry for the image import flow.
 *
 * The crop screen displays an image inside a fixed frame. Panning and zooming
 * move that image behind the frame; the visible frame rectangle is the crop.
 * All maths is in image pixels, so the result can be handed straight to the
 * image manipulator without depending on screen size or device pixel ratio.
 */

import type { ImageCrop, ImageRotation } from '../canvas/document.ts';

export type { ImageCrop, ImageRotation };

export type PixelSize = { width: number; height: number };
export type PixelRect = { x: number; y: number; width: number; height: number };
export type CropTransform = {
  /** Displayed pixels per source pixel. Never below the cover scale. */
  scale: number;
  /** Displayed image top-left relative to the crop frame top-left. */
  translateX: number;
  translateY: number;
};

/** The crop viewport can zoom in this much beyond the initial cover fit. */
export const CROP_MAX_ZOOM = 4;

/** Large camera images are decoded at no more than this on either side. */
export const MAX_WORKING_DIMENSION = 4096;

/** Board ids are generated locally, but never let one escape the media folder. */
export function safeBoardSegment(boardId: string): string {
  const safe = boardId.replace(/[^a-zA-Z0-9._-]/g, '_');
  return safe.length > 0 ? safe : 'board';
}

/** Crop metadata paired with the placed asset, for `media_assets.metadata_json`. */
export function cropMetadata(
  crop: ImageCrop,
  originalAssetId: string,
  source: string,
  placed: { width: number; height: number },
): Record<string, unknown> {
  return {
    kind: 'placed',
    source,
    originalAssetId,
    crop: {
      x: crop.x,
      y: crop.y,
      width: crop.width,
      height: crop.height,
      rotation: crop.rotation,
    },
    width: placed.width,
    height: placed.height,
  };
}

export const IMAGE_ROTATIONS: readonly ImageRotation[] = [0, 90, 180, 270];

export function isImageRotation(value: unknown): value is ImageRotation {
  return value === 0 || value === 90 || value === 180 || value === 270;
}

/** Next clockwise quarter-turn. */
export function nextRotation(rotation: ImageRotation): ImageRotation {
  return ((rotation + 90) % 360) as ImageRotation;
}

/** Size of an image after a clockwise quarter-turn. */
export function rotatedSize(width: number, height: number, rotation: ImageRotation): PixelSize {
  return rotation === 90 || rotation === 270
    ? { width: height, height: width }
    : { width, height };
}

function positive(value: number, fallback = 1): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/** Scale at which the image exactly covers the frame. */
export function coverScale(
  imageWidth: number,
  imageHeight: number,
  frameWidth: number,
  frameHeight: number,
): number {
  const width = positive(imageWidth);
  const height = positive(imageHeight);
  return Math.max(positive(frameWidth) / width, positive(frameHeight) / height);
}

/** Centre the image at the smallest scale that leaves no blank frame area. */
export function fitImageInFrame(
  imageWidth: number,
  imageHeight: number,
  frameWidth: number,
  frameHeight: number,
): CropTransform {
  const scale = coverScale(imageWidth, imageHeight, frameWidth, frameHeight);
  return {
    scale,
    translateX: (frameWidth - imageWidth * scale) / 2,
    translateY: (frameHeight - imageHeight * scale) / 2,
  };
}

/**
 * Keep the image covering the frame. The image may never be smaller than the
 * frame, and its edges may never move inside the frame, so a crop can never
 * include transparent padding.
 */
export function clampCropTransform(
  transform: CropTransform,
  imageWidth: number,
  imageHeight: number,
  frameWidth: number,
  frameHeight: number,
  maxZoom = CROP_MAX_ZOOM,
): CropTransform {
  const minimum = coverScale(imageWidth, imageHeight, frameWidth, frameHeight);
  const scale = clamp(
    Number.isFinite(transform.scale) ? transform.scale : minimum,
    minimum,
    minimum * Math.max(1, maxZoom),
  );
  const displayWidth = imageWidth * scale;
  const displayHeight = imageHeight * scale;
  return {
    scale,
    translateX: clamp(transform.translateX, frameWidth - displayWidth, 0),
    translateY: clamp(transform.translateY, frameHeight - displayHeight, 0),
  };
}

/**
 * Scale around a focal point in frame coordinates, then clamp. Used by the
 * pinch gesture and by any future zoom buttons so both share one implementation.
 */
export function zoomCropTransform(
  transform: CropTransform,
  nextScale: number,
  focalX: number,
  focalY: number,
  imageWidth: number,
  imageHeight: number,
  frameWidth: number,
  frameHeight: number,
  maxZoom = CROP_MAX_ZOOM,
): CropTransform {
  const current = clampCropTransform(
    transform,
    imageWidth,
    imageHeight,
    frameWidth,
    frameHeight,
    maxZoom,
  );
  const anchorX = (focalX - current.translateX) / current.scale;
  const anchorY = (focalY - current.translateY) / current.scale;
  return clampCropTransform(
    {
      scale: nextScale,
      translateX: focalX - anchorX * nextScale,
      translateY: focalY - anchorY * nextScale,
    },
    imageWidth,
    imageHeight,
    frameWidth,
    frameHeight,
    maxZoom,
  );
}

/**
 * Convert the visible frame back into integer pixel coordinates. Values are
 * clamped so a rounding error can never request a rectangle outside the image.
 */
export function cropRectFromTransform(
  transform: CropTransform,
  imageWidth: number,
  imageHeight: number,
  frameWidth: number,
  frameHeight: number,
  maxZoom = CROP_MAX_ZOOM,
): PixelRect {
  const safe = clampCropTransform(
    transform,
    imageWidth,
    imageHeight,
    frameWidth,
    frameHeight,
    maxZoom,
  );
  const width = positive(imageWidth);
  const height = positive(imageHeight);
  const x = clamp(Math.round(-safe.translateX / safe.scale), 0, Math.max(0, width - 1));
  const y = clamp(Math.round(-safe.translateY / safe.scale), 0, Math.max(0, height - 1));
  return {
    x,
    y,
    width: clamp(Math.round(frameWidth / safe.scale), 1, Math.max(1, width - x)),
    height: clamp(Math.round(frameHeight / safe.scale), 1, Math.max(1, height - y)),
  };
}

/** True when the crop keeps the whole rotated image, within one pixel. */
export function isFullImageCrop(
  crop: PixelRect,
  imageWidth: number,
  imageHeight: number,
): boolean {
  return (
    crop.x <= 0 &&
    crop.y <= 0 &&
    crop.x + crop.width >= imageWidth - 1 &&
    crop.y + crop.height >= imageHeight - 1
  );
}

/** Build the stored crop metadata from a screen result. */
export function toImageCrop(
  crop: PixelRect,
  rotation: ImageRotation,
): ImageCrop {
  return {
    x: Math.max(0, Math.round(crop.x)),
    y: Math.max(0, Math.round(crop.y)),
    width: Math.max(1, Math.round(crop.width)),
    height: Math.max(1, Math.round(crop.height)),
    rotation,
  };
}
