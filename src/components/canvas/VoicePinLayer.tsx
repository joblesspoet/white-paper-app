import { memo, useMemo } from 'react';
import {
  Circle,
  Group,
  Paragraph,
  Path,
  RoundedRect,
  Skia,
  TextAlign,
  vec,
} from '@shopify/react-native-skia';

import { formatVoiceDuration } from '../../audio/voice-pin-model';
import { textColorValue, type VoicePinObject } from '../../canvas/document';

export type VoicePinLayerProps = {
  object: VoicePinObject;
  dark: boolean;
  isPlaying?: boolean;
};

export const VoicePinLayer = memo(function VoicePinLayer({
  object,
  dark,
  isPlaying = false,
}: VoicePinLayerProps) {
  const accent = textColorValue(object.colorKey, dark);
  const pillBg = dark ? '#1E293B' : '#FFFFFF';
  const durationColor = dark ? '#E2E8F0' : '#0F172A';
  const cx = object.x + object.width / 2;
  const cy = object.y + object.height / 2;
  const radius = object.height / 2;

  const badgeCx = object.x + 20;
  const badgeCy = cy;

  const playOrPausePath = useMemo(() => {
    if (isPlaying) {
      return `M ${badgeCx - 4} ${badgeCy - 5} h 2.5 v 10 h -2.5 Z M ${badgeCx + 1.5} ${badgeCy - 5} h 2.5 v 10 h -2.5 Z`;
    }
    return `M ${badgeCx - 3} ${badgeCy - 5} L ${badgeCx + 5} ${badgeCy} L ${badgeCx - 3} ${badgeCy + 5} Z`;
  }, [badgeCx, badgeCy, isPlaying]);

  const durationPara = useMemo(() => {
    const label = formatVoiceDuration(object.durationMs);
    const builder = Skia.ParagraphBuilder.Make({ textAlign: TextAlign.Right });
    builder.pushStyle({ color: Skia.Color(durationColor), fontSize: 11 });
    builder.addText(label);
    const para = builder.build();
    para.layout(36);
    return para;
  }, [durationColor, object.durationMs]);

  const bars = useMemo(() => {
    const peaks = object.waveformPeaks;
    const startX = object.x + 36;
    const areaWidth = Math.max(24, object.width - 78);
    const step = areaWidth / Math.max(1, peaks.length);
    const barW = Math.max(1.8, step * 0.55);
    return peaks.map((peak, index) => {
      const h = Math.max(4, Math.min(20, peak * 20));
      return {
        x: startX + index * step,
        y: cy - h / 2,
        w: barW,
        h,
      };
    });
  }, [cy, object.waveformPeaks, object.width, object.x]);

  return (
    <Group transform={[{ rotate: (object.rotation * Math.PI) / 180 }]} origin={vec(cx, cy)}>
      <RoundedRect
        x={object.x}
        y={object.y}
        width={object.width}
        height={object.height}
        r={radius}
        color={pillBg}
      />
      <RoundedRect
        x={object.x}
        y={object.y}
        width={object.width}
        height={object.height}
        r={radius}
        style="stroke"
        strokeWidth={isPlaying ? 2 : 1.5}
        color={accent}
      />
      <Circle cx={badgeCx} cy={badgeCy} r={11} color={accent} />
      <Path path={playOrPausePath} color="#FFFFFF" />
      {bars.map((bar, idx) => (
        <RoundedRect
          key={idx}
          x={bar.x}
          y={bar.y}
          width={bar.w}
          height={bar.h}
          r={1}
          color={accent}
          opacity={isPlaying ? 0.95 : 0.7}
        />
      ))}
      <Paragraph
        paragraph={durationPara}
        x={object.x + object.width - 44}
        y={cy - durationPara.getHeight() / 2}
        width={36}
      />
    </Group>
  );
});
