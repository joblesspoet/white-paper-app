import { memo, useCallback, useMemo, useRef } from 'react';
import { Text, View, type TextLayoutEvent } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import {
  OBJECT_PADDING,
  buildShapeRenderPrimitives,
  objectFill,
  objectTextColor,
  textColorValue,
  textLineHeight,
  type ShapeObject,
  type TextualObject,
} from '../../canvas/document';
import { radii } from '../../theme';
import { styles } from '../CanvasViewport.styles';

type CanvasObjectViewProps = {
  object: TextualObject;
  dark: boolean;
  hidden: boolean;
  offsetX: SharedValue<number>;
  offsetY: SharedValue<number>;
  scale: SharedValue<number>;
  onMeasure?: (id: string, height: number) => void;
};

export const CanvasObjectView = memo(function CanvasObjectView({
  object,
  dark,
  hidden,
  offsetX,
  offsetY,
  scale,
  onMeasure,
}: CanvasObjectViewProps) {
  const lineHeight = textLineHeight(object.fontSize);
  const fill = objectFill(object);
  const textColor = objectTextColor(object, dark);
  const measuredHeight = useRef(object.height);

  const handleTextLayout = useCallback(
    (event: TextLayoutEvent) => {
      if (object.type !== 'text' || !onMeasure) return;
      const lines = event.nativeEvent.lines.length;
      if (lines === 0) return;
      const height = lines * lineHeight + OBJECT_PADDING * 2;
      if (Math.abs(measuredHeight.current - height) < 1) return;
      measuredHeight.current = height;
      onMeasure(object.id, height);
    },
    [lineHeight, object.id, object.type, onMeasure],
  );

  const frame = useAnimatedStyle(() => ({
    left: object.x * scale.value + offsetX.value,
    top: object.y * scale.value + offsetY.value,
    width: object.width * scale.value,
    height: object.height * scale.value,
    borderRadius: radii.sm * scale.value,
    transform: [{ rotate: `${object.rotation}deg` }],
  }));

  const text = useAnimatedStyle(() => ({
    fontSize: object.fontSize * scale.value,
    lineHeight: lineHeight * scale.value,
    padding: OBJECT_PADDING * scale.value,
  }));

  if (hidden) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.object,
        { backgroundColor: fill ?? 'transparent' },
        object.isPrivate && {
          opacity: 0.82,
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: '#0D9488',
        },
        frame,
      ]}
    >
      <Animated.Text
        onTextLayout={handleTextLayout}
        style={[
          {
            color: textColor,
            fontWeight: object.fontWeight ?? 'normal',
            fontStyle: object.fontStyle ?? 'normal',
          },
          text,
        ]}
      >
        {object.text}
      </Animated.Text>
    </Animated.View>
  );
});

export const ShapeMeasurementsOverlay = memo(function ShapeMeasurementsOverlay({
  object,
  dark,
  offsetX,
  offsetY,
  scale,
}: {
  object: ShapeObject;
  dark: boolean;
  offsetX: SharedValue<number>;
  offsetY: SharedValue<number>;
  scale: SharedValue<number>;
}) {
  const color = textColorValue(object.colorKey, dark);
  const primitives = useMemo(
    () =>
      buildShapeRenderPrimitives(
        object.shape,
        0,
        0,
        object.width,
        object.height,
        object.direction,
        true,
      ),
    [object.direction, object.height, object.shape, object.width],
  );

  const frame = useAnimatedStyle(() => ({
    left: object.x * scale.value + offsetX.value,
    top: object.y * scale.value + offsetY.value,
    width: object.width * scale.value,
    height: object.height * scale.value,
    transform: [{ rotate: `${object.rotation}deg` }],
  }));

  if (!primitives.measurementLabels || primitives.measurementLabels.length === 0) return null;

  return (
    <Animated.View pointerEvents="none" style={[styles.object, frame]}>
      {primitives.measurementLabels.map((lbl, idx) => (
        <View
          key={idx}
          style={[
            styles.measurementLabelWrap,
            {
              left: `${(lbl.x / Math.max(1, object.width)) * 100}%`,
              top: `${(lbl.y / Math.max(1, object.height)) * 100}%`,
            },
          ]}
        >
          <Text style={[styles.measurementLabelText, { color }]}>{lbl.text}</Text>
        </View>
      ))}
    </Animated.View>
  );
});
