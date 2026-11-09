import { Canvas, Circle, Group, Oval, Path, Rect, Skia } from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type TextLayoutEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';

import {
  DEFAULT_CONNECTOR_STROKE_WIDTH,
  DEFAULT_SHAPE_STROKE_WIDTH,
  MIN_SHAPE_SIZE_SCREEN,
  OBJECT_PADDING,
  createConnectorObject,
  createShapeObject,
  geometryFromPoints,
  isGeometricObject,
  isTextualObject,
  objectAtPoint,
  objectFill,
  objectTextColor,
  stickyColorValue,
  textColorValue,
  textLineHeight,
  type CanvasDocument,
  type CanvasObject,
  type ConnectorObject,
  type ConnectorStyle,
  type DocumentCommand,
  type ShapeKind,
  type ShapeObject,
  type TextualObject,
} from '../canvas/document';
import {
  MIN_RESIZE_SCREEN,
  RESIZE_HANDLES,
  ROTATE_HANDLE_OFFSET_SCREEN,
  SELECTION_HANDLE_HIT_SCREEN,
  SELECTION_HANDLE_SCREEN,
  handleAtPoint,
  objectsInRect,
  pointerAngle,
  resizeObject,
  rotationFromPointer,
  selectionCorners,
  selectionHandlePositions,
  type CanvasRect,
  type ResizeHandle,
  type SelectionHandle,
} from '../canvas/selection';
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
  arrowHeadPathData,
  arrowHeadSize,
  connectorPolyline,
  linePoints,
  polylinePathData,
} from '../canvas/shapes';
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

export type InkTool =
  | 'select'
  | 'pen'
  | 'highlighter'
  | 'eraser'
  | 'text'
  | 'sticky'
  | 'shape'
  | 'connector';
export type ViewportState = Viewport;

/** Minimum finger travel before a touch on an object counts as a drag, not a tap. */
const DRAG_THRESHOLD_SCREEN = 4;
/** Hold this long on empty canvas to start a marquee selection. */
const MARQUEE_HOLD_MS = 280;

export type ViewportRequest = { key: number; viewport: Viewport };

type TransformGesture = {
  mode: 'move' | 'resize' | 'rotate';
  objects: CanvasObject[];
  start: Point;
  handle: SelectionHandle | null;
  rotationOffset: number;
};

type CanvasViewportProps = {
  dark?: boolean;
  initialViewport?: Viewport;
  activeTool?: InkTool;
  color?: string;
  width?: number;
  opacity?: number;
  eraserRadius?: number;
  /** Shape tool defaults, applied to the next shape that is drawn. */
  shapeKind?: ShapeKind;
  shapeColorKey?: string;
  shapeFillKey?: string | null;
  shapeStrokeWidth?: number;
  /** Connector tool defaults, applied to the next connector that is drawn. */
  connectorStyle?: ConnectorStyle;
  connectorColorKey?: string;
  connectorStrokeWidth?: number;
  document: CanvasDocument;
  selectedObjectIds?: readonly string[];
  /** Object currently open in the in-place text editor; it is hidden here. */
  editingObjectId?: string | null;
  /** Absolute viewport the editor asks for, for example to clear the keyboard. */
  viewportRequest?: ViewportRequest | null;
  onViewportChange?: (viewport: ViewportState) => void;
  onCommand: (command: DocumentCommand, transient?: boolean) => void;
  onCommitPending: () => void;
  onObjectCreate?: (type: 'text' | 'sticky', point: Point) => void;
  onSelectionChange?: (ids: string[]) => void;
  onObjectEdit?: (id: string) => void;
  /** Real rendered text height, used to correct the object's estimated height. */
  onObjectMeasure?: (id: string, height: number) => void;
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
  shapeKind = 'rectangle',
  shapeColorKey = 'ink',
  shapeFillKey = null,
  shapeStrokeWidth = DEFAULT_SHAPE_STROKE_WIDTH,
  connectorStyle = 'arrow',
  connectorColorKey = 'ink',
  connectorStrokeWidth = DEFAULT_CONNECTOR_STROKE_WIDTH,
  document,
  selectedObjectIds = [],
  editingObjectId = null,
  viewportRequest = null,
  onViewportChange,
  onCommand,
  onCommitPending,
  onObjectCreate,
  onSelectionChange,
  onObjectEdit,
  onObjectMeasure,
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
  const collapseSelectionId = useSharedValue('');
  const gestureMode = useSharedValue<'pan' | 'move' | 'resize' | 'rotate' | 'marquee' | ''>('');
  const touchStartCanvasX = useSharedValue(0);
  const touchStartCanvasY = useSharedValue(0);
  const marqueeStartX = useSharedValue(0);
  const marqueeStartY = useSharedValue(0);
  const marqueeEndX = useSharedValue(0);
  const marqueeEndY = useSharedValue(0);
  const eraserX = useSharedValue(-10000);
  const eraserY = useSharedValue(-10000);
  /** The stroke being drawn is local: it only enters the document on release. */
  const [activeStroke, setActiveStroke] = useState<InkStroke | null>(null);
  const activeStrokeRef = useRef<InkStroke | null>(null);
  /** A shape or connector being dragged is previewed locally until release. */
  const [draftObject, setDraftObject] = useState<ShapeObject | ConnectorObject | null>(null);
  const draftObjectRef = useRef<ShapeObject | ConnectorObject | null>(null);
  const draftStartRef = useRef<Point | null>(null);
  const transformRef = useRef<TransformGesture | null>(null);
  const [viewport, setViewport] = useState<Viewport>(startViewport);
  const lastViewportReport = useRef(0);

  const editing = editingObjectId !== null;
  const objects = document.objects;
  const selectedObjects = objects.filter((object) => selectedObjectIds.includes(object.id));

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

  /**
   * Shape and connector drags use the same lifecycle as ink: the object is
   * local state until the finger lifts, then it becomes one insert command.
   */
  const beginShape = useCallback((point: Point, tool: 'shape' | 'connector') => {
    const id = `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const object = tool === 'shape'
      ? createShapeObject({
          id,
          shape: shapeKind,
          start: point,
          end: point,
          colorKey: shapeColorKey,
          fillKey: shapeFillKey,
          strokeWidth: shapeStrokeWidth,
        })
      : createConnectorObject({
          id,
          style: connectorStyle,
          start: point,
          end: point,
          colorKey: connectorColorKey,
          strokeWidth: connectorStrokeWidth,
        });
    draftStartRef.current = point;
    draftObjectRef.current = object;
    setDraftObject(object);
  }, [
    connectorColorKey,
    connectorStrokeWidth,
    connectorStyle,
    shapeColorKey,
    shapeFillKey,
    shapeKind,
    shapeStrokeWidth,
  ]);

  const updateShape = useCallback((point: Point) => {
    const current = draftObjectRef.current;
    const start = draftStartRef.current;
    if (!current || !start) return;
    const next = { ...current, ...geometryFromPoints(start, point) } as ShapeObject | ConnectorObject;
    draftObjectRef.current = next;
    setDraftObject(next);
  }, []);

  const finishShape = useCallback((currentScale: number) => {
    const draft = draftObjectRef.current;
    draftObjectRef.current = null;
    draftStartRef.current = null;
    setDraftObject(null);
    if (!draft) return;
    // A tap, or a drag too small to see, should not leave a speck on the board.
    if (Math.hypot(draft.width, draft.height) * currentScale < MIN_SHAPE_SIZE_SCREEN) return;
    const id = `${draft.type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    onCommand({ type: 'object.insert', object: { ...draft, id } });
  }, [onCommand]);

  const touchCanvas = useCallback(() => { onCanvasTouch?.(); }, [onCanvasTouch]);
  const selectObjects = useCallback((ids: string[]) => { onSelectionChange?.(ids); }, [onSelectionChange]);
  const editObject = useCallback((id: string) => { onObjectEdit?.(id); }, [onObjectEdit]);
  const createObject = useCallback((type: 'text' | 'sticky', point: Point) => {
    onObjectCreate?.(type, point);
  }, [onObjectCreate]);
  const commitPending = useCallback(() => { onCommitPending(); }, [onCommitPending]);

  /** Snapshot the selection once so every pointer sample transforms from the same start state. */
  const beginTransform = useCallback((
    mode: 'move' | 'resize' | 'rotate',
    handle: SelectionHandle | null,
    point: Point,
    ids: readonly string[],
  ) => {
    const snapshot = ids
      .map((id) => document.objects.find((object) => object.id === id))
      .filter((object): object is CanvasObject => Boolean(object));
    if (snapshot.length === 0) {
      transformRef.current = null;
      return;
    }
    const first = snapshot[0];
    const centre = { x: first.x + first.width / 2, y: first.y + first.height / 2 };
    transformRef.current = {
      mode,
      objects: snapshot,
      start: point,
      handle,
      rotationOffset: mode === 'rotate' ? first.rotation - pointerAngle(point, centre) : 0,
    };
  }, [document.objects]);

  const updateTransform = useCallback((point: Point, currentScale: number) => {
    const gesture = transformRef.current;
    if (!gesture) return;
    if (gesture.mode === 'move') {
      const dx = point.x - gesture.start.x;
      const dy = point.y - gesture.start.y;
      onCommand({
        type: 'objects.geometry',
        label: 'Move',
        updates: gesture.objects.map((object) => ({ id: object.id, x: object.x + dx, y: object.y + dy })),
      }, true);
      return;
    }
    const object = gesture.objects[0];
    if (!object) return;
    if (gesture.mode === 'resize' && gesture.handle && gesture.handle !== 'rotate') {
      const geometry = resizeObject(
        object,
        gesture.handle as ResizeHandle,
        point,
        MIN_RESIZE_SCREEN / Math.max(currentScale, MIN_ZOOM),
      );
      onCommand({
        type: 'objects.geometry',
        label: 'Resize',
        updates: [{ id: object.id, ...geometry }],
      }, true);
      return;
    }
    if (gesture.mode === 'rotate') {
      const centre = { x: object.x + object.width / 2, y: object.y + object.height / 2 };
      onCommand({
        type: 'objects.geometry',
        label: 'Rotate',
        updates: [{
          id: object.id,
          rotation: rotationFromPointer(centre, point, gesture.rotationOffset),
        }],
      }, true);
    }
  }, [onCommand]);

  const selectInMarquee = useCallback((rect: CanvasRect) => {
    onSelectionChange?.(objectsInRect(document.objects, rect).map((object) => object.id));
  }, [document.objects, onSelectionChange]);

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

  const shapeGesture = Gesture.Pan()
    .enabled(activeTool === 'shape' || activeTool === 'connector')
    .maxPointers(1)
    .minDistance(0)
    .onStart((event) => {
      const point = screenToCanvas(
        { x: event.x, y: event.y },
        { x: offsetX.value, y: offsetY.value, scale: scale.value },
      );
      runOnJS(beginShape)(point, activeTool as 'shape' | 'connector');
    })
    .onUpdate((event) => {
      const point = screenToCanvas(
        { x: event.x, y: event.y },
        { x: offsetX.value, y: offsetY.value, scale: scale.value },
      );
      runOnJS(updateShape)(point);
    })
    .onFinalize(() => { runOnJS(finishShape)(scale.value); });

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
   * Select mode owns touch, move, resize, rotate, and pan with one gesture so a
   * tap cannot race a drag. Pressing empty canvas and holding starts a marquee;
   * the long-press gesture below switches this pan into marquee mode.
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
      startX.value = offsetX.value;
      startY.value = offsetY.value;
      touchStartCanvasX.value = point.x;
      touchStartCanvasY.value = point.y;
      marqueeStartX.value = point.x;
      marqueeStartY.value = point.y;
      marqueeEndX.value = point.x;
      marqueeEndY.value = point.y;
      dragMoved.value = false;
      tapOpensEditor.value = '';
      collapseSelectionId.value = '';
      draggingObjectId.value = '';

      const selected = objects.filter((object) => selectedObjectIds.includes(object.id));
      const rotateOffset = ROTATE_HANDLE_OFFSET_SCREEN / scale.value;
      const handle = selected.length === 1
        ? handleAtPoint(selected, point, SELECTION_HANDLE_HIT_SCREEN / scale.value, rotateOffset)
        : null;
      if (handle) {
        const mode = handle === 'rotate' ? 'rotate' : 'resize';
        gestureMode.value = mode;
        runOnJS(beginTransform)(mode, handle, point, selectedObjectIds);
        return;
      }

      const hit = objectAtPoint(objects, point);
      if (hit) {
        const alreadySelected = selectedObjectIds.includes(hit.id);
        draggingObjectId.value = hit.id;
        gestureMode.value = 'move';
        if (!alreadySelected) runOnJS(selectObjects)([hit.id]);
        runOnJS(beginTransform)('move', null, point, alreadySelected ? selectedObjectIds : [hit.id]);
        // A tap on one member of a multi-selection collapses to that object;
        // a tap on the only selected text object opens its editor.
        if (alreadySelected && selectedObjectIds.length > 1) collapseSelectionId.value = hit.id;
        else if (alreadySelected && selectedObjectIds.length === 1 && isTextualObject(hit)) {
          tapOpensEditor.value = hit.id;
        }
        return;
      }

      gestureMode.value = 'pan';
      if (selectedObjectIds.length > 0) runOnJS(selectObjects)([]);
    })
    .onUpdate((event) => {
      if (gestureMode.value === 'marquee') {
        marqueeEndX.value = touchStartCanvasX.value + event.translationX / scale.value;
        marqueeEndY.value = touchStartCanvasY.value + event.translationY / scale.value;
        return;
      }
      if (gestureMode.value === 'move') {
        if (!dragMoved.value) {
          dragMoved.value = Math.hypot(event.translationX, event.translationY) > DRAG_THRESHOLD_SCREEN;
        }
        if (dragMoved.value) {
          const point = screenToCanvas(
            { x: event.x, y: event.y },
            { x: offsetX.value, y: offsetY.value, scale: scale.value },
          );
          runOnJS(updateTransform)(point, scale.value);
        }
        return;
      }
      if (gestureMode.value === 'resize' || gestureMode.value === 'rotate') {
        const point = screenToCanvas(
          { x: event.x, y: event.y },
          { x: offsetX.value, y: offsetY.value, scale: scale.value },
        );
        runOnJS(updateTransform)(point, scale.value);
        return;
      }
      if (gestureMode.value === 'pan') {
        offsetX.value = startX.value + event.translationX;
        offsetY.value = startY.value + event.translationY;
        runOnJS(report)(offsetX.value, offsetY.value, scale.value);
      }
    })
    .onFinalize(() => {
      const mode = gestureMode.value;
      const hitId = draggingObjectId.value;
      const moved = dragMoved.value;
      const opensEditor = tapOpensEditor.value;
      const collapseId = collapseSelectionId.value;
      gestureMode.value = '';
      draggingObjectId.value = '';
      tapOpensEditor.value = '';
      collapseSelectionId.value = '';
      dragMoved.value = false;

      if (mode === 'marquee') {
        const rect: CanvasRect = {
          x: Math.min(marqueeStartX.value, marqueeEndX.value),
          y: Math.min(marqueeStartY.value, marqueeEndY.value),
          width: Math.abs(marqueeEndX.value - marqueeStartX.value),
          height: Math.abs(marqueeEndY.value - marqueeStartY.value),
        };
        if (rect.width >= 2 || rect.height >= 2) runOnJS(selectInMarquee)(rect);
        return;
      }
      if (mode === 'move' || mode === 'resize' || mode === 'rotate') {
        if (mode === 'move' && !moved) {
          if (collapseId !== '') runOnJS(selectObjects)([collapseId]);
          else if (opensEditor !== '' && hitId !== '') runOnJS(editObject)(hitId);
        }
        runOnJS(commitPending)();
        return;
      }
      if (mode === 'pan') {
        runOnJS(commitViewport)(offsetX.value, offsetY.value, scale.value);
      }
    });

  /** Long-press on empty canvas turns the active pan into a marquee drag. */
  const marqueeGesture = Gesture.LongPress()
    .enabled(activeTool === 'select')
    .numberOfPointers(1)
    .minDuration(MARQUEE_HOLD_MS)
    .maxDistance(8)
    .onStart(() => {
      if (gestureMode.value !== 'pan') return;
      gestureMode.value = 'marquee';
      marqueeStartX.value = touchStartCanvasX.value;
      marqueeStartY.value = touchStartCanvasY.value;
      marqueeEndX.value = touchStartCanvasX.value;
      marqueeEndY.value = touchStartCanvasY.value;
      offsetX.value = startX.value;
      offsetY.value = startY.value;
      // Undo any sub-threshold pan that landed before the hold completed.
      runOnJS(commitViewport)(startX.value, startY.value, scale.value);
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
          : activeTool === 'shape' || activeTool === 'connector'
            ? shapeGesture
            : selectGesture;
  const gesture = Gesture.Simultaneous(primaryGesture, marqueeGesture, pinchGesture);

  const transform = useDerivedValue(() => [
    { translateX: offsetX.value },
    { translateY: offsetY.value },
    { scale: scale.value },
  ]);
  const eraserRadiusCanvas = useDerivedValue(() => eraserRadiusForScale(eraserRadius, scale.value));
  const marqueeX = useDerivedValue(() => Math.min(marqueeStartX.value, marqueeEndX.value));
  const marqueeY = useDerivedValue(() => Math.min(marqueeStartY.value, marqueeEndY.value));
  const marqueeWidth = useDerivedValue(() => Math.abs(marqueeEndX.value - marqueeStartX.value));
  const marqueeHeight = useDerivedValue(() => Math.abs(marqueeEndY.value - marqueeStartY.value));
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
            {draftObject && <GeometricObjectView object={draftObject} dark={dark} />}
            {document.objects.filter(isGeometricObject).map((object) => (
              <GeometricObjectView key={object.id} object={object} dark={dark} />
            ))}
          </Group>
        </Canvas>
      </GestureDetector>

      {document.objects.filter(isTextualObject).map((object) => (
        <CanvasObjectView
          key={object.id}
          object={object}
          dark={dark}
          hidden={editingObjectId === object.id}
          offsetX={offsetX}
          offsetY={offsetY}
          scale={scale}
          onMeasure={onObjectMeasure}
        />
      ))}

      {/*
        Text and sticky notes are native views above the drawing canvas, so the
        selection frame and marquee get their own transparent Skia layer above
        them. It never receives touches: the gesture detector below owns them.
      */}
      {activeTool === 'select' && !editing && (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          <Group transform={transform}>
            {selectedObjects.length > 0 && (
              <SelectionOverlay
                objects={selectedObjects}
                dark={dark}
                scale={viewport.scale}
              />
            )}
            <Rect
              x={marqueeX}
              y={marqueeY}
              width={marqueeWidth}
              height={marqueeHeight}
              color={theme.primary}
              opacity={0.12}
              style="fill"
            />
            <Rect
              x={marqueeX}
              y={marqueeY}
              width={marqueeWidth}
              height={marqueeHeight}
              color={theme.primary}
              style="stroke"
              strokeWidth={1.5 / Math.max(viewport.scale, 0.5)}
            />
          </Group>
        </Canvas>
      )}

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
  object: TextualObject;
  dark: boolean;
  hidden: boolean;
  offsetX: { value: number };
  offsetY: { value: number };
  scale: { value: number };
  onMeasure?: (id: string, height: number) => void;
};

/**
 * Objects are native views on top of the Skia canvas, which keeps their text
 * selectable by the platform text stack and makes them cheap to move: the frame
 * follows the viewport shared values without a React re-render per frame.
 */
function CanvasObjectView({ object, dark, hidden, offsetX, offsetY, scale, onMeasure }: CanvasObjectViewProps) {
  const lineHeight = textLineHeight(object.fontSize);
  const fill = objectFill(object);
  const textColor = objectTextColor(object, dark);
  const measuredHeight = useRef(object.height);
  const handleTextLayout = useCallback((event: TextLayoutEvent) => {
    // Only text objects grow with their content; a sticky note keeps its paper.
    if (object.type !== 'text' || !onMeasure) return;
    const lines = event.nativeEvent.lines.length;
    if (lines === 0) return;
    const height = lines * lineHeight + OBJECT_PADDING * 2;
    if (Math.abs(measuredHeight.current - height) < 1) return;
    measuredHeight.current = height;
    onMeasure(object.id, height);
  }, [lineHeight, object.id, object.type, onMeasure]);
  const frame = useAnimatedStyle(() => ({
    left: object.x * scale.value + offsetX.value,
    top: object.y * scale.value + offsetY.value,
    width: object.width * scale.value,
    height: object.height * scale.value,
    borderRadius: radii.sm * scale.value,
    transform: [{ rotate: `${object.rotation}deg` }],
  }), [object]);
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
}

function GeometricObjectView({
  object,
  dark,
}: {
  object: ShapeObject | ConnectorObject;
  dark: boolean;
}) {
  const color = textColorValue(object.colorKey, dark);
  const connectorPoints = object.type === 'connector'
    ? connectorPolyline(object.style, object.x, object.y, object.width, object.height, object.direction)
    : null;
  const linePointPair = object.type === 'shape' && object.shape === 'line'
    ? linePoints(object.x, object.y, object.width, object.height, object.direction)
    : null;
  const origin = {
    x: object.x + object.width / 2,
    y: object.y + object.height / 2,
  };
  const transform = object.rotation === 0
    ? undefined
    : [{ rotate: (object.rotation * Math.PI) / 180 }];

  let content: ReactNode;
  if (object.type === 'connector' || object.shape === 'line') {
    const linePointsList = object.type === 'connector' ? connectorPoints! : [linePointPair!.start, linePointPair!.end];
    const path = Skia.Path.MakeFromSVGString(polylinePathData(linePointsList)) ?? Skia.Path.Make();
    const arrowPath = object.type === 'connector' && object.style === 'arrow'
      ? Skia.Path.MakeFromSVGString(arrowHeadPathData(linePointsList, arrowHeadSize(object.strokeWidth)))
      : null;
    content = (
      <>
        <Path path={path} color={color} style="stroke" strokeWidth={object.strokeWidth} strokeCap="round" strokeJoin="round" />
        {arrowPath && <Path path={arrowPath} color={color} style="fill" />}
      </>
    );
  } else if (object.shape === 'ellipse') {
    content = (
      <>
        {object.fillKey && <Oval x={object.x} y={object.y} width={object.width} height={object.height} color={stickyColorValue(object.fillKey)} style="fill" />}
        <Oval
          x={object.x}
          y={object.y}
          width={object.width}
          height={object.height}
          color={color}
          style="stroke"
          strokeWidth={object.strokeWidth}
        />
      </>
    );
  } else {
    content = (
      <>
        {object.fillKey && <Rect x={object.x} y={object.y} width={object.width} height={object.height} color={stickyColorValue(object.fillKey)} style="fill" />}
        <Rect
          x={object.x}
          y={object.y}
          width={object.width}
          height={object.height}
          color={color}
          style="stroke"
          strokeWidth={object.strokeWidth}
        />
      </>
    );
  }

  return <Group origin={origin} transform={transform}>{content}</Group>;
}

/**
 * The selection frame and handles live in the canvas group, so they track the
 * object at every pan and zoom without a native overlay. A single object shows
 * four resize corners and a rotate stem; a multi-selection shows the union box.
 */
function SelectionOverlay({
  objects,
  dark,
  scale,
}: {
  objects: CanvasObject[];
  dark: boolean;
  scale: number;
}) {
  const theme = dark ? darkColors : colors;
  const corners = selectionCorners(objects);
  if (corners.length < 2) return null;
  const safeScale = Math.max(scale, 0.5);
  const strokeWidth = 1.5 / safeScale;
  const handleSize = SELECTION_HANDLE_SCREEN / safeScale;
  const handles = objects.length === 1
    ? selectionHandlePositions(objects, ROTATE_HANDLE_OFFSET_SCREEN / safeScale)
    : null;
  const boxPath = Skia.Path.MakeFromSVGString(`${polylinePathData(corners)} Z`) ?? Skia.Path.Make();
  const topMiddle = {
    x: (corners[0].x + corners[1].x) / 2,
    y: (corners[0].y + corners[1].y) / 2,
  };
  const stemPath = handles
    ? Skia.Path.MakeFromSVGString(`M ${topMiddle.x} ${topMiddle.y} L ${handles.rotate.x} ${handles.rotate.y}`) ?? Skia.Path.Make()
    : null;

  return (
    <>
      <Path path={boxPath} color={theme.primary} style="stroke" strokeWidth={strokeWidth} />
      {handles && stemPath && (
        <Path path={stemPath} color={theme.primary} style="stroke" strokeWidth={strokeWidth} />
      )}
      {handles && (
        <>
          <Circle
            cx={handles.rotate.x}
            cy={handles.rotate.y}
            r={handleSize / 2}
            color={theme.surface}
            style="fill"
          />
          <Circle
            cx={handles.rotate.x}
            cy={handles.rotate.y}
            r={handleSize / 2}
            color={theme.primary}
            style="stroke"
            strokeWidth={strokeWidth}
          />
        </>
      )}
      {handles && RESIZE_HANDLES.map((handle) => (
        <Group key={handle}>
          <Rect
            x={handles[handle].x - handleSize / 2}
            y={handles[handle].y - handleSize / 2}
            width={handleSize}
            height={handleSize}
            color={theme.surface}
            style="fill"
          />
          <Rect
            x={handles[handle].x - handleSize / 2}
            y={handles[handle].y - handleSize / 2}
            width={handleSize}
            height={handleSize}
            color={theme.primary}
            style="stroke"
            strokeWidth={strokeWidth}
          />
        </Group>
      ))}
    </>
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
