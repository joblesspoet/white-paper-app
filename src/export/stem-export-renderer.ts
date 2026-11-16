/**
 * Offscreen Skia export renderers for Phase G STEM objects (`FunctionPlotObject`
 * and `ChartObject`) so PNG/JPEG/PDF exports match the live canvas.
 */

import {
  FontWeight,
  PaintStyle,
  Skia,
  StrokeCap,
  StrokeJoin,
  TextAlign,
  type SkCanvas,
} from '@shopify/react-native-skia';

import { buildChartRenderPrimitives } from '../canvas/chart-generator';
import {
  polylinePathData,
  textColorValue,
  type ChartObject,
  type FunctionPlotObject,
} from '../canvas/document';
import {
  evaluateFunctionPlot,
  plotPointToCanvas,
  type PlotDomain,
} from '../canvas/function-plotter';

const KEY_POINT_COLORS = {
  root: '#DC2626',
  'y-intercept': '#2563EB',
  extrema: '#D97706',
} as const;

export function drawFunctionPlotObject(
  canvas: SkCanvas,
  object: FunctionPlotObject,
  dark: boolean,
): void {
  const curveColor = textColorValue(object.colorKey, dark);
  const frameBg = dark ? '#0F172A' : '#FFFFFF';
  const frameBorder = dark ? '#334155' : '#CBD5E1';
  const axisColor = dark ? '#94A3B8' : '#475569';

  canvas.save();
  if (object.rotation !== 0) {
    canvas.rotate(object.rotation, object.x + object.width / 2, object.y + object.height / 2);
  }

  const rrect = Skia.RRectXY(Skia.XYWHRect(object.x, object.y, object.width, object.height), 8, 8);
  const bgPaint = Skia.Paint();
  bgPaint.setAntiAlias(true);
  bgPaint.setStyle(PaintStyle.Fill);
  bgPaint.setColor(Skia.Color(frameBg));
  canvas.drawRRect(rrect, bgPaint);

  const borderPaint = Skia.Paint();
  borderPaint.setAntiAlias(true);
  borderPaint.setStyle(PaintStyle.Stroke);
  borderPaint.setStrokeWidth(1.2);
  borderPaint.setColor(Skia.Color(frameBorder));
  canvas.drawRRect(rrect, borderPaint);

  const domain: PlotDomain = {
    xMin: object.xMin,
    xMax: object.xMax,
    yMin: object.yMin,
    yMax: object.yMax,
  };
  const plotLeft = object.x + 20;
  const plotRight = object.x + object.width - 20;
  const plotTop = object.y + 20;
  const plotBottom = object.y + object.height - 20;
  const originPt = plotPointToCanvas({ x: 0, y: 0 }, object, domain);

  const axisPaint = Skia.Paint();
  axisPaint.setAntiAlias(true);
  axisPaint.setStyle(PaintStyle.Stroke);
  axisPaint.setStrokeWidth(1.2);
  axisPaint.setColor(Skia.Color(axisColor));

  if (originPt.y >= plotTop && originPt.y <= plotBottom) {
    canvas.drawLine(plotLeft, originPt.y, plotRight, originPt.y, axisPaint);
  }
  if (originPt.x >= plotLeft && originPt.x <= plotRight) {
    canvas.drawLine(originPt.x, plotTop, originPt.x, plotBottom, axisPaint);
  }

  const sampled = evaluateFunctionPlot(object);
  const curvePaint = Skia.Paint();
  curvePaint.setAntiAlias(true);
  curvePaint.setStyle(PaintStyle.Stroke);
  curvePaint.setStrokeWidth(2.4);
  curvePaint.setStrokeCap(StrokeCap.Round);
  curvePaint.setStrokeJoin(StrokeJoin.Round);
  curvePaint.setColor(Skia.Color(curveColor));

  for (const branch of sampled.branches) {
    const canvasPts = branch.map((pt) => plotPointToCanvas(pt, object, domain));
    const path = Skia.Path.MakeFromSVGString(polylinePathData(canvasPts));
    if (path) canvas.drawPath(path, curvePaint);
  }

  if (sampled.tangent) {
    const p1 = plotPointToCanvas(sampled.tangent.p1, object, domain);
    const p2 = plotPointToCanvas(sampled.tangent.p2, object, domain);
    const tangentPaint = Skia.Paint();
    tangentPaint.setAntiAlias(true);
    tangentPaint.setStyle(PaintStyle.Stroke);
    tangentPaint.setStrokeWidth(1.6);
    tangentPaint.setPathEffect(Skia.PathEffect.MakeDash([5, 3], 0));
    tangentPaint.setColor(Skia.Color('#0D9488'));
    canvas.drawLine(p1.x, p1.y, p2.x, p2.y, tangentPaint);
  }

  for (const kp of sampled.keyPoints.slice(0, 6)) {
    const pos = plotPointToCanvas({ x: kp.x, y: kp.y }, object, domain);
    const dotPaint = Skia.Paint();
    dotPaint.setAntiAlias(true);
    dotPaint.setStyle(PaintStyle.Fill);
    dotPaint.setColor(Skia.Color(KEY_POINT_COLORS[kp.kind]));
    canvas.drawCircle(pos.x, pos.y, 4, dotPaint);
  }

  canvas.restore();
}

export function drawChartObject(
  canvas: SkCanvas,
  object: ChartObject,
  dark: boolean,
): void {
  const frameBg = dark ? '#0F172A' : '#FFFFFF';
  const frameBorder = dark ? '#334155' : '#CBD5E1';
  const labelColor = dark ? '#CBD5E1' : '#334155';
  const axisColor = dark ? '#64748B' : '#94A3B8';

  canvas.save();
  if (object.rotation !== 0) {
    canvas.rotate(object.rotation, object.x + object.width / 2, object.y + object.height / 2);
  }

  const rrect = Skia.RRectXY(Skia.XYWHRect(object.x, object.y, object.width, object.height), 8, 8);
  const bgPaint = Skia.Paint();
  bgPaint.setAntiAlias(true);
  bgPaint.setStyle(PaintStyle.Fill);
  bgPaint.setColor(Skia.Color(frameBg));
  canvas.drawRRect(rrect, bgPaint);

  const borderPaint = Skia.Paint();
  borderPaint.setAntiAlias(true);
  borderPaint.setStyle(PaintStyle.Stroke);
  borderPaint.setStrokeWidth(1.2);
  borderPaint.setColor(Skia.Color(frameBorder));
  canvas.drawRRect(rrect, borderPaint);

  const titlePara = Skia.ParagraphBuilder.Make({ textAlign: TextAlign.Left })
    .pushStyle({
      color: Skia.Color(labelColor),
      fontSize: 11,
      fontStyle: { weight: FontWeight.SemiBold },
    })
    .addText(object.title)
    .build();
  titlePara.layout(Math.max(60, object.width - 24));
  titlePara.paint(canvas, object.x + 12, object.y + 8);

  const primitives = buildChartRenderPrimitives(object);
  const { plotArea } = primitives;

  if (object.chartType !== 'pie') {
    const axisPaint = Skia.Paint();
    axisPaint.setAntiAlias(true);
    axisPaint.setStyle(PaintStyle.Stroke);
    axisPaint.setStrokeWidth(1);
    axisPaint.setColor(Skia.Color(axisColor));
    canvas.drawLine(plotArea.x, plotArea.y, plotArea.x, plotArea.y + plotArea.height, axisPaint);
    canvas.drawLine(
      plotArea.x,
      plotArea.y + plotArea.height,
      plotArea.x + plotArea.width,
      plotArea.y + plotArea.height,
      axisPaint,
    );
  }

  for (const bar of primitives.bars) {
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setStyle(PaintStyle.Fill);
    paint.setColor(Skia.Color(textColorValue(bar.colorKey, dark)));
    canvas.drawRect(Skia.XYWHRect(bar.x, bar.y, bar.width, bar.height), paint);
  }

  for (const line of primitives.lines) {
    const hex = textColorValue(line.colorKey, dark);
    const path = Skia.Path.MakeFromSVGString(polylinePathData(line.points));
    if (path) {
      const paint = Skia.Paint();
      paint.setAntiAlias(true);
      paint.setStyle(PaintStyle.Stroke);
      paint.setStrokeWidth(2.4);
      paint.setStrokeCap(StrokeCap.Round);
      paint.setStrokeJoin(StrokeJoin.Round);
      paint.setColor(Skia.Color(hex));
      canvas.drawPath(path, paint);
    }
    const dotPaint = Skia.Paint();
    dotPaint.setAntiAlias(true);
    dotPaint.setStyle(PaintStyle.Fill);
    dotPaint.setColor(Skia.Color(hex));
    for (const pt of line.points) {
      canvas.drawCircle(pt.x, pt.y, 3.5, dotPaint);
    }
  }

  for (const slice of primitives.pieSlices) {
    const path = Skia.Path.MakeFromSVGString(slice.pathSvg);
    if (!path) continue;
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setStyle(PaintStyle.Fill);
    paint.setColor(Skia.Color(textColorValue(slice.colorKey, dark)));
    canvas.drawPath(path, paint);
  }

  canvas.restore();
}
