import { memo, useMemo } from 'react';
import {
  DashPathEffect,
  Group,
  Paragraph,
  RoundedRect,
  Skia,
  TextAlign,
  vec,
} from '@shopify/react-native-skia';

import type { CanvasObject } from '../../canvas/document';

export type PrivateBadgeLayerProps = {
  object: CanvasObject;
};

const PRIVATE_TEAL = '#0D9488';

export const PrivateBadgeLayer = memo(function PrivateBadgeLayer({
  object,
}: PrivateBadgeLayerProps) {
  const cx = object.x + object.width / 2;
  const cy = object.y + object.height / 2;

  const badgePara = useMemo(() => {
    const builder = Skia.ParagraphBuilder.Make({ textAlign: TextAlign.Center });
    builder.pushStyle({ color: Skia.Color('#FFFFFF'), fontSize: 9 });
    builder.addText('Private');
    const para = builder.build();
    para.layout(44);
    return para;
  }, []);

  const badgeWidth = 44;
  const badgeHeight = 14;
  const badgeX = object.x + Math.max(0, object.width - badgeWidth - 4);
  const badgeY = object.y - badgeHeight / 2;

  return (
    <Group transform={[{ rotate: (object.rotation * Math.PI) / 180 }]} origin={vec(cx, cy)}>
      <RoundedRect
        x={object.x - 2}
        y={object.y - 2}
        width={object.width + 4}
        height={object.height + 4}
        r={8}
        style="stroke"
        strokeWidth={1.5}
        color={PRIVATE_TEAL}
        opacity={0.9}
      >
        <DashPathEffect intervals={[5, 4]} />
      </RoundedRect>
      <RoundedRect
        x={badgeX}
        y={badgeY}
        width={badgeWidth}
        height={badgeHeight}
        r={7}
        color={PRIVATE_TEAL}
      />
      <Paragraph
        paragraph={badgePara}
        x={badgeX}
        y={badgeY + Math.max(0, (badgeHeight - badgePara.getHeight()) / 2)}
        width={badgeWidth}
      />
    </Group>
  );
});
