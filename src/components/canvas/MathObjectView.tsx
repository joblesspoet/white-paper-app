import {
  FontSlant,
  FontWeight,
  Group,
  Paragraph,
  Path,
  RoundedRect,
  Skia,
  TextAlign,
} from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';

import { OBJECT_PADDING, textColorValue, type MathObject } from '../../canvas/document';
import { layoutMathExpression, type MathSourceSpan } from '../../canvas/math-layout';

export const MathObjectView = memo(function MathObjectView({
  object,
  dark,
  activeSpan = null,
}: {
  object: MathObject;
  dark: boolean;
  activeSpan?: MathSourceSpan | null;
}) {
  const color = textColorValue(object.colorKey, dark);
  const layout = useMemo(
    () => layoutMathExpression(object.latex, object.fontSize),
    [object.fontSize, object.latex],
  );
  const vectorPath = useMemo(() => {
    if (!layout.vectorPathsSvg) return null;
    return Skia.Path.MakeFromSVGString(layout.vectorPathsSvg);
  }, [layout.vectorPathsSvg]);

  const glyphParagraphs = useMemo(() => {
    return layout.glyphs.map((glyph) => {
      const builder = Skia.ParagraphBuilder.Make({ textAlign: TextAlign.Left });
      builder.pushStyle({
        color: Skia.Color(color),
        fontSize: glyph.fontSize,
        fontStyle: {
          weight: glyph.bold ? FontWeight.Bold : FontWeight.Normal,
          slant: glyph.italic ? FontSlant.Italic : FontSlant.Upright,
        },
      });
      builder.addText(glyph.text);
      const para = builder.build();
      const paraWidth = Math.max(24, glyph.fontSize * glyph.text.length + 12);
      para.layout(paraWidth);
      return { glyph, para, width: paraWidth };
    });
  }, [color, layout.glyphs]);

  const origin = useMemo(
    () => ({
      x: object.x + object.width / 2,
      y: object.y + object.height / 2,
    }),
    [object.height, object.width, object.x, object.y],
  );
  const transform = useMemo(
    () =>
      object.rotation === 0
        ? undefined
        : [{ rotate: (object.rotation * Math.PI) / 180 }],
    [object.rotation],
  );
  const availW = Math.max(12, object.width - OBJECT_PADDING * 2);
  const availH = Math.max(16, object.height - OBJECT_PADDING * 2);
  const contentScale = Math.min(
    availW / Math.max(1, layout.width),
    availH / Math.max(1, layout.height),
  );
  const originX = object.x + OBJECT_PADDING + (availW - layout.width * contentScale) / 2;
  const originY = object.y + OBJECT_PADDING + (availH - layout.height * contentScale) / 2;

  return (
    <Group origin={origin} transform={transform}>
      <Group
        transform={[
          { translateX: originX },
          { translateY: originY },
          { scale: contentScale },
        ]}
      >
        {vectorPath ? (
          <Path
            path={vectorPath}
            color={color}
            style="stroke"
            strokeWidth={Math.max(1.2, object.fontSize * 0.065)}
            strokeCap="round"
            strokeJoin="round"
          />
        ) : null}
        {activeSpan
          ? (() => {
              const matchedSlot = layout.slots.find(
                (slot) =>
                  slot.span.start === activeSpan.start && slot.span.end === activeSpan.end,
              );
              if (matchedSlot) {
                return (
                  <RoundedRect
                    key="hl-slot"
                    x={matchedSlot.x}
                    y={matchedSlot.y}
                    width={matchedSlot.width}
                    height={matchedSlot.height}
                    r={5}
                    color="rgba(37, 99, 235, 0.2)"
                  />
                );
              }
              return layout.glyphs.map((glyph, idx) => {
                if (
                  !glyph.span ||
                  glyph.span.end <= activeSpan.start ||
                  glyph.span.start >= activeSpan.end
                ) {
                  return null;
                }
                const gw = glyph.width ?? glyph.fontSize * 0.6;
                const gh = glyph.height ?? glyph.fontSize * 1.02;
                return (
                  <RoundedRect
                    key={`hl-${idx}`}
                    x={glyph.x - 3}
                    y={glyph.y - 2}
                    width={gw + 6}
                    height={gh + 4}
                    r={5}
                    color="rgba(37, 99, 235, 0.2)"
                  />
                );
              });
            })()
          : null}
        {glyphParagraphs.map((entry, idx) => (
          <Paragraph
            key={`${idx}-${entry.glyph.text}`}
            paragraph={entry.para}
            x={entry.glyph.x}
            y={entry.glyph.y}
            width={entry.width}
          />
        ))}
      </Group>
    </Group>
  );
});
