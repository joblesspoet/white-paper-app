import { Canvas, Group, Path, Rect, Skia } from '@shopify/react-native-skia';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';

import { colors } from '../theme';

type Point = { x: number; y: number };
export type InkStroke = { id: string; points: Point[] };
export type ViewportState = { x: number; y: number; scale: number };
type CanvasViewportProps = {
  dark?: boolean;
  drawingEnabled?: boolean;
  onViewportChange?: (viewport: ViewportState) => void;
  onStrokesChange?: (strokes: InkStroke[]) => void;
};

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const STROKE_COLOR = '#134E4A';
const STROKE_WIDTH = 4;

export function CanvasViewport({ dark = false, drawingEnabled = false, onViewportChange, onStrokesChange }: CanvasViewportProps) {
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const scale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const [strokes, setStrokes] = useState<InkStroke[]>([]);
  const [activeStroke, setActiveStroke] = useState<InkStroke | null>(null);

  const report = (x: number, y: number, nextScale: number) => onViewportChange?.({ x, y, scale: nextScale });
  const appendPoint = (point: Point) => setActiveStroke((current) => current ? { ...current, points: [...current.points, point] } : current);
  const finishStroke = () => {
    setActiveStroke((current) => {
      if (!current || current.points.length < 2) return null;
      setStrokes((existing) => { const next = [...existing, current]; onStrokesChange?.(next); return next; });
      return null;
    });
  };

  const draw = Gesture.Pan().enabled(drawingEnabled).minDistance(0).onStart((event) => {
    runOnJS(setActiveStroke)({ id: `${Date.now()}-${Math.random()}`, points: [{ x: (event.x - offsetX.value) / scale.value, y: (event.y - offsetY.value) / scale.value }] });
  }).onUpdate((event) => {
    runOnJS(appendPoint)({ x: (event.x - offsetX.value) / scale.value, y: (event.y - offsetY.value) / scale.value });
  }).onEnd(() => { runOnJS(finishStroke)(); });

  const pan = Gesture.Pan().enabled(!drawingEnabled).onStart(() => { startX.value = offsetX.value; startY.value = offsetY.value; }).onChange((event) => {
    offsetX.value = startX.value + event.translationX;
    offsetY.value = startY.value + event.translationY;
    runOnJS(report)(offsetX.value, offsetY.value, scale.value);
  });
  const pinch = Gesture.Pinch().onStart(() => { startScale.value = scale.value; }).onChange((event) => {
    scale.value = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, startScale.value * event.scale));
    runOnJS(report)(offsetX.value, offsetY.value, scale.value);
  });
  const gesture = Gesture.Simultaneous(drawingEnabled ? draw : pan, pinch);
  const canvasColor = dark ? colors.darkBackground : colors.background;
  const gridColor = dark ? colors.darkBorder : colors.border;
  const renderedStrokes = useMemo(() => [...strokes, ...(activeStroke ? [activeStroke] : [])], [strokes, activeStroke]);

  return (
    <View style={styles.root} accessibilityLabel="Interactive canvas viewport">
      <GestureDetector gesture={gesture}>
        <Canvas style={StyleSheet.absoluteFill} accessibilityLabel="Canvas surface">
          <Group transform={[{ translateX: offsetX.value }, { translateY: offsetY.value }, { scale: scale.value }]}>
            <Rect x={-2000} y={-2000} width={4000} height={4000} color={canvasColor} />
            {renderedStrokes.map((stroke) => <Path key={stroke.id} path={pathFromPoints(stroke.points)} color={dark ? '#E6F4F1' : STROKE_COLOR} style="stroke" strokeWidth={STROKE_WIDTH} strokeCap="round" strokeJoin="round" />)}
            <Rect x={-2000} y={-2000} width={4000} height={1} color={gridColor} opacity={0.2} />
          </Group>
        </Canvas>
      </GestureDetector>
    </View>
  );
}

function pathFromPoints(points: Point[]) {
  const first = points[0];
  if (!first) return Skia.Path.Make();
  const commands = [`M ${first.x} ${first.y}`, ...points.slice(1).map((point) => `L ${point.x} ${point.y}`)];
  return Skia.Path.MakeFromSVGString(commands.join(' ')) ?? Skia.Path.Make();
}

export function screenToCanvas(point: Point, viewport: ViewportState): Point { return { x: (point.x - viewport.x) / viewport.scale, y: (point.y - viewport.y) / viewport.scale }; }
export function canvasToScreen(point: Point, viewport: ViewportState): Point { return { x: point.x * viewport.scale + viewport.x, y: point.y * viewport.scale + viewport.y }; }

const styles = StyleSheet.create({ root: { flex: 1, overflow: 'hidden' } });
