import { memo, useMemo } from 'react';
import {
  Group,
  Line,
  Paragraph,
  RoundedRect,
  Skia,
  TextAlign,
  vec,
} from '@shopify/react-native-skia';

import {
  objectTextColor,
  stickyColorValue,
  type RevealTapeObject,
} from '../../canvas/document';

export type RevealTapeLayerProps = {
  object: RevealTapeObject;
  dark: boolean;
};

export const RevealTapeLayer = memo(function RevealTapeLayer({
  object,
  dark,
}: RevealTapeLayerProps) {
  const fill = stickyColorValue(object.colorKey);
  const textHex = objectTextColor(object, dark);
  const cx = object.x + object.width / 2;
  const cy = object.y + object.height / 2;

  const stripes = useMemo(() => {
    if (object.isRevealed) return [];
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const step = 14;
    const h = object.height;
    for (let dx = -h; dx < object.width + h; dx += step) {
      const x1 = object.x + Math.max(2, Math.min(object.width - 2, dx));
      const y1 = object.y + Math.max(2, Math.min(h - 2, dx < 0 ? -dx : 2));
      const x2 = object.x + Math.max(2, Math.min(object.width - 2, dx + h));
      const y2 = object.y + Math.max(2, Math.min(h - 2, dx + h > object.width ? object.width - dx : h - 2));
      if (x2 > x1 && y2 > y1) {
        lines.push({ x1, y1, x2, y2 });
      }
    }
    return lines;
  }, [object.height, object.isRevealed, object.width, object.x, object.y]);

  const labelPara = useMemo(() => {
    const labelText = object.isRevealed
      ? 'Revealed (tap to hide)'
      : object.label || 'Tap to reveal';
    const builder = Skia.ParagraphBuilder.Make({ textAlign: TextAlign.Center });
    builder.pushStyle({
      color: Skia.Color(textHex),
      fontSize: object.isRevealed ? 10 : 12,
    });
    builder.addText(labelText);
    const para = builder.build();
    para.layout(Math.max(24, object.width - 12));
    return para;
  }, [object.isRevealed, object.label, object.width, textHex]);

  const opacity = object.isRevealed ? 0.22 : 1;

  return (
    <Group transform={[{ rotate: (object.rotation * Math.PI) / 180 }]} origin={vec(cx, cy)}>
      <RoundedRect
        x={object.x}
        y={object.y}
        width={object.width}
        height={object.height}
        r={8}
        color={fill}
        opacity={opacity}
      />
      {!object.isRevealed &&
        stripes.map((s, idx) => (
          <Line
            key={idx}
            p1={vec(s.x1, s.y1)}
            p2={vec(s.x2, s.y2)}
            color={textHex}
            strokeWidth={1.5}
            opacity={0.14}
          />
        ))}
      <RoundedRect
        x={object.x}
        y={object.y}
        width={object.width}
        height={object.height}
        r={8}
        style="stroke"
        strokeWidth={1.5}
        color={textHex}
        opacity={object.isRevealed ? 0.5 : 0.32}
      />
      {!object.isRevealed && (
        <Paragraph
          paragraph={labelPara}
          x={object.x + 6}
          y={object.y + Math.max(4, (object.height - labelPara.getHeight()) / 2)}
          width={Math.max(24, object.width - 12)}
        />
      )}
    </Group>
  );
});
