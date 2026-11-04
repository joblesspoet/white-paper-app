import { Canvas, Group, Path, Rect, Skia } from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';

import { colors } from '../theme';

type Point = { x: number; y: number };
export type InkTool = 'select' | 'pen' | 'highlighter' | 'eraser' | 'text' | 'sticky';
export type InkStroke = { id: string; points: Point[]; color: string; width: number; opacity: number; tool: 'pen' | 'highlighter'; createdAt: string };
export type ViewportState = { x: number; y: number; scale: number };
export type CanvasObject = { id: string; type: 'text' | 'sticky'; text: string; x: number; y: number; color: string; backgroundColor?: string; fontSize: number; };
type CanvasViewportProps = {
  dark?: boolean;
  activeTool?: InkTool;
  color?: string;
  width?: number;
  opacity?: number;
  undoRequest?: number;
  redoRequest?: number;
  onViewportChange?: (viewport: ViewportState) => void;
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
  onDrawingStart?: () => void;
  objects?: CanvasObject[];
  onObjectCreate?: (type: 'text' | 'sticky', point: Point) => void;
};

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ERASE_RADIUS = 24;

export function CanvasViewport({ dark = false, activeTool = 'pen', color = colors.foreground, width = 4, opacity = 1, undoRequest = 0, redoRequest = 0, onViewportChange, onHistoryChange, onDrawingStart, objects = [], onObjectCreate }: CanvasViewportProps) {
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const scale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const [strokes, setStrokes] = useState<InkStroke[]>([]);
  const [redoStack, setRedoStack] = useState<InkStroke[]>([]);
  const [activeStroke, setActiveStroke] = useState<InkStroke | null>(null);

  useEffect(() => { onHistoryChange?.(strokes.length > 0, redoStack.length > 0); }, [strokes.length, redoStack.length, onHistoryChange]);
  useEffect(() => { if (undoRequest > 0) { setStrokes((current) => { const item = current[current.length - 1]; if (!item) return current; setRedoStack((redo) => [...redo, item]); return current.slice(0, -1); }); } }, [undoRequest]);
  useEffect(() => { if (redoRequest > 0) { setRedoStack((current) => { const item = current[current.length - 1]; if (!item) return current; setStrokes((existing) => [...existing, item]); return current.slice(0, -1); }); } }, [redoRequest]);

  const report = useCallback((x: number, y: number, nextScale: number) => onViewportChange?.({ x, y, scale: nextScale }), [onViewportChange]);
  const addPoint = useCallback((point: Point) => setActiveStroke((current) => current ? { ...current, points: [...current.points, point] } : current), []);
  const finishStroke = useCallback(() => setActiveStroke((current) => {
    if (!current || current.points.length < 2) return null;
    setStrokes((existing) => [...existing, current]);
    setRedoStack([]);
    return null;
  }), []);
  const eraseAt = useCallback((point: Point) => setStrokes((current) => {
    const remaining = current.filter((stroke) => !stroke.points.some((candidate) => Math.hypot(candidate.x - point.x, candidate.y - point.y) <= ERASE_RADIUS));
    if (remaining.length !== current.length) setRedoStack([]);
    return remaining;
  }), []);
  const noop = useCallback(() => undefined, []);
  const drawGesture = Gesture.Pan().enabled(activeTool === 'pen' || activeTool === 'highlighter').minDistance(0).onStart((event) => {
    const point = { x: (event.x - offsetX.value) / scale.value, y: (event.y - offsetY.value) / scale.value };
    runOnJS(onDrawingStart ?? noop)();
    runOnJS(setActiveStroke)({ id: `${Date.now()}-${Math.random()}`, points: [point], color, width, opacity: activeTool === 'highlighter' ? Math.min(opacity, 0.42) : opacity, tool: activeTool === 'highlighter' ? 'highlighter' : 'pen', createdAt: new Date().toISOString() });
  }).onUpdate((event) => { runOnJS(addPoint)({ x: (event.x - offsetX.value) / scale.value, y: (event.y - offsetY.value) / scale.value }); }).onEnd(() => { runOnJS(finishStroke)(); });
  const eraseGesture = Gesture.Pan().enabled(activeTool === 'eraser').minDistance(0).onStart((event) => { runOnJS(eraseAt)({ x: (event.x - offsetX.value) / scale.value, y: (event.y - offsetY.value) / scale.value }); }).onUpdate((event) => { runOnJS(eraseAt)({ x: (event.x - offsetX.value) / scale.value, y: (event.y - offsetY.value) / scale.value }); });
  const panGesture = Gesture.Pan().enabled(false).onStart(() => { startX.value = offsetX.value; startY.value = offsetY.value; }).onChange((event) => { offsetX.value = startX.value + event.translationX; offsetY.value = startY.value + event.translationY; runOnJS(report)(offsetX.value, offsetY.value, scale.value); });
  const pinchGesture = Gesture.Pinch().onStart(() => { startScale.value = scale.value; }).onChange((event) => { scale.value = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, startScale.value * event.scale)); runOnJS(report)(offsetX.value, offsetY.value, scale.value); });
  const objectTap = Gesture.Tap().enabled((activeTool === 'text' || activeTool === 'sticky') && !!onObjectCreate).onEnd((event) => { if (onObjectCreate) runOnJS(onObjectCreate)(activeTool as 'text' | 'sticky', { x: (event.x - offsetX.value) / scale.value, y: (event.y - offsetY.value) / scale.value }); });
  const gesture = Gesture.Simultaneous(activeTool === 'eraser' ? eraseGesture : (activeTool === 'text' || activeTool === 'sticky' ? objectTap : drawGesture), pinchGesture);
  const canvasColor = dark ? colors.darkBackground : colors.background;
  const renderedStrokes = useMemo(() => [...strokes, ...(activeStroke ? [activeStroke] : [])], [strokes, activeStroke]);

  return <View style={styles.root} accessibilityLabel="Interactive canvas viewport"><GestureDetector gesture={gesture}><Canvas style={StyleSheet.absoluteFill} accessibilityLabel="Canvas surface"><Group transform={[{ translateX: offsetX.value }, { translateY: offsetY.value }, { scale: scale.value }]}><Rect x={-2000} y={-2000} width={4000} height={4000} color={canvasColor} />{renderedStrokes.map((stroke) => <Path key={stroke.id} path={pathFromPoints(stroke.points)} color={stroke.color} opacity={stroke.opacity} style="stroke" strokeWidth={stroke.width} strokeCap="round" strokeJoin="round" />)}</Group></Canvas></GestureDetector>{objects.map((object) => <View key={object.id} pointerEvents="none" style={[styles.object, { left: object.x * scale.value + offsetX.value, top: object.y * scale.value + offsetY.value, backgroundColor: object.backgroundColor ?? 'transparent' }]}><Text style={{ color: object.color, fontSize: object.fontSize * scale.value }}>{object.text || (object.type === 'sticky' ? ' ' : 'Text')}</Text></View>)}</View>;
}

function pathFromPoints(points: Point[]) { const first = points[0]; if (!first) return Skia.Path.Make(); return Skia.Path.MakeFromSVGString([`M ${first.x} ${first.y}`, ...points.slice(1).map((point) => `L ${point.x} ${point.y}`)].join(' ')) ?? Skia.Path.Make(); }
export function screenToCanvas(point: Point, viewport: ViewportState): Point { return { x: (point.x - viewport.x) / viewport.scale, y: (point.y - viewport.y) / viewport.scale }; }
export function canvasToScreen(point: Point, viewport: ViewportState): Point { return { x: point.x * viewport.scale + viewport.x, y: point.y * viewport.scale + viewport.y }; }
const styles = StyleSheet.create({ root: { flex: 1, overflow: 'hidden' }, object: { position: 'absolute', minWidth: 48, minHeight: 32, padding: 8 } });
