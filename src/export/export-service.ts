/**
 * Local board export service: raster (PNG/JPEG), PDF, and editable `.flowcanvas.json`.
 *
 * Raster and PDF exports render offscreen via Skia so the live canvas never
 * flickers or resizes, and yield to the JS event loop between batches so large
 * boards never freeze the editor. Nothing here touches the network or cloud.
 */

import {
  BlendMode,
  FontSlant,
  FontWeight,
  ImageFormat,
  PaintStyle,
  Skia,
  StrokeCap,
  StrokeJoin,
  TextAlign,
  type SkCanvas,
  type SkImage,
} from '@shopify/react-native-skia';
import { Directory, File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import { Platform } from 'react-native';

import {
  OBJECT_PADDING,
  arrowHeadPathData,
  arrowHeadSize,
  buildShapeRenderPrimitives,
  connectorPolyline,
  isGeometricObject,
  isImageObject,
  isTableObject,
  isTextualObject,
  objectFill,
  objectTextColor,
  polylinePathData,
  stickyColorValue,
  tableCellRect,
  tableColumnWidths,
  tableRowHeight,
  textColorValue,
  type CanvasDocument,
  type CanvasObject,
  type ConnectorObject,
  type ShapeObject,
  type TableObject,
  type TextualObject,
} from '../canvas/document';
import { inkPathData, type InkStroke } from '../canvas/ink';
import { buildBackgroundLayers, resolveCanvasBackgroundHex } from '../canvas/background';
import type { Viewport } from '../canvas/viewport';
import { resolveMediaUri } from '../media/asset-store';
import type { BoardSettings } from '../persistence/schema';
import { colors, darkColors, radii } from '../theme';
import {
  buildBoardBackup,
  serializeBackup,
  type BackupMediaEntry,
} from './backup';
import {
  exportFileName,
  exportPixelSize,
  isLargeExport,
  objectsForScope,
  progressFraction,
  selectionExportRegion,
  visibleBoardRegion,
  type ExportFileFormat,
  type ExportImageFormat,
  type ExportRect,
  type ExportScope,
} from './regions';

const EXPORT_CACHE_DIR = 'flowcanvas-exports';
const RENDER_BATCH_SIZE = 20;

export type ExportProgress = (fraction: number, label: string) => void;

export type ExportInput = {
  boardTitle: string;
  document: CanvasDocument;
  viewport: Viewport;
  canvasSize: { width: number; height: number };
  settings: BoardSettings;
  dark: boolean;
  format: ExportFileFormat;
  scope: ExportScope;
  selectedIds?: readonly string[];
  onProgress?: ExportProgress;
};

export type ExportResult =
  | {
      ok: true;
      uri: string;
      fileName: string;
      mimeType: string;
      uti: string;
      bytes: number;
      isLarge: boolean;
    }
  | {
      ok: false;
      error: string;
    };

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function ensureExportDirectory(): Directory {
  const dir = new Directory(Paths.cache, EXPORT_CACHE_DIR);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

function writeCacheFile(fileName: string, content: string, encoding: 'utf8' | 'base64'): { uri: string; bytes: number } {
  const dir = ensureExportDirectory();
  const file = new File(dir, fileName);
  file.create({ intermediates: true, overwrite: true });
  file.write(content, { encoding });
  return { uri: file.uri, bytes: file.size ?? content.length };
}

function mimeForPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'heic' || ext === 'heif') return `image/${ext}`;
  return 'image/jpeg';
}

function drawStroke(canvas: SkCanvas, stroke: InkStroke, dark: boolean): void {
  const svg = inkPathData(stroke.points);
  if (!svg) return;
  const path = Skia.Path.MakeFromSVGString(svg);
  if (!path) return;
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setStyle(PaintStyle.Stroke);
  paint.setStrokeWidth(stroke.width);
  paint.setStrokeCap(StrokeCap.Round);
  paint.setStrokeJoin(StrokeJoin.Round);
  paint.setColor(Skia.Color(stroke.color));
  paint.setAlphaf(stroke.opacity);
  if (stroke.tool === 'highlighter') {
    paint.setBlendMode(dark ? BlendMode.Screen : BlendMode.Multiply);
  }
  canvas.drawPath(path, paint);
}

function drawGeometric(
  canvas: SkCanvas,
  object: ShapeObject | ConnectorObject,
  dark: boolean,
): void {
  const strokeColor = textColorValue(object.colorKey, dark);
  const cx = object.x + object.width / 2;
  const cy = object.y + object.height / 2;
  canvas.save();
  if (object.rotation !== 0) {
    canvas.rotate(object.rotation, cx, cy);
  }

  const strokePaint = Skia.Paint();
  strokePaint.setAntiAlias(true);
  strokePaint.setStyle(PaintStyle.Stroke);
  strokePaint.setStrokeWidth(object.strokeWidth);
  strokePaint.setStrokeCap(StrokeCap.Round);
  strokePaint.setStrokeJoin(StrokeJoin.Round);
  strokePaint.setColor(Skia.Color(strokeColor));

  if (object.type === 'connector') {
    const pts = connectorPolyline(
      object.style,
      object.x,
      object.y,
      object.width,
      object.height,
      object.direction,
    );
    const path = Skia.Path.MakeFromSVGString(polylinePathData(pts));
    if (path) canvas.drawPath(path, strokePaint);
    if (object.style === 'arrow') {
      const arrowSvg = arrowHeadPathData(pts, arrowHeadSize(object.strokeWidth));
      const arrowPath = arrowSvg ? Skia.Path.MakeFromSVGString(arrowSvg) : null;
      if (arrowPath) {
        const fillPaint = Skia.Paint();
        fillPaint.setAntiAlias(true);
        fillPaint.setStyle(PaintStyle.Fill);
        fillPaint.setColor(Skia.Color(strokeColor));
        canvas.drawPath(arrowPath, fillPaint);
      }
    }
    canvas.restore();
    return;
  }

  const primitives = buildShapeRenderPrimitives(
    object.shape,
    object.x,
    object.y,
    object.width,
    object.height,
    object.direction,
    Boolean(object.showMeasurements),
  );

  if (object.fillKey && primitives.fillPathSvg) {
    const fillPath = Skia.Path.MakeFromSVGString(primitives.fillPathSvg);
    if (fillPath) {
      const fillPaint = Skia.Paint();
      fillPaint.setAntiAlias(true);
      fillPaint.setStyle(PaintStyle.Fill);
      fillPaint.setColor(Skia.Color(stickyColorValue(object.fillKey)));
      canvas.drawPath(fillPath, fillPaint);
    }
  }

  if (primitives.solidStrokeSvg) {
    const solidPath = Skia.Path.MakeFromSVGString(primitives.solidStrokeSvg);
    if (solidPath) canvas.drawPath(solidPath, strokePaint);
  }

  if (primitives.dashedStrokeSvg) {
    const dashedPath = Skia.Path.MakeFromSVGString(primitives.dashedStrokeSvg);
    if (dashedPath) {
      const dashedPaint = strokePaint.copy();
      dashedPaint.setPathEffect(Skia.PathEffect.MakeDash([6, 4], 0));
      canvas.drawPath(dashedPath, dashedPaint);
    }
  }

  if (primitives.arrowHeadsSvg) {
    const arrowPath = Skia.Path.MakeFromSVGString(primitives.arrowHeadsSvg);
    if (arrowPath) {
      const fillPaint = Skia.Paint();
      fillPaint.setAntiAlias(true);
      fillPaint.setStyle(PaintStyle.Fill);
      fillPaint.setColor(Skia.Color(strokeColor));
      canvas.drawPath(arrowPath, fillPaint);
    }
  }

  if (primitives.measurementLabels && primitives.measurementLabels.length > 0) {
    for (const label of primitives.measurementLabels) {
      const para = Skia.ParagraphBuilder.Make({ textAlign: TextAlign.Center })
        .pushStyle({
          color: Skia.Color(strokeColor),
          fontSize: 11,
          fontStyle: { weight: FontWeight.SemiBold },
        })
        .addText(label.text)
        .build();
      para.layout(80);
      para.paint(canvas, label.x - 40, label.y - 7);
    }
  }
  canvas.restore();
}

function drawTable(
  canvas: SkCanvas,
  table: TableObject,
  dark: boolean,
): void {
  const borderColor = textColorValue(table.colorKey, dark);
  const cx = table.x + table.width / 2;
  const cy = table.y + table.height / 2;
  canvas.save();
  if (table.rotation !== 0) {
    canvas.rotate(table.rotation, cx, cy);
  }

  const frameRect = Skia.RRectXY(Skia.XYWHRect(table.x, table.y, table.width, table.height), 6, 6);

  if (table.hasHeaderRow && table.fillHeader && table.rows >= 1) {
    const rowH = tableRowHeight(table);
    const headerPaint = Skia.Paint();
    headerPaint.setAntiAlias(true);
    headerPaint.setStyle(PaintStyle.Fill);
    headerPaint.setColor(Skia.Color(borderColor));
    headerPaint.setAlphaf(0.12);
    canvas.save();
    canvas.clipRRect(frameRect, 1, true);
    canvas.drawRect(Skia.XYWHRect(table.x, table.y, table.width, rowH), headerPaint);
    canvas.restore();
  }

  const gridPaint = Skia.Paint();
  gridPaint.setAntiAlias(true);
  gridPaint.setStyle(PaintStyle.Stroke);
  gridPaint.setStrokeWidth(1);
  gridPaint.setColor(Skia.Color(borderColor));
  gridPaint.setAlphaf(0.45);

  const rowH = tableRowHeight(table);
  for (let r = 1; r < table.rows; r += 1) {
    const ly = table.y + r * rowH;
    canvas.drawLine(table.x, ly, table.x + table.width, ly, gridPaint);
  }

  const widths = tableColumnWidths(table);
  let lx = table.x;
  for (let c = 0; c < table.columns - 1; c += 1) {
    lx += widths[c];
    canvas.drawLine(lx, table.y, lx, table.y + table.height, gridPaint);
  }

  const framePaint = Skia.Paint();
  framePaint.setAntiAlias(true);
  framePaint.setStyle(PaintStyle.Stroke);
  framePaint.setStrokeWidth(1.5);
  framePaint.setColor(Skia.Color(borderColor));
  canvas.drawRRect(frameRect, framePaint);

  for (let r = 0; r < table.rows; r += 1) {
    for (let c = 0; c < table.columns; c += 1) {
      const cell = table.cells[r * table.columns + c];
      if (!cell || !cell.text) continue;
      const rect = tableCellRect(table, r, c);
      const isHeader = table.hasHeaderRow && r === 0;
      const align =
        cell.align === 'center'
          ? TextAlign.Center
          : cell.align === 'right'
            ? TextAlign.Right
            : TextAlign.Left;
      const para = Skia.ParagraphBuilder.Make({ textAlign: align })
        .pushStyle({
          color: Skia.Color(borderColor),
          fontSize: table.fontSize,
          fontStyle: { weight: isHeader ? FontWeight.Bold : FontWeight.Normal },
        })
        .addText(cell.text)
        .build();
      const pad = 6;
      const maxW = Math.max(8, rect.width - pad * 2);
      para.layout(maxW);
      para.paint(canvas, rect.x + pad, rect.y + pad);
    }
  }

  canvas.restore();
}

function drawTextual(
  canvas: SkCanvas,
  object: TextualObject,
  dark: boolean,
): void {
  const cx = object.x + object.width / 2;
  const cy = object.y + object.height / 2;
  canvas.save();
  if (object.rotation !== 0) {
    canvas.rotate(object.rotation, cx, cy);
  }

  const fill = objectFill(object);
  if (fill) {
    const fillPaint = Skia.Paint();
    fillPaint.setAntiAlias(true);
    fillPaint.setStyle(PaintStyle.Fill);
    fillPaint.setColor(Skia.Color(fill));
    const rect = Skia.XYWHRect(object.x, object.y, object.width, object.height);
    canvas.drawRRect(Skia.RRectXY(rect, radii.sm, radii.sm), fillPaint);
  }

  if (object.text.length > 0) {
    const textColor = objectTextColor(object, dark);
    const builder = Skia.ParagraphBuilder.Make({
      textAlign: TextAlign.Left,
      heightMultiplier: 1.35,
    });
    builder.pushStyle({
      color: Skia.Color(textColor),
      fontSize: object.fontSize,
      heightMultiplier: 1.35,
      fontStyle: {
        weight: object.fontWeight === 'bold' ? FontWeight.Bold : FontWeight.Normal,
        slant: object.fontStyle === 'italic' ? FontSlant.Italic : FontSlant.Upright,
      },
    });
    builder.addText(object.text);
    const paragraph = builder.build();
    const usableWidth = Math.max(1, object.width - OBJECT_PADDING * 2);
    paragraph.layout(usableWidth);
    paragraph.paint(canvas, object.x + OBJECT_PADDING, object.y + OBJECT_PADDING);
  }

  canvas.restore();
}

async function loadSkiaImage(storagePath: string): Promise<SkImage | null> {
  try {
    const file = new File(resolveMediaUri(storagePath));
    if (!file.exists) return null;
    const base64 = await file.base64();
    if (!base64) return null;
    const data = Skia.Data.fromBase64(base64);
    return Skia.Image.MakeImageFromEncoded(data);
  } catch {
    return null;
  }
}

function drawImageObject(
  canvas: SkCanvas,
  object: CanvasObject,
  skImage: SkImage | null,
  dark: boolean,
): void {
  if (!isImageObject(object)) return;
  const theme = dark ? darkColors : colors;
  const cx = object.x + object.width / 2;
  const cy = object.y + object.height / 2;
  canvas.save();
  if (object.rotation !== 0) {
    canvas.rotate(object.rotation, cx, cy);
  }
  const dest = Skia.XYWHRect(object.x, object.y, object.width, object.height);
  if (skImage) {
    const src = Skia.XYWHRect(0, 0, skImage.width(), skImage.height());
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    canvas.drawImageRect(skImage, src, dest, paint, false);
  } else {
    const fillPaint = Skia.Paint();
    fillPaint.setStyle(PaintStyle.Fill);
    fillPaint.setColor(Skia.Color(theme.muted));
    canvas.drawRect(dest, fillPaint);

    const borderPaint = Skia.Paint();
    borderPaint.setStyle(PaintStyle.Stroke);
    borderPaint.setStrokeWidth(1);
    borderPaint.setColor(Skia.Color(theme.border));
    canvas.drawRect(dest, borderPaint);
  }
  canvas.restore();
}

function resolveRegion(input: ExportInput): ExportRect | null {
  if (input.scope === 'selection') {
    return selectionExportRegion(input.document, input.selectedIds ?? []);
  }
  return visibleBoardRegion(input.viewport, input.canvasSize);
}

async function renderRegionBase64(
  input: ExportInput,
  imageFormat: ExportImageFormat,
): Promise<{ ok: true; base64: string; pixelWidth: number; pixelHeight: number; isLarge: boolean } | { ok: false; error: string }> {
  const region = resolveRegion(input);
  if (!region) {
    return { ok: false, error: 'Select one or more objects before exporting a selection.' };
  }

  const pixelSize = exportPixelSize(region);
  const large = isLargeExport(input.document, pixelSize);
  const surface = Skia.Surface.MakeOffscreen(pixelSize.width, pixelSize.height);
  if (!surface) {
    return { ok: false, error: 'Could not allocate an offscreen canvas for this export.' };
  }

  const canvas = surface.getCanvas();
  const theme = input.dark ? darkColors : colors;
  const bgHex = resolveCanvasBackgroundHex(input.settings.background, input.dark);
  canvas.clear(Skia.Color(bgHex));
  canvas.save();
  canvas.scale(pixelSize.scale, pixelSize.scale);
  canvas.translate(-region.x, -region.y);

  // 0. Teaching canvas background pattern (dots, grid, ruled, isometric)
  const backgroundLayers = buildBackgroundLayers(input.settings.style, region);
  for (const layer of backgroundLayers) {
    const path = Skia.Path.MakeFromSVGString(layer.svgPath);
    if (!path) continue;
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setStyle(PaintStyle.Stroke);
    paint.setStrokeCap(StrokeCap.Round);
    paint.setStrokeWidth(layer.strokeWidth);
    paint.setColor(Skia.Color(layer.isMargin ? theme.accent : theme.foreground));
    paint.setAlphaf(layer.opacity);
    canvas.drawPath(path, paint);
  }

  const strokes = input.scope === 'visible' ? input.document.strokes : [];
  const objects = objectsForScope(input.document, input.scope, input.selectedIds);
  const images = objects.filter(isImageObject);
  const geometrics = objects.filter(isGeometricObject);
  const tables = objects.filter(isTableObject);
  const textuals = objects.filter(isTextualObject);

  const totalSteps = Math.max(1, strokes.length + objects.length);
  let completed = 0;

  if (large) {
    input.onProgress?.(0.05, 'Preparing export…');
    await yieldToEventLoop();
  }

  // 1. Freehand ink strokes
  for (let index = 0; index < strokes.length; index += 1) {
    drawStroke(canvas, strokes[index], input.dark);
    completed += 1;
    if (completed % RENDER_BATCH_SIZE === 0) {
      input.onProgress?.(0.05 + 0.75 * progressFraction(completed, totalSteps), 'Rendering ink strokes…');
      await yieldToEventLoop();
    }
  }

  // 2. Images (load decoded bitmaps asynchronously so UI stays responsive)
  for (let index = 0; index < images.length; index += 1) {
    const obj = images[index];
    const skImage = await loadSkiaImage(obj.storagePath);
    drawImageObject(canvas, obj, skImage, input.dark);
    completed += 1;
    input.onProgress?.(0.05 + 0.75 * progressFraction(completed, totalSteps), 'Rendering images…');
    await yieldToEventLoop();
  }

  // 3. Shapes and connectors
  for (let index = 0; index < geometrics.length; index += 1) {
    drawGeometric(canvas, geometrics[index], input.dark);
    completed += 1;
    if (completed % RENDER_BATCH_SIZE === 0) {
      input.onProgress?.(0.05 + 0.75 * progressFraction(completed, totalSteps), 'Rendering shapes…');
      await yieldToEventLoop();
    }
  }

  // 3.5 Tables
  for (let index = 0; index < tables.length; index += 1) {
    drawTable(canvas, tables[index], input.dark);
    completed += 1;
    if (completed % RENDER_BATCH_SIZE === 0) {
      input.onProgress?.(0.05 + 0.75 * progressFraction(completed, totalSteps), 'Rendering tables…');
      await yieldToEventLoop();
    }
  }

  // 4. Text and sticky notes
  for (let index = 0; index < textuals.length; index += 1) {
    drawTextual(canvas, textuals[index], input.dark);
    completed += 1;
    if (completed % RENDER_BATCH_SIZE === 0) {
      input.onProgress?.(0.05 + 0.75 * progressFraction(completed, totalSteps), 'Rendering text and notes…');
      await yieldToEventLoop();
    }
  }

  canvas.restore();
  input.onProgress?.(0.85, 'Encoding image…');
  await yieldToEventLoop();

  surface.flush(true);
  const snapshot = surface.makeImageSnapshot();
  const format = imageFormat === 'jpeg' ? ImageFormat.JPEG : ImageFormat.PNG;
  const base64 = snapshot.encodeToBase64(format, imageFormat === 'jpeg' ? 92 : 100);
  if (!base64) {
    return { ok: false, error: 'The rendered board image could not be encoded.' };
  }

  return {
    ok: true,
    base64,
    pixelWidth: pixelSize.width,
    pixelHeight: pixelSize.height,
    isLarge: large,
  };
}

export async function exportBoardRaster(input: ExportInput): Promise<ExportResult> {
  const format: ExportImageFormat = input.format === 'jpeg' ? 'jpeg' : 'png';
  const rendered = await renderRegionBase64(input, format);
  if (!rendered.ok) return rendered;

  input.onProgress?.(0.95, 'Writing file…');
  const fileName = exportFileName(input.boardTitle, format, input.scope);
  const { uri, bytes } = writeCacheFile(fileName, rendered.base64, 'base64');
  input.onProgress?.(1, 'Export ready.');

  return {
    ok: true,
    uri,
    fileName,
    mimeType: format === 'jpeg' ? 'image/jpeg' : 'image/png',
    uti: format === 'jpeg' ? 'public.jpeg' : 'public.png',
    bytes,
    isLarge: rendered.isLarge,
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function exportBoardPdf(input: ExportInput): Promise<ExportResult> {
  if (Platform.OS === 'web') {
    return {
      ok: false,
      error: 'Local PDF file export is only supported on iOS and Android devices.',
    };
  }

  const rendered = await renderRegionBase64(input, 'png');
  if (!rendered.ok) return rendered;

  input.onProgress?.(0.9, 'Generating PDF…');
  await yieldToEventLoop();

  const maxPageEdge = 792;
  const aspect = rendered.pixelWidth / Math.max(1, rendered.pixelHeight);
  const pageWidth = aspect >= 1 ? maxPageEdge : Math.max(200, Math.round(maxPageEdge * aspect));
  const pageHeight = aspect >= 1 ? Math.max(200, Math.round(maxPageEdge / aspect)) : maxPageEdge;
  const bg = input.dark ? darkColors.background : colors.background;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(input.boardTitle || 'FlowCanvas Board')}</title>
<style>
  @page { margin: 0; size: ${pageWidth}pt ${pageHeight}pt; }
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: ${bg}; display: flex; align-items: center; justify-content: center; }
  img { width: 100%; height: 100%; object-fit: contain; display: block; }
</style>
</head>
<body>
  <img src="data:image/png;base64,${rendered.base64}" />
</body>
</html>`;

  const printed = await Print.printToFileAsync({
    html,
    width: pageWidth,
    height: pageHeight,
  });

  const fileName = exportFileName(input.boardTitle, 'pdf', input.scope);
  const dir = ensureExportDirectory();
  const destination = new File(dir, fileName);
  const source = new File(printed.uri);
  if (destination.exists) destination.delete();
  await source.copy(destination);
  try {
    if (source.exists) source.delete();
  } catch {
    // Cleanup of expo-print temp file is best effort.
  }

  input.onProgress?.(1, 'PDF ready.');
  return {
    ok: true,
    uri: destination.uri,
    fileName,
    mimeType: 'application/pdf',
    uti: 'com.adobe.pdf',
    bytes: destination.size ?? 0,
    isLarge: rendered.isLarge,
  };
}

export async function exportBoardBackup(input: {
  boardTitle: string;
  document: CanvasDocument;
  viewport: Viewport | null;
  settings: BoardSettings;
  onProgress?: ExportProgress;
}): Promise<ExportResult> {
  const images = input.document.objects.filter(isImageObject);
  const uniquePaths = new Map<string, { width?: number; height?: number }>();
  for (const image of images) {
    if (!uniquePaths.has(image.storagePath)) {
      uniquePaths.set(image.storagePath, { width: image.sourceWidth, height: image.sourceHeight });
    }
    if (!uniquePaths.has(image.originalStoragePath)) {
      uniquePaths.set(image.originalStoragePath, { width: image.originalWidth, height: image.originalHeight });
    }
  }

  const totalMedia = uniquePaths.size;
  const large = input.document.objects.length + input.document.strokes.length > 80 || totalMedia > 3;
  const media: BackupMediaEntry[] = [];
  let index = 0;

  for (const [storagePath, dims] of uniquePaths.entries()) {
    index += 1;
    input.onProgress?.(0.1 + 0.65 * progressFraction(index, Math.max(1, totalMedia)), `Packaging media ${index} of ${totalMedia}…`);
    await yieldToEventLoop();
    try {
      const file = new File(resolveMediaUri(storagePath));
      if (!file.exists) continue;
      const data = await file.base64();
      if (!data) continue;
      media.push({
        path: storagePath,
        mimeType: mimeForPath(storagePath),
        data,
        ...(dims.width ? { width: dims.width } : {}),
        ...(dims.height ? { height: dims.height } : {}),
      });
    } catch {
      // Missing or unreadable media file is skipped so the board data still exports.
    }
  }

  input.onProgress?.(0.85, 'Serializing board backup…');
  await yieldToEventLoop();

  const backup = buildBoardBackup({
    title: input.boardTitle,
    document: input.document,
    viewport: input.viewport,
    settings: input.settings,
    media,
  });
  const json = serializeBackup(backup);
  const fileName = exportFileName(input.boardTitle, 'backup');
  const { uri, bytes } = writeCacheFile(fileName, json, 'utf8');
  input.onProgress?.(1, 'Backup ready.');

  return {
    ok: true,
    uri,
    fileName,
    mimeType: 'application/json',
    uti: 'public.json',
    bytes,
    isLarge: large,
  };
}

export async function exportBoard(input: ExportInput): Promise<ExportResult> {
  if (input.format === 'backup') {
    return exportBoardBackup({
      boardTitle: input.boardTitle,
      document: input.document,
      viewport: input.viewport,
      settings: input.settings,
      onProgress: input.onProgress,
    });
  }
  if (input.format === 'pdf') {
    return exportBoardPdf(input);
  }
  return exportBoardRaster(input);
}

export async function deleteExportFile(uri: string): Promise<void> {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Cleanup is best effort.
  }
}
