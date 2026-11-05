import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, useColorScheme, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBoards } from '../src/board-context';
import type { FreehandTool } from '../src/canvas/ink';
import { CanvasViewport, type CanvasObject, type InkTool } from '../src/components/CanvasViewport';
import {
  ChevronRightIcon,
  EraserIcon,
  HighlighterIcon,
  MoreIcon,
  PenIcon,
  SelectIcon,
  StickyIcon,
  TextIcon,
} from '../src/components/icons';
import { InkOptionsSheet, type InkSheetTool } from '../src/components/InkOptionsSheet';
import { colors, darkColors, radii, spacing, touchTarget, typography, type ThemeColors } from '../src/theme';

const TOOLS = [
  { tool: 'select', label: 'Select', Icon: SelectIcon },
  { tool: 'text', label: 'Text', Icon: TextIcon },
  { tool: 'sticky', label: 'Sticky note', Icon: StickyIcon },
  { tool: 'pen', label: 'Pen', Icon: PenIcon },
  { tool: 'highlighter', label: 'Highlighter', Icon: HighlighterIcon },
  { tool: 'eraser', label: 'Eraser', Icon: EraserIcon },
] as const satisfies ReadonlyArray<{ tool: InkTool; label: string; Icon: typeof PenIcon }>;

export default function BoardEditorScreen() {
  const router = useRouter();
  const { boardId } = useLocalSearchParams<{ boardId?: string }>();
  const { boards, updateTitle } = useBoards();
  const board = boards.find((item) => item.id === boardId);
  const [title, setTitle] = useState(board?.title ?? 'Untitled board');
  useEffect(() => { if (board) setTitle(board.title); }, [board]);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const theme = useColorScheme() === 'dark' ? darkColors : colors;
  const tablet = width >= 768;
  const [activeTool, setActiveTool] = useState<InkTool>('select');
  const [objects, setObjects] = useState<CanvasObject[]>([]);
  const [editingObject, setEditingObject] = useState<CanvasObject | null>(null);
  const [color, setColor] = useState<string>(theme.foreground);
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [opacity, setOpacity] = useState(1);
  const [eraserRadius, setEraserRadius] = useState(24);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [undoRequest, setUndoRequest] = useState(0);
  const [redoRequest, setRedoRequest] = useState(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [hasInk, setHasInk] = useState(false);

  // Keep the default ink legible when the system theme changes without
  // overwriting a color the user picked.
  useEffect(() => {
    setColor((current) => current === colors.foreground || current === colors.darkForeground ? theme.foreground : current);
  }, [theme.foreground]);

  const pressTool = useCallback((tool: InkTool) => {
    if (tool === 'select' || tool === 'text' || tool === 'sticky') {
      setActiveTool(tool);
      setOptionsVisible(false);
      return;
    }
    if (activeTool === tool) {
      setOptionsVisible((visible) => !visible);
      return;
    }
    setActiveTool(tool);
    setOptionsVisible(true);
  }, [activeTool]);

  const selectInkTool = useCallback((tool: FreehandTool) => {
    setActiveTool(tool);
    setOptionsVisible(true);
  }, []);

  const moveObject = useCallback((id: string, point: { x: number; y: number }) => setObjects((current) => current.map((item) => item.id === id ? { ...item, x: point.x - item.width / 2, y: point.y - item.height / 2 } : item)), []);
  const createObject = useCallback((type: 'text' | 'sticky', point: { x: number; y: number }) => {
    const object: CanvasObject = {
      id: `${type}-${Date.now()}`,
      type,
      text: '',
      x: point.x,
      y: point.y,
      width: type === 'sticky' ? 180 : 160,
      height: type === 'sticky' ? 160 : 48,
      rotation: 0,
      color: theme.foreground,
      backgroundColor: type === 'sticky' ? '#FDE68A' : undefined,
      fontSize: type === 'sticky' ? 16 : 24,
    };
    setObjects((current) => [...current, object]);
    setEditingObject(object);
  }, [theme.foreground]);

  const sheetTool: InkSheetTool = activeTool === 'eraser' ? 'eraser' : activeTool === 'highlighter' ? 'highlighter' : 'pen';
  const optionsBottom = tablet ? spacing.md : 84 + Math.max(spacing.sm, insets.bottom);
  const showGuidance = !hasInk && objects.length === 0;

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.topBar, { borderBottomColor: theme.border }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to boards" onPress={() => router.back()} style={styles.iconButton}>
          <ChevronRightIcon color={theme.foreground} />
        </Pressable>
        <TextInput accessibilityLabel="Board title" value={title} onChangeText={(value) => { setTitle(value); if (boardId) updateTitle(boardId, value); }} style={[styles.title, { color: theme.foreground }]} />
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Undo" accessibilityState={{ disabled: !canUndo }} disabled={!canUndo} onPress={() => setUndoRequest((value) => value + 1)} style={styles.action}><Text style={[styles.actionText, { color: theme.foreground }]}>↶</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Redo" accessibilityState={{ disabled: !canRedo }} disabled={!canRedo} onPress={() => setRedoRequest((value) => value + 1)} style={styles.action}><Text style={[styles.actionText, { color: theme.foreground }]}>↷</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="More board options" style={styles.iconButton}><MoreIcon color={theme.foreground} /></Pressable>
        </View>
      </View>

      <View style={styles.workspace}>
        {tablet && <ToolRail theme={theme} activeTool={activeTool} onToolPress={pressTool} />}
        <View style={[styles.canvas, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <CanvasViewport
            dark={useColorScheme() === 'dark'}
            initialViewport={{ x: 150, y: -80, scale: 2 }}
            activeTool={activeTool}
            color={color}
            width={strokeWidth}
            opacity={opacity}
            eraserRadius={eraserRadius}
            undoRequest={undoRequest}
            redoRequest={redoRequest}
            objects={objects}
            onObjectCreate={createObject}
            onObjectMove={moveObject}
            onHistoryChange={(undo, redo) => { setCanUndo(undo); setCanRedo(redo); }}
            onInkChange={setHasInk}
          />
          {showGuidance && (
            <View pointerEvents="none" style={styles.canvasGuidance}>
              <Text style={[styles.canvasTitle, { color: theme.foreground }]}>Your canvas is ready</Text>
              <Text style={[styles.canvasBody, { color: theme.foreground }]}>Pick a pen, highlighter, or eraser below.</Text>
            </View>
          )}
          {editingObject && (
            <TextInput
              autoFocus
              accessibilityLabel={`${editingObject.type === 'sticky' ? 'Sticky note' : 'Canvas text'} editor`}
              value={editingObject.text}
              onChangeText={(text) => { setEditingObject({ ...editingObject, text }); setObjects((current) => current.map((item) => item.id === editingObject.id ? { ...item, text } : item)); }}
              onBlur={() => { if (!editingObject.text.trim()) setObjects((current) => current.filter((item) => item.id !== editingObject.id)); setEditingObject(null); }}
              onSubmitEditing={() => { if (!editingObject.text.trim()) setObjects((current) => current.filter((item) => item.id !== editingObject.id)); setEditingObject(null); }}
              placeholder={editingObject.type === 'sticky' ? 'Write a note' : 'Type something'}
              style={[styles.objectEditor, { color: theme.foreground, backgroundColor: editingObject.backgroundColor ?? theme.surface }]}
            />
          )}
        </View>
      </View>

      {optionsVisible && (
        <InkOptionsSheet
          theme={theme}
          tool={sheetTool}
          color={color}
          width={strokeWidth}
          opacity={opacity}
          eraserRadius={eraserRadius}
          bottomOffset={optionsBottom}
          onToolChange={selectInkTool}
          onColorChange={setColor}
          onWidthChange={setStrokeWidth}
          onOpacityChange={setOpacity}
          onEraserRadiusChange={setEraserRadius}
          onClose={() => setOptionsVisible(false)}
        />
      )}
      {!tablet && <ToolDock theme={theme} bottom={insets.bottom} activeTool={activeTool} onToolPress={pressTool} />}
    </View>
  );
}

function ToolRail({ theme, activeTool, onToolPress }: { theme: ThemeColors; activeTool: InkTool; onToolPress: (tool: InkTool) => void }) {
  return (
    <View style={[styles.rail, { borderRightColor: theme.border }]}>
      {TOOLS.map((definition) => (
        <Tool key={definition.tool} theme={theme} definition={definition} selected={activeTool === definition.tool} onPress={() => onToolPress(definition.tool)} />
      ))}
    </View>
  );
}

function ToolDock({ theme, bottom, activeTool, onToolPress }: { theme: ThemeColors; bottom: number; activeTool: InkTool; onToolPress: (tool: InkTool) => void }) {
  return (
    <View style={[styles.dock, { backgroundColor: theme.surface, borderColor: theme.border, paddingBottom: Math.max(spacing.sm, bottom) }]}>
      {TOOLS.map((definition) => (
        <Tool key={definition.tool} theme={theme} definition={definition} selected={activeTool === definition.tool} onPress={() => onToolPress(definition.tool)} />
      ))}
    </View>
  );
}

function Tool({ theme, definition, onPress, selected }: { theme: ThemeColors; definition: typeof TOOLS[number]; onPress: () => void; selected: boolean }) {
  const { Icon, label, tool } = definition;
  const color = selected ? theme.primary : theme.foreground;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={tool === 'pen' || tool === 'highlighter' || tool === 'eraser' ? 'Opens ink options when selected again' : undefined}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.tool, pressed && styles.toolPressed]}
    >
      <View style={[styles.toolIconWrap, selected && { backgroundColor: theme.primary + '1F', borderColor: theme.primary }]}>
        <Icon size={22} color={color} />
      </View>
      <Text style={[styles.toolLabel, { color }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, borderBottomWidth: 1, gap: spacing.sm },
  iconButton: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '180deg' }] },
  title: { flex: 1, ...typography.bodyStrong, paddingVertical: spacing.sm },
  actions: { flexDirection: 'row', alignItems: 'center' },
  action: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: 28 },
  workspace: { flex: 1, flexDirection: 'row' },
  rail: { width: 84, borderRightWidth: 1, alignItems: 'center', paddingTop: spacing.md, gap: spacing.xs },
  canvas: { flex: 1, margin: spacing.md, borderWidth: 1, borderRadius: radii.md, overflow: 'hidden' },
  canvasGuidance: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg },
  canvasTitle: { ...typography.subtitle },
  canvasBody: { ...typography.body, opacity: 0.7, textAlign: 'center' },
  dock: { minHeight: 76, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', borderTopWidth: 1, paddingTop: spacing.sm },
  tool: { minWidth: touchTarget, minHeight: touchTarget, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2, gap: 2 },
  toolIconWrap: { width: 34, height: 30, borderWidth: 1, borderColor: 'transparent', borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  toolLabel: { ...typography.caption, fontSize: 11, textAlign: 'center' },
  toolPressed: { opacity: 0.65 },
  objectEditor: { position: 'absolute', left: spacing.md, right: spacing.md, top: spacing.md, minHeight: 52, padding: spacing.sm, borderRadius: radii.sm, zIndex: 10 },
});
