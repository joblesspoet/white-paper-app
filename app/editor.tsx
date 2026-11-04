import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useBoards } from '../src/board-context';
import { Pressable, StyleSheet, Text, TextInput, useColorScheme, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronRightIcon, MoreIcon } from '../src/components/icons';
import { CanvasViewport, type InkTool } from '../src/components/CanvasViewport';
import { colors, darkColors, radii, spacing, touchTarget, typography } from '../src/theme';

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
  const [objects, setObjects] = useState<import('../src/components/CanvasViewport').CanvasObject[]>([]);
  const [editingObject, setEditingObject] = useState<import('../src/components/CanvasViewport').CanvasObject | null>(null);
  const [color, setColor] = useState<string>(colors.foreground);
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [opacity, setOpacity] = useState(1);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [undoRequest, setUndoRequest] = useState(0);
  const [redoRequest, setRedoRequest] = useState(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const selectTool = useCallback((tool: InkTool) => { setActiveTool(tool); setOptionsVisible(false); }, []);
  const toggleToolOptions = useCallback((tool: InkTool) => { if (tool === 'text' || tool === 'sticky') { setActiveTool(tool); setOptionsVisible(false); return; } if (activeTool === tool) setOptionsVisible((visible) => !visible); else { setActiveTool(tool); setOptionsVisible(true); } }, [activeTool]);
  const moveObject = useCallback((id: string, point: { x: number; y: number }) => setObjects((current) => current.map((item) => item.id === id ? { ...item, x: point.x - item.width / 2, y: point.y - item.height / 2 } : item)), []);
  const createObject = useCallback((type: 'text' | 'sticky', point: { x: number; y: number }) => { const object = { id: `${type}-${Date.now()}`, type, text: '', x: point.x, y: point.y, width: type === 'sticky' ? 180 : 160, height: type === 'sticky' ? 160 : 48, rotation: 0, color: theme.foreground, backgroundColor: type === 'sticky' ? '#FDE68A' : undefined, fontSize: type === 'sticky' ? 16 : 24 }; setObjects((current) => [...current, object]); setEditingObject(object); }, [theme.foreground]);

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
        {tablet && <ToolRail theme={theme} activeTool={activeTool} onToolPress={toggleToolOptions} />}
        <View style={[styles.canvas, { backgroundColor: theme.surface, borderColor: theme.border }]}> 
          <CanvasViewport dark={useColorScheme() === 'dark'} activeTool={activeTool} color={color} width={strokeWidth} opacity={opacity} undoRequest={undoRequest} redoRequest={redoRequest} objects={objects} onObjectCreate={createObject} onObjectMove={moveObject} onHistoryChange={(undo, redo) => { setCanUndo(undo); setCanRedo(redo); }} onDrawingStart={() => setHasInk(true)} />
          {!hasInk && objects.length === 0 && <View pointerEvents="none" style={styles.canvasGuidance}><Text style={[styles.canvasTitle, { color: theme.foreground }]}>Your canvas is ready</Text><Text style={[styles.canvasBody, { color: theme.foreground }]}>Use the tools below to start creating.</Text></View>}
          {editingObject && <TextInput autoFocus accessibilityLabel={`${editingObject.type === 'sticky' ? 'Sticky note' : 'Canvas text'} editor`} value={editingObject.text} onChangeText={(text) => { setEditingObject({ ...editingObject, text }); setObjects((current) => current.map((item) => item.id === editingObject.id ? { ...item, text } : item)); }} onBlur={() => { if (!editingObject.text.trim()) setObjects((current) => current.filter((item) => item.id !== editingObject.id)); setEditingObject(null); }} onSubmitEditing={() => { if (!editingObject.text.trim()) setObjects((current) => current.filter((item) => item.id !== editingObject.id)); setEditingObject(null); }} placeholder={editingObject.type === 'sticky' ? 'Write a note' : 'Type something'} style={[styles.objectEditor, { color: theme.foreground, backgroundColor: editingObject.backgroundColor ?? theme.surface }]} />}
        </View>
      </View>

      {optionsVisible && <ToolOptions theme={theme} activeTool={activeTool} color={color} width={strokeWidth} opacity={opacity} onToolChange={selectTool} onColorChange={setColor} onWidthChange={setStrokeWidth} onOpacityChange={setOpacity} onClose={() => setOptionsVisible(false)} />}
      {!tablet && <ToolDock theme={theme} bottom={insets.bottom} activeTool={activeTool} onToolPress={toggleToolOptions} />}
    </View>
  );
}

function ToolRail({ theme, activeTool, onToolPress }: { theme: { foreground: string; border: string }; activeTool: InkTool; onToolPress: (tool: InkTool) => void }) {
  return <View style={[styles.rail, { borderRightColor: theme.border }]}><Tool theme={theme} label="Select" icon="↖" selected={activeTool === 'select'} /><Tool theme={theme} label="Text" icon="T" selected={activeTool === 'text'} onPress={() => onToolPress('text')} /><Tool theme={theme} label="Sticky note" icon="□" selected={activeTool === 'sticky'} onPress={() => onToolPress('sticky')} /><Tool theme={theme} label="Pen" icon="✎" selected={activeTool === 'pen'} onPress={() => onToolPress('pen')} /><Tool theme={theme} label="Highlighter" icon="▰" selected={activeTool === 'highlighter'} onPress={() => onToolPress('highlighter')} /><Tool theme={theme} label="Eraser" icon="⌫" selected={activeTool === 'eraser'} onPress={() => onToolPress('eraser')} /></View>;
}
function ToolDock({ theme, bottom, activeTool, onToolPress }: { theme: { foreground: string; surface: string; border: string }; bottom: number; activeTool: InkTool; onToolPress: (tool: InkTool) => void }) {
  return <View style={[styles.dock, { backgroundColor: theme.surface, borderColor: theme.border, paddingBottom: Math.max(spacing.sm, bottom) }]}><Tool theme={theme} label="Select" icon="↖" selected={activeTool === 'select'} /><Tool theme={theme} label="Text" icon="T" selected={activeTool === 'text'} onPress={() => onToolPress('text')} /><Tool theme={theme} label="Sticky note" icon="□" selected={activeTool === 'sticky'} onPress={() => onToolPress('sticky')} /><Tool theme={theme} label="Pen" icon="✎" selected={activeTool === 'pen'} onPress={() => onToolPress('pen')} /><Tool theme={theme} label="Highlighter" icon="▰" selected={activeTool === 'highlighter'} onPress={() => onToolPress('highlighter')} /><Tool theme={theme} label="Eraser" icon="⌫" selected={activeTool === 'eraser'} onPress={() => onToolPress('eraser')} /></View>;
}
function Tool({ theme, label, icon, onPress, selected = false }: { theme: { foreground: string }; label: string; icon: string; onPress?: () => void; selected?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.tool, selected && styles.toolSelected, pressed && styles.toolPressed]}><Text style={[styles.toolIcon, { color: theme.foreground }]}>{icon}</Text><Text style={[styles.toolLabel, { color: theme.foreground }]}>{label}</Text></Pressable>;
}
function ToolOptions({ theme, activeTool, color, width, opacity, onToolChange, onColorChange, onWidthChange, onOpacityChange, onClose }: { theme: { foreground: string; surface: string; border: string; primary: string }; activeTool: InkTool; color: string; width: number; opacity: number; onToolChange: (tool: InkTool) => void; onColorChange: (color: string) => void; onWidthChange: (width: number) => void; onOpacityChange: (opacity: number) => void; onClose: () => void }) {
  const palette = [theme.foreground, theme.primary, '#EA580C', '#2563EB', '#DC2626'];
  return <View style={[styles.options, { backgroundColor: theme.surface, borderColor: theme.border }]}><View style={styles.optionsHeader}><Text style={[styles.optionsTitle, { color: theme.foreground }]}>{activeTool === 'eraser' ? 'Eraser options' : activeTool === 'highlighter' ? 'Highlighter options' : 'Pen options'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Done with tool options" onPress={onClose} style={styles.done}><Text style={[styles.doneText, { color: theme.primary }]}>Done</Text></Pressable></View>{activeTool !== 'eraser' && <><View style={styles.choices}><Pressable accessibilityRole="button" accessibilityLabel="Pen tool" onPress={() => onToolChange('pen')}><Text style={{ color: theme.foreground }}>Pen</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Highlighter tool" onPress={() => onToolChange('highlighter')}><Text style={{ color: theme.foreground }}>Highlighter</Text></Pressable></View><Text style={[styles.optionLabel, { color: theme.foreground }]}>Color</Text><View style={styles.swatches}>{palette.map((item) => <Pressable key={item} accessibilityRole="radio" accessibilityLabel={`Color ${item}`} accessibilityState={{ selected: color === item }} onPress={() => onColorChange(item)} style={[styles.swatch, { backgroundColor: item }, color === item && { borderColor: theme.primary, borderWidth: 3 }]} />)}</View><Text style={[styles.optionLabel, { color: theme.foreground }]}>Width</Text><View style={styles.choices}>{[2, 4, 8, 12].map((item) => <Pressable key={item} accessibilityRole="radio" accessibilityLabel={`Stroke width ${item}`} accessibilityState={{ selected: width === item }} onPress={() => onWidthChange(item)} style={[styles.choice, { borderColor: width === item ? theme.primary : theme.border }]}><Text style={{ color: theme.foreground }}>{item}</Text></Pressable>)}</View><Text style={[styles.optionLabel, { color: theme.foreground }]}>Opacity</Text><View style={styles.choices}>{[0.35, 0.6, 1].map((item) => <Pressable key={item} accessibilityRole="radio" accessibilityLabel={`Opacity ${Math.round(item * 100)} percent`} accessibilityState={{ selected: opacity === item }} onPress={() => onOpacityChange(item)} style={[styles.choice, { borderColor: opacity === item ? theme.primary : theme.border }]}><Text style={{ color: theme.foreground }}>{Math.round(item * 100)}%</Text></Pressable>)}</View></>}</View>;
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
  rail: { width: 80, borderRightWidth: 1, alignItems: 'center', paddingTop: spacing.md, gap: spacing.sm },
  canvas: { flex: 1, margin: spacing.md, borderWidth: 1, borderRadius: radii.md, overflow: 'hidden' },
  canvasGuidance: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  canvasTitle: { ...typography.subtitle },
  canvasBody: { ...typography.body, opacity: 0.7 },
  dock: { minHeight: 76, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', borderTopWidth: 1, paddingTop: spacing.sm },
  tool: { minWidth: touchTarget, minHeight: touchTarget, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm },
  toolIcon: { fontSize: 22, lineHeight: 26 },
  toolLabel: { ...typography.caption },
  toolPressed: { opacity: 0.65 },
  toolSelected: { backgroundColor: colors.muted, borderRadius: radii.sm },
  options: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: 92, borderWidth: 1, borderRadius: radii.md, padding: spacing.md, gap: spacing.sm },
  optionsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  optionsTitle: { ...typography.bodyStrong },
  done: { minHeight: touchTarget, justifyContent: 'center', paddingHorizontal: spacing.sm },
  doneText: { ...typography.bodyStrong },
  optionLabel: { ...typography.caption, marginTop: spacing.xs },
  swatches: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  swatch: { width: touchTarget - 8, height: touchTarget - 8, borderRadius: touchTarget, borderColor: 'transparent', borderWidth: 1 },
  choices: { flexDirection: 'row', gap: spacing.sm },
  choice: { minWidth: touchTarget, minHeight: touchTarget, borderWidth: 1, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  objectEditor: { position: 'absolute', left: spacing.md, right: spacing.md, top: spacing.md, minHeight: 52, padding: spacing.sm, borderRadius: radii.sm, zIndex: 10 },
});
