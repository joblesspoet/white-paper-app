import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';

import { ImageCropScreen } from './ImageCropScreen';
import { ImageSourceSheet } from './ImageSourceSheet';
import { OcrReviewScreen } from './OcrReviewScreen';
import {
  deleteFile,
  deleteStoredAsset,
  prepareWorkingImage,
  resolveMediaUri,
  rotateWorkingImage,
  cropWorkingImage,
  storeImageFile,
  type StoredImageAsset,
  type WorkingImage,
} from '../media/asset-store';
import { imageImportErrorMessage, permissionDeniedMessage, type ImageSource } from '../media/image-source';
import { pickImage } from '../media/image-picker';
import { toImageCrop, type PixelRect } from '../media/image-crop';
import {
  createImageObject,
  type ImageCrop,
  type ImageObject,
  type Point,
  type TextObject,
} from '../canvas/document';
import { buildOcrPlacement, type OcrPlacementChoice } from '../ocr/ocr-placement';
import { recognizeImageText } from '../ocr/native-ocr';
import {
  loadingOcrState,
  ocrReviewStateFromError,
  ocrReviewStateFromResult,
  withOcrCorrection,
  type OcrReviewState,
} from '../ocr/ocr-service';
import { spacing, typography, type ThemeColors } from '../theme';

type FlowStep = 'source' | 'crop' | 'ocr' | 'placing' | 'error';

type PendingImage = {
  image: ImageObject;
  asset: StoredImageAsset;
};

type Props = {
  theme: ThemeColors;
  boardId: string;
  point?: Point;
  onPlace: (object: ImageObject, textObject?: TextObject) => void;
  onClose: () => void;
};

/**
 * Capture or pick → crop/rotate → durable image → on-device OCR review → place.
 *
 * The image is stored before recognition starts, so a slow, empty, or failed
 * OCR pass can never prevent "Add image only". Cancel discards the original and
 * placed copies together; a successful placement keeps both because the image
 * object refers to them.
 */
export function ImageImportFlow({ theme, boardId, point, onPlace, onClose }: Props) {
  const [step, setStep] = useState<FlowStep>('source');
  const [working, setWorking] = useState<WorkingImage | null>(null);
  const [original, setOriginal] = useState<StoredImageAsset | null>(null);
  const [pending, setPending] = useState<PendingImage | null>(null);
  const [ocrState, setOcrState] = useState<OcrReviewState>(loadingOcrState);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const recognitionRequest = useRef(0);

  const cleanupTemporary = useCallback(() => {
    if (working) void deleteFile(working.uri);
    if (original) void deleteStoredAsset(original.storagePath);
    if (pending) void deleteStoredAsset(pending.asset.storagePath);
  }, [working, original, pending]);

  const runRecognition = useCallback(async (uri: string) => {
    const request = recognitionRequest.current + 1;
    recognitionRequest.current = request;
    setOcrState(loadingOcrState());
    try {
      const result = await recognizeImageText(uri);
      if (recognitionRequest.current !== request) return;
      setOcrState(ocrReviewStateFromResult(result));
    } catch (error) {
      if (recognitionRequest.current !== request) return;
      setOcrState(ocrReviewStateFromError(error));
    }
  }, []);

  const startPick = useCallback(async (source: ImageSource) => {
    setStep('placing');
    setErrorMessage(null);
    try {
      const result = await pickImage(source);
      if (result.status === 'cancelled') { setStep('source'); return; }
      if (result.status === 'denied') {
        setErrorMessage(permissionDeniedMessage(source, result.canAskAgain));
        setStep('source');
        return;
      }
      if (result.status === 'error') {
        setErrorMessage(result.message);
        setStep('source');
        return;
      }
      const stored = await storeImageFile({
        boardId,
        sourceUri: result.image.uri,
        mimeType: result.image.mimeType,
        fileName: result.image.fileName,
        folder: 'originals',
        width: result.image.width,
        height: result.image.height,
      });
      setOriginal(stored);
      const prepared = await prepareWorkingImage(stored.uri, stored.mimeType);
      setWorking(prepared);
      setStep('crop');
    } catch (error) {
      setErrorMessage(imageImportErrorMessage(error));
      setStep('source');
    }
  }, [boardId]);

  const handleCropDone = useCallback(async (crop: PixelRect, cropRotation: number) => {
    if (!working || !original) return;
    setStep('placing');
    try {
      const effectiveRotation = (cropRotation % 360) as 0 | 90 | 180 | 270;
      let placedWorking = working;
      if (effectiveRotation !== 0) {
        placedWorking = await rotateWorkingImage(working.uri, effectiveRotation);
        void deleteFile(working.uri);
      }
      const cropRect = crop;
      const needsCrop = cropRect.x > 0 || cropRect.y > 0 || cropRect.width < placedWorking.width || cropRect.height < placedWorking.height;
      let placedAsset: StoredImageAsset;
      if (needsCrop) {
        const cropped = await cropWorkingImage(placedWorking.uri, cropRect, placedWorking.mimeType);
        void deleteFile(placedWorking.uri);
        placedAsset = await storeImageFile({
          boardId,
          sourceUri: cropped.uri,
          mimeType: cropped.mimeType,
          folder: 'images',
          width: cropped.width,
          height: cropped.height,
        });
      } else {
        placedAsset = await storeImageFile({
          boardId,
          sourceUri: placedWorking.uri,
          mimeType: placedWorking.mimeType,
          folder: 'images',
          width: placedWorking.width,
          height: placedWorking.height,
        });
      }
      const cropMeta: ImageCrop = toImageCrop(cropRect, effectiveRotation);
      const placement = createImageObject({
        id: `image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        point: point ?? { x: 0, y: 0 },
        assetId: placedAsset.assetId,
        storagePath: placedAsset.storagePath,
        originalAssetId: original.assetId,
        originalStoragePath: original.storagePath,
        sourceWidth: placedAsset.width,
        sourceHeight: placedAsset.height,
        originalWidth: original.width,
        originalHeight: original.height,
        crop: cropMeta,
      });

      // The cache working copies are no longer needed. The durable original and
      // placed copies stay until the user places or cancels the image.
      void deleteFile(placedWorking.uri);
      void deleteFile(working.uri);
      setWorking(null);
      setPending({ image: placement, asset: placedAsset });
      setStep('ocr');
      void runRecognition(placedAsset.uri);
    } catch (error) {
      setErrorMessage(imageImportErrorMessage(error));
      setStep('crop');
    }
  }, [working, original, boardId, point, runRecognition]);

  const handleRetryOcr = useCallback(() => {
    if (!pending) return;
    void runRecognition(pending.asset.uri);
  }, [pending, runRecognition]);

  const handlePlace = useCallback((choice: OcrPlacementChoice) => {
    if (!pending) return;
    const placement = buildOcrPlacement({
      image: pending.image,
      state: ocrState,
      choice,
      textId: `ocr-text-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    });
    setStep('placing');
    onPlace(placement.image, placement.text ?? undefined);
    // A placed image keeps both durable files, so clear them before closing;
    // the close cleanup only removes copies that were never placed.
    setPending(null);
    setOriginal(null);
    setWorking(null);
    setOcrState(loadingOcrState());
    setStep('source');
    onClose();
  }, [pending, ocrState, onPlace, onClose]);

  const handleCancel = useCallback(() => {
    cleanupTemporary();
    setStep('source');
    setWorking(null);
    setOriginal(null);
    setPending(null);
  }, [cleanupTemporary]);

  const handleClose = useCallback(() => {
    cleanupTemporary();
    onClose();
  }, [cleanupTemporary, onClose]);

  /** Android back / swipe: step back to the source sheet, or close the flow. */
  const handleRequestClose = useCallback(() => {
    if (step === 'placing') return;
    if (step === 'crop') handleCancel();
    else handleClose();
  }, [step, handleCancel, handleClose]);

  // The whole flow lives in a Modal so it owns a window above the editor's top
  // bar and action island; as a sibling view the chrome drew over the sheet and
  // the crop stage was squeezed into the remaining flex space.
  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={handleRequestClose}
      statusBarTranslucent
    >
      {step === 'crop' && working ? (
        <ImageCropScreen
          theme={theme}
          uri={working.uri}
          width={working.width}
          height={working.height}
          initialRotation={0}
          onDone={handleCropDone}
          onCancel={handleCancel}
        />
      ) : step === 'ocr' && pending ? (
        <OcrReviewScreen
          theme={theme}
          uri={resolveMediaUri(pending.image.storagePath)}
          width={pending.image.sourceWidth}
          height={pending.image.sourceHeight}
          state={ocrState}
          onChangeText={(text) => setOcrState((current) => withOcrCorrection(current, text))}
          onRetry={handleRetryOcr}
          onAddText={() => handlePlace('text')}
          onAddImageOnly={() => handlePlace('image-only')}
          onClose={handleClose}
        />
      ) : step === 'placing' ? (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
          <ActivityIndicator color={theme.primary} />
          <Text style={[styles.text, { color: theme.foreground }]}>Preparing image…</Text>
        </View>
      ) : (
        <ImageSourceSheet
          theme={theme}
          errorMessage={errorMessage}
          onClose={handleClose}
          onPick={startPick}
        />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  text: { ...typography.body },
});
