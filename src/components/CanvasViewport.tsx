import {
  Canvas,
  Circle,
  Group,
  Rect,
} from '@shopify/react-native-skia';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector, PointerType } from 'react-native-gesture-handler';
import {
  runOnJS,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';

import { styles } from './CanvasViewport.styles';
import {
  BackgroundPatternView,
  ImageObjectView,
  LaserStrokeView,
  SelectionOverlay,
} from './canvas/CanvasPrimitives';
import { ChartLayer } from './canvas/ChartLayer';
import { FunctionPlotLayer } from './canvas/FunctionPlotLayer';
import { GeometricObjectView } from './canvas/GeometricObjectView';
import { InkStrokeView } from './canvas/InkStrokeView';
import { MathObjectView } from './canvas/MathObjectView';
import { PrivateBadgeLayer } from './canvas/PrivateBadgeLayer';
import { RevealTapeLayer } from './canvas/RevealTapeLayer';
import { TableCellsOverlay, TableObjectView } from './canvas/TableObjectView';
import { CanvasObjectView, ShapeMeasurementsOverlay } from './canvas/TextualObjectView';
import { VoicePinLayer } from './canvas/VoicePinLayer';
import {
  CONNECTOR_SNAP_THRESHOLD_SCREEN,
  findNearestPortSnap,
  type ConnectorBinding,
} from '../canvas/connectors';

import {
  DEFAULT_CONNECTOR_STROKE_WIDTH,
  DEFAULT_SHAPE_STROKE_WIDTH,
  MIN_SHAPE_SIZE_SCREEN,
  OBJECT_PADDING,
  buildShapeRenderPrimitives,
  createConnectorObject,
  createShapeObject,
  geometryFromPoints,
  isChartObject,
  isFunctionPlotObject,
  isGeometricObject,
  isImageObject,
  isMathObject,
  isRevealTapeObject,
  isTableObject,
  isTextualObject,
  isVoicePinObject,
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
  type RevealTapeObject,
  type ShapeKind,
  type ShapeObject,
  type TableObject,
  type TextualObject,
} from '../canvas/document';
import { createRevealTapeObject } from '../canvas/reveal-tape';
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
  zoomViewportAt,
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
import type { EphemeralLaserPacket, EphemeralStrokePacket } from '../classroom/protocol';

export { canvasToScreen, screenToCanvas } from '../canvas/viewport';
export type { InkStroke } from '../canvas/ink';

export type InkTool =
  | 'select'
  | 'pan'
  | 'pen'
  | 'highlighter'
  | 'eraser'
  | 'laser'
  | 'text'
  | 'sticky'
  | 'shape'
  | 'connector'
  | 'image'
  | 'reveal-tape'
  | 'voice-pin';
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
  compactHud?: boolean;
  hideHud?: boolean;
  readOnly?: boolean;
  hidePrivatePreview?: boolean;
  playingVoicePinId?: string | null;
  remoteActiveStroke?: EphemeralStrokePacket | null;
  remoteLaserStroke?: EphemeralLaserPacket | null;
  onLiveStrokeSample?: (sample: Omit<EphemeralStrokePacket, 'authorPeerId'>) => void;
  onLiveLaserSample?: (sample: Omit<EphemeralLaserPacket, 'authorPeerId'>) => void;
  onViewportChange?: (viewport: ViewportState) => void;
  onCommand: (command: DocumentCommand, transient?: boolean) => void;
  onCommitPending: () => void;
  onObjectCreate?: (type: 'text' | 'sticky', point: Point) => void;
  onSelectionChange?: (ids: string[]) => void;
  onInkSelectionChange?: (ids: string[]) => void;
  onSnapStrokeToShape?: (stroke: InkStroke, shape: ShapeObject | ConnectorObject) => void;
  onObjectEdit?: (id: string, point?: Point) => void;
  onToggleRevealTape?: (id: string) => void;
  onToggleVoicePinPlay?: (id: string) => void;
  onInsertRevealTapeAt?: (
    point: Point,
    rect?: { x: number; y: number; width: number; height: number },
  ) => void;
  onStartVoicePinAt?: (point: Point) => void;
  /** Real rendered text height, used to correct the object's estimated height. */
  onObjectMeasure?: (id: string, height: number) => void;
  /** A touch on the canvas while an object is being edited: commit or switch slot. */
  onCanvasTouch?: (point?: Point) => void;
};

export const CanvasViewport = memo(function CanvasViewport({
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
  compactHud = false,
  hideHud = false,
  readOnly = false,
  hidePrivatePreview = false,
  playingVoicePinId = null,
  remoteActiveStroke = null,
  remoteLaserStroke = null,
  onLiveStrokeSample,
  onLiveLaserSample,
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
  onToggleRevealTape,
  onToggleVoicePinPlay,
  onInsertRevealTapeAt,
  onStartVoicePinAt,
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
  const tapToggleId = useSharedValue('');
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
  const [draftRevealTape, setDraftRevealTape] = useState<RevealTapeObject | null>(null);
  const draftRevealTapeStartRef = useRef<Point | null>(null);
  const draftRevealTapeRef = useRef<RevealTapeObject | null>(null);
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

  const stepZoom = useCallback(
    (factor: number) => {
      const current: Viewport = {
        x: offsetX.value,
        y: offsetY.value,
        scale: scale.value,
      };
      const anchor = {
        x: viewportSize.width / 2,
        y: viewportSize.height / 2,
      };
      const next = zoomViewportAt(current, anchor, current.scale * factor);
      offsetX.value = next.x;
      offsetY.value = next.y;
      scale.value = next.scale;
      commitViewport(next.x, next.y, next.scale);
    },
    [commitViewport, offsetX, offsetY, scale, viewportSize.height, viewportSize.width],
  );

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
    onLiveStrokeSample?.({
      strokeId: stroke.id,
      tool,
      color: stroke.color as any,
      width: stroke.width,
      opacity: stroke.opacity,
      points: stroke.points,
    });
    if (screenPoint) scheduleHoldSnap(screenPoint);
  }, [activeInstrument, activeTool, clearHoldSnapTimer, color, onLiveStrokeSample, opacity, scheduleHoldSnap, viewport.scale, width]);
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
    onLiveStrokeSample?.({
      strokeId: next.id,
      tool: next.tool,
      color: next.color as any,
      width: next.width,
      opacity: next.opacity,
      points: next.points,
    });
    if (screenPoint) scheduleHoldSnap(screenPoint);
  }, [activeInstrument, onLiveStrokeSample, scheduleHoldSnap]);
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
    if (stroke) {
      onLiveStrokeSample?.({
        strokeId: stroke.id,
        tool: stroke.tool,
        color: stroke.color as any,
        width: stroke.width,
        opacity: stroke.opacity,
        points: stroke.points,
        isDone: true,
      });
      onCommand({ type: 'ink.add', stroke });
    }
  }, [clearHoldSnapTimer, onCommand, onLiveStrokeSample]);

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
    onLiveLaserSample?.({
      id: stroke.id,
      colorKey: stroke.colorKey,
      points: stroke.points.map((pt) => ({ x: pt.x, y: pt.y })),
      active: true,
    });
  }, [laserColorKey, onLiveLaserSample]);

  const addLaserPoint = useCallback((point: Point, minDistance: number) => {
    const current = activeLaserRef.current;
    if (!current) return;
    const next = appendLaserPoint(current, point, Date.now(), minDistance);
    activeLaserRef.current = next;
    setActiveLaserStroke(next);
    onLiveLaserSample?.({
      id: next.id,
      colorKey: next.colorKey,
      points: next.points.map((pt) => ({ x: pt.x, y: pt.y })),
      active: true,
    });
  }, [onLiveLaserSample]);

  const finishLaser = useCallback(() => {
    const stroke = activeLaserRef.current;
    activeLaserRef.current = null;
    setActiveLaserStroke(null);
    if (stroke) {
      onLiveLaserSample?.({
        id: stroke.id,
        colorKey: stroke.colorKey,
        points: stroke.points.map((pt) => ({ x: pt.x, y: pt.y })),
        active: false,
      });
      const now = Date.now();
      setLaserNowMs(now);
      setLaserStrokes((prev) => [...pruneExpiredLaserStrokes(prev, now), releaseLaserStroke(stroke, now)]);
    }
  }, [onLiveLaserSample]);
  const eraseAt = useCallback((point: Point, currentScale: number) => {
    onCommand(
      { type: 'ink.erase', point, radius: eraserRadiusForScale(eraserRadius, currentScale) },
      true,
    );
  }, [eraserRadius, onCommand]);

  const [snapPortPoint, setSnapPortPoint] = useState<Point | null>(null);
  const draftStartBindingRef = useRef<ConnectorBinding | undefined>(undefined);

  /**
   * Shape and connector drags use the same lifecycle as ink: the object is
   * local state until the finger lifts, then it becomes one insert command.
   */
  const beginShape = useCallback((point: Point, tool: 'shape' | 'connector') => {
    const id = `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    if (tool === 'connector') {
      const snap = findNearestPortSnap(
        document.objects,
        point,
        viewport.scale,
        CONNECTOR_SNAP_THRESHOLD_SCREEN,
      );
      const startPt = snap ? snap.point : point;
      const startBinding: ConnectorBinding | undefined = snap
        ? { objectId: snap.objectId, port: snap.port }
        : undefined;
      draftStartBindingRef.current = startBinding;
      setSnapPortPoint(snap ? snap.point : null);
      const object = createConnectorObject({
        id,
        style: connectorStyle,
        start: startPt,
        end: startPt,
        colorKey: connectorColorKey,
        strokeWidth: connectorStrokeWidth,
        startBinding,
      });
      draftStartRef.current = startPt;
      draftObjectRef.current = object;
      setDraftObject(object);
      return;
    }

    draftStartBindingRef.current = undefined;
    setSnapPortPoint(null);
    const object = createShapeObject({
      id,
      shape: shapeKind,
      start: point,
      end: point,
      colorKey: shapeColorKey,
      fillKey: shapeFillKey,
      strokeWidth: shapeStrokeWidth,
    });
    draftStartRef.current = point;
    draftObjectRef.current = object;
    setDraftObject(object);
  }, [
    connectorColorKey,
    connectorStrokeWidth,
    connectorStyle,
    document.objects,
    shapeColorKey,
    shapeFillKey,
    shapeKind,
    shapeStrokeWidth,
    viewport.scale,
  ]);

  const updateShape = useCallback((point: Point) => {
    const current = draftObjectRef.current;
    const start = draftStartRef.current;
    if (!current || !start) return;
    if (current.type === 'connector') {
      const exclude = draftStartBindingRef.current
        ? new Set([draftStartBindingRef.current.objectId])
        : undefined;
      const snap = findNearestPortSnap(
        document.objects,
        point,
        viewport.scale,
        CONNECTOR_SNAP_THRESHOLD_SCREEN,
        exclude,
      );
      const endPt = snap ? snap.point : point;
      setSnapPortPoint(snap ? snap.point : null);
      const next: ConnectorObject = {
        ...current,
        ...geometryFromPoints(start, endPt),
      };
      if (snap) {
        next.endBinding = { objectId: snap.objectId, port: snap.port };
      } else {
        delete next.endBinding;
      }
      draftObjectRef.current = next;
      setDraftObject(next);
      return;
    }

    const next = { ...current, ...geometryFromPoints(start, point) } as ShapeObject | ConnectorObject;
    draftObjectRef.current = next;
    setDraftObject(next);
  }, [document.objects, viewport.scale]);

  const finishShape = useCallback((currentScale: number) => {
    const draft = draftObjectRef.current;
    draftObjectRef.current = null;
    draftStartRef.current = null;
    draftStartBindingRef.current = undefined;
    setSnapPortPoint(null);
    setDraftObject(null);
    if (!draft) return;
    // A tap, or a drag too small to see, should not leave a speck on the board.
    if (Math.hypot(draft.width, draft.height) * currentScale < MIN_SHAPE_SIZE_SCREEN) return;
    const id = `${draft.type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    onCommand({ type: 'object.insert', object: { ...draft, id } });
  }, [onCommand]);

  const beginRevealTape = useCallback((point: Point) => {
    draftRevealTapeStartRef.current = point;
    const draft = createRevealTapeObject({
      id: 'draft-reveal-tape',
      point,
      width: 44,
      height: 28,
    });
    draftRevealTapeRef.current = draft;
    setDraftRevealTape(draft);
  }, []);

  const updateRevealTape = useCallback((point: Point) => {
    const start = draftRevealTapeStartRef.current;
    if (!start) return;
    const x = Math.min(start.x, point.x);
    const y = Math.min(start.y, point.y);
    const width = Math.max(44, Math.abs(point.x - start.x));
    const height = Math.max(28, Math.abs(point.y - start.y));
    const draft: RevealTapeObject = {
      id: 'draft-reveal-tape',
      type: 'reveal-tape',
      x,
      y,
      width,
      height,
      rotation: 0,
      colorKey: 'butter',
      label: 'Tap to reveal',
      isRevealed: false,
    };
    draftRevealTapeRef.current = draft;
    setDraftRevealTape(draft);
  }, []);

  const finishRevealTape = useCallback(
    (currentScale: number) => {
      const start = draftRevealTapeStartRef.current;
      const draft = draftRevealTapeRef.current;
      draftRevealTapeStartRef.current = null;
      draftRevealTapeRef.current = null;
      setDraftRevealTape(null);
      if (!start) return;
      if (
        !draft ||
        (draft.width <= 46 && draft.height <= 30) ||
        Math.hypot(draft.width, draft.height) * currentScale < MIN_SHAPE_SIZE_SCREEN
      ) {
        onInsertRevealTapeAt?.(start);
        return;
      }
      onInsertRevealTapeAt?.(
        { x: draft.x + draft.width / 2, y: draft.y + draft.height / 2 },
        { x: draft.x, y: draft.y, width: draft.width, height: draft.height },
      );
    },
    [onInsertRevealTapeAt],
  );

  const visibleObjects = useMemo(
    () =>
      hidePrivatePreview
        ? document.objects.filter((o) => o.isPrivate !== true)
        : document.objects,
    [document.objects, hidePrivatePreview],
  );

  const handleInteractiveTapAt = useCallback(
    (point: Point) => {
      if (!readOnly && activeTool === 'select') {
        const selected = visibleObjects.filter((object) => selectedObjectIds.includes(object.id));
        if (selected.length === 1) {
          const rotateOffset = ROTATE_HANDLE_OFFSET_SCREEN / Math.max(viewport.scale, 0.25);
          const handle = handleAtPoint(
            selected,
            point,
            SELECTION_HANDLE_HIT_SCREEN / Math.max(viewport.scale, 0.25),
            rotateOffset,
          );
          if (handle) return;
        }
      }
      const hit = objectAtPoint(visibleObjects, point);
      if (!hit) {
        if (!readOnly && activeTool === 'select' && selectedObjectIds.length > 0) {
          onSelectionChange?.([]);
        }
        return;
      }
      if (isRevealTapeObject(hit)) {
        if (!readOnly && activeTool === 'select') onSelectionChange?.([hit.id]);
        onToggleRevealTape?.(hit.id);
        return;
      }
      if (isVoicePinObject(hit)) {
        if (!readOnly && activeTool === 'select') onSelectionChange?.([hit.id]);
        onToggleVoicePinPlay?.(hit.id);
        return;
      }
      if (!readOnly && activeTool === 'select') {
        onSelectionChange?.([hit.id]);
      }
    },
    [
      activeTool,
      onSelectionChange,
      onToggleRevealTape,
      onToggleVoicePinPlay,
      readOnly,
      selectedObjectIds,
      viewport.scale,
      visibleObjects,
    ],
  );

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
  const toggleInteractiveObject = useCallback(
    (id: string) => {
      const obj = visibleObjects.find((o) => o.id === id);
      if (!obj) return;
      if (isRevealTapeObject(obj)) {
        onToggleRevealTape?.(obj.id);
      } else if (isVoicePinObject(obj)) {
        onToggleVoicePinPlay?.(obj.id);
      }
    },
    [onToggleRevealTape, onToggleVoicePinPlay, visibleObjects],
  );

  const createObject = useCallback(
    (type: 'text' | 'sticky' | 'reveal-tape' | 'voice-pin', point: Point) => {
      if (type === 'reveal-tape') {
        onInsertRevealTapeAt?.(point);
        return;
      }
      if (type === 'voice-pin') {
        onStartVoicePinAt?.(point);
        return;
      }
      onObjectCreate?.(type, point);
    },
    [onInsertRevealTapeAt, onObjectCreate, onStartVoicePinAt],
  );
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
    onSelectionChange?.(objectsInRect(visibleObjects, rect).map((object) => object.id));
    onInkSelectionChange?.(strokesInRect(document.strokes, rect).map((stroke) => stroke.id));
  }, [document.strokes, onInkSelectionChange, onSelectionChange, visibleObjects]);

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
      tapToggleId.value = '';
      collapseSelectionId.value = '';
      draggingObjectId.value = '';

      if (readOnly) {
        const hitReadOnly = objectAtPoint(visibleObjects, point);
        if (hitReadOnly && (isRevealTapeObject(hitReadOnly) || isVoicePinObject(hitReadOnly))) {
          tapToggleId.value = hitReadOnly.id;
        }
        gestureMode.value = 'pan';
        return;
      }

      const selected = visibleObjects.filter((object) => selectedObjectIds.includes(object.id));
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

      const hit = objectAtPoint(visibleObjects, point);
      if (hit) {
        const alreadySelected = selectedObjectIds.includes(hit.id);
        draggingObjectId.value = hit.id;
        gestureMode.value = 'move';
        if (!alreadySelected) runOnJS(selectObjects)([hit.id]);
        runOnJS(beginTransform)('move', null, point, alreadySelected ? selectedObjectIds : [hit.id]);
        if (alreadySelected && selectedObjectIds.length > 1) {
          collapseSelectionId.value = hit.id;
        } else if (
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
      const toggleInteractive = tapToggleId.value;
      const collapseId = collapseSelectionId.value;
      gestureMode.value = '';
      draggingObjectId.value = '';
      tapOpensEditor.value = '';
      tapToggleId.value = '';
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
          if (collapseId !== '') {
            runOnJS(selectObjects)([collapseId]);
          } else if (opensEditor !== '' && hitId !== '') {
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
    .enabled(
      (activeTool === 'text' && !!onObjectCreate) ||
        (activeTool === 'sticky' && !!onObjectCreate) ||
        (activeTool === 'voice-pin' && !!onStartVoicePinAt),
    )
    .onEnd((event) => {
      const point = screenToCanvas(
        { x: event.x, y: event.y },
        { x: offsetX.value, y: offsetY.value, scale: scale.value },
      );
      runOnJS(createObject)(activeTool as 'text' | 'sticky' | 'voice-pin', point);
    });

  const revealTapeGesture = Gesture.Pan()
    .enabled(activeTool === 'reveal-tape' && !!onInsertRevealTapeAt)
    .maxPointers(1)
    .minDistance(0)
    .onStart((event) => {
      const point = screenToCanvas(
        { x: event.x, y: event.y },
        { x: offsetX.value, y: offsetY.value, scale: scale.value },
      );
      runOnJS(beginRevealTape)(point);
    })
    .onUpdate((event) => {
      const point = screenToCanvas(
        { x: event.x, y: event.y },
        { x: offsetX.value, y: offsetY.value, scale: scale.value },
      );
      runOnJS(updateRevealTape)(point);
    })
    .onFinalize(() => {
      runOnJS(finishRevealTape)(scale.value);
    });

  const interactiveTap = Gesture.Tap()
    .enabled((readOnly || activeTool === 'select' || activeTool === 'pan') && !editing)
    .maxDistance(10)
    .onEnd((event) => {
      const point = screenToCanvas(
        { x: event.x, y: event.y },
        { x: offsetX.value, y: offsetY.value, scale: scale.value },
      );
      runOnJS(handleInteractiveTapAt)(point);
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

  const handPanGesture = Gesture.Pan()
    .enabled(activeTool === 'pan')
    .minDistance(0)
    .onStart(() => {
      startX.value = offsetX.value;
      startY.value = offsetY.value;
    })
    .onUpdate((event) => {
      offsetX.value = startX.value + event.translationX;
      offsetY.value = startY.value + event.translationY;
      runOnJS(report)(offsetX.value, offsetY.value, scale.value);
    })
    .onFinalize(() => {
      runOnJS(commitViewport)(offsetX.value, offsetY.value, scale.value);
    });

  const primaryGesture = readOnly
    ? handPanGesture
    : editing
      ? dismissTap
    : activeTool === 'pan'
      ? handPanGesture
      : activeTool === 'eraser'
        ? eraseGesture
        : activeTool === 'laser'
          ? laserGesture
          : activeTool === 'pen' || activeTool === 'highlighter'
            ? drawGesture
            : activeTool === 'reveal-tape'
              ? revealTapeGesture
              : activeTool === 'text' || activeTool === 'sticky' || activeTool === 'voice-pin'
                ? objectTap
                : activeTool === 'shape' || activeTool === 'connector'
                  ? shapeGesture
                  : selectGesture;
  const gesture = Gesture.Simultaneous(interactiveTap, primaryGesture, marqueeGesture, pinchGesture);

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
  const renderedStrokes = useMemo(() => {
    const list = [...document.strokes];
    if (remoteActiveStroke && !remoteActiveStroke.isDone && remoteActiveStroke.points.length > 0) {
      list.push({
        id: remoteActiveStroke.strokeId,
        tool: remoteActiveStroke.tool,
        color: remoteActiveStroke.color,
        width: remoteActiveStroke.width,
        opacity: remoteActiveStroke.opacity,
        points: remoteActiveStroke.points,
        createdAt: '',
      });
    }
    if (activeStroke) list.push(activeStroke);
    return list;
  }, [document.strokes, activeStroke, remoteActiveStroke]);
  const renderedLaserStrokes = useMemo(() => {
    const list = [...laserStrokes];
    if (activeLaserStroke) list.push(activeLaserStroke);
    if (remoteLaserStroke && remoteLaserStroke.active && remoteLaserStroke.points.length > 0) {
      const now = Date.now();
      list.push({
        id: remoteLaserStroke.id,
        colorKey: remoteLaserStroke.colorKey,
        points: remoteLaserStroke.points.map((pt) => ({ ...pt, timestampMs: now })),
        releasedAtMs: null,
      });
    }
    return list;
  }, [laserStrokes, activeLaserStroke, remoteLaserStroke]);
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
            {visibleObjects.filter(isImageObject).map((object) => (
              <Group key={object.id} opacity={object.isPrivate ? 0.82 : 1}>
                <ImageObjectView object={object} dark={dark} />
                {object.isPrivate && <PrivateBadgeLayer object={object} />}
              </Group>
            ))}
            {visibleObjects.filter(isGeometricObject).map((object) => (
              <Group key={object.id} opacity={object.isPrivate ? 0.82 : 1}>
                <GeometricObjectView object={object} dark={dark} />
                {object.isPrivate && <PrivateBadgeLayer object={object} />}
              </Group>
            ))}
            {visibleObjects.filter(isTableObject).map((object) => (
              <Group key={object.id} opacity={object.isPrivate ? 0.82 : 1}>
                <TableObjectView object={object} dark={dark} />
                {object.isPrivate && <PrivateBadgeLayer object={object} />}
              </Group>
            ))}
            {visibleObjects.filter(isMathObject).map((object) => (
              <Group key={object.id} opacity={object.isPrivate ? 0.82 : 1}>
                <MathObjectView
                  object={object}
                  dark={dark}
                  activeSpan={editingMathSpan?.objectId === object.id ? editingMathSpan.span : null}
                />
                {object.isPrivate && <PrivateBadgeLayer object={object} />}
              </Group>
            ))}
            {visibleObjects.filter(isFunctionPlotObject).map((object) => (
              <Group key={object.id} opacity={object.isPrivate ? 0.82 : 1}>
                <FunctionPlotLayer object={object} dark={dark} />
                {object.isPrivate && <PrivateBadgeLayer object={object} />}
              </Group>
            ))}
            {visibleObjects.filter(isChartObject).map((object) => (
              <Group key={object.id} opacity={object.isPrivate ? 0.82 : 1}>
                <ChartLayer object={object} dark={dark} />
                {object.isPrivate && <PrivateBadgeLayer object={object} />}
              </Group>
            ))}
            {visibleObjects.filter(isVoicePinObject).map((object) => (
              <Group key={object.id} opacity={object.isPrivate ? 0.82 : 1}>
                <VoicePinLayer
                  object={object}
                  dark={dark}
                  isPlaying={playingVoicePinId === object.id}
                />
                {object.isPrivate && <PrivateBadgeLayer object={object} />}
              </Group>
            ))}
            {visibleObjects.filter((o) => isTextualObject(o) && o.isPrivate).map((object) => (
              <PrivateBadgeLayer key={`private-badge-${object.id}`} object={object} />
            ))}
            {draftObject && <GeometricObjectView object={draftObject} dark={dark} />}
            {snapPortPoint && (
              <Circle
                cx={snapPortPoint.x}
                cy={snapPortPoint.y}
                r={8 / Math.max(viewport.scale, 0.5)}
                color="#0D9488"
                style="stroke"
                strokeWidth={2 / Math.max(viewport.scale, 0.5)}
              />
            )}
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

      {visibleObjects.filter(isTextualObject).map((object) => (
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

      {visibleObjects.filter(isTableObject).map((object) => (
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

      {visibleObjects
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
        Reveal tapes sit above native sticky/text views so they actually mask
        answers underneath until tapped, and selection frames sit on top of all.
      */}
      {(visibleObjects.some(isRevealTapeObject) || draftRevealTape) && (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          <Group transform={transform}>
            {visibleObjects.filter(isRevealTapeObject).map((object) => (
              <Group key={object.id} opacity={object.isPrivate ? 0.82 : 1}>
                <RevealTapeLayer object={object} dark={dark} />
                {object.isPrivate && <PrivateBadgeLayer object={object} />}
              </Group>
            ))}
            {draftRevealTape && (
              <Group opacity={0.85}>
                <RevealTapeLayer object={draftRevealTape} dark={dark} />
              </Group>
            )}
          </Group>
        </Canvas>
      )}

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

      {!hideHud && (
        <View style={styles.hud} pointerEvents="box-none">
          {snapReadout ? (
            <View
              style={[
                styles.snapBadge,
                compactHud && styles.snapBadgeCompact,
                { backgroundColor: theme.surface, borderColor: '#0D9488' },
              ]}
              pointerEvents="none"
            >
              <Text style={[styles.zoomText, compactHud && styles.zoomTextCompact, { color: '#0D9488' }]}>{snapReadout}</Text>
            </View>
          ) : null}
          <View style={[styles.zoomPill, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Zoom out"
              accessibilityState={{ disabled: viewport.scale <= MIN_ZOOM + 0.001 }}
              disabled={viewport.scale <= MIN_ZOOM + 0.001}
              hitSlop={compactHud ? { top: 6, bottom: 6, left: 2, right: 2 } : undefined}
              onPress={() => stepZoom(0.8)}
              style={({ pressed }) => [
                styles.zoomStepButton,
                compactHud && styles.zoomStepButtonCompact,
                viewport.scale <= MIN_ZOOM + 0.001 && { opacity: 0.35 },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.zoomStepGlyph, compactHud && styles.zoomStepGlyphCompact, { color: theme.foreground }]}>−</Text>
            </Pressable>
            <View
              style={[
                styles.zoomPercentWrap,
                compactHud && styles.zoomPercentWrapCompact,
                { borderLeftColor: theme.border, borderRightColor: theme.border },
              ]}
              pointerEvents="none"
              accessibilityLabel={`Zoom ${zoomLabel}`}
            >
              <Text style={[styles.zoomText, compactHud && styles.zoomTextCompact, { color: theme.foreground }]}>{zoomLabel}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Zoom in"
              accessibilityState={{ disabled: viewport.scale >= MAX_ZOOM - 0.001 }}
              disabled={viewport.scale >= MAX_ZOOM - 0.001}
              hitSlop={compactHud ? { top: 6, bottom: 6, left: 2, right: 2 } : undefined}
              onPress={() => stepZoom(1.25)}
              style={({ pressed }) => [
                styles.zoomStepButton,
                compactHud && styles.zoomStepButtonCompact,
                viewport.scale >= MAX_ZOOM - 0.001 && { opacity: 0.35 },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.zoomStepGlyph, compactHud && styles.zoomStepGlyphCompact, { color: theme.foreground }]}>+</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reset viewport"
              accessibilityHint="Returns the canvas to 100% zoom at the origin"
              hitSlop={compactHud ? { top: 6, bottom: 6, left: 2, right: 2 } : undefined}
              onPress={resetView}
              style={({ pressed }) => [
                styles.resetButton,
                compactHud && styles.resetButtonCompact,
                { borderLeftColor: theme.border },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.resetText, compactHud && styles.zoomTextCompact, { color: theme.foreground }]}>Reset</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
});
