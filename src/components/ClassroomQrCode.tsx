import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { encodeQrMatrix } from '../classroom/qr';
import { classroomQrStyles as styles } from './ClassroomQrCode.styles';

type ClassroomQrCodeProps = {
  value: string;
  size?: number;
  borderColor?: string;
};

export const ClassroomQrCode = React.memo(function ClassroomQrCode({
  value,
  size = 156,
  borderColor = '#E2E8F0',
}: ClassroomQrCodeProps) {
  const matrix = useMemo(() => encodeQrMatrix(value), [value]);
  const quietZone = 2;
  const totalModules = matrix.size + quietZone * 2;
  const moduleSize = size / totalModules;

  const rects = useMemo(() => {
    const items: { key: string; x: number; y: number }[] = [];
    for (let r = 0; r < matrix.size; r += 1) {
      for (let c = 0; c < matrix.size; c += 1) {
        if (matrix.modules[r][c]) {
          items.push({
            key: `${r}-${c}`,
            x: (c + quietZone) * moduleSize,
            y: (r + quietZone) * moduleSize,
          });
        }
      }
    }
    return items;
  }, [matrix, moduleSize]);

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`QR code for ${value}`}
      style={[styles.frame, { borderColor }]}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Rect x={0} y={0} width={size} height={size} fill="#FFFFFF" />
        {rects.map((rect) => (
          <Rect
            key={rect.key}
            x={rect.x}
            y={rect.y}
            width={moduleSize + 0.15}
            height={moduleSize + 0.15}
            fill="#0F172A"
          />
        ))}
      </Svg>
    </View>
  );
});
