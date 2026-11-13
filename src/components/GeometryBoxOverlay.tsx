import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { Canvas, Circle, DashPathEffect, Group, Line as SkiaLine, Path, RoundedRect, vec } from '@shopify/react-native-skia';
import {
  COMPASS_MAX_RADIUS,
  COMPASS_MIN_RADIUS,
  RULER_MAX_LENGTH,
  RULER_MIN_LENGTH,
  buildCompassArcPoints,
  buildProtractorAngleGeometry,
  normalizeAngleDeg,
  setSquareVertices,
  snapAngleDeg,
  type CompassState,
  type GeometryInstrumentState,
  type InstrumentKind,
  type ProtractorState,
  type RulerState,
  type SetSquareState,
} from '../canvas/geometry-box';
import { polylinePathData } from '../canvas/shapes';
import { canvasToScreen, type Point, type Viewport } from '../canvas/viewport';
import { type ThemeColors } from '../theme';
import { styles } from './GeometryBoxOverlay.styles';

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

const INSTRUMENT_TABS: ReadonlyArray<{ kind: InstrumentKind; label: string }> = [
  { kind: 'ruler', label: 'Ruler' },
  { kind: 'protractor', label: 'Protractor' },
  { kind: 'compass', label: 'Compass' },
  { kind: 'set-square-45', label: '45°' },
  { kind: 'set-square-30-60', label: '30–60°' },
];

const TEAL_BORDER = '#0D9488';

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

  const instrumentRef = useRef(instrument);
  instrumentRef.current = instrument;
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

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
          onChangeInstrument({
            ...instrumentRef.current,
            x: moveOriginRef.current.x + gesture.dx / s,
            y: moveOriginRef.current.y + gesture.dy / s,
          });
        },
      }),
    [onChangeInstrument],
  );

  // Rotate handle PanResponder
  const rotateResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderMove: (evt) => {
          const cur = instrumentRef.current;
          if (cur.kind === 'compass') return;
          const center = canvasToScreen({ x: cur.x, y: cur.y }, viewportRef.current);
          const pageX = evt.nativeEvent.locationX;
          const pageY = evt.nativeEvent.locationY;
          // Use moveX/moveY relative to center via page coords if available, fallback to atan2
          void pageX;
          void pageY;
          void center;
        },
      }),
    [],
  );
  void rotateResponder;

  // Better rotate using gesture.moveX / gesture.moveY delta from initial angle
  const rotateStartRef = useRef<{ baseAngle: number; startPointerAngle: number }>({
    baseAngle: 0,
    startPointerAngle: 0,
  });
  const rotateHandleResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (_, gesture) => {
          const cur = instrumentRef.current;
          const baseAngle = cur.kind === 'compass' ? cur.angleDeg : cur.angleDeg;
          rotateStartRef.current = {
            baseAngle,
            startPointerAngle: gesture.x0,
          };
        },
        onPanResponderMove: (_, gesture) => {
          const cur = instrumentRef.current;
          if (cur.kind === 'compass') return;
          // Smooth angular adjustment: 180pt horizontal or vertical drag = 90°
          const deltaDeg = (gesture.dy + gesture.dx) * 0.45;
          const snapped = snapAngleDeg(rotateStartRef.current.baseAngle + deltaDeg);
          onChangeInstrument({ ...cur, angleDeg: snapped });
        },
      }),
    [onChangeInstrument],
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
          const proj = (gesture.dx * Math.cos(rad) + gesture.dy * Math.sin(rad)) / viewportRef.current.scale;
          const nextLen = Math.max(
            RULER_MIN_LENGTH,
            Math.min(RULER_MAX_LENGTH, Math.round(rulerLenStartRef.current + proj * 2)),
          );
          onChangeInstrument({ ...cur, length: nextLen });
        },
      }),
    [onChangeInstrument],
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
          onChangeInstrument({ ...cur, angleDeg: normalizeAngleDeg(nextDeg) });
        },
        onPanResponderRelease: () => {
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
          setCompassSweep(null);
        },
      }),
    [onChangeInstrument, onCommitStroke],
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
    // Set square
    const rad = (instrument.angleDeg * Math.PI) / 180;
    const offset = (instrument.size * s) * 0.45;
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
            borderColor: TEAL_BORDER,
          },
        ]}
      >
        <Text style={[styles.handleIcon, { color: TEAL_BORDER }]}>✛</Text>
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
              borderColor: TEAL_BORDER,
            },
          ]}
        >
          <Text style={[styles.handleIcon, { color: TEAL_BORDER }]}>↻</Text>
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
              borderColor: TEAL_BORDER,
            },
          ]}
        >
          <Text style={[styles.handleIcon, { color: TEAL_BORDER }]}>↔</Text>
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
          <Text style={[styles.handleIcon, { color: '#FFFFFF' }]}>✎</Text>
        </View>
      ) : null}

      {/* Compact Geometry Box HUD Bar */}
      <View
        style={[
          styles.hudBar,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
          },
        ]}
      >
        <View style={styles.tabRow}>
          {INSTRUMENT_TABS.map((tab) => (
            <InstrumentTab
              key={tab.kind}
              kind={tab.kind}
              label={tab.label}
              active={instrument.kind === tab.kind}
              theme={theme}
              onSelect={onSwitchInstrument}
            />
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close geometry box"
            onPress={onClose}
            style={[styles.closeChip, { borderColor: theme.border }]}
          >
            <Text style={[styles.closeIconText, { color: theme.foreground }]}>×</Text>
          </Pressable>
        </View>

        <View style={styles.actionRow}>
          <Text style={[styles.readout, { color: theme.foreground }]}>{readoutText}</Text>

          {instrument.kind === 'protractor' ? (
            <View style={styles.inlineActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  onChangeInstrument({
                    ...instrument,
                    sweepAngleDeg: Math.min(360, instrument.sweepAngleDeg + 15),
                  })
                }
                style={[styles.smallBtn, { borderColor: theme.border }]}
              >
                <Text style={[styles.smallBtnText, { color: theme.foreground }]}>+15°</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  onChangeInstrument({
                    ...instrument,
                    sweepAngleDeg: Math.max(15, instrument.sweepAngleDeg - 15),
                  })
                }
                style={[styles.smallBtn, { borderColor: theme.border }]}
              >
                <Text style={[styles.smallBtnText, { color: theme.foreground }]}>-15°</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  onChangeInstrument({ ...instrument, fullCircle: !instrument.fullCircle })
                }
                style={[styles.smallBtn, { borderColor: theme.border }]}
              >
                <Text style={[styles.smallBtnText, { color: theme.foreground }]}>
                  {instrument.fullCircle ? '180°' : '360°'}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  const geo = buildProtractorAngleGeometry(instrument);
                  onCommitStroke([geo.ray1End, geo.vertex, geo.ray2End]);
                  onCommitStroke(geo.arcPoints);
                }}
                style={[styles.primaryBtn, { backgroundColor: TEAL_BORDER }]}
              >
                <Text style={styles.primaryBtnText}>Draw angle</Text>
              </Pressable>
            </View>
          ) : null}

          {instrument.kind === 'compass' ? (
            <View style={styles.inlineActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  onChangeInstrument({
                    ...instrument,
                    radius: Math.max(COMPASS_MIN_RADIUS, instrument.radius - 16),
                  })
                }
                style={[styles.smallBtn, { borderColor: theme.border }]}
              >
                <Text style={[styles.smallBtnText, { color: theme.foreground }]}>- r</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  onChangeInstrument({
                    ...instrument,
                    radius: Math.min(COMPASS_MAX_RADIUS, instrument.radius + 16),
                  })
                }
                style={[styles.smallBtn, { borderColor: theme.border }]}
              >
                <Text style={[styles.smallBtnText, { color: theme.foreground }]}>+ r</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  const pts = buildCompassArcPoints(
                    { x: instrument.x, y: instrument.y },
                    instrument.radius,
                    0,
                    360,
                  );
                  onCommitStroke(pts);
                }}
                style={[styles.primaryBtn, { backgroundColor: TEAL_BORDER }]}
              >
                <Text style={styles.primaryBtnText}>Full circle</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
});

const RulerSkia = memo(function RulerSkia({
  ruler,
  viewport,
  fillBg,
  tickColor,
}: {
  ruler: RulerState;
  viewport: Viewport;
  fillBg: string;
  tickColor: string;
}) {
  const s = viewport.scale;
  const center = canvasToScreen({ x: ruler.x, y: ruler.y }, viewport);
  const w = ruler.length * s;
  const h = ruler.width * s;
  const left = center.x - w / 2;
  const top = center.y - h / 2;

  const ticksPath = useMemo(() => {
    const cmds: string[] = [];
    const step = 10;
    for (let cx = 0; cx <= ruler.length; cx += step) {
      const sx = left + cx * s;
      const isMajor = cx % 50 === 0;
      const tickLen = isMajor ? 14 : 7;
      cmds.push(`M ${sx} ${top} L ${sx} ${top + tickLen}`);
      cmds.push(`M ${sx} ${top + h} L ${sx} ${top + h - tickLen}`);
    }
    return cmds.join(' ');
  }, [h, left, ruler.length, s, top]);

  return (
    <Group
      origin={vec(center.x, center.y)}
      transform={[{ rotate: (ruler.angleDeg * Math.PI) / 180 }]}
    >
      <RoundedRect x={left} y={top} width={w} height={h} r={6} color={fillBg} style="fill" />
      <RoundedRect
        x={left}
        y={top}
        width={w}
        height={h}
        r={6}
        color={TEAL_BORDER}
        style="stroke"
        strokeWidth={1.5}
      />
      <Path path={ticksPath} color={tickColor} style="stroke" strokeWidth={1} />
    </Group>
  );
});

const ProtractorSkia = memo(function ProtractorSkia({
  protractor,
  viewport,
  fillBg,
  tickColor,
}: {
  protractor: ProtractorState;
  viewport: Viewport;
  fillBg: string;
  tickColor: string;
}) {
  const s = viewport.scale;
  const center = canvasToScreen({ x: protractor.x, y: protractor.y }, viewport);
  const r = protractor.radius * s;

  const bodySvg = useMemo(() => {
    if (protractor.fullCircle) {
      return (
        `M ${center.x - r} ${center.y} ` +
        `A ${r} ${r} 0 1 0 ${center.x + r} ${center.y} ` +
        `A ${r} ${r} 0 1 0 ${center.x - r} ${center.y} Z`
      );
    }
    return (
      `M ${center.x - r} ${center.y} ` +
      `A ${r} ${r} 0 0 1 ${center.x + r} ${center.y} Z`
    );
  }, [center.x, center.y, protractor.fullCircle, r]);

  const ticksSvg = useMemo(() => {
    const maxDeg = protractor.fullCircle ? 360 : 180;
    const cmds: string[] = [];
    for (let deg = 0; deg <= maxDeg; deg += 5) {
      const rad = (-deg * Math.PI) / 180;
      const inner = deg % 10 === 0 ? r - 12 : r - 6;
      cmds.push(
        `M ${center.x + inner * Math.cos(rad)} ${center.y + inner * Math.sin(rad)} ` +
          `L ${center.x + r * Math.cos(rad)} ${center.y + r * Math.sin(rad)}`,
      );
    }
    return cmds.join(' ');
  }, [center.x, center.y, protractor.fullCircle, r]);

  const geo = useMemo(() => buildProtractorAngleGeometry(protractor), [protractor]);
  const r1 = canvasToScreen(geo.ray1End, viewport);
  const r2 = canvasToScreen(geo.ray2End, viewport);
  const arcScreen = useMemo(
    () => polylinePathData(geo.arcPoints.map((pt) => canvasToScreen(pt, viewport))),
    [geo.arcPoints, viewport],
  );

  return (
    <>
      <Group
        origin={vec(center.x, center.y)}
        transform={[{ rotate: (protractor.angleDeg * Math.PI) / 180 }]}
      >
        <Path path={bodySvg} color={fillBg} style="fill" />
        <Path path={bodySvg} color={TEAL_BORDER} style="stroke" strokeWidth={1.5} />
        <Path path={ticksSvg} color={tickColor} style="stroke" strokeWidth={1} />
      </Group>
      <SkiaLine p1={vec(center.x, center.y)} p2={vec(r1.x, r1.y)} color={TEAL_BORDER} strokeWidth={1.5} />
      <SkiaLine p1={vec(center.x, center.y)} p2={vec(r2.x, r2.y)} color={TEAL_BORDER} strokeWidth={1.5} />
      <Path path={arcScreen} color={TEAL_BORDER} style="stroke" strokeWidth={2} />
    </>
  );
});

const CompassSkia = memo(function CompassSkia({
  compass,
  viewport,
  fillBg,
  penColor,
  sweep,
}: {
  compass: CompassState;
  viewport: Viewport;
  fillBg: string;
  penColor: string;
  sweep: { startDeg: number; currentDeg: number } | null;
}) {
  const s = viewport.scale;
  const center = canvasToScreen({ x: compass.x, y: compass.y }, viewport);
  const r = compass.radius * s;
  const rad = (compass.angleDeg * Math.PI) / 180;
  const tip = { x: center.x + r * Math.cos(rad), y: center.y + r * Math.sin(rad) };

  const sweepPath = useMemo(() => {
    if (!sweep) return null;
    const pts = buildCompassArcPoints(
      { x: compass.x, y: compass.y },
      compass.radius,
      sweep.startDeg,
      sweep.currentDeg,
    ).map((pt) => canvasToScreen(pt, viewport));
    return polylinePathData(pts);
  }, [compass.radius, compass.x, compass.y, sweep, viewport]);

  return (
    <>
      <Circle cx={center.x} cy={center.y} r={r} color={TEAL_BORDER} style="stroke" strokeWidth={1.2}>
        <DashPathEffect intervals={[6, 4]} />
      </Circle>
      <Circle cx={center.x} cy={center.y} r={8} color={fillBg} style="fill" />
      <Circle cx={center.x} cy={center.y} r={8} color={TEAL_BORDER} style="stroke" strokeWidth={1.5} />
      <SkiaLine p1={vec(center.x, center.y)} p2={vec(tip.x, tip.y)} color={TEAL_BORDER} strokeWidth={2} />
      {sweepPath ? (
        <Path path={sweepPath} color={penColor} style="stroke" strokeWidth={2.5} strokeCap="round" />
      ) : null}
    </>
  );
});

const SetSquareSkia = memo(function SetSquareSkia({
  setSquare,
  viewport,
  fillBg,
  tickColor,
}: {
  setSquare: SetSquareState;
  viewport: Viewport;
  fillBg: string;
  tickColor: string;
}) {
  const verts = useMemo(
    () => setSquareVertices(setSquare).map((v) => canvasToScreen(v, viewport)),
    [setSquare, viewport],
  );
  const svg = useMemo(
    () => `M ${verts[0].x} ${verts[0].y} L ${verts[1].x} ${verts[1].y} L ${verts[2].x} ${verts[2].y} Z`,
    [verts],
  );
  const cx = (verts[0].x + verts[1].x + verts[2].x) / 3;
  const cy = (verts[0].y + verts[1].y + verts[2].y) / 3;
  const innerSvg = useMemo(() => {
    const shrink = (p: Point) => ({ x: cx + (p.x - cx) * 0.48, y: cy + (p.y - cy) * 0.48 });
    const i0 = shrink(verts[0]);
    const i1 = shrink(verts[1]);
    const i2 = shrink(verts[2]);
    return `M ${i0.x} ${i0.y} L ${i1.x} ${i1.y} L ${i2.x} ${i2.y} Z`;
  }, [cx, cy, verts]);

  return (
    <>
      <Path path={svg} color={fillBg} style="fill" />
      <Path path={svg} color={TEAL_BORDER} style="stroke" strokeWidth={1.5} strokeJoin="round" />
      <Path path={innerSvg} color={tickColor} style="stroke" strokeWidth={1} strokeJoin="round" />
    </>
  );
});

const InstrumentTab = memo(function InstrumentTab({
  kind,
  label,
  active,
  theme,
  onSelect,
}: {
  kind: InstrumentKind;
  label: string;
  active: boolean;
  theme: ThemeColors;
  onSelect: (kind: InstrumentKind) => void;
}) {
  const handlePress = useCallback(() => {
    onSelect(kind);
  }, [kind, onSelect]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={handlePress}
      style={[
        styles.tabChip,
        {
          backgroundColor: active ? TEAL_BORDER : theme.background,
          borderColor: active ? TEAL_BORDER : theme.border,
        },
      ]}
    >
      <Text
        style={[
          styles.tabText,
          { color: active ? '#FFFFFF' : theme.foreground },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
});
