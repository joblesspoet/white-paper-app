import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useDerivedValue, useSharedValue } from 'react-native-reanimated';
import { Canvas, Circle, Group, Rect, RoundedRect } from '@shopify/react-native-skia';

import type { ThemeColors } from '../theme';
import { stageCurtainOverlayStyles as styles } from './StageCurtainOverlay.styles';

export type StageOverlayMode = 'curtain' | 'spotlight';
export type CurtainAnchor = 'top' | 'bottom';
export type SpotlightShape = 'circle' | 'rect';

export type StageCurtainOverlayProps = {
  visible: boolean;
  mode: StageOverlayMode;
  bounds: { width: number; height: number };
  theme: ThemeColors;
  onChangeMode: (mode: StageOverlayMode) => void;
  onClose: () => void;
};

export const StageCurtainOverlay = memo(function StageCurtainOverlay({
  visible,
  mode,
  bounds,
  theme,
  onChangeMode,
  onClose,
}: StageCurtainOverlayProps) {
  const [curtainAnchor, setCurtainAnchor] = useState<CurtainAnchor>('top');
  const [spotlightShape, setSpotlightShape] = useState<SpotlightShape>('circle');

  const curtainFraction = useSharedValue(0.55);
  const curtainDragStart = useSharedValue(0.55);

  const spotX = useSharedValue(Math.max(120, bounds.width / 2));
  const spotY = useSharedValue(Math.max(120, bounds.height / 2));
  const spotRadius = useSharedValue(110);
  const spotStartX = useSharedValue(Math.max(120, bounds.width / 2));
  const spotStartY = useSharedValue(Math.max(120, bounds.height / 2));
  const spotRadiusStart = useSharedValue(110);

  useEffect(() => {
    if (bounds.width <= 0 || bounds.height <= 0) return;
    spotX.value = Math.max(48, Math.min(Math.max(48, bounds.width - 48), spotX.value));
    spotY.value = Math.max(48, Math.min(Math.max(48, bounds.height - 48), spotY.value));
  }, [bounds.height, bounds.width, spotX, spotY]);

  const handleToggleAnchor = useCallback(() => {
    setCurtainAnchor((prev) => (prev === 'top' ? 'bottom' : 'top'));
  }, []);

  const handleToggleShape = useCallback(() => {
    setSpotlightShape((prev) => (prev === 'circle' ? 'rect' : 'circle'));
  }, []);

  const handleSelectCurtain = useCallback(() => onChangeMode('curtain'), [onChangeMode]);
  const handleSelectSpotlight = useCallback(() => onChangeMode('spotlight'), [onChangeMode]);

  const curtainPan = useMemo(() => {
    const boundsH = bounds.height;
    const isTop = curtainAnchor === 'top';
    return Gesture.Pan()
      .onStart(() => {
        curtainDragStart.value = curtainFraction.value;
      })
      .onUpdate((e) => {
        if (boundsH <= 0) return;
        const deltaFrac = e.translationY / boundsH;
        const next = isTop
          ? curtainDragStart.value + deltaFrac
          : curtainDragStart.value - deltaFrac;
        curtainFraction.value = Math.max(0.08, Math.min(0.92, next));
      });
  }, [bounds.height, curtainAnchor, curtainDragStart, curtainFraction]);

  const spotMovePan = useMemo(() => {
    const maxX = Math.max(40, bounds.width - 40);
    const maxY = Math.max(40, bounds.height - 40);
    return Gesture.Pan()
      .onStart(() => {
        spotStartX.value = spotX.value;
        spotStartY.value = spotY.value;
      })
      .onUpdate((e) => {
        spotX.value = Math.max(40, Math.min(maxX, spotStartX.value + e.translationX));
        spotY.value = Math.max(40, Math.min(maxY, spotStartY.value + e.translationY));
      });
  }, [bounds.height, bounds.width, spotStartX, spotStartY, spotX, spotY]);

  const spotResizePan = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          spotRadiusStart.value = spotRadius.value;
        })
        .onUpdate((e) => {
          const delta = (e.translationX + e.translationY) * 0.6;
          spotRadius.value = Math.max(56, Math.min(260, spotRadiusStart.value + delta));
        }),
    [spotRadius, spotRadiusStart],
  );

  const boundsHeight = bounds.height;
  const isTopAnchor = curtainAnchor === 'top';

  const curtainShadeAnimatedStyle = useAnimatedStyle(() => {
    const shadePx = Math.round(boundsHeight * curtainFraction.value);
    return isTopAnchor
      ? { top: 0, bottom: undefined, height: shadePx, borderBottomWidth: 2, borderTopWidth: 0 }
      : { bottom: 0, top: undefined, height: shadePx, borderTopWidth: 2, borderBottomWidth: 0 };
  }, [boundsHeight, isTopAnchor]);

  const curtainHandleAnimatedStyle = useAnimatedStyle(() => {
    const shadePx = Math.round(boundsHeight * curtainFraction.value);
    const rawY = isTopAnchor ? shadePx - 24 : boundsHeight - shadePx - 24;
    const handleY = Math.max(12, Math.min(Math.max(12, boundsHeight - 56), rawY));
    return { transform: [{ translateY: handleY }] };
  }, [boundsHeight, isTopAnchor]);

  const isCircleSpot = spotlightShape === 'circle';

  const spotRectW = useDerivedValue(() => spotRadius.value * 2.5);
  const spotRectH = useDerivedValue(() => spotRadius.value * 1.7);
  const spotRectX = useDerivedValue(() => spotX.value - (spotRadius.value * 2.5) / 2);
  const spotRectY = useDerivedValue(() => spotY.value - (spotRadius.value * 1.7) / 2);

  const ringAnimatedStyle = useAnimatedStyle(() => {
    const rw = isCircleSpot ? spotRadius.value * 2 : spotRadius.value * 2.5;
    const rh = isCircleSpot ? spotRadius.value * 2 : spotRadius.value * 1.7;
    return {
      width: rw,
      height: rh,
      borderRadius: isCircleSpot ? spotRadius.value : 16,
      transform: [{ translateX: spotX.value - rw / 2 }, { translateY: spotY.value - rh / 2 }],
    };
  }, [isCircleSpot]);

  const resizeHandleAnimatedStyle = useAnimatedStyle(() => {
    const rw = isCircleSpot ? spotRadius.value * 2 : spotRadius.value * 2.5;
    const rh = isCircleSpot ? spotRadius.value * 2 : spotRadius.value * 1.7;
    return {
      transform: [
        { translateX: spotX.value + rw / 2 - 22 },
        { translateY: spotY.value + rh / 2 - 22 },
      ],
    };
  }, [isCircleSpot]);

  if (!visible || bounds.width <= 0 || bounds.height <= 0) return null;

  return (
    <View pointerEvents="box-none" style={styles.root}>
      {mode === 'curtain' ? (
        <>
          <Animated.View
            pointerEvents="auto"
            style={[styles.curtainShade, curtainShadeAnimatedStyle]}
          />
          <GestureDetector gesture={curtainPan}>
            <Animated.View style={[styles.curtainHandleBar, curtainHandleAnimatedStyle]}>
              <View
                style={[
                  styles.curtainHandlePill,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                ]}
              >
                <View style={[styles.curtainHandleGrip, { backgroundColor: theme.primary }]} />
                <Text style={[styles.curtainHandleLabel, { color: theme.foreground }]}>
                  Drag shade
                </Text>
              </View>
            </Animated.View>
          </GestureDetector>
        </>
      ) : (
        <>
          <View pointerEvents="none" style={styles.spotlightCanvas}>
            <Canvas style={styles.spotlightCanvas}>
              <Group layer>
                <Rect
                  x={0}
                  y={0}
                  width={bounds.width}
                  height={bounds.height}
                  color="rgba(15, 23, 42, 0.75)"
                />
                {isCircleSpot ? (
                  <Circle cx={spotX} cy={spotY} r={spotRadius} blendMode="clear" color="black" />
                ) : (
                  <RoundedRect
                    x={spotRectX}
                    y={spotRectY}
                    width={spotRectW}
                    height={spotRectH}
                    r={16}
                    blendMode="clear"
                    color="black"
                  />
                )}
              </Group>
            </Canvas>
          </View>
          <GestureDetector gesture={spotMovePan}>
            <Animated.View style={[styles.spotlightMoveRing, ringAnimatedStyle]} />
          </GestureDetector>
          <GestureDetector gesture={spotResizePan}>
            <Animated.View style={[styles.spotlightResizeHandle, resizeHandleAnimatedStyle]}>
              <View style={styles.spotlightResizeDot} />
            </Animated.View>
          </GestureDetector>
        </>
      )}

      <View
        style={[
          styles.controlBar,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Window curtain mode"
          accessibilityState={{ selected: mode === 'curtain' }}
          onPress={handleSelectCurtain}
          style={({ pressed }) => [
            styles.modeChip,
            mode === 'curtain' && { backgroundColor: theme.muted },
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.modeChipText,
              { color: mode === 'curtain' ? theme.primary : theme.foreground },
            ]}
          >
            Curtain
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Spotlight focus mode"
          accessibilityState={{ selected: mode === 'spotlight' }}
          onPress={handleSelectSpotlight}
          style={({ pressed }) => [
            styles.modeChip,
            mode === 'spotlight' && { backgroundColor: theme.muted },
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.modeChipText,
              { color: mode === 'spotlight' ? theme.primary : theme.foreground },
            ]}
          >
            Spotlight
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={mode === 'curtain' ? 'Flip curtain anchor' : 'Toggle spotlight shape'}
          onPress={mode === 'curtain' ? handleToggleAnchor : handleToggleShape}
          style={({ pressed }) => [styles.modeChip, pressed && styles.pressed]}
        >
          <Text style={[styles.modeChipText, { color: theme.foreground }]}>
            {mode === 'curtain'
              ? curtainAnchor === 'top'
                ? 'Top'
                : 'Bottom'
              : spotlightShape === 'circle'
                ? 'Circle'
                : 'Rect'}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close presentation shade"
          onPress={onClose}
          style={({ pressed }) => [styles.modeChip, pressed && styles.pressed]}
        >
          <Text style={[styles.modeChipText, { color: theme.destructive }]}>Close</Text>
        </Pressable>
      </View>
    </View>
  );
});
