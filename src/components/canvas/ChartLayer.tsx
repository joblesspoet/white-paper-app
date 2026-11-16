import { memo, useMemo } from 'react';
import {
  Circle,
  Group,
  Line,
  Paragraph,
  Path,
  Rect,
  RoundedRect,
  Skia,
  TextAlign,
  vec,
} from '@shopify/react-native-skia';

import { buildChartRenderPrimitives } from '../../canvas/chart-generator';
import { textColorValue, type ChartObject } from '../../canvas/document';
import { polylinePathData } from '../../canvas/shapes';

export type ChartLayerProps = {
  object: ChartObject;
  dark: boolean;
};

export const ChartLayer = memo(function ChartLayer({ object, dark }: ChartLayerProps) {
  const frameBg = dark ? 'rgba(15, 23, 42, 0.82)' : 'rgba(255, 255, 255, 0.94)';
  const frameBorder = dark ? '#334155' : '#CBD5E1';
  const labelColor = dark ? '#CBD5E1' : '#334155';
  const axisColor = dark ? '#64748B' : '#94A3B8';

  const primitives = useMemo(() => buildChartRenderPrimitives(object), [object]);

  const titlePara = useMemo(() => {
    const builder = Skia.ParagraphBuilder.Make({ textAlign: TextAlign.Left });
    builder.pushStyle({ color: Skia.Color(labelColor), fontSize: 11 });
    builder.addText(object.title);
    const para = builder.build();
    para.layout(Math.max(60, object.width - 24));
    return para;
  }, [labelColor, object.title, object.width]);

  const xLabelParas = useMemo(() => {
    return primitives.xLabels.map((item) => {
      const builder = Skia.ParagraphBuilder.Make({ textAlign: TextAlign.Center });
      builder.pushStyle({ color: Skia.Color(labelColor), fontSize: 9.5 });
      builder.addText(item.text);
      const para = builder.build();
      para.layout(54);
      return { ...item, para };
    });
  }, [labelColor, primitives.xLabels]);

  const yTickParas = useMemo(() => {
    return primitives.yTicks.map((tick) => {
      const builder = Skia.ParagraphBuilder.Make({ textAlign: TextAlign.Right });
      builder.pushStyle({ color: Skia.Color(labelColor), fontSize: 9 });
      builder.addText(tick.label);
      const para = builder.build();
      para.layout(32);
      return { ...tick, para };
    });
  }, [labelColor, primitives.yTicks]);

  const pieSlices = useMemo(() => {
    return primitives.pieSlices.map((slice) => {
      const path = Skia.Path.MakeFromSVGString(slice.pathSvg);
      const builder = Skia.ParagraphBuilder.Make({ textAlign: TextAlign.Left });
      builder.pushStyle({ color: Skia.Color(labelColor), fontSize: 9.5 });
      builder.addText(`${slice.label.slice(0, 10)} (${slice.percentLabel})`);
      const legendPara = builder.build();
      legendPara.layout(96);
      return { ...slice, path, legendPara };
    });
  }, [labelColor, primitives.pieSlices]);

  const linePaths = useMemo(() => {
    return primitives.lines.map((line) => ({
      ...line,
      path: Skia.Path.MakeFromSVGString(polylinePathData(line.points)),
    }));
  }, [primitives.lines]);

  const origin = useMemo(
    () => ({ x: object.x + object.width / 2, y: object.y + object.height / 2 }),
    [object.height, object.width, object.x, object.y],
  );
  const transform = useMemo(
    () => (object.rotation === 0 ? undefined : [{ rotate: (object.rotation * Math.PI) / 180 }]),
    [object.rotation],
  );

  const { plotArea } = primitives;

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

      <Paragraph
        paragraph={titlePara}
        x={object.x + 12}
        y={object.y + 8}
        width={Math.max(60, object.width - 24)}
      />

      {object.chartType !== 'pie' && (
        <Group>
          {/* Axes */}
          <Line
            p1={vec(plotArea.x, plotArea.y)}
            p2={vec(plotArea.x, plotArea.y + plotArea.height)}
            color={axisColor}
            strokeWidth={1}
          />
          <Line
            p1={vec(plotArea.x, plotArea.y + plotArea.height)}
            p2={vec(plotArea.x + plotArea.width, plotArea.y + plotArea.height)}
            color={axisColor}
            strokeWidth={1}
          />
          {yTickParas.map((tick, idx) => (
            <Group key={`yt-${idx}`}>
              <Line
                p1={vec(plotArea.x, tick.y)}
                p2={vec(plotArea.x + plotArea.width, tick.y)}
                color={axisColor}
                opacity={0.22}
                strokeWidth={1}
              />
              <Paragraph paragraph={tick.para} x={object.x + 2} y={tick.y - 6} width={32} />
            </Group>
          ))}
          {xLabelParas.map((lbl, idx) => (
            <Paragraph key={`xl-${idx}`} paragraph={lbl.para} x={lbl.x - 27} y={lbl.y - 8} width={54} />
          ))}
        </Group>
      )}

      {primitives.bars.map((bar, idx) => (
        <Rect
          key={`bar-${idx}`}
          x={bar.x}
          y={bar.y}
          width={bar.width}
          height={bar.height}
          color={textColorValue(bar.colorKey, dark)}
        />
      ))}

      {linePaths.map((line, sIdx) => {
        const strokeHex = textColorValue(line.colorKey, dark);
        return (
          <Group key={`line-${sIdx}`}>
            {line.path && (
              <Path
                path={line.path}
                color={strokeHex}
                style="stroke"
                strokeWidth={2.4}
                strokeCap="round"
                strokeJoin="round"
              />
            )}
            {line.points.map((pt, pIdx) => (
              <Circle key={`pt-${pIdx}`} cx={pt.x} cy={pt.y} r={3.5} color={strokeHex} />
            ))}
          </Group>
        );
      })}

      {pieSlices.map((slice, idx) => {
        const sliceHex = textColorValue(slice.colorKey, dark);
        const legendX = object.x + object.width * 0.72;
        const legendY = object.y + 36 + idx * 18;
        return (
          <Group key={`pie-${idx}`}>
            {slice.path && <Path path={slice.path} color={sliceHex} style="fill" />}
            {legendY < object.y + object.height - 14 && (
              <Group>
                <Rect x={legendX} y={legendY + 2} width={8} height={8} color={sliceHex} />
                <Paragraph paragraph={slice.legendPara} x={legendX + 12} y={legendY} width={96} />
              </Group>
            )}
          </Group>
        );
      })}
    </Group>
  );
});
