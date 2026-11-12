import { useCallback, useRef, useState } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  CheckIcon,
  RotateIcon,
} from './icons';
import {
  clampCropTransform,
  cropRectFromTransform,
  fitImageInFrame,
  nextRotation,
  rotatedSize,
  zoomCropTransform,
  type CropTransform,
  type ImageRotation,
  type PixelRect,
} from '../media/image-crop';
import { resolveFlowModalLayout } from '../responsive/layout';
import { radii, spacing, touchTarget, typography, type ThemeColors } from '../theme';

type Props = {
  theme: ThemeColors;
  uri: string;
  width: number;
  height: number;
  initialRotation?: ImageRotation;
  onDone: (crop: PixelRect, rotation: ImageRotation) => void;
  onCancel: () => void;
};

const FRAME_RATIO = 4 / 3;
const ZOOM_STEP = 1.25;

export function ImageCropScreen({
  theme,
  uri,
  width,
  height,
  initialRotation = 0,
  onDone,
  onCancel,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const { cropToolbarPlacement, cropRailWidth, profile } = resolveFlowModalLayout(winWidth, winHeight);
  const useRightRail = cropToolbarPlacement === 'right-rail';

  const [rotation, setRotation] = useState<ImageRotation>(initialRotation);
  const rotationRef = useRef<ImageRotation>(initialRotation);
  rotationRef.current = rotation;

  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const frameSizeRef = useRef(frameSize);
  frameSizeRef.current = frameSize;

  const [transform, setTransform] = useState<CropTransform>(() =>
    fitImageInFrame(width, height, 0, 0),
  );
  const transformRef = useRef(transform);
  transformRef.current = transform;

  const gestureStart = useRef<CropTransform>(transform);

  const pan = Gesture.Pan()
    .runOnJS(true)
    .onStart(() => {
      gestureStart.current = transformRef.current;
    })
    .onUpdate((event) => {
      const base = gestureStart.current;
      const currentSize = rotatedSize(width, height, rotationRef.current);
      const fs = frameSizeRef.current;
      if (fs.width === 0 || fs.height === 0) return;
      setTransform(
        clampCropTransform(
          {
            scale: base.scale,
            translateX: base.translateX + event.translationX,
            translateY: base.translateY + event.translationY,
          },
          currentSize.width,
          currentSize.height,
          fs.width,
          fs.height,
        ),
      );
    });

  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onStart(() => {
      gestureStart.current = transformRef.current;
    })
    .onUpdate((event) => {
      const base = gestureStart.current;
      const currentSize = rotatedSize(width, height, rotationRef.current);
      const fs = frameSizeRef.current;
      if (fs.width === 0 || fs.height === 0) return;
      setTransform(
        zoomCropTransform(
          base,
          base.scale * event.scale,
          event.focalX,
          event.focalY,
          currentSize.width,
          currentSize.height,
          fs.width,
          fs.height,
        ),
      );
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .runOnJS(true)
    .onEnd((event) => {
      const current = transformRef.current;
      const currentSize = rotatedSize(width, height, rotationRef.current);
      const fs = frameSizeRef.current;
      if (fs.width === 0 || fs.height === 0) return;
      const baseFit = fitImageInFrame(currentSize.width, currentSize.height, fs.width, fs.height);
      const nextScale = current.scale >= baseFit.scale * 1.8 ? baseFit.scale : current.scale * ZOOM_STEP;
      setTransform(
        zoomCropTransform(
          current,
          nextScale,
          event.x,
          event.y,
          currentSize.width,
          currentSize.height,
          fs.width,
          fs.height,
        ),
      );
    });

  const composed = Gesture.Race(pan, pinch, doubleTap);

  const onLayout = (event: { nativeEvent: { layout: { width: number; height: number } } }) => {
    const { width: w, height: h } = event.nativeEvent.layout;
    if (w <= 0 || h <= 0) return;
    const padding = (profile.isCompactHeight ? spacing.md : spacing.lg) * 2;
    const maxW = Math.max(1, w - padding);
    const maxH = Math.max(1, h - padding);
    let frameW = maxW;
    let frameH = Math.floor(frameW / FRAME_RATIO);
    if (frameH > maxH) {
      frameH = maxH;
      frameW = Math.floor(frameH * FRAME_RATIO);
    }
    const size = { width: Math.max(1, frameW), height: Math.max(1, frameH) };
    setFrameSize(size);
    const currentSize = rotatedSize(width, height, rotationRef.current);
    setTransform(fitImageInFrame(currentSize.width, currentSize.height, size.width, size.height));
  };

  const handleRotate = useCallback(() => {
    const next = nextRotation(rotationRef.current);
    setRotation(next);
    rotationRef.current = next;
    const rotated = rotatedSize(width, height, next);
    const fs = frameSizeRef.current;
    if (fs.width > 0 && fs.height > 0) {
      setTransform(fitImageInFrame(rotated.width, rotated.height, fs.width, fs.height));
    }
  }, [width, height]);

  const handleDone = useCallback(() => {
    const currentSize = rotatedSize(width, height, rotation);
    const fs = frameSizeRef.current;
    const crop = cropRectFromTransform(
      transformRef.current,
      currentSize.width,
      currentSize.height,
      fs.width,
      fs.height,
    );
    onDone(crop, rotation);
  }, [width, height, rotation, onDone]);

  const currentSize = rotatedSize(width, height, rotation);
  const displayW = currentSize.width * transform.scale;
  const displayH = currentSize.height * transform.scale;

  const rawW = width * transform.scale;
  const rawH = height * transform.scale;
  const imageOffsetX = (displayW - rawW) / 2;
  const imageOffsetY = (displayH - rawH) / 2;

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: theme.background,
          paddingTop: insets.top,
          paddingBottom: useRightRail ? 0 : insets.bottom,
          paddingLeft: insets.left,
        },
      ]}
    >
      <View
        style={[
          styles.header,
          profile.isCompactHeight && styles.headerCompact,
          { borderBottomColor: theme.border, paddingRight: insets.right },
        ]}
      >
        <Text style={[styles.title, { color: theme.foreground }]}>Crop & Rotate</Text>
      </View>

      <View style={[styles.workspace, useRightRail && styles.workspaceRow]}>
        <View style={styles.stage} onLayout={onLayout}>
          {frameSize.width > 0 && frameSize.height > 0 && (
            <GestureDetector gesture={composed}>
              <View
                style={[
                  styles.cropFrame,
                  {
                    width: frameSize.width,
                    height: frameSize.height,
                    borderColor: theme.primary,
                  },
                ]}
              >
                <View
                  style={[
                    styles.imageContainer,
                    {
                      width: displayW,
                      height: displayH,
                      transform: [
                        { translateX: transform.translateX },
                        { translateY: transform.translateY },
                      ],
                    },
                  ]}
                >
                  <Image
                    source={{ uri }}
                    style={[
                      styles.rawImage,
                      {
                        width: rawW,
                        height: rawH,
                        left: imageOffsetX,
                        top: imageOffsetY,
                        transform: [{ rotate: `${rotation}deg` }],
                      },
                    ]}
                    resizeMode="stretch"
                  />
                </View>
              </View>
            </GestureDetector>
          )}
        </View>

        <View
          style={[
            useRightRail ? styles.rightRail : styles.controls,
            useRightRail
              ? {
                  width: cropRailWidth + insets.right,
                  paddingRight: spacing.md + insets.right,
                  paddingBottom: Math.max(spacing.md, insets.bottom),
                  borderLeftColor: theme.border,
                  backgroundColor: theme.surface,
                }
              : {
                  paddingRight: insets.right,
                  borderTopColor: theme.border,
                  backgroundColor: theme.surface,
                },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Rotate 90 degrees clockwise"
            onPress={handleRotate}
            style={[
              styles.controlBtn,
              useRightRail && [styles.railBtn, { borderColor: theme.border }],
            ]}
          >
            <RotateIcon size={22} color={theme.foreground} />
            <Text style={[styles.controlLabel, { color: theme.foreground }]}>Rotate</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Done"
            onPress={handleDone}
            style={[
              styles.controlBtn,
              styles.doneBtn,
              useRightRail && styles.railPrimaryBtn,
              { backgroundColor: theme.primary },
            ]}
          >
            <CheckIcon size={22} color={theme.onPrimary} />
            <Text style={[styles.controlLabel, { color: theme.onPrimary }]}>Done</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            onPress={onCancel}
            style={[
              styles.controlBtn,
              useRightRail && [styles.railBtn, { borderColor: theme.border }],
            ]}
          >
            <Text style={[styles.controlLabel, { color: theme.foreground }]}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
  },
  headerCompact: {
    paddingVertical: spacing.xs + 2,
  },
  title: { ...typography.title },
  workspace: {
    flex: 1,
  },
  workspaceRow: {
    flexDirection: 'row',
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cropFrame: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: radii.sm,
    overflow: 'hidden',
    backgroundColor: '#00000010',
  },
  imageContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  rawImage: {
    position: 'absolute',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
  },
  rightRail: {
    borderLeftWidth: 1,
    paddingLeft: spacing.md,
    paddingTop: spacing.lg,
    justifyContent: 'center',
    gap: spacing.md,
  },
  controlBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: touchTarget,
    minWidth: touchTarget,
  },
  railBtn: {
    width: '100%',
    flexDirection: 'row',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.sm,
  },
  doneBtn: {
    borderRadius: radii.sm,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
  },
  railPrimaryBtn: {
    width: '100%',
  },
  controlLabel: { ...typography.caption, fontWeight: '600' },
});
