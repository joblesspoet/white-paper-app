/**
 * Turn a reviewed recognition result into canvas objects.
 *
 * The image is always placeable. Recognition only enriches it: when usable
 * text exists it is attached to the source image and, if the user chose `text`,
 * a linked text block is created below the photo. An empty or failed result
 * therefore yields the same image with no text block.
 */

import {
  DEFAULT_TEXT_COLOR,
  DEFAULT_TEXT_FONT_SIZE,
  measureTextBlock,
  type ImageObject,
  type TextObject,
} from '../canvas/document.ts';
import {
  canAddRecognizedText,
  normalizeRecognizedText,
  type OcrReviewState,
} from './ocr-service.ts';

/** Canvas-space gap between an image and the text extracted from it. */
export const OCR_TEXT_GAP = 24;

export type OcrPlacementChoice = 'text' | 'image-only';

export type OcrPlacement = {
  image: ImageObject;
  text: TextObject | null;
};

/** Attach the reviewed text to the image so the extraction stays traceable. */
export function withRecognizedOcr(
  image: ImageObject,
  state: OcrReviewState,
  recognizedAt = new Date().toISOString(),
): ImageObject {
  if (!state.engine || !canAddRecognizedText(state)) return image;
  const text = normalizeRecognizedText(state.text);
  if (text.length === 0) return image;
  return {
    ...image,
    ocr: {
      text,
      engine: state.engine,
      regionCount: state.regionCount,
      recognizedAt,
    },
  };
}

/**
 * Place extracted text directly below its source image, at the image's width,
 * and record the image id on the text block. The text is a normal editable
 * canvas object; moving either object does not move the other.
 */
export function createOcrTextObject(
  image: ImageObject,
  state: OcrReviewState,
  id = `${image.id}-ocr`,
): TextObject | null {
  if (!canAddRecognizedText(state)) return null;
  const text = normalizeRecognizedText(state.text);
  if (text.length === 0) return null;
  const width = Math.max(160, Math.round(image.width));
  const fontSize = DEFAULT_TEXT_FONT_SIZE;
  return {
    id,
    type: 'text',
    text,
    x: image.x,
    y: image.y + image.height + OCR_TEXT_GAP,
    width,
    height: measureTextBlock(text, fontSize, width).height,
    rotation: 0,
    colorKey: DEFAULT_TEXT_COLOR,
    fontSize,
    fontWeight: 'normal',
    fontStyle: 'normal',
    sourceImageId: image.id,
  };
}

export function buildOcrPlacement(input: {
  image: ImageObject;
  state: OcrReviewState;
  choice: OcrPlacementChoice;
  textId?: string;
  recognizedAt?: string;
}): OcrPlacement {
  const image = withRecognizedOcr(input.image, input.state, input.recognizedAt);
  const text =
    input.choice === 'text'
      ? createOcrTextObject(image, input.state, input.textId)
      : null;
  return { image, text };
}
