import { Canvas, Circle, Group, Path, Rect, Skia } from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';

import {
  OBJECT_PADDING,
  objectAtPoint,
  objectFill,
  objectTextColor,
  textLineHeight,
  type CanvasDocument,
  type CanvasObject,
  type DocumentCommand,
} from '../canvas/document';
import {
  appendInkPoint,
  createInkStroke,
  DEFAULT_ERASER_RADIUS,
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

/** Minimum finger travel before a touch on an object counts as a drag, not a tap. */
const DRAG_THRESHOLD_SCREEN = 4;

export type ViewportRequest = { key: number; viewport: Viewport };

type CanvasViewportProps = {
  dark?: boolean;
  initialViewport?: Viewport;
  activeTool?: InkTool;
  color?: string;
  width?: number;
  opacity?: number;
  eraserRadius?: number;
  document: CanvasDocument;
  selectedObjectId?: string | null;
  /** Object currently open in the in-place text editor; it is hidden here. */
  editingObjectId?: string | null;
  /** Absolute viewport the editor asks for, for example to clear the keyboard. */
  viewportRequest?: ViewportRequest | null;
  onViewportChange?: (viewport: ViewportState) => void;
  onCommand: (command: DocumentCommand, transient?: boolean) => void;
  onCommitPending: () => void;
  onObjectCreate?: (type: 'text' | 'sticky', point: Point) => void;
  onObjectSelect?: (id: string | null) => void;
  onObjectEdit?: (id: string) => void;
  /** A touch on the canvas while an object is being edited: commit the edit. */
  onCanvasTouch?: () => void;
};

export function CanvasViewport({
  dark = false,
  initialViewport,
  activeTool = 'select',
  color = colors.foreground,
  width = 4,
  opacity = 1,
  eraserRadius = DEFAULT_ERASER_RADIUS,
  document,
  selectedObjectId = null,
  editingObjectId = null,
  viewportRequest = null,
  onViewportChange,
  onCommand,
  onCommitPending,
  onObjectCreate,
  onObjectSelect,
  onObjectEdit,
  onCanvasTouch,
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
  const dragMoved = useSharedValue(false);
  const tapOpensEditor = useSharedValue('');
  const grabOffsetX = useSharedValue(0);
  const grabOffsetY = useSharedValue(0);
  const eraserX = useSharedValue(-10000);
  const eraserY = useSharedValue(-10000);
  /** The stroke being drawn is local: it only enters the document on release. */
  const [activeStroke, setActiveStroke] = useState<InkStroke | null>(null);
  const activeStrokeRef = useRef<InkStroke | null>(null);
  const [viewport, setViewport] = useState<Viewport>(startViewport);
  const lastViewportReport = useRef(0);

  const editing = editingObjectId !== null;
  const objects = document.objects;

  const report = useCallback((x: number, y: number, nextScale: number) => {
    onViewportChange?.({ x, y, scale: nextScale });
    const now = Date.now();
    if (now - lastViewportReport.current < 60) return;
    lastViewportReport.current = now;
    setViewport({ x, y, scale: nextScale });
  }, [onViewportChange]);

  const commitViewport = useCallback((x: number, y: number, nextScale: number) => {
    lastViewportReport.current = Date.now();
    setViewport({ x, y, scale: nextScale });
    onViewportChange?.({ x, y, scale: nextScale });
  }, [onViewportChange]);

  const resetView = useCallback(() => {
    const next = resetViewport();
    offsetX.value = next.x;
    offsetY.value = next.y;
    scale.value = next.scale;
    commitViewport(next.x, next.y, next.scale);
  }, [commitViewport, offsetX, offsetY, scale]);

  useEffect(() => {
    if (!viewportRequest) return;
    offsetX.value = viewportRequest.viewport.x;
    offsetY.value = viewportRequest.viewport.y;
    scale.value = viewportRequest.viewport.scale;
    commitViewport(viewportRequest.viewport.x, viewportRequest.viewport.y, viewportRequest.viewport.scale);
    // `key` identifies a new request; the viewport object itself is not compared.
  }, [viewportRequest?.key]);

  useEffect(() => {
    if (activeTool !== 'eraser') {
      eraserX.value = -10000;
      eraserY.value = -10000;
    }
  }, [activeTool, eraserX, eraserY]);

  const beginStroke = useCallback((point: Point) => {
    const tool: FreehandTool = activeTool === 'highlighter' ? 'highlighter' : 'pen';
    const stroke = createInkStroke({
      id: `ink-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      tool,
      point,
      color,
      width,
      opacity,
    });
    activeStrokeRef.current = stroke;
    setActiveStroke(stroke);
  }, [activeTool, color, opacity, width]);
  const addPoint = useCallback((point: Point, minDistance: number) => {
    const current = activeStrokeRef.current;
    if (!current) return;
    const next = appendInkPoint(current, point, minDistance);
    activeStrokeRef.current = next;
    setActiveStroke(next);
  }, []);
  /**
   * The in-progress stroke lives in React state for rendering and in a ref for
   * the gesture, because a running gesture keeps the callbacks from the render it
   * started in. The ref also keeps the commit out of a state updater, which React
   * may call twice.
   */
  const finishStroke = useCallback(() => {
    const stroke = activeStrokeRef.current;
    activeStrokeRef.current = null;
    setActiveStroke(null);
    if (stroke) onCommand({ type: 'ink.add', stroke });
  }, [onCommand]);
  const eraseAt = useCallback((point: Point, currentScale: number) => {
    onCommand(
      { type: 'ink.erase', point, radius: eraserRadiusForScale(eraserRadius, currentScale) },
      true,
    );
  }, [eraserRadius, onCommand]);

  const touchCanvas = useCallback(() => { onCanvasTouch?.(); }, [onCanvasTouch]);
  const selectObject = useCallback((id: string | null) => { onObjectSelect?.(id); }, [onObjectSelect]);
  const editObject = useCallback((id: string) => { onObjectEdit?.(id); }, [onObjectEdit]);
  const createObject = useCallback((type: 'text' | 'sticky', point: Point) => {
    onObjectCreate?.(type, point);
  }, [onObjectCreate]);
  const moveObject = useCallback((id: string, x: number, y: number) => {
    onCommand({ type: 'object.move', id, x, y }, true);
  }, [onCommand]);
  const commitPending = useCallback(() => { onCommitPending(); }, [onCommitPending]);

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
      // The whole sweep is one undo step.
      runOnJS(commitPending)();
    });

  /**
   * Select mode does three things with one gesture: a touch on empty canvas pans,
   * a drag on an object moves it, and a tap on an already selected object opens
   * the text editor. Keeping one gesture avoids tap/drag races.
   */
  const selectGesture = Gesture.Pan()
    .enabled(activeTool === 'select')
    .maxPointers(1)
    .minDistance(0)
    .onStart((event) => {
      const point = screenToCanvas(
        { x: event.x, y: event.y },
        { x: offsetX.value, y: offsetY.value, scale: scale.value },
      );
      const hit = objectAtPoint(objects, point);
      draggingObjectId.value = hit ? hit.id : '';
      dragMoved.value = false;
      grabOffsetX.value = hit ? point.x - hit.x : 0;
      grabOffsetY.value = hit ? point.y - hit.y : 0;
      tapOpensEditor.value = hit && hit.id === selectedObjectId ? hit.id : '';
      startX.value = offsetX.value;
      startY.value = offsetY.value;
      if (hit) runOnJS(selectObject)(hit.id);
      else runOnJS(selectObject)(null);
    })
    .onUpdate((event) => {
      if (draggingObjectId.value !== '') {
        if (!dragMoved.value) {
          dragMoved.value = Math.hypot(event.translationX, event.translationY) > DRAG_THRESHOLD_SCREEN;
        }
        if (dragMoved.value) {
          const point = screenToCanvas(
            { x: event.x, y: event.y },
            { x: offsetX.value, y: offsetY.value, scale: scale.value },
          );
          runOnJS(moveObject)(draggingObjectId.value, point.x - grabOffsetX.value, point.y - grabOffsetY.value);
        }
        return;
      }
      offsetX.value = startX.value + event.translationX;
      offsetY.value = startY.value + event.translationY;
      runOnJS(report)(offsetX.value, offsetY.value, scale.value);
    })
    .onFinalize(() => {
      if (draggingObjectId.value !== '') {
        const id = draggingObjectId.value;
        const moved = dragMoved.value;
        const opensEditor = tapOpensEditor.value;
        draggingObjectId.value = '';
        tapOpensEditor.value = '';
        dragMoved.value = false;
        if (moved) runOnJS(commitPending)();
        else if (opensEditor !== '') runOnJS(editObject)(id);
        return;
      }
      runOnJS(commitViewport)(offsetX.value, offsetY.value, scale.value);
    });

  const objectTap = Gesture.Tap()
    .enabled((activeTool === 'text' || activeTool === 'sticky') && !!onObjectCreate)
    .onEnd((event) => {
      const point = screenToCanvas(
        { x: event.x, y: event.y },
        { x: offsetX.value, y: offsetY.value, scale: scale.value },
      );
      runOnJS(createObject)(activeTool as 'text' | 'sticky', point);
    });

  /** While editing text, a canvas tap commits the edit instead of drawing. */
  const dismissTap = Gesture.Tap().onEnd(() => { runOnJS(touchCanvas)(); });

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
    .onFinalize(() => { runOnJS(commitViewport)(offsetX.value, offsetY.value, scale.value); });

  const primaryGesture = editing
    ? dismissTap
    : activeTool === 'eraser'
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
    () => (activeStroke ? [...document.strokes, activeStroke] : document.strokes),
    [document.strokes, activeStroke],
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

      {document.objects.map((object) => (
        <CanvasObjectView
          key={object.id}
          object={object}
          dark={dark}
          selectionColor={theme.primary}
          selected={selectedObjectId === object.id}
          hidden={editingObjectId === object.id}
          offsetX={offsetX}
          offsetY={offsetY}
          scale={scale}
        />
      ))}

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
  dark: boolean;
  /** Theme-aware selection outline colour. */
  selectionColor: string;
  selected: boolean;
  hidden: boolean;
  offsetX: { value: number };
  offsetY: { value: number };
  scale: { value: number };
};

/**
 * Objects are native views on top of the Skia canvas, which keeps their text
 * selectable by the platform text stack and makes them cheap to move: the frame
 * follows the viewport shared values without a React re-render per frame.
 */
function CanvasObjectView({ object, dark, selectionColor, selected, hidden, offsetX, offsetY, scale }: CanvasObjectViewProps) {
  const lineHeight = textLineHeight(object.fontSize);
  const fill = objectFill(object);
  const textColor = objectTextColor(object, dark);
  const frame = useAnimatedStyle(() => ({
    left: object.x * scale.value + offsetX.value,
    top: object.y * scale.value + offsetY.value,
    width: object.width * scale.value,
    height: object.height * scale.value,
    borderRadius: radii.sm * scale.value,
    borderWidth: 1.5,
    borderColor: selected ? selectionColor : 'transparent',
  }), [object, selected, selectionColor]);
  const text = useAnimatedStyle(() => ({
    fontSize: object.fontSize * scale.value,
    lineHeight: lineHeight * scale.value,
    padding: OBJECT_PADDING * scale.value,
  }), [object, lineHeight]);

  if (hidden) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.object, { backgroundColor: fill ?? 'transparent' }, frame]}
    >
      <Animated.Text style={[{ color: textColor }, text]}>{object.text}</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  object: { position: 'absolute', overflow: 'hidden' },
  hud: { position: 'absolute', top: spacing.sm, right: spacing.sm, alignItems: 'flex-end', gap: spacing.xs },
  viewBadge: { borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, alignItems: 'flex-end' },
  zoomText: { ...typography.bodyStrong },
  resetButton: { minHeight: touchTarget, minWidth: touchTarget, borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center' },
  resetText: { ...typography.caption },
  pressed: { opacity: 0.6 },
});
