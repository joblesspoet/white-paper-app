import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import {
  RULER_MAX_LENGTH,
  RULER_MIN_LENGTH,
  buildCompassArcPoints,
  buildProtractorAngleGeometry,
  normalizeAngleDeg,
  snapAngleDeg,
  type GeometryInstrumentState,
  type InstrumentKind,
} from '../canvas/geometry-box';
import { canvasToScreen, type Point, type Viewport } from '../canvas/viewport';
import { type ThemeColors } from '../theme';
import { GeometryHudBar } from './geometry/GeometryHudBar';
import {
  CompassSkia,
  GEOMETRY_TEAL_BORDER,
  ProtractorSkia,
  RulerSkia,
  SetSquareSkia,
} from './geometry/GeometrySkiaRenderers';
import { styles } from './GeometryBoxOverlay.styles';
import { EditIcon, MoveIcon, ResizeHorizontalIcon, RotateIcon } from './icons';

type GeometryBoxOverlayProps = {
  instrument: GeometryInstrumentState;
  viewport: Viewport;
  dark: boolean;
  theme: ThemeColors;
  penColor: string;
  onChangeInstrument: (next: GeometryInstrumentState) => void;
  onSwitchInstrument: (kind: InstrumentKind) => void;
  onCommitStroke: (points: readonly Point[]) => void;
  onClose: () => void;
};

export const GeometryBoxOverlay = memo(function GeometryBoxOverlay({
  instrument,
  viewport,
  dark,
  theme,
  penColor,
  onChangeInstrument,
  onSwitchInstrument,
  onCommitStroke,
  onClose,
}: GeometryBoxOverlayProps) {
  const fillBg = dark ? 'rgba(16, 59, 55, 0.88)' : 'rgba(240, 253, 250, 0.88)';
  const tickColor = dark ? '#99F6E4' : '#134E4A';
  const [compassSweep, setCompassSweep] = useState<{ startDeg: number; currentDeg: number } | null>(null);
  const { width: windowWidth } = useWindowDimensions();
  const isCompactScreen = windowWidth < 600;
  const [hudExpanded, setHudExpanded] = useState(!isCompactScreen);
  const [angleDrawnFlash, setAngleDrawnFlash] = useState(false);

  const toggleHudExpanded = useCallback(() => {
    setHudExpanded((prev) => !prev);
  }, []);

  const instrumentRef = useRef(instrument);
  instrumentRef.current = instrument;
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  const pendingInstrumentRef = useRef<GeometryInstrumentState | null>(null);
  const rafRef = useRef<number | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  /** Coalesces rapid pointer moves to at most one state commit per animation frame. */
  const scheduleInstrumentUpdate = useCallback(
    (next: GeometryInstrumentState) => {
      pendingInstrumentRef.current = next;
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const pending = pendingInstrumentRef.current;
        if (pending) {
          pendingInstrumentRef.current = null;
          onChangeInstrument(pending);
        }
      });
    },
    [onChangeInstrument],
  );

  const flushInstrumentUpdate = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const pending = pendingInstrumentRef.current;
    if (pending) {
      pendingInstrumentRef.current = null;
      onChangeInstrument(pending);
    }
  }, [onChangeInstrument]);

  const centerScreen = canvasToScreen({ x: instrument.x, y: instrument.y }, viewport);

  // Move handle PanResponder
  const moveOriginRef = useRef<Point>({ x: instrument.x, y: instrument.y });
  const moveResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          moveOriginRef.current = { x: instrumentRef.current.x, y: instrumentRef.current.y };
        },
        onPanResponderMove: (_, gesture) => {
          const s = viewportRef.current.scale;
          scheduleInstrumentUpdate({
            ...instrumentRef.current,
            x: moveOriginRef.current.x + gesture.dx / s,
            y: moveOriginRef.current.y + gesture.dy / s,
          });
        },
        onPanResponderRelease: flushInstrumentUpdate,
        onPanResponderTerminate: flushInstrumentUpdate,
      }),
    [flushInstrumentUpdate, scheduleInstrumentUpdate],
  );

  // Rotate handle PanResponder
  const rotateStartRef = useRef<number>(0);
  const rotateHandleResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          rotateStartRef.current = instrumentRef.current.angleDeg;
        },
        onPanResponderMove: (_, gesture) => {
          const cur = instrumentRef.current;
          if (cur.kind === 'compass') return;
          const deltaDeg = (gesture.dy + gesture.dx) * 0.45;
          const snapped = snapAngleDeg(rotateStartRef.current + deltaDeg);
          scheduleInstrumentUpdate({ ...cur, angleDeg: snapped });
        },
        onPanResponderRelease: flushInstrumentUpdate,
        onPanResponderTerminate: flushInstrumentUpdate,
      }),
    [flushInstrumentUpdate, scheduleInstrumentUpdate],
  );

  // Ruler length resize handle
  const rulerLenStartRef = useRef(360);
  const rulerLengthResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          const cur = instrumentRef.current;
          if (cur.kind === 'ruler') rulerLenStartRef.current = cur.length;
        },
        onPanResponderMove: (_, gesture) => {
          const cur = instrumentRef.current;
          if (cur.kind !== 'ruler') return;
          const rad = (cur.angleDeg * Math.PI) / 180;
          const proj =
            (gesture.dx * Math.cos(rad) + gesture.dy * Math.sin(rad)) / viewportRef.current.scale;
          const nextLen = Math.max(
            RULER_MIN_LENGTH,
            Math.min(RULER_MAX_LENGTH, Math.round(rulerLenStartRef.current + proj * 2)),
          );
          scheduleInstrumentUpdate({ ...cur, length: nextLen });
        },
        onPanResponderRelease: flushInstrumentUpdate,
        onPanResponderTerminate: flushInstrumentUpdate,
      }),
    [flushInstrumentUpdate, scheduleInstrumentUpdate],
  );

  // Compass pencil sweep handle
  const compassStartDegRef = useRef(0);
  const compassCurrentDegRef = useRef(0);
  const compassSweepResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          const cur = instrumentRef.current;
          if (cur.kind !== 'compass') return;
          compassStartDegRef.current = cur.angleDeg;
          compassCurrentDegRef.current = cur.angleDeg;
          setCompassSweep({ startDeg: cur.angleDeg, currentDeg: cur.angleDeg });
        },
        onPanResponderMove: (_, gesture) => {
          const cur = instrumentRef.current;
          if (cur.kind !== 'compass') return;
          const deltaDeg = (gesture.dx - gesture.dy) * 0.65;
          const nextDeg = compassStartDegRef.current + deltaDeg;
          compassCurrentDegRef.current = nextDeg;
          setCompassSweep({ startDeg: compassStartDegRef.current, currentDeg: nextDeg });
          scheduleInstrumentUpdate({ ...cur, angleDeg: normalizeAngleDeg(nextDeg) });
        },
        onPanResponderRelease: () => {
          flushInstrumentUpdate();
          const cur = instrumentRef.current;
          if (cur.kind === 'compass') {
            const sweep = Math.abs(compassCurrentDegRef.current - compassStartDegRef.current);
            if (sweep >= 4) {
              const pts = buildCompassArcPoints(
                { x: cur.x, y: cur.y },
                cur.radius,
                compassStartDegRef.current,
                compassCurrentDegRef.current,
              );
              onCommitStroke(pts);
            }
          }
          setCompassSweep(null);
        },
        onPanResponderTerminate: () => {
          flushInstrumentUpdate();
          setCompassSweep(null);
        },
      }),
    [flushInstrumentUpdate, onCommitStroke, scheduleInstrumentUpdate],
  );

  // Compute handle screen positions
  const handlePositions = useMemo(() => {
    const s = viewport.scale;
    if (instrument.kind === 'ruler') {
      const rad = (instrument.angleDeg * Math.PI) / 180;
      const halfLen = (instrument.length * s) / 2;
      const halfW = (instrument.width * s) / 2;
      return {
        rotate: {
          x: centerScreen.x + (halfW + 26) * Math.sin(rad),
          y: centerScreen.y - (halfW + 26) * Math.cos(rad),
        },
        end: {
          x: centerScreen.x + halfLen * Math.cos(rad),
          y: centerScreen.y + halfLen * Math.sin(rad),
        },
      };
    }
    if (instrument.kind === 'protractor') {
      const rad = (instrument.angleDeg * Math.PI) / 180;
      const r = instrument.radius * s;
      return {
        rotate: {
          x: centerScreen.x + (r + 22) * Math.sin(rad),
          y: centerScreen.y - (r + 22) * Math.cos(rad),
        },
      };
    }
    if (instrument.kind === 'compass') {
      const rad = (instrument.angleDeg * Math.PI) / 180;
      const r = instrument.radius * s;
      return {
        pencil: {
          x: centerScreen.x + r * Math.cos(rad),
          y: centerScreen.y + r * Math.sin(rad),
        },
      };
    }
    const rad = (instrument.angleDeg * Math.PI) / 180;
    const offset = instrument.size * s * 0.45;
    return {
      rotate: {
        x: centerScreen.x + offset * Math.sin(rad),
        y: centerScreen.y - offset * Math.cos(rad),
      },
    };
  }, [centerScreen.x, centerScreen.y, instrument, viewport.scale]);

  const readoutText = useMemo(() => {
    if (instrument.kind === 'ruler') {
      const cm = (instrument.length / 38).toFixed(1);
      return `${Math.round(instrument.angleDeg)}° · ${Math.round(instrument.length)}px (${cm}cm)`;
    }
    if (instrument.kind === 'protractor') {
      return `Base ${Math.round(instrument.angleDeg)}° · Sweep ${Math.round(instrument.sweepAngleDeg)}°`;
    }
    if (instrument.kind === 'compass') {
      return `r = ${Math.round(instrument.radius)}px`;
    }
    const label = instrument.kind === 'set-square-45' ? '45° Square' : '30°–60° Square';
    return `${label} · ${Math.round(instrument.angleDeg)}°`;
  }, [instrument]);

  const handleDrawProtractorAngle = useCallback(() => {
    if (instrument.kind !== 'protractor') return;
    const geo = buildProtractorAngleGeometry(instrument);
    onCommitStroke([geo.ray1End, geo.vertex, geo.ray2End]);
    onCommitStroke(geo.arcPoints);
    setAngleDrawnFlash(true);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setAngleDrawnFlash(false), 1400);
    if (isCompactScreen) setHudExpanded(false);
  }, [instrument, isCompactScreen, onCommitStroke]);

  const handleDrawCompassCircle = useCallback(() => {
    if (instrument.kind !== 'compass') return;
    const pts = buildCompassArcPoints(
      { x: instrument.x, y: instrument.y },
      instrument.radius,
      0,
      360,
    );
    onCommitStroke(pts);
  }, [instrument, onCommitStroke]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Skia Instrument Surface */}
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        {instrument.kind === 'ruler' ? (
          <RulerSkia
            ruler={instrument}
            viewport={viewport}
            fillBg={fillBg}
            tickColor={tickColor}
          />
        ) : instrument.kind === 'protractor' ? (
          <ProtractorSkia
            protractor={instrument}
            viewport={viewport}
            fillBg={fillBg}
            tickColor={tickColor}
          />
        ) : instrument.kind === 'compass' ? (
          <CompassSkia
            compass={instrument}
            viewport={viewport}
            fillBg={fillBg}
            penColor={penColor}
            sweep={compassSweep}
          />
        ) : (
          <SetSquareSkia
            setSquare={instrument}
            viewport={viewport}
            fillBg={fillBg}
            tickColor={tickColor}
          />
        )}
      </Canvas>

      {/* Center Move Handle (44x44pt) */}
      <View
        {...moveResponder.panHandlers}
        accessibilityRole="adjustable"
        accessibilityLabel="Move geometry instrument"
        style={[
          styles.handle,
          {
            left: centerScreen.x - 22,
            top: centerScreen.y - 22,
            backgroundColor: theme.surface,
            borderColor: GEOMETRY_TEAL_BORDER,
          },
        ]}
      >
        <MoveIcon size={18} color={GEOMETRY_TEAL_BORDER} />
      </View>

      {/* Rotate Handle (44x44pt) for Ruler, Protractor, Set Square */}
      {handlePositions.rotate ? (
        <View
          {...rotateHandleResponder.panHandlers}
          accessibilityRole="adjustable"
          accessibilityLabel="Rotate geometry instrument"
          style={[
            styles.handle,
            {
              left: handlePositions.rotate.x - 22,
              top: handlePositions.rotate.y - 22,
              backgroundColor: theme.surface,
              borderColor: GEOMETRY_TEAL_BORDER,
            },
          ]}
        >
          <RotateIcon size={18} color={GEOMETRY_TEAL_BORDER} />
        </View>
      ) : null}

      {/* Ruler Length Handle */}
      {handlePositions.end ? (
        <View
          {...rulerLengthResponder.panHandlers}
          accessibilityRole="adjustable"
          accessibilityLabel="Resize ruler length"
          style={[
            styles.handle,
            {
              left: handlePositions.end.x - 22,
              top: handlePositions.end.y - 22,
              backgroundColor: theme.surface,
              borderColor: GEOMETRY_TEAL_BORDER,
            },
          ]}
        >
          <ResizeHorizontalIcon size={18} color={GEOMETRY_TEAL_BORDER} />
        </View>
      ) : null}

      {/* Compass Pencil Sweep Handle */}
      {handlePositions.pencil ? (
        <View
          {...compassSweepResponder.panHandlers}
          accessibilityRole="adjustable"
          accessibilityLabel="Drag compass pencil to draw arc"
          style={[
            styles.handle,
            {
              left: handlePositions.pencil.x - 22,
              top: handlePositions.pencil.y - 22,
              backgroundColor: penColor,
              borderColor: theme.surface,
            },
          ]}
        >
          <EditIcon size={18} color="#FFFFFF" />
        </View>
      ) : null}

      <GeometryHudBar
        instrument={instrument}
        theme={theme}
        hudExpanded={hudExpanded}
        readoutText={readoutText}
        angleDrawnFlash={angleDrawnFlash}
        onToggleHudExpanded={toggleHudExpanded}
        onSwitchInstrument={onSwitchInstrument}
        onChangeInstrument={onChangeInstrument}
        onDrawProtractorAngle={handleDrawProtractorAngle}
        onDrawCompassCircle={handleDrawCompassCircle}
        onClose={onClose}
      />
    </View>
  );
});
