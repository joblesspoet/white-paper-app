import { memo, useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import {
  FACECAM_RING_WIDTH,
  clampFaceCamPosition,
  cornerPosition,
  cycleFaceCamSize,
  faceCamBorderRadius,
  faceCamRingColor,
  faceCamSizePt,
  snapFaceCamToNearestCorner,
  type FaceCamCorner,
  type FaceCamFacing,
  type FaceCamPermissionStatus,
  type FaceCamShape,
  type FaceCamSizePreset,
} from '../recorder/facecam-model';
import { openAppSettings, requestCameraPermission } from '../recorder/permissions';
import type { ThemeColors } from '../theme';
import { triggerHapticFeedback } from '../utils/haptics';
import { faceCamStyles as styles } from './FaceCamBubble.styles';

type OptionalCameraViewProps = {
  style?: object;
  facing?: 'front' | 'back';
  mirror?: boolean;
  active?: boolean;
  onMountError?: (event: { message?: string }) => void;
};

let cachedCameraChecked = false;
let cachedCameraView: ComponentType<OptionalCameraViewProps> | null = null;

function getOptionalCameraView(): ComponentType<OptionalCameraViewProps> | null {
  if (cachedCameraChecked) return cachedCameraView;
  cachedCameraChecked = true;
  try {
    // Dynamic lookup so Expo Go or builds without expo-camera never crash.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-camera') as { CameraView?: ComponentType<OptionalCameraViewProps> };
    if (mod?.CameraView) {
      cachedCameraView = mod.CameraView;
      return cachedCameraView;
    }
  } catch {
    // expo-camera not installed in this build.
  }
  cachedCameraView = null;
  return null;
}

export type FaceCamBubbleProps = {
  visible: boolean;
  isRecording: boolean;
  theme: ThemeColors;
  haptics: boolean;
  bounds: { width: number; height: number };
  bottomExclusion: number;
  onClose: () => void;
};

export const FaceCamBubble = memo(function FaceCamBubble({
  visible,
  isRecording,
  theme,
  haptics,
  bounds,
  bottomExclusion,
  onClose,
}: FaceCamBubbleProps) {
  const [sizePreset, setSizePreset] = useState<FaceCamSizePreset>('medium');
  const [shape, setShape] = useState<FaceCamShape>('circle');
  const [facing, setFacing] = useState<FaceCamFacing>('front');
  const [mirrored, setMirrored] = useState(true);
  const [corner, setCorner] = useState<FaceCamCorner>('bottom-right');
  const [controlsVisible, setControlsVisible] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<FaceCamPermissionStatus>('unknown');
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null);
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [cameraMountError, setCameraMountError] = useState<string | null>(null);
  const [pillSize, setPillSize] = useState<{ width: number; height: number }>({
    width: 286,
    height: 44,
  });

  const sizePt = faceCamSizePt(sizePreset);
  const [pos, setPos] = useState(() =>
    cornerPosition('bottom-right', bounds.width, bounds.height, sizePt, bottomExclusion),
  );
  const dragStartRef = useRef(pos);

  const requestPermission = useCallback(async () => {
    const res = await requestCameraPermission();
    setPermissionStatus(res.status);
    setCanAskAgain(res.canAskAgain);
    setPermissionMessage(res.message ?? null);
  }, []);

  useEffect(() => {
    if (!visible) {
      setControlsVisible(false);
      setCameraMountError(null);
      return;
    }
    if (permissionStatus === 'unknown') {
      void requestPermission();
    }
  }, [permissionStatus, requestPermission, visible]);

  useEffect(() => {
    setCameraMountError(null);
  }, [facing]);

  useEffect(() => {
    setPos(cornerPosition(corner, bounds.width, bounds.height, sizePt, bottomExclusion));
  }, [bottomExclusion, bounds.height, bounds.width, corner, sizePt]);

  const handleToggleControls = useCallback(() => {
    setControlsVisible((prev) => !prev);
  }, []);

  const handleFlipCamera = useCallback(() => {
    void triggerHapticFeedback('selection', haptics);
    setFacing((prev) => (prev === 'front' ? 'back' : 'front'));
  }, [haptics]);

  const handleCycleSize = useCallback(() => {
    void triggerHapticFeedback('selection', haptics);
    setSizePreset((prev) => cycleFaceCamSize(prev));
  }, [haptics]);

  const handleToggleShape = useCallback(() => {
    void triggerHapticFeedback('selection', haptics);
    setShape((prev) => (prev === 'circle' ? 'rounded-card' : 'circle'));
  }, [haptics]);

  const handleToggleMirror = useCallback(() => {
    void triggerHapticFeedback('selection', haptics);
    setMirrored((prev) => !prev);
  }, [haptics]);

  const handleClose = useCallback(() => {
    void triggerHapticFeedback('selection', haptics);
    onClose();
  }, [haptics, onClose]);

  const handleOpenSettings = useCallback(() => {
    void openAppSettings();
  }, []);

  const bubbleGesture = useMemo(() => {
    const panGesture = Gesture.Pan()
      .minDistance(8)
      .runOnJS(true)
      .onStart(() => {
        dragStartRef.current = pos;
      })
      .onUpdate((event) => {
        setPos(
          clampFaceCamPosition(
            {
              x: dragStartRef.current.x + event.translationX,
              y: dragStartRef.current.y + event.translationY,
            },
            bounds.width,
            bounds.height,
            sizePt,
            bottomExclusion,
          ),
        );
      })
      .onEnd((event) => {
        const snapped = snapFaceCamToNearestCorner(
          {
            x: dragStartRef.current.x + event.translationX,
            y: dragStartRef.current.y + event.translationY,
          },
          bounds.width,
          bounds.height,
          sizePt,
          bottomExclusion,
        );
        setCorner(snapped.corner);
        setPos(snapped.position);
      });

    const tapGesture = Gesture.Tap()
      .maxDistance(8)
      .runOnJS(true)
      .onEnd((_, success) => {
        if (success) {
          handleToggleControls();
        }
      });

    return Gesture.Race(panGesture, tapGesture);
  }, [bottomExclusion, bounds.height, bounds.width, handleToggleControls, pos, sizePt]);

  if (!visible) return null;

  if (permissionStatus === 'denied' || permissionStatus === 'blocked') {
    const clampedBanner = clampFaceCamPosition(
      pos,
      bounds.width,
      bounds.height,
      224,
      bottomExclusion,
    );
    return (
      <View
        accessibilityRole="alert"
        style={[
          styles.permissionBanner,
          {
            left: clampedBanner.x,
            top: Math.max(12, clampedBanner.y - 40),
            backgroundColor: theme.surface,
            borderColor: theme.border,
          },
        ]}
      >
        <Text style={[styles.permissionTitle, { color: theme.foreground }]}>
          Camera access needed
        </Text>
        <Text style={[styles.permissionBody, { color: theme.foreground }]}>
          {permissionMessage ?? 'Allow camera access to show the Face-Cam bubble.'}
        </Text>
        <View style={styles.permissionActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close Face-Cam"
            onPress={handleClose}
            style={[styles.permissionButton, { borderColor: theme.border }]}
          >
            <Text style={[styles.permissionButtonText, { color: theme.foreground }]}>Close</Text>
          </Pressable>
          {canAskAgain ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry camera permission"
              onPress={() => {
                void requestPermission();
              }}
              style={[
                styles.permissionButton,
                { backgroundColor: theme.primary, borderColor: theme.primary },
              ]}
            >
              <Text style={[styles.permissionButtonText, { color: '#FFFFFF' }]}>
                Allow
              </Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open system settings"
              onPress={handleOpenSettings}
              style={[
                styles.permissionButton,
                { backgroundColor: theme.primary, borderColor: theme.primary },
              ]}
            >
              <Text style={[styles.permissionButtonText, { color: '#FFFFFF' }]}>
                Open Settings
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  const borderRadius = faceCamBorderRadius(shape, sizePt);
  const ringColor = faceCamRingColor(isRecording, theme.primary);
  const CameraView = getOptionalCameraView();
  const canRenderCamera = Boolean(CameraView) && permissionStatus === 'granted' && !cameraMountError;

  const pillMaxWidth = Math.min(316, Math.max(180, bounds.width - 16));
  const usableBottom = Math.max(80, bounds.height - bottomExclusion);
  const measuredW = Math.min(pillSize.width, pillMaxWidth);
  const measuredH = pillSize.height;
  const spaceAbove = pos.y - 16;
  const spaceBelow = usableBottom - (pos.y + sizePt) - 16;

  let pillLeft: number;
  let pillTop: number;
  if (spaceAbove >= measuredH || spaceBelow >= measuredH) {
    const placeAbove =
      spaceAbove >= measuredH && (pos.y + sizePt / 2 > usableBottom / 2 || spaceBelow < measuredH);
    pillTop = placeAbove
      ? Math.max(8, pos.y - measuredH - 8)
      : Math.min(Math.max(8, usableBottom - measuredH - 8), pos.y + sizePt + 8);
    pillLeft = Math.max(
      8,
      Math.min(pos.x + sizePt / 2 - measuredW / 2, bounds.width - measuredW - 8),
    );
  } else {
    const placeLeftOfBubble = pos.x + sizePt / 2 > bounds.width / 2;
    pillLeft = placeLeftOfBubble
      ? Math.max(8, pos.x - measuredW - 8)
      : Math.min(Math.max(8, bounds.width - measuredW - 8), pos.x + sizePt + 8);
    pillTop = Math.max(
      8,
      Math.min(pos.y + sizePt / 2 - measuredH / 2, usableBottom - measuredH - 8),
    );
  }

  return (
    <>
      <GestureDetector gesture={bubbleGesture}>
        <View
          style={[
            styles.bubbleContainer,
            {
              left: pos.x,
              top: pos.y,
              width: sizePt,
              height: sizePt,
              borderRadius,
              borderWidth: FACECAM_RING_WIDTH,
              borderColor: ringColor,
              backgroundColor: theme.surface,
            },
          ]}
        >
          <View style={[styles.pressableFill, { borderRadius: Math.max(0, borderRadius - 2) }]}>
            {canRenderCamera && CameraView ? (
              <CameraView
                key={`cam-${facing}-${permissionStatus}`}
                style={[
                  styles.cameraFill,
                  Platform.OS === 'ios' && mirrored && facing === 'front'
                    ? { transform: [{ scaleX: -1 }] }
                    : undefined,
                ]}
                facing={facing}
                mirror={mirrored}
                active={visible && permissionStatus === 'granted'}
                onMountError={(event) => {
                  setCameraMountError(event?.message ?? 'Camera unavailable');
                }}
              />
            ) : (
              <View
                style={[
                  styles.fallbackPreview,
                  { backgroundColor: theme.muted },
                  mirrored && facing === 'front' ? { transform: [{ scaleX: -1 }] } : undefined,
                ]}
              >
                <View
                  style={[
                    styles.fallbackBadge,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                >
                  <Text style={[styles.fallbackLabel, { color: theme.foreground }]}>
                    {permissionStatus === 'unknown'
                      ? 'Starting…'
                      : facing === 'front'
                        ? 'Front Cam'
                        : 'Back Cam'}
                  </Text>
                </View>
                <Text style={[styles.fallbackSubLabel, { color: theme.foreground }]} numberOfLines={2}>
                  {cameraMountError ? cameraMountError : `${sizePt}pt${mirrored ? ' • Mirror' : ''}`}
                </Text>
              </View>
            )}

            {isRecording && <View style={styles.recDot} />}

            <View
              accessible
              accessibilityRole="button"
              accessibilityLabel="Face-Cam bubble"
              accessibilityHint="Tap to show or hide camera options, or drag to snap to corners"
              style={StyleSheet.absoluteFill}
            />
          </View>
        </View>
      </GestureDetector>

      {controlsVisible && (
        <View
          onLayout={(event) => {
            const { width: w, height: h } = event.nativeEvent.layout;
            if (Math.abs(w - pillSize.width) > 2 || Math.abs(h - pillSize.height) > 2) {
              setPillSize({ width: w, height: h });
            }
          }}
          style={[
            styles.controlsPill,
            {
              left: pillLeft,
              top: pillTop,
              maxWidth: pillMaxWidth,
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Flip camera"
            onPress={handleFlipCamera}
            style={[
              styles.controlButton,
              { backgroundColor: theme.muted, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.controlText, { color: theme.foreground }]}>
              {facing === 'front' ? 'Back' : 'Front'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Resize Face-Cam"
            onPress={handleCycleSize}
            style={[
              styles.controlButton,
              { backgroundColor: theme.muted, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.controlText, { color: theme.foreground }]}>{sizePt}pt</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Toggle Face-Cam shape"
            onPress={handleToggleShape}
            style={[
              styles.controlButton,
              { backgroundColor: theme.muted, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.controlText, { color: theme.foreground }]}>
              {shape === 'circle' ? 'Card' : 'Circle'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Toggle camera mirror"
            onPress={handleToggleMirror}
            style={[
              styles.controlButton,
              {
                backgroundColor: mirrored ? theme.primary : theme.muted,
                borderColor: mirrored ? theme.primary : theme.border,
              },
            ]}
          >
            <Text
              style={[
                styles.controlText,
                { color: mirrored ? '#FFFFFF' : theme.foreground },
              ]}
            >
              Mirror
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Turn off Face-Cam"
            onPress={handleClose}
            style={[
              styles.controlButton,
              { backgroundColor: theme.muted, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.controlText, { color: theme.destructive }]}>Off</Text>
          </Pressable>
        </View>
      )}
    </>
  );
});
