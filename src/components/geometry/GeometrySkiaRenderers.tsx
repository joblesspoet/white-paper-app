import { memo, useMemo } from 'react';
import {
  Circle,
  DashPathEffect,
  Group,
  Line as SkiaLine,
  Path,
  RoundedRect,
  vec,
} from '@shopify/react-native-skia';

import {
  buildCompassArcPoints,
  buildProtractorAngleGeometry,
  setSquareVertices,
  type CompassState,
  type ProtractorState,
  type RulerState,
  type SetSquareState,
} from '../../canvas/geometry-box';
import { polylinePathData } from '../../canvas/shapes';
import { canvasToScreen, type Point, type Viewport } from '../../canvas/viewport';

export const GEOMETRY_TEAL_BORDER = '#0D9488';

export const RulerSkia = memo(function RulerSkia({
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
        color={GEOMETRY_TEAL_BORDER}
        style="stroke"
        strokeWidth={1.5}
      />
      <Path path={ticksPath} color={tickColor} style="stroke" strokeWidth={1} />
    </Group>
  );
});

export const ProtractorSkia = memo(function ProtractorSkia({
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
        <Path path={bodySvg} color={GEOMETRY_TEAL_BORDER} style="stroke" strokeWidth={1.5} />
        <Path path={ticksSvg} color={tickColor} style="stroke" strokeWidth={1} />
      </Group>
      <SkiaLine p1={vec(center.x, center.y)} p2={vec(r1.x, r1.y)} color={GEOMETRY_TEAL_BORDER} strokeWidth={1.5} />
      <SkiaLine p1={vec(center.x, center.y)} p2={vec(r2.x, r2.y)} color={GEOMETRY_TEAL_BORDER} strokeWidth={1.5} />
      <Path path={arcScreen} color={GEOMETRY_TEAL_BORDER} style="stroke" strokeWidth={2} />
    </>
  );
});

export const CompassSkia = memo(function CompassSkia({
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
      <Circle cx={center.x} cy={center.y} r={r} color={GEOMETRY_TEAL_BORDER} style="stroke" strokeWidth={1.2}>
        <DashPathEffect intervals={[6, 4]} />
      </Circle>
      <Circle cx={center.x} cy={center.y} r={8} color={fillBg} style="fill" />
      <Circle cx={center.x} cy={center.y} r={8} color={GEOMETRY_TEAL_BORDER} style="stroke" strokeWidth={1.5} />
      <SkiaLine p1={vec(center.x, center.y)} p2={vec(tip.x, tip.y)} color={GEOMETRY_TEAL_BORDER} strokeWidth={2} />
      {sweepPath ? (
        <Path path={sweepPath} color={penColor} style="stroke" strokeWidth={2.5} strokeCap="round" />
      ) : null}
    </>
  );
});

export const SetSquareSkia = memo(function SetSquareSkia({
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
      <Path path={svg} color={GEOMETRY_TEAL_BORDER} style="stroke" strokeWidth={1.5} strokeJoin="round" />
      <Path path={innerSvg} color={tickColor} style="stroke" strokeWidth={1} strokeJoin="round" />
    </>
  );
});
