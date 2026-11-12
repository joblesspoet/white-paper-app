import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { hexToHsv, hsvToHex, isHexColor, isReadableOn, type Hsv } from '../canvas/colors';
import { radii, spacing, touchTarget, typography, type ThemeColors } from '../theme';

type ColorPickerProps = {
  theme: ThemeColors;
  /** Current colour, used to seed the picker. Palette keys are resolved by the caller. */
  value: string;
  /** Canvas or paper colour behind the result, used for the contrast hint. */
  background: string;
  /** Notes pick their own ink, so they do not need the warning. */
  checkContrast?: boolean;
  onChange: (hex: string) => void;
  onClose: () => void;
};

const FIELD_HEIGHT = 148;
const HUE_HEIGHT = 28;
const THUMB_SIZE = 22;

/** Hue strip stops: the full wheel, returning to red so the ends match. */
const HUE_STOPS = ['#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FF0000'];

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Inline HSV picker shared by every colour tool. Two direct-manipulation
 * surfaces (saturation/value field and hue strip) cover the full sRGB gamut
 * without pulling in a native picker dependency.
 */
export function ColorPicker({
  theme,
  value,
  background,
  checkContrast = true,
  onChange,
  onClose,
}: ColorPickerProps) {
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value));
  const [field, setField] = useState({ width: 0, height: FIELD_HEIGHT });
  const [hueWidth, setHueWidth] = useState(0);
  /** Remembers our own output so an external preset can reseed the picker. */
  const lastEmitted = useRef(value);

  useEffect(() => {
    if (!isHexColor(value) || value === lastEmitted.current) return;
    lastEmitted.current = value;
    setHsv(hexToHsv(value));
  }, [value]);

  const hex = hsvToHex(hsv);
  const hueColor = hsvToHex({ h: hsv.h, s: 1, v: 1 });
  const lowContrast = checkContrast && field.width > 0 && !isReadableOn(hex, background);

  const apply = (next: Hsv) => {
    const nextHex = hsvToHex(next);
    lastEmitted.current = nextHex;
    setHsv(next);
    onChange(nextHex);
  };

  const updateField = (event: GestureResponderEvent) => {
    if (field.width === 0) return;
    const { locationX, locationY } = event.nativeEvent;
    apply({ ...hsv, s: clamp01(locationX / field.width), v: 1 - clamp01(locationY / field.height) });
  };

  const updateHue = (event: GestureResponderEvent) => {
    if (hueWidth === 0) return;
    const { locationX } = event.nativeEvent;
    apply({ ...hsv, h: clamp01(locationX / hueWidth) * 360 });
  };

  return (
    <View style={[styles.root, { borderColor: theme.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.foreground }]}>Custom colour</Text>
        <View style={styles.headerRight}>
          <View style={[styles.preview, { backgroundColor: hex, borderColor: theme.border }]} />
          <Text style={[styles.hex, { color: theme.foreground }]}>{hex}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close custom colour picker"
            onPress={onClose}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          >
            <Text style={[styles.closeText, { color: theme.primary }]}>Done</Text>
          </Pressable>
        </View>
      </View>

      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Colour saturation and brightness"
        accessibilityValue={{ text: hex }}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setField({ width, height });
        }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={updateField}
        onResponderMove={updateField}
        style={[styles.field, { borderColor: theme.border }]}
      >
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="fc-sat" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="1" />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
            </LinearGradient>
            <LinearGradient id="fc-val" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#000000" stopOpacity="0" />
              <Stop offset="1" stopColor="#000000" stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={hueColor} />
          <Rect width="100%" height="100%" fill="url(#fc-sat)" />
          <Rect width="100%" height="100%" fill="url(#fc-val)" />
        </Svg>
        {field.width > 0 && (
          <View
            pointerEvents="none"
            style={[
              styles.thumb,
              {
                backgroundColor: hex,
                left: hsv.s * field.width - THUMB_SIZE / 2,
                top: (1 - hsv.v) * field.height - THUMB_SIZE / 2,
              },
            ]}
          />
        )}
      </View>

      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Colour hue"
        accessibilityValue={{ text: hex }}
        hitSlop={{ top: 8, bottom: 8 }}
        onLayout={(event) => setHueWidth(event.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={updateHue}
        onResponderMove={updateHue}
        style={[styles.hue, { borderColor: theme.border }]}
      >
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="fc-hue" x1="0" y1="0" x2="1" y2="0">
              {HUE_STOPS.map((stop, index) => (
                <Stop key={stop + index} offset={index / (HUE_STOPS.length - 1)} stopColor={stop} />
              ))}
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#fc-hue)" />
        </Svg>
        {hueWidth > 0 && (
          <View
            pointerEvents="none"
            style={[styles.hueThumb, { left: (hsv.h / 360) * hueWidth - 2 }]}
          />
        )}
      </View>

      <Text style={[styles.hint, { color: lowContrast ? theme.destructive : theme.foreground }]}>
        {lowContrast
          ? 'Low contrast on this canvas — try a lighter or darker shade.'
          : 'Drag the field and the strip to choose any colour.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderTopWidth: 1, paddingTop: spacing.sm, gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.caption },
  preview: { width: 20, height: 20, borderRadius: 10, borderWidth: 1 },
  hex: { ...typography.caption, opacity: 0.75 },
  close: { minWidth: touchTarget, minHeight: touchTarget, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xs },
  closeText: { ...typography.caption },
  field: { height: FIELD_HEIGHT, borderRadius: radii.sm, borderWidth: 1, overflow: 'hidden' },
  thumb: { position: 'absolute', width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: THUMB_SIZE / 2, borderWidth: 2, borderColor: '#FFFFFF' },
  hue: { height: HUE_HEIGHT, borderRadius: radii.sm, borderWidth: 1, overflow: 'hidden' },
  hueThumb: { position: 'absolute', top: 0, bottom: 0, width: 4, borderRadius: 2, borderWidth: 1, borderColor: '#FFFFFF' },
  hint: { ...typography.caption, opacity: 0.75 },
  pressed: { opacity: 0.65 },
});
