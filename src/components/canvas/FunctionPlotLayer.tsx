import { memo, useMemo } from 'react';
import {
  Circle,
  DashPathEffect,
  Group,
  Line,
  Paragraph,
  Path,
  RoundedRect,
  Skia,
  TextAlign,
  vec,
} from '@shopify/react-native-skia';

import {
  textColorValue,
  type FunctionPlotObject,
} from '../../canvas/document';
import {
  evaluateFunctionPlot,
  plotPointToCanvas,
  type PlotDomain,
} from '../../canvas/function-plotter';
import { polylinePathData } from '../../canvas/shapes';

export type FunctionPlotLayerProps = {
  object: FunctionPlotObject;
  dark: boolean;
};

const KEY_POINT_COLORS = {
  root: '#DC2626',
  'y-intercept': '#2563EB',
  extrema: '#D97706',
} as const;

export const FunctionPlotLayer = memo(function FunctionPlotLayer({
  object,
  dark,
}: FunctionPlotLayerProps) {
  const curveColor = textColorValue(object.colorKey, dark);
  const frameBg = dark ? 'rgba(15, 23, 42, 0.78)' : 'rgba(255, 255, 255, 0.9)';
  const frameBorder = dark ? '#334155' : '#CBD5E1';
  const axisColor = dark ? '#94A3B8' : '#475569';
  const gridColor = dark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(100, 116, 139, 0.16)';

  const domain: PlotDomain = useMemo(
    () => ({
      xMin: object.xMin,
      xMax: object.xMax,
      yMin: object.yMin,
      yMax: object.yMax,
    }),
    [object.xMax, object.xMin, object.yMax, object.yMin],
  );

  const sampled = useMemo(() => evaluateFunctionPlot(object), [object]);

  const branchPaths = useMemo(() => {
    return sampled.branches
      .map((branch) => {
        const canvasPts = branch.map((pt) => plotPointToCanvas(pt, object, domain));
        return Skia.Path.MakeFromSVGString(polylinePathData(canvasPts));
      })
      .filter((p): p is NonNullable<typeof p> => Boolean(p));
  }, [domain, object, sampled.branches]);

  const axisOrigin = useMemo(
    () => plotPointToCanvas({ x: 0, y: 0 }, object, domain),
    [domain, object],
  );
  const plotLeft = object.x + 20;
  const plotRight = object.x + object.width - 20;
  const plotTop = object.y + 20;
  const plotBottom = object.y + object.height - 20;
  const showXAxis = axisOrigin.y >= plotTop && axisOrigin.y <= plotBottom;
  const showYAxis = axisOrigin.x >= plotLeft && axisOrigin.x <= plotRight;

  const keyPointMarkers = useMemo(() => {
    return sampled.keyPoints.slice(0, 6).map((kp) => {
      const pos = plotPointToCanvas({ x: kp.x, y: kp.y }, object, domain);
      const builder = Skia.ParagraphBuilder.Make({ textAlign: TextAlign.Left });
      builder.pushStyle({
        color: Skia.Color(KEY_POINT_COLORS[kp.kind]),
        fontSize: 9.5,
      });
      builder.addText(kp.label);
      const para = builder.build();
      para.layout(84);
      return { kp, pos, para };
    });
  }, [domain, object, sampled.keyPoints]);

  const tangentLine = useMemo(() => {
    if (!sampled.tangent) return null;
    const p1 = plotPointToCanvas(sampled.tangent.p1, object, domain);
    const p2 = plotPointToCanvas(sampled.tangent.p2, object, domain);
    const p0 = plotPointToCanvas({ x: sampled.tangent.x0, y: sampled.tangent.y0 }, object, domain);
    const builder = Skia.ParagraphBuilder.Make({ textAlign: TextAlign.Left });
    builder.pushStyle({ color: Skia.Color('#0D9488'), fontSize: 10 });
    builder.addText(`m = ${sampled.tangent.slope.toFixed(2)}`);
    const para = builder.build();
    para.layout(72);
    return { p1, p2, p0, para };
  }, [domain, object, sampled.tangent]);

  const headerPara = useMemo(() => {
    const builder = Skia.ParagraphBuilder.Make({ textAlign: TextAlign.Left });
    builder.pushStyle({ color: Skia.Color(axisColor), fontSize: 10 });
    builder.addText(object.latex.slice(0, 32));
    const para = builder.build();
    para.layout(Math.max(40, object.width - 24));
    return para;
  }, [axisColor, object.latex, object.width]);

  const origin = useMemo(
    () => ({ x: object.x + object.width / 2, y: object.y + object.height / 2 }),
    [object.height, object.width, object.x, object.y],
  );
  const transform = useMemo(
    () => (object.rotation === 0 ? undefined : [{ rotate: (object.rotation * Math.PI) / 180 }]),
    [object.rotation],
  );

  return (
    <Group origin={origin} transform={transform}>
      <RoundedRect
        x={object.x}
        y={object.y}
        width={object.width}
        height={object.height}
        r={8}
        color={frameBg}
      />
      <RoundedRect
        x={object.x}
        y={object.y}
        width={object.width}
        height={object.height}
        r={8}
        color={frameBorder}
        style="stroke"
        strokeWidth={1.2}
      />

      <Paragraph paragraph={headerPara} x={object.x + 10} y={object.y + 4} width={Math.max(40, object.width - 20)} />

      {/* Subtle quadrant grid */}
      {[0.25, 0.5, 0.75].map((frac) => {
        const gx = plotLeft + (plotRight - plotLeft) * frac;
        const gy = plotTop + (plotBottom - plotTop) * frac;
        return (
          <Group key={`grid-${frac}`}>
            <Line p1={vec(gx, plotTop)} p2={vec(gx, plotBottom)} color={gridColor} strokeWidth={1} />
            <Line p1={vec(plotLeft, gy)} p2={vec(plotRight, gy)} color={gridColor} strokeWidth={1} />
          </Group>
        );
      })}

      {/* Coordinate axes */}
      {showXAxis && (
        <Line p1={vec(plotLeft, axisOrigin.y)} p2={vec(plotRight, axisOrigin.y)} color={axisColor} strokeWidth={1.25} />
      )}
      {showYAxis && (
        <Line p1={vec(axisOrigin.x, plotTop)} p2={vec(axisOrigin.x, plotBottom)} color={axisColor} strokeWidth={1.25} />
      )}

      {/* Sampled curve branches */}
      {branchPaths.map((path, idx) => (
        <Path
          key={`branch-${idx}`}
          path={path}
          color={curveColor}
          style="stroke"
          strokeWidth={2.5}
          strokeCap="round"
          strokeJoin="round"
        />
      ))}

      {/* Optional tangent line */}
      {tangentLine && (
        <Group>
          <Line
            p1={vec(tangentLine.p1.x, tangentLine.p1.y)}
            p2={vec(tangentLine.p2.x, tangentLine.p2.y)}
            color="#0D9488"
            strokeWidth={1.8}
          >
            <DashPathEffect intervals={[5, 3]} />
          </Line>
          <Circle cx={tangentLine.p0.x} cy={tangentLine.p0.y} r={4} color="#0D9488" />
          <Paragraph paragraph={tangentLine.para} x={tangentLine.p0.x + 6} y={tangentLine.p0.y - 14} width={72} />
        </Group>
      )}

      {/* Key-point markers: roots, y-intercept, extrema */}
      {keyPointMarkers.map(({ kp, pos, para }, idx) => (
        <Group key={`kp-${kp.kind}-${idx}`}>
          <Circle cx={pos.x} cy={pos.y} r={4} color={KEY_POINT_COLORS[kp.kind]} />
          <Paragraph
            paragraph={para}
            x={Math.min(plotRight - 64, pos.x + 6)}
            y={Math.max(plotTop, pos.y - 12)}
            width={84}
          />
        </Group>
      ))}
    </Group>
  );
});
