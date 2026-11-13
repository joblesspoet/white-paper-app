import { memo, useMemo } from 'react';
import Svg, { Path } from 'react-native-svg';
import { buildShapeRenderPrimitives, type ShapeKind } from '../canvas/shapes';

type ShapePreviewIconProps = {
  kind: ShapeKind;
  size?: number;
  color: string;
};

/**
 * Renders any of the 53 ShapeKind primitives inside a 24×24 viewBox using the
 * exact same `buildShapeRenderPrimitives` builder as the live Skia canvas and
 * offscreen export renderer.
 */
export const ShapePreviewIcon = memo(function ShapePreviewIcon({
  kind,
  size = 22,
  color,
}: ShapePreviewIconProps) {
  const primitives = useMemo(
    () => buildShapeRenderPrimitives(kind, 3, 3, 18, 18, 'tlbr', false),
    [kind],
  );

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden>
      {primitives.solidStrokeSvg ? (
        <Path
          d={primitives.solidStrokeSvg}
          fill="none"
          stroke={color}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {primitives.dashedStrokeSvg ? (
        <Path
          d={primitives.dashedStrokeSvg}
          fill="none"
          stroke={color}
          strokeWidth={1.3}
          strokeDasharray="2.5 2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {primitives.arrowHeadsSvg ? (
        <Path d={primitives.arrowHeadsSvg} fill={color} />
      ) : null}
    </Svg>
  );
});
