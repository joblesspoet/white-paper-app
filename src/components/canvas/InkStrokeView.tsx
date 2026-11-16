import { Path, Skia } from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';

import {
  buildVariableWidthStrokePath,
  hasVariablePressure,
  inkPathData,
  type InkStroke,
} from '../../canvas/ink';

export const InkStrokeView = memo(function InkStrokeView({
  stroke,
  dark,
  selected = false,
  highlightColor = '#0D9488',
}: {
  stroke: InkStroke;
  dark: boolean;
  selected?: boolean;
  highlightColor?: string;
}) {
  const useRibbon = stroke.tool === 'pen' && hasVariablePressure(stroke.points);
  const path = useMemo(() => {
    const svg = useRibbon
      ? buildVariableWidthStrokePath(stroke.points, stroke.width)
      : inkPathData(stroke.points);
    return Skia.Path.MakeFromSVGString(svg) ?? Skia.Path.Make();
  }, [stroke.points, stroke.width, useRibbon]);

  return (
    <>
      {selected ? (
        <Path
          path={path}
          color={highlightColor}
          opacity={0.28}
          style={useRibbon ? 'fill' : 'stroke'}
          strokeWidth={stroke.width + 8}
          strokeCap="round"
          strokeJoin="round"
        />
      ) : null}
      <Path
        path={path}
        color={stroke.color}
        opacity={stroke.opacity}
        style={useRibbon ? 'fill' : 'stroke'}
        strokeWidth={stroke.width}
        strokeCap="round"
        strokeJoin="round"
        blendMode={stroke.tool === 'highlighter' ? (dark ? 'screen' : 'multiply') : 'srcOver'}
      />
    </>
  );
});
