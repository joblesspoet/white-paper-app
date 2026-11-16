import { DashPathEffect, Group, Path, Skia } from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';

import {
  buildShapeRenderPrimitives,
  stickyColorValue,
  textColorValue,
  type ConnectorObject,
  type ShapeObject,
} from '../../canvas/document';
import {
  arrowHeadPathData,
  arrowHeadSize,
  connectorPolyline,
  polylinePathData,
} from '../../canvas/shapes';

export const GeometricObjectView = memo(function GeometricObjectView({
  object,
  dark,
}: {
  object: ShapeObject | ConnectorObject;
  dark: boolean;
}) {
  const color = textColorValue(object.colorKey, dark);
  const origin = useMemo(
    () => ({
      x: object.x + object.width / 2,
      y: object.y + object.height / 2,
    }),
    [object.height, object.width, object.x, object.y],
  );
  const transform = useMemo(
    () => (object.rotation === 0 ? undefined : [{ rotate: (object.rotation * Math.PI) / 180 }]),
    [object.rotation],
  );

  const connectorPaths = useMemo(() => {
    if (object.type !== 'connector') return null;
    const pts = connectorPolyline(
      object.style,
      object.x,
      object.y,
      object.width,
      object.height,
      object.direction,
    );
    const path = Skia.Path.MakeFromSVGString(polylinePathData(pts)) ?? Skia.Path.Make();
    const arrowPath =
      object.style === 'arrow'
        ? Skia.Path.MakeFromSVGString(arrowHeadPathData(pts, arrowHeadSize(object.strokeWidth)))
        : null;
    return { path, arrowPath };
  }, [object]);

  const shapePaths = useMemo(() => {
    if (object.type !== 'shape') return null;
    const primitives = buildShapeRenderPrimitives(
      object.shape,
      object.x,
      object.y,
      object.width,
      object.height,
      object.direction,
      Boolean(object.showMeasurements),
    );
    return {
      fillPath:
        object.fillKey && primitives.fillPathSvg
          ? Skia.Path.MakeFromSVGString(primitives.fillPathSvg)
          : null,
      solidPath: primitives.solidStrokeSvg
        ? Skia.Path.MakeFromSVGString(primitives.solidStrokeSvg)
        : null,
      dashedPath: primitives.dashedStrokeSvg
        ? Skia.Path.MakeFromSVGString(primitives.dashedStrokeSvg)
        : null,
      arrowPath: primitives.arrowHeadsSvg
        ? Skia.Path.MakeFromSVGString(primitives.arrowHeadsSvg)
        : null,
    };
  }, [object]);

  if (connectorPaths) {
    return (
      <Group origin={origin} transform={transform}>
        <Path
          path={connectorPaths.path}
          color={color}
          style="stroke"
          strokeWidth={object.strokeWidth}
          strokeCap="round"
          strokeJoin="round"
        />
        {connectorPaths.arrowPath ? (
          <Path path={connectorPaths.arrowPath} color={color} style="fill" />
        ) : null}
      </Group>
    );
  }

  if (!shapePaths || object.type !== 'shape') return null;

  return (
    <Group origin={origin} transform={transform}>
      {shapePaths.fillPath && object.fillKey ? (
        <Path path={shapePaths.fillPath} color={stickyColorValue(object.fillKey)} style="fill" />
      ) : null}
      {shapePaths.solidPath ? (
        <Path
          path={shapePaths.solidPath}
          color={color}
          style="stroke"
          strokeWidth={object.strokeWidth}
          strokeCap="round"
          strokeJoin="round"
        />
      ) : null}
      {shapePaths.dashedPath ? (
        <Path
          path={shapePaths.dashedPath}
          color={color}
          style="stroke"
          strokeWidth={Math.max(1.5, object.strokeWidth * 0.75)}
          strokeCap="round"
          strokeJoin="round"
        >
          <DashPathEffect intervals={[6, 4]} />
        </Path>
      ) : null}
      {shapePaths.arrowPath ? (
        <Path path={shapePaths.arrowPath} color={color} style="fill" />
      ) : null}
    </Group>
  );
});
