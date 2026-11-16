import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';

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

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export const StageCurtainOverlay = memo(function StageCurtainOverlay({
  visible,
  mode,
  bounds,
  theme,
  onChangeMode,
  onClose,
}: StageCurtainOverlayProps) {
  const [curtainAnchor, setCurtainAnchor] = useState<CurtainAnchor>('top');
  const [curtainFraction, setCurtainFraction] = useState(0.55);
  const curtainDragStart = useRef(0.55);

  const [spotlightShape, setSpotlightShape] = useState<SpotlightShape>('circle');
  const [spotCenter, setSpotCenter] = useState({
    x: Math.max(120, bounds.width / 2),
    y: Math.max(120, bounds.height / 2),
  });
  const [spotRadius, setSpotRadius] = useState(110);
  const spotDragStart = useRef(spotCenter);
  const spotRadiusStart = useRef(110);

  useEffect(() => {
    if (bounds.width <= 0 || bounds.height <= 0) return;
    setSpotCenter((prev) => ({
      x: clamp(prev.x, 48, Math.max(48, bounds.width - 48)),
      y: clamp(prev.y, 48, Math.max(48, bounds.height - 48)),
    }));
  }, [bounds.height, bounds.width]);

  const handleToggleAnchor = useCallback(() => {
    setCurtainAnchor((prev) => (prev === 'top' ? 'bottom' : 'top'));
  }, []);

  const handleToggleShape = useCallback(() => {
    setSpotlightShape((prev) => (prev === 'circle' ? 'rect' : 'circle'));
  }, []);

  const handleSelectCurtain = useCallback(() => onChangeMode('curtain'), [onChangeMode]);
  const handleSelectSpotlight = useCallback(() => onChangeMode('spotlight'), [onChangeMode]);

  const curtainPan = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .onStart(() => {
          curtainDragStart.current = curtainFraction;
        })
        .onUpdate((e) => {
          if (bounds.height <= 0) return;
          const deltaFrac = e.translationY / bounds.height;
          const next =
            curtainAnchor === 'top'
              ? curtainDragStart.current + deltaFrac
              : curtainDragStart.current - deltaFrac;
          setCurtainFraction(clamp(next, 0.08, 0.92));
        }),
    [bounds.height, curtainAnchor, curtainFraction],
  );

  const spotMovePan = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .onStart(() => {
          spotDragStart.current = spotCenter;
        })
        .onUpdate((e) => {
          setSpotCenter({
            x: clamp(spotDragStart.current.x + e.translationX, 40, Math.max(40, bounds.width - 40)),
            y: clamp(spotDragStart.current.y + e.translationY, 40, Math.max(40, bounds.height - 40)),
          });
        }),
    [bounds.height, bounds.width, spotCenter],
  );

  const spotResizePan = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .onStart(() => {
          spotRadiusStart.current = spotRadius;
        })
        .onUpdate((e) => {
          const delta = (e.translationX + e.translationY) * 0.6;
          setSpotRadius(clamp(spotRadiusStart.current + delta, 56, 260));
        }),
    [spotRadius],
  );

  const spotlightPath = useMemo(() => {
    if (mode !== 'spotlight' || bounds.width <= 0 || bounds.height <= 0) return null;
    const outer = `M 0 0 H ${bounds.width} V ${bounds.height} H 0 Z`;
    let inner = '';
    if (spotlightShape === 'circle') {
      const r = spotRadius;
      const cx = spotCenter.x;
      const cy = spotCenter.y;
      inner = `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
    } else {
      const rw = spotRadius * 2.5;
      const rh = spotRadius * 1.7;
      const rx = spotCenter.x - rw / 2;
      const ry = spotCenter.y - rh / 2;
      inner = `M ${rx} ${ry} H ${rx + rw} V ${ry + rh} H ${rx} Z`;
    }
    return Skia.Path.MakeFromSVGString(`${outer} ${inner}`);
  }, [bounds.height, bounds.width, mode, spotCenter.x, spotCenter.y, spotRadius, spotlightShape]);

  if (!visible || bounds.width <= 0 || bounds.height <= 0) return null;

  const shadePx = Math.round(bounds.height * curtainFraction);
  const handleY =
    curtainAnchor === 'top' ? clamp(shadePx - 24, 12, bounds.height - 56) : clamp(bounds.height - shadePx - 24, 12, bounds.height - 56);

  const ringWidth = spotlightShape === 'circle' ? spotRadius * 2 : spotRadius * 2.5;
  const ringHeight = spotlightShape === 'circle' ? spotRadius * 2 : spotRadius * 1.7;
  const ringLeft = spotCenter.x - ringWidth / 2;
  const ringTop = spotCenter.y - ringHeight / 2;

  return (
    <View pointerEvents="box-none" style={styles.root}>
      {mode === 'curtain' ? (
        <>
          <View
            pointerEvents="auto"
            style={[
              styles.curtainShade,
              curtainAnchor === 'top'
                ? { top: 0, height: shadePx, borderBottomWidth: 2 }
                : { bottom: 0, height: shadePx, borderTopWidth: 2 },
            ]}
          />
          <GestureDetector gesture={curtainPan}>
            <View style={[styles.curtainHandleBar, { top: handleY }]}>
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
            </View>
          </GestureDetector>
        </>
      ) : (
        <>
          {spotlightPath && (
            <View pointerEvents="none" style={styles.spotlightCanvas}>
              <Canvas style={styles.spotlightCanvas}>
                <Path path={spotlightPath} fillType="evenOdd" color="rgba(15, 23, 42, 0.75)" />
              </Canvas>
            </View>
          )}
          <GestureDetector gesture={spotMovePan}>
            <View
              style={[
                styles.spotlightMoveRing,
                {
                  left: ringLeft,
                  top: ringTop,
                  width: ringWidth,
                  height: ringHeight,
                  borderRadius: spotlightShape === 'circle' ? spotRadius : 16,
                },
              ]}
            />
          </GestureDetector>
          <GestureDetector gesture={spotResizePan}>
            <View
              style={[
                styles.spotlightResizeHandle,
                {
                  left: ringLeft + ringWidth - 22,
                  top: ringTop + ringHeight - 22,
                },
              ]}
            >
              <View style={styles.spotlightResizeDot} />
            </View>
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
          <Text style={[styles.modeChipText, { color: mode === 'curtain' ? theme.primary : theme.foreground }]}>
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
          <Text style={[styles.modeChipText, { color: mode === 'spotlight' ? theme.primary : theme.foreground }]}>
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
            {mode === 'curtain' ? (curtainAnchor === 'top' ? 'Top' : 'Bottom') : spotlightShape === 'circle' ? 'Circle' : 'Rect'}
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
