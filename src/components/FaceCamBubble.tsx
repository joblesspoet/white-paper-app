import { memo, useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { Pressable, Text, View } from 'react-native';
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
      return;
    }
    if (permissionStatus === 'unknown') {
      void requestPermission();
    }
  }, [permissionStatus, requestPermission, visible]);

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

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
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
        }),
    [bottomExclusion, bounds.height, bounds.width, pos, sizePt],
  );

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

  return (
    <GestureDetector gesture={panGesture}>
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Face-Cam bubble"
          accessibilityHint="Drag to snap to corners, or tap to show camera controls"
          onPress={handleToggleControls}
          style={[styles.pressableFill, { borderRadius: Math.max(0, borderRadius - 2) }]}
        >
          {CameraView ? (
            <CameraView
              style={[
                styles.cameraFill,
                mirrored && facing === 'front' ? { transform: [{ scaleX: -1 }] } : undefined,
              ]}
              facing={facing}
              mirror={mirrored}
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
                  {facing === 'front' ? 'Front Cam' : 'Back Cam'}
                </Text>
              </View>
              <Text style={[styles.fallbackSubLabel, { color: theme.foreground }]}>
                {sizePt}pt {mirrored ? '• Mirror' : ''}
              </Text>
            </View>
          )}

          {isRecording && <View style={styles.recDot} />}

          {controlsVisible && (
            <View style={styles.controlsOverlay}>
              <View style={styles.controlsRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Flip camera"
                  onPress={handleFlipCamera}
                  style={[
                    styles.controlButton,
                    { backgroundColor: theme.surface, borderColor: theme.border },
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
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                >
                  <Text style={[styles.controlText, { color: theme.foreground }]}>{sizePt}pt</Text>
                </Pressable>
              </View>
              <View style={styles.controlsRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Toggle Face-Cam shape"
                  onPress={handleToggleShape}
                  style={[
                    styles.controlButton,
                    { backgroundColor: theme.surface, borderColor: theme.border },
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
                      backgroundColor: mirrored ? theme.primary : theme.surface,
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
                  accessibilityLabel="Close Face-Cam"
                  onPress={handleClose}
                  style={[
                    styles.controlButton,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                >
                  <Text style={[styles.controlText, { color: theme.destructive }]}>Close</Text>
                </Pressable>
              </View>
            </View>
          )}
        </Pressable>
      </View>
    </GestureDetector>
  );
});
