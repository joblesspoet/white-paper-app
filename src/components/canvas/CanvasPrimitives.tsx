import {
  Circle,
  Group,
  Image as SkiaImage,
  Path,
  Rect,
  Skia,
  useImage,
} from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';

import type { CanvasObject, ImageObject } from '../../canvas/document';
import { inkPathData } from '../../canvas/ink';
import {
  LASER_CORE_OPACITY,
  LASER_CORE_WIDTH,
  LASER_HALO_OPACITY,
  LASER_HALO_WIDTH,
  resolveLaserPalette,
  type EphemeralLaserStroke,
} from '../../canvas/laser';
import {
  RESIZE_HANDLES,
  ROTATE_HANDLE_OFFSET_SCREEN,
  SELECTION_HANDLE_SCREEN,
  selectionCorners,
  selectionHandlePositions,
} from '../../canvas/selection';
import { polylinePathData } from '../../canvas/shapes';
import { MIN_ZOOM } from '../../canvas/viewport';
import { resolveMediaUri } from '../../media/asset-store';
import { colors, darkColors } from '../../theme';

export const BackgroundPatternView = memo(function BackgroundPatternView({
  svgPath,
  strokeWidth,
  opacity,
  color,
}: {
  svgPath: string;
  strokeWidth: number;
  opacity: number;
  color: string;
}) {
  const path = useMemo(() => Skia.Path.MakeFromSVGString(svgPath) ?? Skia.Path.Make(), [svgPath]);
  return (
    <Path
      path={path}
      color={color}
      opacity={opacity}
      style="stroke"
      strokeWidth={strokeWidth}
      strokeCap="round"
    />
  );
});

export const LaserStrokeView = memo(function LaserStrokeView({
  stroke,
  alpha,
  scale,
}: {
  stroke: EphemeralLaserStroke;
  alpha: number;
  scale: number;
}) {
  const path = useMemo(() => {
    const pts = stroke.points.map((p) => ({ x: p.x, y: p.y }));
    return Skia.Path.MakeFromSVGString(inkPathData(pts)) ?? Skia.Path.Make();
  }, [stroke.points]);
  const palette = resolveLaserPalette(stroke.colorKey);
  const invScale = 1 / Math.max(scale, MIN_ZOOM);
  return (
    <>
      <Path
        path={path}
        color={palette.halo}
        opacity={LASER_HALO_OPACITY * alpha}
        style="stroke"
        strokeWidth={LASER_HALO_WIDTH * invScale}
        strokeCap="round"
        strokeJoin="round"
      />
      <Path
        path={path}
        color={palette.core}
        opacity={LASER_CORE_OPACITY * alpha}
        style="stroke"
        strokeWidth={LASER_CORE_WIDTH * invScale}
        strokeCap="round"
        strokeJoin="round"
      />
    </>
  );
});

export const ImageObjectView = memo(function ImageObjectView({
  object,
  dark,
}: {
  object: ImageObject;
  dark: boolean;
}) {
  const uri = resolveMediaUri(object.storagePath);
  const image = useImage(uri);
  const theme = dark ? darkColors : colors;
  const origin = useMemo(
    () => ({ x: object.x + object.width / 2, y: object.y + object.height / 2 }),
    [object.height, object.width, object.x, object.y],
  );
  const transform = useMemo(
    () => (object.rotation === 0 ? undefined : [{ rotate: (object.rotation * Math.PI) / 180 }]),
    [object.rotation],
  );
  if (!image) {
    return (
      <Group origin={origin} transform={transform}>
        <Rect
          x={object.x}
          y={object.y}
          width={object.width}
          height={object.height}
          color={theme.muted}
        />
        <Rect
          x={object.x}
          y={object.y}
          width={object.width}
          height={object.height}
          color={theme.border}
          style="stroke"
          strokeWidth={1}
        />
      </Group>
    );
  }
  return (
    <Group origin={origin} transform={transform}>
      <SkiaImage
        image={image}
        x={object.x}
        y={object.y}
        width={object.width}
        height={object.height}
        fit="contain"
      />
    </Group>
  );
});

export const SelectionOverlay = memo(function SelectionOverlay({
  objects,
  dark,
  scale,
}: {
  objects: CanvasObject[];
  dark: boolean;
  scale: number;
}) {
  const theme = dark ? darkColors : colors;
  const corners = selectionCorners(objects);
  if (corners.length < 2) return null;
  const safeScale = Math.max(scale, 0.5);
  const strokeWidth = 1.5 / safeScale;
  const handleSize = SELECTION_HANDLE_SCREEN / safeScale;
  const handles =
    objects.length === 1
      ? selectionHandlePositions(objects, ROTATE_HANDLE_OFFSET_SCREEN / safeScale)
      : null;
  const boxPath = Skia.Path.MakeFromSVGString(`${polylinePathData(corners)} Z`) ?? Skia.Path.Make();
  const topMiddle = {
    x: (corners[0].x + corners[1].x) / 2,
    y: (corners[0].y + corners[1].y) / 2,
  };
  const stemPath = handles
    ? Skia.Path.MakeFromSVGString(
        `M ${topMiddle.x} ${topMiddle.y} L ${handles.rotate.x} ${handles.rotate.y}`,
      ) ?? Skia.Path.Make()
    : null;

  return (
    <>
      <Path path={boxPath} color={theme.primary} style="stroke" strokeWidth={strokeWidth} />
      {handles && stemPath && (
        <Path path={stemPath} color={theme.primary} style="stroke" strokeWidth={strokeWidth} />
      )}
      {handles && (
        <>
          <Circle
            cx={handles.rotate.x}
            cy={handles.rotate.y}
            r={handleSize / 2}
            color={theme.surface}
            style="fill"
          />
          <Circle
            cx={handles.rotate.x}
            cy={handles.rotate.y}
            r={handleSize / 2}
            color={theme.primary}
            style="stroke"
            strokeWidth={strokeWidth}
          />
        </>
      )}
      {handles &&
        RESIZE_HANDLES.map((handle) => (
          <Group key={handle}>
            <Rect
              x={handles[handle].x - handleSize / 2}
              y={handles[handle].y - handleSize / 2}
              width={handleSize}
              height={handleSize}
              color={theme.surface}
              style="fill"
            />
            <Rect
              x={handles[handle].x - handleSize / 2}
              y={handles[handle].y - handleSize / 2}
              width={handleSize}
              height={handleSize}
              color={theme.primary}
              style="stroke"
              strokeWidth={strokeWidth}
            />
          </Group>
        ))}
    </>
  );
});
