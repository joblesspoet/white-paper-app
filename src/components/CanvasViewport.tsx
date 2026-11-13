import {
  Canvas,
  Circle,
  DashPathEffect,
  FontSlant,
  FontWeight,
  Group,
  Image as SkiaImage,
  Line as SkiaLine,
  Paragraph,
  Path,
  Rect,
  RoundedRect,
  Skia,
  TextAlign,
  useImage,
  vec,
} from '@shopify/react-native-skia';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type TextLayoutEvent } from 'react-native';
import { Gesture, GestureDetector, PointerType } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { styles } from './CanvasViewport.styles';

import {
  DEFAULT_CONNECTOR_STROKE_WIDTH,
  DEFAULT_SHAPE_STROKE_WIDTH,
  MIN_SHAPE_SIZE_SCREEN,
  OBJECT_PADDING,
  buildShapeRenderPrimitives,
  createConnectorObject,
  createShapeObject,
  geometryFromPoints,
  isGeometricObject,
  isImageObject,
  isMathObject,
  isTableObject,
  isTextualObject,
  objectAtPoint,
  objectFill,
  objectTextColor,
  stickyColorValue,
  tableCellRect,
  tableColumnWidths,
  tableRowHeight,
  textColorValue,
  textLineHeight,
  type CanvasDocument,
  type CanvasObject,
  type ConnectorObject,
  type ConnectorStyle,
  type DocumentCommand,
  type ImageObject,
  type MathObject,
  type ShapeKind,
  type ShapeObject,
  type TableObject,
  type TextualObject,
} from '../canvas/document';
import {
  GEOMETRY_SNAP_SCREEN_DISTANCE,
  projectPointToLockedRulerEdge,
  projectPointToRulerEdge,
  projectPointToSetSquareEdge,
  type GeometryInstrumentState,
} from '../canvas/geometry-box';
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
  buildVariableWidthStrokePath,
  createInkStroke,
  DEFAULT_ERASER_RADIUS,
  eraserRadiusForScale,
  hasVariablePressure,
  inkPathData,
  MIN_POINT_DISTANCE_SCREEN,
  shouldAcceptInkPointer,
  type FreehandTool,
  type InkPoint,
  type InkStroke,
  type InputPointerKind,
} from '../canvas/ink';
import { layoutMathExpression, type MathSourceSpan } from '../canvas/math-layout';
import {
  classifyInkStroke,
  recognizedShapeToObject,
  strokesInRect,
} from '../canvas/recognition';
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
import { resolveMediaUri } from '../media/asset-store';
import { buildBackgroundLayers, resolveCanvasBackgroundHex } from '../canvas/background';
import {
  LASER_CORE_OPACITY,
  LASER_CORE_WIDTH,
  LASER_HALO_OPACITY,
  LASER_HALO_WIDTH,
  appendLaserPoint,
  createLaserStroke,
  laserStrokeOpacity,
  pruneExpiredLaserStrokes,
  releaseLaserStroke,
  resolveLaserPalette,
  type EphemeralLaserStroke,
  type LaserColorKey,
} from '../canvas/laser';
import type { BoardBackground, BoardStyle } from '../persistence/schema';

export { canvasToScreen, screenToCanvas } from '../canvas/viewport';
export type { InkStroke } from '../canvas/ink';

export type InkTool =
  | 'select'
  | 'pen'
  | 'highlighter'
  | 'eraser'
  | 'laser'
  | 'text'
  | 'sticky'
  | 'shape'
  | 'connector'
  | 'image';
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
  boardBackground?: BoardBackground;
  boardStyle?: BoardStyle;
  initialViewport?: Viewport;
  activeTool?: InkTool;
  color?: string;
  width?: number;
  opacity?: number;
  eraserRadius?: number;
  laserColorKey?: LaserColorKey;
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
  /** Table cell currently open in the in-place cell editor; hidden in the table overlay. */
  editingTableCell?: { objectId: string; row: number; col: number } | null;
  /** True while a math formula is being edited inline on the canvas. */
  editingMath?: boolean;
  /** Currently highlighted LaTeX source span while editing a math formula inline. */
  editingMathSpan?: { objectId: string; span: MathSourceSpan } | null;
  /** Absolute viewport the editor asks for, for example to clear the keyboard. */
  viewportRequest?: ViewportRequest | null;
  /** Active Geometry Box instrument for magnetic pen edge snapping. */
  activeInstrument?: GeometryInstrumentState | null;
  stylusOnlyDrawing?: boolean;
  pressureSensitivity?: boolean;
  holdToSnapShapes?: boolean;
  selectedInkIds?: readonly string[];
  onViewportChange?: (viewport: ViewportState) => void;
  onCommand: (command: DocumentCommand, transient?: boolean) => void;
  onCommitPending: () => void;
  onObjectCreate?: (type: 'text' | 'sticky', point: Point) => void;
  onSelectionChange?: (ids: string[]) => void;
  onInkSelectionChange?: (ids: string[]) => void;
  onSnapStrokeToShape?: (stroke: InkStroke, shape: ShapeObject | ConnectorObject) => void;
  onObjectEdit?: (id: string, point?: Point) => void;
  /** Real rendered text height, used to correct the object's estimated height. */
  onObjectMeasure?: (id: string, height: number) => void;
  /** A touch on the canvas while an object is being edited: commit or switch slot. */
  onCanvasTouch?: (point?: Point) => void;
};

export function CanvasViewport({
  dark = false,
  boardBackground,
  boardStyle = 'blank',
  initialViewport,
  activeTool = 'select',
  color = colors.foreground,
  width = 4,
  opacity = 1,
  eraserRadius = DEFAULT_ERASER_RADIUS,
  laserColorKey = 'red',
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
  editingTableCell = null,
  editingMath = false,
  editingMathSpan = null,
  viewportRequest = null,
  activeInstrument = null,
  stylusOnlyDrawing = false,
  pressureSensitivity = true,
  holdToSnapShapes = true,
  selectedInkIds = [],
  onViewportChange,
  onCommand,
  onCommitPending,
  onObjectCreate,
  onSelectionChange,
  onInkSelectionChange,
  onSnapStrokeToShape,
  onObjectEdit,
  onObjectMeasure,
  onCanvasTouch,
}: CanvasViewportProps) {
  const theme = dark ? darkColors : colors;
  const [viewportSize, setViewportSize] = useState({ width: 800, height: 1000 });
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

  const editing = editingObjectId !== null || editingMath;
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

  const lockedGeometryEdgeRef = useRef<
    | { kind: 'ruler'; edge: 'top' | 'bottom'; startAlong: number }
    | { kind: 'set-square'; edgeIndex: 0 | 1 | 2; startAlong: number }
    | null
  >(null);
  const [snapReadout, setSnapReadout] = useState<string | null>(null);
  const holdSnapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSnapScreenPointRef = useRef<Point | null>(null);

  const clearHoldSnapTimer = useCallback(() => {
    if (holdSnapTimerRef.current) {
      clearTimeout(holdSnapTimerRef.current);
      holdSnapTimerRef.current = null;
    }
  }, []);

  const scheduleHoldSnap = useCallback(
    (screenPoint: Point) => {
      if (!holdToSnapShapes || activeTool !== 'pen' || !onSnapStrokeToShape) return;
      const last = lastSnapScreenPointRef.current;
      if (last && Math.hypot(screenPoint.x - last.x, screenPoint.y - last.y) < 4) {
        return;
      }
      lastSnapScreenPointRef.current = screenPoint;
      clearHoldSnapTimer();
      holdSnapTimerRef.current = setTimeout(() => {
        const stroke = activeStrokeRef.current;
        if (!stroke || stroke.tool !== 'pen' || lockedGeometryEdgeRef.current) return;
        const recognized = classifyInkStroke(stroke.points);
        if (!recognized) return;
        const shapeId = `snap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const shape = recognizedShapeToObject(shapeId, recognized, {
          colorKey: stroke.color,
          strokeWidth: stroke.width,
        });
        activeStrokeRef.current = null;
        lockedGeometryEdgeRef.current = null;
        setSnapReadout(null);
        setActiveStroke(null);
        onSnapStrokeToShape(stroke, shape);
      }, 350);
    },
    [activeTool, clearHoldSnapTimer, holdToSnapShapes, onSnapStrokeToShape],
  );

  useEffect(() => () => clearHoldSnapTimer(), [clearHoldSnapTimer]);

  const beginStroke = useCallback((point: InkPoint, screenPoint?: Point) => {
    clearHoldSnapTimer();
    lastSnapScreenPointRef.current = screenPoint ?? null;
    const tool: FreehandTool = activeTool === 'highlighter' ? 'highlighter' : 'pen';
    let startPoint: InkPoint = point;
    lockedGeometryEdgeRef.current = null;
    setSnapReadout(null);

    if (activeInstrument && (activeTool === 'pen' || activeTool === 'highlighter')) {
      const snapCanvas = GEOMETRY_SNAP_SCREEN_DISTANCE / Math.max(viewport.scale, 0.25);
      if (activeInstrument.kind === 'ruler') {
        const proj = projectPointToRulerEdge(point, activeInstrument, snapCanvas);
        if (proj) {
          startPoint = proj.snappedPoint;
          lockedGeometryEdgeRef.current = {
            kind: 'ruler',
            edge: proj.edge,
            startAlong: proj.distanceAlongEdge,
          };
          setSnapReadout(`0 px · ${Math.round(activeInstrument.angleDeg)}°`);
        }
      } else if (
        activeInstrument.kind === 'set-square-45' ||
        activeInstrument.kind === 'set-square-30-60'
      ) {
        const proj = projectPointToSetSquareEdge(point, activeInstrument, snapCanvas);
        if (proj) {
          startPoint = proj.snappedPoint;
          lockedGeometryEdgeRef.current = {
            kind: 'set-square',
            edgeIndex: proj.edgeIndex,
            startAlong: proj.distanceAlongEdge,
          };
          setSnapReadout(`0 px · ${Math.round(activeInstrument.angleDeg)}°`);
        }
      }
    }

    const stroke = createInkStroke({
      id: `ink-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      tool,
      point: startPoint,
      color,
      width,
      opacity,
    });
    activeStrokeRef.current = stroke;
    setActiveStroke(stroke);
    if (screenPoint) scheduleHoldSnap(screenPoint);
  }, [activeInstrument, activeTool, clearHoldSnapTimer, color, opacity, scheduleHoldSnap, viewport.scale, width]);
  const addPoint = useCallback((point: InkPoint, minDistance: number, screenPoint?: Point) => {
    const current = activeStrokeRef.current;
    if (!current) return;
    let nextPoint: InkPoint = point;
    const locked = lockedGeometryEdgeRef.current;
    if (locked && activeInstrument) {
      if (locked.kind === 'ruler' && activeInstrument.kind === 'ruler') {
        const proj = projectPointToLockedRulerEdge(point, activeInstrument, locked.edge);
        nextPoint = { ...proj.snappedPoint, pressure: point.pressure };
        const dist = Math.round(Math.abs(proj.distanceAlongEdge - locked.startAlong));
        setSnapReadout(`${dist} px · ${Math.round(activeInstrument.angleDeg)}°`);
      } else if (
        locked.kind === 'set-square' &&
        (activeInstrument.kind === 'set-square-45' || activeInstrument.kind === 'set-square-30-60')
      ) {
        const proj = projectPointToSetSquareEdge(
          point,
          activeInstrument,
          Number.POSITIVE_INFINITY,
          locked.edgeIndex,
        );
        if (proj) {
          nextPoint = { ...proj.snappedPoint, pressure: point.pressure };
          const dist = Math.round(Math.abs(proj.distanceAlongEdge - locked.startAlong));
          setSnapReadout(`${dist} px · ${Math.round(activeInstrument.angleDeg)}°`);
        }
      }
    }
    const next = appendInkPoint(current, nextPoint, minDistance);
    activeStrokeRef.current = next;
    setActiveStroke(next);
    if (screenPoint) scheduleHoldSnap(screenPoint);
  }, [activeInstrument, scheduleHoldSnap]);
  /**
   * The in-progress stroke lives in React state for rendering and in a ref for
   * the gesture, because a running gesture keeps the callbacks from the render it
   * started in. The ref also keeps the commit out of a state updater, which React
   * may call twice.
   */
  const finishStroke = useCallback(() => {
    clearHoldSnapTimer();
    lastSnapScreenPointRef.current = null;
    const stroke = activeStrokeRef.current;
    activeStrokeRef.current = null;
    lockedGeometryEdgeRef.current = null;
    setSnapReadout(null);
    setActiveStroke(null);
    if (stroke) onCommand({ type: 'ink.add', stroke });
  }, [clearHoldSnapTimer, onCommand]);

  const [laserStrokes, setLaserStrokes] = useState<readonly EphemeralLaserStroke[]>([]);
  const [activeLaserStroke, setActiveLaserStroke] = useState<EphemeralLaserStroke | null>(null);
  const activeLaserRef = useRef<EphemeralLaserStroke | null>(null);
  const [laserNowMs, setLaserNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (laserStrokes.length === 0) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setLaserNowMs(now);
      setLaserStrokes((prev) => {
        const next = pruneExpiredLaserStrokes(prev, now);
        return next.length === prev.length ? prev : next;
      });
    }, 33);
    return () => clearInterval(interval);
  }, [laserStrokes.length]);

  const beginLaser = useCallback((point: Point) => {
    const now = Date.now();
    const stroke = createLaserStroke(
      `laser-${now}-${Math.random().toString(36).slice(2, 7)}`,
      laserColorKey,
      point,
      now,
    );
    activeLaserRef.current = stroke;
    setActiveLaserStroke(stroke);
    setLaserNowMs(now);
  }, [laserColorKey]);

  const addLaserPoint = useCallback((point: Point, minDistance: number) => {
    const current = activeLaserRef.current;
    if (!current) return;
    const next = appendLaserPoint(current, point, Date.now(), minDistance);
    activeLaserRef.current = next;
    setActiveLaserStroke(next);
  }, []);

  const finishLaser = useCallback(() => {
    const stroke = activeLaserRef.current;
    activeLaserRef.current = null;
    setActiveLaserStroke(null);
    if (stroke) {
      const now = Date.now();
      setLaserNowMs(now);
      setLaserStrokes((prev) => [...pruneExpiredLaserStrokes(prev, now), releaseLaserStroke(stroke, now)]);
    }
  }, []);
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

  const touchCanvas = useCallback((point?: Point) => { onCanvasTouch?.(point); }, [onCanvasTouch]);
  const selectObjects = useCallback((ids: string[]) => { onSelectionChange?.(ids); }, [onSelectionChange]);
  const editObject = useCallback((id: string, point?: Point) => { onObjectEdit?.(id, point); }, [onObjectEdit]);
  const editIfMath = useCallback(
    (id: string, point?: Point) => {
      const obj = document.objects.find((o) => o.id === id);
      if (obj && isMathObject(obj)) {
        onObjectEdit?.(id, point);
      }
    },
    [document.objects, onObjectEdit],
  );
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
    onInkSelectionChange?.(strokesInRect(document.strokes, rect).map((stroke) => stroke.id));
  }, [document.objects, document.strokes, onInkSelectionChange, onSelectionChange]);

  const drawAccepted = useSharedValue(true);

  const drawGesture = Gesture.Pan()
    .enabled(activeTool === 'pen' || activeTool === 'highlighter')
    .maxPointers(1)
    .minDistance(0)
    .onStart((event) => {
      const pointerKind: InputPointerKind =
        event.pointerType === PointerType.STYLUS
          ? 'stylus'
          : event.pointerType === PointerType.MOUSE
            ? 'mouse'
            : 'touch';
      const accepted = shouldAcceptInkPointer(pointerKind, stylusOnlyDrawing);
      drawAccepted.value = accepted;
      if (!accepted) {
        startX.value = offsetX.value;
        startY.value = offsetY.value;
        return;
      }
      const point = screenToCanvas(
        { x: event.x, y: event.y },
        { x: offsetX.value, y: offsetY.value, scale: scale.value },
      );
      const rawPressure =
        pressureSensitivity && pointerKind === 'stylus' && typeof event.stylusData?.pressure === 'number'
          ? event.stylusData.pressure
          : undefined;
      const inkPoint: InkPoint =
        rawPressure !== undefined ? { ...point, pressure: rawPressure } : point;
      runOnJS(beginStroke)(inkPoint, { x: event.x, y: event.y });
    })
    .onUpdate((event) => {
      if (!drawAccepted.value) {
        offsetX.value = startX.value + event.translationX;
        offsetY.value = startY.value + event.translationY;
        runOnJS(report)(offsetX.value, offsetY.value, scale.value);
        return;
      }
      const pointerKind: InputPointerKind =
        event.pointerType === PointerType.STYLUS
          ? 'stylus'
          : event.pointerType === PointerType.MOUSE
            ? 'mouse'
            : 'touch';
      const point = screenToCanvas(
        { x: event.x, y: event.y },
        { x: offsetX.value, y: offsetY.value, scale: scale.value },
      );
      const rawPressure =
        pressureSensitivity && pointerKind === 'stylus' && typeof event.stylusData?.pressure === 'number'
          ? event.stylusData.pressure
          : undefined;
      const inkPoint: InkPoint =
        rawPressure !== undefined ? { ...point, pressure: rawPressure } : point;
      runOnJS(addPoint)(inkPoint, MIN_POINT_DISTANCE_SCREEN / scale.value, { x: event.x, y: event.y });
    })
    .onFinalize(() => {
      if (!drawAccepted.value) {
        runOnJS(commitViewport)(offsetX.value, offsetY.value, scale.value);
        return;
      }
      runOnJS(finishStroke)();
    });

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
   * Select mode owns touch, move, resize, rotate, and marquee with one gesture so a
   * tap cannot race a drag. Dragging on empty canvas immediately draws a marquee
   * selection box; two-finger pinch/pan moves and zooms the viewport.
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
        else if (
          alreadySelected &&
          selectedObjectIds.length === 1 &&
          (isTextualObject(hit) || isTableObject(hit) || isMathObject(hit))
        ) {
          tapOpensEditor.value = hit.id;
        }
        return;
      }

      gestureMode.value = 'marquee';
      if (selectedObjectIds.length > 0) runOnJS(selectObjects)([]);
      if (selectedInkIds.length > 0 && onInkSelectionChange) runOnJS(onInkSelectionChange)([]);
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
        marqueeStartX.value = 0;
        marqueeStartY.value = 0;
        marqueeEndX.value = 0;
        marqueeEndY.value = 0;
        if (rect.width >= 2 || rect.height >= 2) runOnJS(selectInMarquee)(rect);
        return;
      }
      if (mode === 'move' || mode === 'resize' || mode === 'rotate') {
        if (mode === 'move' && !moved) {
          if (collapseId !== '') runOnJS(selectObjects)([collapseId]);
          else if (opensEditor !== '' && hitId !== '') {
            runOnJS(editObject)(hitId, {
              x: touchStartCanvasX.value,
              y: touchStartCanvasY.value,
            });
          }
        }
        runOnJS(commitPending)();
        return;
      }
      if (mode === 'pan') {
        runOnJS(commitViewport)(offsetX.value, offsetY.value, scale.value);
      }
    });

  /** Long-press on an unmoved MathObject opens inline slot editing. */
  const marqueeGesture = Gesture.LongPress()
    .enabled(activeTool === 'select')
    .numberOfPointers(1)
    .minDuration(MARQUEE_HOLD_MS)
    .maxDistance(8)
    .onStart(() => {
      if (gestureMode.value === 'move' && !dragMoved.value && draggingObjectId.value !== '') {
        const hitId = draggingObjectId.value;
        const hitPoint = { x: touchStartCanvasX.value, y: touchStartCanvasY.value };
        gestureMode.value = '';
        draggingObjectId.value = '';
        runOnJS(editIfMath)(hitId, hitPoint);
      }
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

  /** While editing text, a canvas tap commits the edit (or switches math slot). */
  const dismissTap = Gesture.Tap().onEnd((event) => {
    const point = screenToCanvas(
      { x: event.x, y: event.y },
      { x: offsetX.value, y: offsetY.value, scale: scale.value },
    );
    runOnJS(touchCanvas)(point);
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
    .onFinalize(() => { runOnJS(commitViewport)(offsetX.value, offsetY.value, scale.value); });

  const laserGesture = Gesture.Pan()
    .enabled(activeTool === 'laser')
    .maxPointers(1)
    .minDistance(0)
    .onStart((event) => {
      const point = screenToCanvas(
        { x: event.x, y: event.y },
        { x: offsetX.value, y: offsetY.value, scale: scale.value },
      );
      runOnJS(beginLaser)(point);
    })
    .onUpdate((event) => {
      const point = screenToCanvas(
        { x: event.x, y: event.y },
        { x: offsetX.value, y: offsetY.value, scale: scale.value },
      );
      runOnJS(addLaserPoint)(point, MIN_POINT_DISTANCE_SCREEN / scale.value);
    })
    .onFinalize(() => {
      runOnJS(finishLaser)();
    });

  const primaryGesture = editing
    ? dismissTap
    : activeTool === 'eraser'
      ? eraseGesture
      : activeTool === 'laser'
        ? laserGesture
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
  const renderedLaserStrokes = useMemo(
    () => (activeLaserStroke ? [...laserStrokes, activeLaserStroke] : laserStrokes),
    [laserStrokes, activeLaserStroke],
  );
  const backgroundLayers = useMemo(() => {
    if (boardStyle === 'blank') return [];
    const safeScale = Math.max(viewport.scale, MIN_ZOOM);
    const pad = 160 / safeScale;
    const topLeft = screenToCanvas({ x: 0, y: 0 }, viewport);
    return buildBackgroundLayers(boardStyle, {
      x: topLeft.x - pad,
      y: topLeft.y - pad,
      width: viewportSize.width / safeScale + pad * 2,
      height: viewportSize.height / safeScale + pad * 2,
    });
  }, [boardStyle, viewport, viewportSize]);
  const canvasBackgroundColor = resolveCanvasBackgroundHex(boardBackground, dark);
  const patternTheme = boardBackground === 'dark' ? darkColors : boardBackground === 'white' || boardBackground === 'light' ? colors : theme;
  const zoomLabel = `${Math.round(viewport.scale * 100)}%`;

  return (
    <View
      style={styles.root}
      accessibilityLabel="Interactive canvas viewport"
      onLayout={(event) => {
        const { width: w, height: h } = event.nativeEvent.layout;
        if (w > 0 && h > 0) setViewportSize({ width: w, height: h });
      }}
    >
      <GestureDetector gesture={gesture}>
        <Canvas style={StyleSheet.absoluteFill} accessibilityLabel="Drawing canvas">
          <Group transform={transform}>
            <Rect x={-4000} y={-4000} width={8000} height={8000} color={canvasBackgroundColor} />
            {backgroundLayers.map((layer, index) => (
              <BackgroundPatternView
                key={`${boardStyle}-${index}`}
                svgPath={layer.svgPath}
                strokeWidth={layer.strokeWidth / Math.max(viewport.scale, 0.5)}
                opacity={layer.opacity}
                color={layer.isMargin ? patternTheme.accent : patternTheme.foreground}
              />
            ))}
            {renderedStrokes.map((stroke) => (
              <InkStrokeView
                key={stroke.id}
                stroke={stroke}
                dark={dark}
                selected={selectedInkIds.includes(stroke.id)}
                highlightColor={theme.primary}
              />
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
            {document.objects.filter(isImageObject).map((object) => (
              <ImageObjectView key={object.id} object={object} dark={dark} />
            ))}
            {document.objects.filter(isGeometricObject).map((object) => (
              <GeometricObjectView key={object.id} object={object} dark={dark} />
            ))}
            {document.objects.filter(isTableObject).map((object) => (
              <TableObjectView key={object.id} object={object} dark={dark} />
            ))}
            {document.objects.filter(isMathObject).map((object) => (
              <MathObjectView
                key={object.id}
                object={object}
                dark={dark}
                activeSpan={editingMathSpan?.objectId === object.id ? editingMathSpan.span : null}
              />
            ))}
            {renderedLaserStrokes.map((stroke) => {
              const alpha = laserStrokeOpacity(stroke, laserNowMs);
              if (alpha <= 0) return null;
              return (
                <LaserStrokeView
                  key={stroke.id}
                  stroke={stroke}
                  alpha={alpha}
                  scale={viewport.scale}
                />
              );
            })}
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

      {document.objects.filter(isTableObject).map((object) => (
        <TableCellsOverlay
          key={`cells-${object.id}`}
          object={object}
          dark={dark}
          editingCell={editingTableCell?.objectId === object.id ? editingTableCell : null}
          offsetX={offsetX}
          offsetY={offsetY}
          scale={scale}
        />
      ))}

      {document.objects
        .filter((o): o is ShapeObject => o.type === 'shape' && Boolean(o.showMeasurements))
        .map((object) => (
          <ShapeMeasurementsOverlay
            key={`meas-${object.id}`}
            object={object}
            dark={dark}
            offsetX={offsetX}
            offsetY={offsetY}
            scale={scale}
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
        {snapReadout ? (
          <View style={[styles.viewBadge, { backgroundColor: theme.surface, borderColor: '#0D9488' }]} pointerEvents="none">
            <Text style={[styles.zoomText, { color: '#0D9488' }]}>{snapReadout}</Text>
          </View>
        ) : null}
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

const InkStrokeView = memo(function InkStrokeView({
  stroke,
  dark,
  selected = false,
  highlightColor = '#0D9488',
}: {
  stroke: InkStroke;
  dark: boolean;
  selected?: boolean;
  highlightColor?: string;
}) {
  const useRibbon = stroke.tool === 'pen' && hasVariablePressure(stroke.points);
  const path = useMemo(() => {
    const svg = useRibbon
      ? buildVariableWidthStrokePath(stroke.points, stroke.width)
      : inkPathData(stroke.points);
    return Skia.Path.MakeFromSVGString(svg) ?? Skia.Path.Make();
  }, [stroke.points, stroke.width, useRibbon]);

  return (
    <>
      {selected ? (
        <Path
          path={path}
          color={highlightColor}
          opacity={0.28}
          style={useRibbon ? 'fill' : 'stroke'}
          strokeWidth={stroke.width + 8}
          strokeCap="round"
          strokeJoin="round"
        />
      ) : null}
      <Path
        path={path}
        color={stroke.color}
        opacity={stroke.opacity}
        style={useRibbon ? 'fill' : 'stroke'}
        strokeWidth={stroke.width}
        strokeCap="round"
        strokeJoin="round"
        blendMode={stroke.tool === 'highlighter' ? (dark ? 'screen' : 'multiply') : 'srcOver'}
      />
    </>
  );
});

const MathObjectView = memo(function MathObjectView({
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
      <Group transform={[{ translateX: originX }, { translateY: originY }, { scale: contentScale }]}>
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

function BackgroundPatternView({
  svgPath,
  strokeWidth,
  opacity,
  color,
}: {
  svgPath: string;
  strokeWidth: number;
  opacity: number;
  color: string;
}) {
  const path = useMemo(() => Skia.Path.MakeFromSVGString(svgPath) ?? Skia.Path.Make(), [svgPath]);
  return (
    <Path
      path={path}
      color={color}
      opacity={opacity}
      style="stroke"
      strokeWidth={strokeWidth}
      strokeCap="round"
    />
  );
}

function LaserStrokeView({
  stroke,
  alpha,
  scale,
}: {
  stroke: EphemeralLaserStroke;
  alpha: number;
  scale: number;
}) {
  const path = useMemo(() => {
    const pts = stroke.points.map((p) => ({ x: p.x, y: p.y }));
    return Skia.Path.MakeFromSVGString(inkPathData(pts)) ?? Skia.Path.Make();
  }, [stroke.points]);
  const palette = resolveLaserPalette(stroke.colorKey);
  const invScale = 1 / Math.max(scale, MIN_ZOOM);
  return (
    <>
      <Path
        path={path}
        color={palette.halo}
        opacity={LASER_HALO_OPACITY * alpha}
        style="stroke"
        strokeWidth={LASER_HALO_WIDTH * invScale}
        strokeCap="round"
        strokeJoin="round"
      />
      <Path
        path={path}
        color={palette.core}
        opacity={LASER_CORE_OPACITY * alpha}
        style="stroke"
        strokeWidth={LASER_CORE_WIDTH * invScale}
        strokeCap="round"
        strokeJoin="round"
      />
    </>
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

function ImageObjectView({ object, dark }: { object: ImageObject; dark: boolean }) {
  const uri = resolveMediaUri(object.storagePath);
  const image = useImage(uri);
  const theme = dark ? darkColors : colors;
  const origin = { x: object.x + object.width / 2, y: object.y + object.height / 2 };
  const transform = object.rotation === 0 ? undefined : [{ rotate: (object.rotation * Math.PI) / 180 }];
  if (!image) {
    return (
      <Group origin={origin} transform={transform}>
        <Rect x={object.x} y={object.y} width={object.width} height={object.height} color={theme.muted} />
        <Rect x={object.x} y={object.y} width={object.width} height={object.height} color={theme.border} style="stroke" strokeWidth={1} />
      </Group>
    );
  }
  return (
    <Group origin={origin} transform={transform}>
      <SkiaImage image={image} x={object.x} y={object.y} width={object.width} height={object.height} fit="contain" />
    </Group>
  );
}

const GeometricObjectView = memo(function GeometricObjectView({
  object,
  dark,
}: {
  object: ShapeObject | ConnectorObject;
  dark: boolean;
}) {
  const color = textColorValue(object.colorKey, dark);
  const origin = useMemo(
    () => ({
      x: object.x + object.width / 2,
      y: object.y + object.height / 2,
    }),
    [object.height, object.width, object.x, object.y],
  );
  const transform = useMemo(
    () => (object.rotation === 0 ? undefined : [{ rotate: (object.rotation * Math.PI) / 180 }]),
    [object.rotation],
  );

  const connectorPaths = useMemo(() => {
    if (object.type !== 'connector') return null;
    const pts = connectorPolyline(
      object.style,
      object.x,
      object.y,
      object.width,
      object.height,
      object.direction,
    );
    const path = Skia.Path.MakeFromSVGString(polylinePathData(pts)) ?? Skia.Path.Make();
    const arrowPath =
      object.style === 'arrow'
        ? Skia.Path.MakeFromSVGString(arrowHeadPathData(pts, arrowHeadSize(object.strokeWidth)))
        : null;
    return { path, arrowPath };
  }, [object]);

  const shapePaths = useMemo(() => {
    if (object.type !== 'shape') return null;
    const primitives = buildShapeRenderPrimitives(
      object.shape,
      object.x,
      object.y,
      object.width,
      object.height,
      object.direction,
      Boolean(object.showMeasurements),
    );
    return {
      fillPath:
        object.fillKey && primitives.fillPathSvg
          ? Skia.Path.MakeFromSVGString(primitives.fillPathSvg)
          : null,
      solidPath: primitives.solidStrokeSvg
        ? Skia.Path.MakeFromSVGString(primitives.solidStrokeSvg)
        : null,
      dashedPath: primitives.dashedStrokeSvg
        ? Skia.Path.MakeFromSVGString(primitives.dashedStrokeSvg)
        : null,
      arrowPath: primitives.arrowHeadsSvg
        ? Skia.Path.MakeFromSVGString(primitives.arrowHeadsSvg)
        : null,
    };
  }, [object]);

  if (connectorPaths) {
    return (
      <Group origin={origin} transform={transform}>
        <Path
          path={connectorPaths.path}
          color={color}
          style="stroke"
          strokeWidth={object.strokeWidth}
          strokeCap="round"
          strokeJoin="round"
        />
        {connectorPaths.arrowPath ? (
          <Path path={connectorPaths.arrowPath} color={color} style="fill" />
        ) : null}
      </Group>
    );
  }

  if (!shapePaths || object.type !== 'shape') return null;

  return (
    <Group origin={origin} transform={transform}>
      {shapePaths.fillPath && object.fillKey ? (
        <Path path={shapePaths.fillPath} color={stickyColorValue(object.fillKey)} style="fill" />
      ) : null}
      {shapePaths.solidPath ? (
        <Path
          path={shapePaths.solidPath}
          color={color}
          style="stroke"
          strokeWidth={object.strokeWidth}
          strokeCap="round"
          strokeJoin="round"
        />
      ) : null}
      {shapePaths.dashedPath ? (
        <Path
          path={shapePaths.dashedPath}
          color={color}
          style="stroke"
          strokeWidth={Math.max(1.5, object.strokeWidth * 0.75)}
          strokeCap="round"
          strokeJoin="round"
        >
          <DashPathEffect intervals={[6, 4]} />
        </Path>
      ) : null}
      {shapePaths.arrowPath ? (
        <Path path={shapePaths.arrowPath} color={color} style="fill" />
      ) : null}
    </Group>
  );
});

const TableCellsOverlay = memo(function TableCellsOverlay({
  object,
  dark,
  editingCell,
  offsetX,
  offsetY,
  scale,
}: {
  object: TableObject;
  dark: boolean;
  editingCell: { row: number; col: number } | null;
  offsetX: SharedValue<number>;
  offsetY: SharedValue<number>;
  scale: SharedValue<number>;
}) {
  const color = textColorValue(object.colorKey, dark);
  const frame = useAnimatedStyle(() => ({
    left: object.x * scale.value + offsetX.value,
    top: object.y * scale.value + offsetY.value,
    width: object.width * scale.value,
    height: object.height * scale.value,
    transform: [{ rotate: `${object.rotation}deg` }],
  }), [object]);

  const rowH = useMemo(() => tableRowHeight(object), [object]);
  const widths = useMemo(() => tableColumnWidths(object), [object]);

  return (
    <Animated.View pointerEvents="none" style={[styles.object, frame]}>
      {Array.from({ length: object.rows }, (_, r) =>
        Array.from({ length: object.columns }, (__, c) => {
          const cell = object.cells[r * object.columns + c];
          const isEditing = editingCell?.row === r && editingCell?.col === c;
          if (!cell?.text || isEditing) return null;
          const rect = tableCellRect(object, r, c);
          const relLeftPct = ((rect.x - object.x) / Math.max(1, object.width)) * 100;
          const relTopPct = ((rect.y - object.y) / Math.max(1, object.height)) * 100;
          const relWPct = (widths[c] / Math.max(1, object.width)) * 100;
          const relHPct = (rowH / Math.max(1, object.height)) * 100;
          const isHeader = object.hasHeaderRow && r === 0;
          return (
            <View
              key={`${r}-${c}`}
              style={[
                styles.tableCellOverlay,
                {
                  left: `${relLeftPct}%`,
                  top: `${relTopPct}%`,
                  width: `${relWPct}%`,
                  height: `${relHPct}%`,
                },
              ]}
            >
              <Text
                numberOfLines={3}
                style={{
                  color,
                  fontSize: Math.max(9, object.fontSize * Math.min(1.4, Math.max(0.65, viewportScaleFallback(object)))),
                  fontWeight: isHeader ? '700' : '400',
                  textAlign: cell.align ?? 'left',
                }}
              >
                {cell.text}
              </Text>
            </View>
          );
        }),
      )}
    </Animated.View>
  );
});

function viewportScaleFallback(_object: TableObject): number {
  return 1;
}

const ShapeMeasurementsOverlay = memo(function ShapeMeasurementsOverlay({
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
  }), [object]);

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
          <Text style={[styles.measurementLabelText, { color }]}>
            {lbl.text}
          </Text>
        </View>
      ))}
    </Animated.View>
  );
});

const TableObjectView = memo(function TableObjectView({
  object,
  dark,
}: {
  object: TableObject;
  dark: boolean;
}) {
  const borderColor = textColorValue(object.colorKey, dark);
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
  const rowH = useMemo(() => tableRowHeight(object), [object]);
  const widths = useMemo(() => tableColumnWidths(object), [object]);

  const colLines = useMemo(() => {
    const lines: number[] = [];
    let accX = object.x;
    for (let c = 0; c < object.columns - 1; c += 1) {
      accX += widths[c];
      lines.push(accX);
    }
    return lines;
  }, [object.columns, object.x, widths]);

  return (
    <Group origin={origin} transform={transform}>
      {object.hasHeaderRow && object.fillHeader && object.rows >= 1 ? (
        <Rect
          x={object.x}
          y={object.y}
          width={object.width}
          height={rowH}
          color={borderColor}
          opacity={0.12}
          style="fill"
        />
      ) : null}
      {Array.from({ length: Math.max(0, object.rows - 1) }, (_, idx) => {
        const ly = object.y + (idx + 1) * rowH;
        return (
          <SkiaLine
            key={`r-${idx}`}
            p1={vec(object.x, ly)}
            p2={vec(object.x + object.width, ly)}
            color={borderColor}
            strokeWidth={1}
            opacity={0.45}
          />
        );
      })}
      {colLines.map((lx, idx) => (
        <SkiaLine
          key={`c-${idx}`}
          p1={vec(lx, object.y)}
          p2={vec(lx, object.y + object.height)}
          color={borderColor}
          strokeWidth={1}
          opacity={0.45}
        />
      ))}
      <RoundedRect
        x={object.x}
        y={object.y}
        width={object.width}
        height={object.height}
        r={6}
        color={borderColor}
        style="stroke"
        strokeWidth={1.5}
      />
    </Group>
  );
});

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
