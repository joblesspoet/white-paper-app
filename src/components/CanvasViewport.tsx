import { Canvas, Circle, Group, Path, Rect, Skia } from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';

import {
  appendInkPoint,
  createInkStroke,
  DEFAULT_ERASER_RADIUS,
  eraseStrokesAt,
  eraserRadiusForScale,
  inkPathData,
  MIN_POINT_DISTANCE_SCREEN,
  type FreehandTool,
  type InkStroke,
} from '../canvas/ink';
import {
  IDENTITY_VIEWPORT,
  MAX_ZOOM,
  MIN_ZOOM,
  resetViewport,
  screenToCanvas,
  type Point,
  type Viewport,
} from '../canvas/viewport';
import { colors, darkColors, radii, spacing, touchTarget, typography } from '../theme';

export { canvasToScreen, screenToCanvas } from '../canvas/viewport';
export type { InkStroke } from '../canvas/ink';

export type InkTool = 'select' | 'pen' | 'highlighter' | 'eraser' | 'text' | 'sticky';
export type ViewportState = Viewport;
export type CanvasObject = { id: string; type: 'text' | 'sticky'; text: string; x: number; y: number; width: number; height: number; rotation: number; color: string; backgroundColor?: string; fontSize: number; };
type CanvasViewportProps = {
  dark?: boolean;
  initialViewport?: Viewport;
  activeTool?: InkTool;
  color?: string;
  width?: number;
  opacity?: number;
  eraserRadius?: number;
  undoRequest?: number;
  redoRequest?: number;
  onViewportChange?: (viewport: ViewportState) => void;
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
  onInkChange?: (hasInk: boolean) => void;
  objects?: CanvasObject[];
  onObjectCreate?: (type: 'text' | 'sticky', point: Point) => void;
  onObjectMove?: (id: string, point: Point) => void;
  onObjectEdit?: (object: CanvasObject) => void;
};

type InkState = {
  strokes: InkStroke[];
  active: InkStroke | null;
  redo: InkStroke[];
};

type InkAction =
  | { type: 'start'; stroke: InkStroke }
  | { type: 'append'; point: Point; minDistance: number }
  | { type: 'commit' }
  | { type: 'erase'; point: Point; radius: number }
  | { type: 'undo' }
  | { type: 'redo' };

const EMPTY_INK: InkState = { strokes: [], active: null, redo: [] };

/**
 * Ink changes are one reducer so a stroke cannot be committed twice, and so
 * erasing or finishing a stroke clears redo in a single update.
 */
function inkReducer(state: InkState, action: InkAction): InkState {
  switch (action.type) {
    case 'start':
      return { ...state, active: action.stroke };
    case 'append':
      return state.active
        ? { ...state, active: appendInkPoint(state.active, action.point, action.minDistance) }
        : state;
    case 'commit':
      if (!state.active) return state;
      return { strokes: [...state.strokes, state.active], active: null, redo: [] };
    case 'erase': {
      if (state.strokes.length === 0) return state;
      const result = eraseStrokesAt(state.strokes, action.point, action.radius);
      if (result.erasedIds.length === 0) return state;
      return { ...state, strokes: result.strokes, redo: [] };
    }
    case 'undo': {
      const stroke = state.strokes[state.strokes.length - 1];
      if (!stroke) return state;
      return { strokes: state.strokes.slice(0, -1), active: null, redo: [...state.redo, stroke] };
    }
    case 'redo': {
      const stroke = state.redo[state.redo.length - 1];
      if (!stroke) return state;
      return { strokes: [...state.strokes, stroke], active: null, redo: state.redo.slice(0, -1) };
    }
    default:
      return state;
  }
}

export function CanvasViewport({
  dark = false,
  initialViewport,
  activeTool = 'select',
  color = colors.foreground,
  width = 4,
  opacity = 1,
  eraserRadius = DEFAULT_ERASER_RADIUS,
  undoRequest = 0,
  redoRequest = 0,
  onViewportChange,
  onHistoryChange,
  onInkChange,
  objects = [],
  onObjectCreate,
  onObjectMove,
  onObjectEdit,
}: CanvasViewportProps) {
  const theme = dark ? darkColors : colors;
  const startViewport = initialViewport ?? IDENTITY_VIEWPORT;
  const offsetX = useSharedValue(startViewport.x);
  const offsetY = useSharedValue(startViewport.y);
  const scale = useSharedValue(startViewport.scale);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const pinchAnchorX = useSharedValue(0);
  const pinchAnchorY = useSharedValue(0);
  const draggingObjectId = useSharedValue('');
  const eraserX = useSharedValue(-10000);
  const eraserY = useSharedValue(-10000);
  const [ink, dispatch] = useReducer(inkReducer, EMPTY_INK);
  const [viewport, setViewport] = useState<Viewport>(startViewport);
  const lastViewportReport = useRef(0);

  useEffect(() => {
    onHistoryChange?.(ink.strokes.length > 0, ink.redo.length > 0);
  }, [ink.strokes.length, ink.redo.length, onHistoryChange]);
  useEffect(() => {
    onInkChange?.(ink.strokes.length > 0 || ink.active !== null);
  }, [ink.strokes.length, ink.active, onInkChange]);
  useEffect(() => {
    if (undoRequest > 0) dispatch({ type: 'undo' });
  }, [undoRequest]);
  useEffect(() => {
    if (redoRequest > 0) dispatch({ type: 'redo' });
  }, [redoRequest]);
  useEffect(() => {
    if (activeTool !== 'eraser') {
      eraserX.value = -10000;
      eraserY.value = -10000;
    }
  }, [activeTool, eraserX, eraserY]);

  const report = useCallback((x: number, y: number, nextScale: number) => {
    onViewportChange?.({ x, y, scale: nextScale });
    const now = Date.now();
    if (now - lastViewportReport.current < 60) return;
    lastViewportReport.current = now;
    setViewport({ x, y, scale: nextScale });
  }, [onViewportChange]);

  const commit = useCallback((x: number, y: number, nextScale: number) => {
    lastViewportReport.current = Date.now();
    setViewport({ x, y, scale: nextScale });
    onViewportChange?.({ x, y, scale: nextScale });
  }, [onViewportChange]);

  const resetView = useCallback(() => {
    const next = resetViewport();
    offsetX.value = next.x;
    offsetY.value = next.y;
    scale.value = next.scale;
    commit(next.x, next.y, next.scale);
  }, [commit, offsetX, offsetY, scale]);

  const beginStroke = useCallback((point: Point) => {
    const tool: FreehandTool = activeTool === 'highlighter' ? 'highlighter' : 'pen';
    dispatch({
      type: 'start',
      stroke: createInkStroke({
        id: `ink-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        tool,
        point,
        color,
        width,
        opacity,
      }),
    });
  }, [activeTool, color, opacity, width]);
  const addPoint = useCallback((point: Point, minDistance: number) => {
    dispatch({ type: 'append', point, minDistance });
  }, []);
  const finishStroke = useCallback(() => dispatch({ type: 'commit' }), []);
  const eraseAt = useCallback((point: Point, currentScale: number) => {
    dispatch({ type: 'erase', point, radius: eraserRadiusForScale(eraserRadius, currentScale) });
  }, [eraserRadius]);

  const drawGesture = Gesture.Pan()
    .enabled(activeTool === 'pen' || activeTool === 'highlighter')
    .maxPointers(1)
    .minDistance(0)
    .onStart((event) => {
      const point = screenToCanvas(
        { x: event.x, y: event.y },
        { x: offsetX.value, y: offsetY.value, scale: scale.value },
      );
      runOnJS(beginStroke)(point);
    })
    .onUpdate((event) => {
      const point = screenToCanvas(
        { x: event.x, y: event.y },
        { x: offsetX.value, y: offsetY.value, scale: scale.value },
      );
      runOnJS(addPoint)(point, MIN_POINT_DISTANCE_SCREEN / scale.value);
    })
    .onFinalize(() => { runOnJS(finishStroke)(); });

  const eraseGesture = Gesture.Pan()
    .enabled(activeTool === 'eraser')
    .maxPointers(1)
    .minDistance(0)
    .onStart((event) => {
      const point = screenToCanvas(
        { x: event.x, y: event.y },
        { x: offsetX.value, y: offsetY.value, scale: scale.value },
      );
      eraserX.value = point.x;
      eraserY.value = point.y;
      runOnJS(eraseAt)(point, scale.value);
    })
    .onUpdate((event) => {
      const point = screenToCanvas(
        { x: event.x, y: event.y },
        { x: offsetX.value, y: offsetY.value, scale: scale.value },
      );
      eraserX.value = point.x;
      eraserY.value = point.y;
      runOnJS(eraseAt)(point, scale.value);
    })
    .onFinalize(() => {
      eraserX.value = -10000;
      eraserY.value = -10000;
    });

  const selectGesture = Gesture.Pan()
    .enabled(activeTool === 'select')
    .maxPointers(1)
    .minDistance(0)
    .onStart((event) => {
      const point = screenToCanvas(
        { x: event.x, y: event.y },
        { x: offsetX.value, y: offsetY.value, scale: scale.value },
      );
      const hit = objects.slice().reverse().find((item) => point.x >= item.x && point.x <= item.x + item.width && point.y >= item.y && point.y <= item.y + item.height);
      draggingObjectId.value = hit?.id ?? '';
      startX.value = offsetX.value;
      startY.value = offsetY.value;
      if (hit && onObjectMove) runOnJS(onObjectMove)(hit.id, point);
    })
    .onUpdate((event) => {
      if (draggingObjectId.value !== '') {
        if (onObjectMove) {
          const point = screenToCanvas(
            { x: event.x, y: event.y },
            { x: offsetX.value, y: offsetY.value, scale: scale.value },
          );
          runOnJS(onObjectMove)(draggingObjectId.value, point);
        }
        return;
      }
      offsetX.value = startX.value + event.translationX;
      offsetY.value = startY.value + event.translationY;
      runOnJS(report)(offsetX.value, offsetY.value, scale.value);
    })
    .onFinalize(() => {
      if (draggingObjectId.value === '') runOnJS(commit)(offsetX.value, offsetY.value, scale.value);
      draggingObjectId.value = '';
    });

  const objectTap = Gesture.Tap()
    .enabled((activeTool === 'text' || activeTool === 'sticky') && !!onObjectCreate)
    .onEnd((event) => {
      if (onObjectCreate) {
        const point = screenToCanvas(
          { x: event.x, y: event.y },
          { x: offsetX.value, y: offsetY.value, scale: scale.value },
        );
        runOnJS(onObjectCreate)(activeTool as 'text' | 'sticky', point);
      }
    });

  /**
   * Pinch is also the two-finger pan: the focal point moves with the fingers,
   * so anchoring the canvas point under it keeps panning and zooming correct
   * while a drawing tool stays armed for one-finger input.
   */
  const pinchGesture = Gesture.Pinch()
    .onStart((event) => {
      startScale.value = scale.value;
      pinchAnchorX.value = (event.focalX - offsetX.value) / scale.value;
      pinchAnchorY.value = (event.focalY - offsetY.value) / scale.value;
    })
    .onUpdate((event) => {
      const nextScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, startScale.value * event.scale));
      scale.value = nextScale;
      offsetX.value = event.focalX - pinchAnchorX.value * nextScale;
      offsetY.value = event.focalY - pinchAnchorY.value * nextScale;
      runOnJS(report)(offsetX.value, offsetY.value, scale.value);
    })
    .onFinalize(() => { runOnJS(commit)(offsetX.value, offsetY.value, scale.value); });

  const primaryGesture = activeTool === 'eraser'
    ? eraseGesture
    : activeTool === 'pen' || activeTool === 'highlighter'
      ? drawGesture
      : activeTool === 'text' || activeTool === 'sticky'
        ? objectTap
        : selectGesture;
  const gesture = Gesture.Simultaneous(primaryGesture, pinchGesture);

  const transform = useDerivedValue(() => [
    { translateX: offsetX.value },
    { translateY: offsetY.value },
    { scale: scale.value },
  ]);
  const eraserRadiusCanvas = useDerivedValue(() => eraserRadiusForScale(eraserRadius, scale.value));
  const renderedStrokes = useMemo(
    () => [...ink.strokes, ...(ink.active ? [ink.active] : [])],
    [ink.strokes, ink.active],
  );
  const zoomLabel = `${Math.round(viewport.scale * 100)}%`;

  return (
    <View style={styles.root} accessibilityLabel="Interactive canvas viewport">
      <GestureDetector gesture={gesture}>
        <Canvas style={StyleSheet.absoluteFill} accessibilityLabel="Drawing canvas">
          <Group transform={transform}>
            <Rect x={-4000} y={-4000} width={8000} height={8000} color={theme.background} />
            {renderedStrokes.map((stroke) => (
              <InkStrokeView key={stroke.id} stroke={stroke} dark={dark} />
            ))}
            {activeTool === 'eraser' && (
              <Circle
                cx={eraserX}
                cy={eraserY}
                r={eraserRadiusCanvas}
                color={theme.foreground}
                opacity={0.14}
                style="stroke"
                strokeWidth={1.5}
              />
            )}
          </Group>
        </Canvas>
      </GestureDetector>

      {objects.map((object) => <CanvasObjectView key={object.id} object={object} offsetX={offsetX} offsetY={offsetY} scale={scale} />)}

      <View style={styles.hud} pointerEvents="box-none">
        <View style={[styles.viewBadge, { backgroundColor: theme.surface, borderColor: theme.border }]} pointerEvents="none" accessibilityLabel={`Zoom ${zoomLabel}`}>
          <Text style={[styles.zoomText, { color: theme.foreground }]}>{zoomLabel}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reset viewport"
          accessibilityHint="Returns the canvas to 100% zoom at the origin"
          onPress={resetView}
          style={({ pressed }) => [styles.resetButton, { backgroundColor: theme.surface, borderColor: theme.border }, pressed && styles.pressed]}
        >
          <Text style={[styles.resetText, { color: theme.foreground }]}>Reset view</Text>
        </Pressable>
      </View>
    </View>
  );
}

function InkStrokeView({ stroke, dark }: { stroke: InkStroke; dark: boolean }) {
  const path = useMemo(() => {
    return Skia.Path.MakeFromSVGString(inkPathData(stroke.points)) ?? Skia.Path.Make();
  }, [stroke.points]);
  return (
    <Path
      path={path}
      color={stroke.color}
      opacity={stroke.opacity}
      style="stroke"
      strokeWidth={stroke.width}
      strokeCap="round"
      strokeJoin="round"
      blendMode={stroke.tool === 'highlighter' ? (dark ? 'screen' : 'multiply') : 'srcOver'}
    />
  );
}

type CanvasObjectViewProps = {
  object: CanvasObject;
  offsetX: { value: number };
  offsetY: { value: number };
  scale: { value: number };
};

function CanvasObjectView({ object, offsetX, offsetY, scale }: CanvasObjectViewProps) {
  const frame = useAnimatedStyle(() => ({
    left: object.x * scale.value + offsetX.value,
    top: object.y * scale.value + offsetY.value,
    width: object.width * scale.value,
    minHeight: object.height * scale.value,
    transform: [{ rotate: `${object.rotation}deg` }],
  }), [object]);
  const text = useAnimatedStyle(() => ({ fontSize: object.fontSize * scale.value }), [object]);
  return (
    <Animated.View pointerEvents="none" style={[styles.object, { backgroundColor: object.backgroundColor ?? 'transparent' }, frame]}>
      <Animated.Text style={[{ color: object.color }, text]}>{object.text || (object.type === 'sticky' ? ' ' : 'Text')}</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  object: { position: 'absolute', minWidth: 48, minHeight: 32, padding: 8 },
  hud: { position: 'absolute', top: spacing.sm, right: spacing.sm, alignItems: 'flex-end', gap: spacing.xs },
  viewBadge: { borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, alignItems: 'flex-end' },
  zoomText: { ...typography.bodyStrong },
  resetButton: { minHeight: touchTarget, minWidth: touchTarget, borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center' },
  resetText: { ...typography.caption },
  pressed: { opacity: 0.6 },
});
