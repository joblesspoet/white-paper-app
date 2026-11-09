import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useReducer, useRef, useState, type ComponentRef } from 'react';
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBoards } from '../src/board-context';
import {
  DEFAULT_STICKY_COLOR,
  DEFAULT_STICKY_FONT_SIZE,
  DEFAULT_TEXT_COLOR,
  DEFAULT_TEXT_FONT_SIZE,
  OBJECT_PADDING,
  createDocumentHistory,
  createStickyObject,
  createTextObject,
  documentHasContent,
  documentReducer,
  duplicateObject,
  editingCommit,
  findObject,
  isTextualObject,
  keyboardOverlap,
  keepObjectAboveKeyboard,
  objectFill,
  objectScreenRect,
  objectTextColor,
  textColorKeyForValue,
  textColorValue,
  textLineHeight,
  withObjectStyle,
  withObjectText,
  type CanvasObject,
  type DocumentCommand,
  type ObjectStylePatch,
  type TextSlant,
  type TextWeight,
} from '../src/canvas/document';
import {
  canRedo as historyCanRedo,
  canUndo as historyCanUndo,
  nextRedoLabel,
  nextUndoLabel,
} from '../src/canvas/history';
import type { FreehandTool } from '../src/canvas/ink';
import { canvasRectToScreen, selectionActionRail, selectionBounds } from '../src/canvas/selection';
import type { Point, Viewport } from '../src/canvas/viewport';
import { CanvasViewport, type InkTool, type ViewportRequest } from '../src/components/CanvasViewport';
import {
  ChevronRightIcon,
  DuplicateIcon,
  EditIcon,
  EraserIcon,
  HighlighterIcon,
  MoreIcon,
  ConnectorIcon,
  PenIcon,
  ShapeIcon,
  RedoIcon,
  SelectIcon,
  StickyIcon,
  StyleIcon,
  TextIcon,
  TrashIcon,
  UndoIcon,
} from '../src/components/icons';
import { InkOptionsSheet, type InkSheetTool } from '../src/components/InkOptionsSheet';
import { ObjectOptionsSheet } from '../src/components/ObjectOptionsSheet';
import { ShapeOptionsSheet } from '../src/components/ShapeOptionsSheet';
import { colors, darkColors, radii, spacing, touchTarget, typography, type ThemeColors } from '../src/theme';

const TOOLS = [
  { tool: 'select', label: 'Select', Icon: SelectIcon },
  { tool: 'text', label: 'Text', Icon: TextIcon },
  { tool: 'sticky', label: 'Sticky note', Icon: StickyIcon },
  { tool: 'shape', label: 'Shape', Icon: ShapeIcon },
  { tool: 'connector', label: 'Connector', Icon: ConnectorIcon },
  { tool: 'pen', label: 'Pen', Icon: PenIcon },
  { tool: 'highlighter', label: 'Highlighter', Icon: HighlighterIcon },
  { tool: 'eraser', label: 'Eraser', Icon: EraserIcon },
] as const satisfies ReadonlyArray<{ tool: InkTool; label: string; Icon: typeof PenIcon }>;

/** Zoomed in enough that ink is comfortable under a finger. */
const INITIAL_VIEWPORT: Viewport = { x: 150, y: -80, scale: 2 };
/** How long viewport reports may be batched before the editor re-renders. */
const VIEWPORT_RENDER_INTERVAL = 60;

/** The object being edited, plus whether it still needs inserting into the board. */
type Editing = { object: CanvasObject; isNew: boolean };

export default function BoardEditorScreen() {
  const router = useRouter();
  const { boardId } = useLocalSearchParams<{ boardId?: string }>();
  const { boards, updateTitle } = useBoards();
  const board = boards.find((item) => item.id === boardId);
  const [title, setTitle] = useState(board?.title ?? 'Untitled board');
  useEffect(() => { if (board) setTitle(board.title); }, [board]);
  const insets = useSafeAreaInsets();
  const { width, height: windowHeight } = useWindowDimensions();
  const dark = useColorScheme() === 'dark';
  const theme = dark ? darkColors : colors;
  const tablet = width >= 768;

  const [history, dispatch] = useReducer(documentReducer, createDocumentHistory());
  const document = history.present;
  const canUndo = historyCanUndo(history);
  const canRedo = historyCanRedo(history);
  const undoLabel = nextUndoLabel(history);
  const redoLabel = nextRedoLabel(history);

  const [activeTool, setActiveTool] = useState<InkTool>('select');
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);
  const [stylingObjectId, setStylingObjectId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const editingRef = useRef<Editing | null>(null);

  const [textColorKey, setTextColorKey] = useState<string>(DEFAULT_TEXT_COLOR);
  const [textSize, setTextSize] = useState(DEFAULT_TEXT_FONT_SIZE);
  const [textBold, setTextBold] = useState(false);
  const [textItalic, setTextItalic] = useState(false);
  const [stickyColorKey, setStickyColorKey] = useState<string>(DEFAULT_STICKY_COLOR);
  const [stickySize, setStickySize] = useState(DEFAULT_STICKY_FONT_SIZE);
  const [stickyBold, setStickyBold] = useState(false);
  const [stickyItalic, setStickyItalic] = useState(false);
  const [shapeKind, setShapeKind] = useState<'rectangle' | 'ellipse' | 'line'>('rectangle');
  const [shapeColorKey, setShapeColorKey] = useState<string>(DEFAULT_TEXT_COLOR);
  const [shapeFillKey, setShapeFillKey] = useState<string | null>(null);
  const [shapeStrokeWidth, setShapeStrokeWidth] = useState(4);
  const [connectorStyle, setConnectorStyle] = useState<'line' | 'arrow' | 'elbow'>('arrow');
  const [connectorColorKey, setConnectorColorKey] = useState<string>(DEFAULT_TEXT_COLOR);
  const [connectorStrokeWidth, setConnectorStrokeWidth] = useState(4);

  const [color, setColor] = useState<string>(theme.foreground);
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [opacity, setOpacity] = useState(1);
  const [eraserRadius, setEraserRadius] = useState(24);
  const [inkOptionsVisible, setInkOptionsVisible] = useState(false);
  const [objectOptionsVisible, setObjectOptionsVisible] = useState(false);
  const [shapeOptionsVisible, setShapeOptionsVisible] = useState(false);

  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [canvasRect, setCanvasRect] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [sheetHeight, setSheetHeight] = useState(0);
  const canvasRef = useRef<ComponentRef<typeof View> | null>(null);

  // The live viewport lives in CanvasViewport's shared values. The editor keeps
  // an exact copy for keyboard maths and a batched copy for the text overlay.
  const viewportLive = useRef<Viewport>(INITIAL_VIEWPORT);
  const [viewport, setViewport] = useState<Viewport>(INITIAL_VIEWPORT);
  const viewportFlushedAt = useRef(0);
  const viewportTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [viewportRequest, setViewportRequest] = useState<ViewportRequest | null>(null);

  // Keep the selected ink colour readable when the system theme changes without
  // overwriting a custom colour that is not part of the palette.
  useEffect(() => {
    setColor((current) => {
      const key = textColorKeyForValue(current);
      return key ? textColorValue(key, dark) : current;
    });
  }, [dark]);

  useEffect(() => () => {
    if (viewportTimer.current) clearTimeout(viewportTimer.current);
  }, []);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', (event) => setKeyboardHeight(event.endCoordinates.height));
    const shown = Keyboard.addListener('keyboardDidShow', (event) => setKeyboardHeight(event.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKeyboardHeight(0));
    const hidden = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => {
      show.remove();
      shown.remove();
      hide.remove();
      hidden.remove();
    };
  }, []);

  const reportViewport = useCallback((next: Viewport) => {
    viewportLive.current = next;
    const now = Date.now();
    if (now - viewportFlushedAt.current >= VIEWPORT_RENDER_INTERVAL) {
      viewportFlushedAt.current = now;
      setViewport(next);
      return;
    }
    // A trailing update keeps the overlay aligned with the final gesture value.
    if (viewportTimer.current) return;
    viewportTimer.current = setTimeout(() => {
      viewportTimer.current = null;
      viewportFlushedAt.current = Date.now();
      setViewport(viewportLive.current);
    }, VIEWPORT_RENDER_INTERVAL);
  }, []);

  const requestViewport = useCallback((next: Viewport) => {
    viewportLive.current = next;
    setViewport(next);
    setViewportRequest((current) => ({ key: (current?.key ?? 0) + 1, viewport: next }));
  }, []);

  const measureCanvas = useCallback(() => {
    canvasRef.current?.measureInWindow((x, y, measuredWidth, measuredHeight) => {
      setCanvasRect({ x, y, width: measuredWidth, height: measuredHeight });
    });
  }, []);

  const setEditingState = useCallback((next: Editing | null) => {
    editingRef.current = next;
    setEditing(next);
  }, []);

  const runCommand = useCallback((command: DocumentCommand, transient?: boolean) => {
    dispatch({ type: 'command', command, transient });
  }, []);
  const measureObject = useCallback((id: string, height: number) => {
    dispatch({ type: 'measure', id, height });
  }, []);
  const commitPending = useCallback(() => dispatch({ type: 'commit' }), []);
  const closeObjectOptions = useCallback(() => setObjectOptionsVisible(false), []);

  /**
   * One commit path for every exit: Done, outside tap, tool change, back, and
   * blur. An empty object is discarded rather than committed, so tapping the
   * canvas and changing your mind leaves no object and no undo step behind.
   */
  const commitEditing = useCallback(() => {
    const current = editingRef.current;
    if (!current) return;
    editingRef.current = null;
    setEditing(null);
    setObjectOptionsVisible(false);
    setSheetHeight(0);
    Keyboard.dismiss();
    const command = editingCommit(current.object, current.isNew);
    if (!command) {
      setSelectedObjectIds([]);
      return;
    }
    dispatch({ type: 'command', command });
    setSelectedObjectIds(command.type === 'object.delete' ? [] : [current.object.id]);
  }, []);

  const updateDraft = useCallback((patch: { text?: string; colorKey?: string; fontSize?: number; fontWeight?: TextWeight; fontStyle?: TextSlant }) => {
    const current = editingRef.current;
    if (!current) return;
    let object = current.object;
    if (patch.text !== undefined) object = withObjectText(object, patch.text);
    object = withObjectStyle(object, {
      colorKey: patch.colorKey,
      fontSize: patch.fontSize,
      fontWeight: patch.fontWeight,
      fontStyle: patch.fontStyle,
    });
    setEditingState({ object, isNew: current.isNew });
  }, [setEditingState]);

  const startNewObject = useCallback((type: 'text' | 'sticky', point: Point) => {
    // The first tap outside an open editor commits it instead of adding another object.
    if (editingRef.current) {
      commitEditing();
      return;
    }
    const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const object = type === 'sticky'
      ? createStickyObject({
          id,
          point,
          colorKey: stickyColorKey,
          fontSize: stickySize,
          fontWeight: stickyBold ? 'bold' : 'normal',
          fontStyle: stickyItalic ? 'italic' : 'normal',
        })
      : createTextObject({
          id,
          point,
          colorKey: textColorKey,
          fontSize: textSize,
          fontWeight: textBold ? 'bold' : 'normal',
          fontStyle: textItalic ? 'italic' : 'normal',
        });
    setSelectedObjectIds([]);
    setObjectOptionsVisible(false);
    setStylingObjectId(null);
    setEditingState({ object, isNew: true });
  }, [commitEditing, setEditingState, stickyBold, stickyColorKey, stickyItalic, stickySize, textBold, textColorKey, textItalic, textSize]);

  const startEditingExisting = useCallback((id: string) => {
    const object = findObject(document, id);
    // Capability check: only text and sticky notes own editable text. Tapping a
    // selected shape or connector must not enter a phantom editing state.
    if (!object || !isTextualObject(object)) return;
    setSelectedObjectIds([id]);
    setObjectOptionsVisible(false);
    setStylingObjectId(null);
    setSheetHeight(0);
    setEditingState({ object, isNew: false });
  }, [document, setEditingState]);

  const deleteSelected = useCallback(() => {
    const ids = selectedObjectIds.filter((id) => findObject(document, id));
    if (ids.length === 0) return;
    const commands: DocumentCommand[] = ids.map((id) => ({ type: 'object.delete', id }));
    dispatch({
      type: 'commands',
      commands,
    });
    setSelectedObjectIds([]);
    setStylingObjectId(null);
  }, [document, selectedObjectIds]);

  /**
   * Copies every selected object at a fresh id, offset so the copies are
   * immediately visible. One `commands` action keeps a multi-duplicate as a
   * single undo step.
   */
  const duplicateSelected = useCallback(() => {
    const originals = selectedObjectIds
      .map((id) => findObject(document, id))
      .filter((object): object is CanvasObject => Boolean(object));
    if (originals.length === 0) return;
    const stamp = Date.now();
    const copies = originals.map((object, index) => duplicateObject(
      object,
      `${object.type}-${stamp}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    ));
    dispatch({
      type: 'commands',
      commands: copies.map((object) => ({ type: 'object.insert' as const, object })),
    });
    setSelectedObjectIds(copies.map((object) => object.id));
    setStylingObjectId(null);
  }, [document, selectedObjectIds]);

  /** Style is available for one selected object at a time, ink excepted. */
  const toggleStyleSheet = useCallback(() => {
    if (selectedObjectIds.length !== 1) return;
    const id = selectedObjectIds[0];
    setStylingObjectId((current) => (current === id ? null : id));
  }, [selectedObjectIds]);

  const updateStyledObject = useCallback((patch: ObjectStylePatch) => {
    if (!stylingObjectId) return;
    dispatch({ type: 'command', command: { type: 'object.update', id: stylingObjectId, ...patch } });
  }, [stylingObjectId]);

  // A style sheet belongs to the one object it was opened for.
  useEffect(() => {
    if (stylingObjectId && (selectedObjectIds.length !== 1 || selectedObjectIds[0] !== stylingObjectId)) {
      setStylingObjectId(null);
    }
  }, [selectedObjectIds, stylingObjectId]);
  useEffect(() => {
    if (stylingObjectId && !findObject(document, stylingObjectId)) setStylingObjectId(null);
  }, [document, stylingObjectId]);

  // The keyboard must never cover the object being edited. Only the viewport
  // moves; the object keeps its board position.
  const editingId = editing?.object.id ?? null;
  useEffect(() => {
    const current = editingRef.current;
    if (!current || keyboardHeight <= 0 || canvasRect.width === 0) return;
    const rect = objectScreenRect(current.object, viewportLive.current);
    const next = keepObjectAboveKeyboard({
      object: {
        x: canvasRect.x + rect.x,
        y: canvasRect.y + rect.y,
        width: rect.width,
        height: rect.height,
      },
      canvas: canvasRect,
      viewport: viewportLive.current,
      // The style sheet sits above the keyboard and covers the canvas too.
      bottomInset: keyboardOverlap(keyboardHeight, canvasRect, windowHeight) + sheetHeight + spacing.sm,
    });
    if (next.x !== viewportLive.current.x || next.y !== viewportLive.current.y) requestViewport(next);
  }, [editingId, keyboardHeight, sheetHeight, canvasRect, windowHeight, requestViewport]);

  // A selection can vanish through undo, redo, or a delete from elsewhere.
  useEffect(() => {
    setSelectedObjectIds((current) => {
      const next = current.filter((id) => findObject(document, id));
      return next.length === current.length ? current : next;
    });
  }, [document]);

  const pressTool = useCallback((tool: InkTool) => {
    if (editingRef.current) commitEditing();
    setStylingObjectId(null);
    if (tool !== 'select') setSelectedObjectIds([]);
    if (tool === 'pen' || tool === 'highlighter' || tool === 'eraser') {
      setObjectOptionsVisible(false);
      setShapeOptionsVisible(false);
      if (activeTool === tool) {
        setInkOptionsVisible((visible) => !visible);
        return;
      }
      setActiveTool(tool);
      setInkOptionsVisible(true);
      return;
    }
    setInkOptionsVisible(false);
    if (tool === 'shape' || tool === 'connector') {
      setObjectOptionsVisible(false);
      setShapeOptionsVisible((visible) => (activeTool === tool ? !visible : true));
    } else if (tool === 'text' || tool === 'sticky') {
      // Pressing the active tool again shows its colour and size options.
      setObjectOptionsVisible((visible) => (activeTool === tool ? !visible : true));
    } else {
      setObjectOptionsVisible(false);
    }
    setActiveTool(tool);
  }, [activeTool, commitEditing]);

  const selectInkTool = useCallback((tool: FreehandTool) => {
    setActiveTool(tool);
    setInkOptionsVisible(true);
  }, []);

  /** An open edit is committed first; it is not the thing undo should remove. */
  const undo = useCallback(() => {
    if (editingRef.current) {
      commitEditing();
      return;
    }
    dispatch({ type: 'undo' });
  }, [commitEditing]);
  const redo = useCallback(() => {
    if (editingRef.current) {
      commitEditing();
      return;
    }
    dispatch({ type: 'redo' });
  }, [commitEditing]);

  const selectedObjects = document.objects.filter((object) => selectedObjectIds.includes(object.id));
  const selectedObject = selectedObjects.length === 1 ? selectedObjects[0] : null;
  const sheetTool: InkSheetTool = activeTool === 'eraser' ? 'eraser' : activeTool === 'highlighter' ? 'highlighter' : 'pen';
  const optionsBottom = tablet ? spacing.md : 84 + Math.max(spacing.sm, insets.bottom);
  const showGuidance = !documentHasContent(document) && !editing;
  const editingTextObject = editing && isTextualObject(editing.object) ? editing.object : null;
  const overlayRect = editingTextObject ? objectScreenRect(editingTextObject, viewport) : null;
  const overlayFill = editingTextObject ? objectFill(editingTextObject) : undefined;
  const overlayTextColor = editingTextObject ? objectTextColor(editingTextObject, dark) : theme.foreground;
  const overlayLineHeight = editingTextObject ? textLineHeight(editingTextObject.fontSize) : 0;
  const editingSheetBottom = keyboardHeight > 0 ? keyboardHeight + spacing.sm : insets.bottom + spacing.md;
  const selectedBounds = selectionBounds(selectedObjects);
  const selectedRect = selectedBounds && !editing ? canvasRectToScreen(selectedBounds, viewport) : null;
  // Only text and sticky notes have editable text. Shapes and connectors
  // expose duplicate, style, and delete, so the Edit action is capability-driven.
  const selectedIsTextual = selectedObject ? isTextualObject(selectedObject) : false;
  // The rail is vertical and sits beside the selection, so it never covers the
  // rotate handle above the selection. Its action count decides its height.
  const selectionActionCount = selectedObjects.length === 0
    ? 0
    : selectedObject
      ? (selectedIsTextual ? 4 : 3)
      : 2;
  const canvasBorder = 1;
  const actionRail = selectedRect && !editing && canvasRect.width > 0
    ? selectionActionRail(
      selectedRect,
      selectionActionCount,
      canvasRect.width - canvasBorder * 2,
      canvasRect.height - canvasBorder * 2,
    )
    : null;
  const selectionLabel = selectedObjects.length === 1
    ? `${selectedObjects[0].type} selected`
    : `${selectedObjects.length} objects selected`;
  const stylingObject = stylingObjectId ? findObject(document, stylingObjectId) : null;
  const stylingTextObject = stylingObject && isTextualObject(stylingObject) ? stylingObject : null;
  const stylingGeometricObject = stylingObject && !isTextualObject(stylingObject) ? stylingObject : null;

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.topBar, { borderBottomColor: theme.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to boards"
          onPress={() => { commitEditing(); router.back(); }}
          style={styles.iconButton}
        >
          <ChevronRightIcon color={theme.foreground} />
        </Pressable>
        <TextInput
          accessibilityLabel="Board title"
          value={title}
          onChangeText={(value) => { setTitle(value); if (boardId) updateTitle(boardId, value); }}
          onFocus={commitEditing}
          style={[styles.title, { color: theme.foreground }]}
        />
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Undo" accessibilityHint={canUndo ? (undoLabel ? `Undo ${undoLabel}` : 'Reverts the last change') : 'Nothing to undo'} accessibilityState={{ disabled: !canUndo }} disabled={!canUndo} onPress={undo} style={[styles.action, !canUndo && styles.actionDisabled]}><UndoIcon size={22} color={theme.foreground} /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Redo" accessibilityHint={canRedo ? (redoLabel ? `Redo ${redoLabel}` : 'Reapplies the last undone change') : 'Nothing to redo'} accessibilityState={{ disabled: !canRedo }} disabled={!canRedo} onPress={redo} style={[styles.action, !canRedo && styles.actionDisabled]}><RedoIcon size={22} color={theme.foreground} /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="More board options" style={styles.iconButton}><MoreIcon color={theme.foreground} /></Pressable>
        </View>
      </View>

      <View style={styles.workspace}>
        {tablet && <ToolRail theme={theme} activeTool={activeTool} onToolPress={pressTool} />}
        <View
          ref={canvasRef}
          onLayout={measureCanvas}
          style={[styles.canvas, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <View style={styles.canvasClip}>
            <CanvasViewport
              dark={dark}
              initialViewport={INITIAL_VIEWPORT}
              activeTool={activeTool}
              color={color}
              width={strokeWidth}
              opacity={opacity}
              eraserRadius={eraserRadius}
              shapeKind={shapeKind}
              shapeColorKey={shapeColorKey}
              shapeFillKey={shapeFillKey}
              shapeStrokeWidth={shapeStrokeWidth}
              connectorStyle={connectorStyle}
              connectorColorKey={connectorColorKey}
              connectorStrokeWidth={connectorStrokeWidth}
              document={document}
              selectedObjectIds={selectedObjectIds}
              editingObjectId={editingId}
              viewportRequest={viewportRequest}
              onViewportChange={reportViewport}
              onCommand={runCommand}
              onCommitPending={commitPending}
              onObjectCreate={startNewObject}
              onSelectionChange={setSelectedObjectIds}
              onObjectEdit={startEditingExisting}
              onObjectMeasure={measureObject}
              onCanvasTouch={commitEditing}
            />
            {showGuidance && (
              <View pointerEvents="none" style={styles.canvasGuidance}>
                <Text style={[styles.canvasTitle, { color: theme.foreground }]}>Your canvas is ready</Text>
                <Text style={[styles.canvasBody, { color: theme.foreground }]}>
                  Draw with a pen, or tap the text and sticky-note tools to add a note.
                </Text>
              </View>
            )}
            {editingTextObject && overlayRect && (
              <TextInput
                multiline
                autoFocus
                accessibilityLabel={editingTextObject.type === 'sticky' ? 'Sticky note editor' : 'Canvas text editor'}
                value={editingTextObject.text}
                onChangeText={(text) => updateDraft({ text })}
                onBlur={commitEditing}
                placeholder={editingTextObject.type === 'sticky' ? 'Write a note' : 'Type something'}
                placeholderTextColor={`${overlayTextColor}80`}
                selectionColor={theme.primary}
                style={[
                  styles.objectEditor,
                  {
                    left: overlayRect.x,
                    top: overlayRect.y,
                    width: overlayRect.width,
                    minHeight: overlayRect.height,
                    padding: OBJECT_PADDING * viewport.scale,
                    borderRadius: radii.sm * viewport.scale,
                    backgroundColor: overlayFill ?? 'transparent',
                    color: overlayTextColor,
                    fontSize: editingTextObject.fontSize * viewport.scale,
                    lineHeight: overlayLineHeight * viewport.scale,
                    fontWeight: editingTextObject.fontWeight ?? 'normal',
                    fontStyle: editingTextObject.fontStyle ?? 'normal',
                    transform: [{ rotate: `${editingTextObject.rotation}deg` }],
                  },
                ]}
              />
            )}
          </View>

          {selectedObjects.length > 0 && actionRail && (
            <View
              accessibilityLabel={selectionLabel}
              style={[
                styles.selectionRail,
                {
                  left: actionRail.x,
                  top: actionRail.y,
                  width: actionRail.width,
                  height: actionRail.height,
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                },
              ]}
            >
              {selectedIsTextual && selectedObject && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Edit selected object"
                  accessibilityHint="Opens the object's text editor"
                  onPress={() => startEditingExisting(selectedObject.id)}
                  style={({ pressed }) => [styles.selectionAction, pressed && styles.pressed]}
                >
                  <EditIcon size={18} color={theme.foreground} />
                </Pressable>
              )}
              {selectedObject && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Style selected object"
                  accessibilityHint="Opens the object's style options"
                  onPress={toggleStyleSheet}
                  style={({ pressed }) => [
                    styles.selectionAction,
                    selectedIsTextual && styles.selectionActionSeparator,
                    { borderTopColor: theme.border },
                    pressed && styles.pressed,
                  ]}
                >
                  <StyleIcon size={18} color={theme.foreground} />
                </Pressable>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={selectedObjects.length === 1 ? 'Duplicate selected object' : 'Duplicate selected objects'}
                accessibilityHint="Creates an offset copy in the same undo step"
                onPress={duplicateSelected}
                style={({ pressed }) => [
                  styles.selectionAction,
                  selectedObject && styles.selectionActionSeparator,
                  { borderTopColor: theme.border },
                  pressed && styles.pressed,
                ]}
              >
                <DuplicateIcon size={18} color={theme.foreground} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={selectedObjects.length === 1 ? 'Delete selected object' : 'Delete selected objects'}
                accessibilityHint="Removes the selection; undo restores it"
                onPress={deleteSelected}
                style={({ pressed }) => [
                  styles.selectionAction,
                  styles.selectionActionSeparator,
                  { borderTopColor: theme.border },
                  pressed && styles.pressed,
                ]}
              >
                <TrashIcon size={18} color={theme.destructive} />
              </Pressable>
            </View>
          )}
        </View>
      </View>

      {editingTextObject && editing?.isNew && (
        <ObjectOptionsSheet
          theme={theme}
          dark={dark}
          kind={editingTextObject.type}
          colorKey={editingTextObject.colorKey}
          fontSize={editingTextObject.fontSize}
          fontWeight={editingTextObject.fontWeight ?? 'normal'}
          fontStyle={editingTextObject.fontStyle ?? 'normal'}
          bottomOffset={editingSheetBottom}
          doneLabel="Done"
          doneHint="Commits the object and closes the keyboard"
          showScrim={false}
          onColorChange={(key) => updateDraft({ colorKey: key })}
          onFontSizeChange={(size) => updateDraft({ fontSize: size })}
          onFontWeightChange={(weight) => {
            updateDraft({ fontWeight: weight });
            if (editingTextObject.type === 'sticky') setStickyBold(weight === 'bold');
            else setTextBold(weight === 'bold');
          }}
          onFontStyleChange={(style) => {
            updateDraft({ fontStyle: style });
            if (editingTextObject.type === 'sticky') setStickyItalic(style === 'italic');
            else setTextItalic(style === 'italic');
          }}
          onDone={commitEditing}
          onHeightChange={setSheetHeight}
        />
      )}

      {!editing && objectOptionsVisible && (activeTool === 'text' || activeTool === 'sticky') && (
        <ObjectOptionsSheet
          theme={theme}
          dark={dark}
          kind={activeTool}
          colorKey={activeTool === 'sticky' ? stickyColorKey : textColorKey}
          fontSize={activeTool === 'sticky' ? stickySize : textSize}
          fontWeight={activeTool === 'sticky' ? (stickyBold ? 'bold' : 'normal') : (textBold ? 'bold' : 'normal')}
          fontStyle={activeTool === 'sticky' ? (stickyItalic ? 'italic' : 'normal') : (textItalic ? 'italic' : 'normal')}
          bottomOffset={optionsBottom}
          doneLabel="Done"
          doneHint="Closes the style options"
          onColorChange={(key) => (activeTool === 'sticky' ? setStickyColorKey(key) : setTextColorKey(key))}
          onFontSizeChange={(size) => (activeTool === 'sticky' ? setStickySize(size) : setTextSize(size))}
          onFontWeightChange={(weight) => {
            if (activeTool === 'sticky') setStickyBold(weight === 'bold');
            else setTextBold(weight === 'bold');
          }}
          onFontStyleChange={(style) => {
            if (activeTool === 'sticky') setStickyItalic(style === 'italic');
            else setTextItalic(style === 'italic');
          }}
          onDone={closeObjectOptions}
        />
      )}

      {!editing && shapeOptionsVisible && (activeTool === 'shape' || activeTool === 'connector') && (
        <ShapeOptionsSheet
          theme={theme}
          mode={activeTool}
          shapeKind={shapeKind}
          shapeColorKey={shapeColorKey}
          shapeFillKey={shapeFillKey}
          shapeStrokeWidth={shapeStrokeWidth}
          connectorStyle={connectorStyle}
          connectorColorKey={connectorColorKey}
          connectorStrokeWidth={connectorStrokeWidth}
          onShapeKind={setShapeKind}
          onShapeColor={setShapeColorKey}
          onShapeFill={setShapeFillKey}
          onShapeStrokeWidth={setShapeStrokeWidth}
          onConnectorStyle={setConnectorStyle}
          onConnectorColor={setConnectorColorKey}
          onConnectorStrokeWidth={setConnectorStrokeWidth}
          onDone={() => setShapeOptionsVisible(false)}
        />
      )}

      {!editing && stylingTextObject && (
        <ObjectOptionsSheet
          theme={theme}
          dark={dark}
          kind={stylingTextObject.type}
          colorKey={stylingTextObject.colorKey}
          fontSize={stylingTextObject.fontSize}
          fontWeight={stylingTextObject.fontWeight ?? 'normal'}
          fontStyle={stylingTextObject.fontStyle ?? 'normal'}
          bottomOffset={optionsBottom}
          doneLabel="Done"
          doneHint="Closes the style options"
          onColorChange={(key) => updateStyledObject({ colorKey: key })}
          onFontSizeChange={(size) => updateStyledObject({ fontSize: size })}
          onFontWeightChange={(weight) => updateStyledObject({ fontWeight: weight })}
          onFontStyleChange={(style) => updateStyledObject({ fontStyle: style })}
          onDone={() => setStylingObjectId(null)}
        />
      )}

      {!editing && stylingGeometricObject && (
        <ShapeOptionsSheet
          theme={theme}
          mode={stylingGeometricObject.type}
          shapeKind={stylingGeometricObject.type === 'shape' ? stylingGeometricObject.shape : shapeKind}
          shapeColorKey={stylingGeometricObject.type === 'shape' ? stylingGeometricObject.colorKey : shapeColorKey}
          shapeFillKey={stylingGeometricObject.type === 'shape' ? stylingGeometricObject.fillKey : shapeFillKey}
          shapeStrokeWidth={stylingGeometricObject.type === 'shape' ? stylingGeometricObject.strokeWidth : shapeStrokeWidth}
          connectorStyle={stylingGeometricObject.type === 'connector' ? stylingGeometricObject.style : connectorStyle}
          connectorColorKey={stylingGeometricObject.type === 'connector' ? stylingGeometricObject.colorKey : connectorColorKey}
          connectorStrokeWidth={stylingGeometricObject.type === 'connector' ? stylingGeometricObject.strokeWidth : connectorStrokeWidth}
          onShapeKind={(value) => updateStyledObject({ shape: value })}
          onShapeColor={(value) => updateStyledObject({ colorKey: value })}
          onShapeFill={(value) => updateStyledObject({ fillKey: value })}
          onShapeStrokeWidth={(value) => updateStyledObject({ strokeWidth: value })}
          onConnectorStyle={(value) => updateStyledObject({ style: value })}
          onConnectorColor={(value) => updateStyledObject({ colorKey: value })}
          onConnectorStrokeWidth={(value) => updateStyledObject({ strokeWidth: value })}
          onDone={() => setStylingObjectId(null)}
        />
      )}

      {!editing && inkOptionsVisible && (
        <InkOptionsSheet
          theme={theme}
          dark={dark}
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
          onClose={() => setInkOptionsVisible(false)}
        />
      )}
      {!tablet && !editing && <ToolDock theme={theme} bottom={insets.bottom} activeTool={activeTool} onToolPress={pressTool} />}
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
  const hasOptions = tool !== 'select';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hasOptions ? 'Opens the tool options when selected again' : undefined}
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
  actionDisabled: { opacity: 0.3 },
  workspace: { flex: 1, flexDirection: 'row' },
  rail: { width: 84, borderRightWidth: 1, alignItems: 'center', paddingTop: spacing.md, gap: spacing.xs },
  canvas: { flex: 1, margin: spacing.md, borderWidth: 1, borderRadius: radii.md },
  canvasClip: { flex: 1, overflow: 'hidden', borderRadius: radii.md },
  canvasGuidance: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg },
  canvasTitle: { ...typography.subtitle },
  canvasBody: { ...typography.body, opacity: 0.7, textAlign: 'center' },
  dock: { minHeight: 76, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', borderTopWidth: 1, paddingTop: spacing.sm },
  tool: { minWidth: touchTarget, minHeight: touchTarget, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2, gap: 2 },
  toolIconWrap: { width: 34, height: 30, borderWidth: 1, borderColor: 'transparent', borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  toolLabel: { ...typography.caption, fontSize: 11, textAlign: 'center' },
  toolPressed: { opacity: 0.65 },
  objectEditor: { position: 'absolute', zIndex: 10, textAlignVertical: 'top' },
  selectionRail: { position: 'absolute', zIndex: 20, borderWidth: 1, borderRadius: radii.sm, overflow: 'hidden' },
  selectionAction: { height: touchTarget, alignItems: 'center', justifyContent: 'center' },
  selectionActionSeparator: { borderTopWidth: 1 },
  pressed: { opacity: 0.65 },
});
