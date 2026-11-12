import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useReducer, useRef, useState, type ComponentRef } from 'react';
import {
  ActivityIndicator,
  AppState,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBoards } from '../src/board-context';
import { usePreferences } from '../src/settings/preferences-context';
import { triggerHapticFeedback } from '../src/utils/haptics';
import {
  CANVAS_COLORS,
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
  type CanvasDocument,
  type CanvasObject,
  type DocumentCommand,
  type ObjectStylePatch,
  type TextObject,
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
import { screenToCanvas, type Point, type Viewport } from '../src/canvas/viewport';
import { storageErrorMessage } from '../src/persistence/errors';
import { getLocalDatabase } from '../src/persistence/expo-store';
import {
  DEFAULT_BOARD_SETTINGS,
  loadBoardDocument,
  saveBoardDocument,
  saveBoardViewport,
} from '../src/persistence/repository';
import { enqueuePersistenceWrite } from '../src/persistence/write-queue';
import { CanvasViewport, type InkTool, type ViewportRequest } from '../src/components/CanvasViewport';
import {
  CalculatorIcon,
  CheckIcon,
  ChevronRightIcon,
  DuplicateIcon,
  EditIcon,
  EraserIcon,
  GridIcon,
  HighlighterIcon,
  ImageIcon,
  LaserIcon,
  MoreIcon,
  ConnectorIcon,
  PenIcon,
  ShapeIcon,
  RedoIcon,
  SelectIcon,
  StickyIcon,
  StyleIcon,
  TextIcon,
  TimerIcon,
  TrashIcon,
  UndoIcon,
} from '../src/components/icons';
import { BOARD_STYLE_OPTIONS, type BoardBackground, type BoardStyle } from '../src/persistence/schema';
import type { LaserColorKey } from '../src/canvas/laser';
import { createTimerPinCommand, type TimerState } from '../src/timer/timer-model';
import { createCalculatorPasteCommand } from '../src/calculator/calculator-engine';
import { FloatingTimer } from '../src/components/FloatingTimer';
import { FloatingCalculator } from '../src/components/FloatingCalculator';
import { ImageImportFlow } from '../src/components/ImageImportFlow';
import { insertMediaAsset, type MediaAssetRecord } from '../src/persistence/repository';
import { cropMetadata } from '../src/media/asset-store';
import type { ImageObject } from '../src/canvas/document';
import { InkingQuickTray } from '../src/components/InkingQuickTray';
import { QuickCreationSheet, type InsertToolRequest } from '../src/components/QuickCreationSheet';
import { ActionIsland, ACTION_ISLAND_HEIGHT } from '../src/components/ActionIsland';
import { InkOptionsSheet, type InkSheetTool } from '../src/components/InkOptionsSheet';
import { ObjectOptionsSheet } from '../src/components/ObjectOptionsSheet';
import { ShapeOptionsSheet } from '../src/components/ShapeOptionsSheet';
import { ExportSheet } from '../src/components/ExportSheet';
import { EditorInspectorPanel } from '../src/components/EditorInspectorPanel';
import {
  DOCK_TOUCH_TARGET,
  isSoftwareKeyboardVisible,
  resolveEditorLayout,
} from '../src/responsive/layout';
import { radii, spacing, touchTarget, typography, type ThemeColors } from '../src/theme';

const TOOLS = [
  { tool: 'select', label: 'Select', Icon: SelectIcon },
  { tool: 'text', label: 'Text', Icon: TextIcon },
  { tool: 'sticky', label: 'Sticky note', Icon: StickyIcon },
  { tool: 'shape', label: 'Shape', Icon: ShapeIcon },
  { tool: 'connector', label: 'Connector', Icon: ConnectorIcon },
  { tool: 'pen', label: 'Pen', Icon: PenIcon },
  { tool: 'highlighter', label: 'Highlighter', Icon: HighlighterIcon },
  { tool: 'eraser', label: 'Eraser', Icon: EraserIcon },
  { tool: 'laser', label: 'Laser', Icon: LaserIcon },
  { tool: 'image', label: 'Image', Icon: ImageIcon },
] as const satisfies ReadonlyArray<{ tool: InkTool; label: string; Icon: typeof PenIcon }>;

/** Zoomed in enough that ink is comfortable under a finger. */
const INITIAL_VIEWPORT: Viewport = { x: 150, y: -80, scale: 2 };
/** How long viewport reports may be batched before the editor re-renders. */
const VIEWPORT_RENDER_INTERVAL = 60;
/** Quiet period before a document change is written to SQLite. */
const AUTOSAVE_DELAY = 700;
/** Panning and zooming settle before the viewport itself is written. */
const VIEWPORT_SAVE_DELAY = 900;

function sameViewport(left: Viewport, right: Viewport): boolean {
  return (
    Math.abs(left.x - right.x) < 0.5 &&
    Math.abs(left.y - right.y) < 0.5 &&
    Math.abs(left.scale - right.scale) < 0.001
  );
}

/** The object being edited, plus whether it still needs inserting into the board. */
type Editing = { object: CanvasObject; isNew: boolean };

export default function BoardEditorScreen() {
  const router = useRouter();
  const { boardId } = useLocalSearchParams<{ boardId?: string }>();
  const { boards, updateTitle, updateSettings, touchBoard } = useBoards();
  const board = boards.find((item) => item.id === boardId);
  const [title, setTitle] = useState(board?.title ?? 'Untitled board');
  // Adopt the stored title when the board first becomes available. Autosave
  // metadata refreshes must not overwrite a title the user is typing.
  const boardTitle = board?.title;
  useEffect(() => { if (boardTitle) setTitle(boardTitle); }, [board?.id]);
  const insets = useSafeAreaInsets();
  const { width, height: windowHeight } = useWindowDimensions();
  const { preferences, theme, isDark } = usePreferences();
  const dark = isDark;

  const [history, dispatch] = useReducer(documentReducer, createDocumentHistory());
  const document = history.present;
  const canUndo = historyCanUndo(history);
  const canRedo = historyCanRedo(history);
  const undoLabel = nextUndoLabel(history);
  const redoLabel = nextRedoLabel(history);

  const [activeTool, setActiveTool] = useState<InkTool>('select');
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);
  const [stylingObjectId, setStylingObjectId] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [editing, setEditing] = useState<Editing | null>(null);
  const editingRef = useRef<Editing | null>(null);

  const selectedObjects = document.objects.filter((object) => selectedObjectIds.includes(object.id));
  const selectedObject = selectedObjects.length === 1 ? selectedObjects[0] : null;
  const layout = resolveEditorLayout(
    width,
    windowHeight,
    insets,
    {
      hasSelection: selectedObjects.length > 0,
      inspectorOpen,
      isEditingText: Boolean(editing),
    },
    ACTION_ISLAND_HEIGHT,
  );
  const tablet = layout.navigationMode === 'rail';

  // Default inspector open state by tablet orientation when a new selection begins.
  const prevSelectionCount = useRef(0);
  useEffect(() => {
    if (selectedObjects.length > 0 && prevSelectionCount.current === 0) {
      setInspectorOpen(layout.profile.isTabletLandscape);
    }
    prevSelectionCount.current = selectedObjects.length;
  }, [selectedObjects.length, layout.profile.isTabletLandscape]);

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

  const resolveInitialColor = () => {
    const token = CANVAS_COLORS.find(
      (c) =>
        c.key === preferences.defaultPenColor ||
        c.light.toLowerCase() === preferences.defaultPenColor.toLowerCase() ||
        c.dark.toLowerCase() === preferences.defaultPenColor.toLowerCase(),
    );
    if (token) return dark ? token.dark : token.light;
    return preferences.defaultPenColor || theme.foreground;
  };

  const [color, setColor] = useState<string>(resolveInitialColor);
  const [strokeWidth, setStrokeWidth] = useState(preferences.defaultPenWidth ?? 4);
  const [opacity, setOpacity] = useState(1);
  const [eraserRadius, setEraserRadius] = useState(24);
  const [inkOptionsVisible, setInkOptionsVisible] = useState(false);
  const [objectOptionsVisible, setObjectOptionsVisible] = useState(false);
  const [shapeOptionsVisible, setShapeOptionsVisible] = useState(false);
  const [exportSheetVisible, setExportSheetVisible] = useState(false);

  const [imageFlowOpen, setImageFlowOpen] = useState(false);
  const [imageFlowId, setImageFlowId] = useState<string | null>(null);
  const [quickCreationOpen, setQuickCreationOpen] = useState(false);
  const [inkTrayOpen, setInkTrayOpen] = useState(false);
  const [lastInkingTool, setLastInkingTool] = useState<FreehandTool | 'eraser' | 'laser'>('pen');
  const [laserColorKey, setLaserColorKey] = useState<LaserColorKey>('red');
  const [timerVisible, setTimerVisible] = useState(false);
  const [calculatorVisible, setCalculatorVisible] = useState(false);
  const [boardStyleModalVisible, setBoardStyleModalVisible] = useState(false);

  const insertMediaAssetRow = useCallback(async (asset: MediaAssetRecord) => {
    if (!boardId) return;
    const database = await getLocalDatabase();
    await insertMediaAsset(database, asset);
  }, [boardId]);

  const placeImageObject = useCallback((object: ImageObject, textObject?: TextObject) => {
    if (!boardId) return;
    const commands: DocumentCommand[] = [{ type: 'object.insert', object }];
    if (textObject) commands.push({ type: 'object.insert', object: textObject });
    dispatch({ type: 'commands', commands });
    void insertMediaAssetRow({
      id: object.originalAssetId,
      boardId,
      ownerId: null,
      storagePath: object.originalStoragePath,
      mimeType: '',
      bytes: 0,
      metadata: {},
      createdAt: new Date().toISOString(),
    });
    void insertMediaAssetRow({
      id: object.assetId,
      boardId,
      ownerId: null,
      storagePath: object.storagePath,
      mimeType: '',
      bytes: 0,
      metadata: {
        ...cropMetadata(object.crop, object.originalAssetId, '', { width: object.sourceWidth, height: object.sourceHeight }),
        ...(object.ocr ? { ocr: object.ocr } : {}),
      },
      createdAt: new Date().toISOString(),
    });
    setSelectedObjectIds([object.id]);
  }, [boardId, dispatch, insertMediaAssetRow]);

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

  // Local persistence: hydration, debounced autosave, and serialized writes.
  const [hydrated, setHydrated] = useState(false);
  const [initialViewport, setInitialViewport] = useState<Viewport>(INITIAL_VIEWPORT);
  const [storageError, setStorageError] = useState<string | null>(null);
  const documentRef = useRef<CanvasDocument>(document);
  documentRef.current = document;
  const hydratedRef = useRef(false);
  const lastSavedDocument = useRef<CanvasDocument | null>(null);
  const savedViewport = useRef<Viewport | null>(null);
  const documentSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewportSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const enqueueWrite = useCallback((task: () => Promise<void>) => {
    void enqueuePersistenceWrite(task).catch((error: unknown) => {
      setStorageError(storageErrorMessage(error));
    });
  }, []);

  const persistDocument = useCallback((snapshot: CanvasDocument, viewport: Viewport) => {
    if (!boardId) return;
    enqueueWrite(async () => {
      const database = await getLocalDatabase();
      await saveBoardDocument(database, boardId, snapshot, viewport);
      lastSavedDocument.current = snapshot;
      savedViewport.current = viewport;
      setStorageError(null);
      touchBoard(boardId, snapshot.strokes.length + snapshot.objects.length);
    });
  }, [boardId, enqueueWrite, touchBoard]);

  /**
   * Write the newest document and viewport right now. Used when the app leaves
   * the foreground or the editor closes, so a debounce window cannot lose work.
   */
  const flushPendingSaves = useCallback(() => {
    if (!boardId || !hydratedRef.current) return;
    if (documentSaveTimer.current) {
      clearTimeout(documentSaveTimer.current);
      documentSaveTimer.current = null;
    }
    if (viewportSaveTimer.current) {
      clearTimeout(viewportSaveTimer.current);
      viewportSaveTimer.current = null;
    }
    const snapshot = documentRef.current;
    const viewport = viewportLive.current;
    const documentDirty = lastSavedDocument.current !== snapshot;
    const viewportDirty = !savedViewport.current || !sameViewport(savedViewport.current, viewport);
    if (!documentDirty && !viewportDirty) return;

    enqueueWrite(async () => {
      const database = await getLocalDatabase();
      if (documentDirty) {
        await saveBoardDocument(database, boardId, snapshot, viewport);
        lastSavedDocument.current = snapshot;
        savedViewport.current = viewport;
        touchBoard(boardId, snapshot.strokes.length + snapshot.objects.length);
      } else {
        await saveBoardViewport(database, boardId, viewport);
        savedViewport.current = viewport;
      }
      setStorageError(null);
    });
  }, [boardId, enqueueWrite, touchBoard]);

  const scheduleViewportSave = useCallback((next: Viewport) => {
    if (!boardId || !hydratedRef.current) return;
    if (savedViewport.current && sameViewport(savedViewport.current, next)) return;
    if (viewportSaveTimer.current) clearTimeout(viewportSaveTimer.current);
    viewportSaveTimer.current = setTimeout(() => {
      viewportSaveTimer.current = null;
      const viewport = viewportLive.current;
      if (!boardId || !hydratedRef.current) return;
      if (savedViewport.current && sameViewport(savedViewport.current, viewport)) return;
      enqueueWrite(async () => {
        const database = await getLocalDatabase();
        await saveBoardViewport(database, boardId, viewport);
        savedViewport.current = viewport;
        setStorageError(null);
      });
    }, VIEWPORT_SAVE_DELAY);
  }, [boardId, enqueueWrite]);

  // Load the saved board once. Rendering the canvas only after this finishes
  // keeps CanvasViewport's initial viewport and the document in agreement.
  useEffect(() => {
    let cancelled = false;
    hydratedRef.current = false;
    setHydrated(false);
    if (!boardId) {
      hydratedRef.current = true;
      lastSavedDocument.current = documentRef.current;
      setHydrated(true);
      return () => { cancelled = true; };
    }
    (async () => {
      try {
        const database = await getLocalDatabase();
        const snapshot = await loadBoardDocument(database, boardId);
        if (cancelled) return;
        dispatch({ type: 'hydrate', document: snapshot.document });
        lastSavedDocument.current = snapshot.document;
        const saved = snapshot.viewport ?? INITIAL_VIEWPORT;
        viewportLive.current = saved;
        savedViewport.current = saved;
        setInitialViewport(saved);
        setViewport(saved);
        setStorageError(null);
      } catch (error) {
        if (cancelled) return;
        // A failed read must not block editing: keep the in-memory board and
        // surface the problem while the next edit retries the store.
        setStorageError(storageErrorMessage(error));
        lastSavedDocument.current = documentRef.current;
        savedViewport.current = viewportLive.current;
      } finally {
        if (!cancelled) {
          hydratedRef.current = true;
          setHydrated(true);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [boardId]);

  // Debounced autosave. Reference equality is enough because every mutation
  // produces a new document only when something actually changed.
  useEffect(() => {
    if (!hydrated || !boardId) return;
    if (lastSavedDocument.current === document) return;
    if (documentSaveTimer.current) clearTimeout(documentSaveTimer.current);
    documentSaveTimer.current = setTimeout(() => {
      documentSaveTimer.current = null;
      persistDocument(documentRef.current, viewportLive.current);
    }, AUTOSAVE_DELAY);
    return () => {
      if (documentSaveTimer.current) {
        clearTimeout(documentSaveTimer.current);
        documentSaveTimer.current = null;
      }
    };
  }, [document, hydrated, boardId, persistDocument]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') flushPendingSaves();
    });
    return () => subscription.remove();
  }, [flushPendingSaves]);

  useEffect(() => () => flushPendingSaves(), [flushPendingSaves]);

  const reportViewport = useCallback((next: Viewport) => {
    viewportLive.current = next;
    scheduleViewportSave(next);
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
  }, [scheduleViewportSave]);

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

  // Re-measure canvas window coordinates when orientation or docked panels change.
  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(measureCanvas, 32);
    return () => clearTimeout(timer);
  }, [hydrated, width, windowHeight, layout.navigationMode, layout.inspectorPresentation, measureCanvas]);

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
    if (tablet) {
      setInspectorOpen((open) => !open);
      return;
    }
    const id = selectedObjectIds[0];
    setStylingObjectId((current) => (current === id ? null : id));
  }, [selectedObjectIds, tablet]);

  const updateObjectStyleById = useCallback((id: string, patch: ObjectStylePatch) => {
    dispatch({ type: 'command', command: { type: 'object.update', id, ...patch } });
  }, []);

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
  const editingObjectHeight = editing?.object.height ?? 0;
  useEffect(() => {
    const current = editingRef.current;
    if (!current || !isSoftwareKeyboardVisible(keyboardHeight) || canvasRect.width === 0) return;
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
  }, [editingId, editingObjectHeight, keyboardHeight, sheetHeight, canvasRect, windowHeight, requestViewport]);

  // A selection can vanish through undo, redo, or a delete from elsewhere.
  useEffect(() => {
    setSelectedObjectIds((current) => {
      const next = current.filter((id) => findObject(document, id));
      return next.length === current.length ? current : next;
    });
  }, [document]);

  const isInkingTool =
    activeTool === 'pen' ||
    activeTool === 'highlighter' ||
    activeTool === 'eraser' ||
    activeTool === 'laser';

  const pressTool = useCallback((tool: InkTool) => {
    void triggerHapticFeedback('selection', preferences.haptics);
    if (editingRef.current) commitEditing();
    setStylingObjectId(null);
    if (tool !== 'select') setSelectedObjectIds([]);
    if (tool === 'pen' || tool === 'highlighter' || tool === 'eraser' || tool === 'laser') {
      setObjectOptionsVisible(false);
      setShapeOptionsVisible(false);
      setLastInkingTool(tool);
      // The phone gets the compact tray under the Draw anchor; the tablet has
      // no island, so its rail opens the full ink sheet instead (except laser).
      const retap = activeTool === tool;
      setActiveTool(tool);
      if (tablet) {
        setInkTrayOpen(false);
        if (retap) setInkOptionsVisible((visible) => !visible);
        else setInkOptionsVisible(true);
      } else {
        setInkOptionsVisible(false);
        if (retap) setInkTrayOpen((open) => !open);
        else setInkTrayOpen(true);
      }
      return;
    }
    setInkTrayOpen(false);
    setInkOptionsVisible(false);
    if (tool === 'shape' || tool === 'connector') {
      setObjectOptionsVisible(false);
      setShapeOptionsVisible((visible) => (activeTool === tool ? !visible : true));
    } else if (tool === 'text' || tool === 'sticky') {
      setObjectOptionsVisible((visible) => (activeTool === tool ? !visible : true));
    } else if (tool === 'image') {
      setImageFlowId(`${boardId}-${Date.now()}`);
      setImageFlowOpen(true);
      return;
    }
    setActiveTool(tool);
  }, [activeTool, boardId, commitEditing, preferences.haptics, tablet]);

  const toggleInking = useCallback(() => {
    void triggerHapticFeedback('selection', preferences.haptics);
    if (editingRef.current) commitEditing();
    setStylingObjectId(null);
    setSelectedObjectIds([]);
    setObjectOptionsVisible(false);
    setShapeOptionsVisible(false);
    if (activeTool === 'pen' || activeTool === 'highlighter' || activeTool === 'eraser' || activeTool === 'laser') {
      setInkTrayOpen((open) => !open);
    } else {
      setActiveTool(lastInkingTool);
      setInkTrayOpen(true);
    }
  }, [activeTool, commitEditing, lastInkingTool, preferences.haptics]);

  const handleSelectInsert = useCallback((request: InsertToolRequest) => {
    if (request.type === 'sticky') {
      if (request.colorKey) setStickyColorKey(request.colorKey);
      pressTool('sticky');
    } else if (request.type === 'text') {
      if (request.colorKey) setTextColorKey(request.colorKey);
      pressTool('text');
    } else if (request.type === 'shape') {
      setShapeKind(request.shape);
      pressTool('shape');
    } else if (request.type === 'connector') {
      setConnectorStyle(request.style);
      pressTool('connector');
    } else if (request.type === 'image') {
      if (!boardId) return;
      setImageFlowId(`${boardId}-${Date.now()}`);
      setImageFlowOpen(true);
    } else if (request.type === 'timer') {
      setTimerVisible(true);
    } else if (request.type === 'calculator') {
      setCalculatorVisible(true);
    }
  }, [boardId, pressTool]);

  const selectInkTool = useCallback((tool: FreehandTool) => {
    setActiveTool(tool);
    setInkOptionsVisible(true);
  }, []);

  /** An open edit is committed first; it is not the thing undo should remove. */
  const undo = useCallback(() => {
    void triggerHapticFeedback('selection', preferences.haptics);
    if (editingRef.current) {
      commitEditing();
      return;
    }
    dispatch({ type: 'undo' });
  }, [commitEditing, preferences.haptics]);
  const redo = useCallback(() => {
    void triggerHapticFeedback('selection', preferences.haptics);
    if (editingRef.current) {
      commitEditing();
      return;
    }
    dispatch({ type: 'redo' });
  }, [commitEditing, preferences.haptics]);

  const sheetTool: InkSheetTool =
    activeTool === 'eraser'
      ? 'eraser'
      : activeTool === 'highlighter'
        ? 'highlighter'
        : activeTool === 'laser'
          ? 'laser'
          : 'pen';
  const islandBottom = layout.islandBottom;
  const optionsBottom = layout.optionsBottom;
  const showGuidance = !documentHasContent(document) && !editing;
  const editingTextObject = editing && isTextualObject(editing.object) ? editing.object : null;
  const overlayRect = editingTextObject ? objectScreenRect(editingTextObject, viewport) : null;
  const overlayFill = editingTextObject ? objectFill(editingTextObject) : undefined;
  const overlayTextColor = editingTextObject ? objectTextColor(editingTextObject, dark) : theme.foreground;
  const overlayLineHeight = editingTextObject ? textLineHeight(editingTextObject.fontSize) : 0;
  const selectedBounds = selectionBounds(selectedObjects);
  const selectedRect = selectedBounds && !editing ? canvasRectToScreen(selectedBounds, viewport) : null;
  // Only text and sticky notes have editable text. Shapes and connectors
  // expose duplicate, style, and delete, so the Edit action is capability-driven.
  const selectedIsTextual = selectedObject ? isTextualObject(selectedObject) : false;
  const selectedIsImage = selectedObject?.type === 'image';
  // The rail is vertical and sits beside the selection, so it never covers the
  // rotate handle above the selection. Its action count decides its height.
  const selectionActionCount = selectedObjects.length === 0
    ? 0
    : selectedObject
      ? (selectedIsTextual ? 4 : selectedIsImage ? 2 : 3)
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
  const stylingGeometricObject = stylingObject && (stylingObject.type === 'shape' || stylingObject.type === 'connector') ? stylingObject : null;

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View
        style={[
          styles.topBar,
          {
            minHeight: layout.topBarHeight,
            borderBottomColor: theme.border,
            paddingLeft: spacing.sm + insets.left,
            paddingRight: spacing.sm + insets.right,
          },
        ]}
      >
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Board background style"
            onPress={() => { commitEditing(); setBoardStyleModalVisible(true); }}
            style={styles.iconButton}
          >
            <GridIcon size={20} color={theme.foreground} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Export and board options"
            onPress={() => { commitEditing(); setExportSheetVisible(true); }}
            style={styles.iconButton}
          >
            <MoreIcon color={theme.foreground} />
          </Pressable>
        </View>
      </View>

      {storageError && (
        <View
          accessibilityRole="alert"
          style={[
            styles.storageBanner,
            {
              borderColor: theme.border,
              backgroundColor: theme.muted,
              marginLeft: spacing.md + insets.left,
              marginRight: spacing.md + insets.right,
            },
          ]}
        >
          <Text style={[styles.storageBannerText, { color: theme.destructive }]}>
            Not saved: {storageError} The board stays editable and the next change retries the save.
          </Text>
        </View>
      )}

      <View
        style={[
          styles.workspace,
          {
            paddingLeft: insets.left,
            paddingRight: insets.right,
          },
        ]}
      >
        {tablet && (
          <ToolRail
            theme={theme}
            activeTool={activeTool}
            bottomInset={insets.bottom}
            timerVisible={timerVisible}
            calculatorVisible={calculatorVisible}
            onToolPress={pressTool}
            onToggleTimer={() => setTimerVisible((v) => !v)}
            onToggleCalculator={() => setCalculatorVisible((v) => !v)}
          />
        )}
        {!hydrated ? (
          <View style={styles.editorLoading}>
            <ActivityIndicator color={theme.primary} />
            <Text style={[styles.editorLoadingText, { color: theme.foreground }]}>Opening board…</Text>
          </View>
        ) : (
          <View
            ref={canvasRef}
            onLayout={measureCanvas}
            style={[
              styles.canvas,
              {
                margin: layout.canvasMargin,
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.canvasClip}>
              <CanvasViewport
                dark={dark}
                boardBackground={board?.settings.background ?? DEFAULT_BOARD_SETTINGS.background}
                boardStyle={board?.settings.style ?? DEFAULT_BOARD_SETTINGS.style}
                initialViewport={initialViewport}
                activeTool={activeTool}
                color={color}
                width={strokeWidth}
                opacity={opacity}
                eraserRadius={eraserRadius}
                laserColorKey={laserColorKey}
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
              <FloatingTimer
                visible={timerVisible}
                theme={theme}
                haptics={preferences.haptics}
                bounds={{
                  width: canvasRect.width > 0 ? canvasRect.width : width,
                  height: canvasRect.height > 0 ? canvasRect.height : windowHeight - 120,
                }}
                onPinToBoard={(timerState: TimerState) => {
                  const center = screenToCanvas(
                    {
                      x: (canvasRect.width > 0 ? canvasRect.width : width) / 2,
                      y: (canvasRect.height > 0 ? canvasRect.height : windowHeight - 120) / 2,
                    },
                    viewport,
                  );
                  const id = `timer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
                  const cmd = createTimerPinCommand(timerState, center, id, stickyColorKey);
                  runCommand(cmd, false);
                  if (cmd.type === 'object.insert') setSelectedObjectIds([cmd.object.id]);
                }}
                onClose={() => setTimerVisible(false)}
              />
              <FloatingCalculator
                visible={calculatorVisible}
                theme={theme}
                haptics={preferences.haptics}
                isTablet={tablet}
                bounds={{
                  width: canvasRect.width > 0 ? canvasRect.width : width,
                  height: canvasRect.height > 0 ? canvasRect.height : windowHeight - 120,
                }}
                onPasteToBoard={(expr, res) => {
                  const center = screenToCanvas(
                    {
                      x: (canvasRect.width > 0 ? canvasRect.width : width) / 2,
                      y: (canvasRect.height > 0 ? canvasRect.height : windowHeight - 120) / 2,
                    },
                    viewport,
                  );
                  const id = `calc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
                  const cmd = createCalculatorPasteCommand(expr, res, center, id, textColorKey);
                  runCommand(cmd, false);
                  if (cmd.type === 'object.insert') setSelectedObjectIds([cmd.object.id]);
                }}
                onClose={() => setCalculatorVisible(false)}
              />
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
                {selectedObject && !selectedIsImage && (
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

            {editingTextObject && (
              <View
                style={[
                  styles.editingFloatingBar,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    top: spacing.sm,
                    right: spacing.sm,
                  },
                ]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Text style options"
                  onPress={() => setObjectOptionsVisible((v) => !v)}
                  style={({ pressed }) => [
                    styles.editingBarButton,
                    objectOptionsVisible && { backgroundColor: theme.primary + '1F' },
                    pressed && styles.pressed,
                  ]}
                >
                  <StyleIcon size={16} color={objectOptionsVisible ? theme.primary : theme.foreground} />
                  <Text style={[styles.editingBarLabel, { color: objectOptionsVisible ? theme.primary : theme.foreground }]}>
                    Style
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Done editing text"
                  onPress={commitEditing}
                  style={({ pressed }) => [
                    styles.editingBarButton,
                    { backgroundColor: theme.primary },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.editingBarLabel, { color: '#FFFFFF', fontWeight: '700' }]}>
                    Done
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {tablet &&
          !editing &&
          selectedObjects.length > 0 &&
          (layout.inspectorPresentation === 'docked' ||
            layout.inspectorPresentation === 'overlay' ||
            layout.inspectorPresentation === 'edge-tab') && (
            <EditorInspectorPanel
              theme={theme}
              dark={dark}
              presentation={layout.inspectorPresentation}
              width={layout.inspectorWidth}
              selectedObjects={selectedObjects}
              onToggleOpen={() => setInspectorOpen((open) => !open)}
              onEditTextObject={startEditingExisting}
              onDuplicateSelected={duplicateSelected}
              onDeleteSelected={deleteSelected}
              onUpdateObjectStyle={updateObjectStyleById}
            />
          )}
      </View>

      {editingTextObject && objectOptionsVisible && (
        <ObjectOptionsSheet
          theme={theme}
          dark={dark}
          kind={editingTextObject.type}
          colorKey={editingTextObject.colorKey}
          fontSize={editingTextObject.fontSize}
          fontWeight={editingTextObject.fontWeight ?? 'normal'}
          fontStyle={editingTextObject.fontStyle ?? 'normal'}
          bottomOffset={
            isSoftwareKeyboardVisible(keyboardHeight)
              ? keyboardHeight + spacing.xs
              : optionsBottom
          }
          variant={layout.toolOptionsVariant}
          leftOffset={layout.toolPopoverLeft}
          topOffset={layout.toolPopoverTop}
          maxWidth={layout.toolPopoverMaxWidth}
          doneLabel="Close"
          doneHint="Closes text style options while keeping the editor active"
          showScrim={false}
          onHeightChange={setSheetHeight}
          onColorChange={(key) => updateDraft({ colorKey: key })}
          onFontSizeChange={(size) => updateDraft({ fontSize: size })}
          onFontWeightChange={(weight) => updateDraft({ fontWeight: weight })}
          onFontStyleChange={(style) => updateDraft({ fontStyle: style })}
          onDone={closeObjectOptions}
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
          variant={layout.toolOptionsVariant}
          leftOffset={layout.toolPopoverLeft}
          topOffset={layout.toolPopoverTop}
          maxWidth={layout.toolPopoverMaxWidth}
          doneLabel="Done"
          doneHint="Closes the style options"
          // Selecting the tool opens this sheet, so a full-screen scrim would
          // swallow the next canvas tap and the object would never be placed.
          showScrim={false}
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
          bottomOffset={optionsBottom}
          variant={layout.toolOptionsVariant}
          leftOffset={layout.toolPopoverLeft}
          topOffset={layout.toolPopoverTop}
          maxWidth={layout.toolPopoverMaxWidth}
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

      {!editing && !tablet && stylingTextObject && (
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

      {!editing && !tablet && stylingGeometricObject && (
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
          bottomOffset={optionsBottom}
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
          laserColorKey={laserColorKey}
          bottomOffset={optionsBottom}
          variant={layout.toolOptionsVariant}
          leftOffset={layout.toolPopoverLeft}
          topOffset={layout.toolPopoverTop}
          maxWidth={layout.toolPopoverMaxWidth}
          onToolChange={selectInkTool}
          onColorChange={setColor}
          onWidthChange={setStrokeWidth}
          onOpacityChange={setOpacity}
          onEraserRadiusChange={setEraserRadius}
          onLaserColorChange={setLaserColorKey}
          onClose={() => setInkOptionsVisible(false)}
        />
      )}
      {!tablet && !editing && isInkingTool && inkTrayOpen && (
        <InkingQuickTray
          theme={theme}
          dark={dark}
          activeTool={lastInkingTool}
          color={color}
          strokeWidth={strokeWidth}
          eraserRadius={eraserRadius}
          laserColorKey={laserColorKey}
          bottomOffset={ACTION_ISLAND_HEIGHT + spacing.sm + islandBottom}
          onToolChange={(tool) => {
            setLastInkingTool(tool);
            // Switching inside the tray keeps the tray open; only its
            // "more options" button opens the full ink sheet.
            setInkOptionsVisible(false);
            setActiveTool(tool);
          }}
          onColorChange={setColor}
          onWidthChange={setStrokeWidth}
          onEraserRadiusChange={setEraserRadius}
          onLaserColorChange={setLaserColorKey}
          onOpenFullOptions={() => {
            setInkTrayOpen(false);
            setInkOptionsVisible(true);
          }}
        />
      )}
      {!tablet && !editing && (
        <ActionIsland
          theme={theme}
          bottom={islandBottom}
          activeTool={activeTool}
          inkTool={lastInkingTool}
          inkColor={color}
          stickyColorKey={stickyColorKey}
          insertOpen={quickCreationOpen}
          onSelect={() => pressTool('select')}
          onDraw={toggleInking}
          onSticky={() => pressTool('sticky')}
          onInsert={() => {
            setInkTrayOpen(false);
            setInkOptionsVisible(false);
            setObjectOptionsVisible(false);
            setShapeOptionsVisible(false);
            setQuickCreationOpen(true);
          }}
        />
      )}
      {!tablet && !editing && (
        <QuickCreationSheet
          theme={theme}
          dark={dark}
          visible={quickCreationOpen}
          onClose={() => setQuickCreationOpen(false)}
          onSelectInsert={handleSelectInsert}
          onOpenShapeOptions={(kind) => {
            pressTool(kind);
            setShapeOptionsVisible(true);
          }}
          onOpenObjectOptions={(kind) => {
            pressTool(kind);
            setObjectOptionsVisible(true);
          }}
        />
      )}
      {imageFlowOpen && imageFlowId && boardId && (
        <ImageImportFlow
          key={imageFlowId}
          theme={theme}
          boardId={boardId}
          point={screenToCanvas(
            {
              x: canvasRect.width > 0 ? canvasRect.width / 2 : 180,
              y: canvasRect.height > 0 ? canvasRect.height / 2 : 300,
            },
            viewport,
          )}
          onPlace={placeImageObject}
          onClose={() => { setImageFlowOpen(false); setImageFlowId(null); }}
        />
      )}
      <ExportSheet
        visible={exportSheetVisible}
        theme={theme}
        dark={dark}
        boardTitle={title}
        document={document}
        viewport={viewport}
        canvasSize={{
          width: canvasRect.width > 0 ? canvasRect.width : width,
          height: canvasRect.height > 0 ? canvasRect.height : windowHeight - 120,
        }}
        settings={board?.settings ?? DEFAULT_BOARD_SETTINGS}
        selectedIds={selectedObjectIds}
        defaultFormat={preferences.exportFormat}
        onClose={() => setExportSheetVisible(false)}
      />
      <Modal
        visible={boardStyleModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setBoardStyleModalVisible(false)}
      >
        <Pressable style={styles.styleModalScrim} onPress={() => setBoardStyleModalVisible(false)}>
          <Pressable
            style={[styles.styleModalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => undefined}
          >
            <View style={styles.styleModalHeader}>
              <Text style={[styles.styleModalTitle, { color: theme.foreground }]}>Board background</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close board background options"
                onPress={() => setBoardStyleModalVisible(false)}
                hitSlop={8}
              >
                <Text style={[styles.styleModalDone, { color: theme.primary }]}>Done</Text>
              </Pressable>
            </View>
            <View style={styles.bgColorRow}>
              {(['light', 'white', 'dark'] as const).map((bg) => {
                const currentBg = board?.settings.background ?? DEFAULT_BOARD_SETTINGS.background;
                const active = currentBg === bg;
                const label = bg === 'white' ? 'White' : bg === 'dark' ? 'Dark' : 'Light';
                return (
                  <Pressable
                    key={bg}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${label} canvas color`}
                    onPress={() => {
                      if (boardId) {
                        const base = board?.settings ?? DEFAULT_BOARD_SETTINGS;
                        updateSettings(boardId, { ...base, background: bg as BoardBackground });
                      }
                    }}
                    style={[
                      styles.bgColorChip,
                      {
                        borderColor: active ? theme.primary : theme.border,
                        backgroundColor: active ? theme.primary + '16' : theme.background,
                      },
                    ]}
                  >
                    <Text style={[styles.bgColorChipText, { color: active ? theme.primary : theme.foreground }]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={[styles.styleOptionList, { borderColor: theme.border, backgroundColor: theme.background }]}>
              {BOARD_STYLE_OPTIONS.map((opt, idx) => {
                const currentStyle = board?.settings.style ?? DEFAULT_BOARD_SETTINGS.style;
                const active = currentStyle === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${opt.label}, ${opt.description}`}
                    onPress={() => {
                      if (boardId) {
                        const base = board?.settings ?? DEFAULT_BOARD_SETTINGS;
                        updateSettings(boardId, { ...base, style: opt.key as BoardStyle });
                      }
                      setBoardStyleModalVisible(false);
                    }}
                    style={[
                      styles.styleOptionRow,
                      idx > 0 && { borderTopWidth: 1, borderTopColor: theme.border },
                      active && { backgroundColor: theme.primary + '16' },
                    ]}
                  >
                    <View style={styles.styleOptionText}>
                      <Text style={[styles.styleOptionLabel, { color: active ? theme.primary : theme.foreground }]}>
                        {opt.label}
                      </Text>
                      <Text style={[styles.styleOptionDesc, { color: theme.foreground }]}>{opt.description}</Text>
                    </View>
                    {active && <CheckIcon size={20} color={theme.primary} />}
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function ToolRail({
  theme,
  activeTool,
  bottomInset,
  timerVisible,
  calculatorVisible,
  onToolPress,
  onToggleTimer,
  onToggleCalculator,
}: {
  theme: ThemeColors;
  activeTool: InkTool;
  bottomInset: number;
  timerVisible: boolean;
  calculatorVisible: boolean;
  onToolPress: (tool: InkTool) => void;
  onToggleTimer: () => void;
  onToggleCalculator: () => void;
}) {
  return (
    <View style={[styles.rail, { borderRightColor: theme.border, backgroundColor: theme.surface }]}>
      <ScrollView
        contentContainerStyle={[
          styles.railContent,
          { paddingBottom: bottomInset + spacing.md },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {TOOLS.map((definition) => {
          const { Icon, label, tool } = definition;
          const selected = activeTool === tool;
          const color = selected ? theme.primary : theme.foreground;
          return (
            <Pressable
              key={tool}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityHint={tool !== 'select' ? 'Opens the tool options when selected again' : undefined}
              accessibilityState={{ selected }}
              onPress={() => onToolPress(tool)}
              style={({ pressed }) => [styles.tool, pressed && styles.toolPressed]}
            >
              <View style={[styles.toolIconWrap, selected && { backgroundColor: theme.primary + '1F', borderColor: theme.primary }]}>
                <Icon size={22} color={color} />
              </View>
              <Text style={[styles.toolLabel, { color }]} numberOfLines={1}>{label}</Text>
            </Pressable>
          );
        })}
        <View style={[styles.railDivider, { backgroundColor: theme.border }]} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Toggle floating timer"
          accessibilityState={{ selected: timerVisible }}
          onPress={onToggleTimer}
          style={({ pressed }) => [styles.tool, pressed && styles.toolPressed]}
        >
          <View style={[styles.toolIconWrap, timerVisible && { backgroundColor: theme.primary + '1F', borderColor: theme.primary }]}>
            <TimerIcon size={22} color={timerVisible ? theme.primary : theme.foreground} />
          </View>
          <Text style={[styles.toolLabel, { color: timerVisible ? theme.primary : theme.foreground }]} numberOfLines={1}>Timer</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Toggle floating calculator"
          accessibilityState={{ selected: calculatorVisible }}
          onPress={onToggleCalculator}
          style={({ pressed }) => [styles.tool, pressed && styles.toolPressed]}
        >
          <View style={[styles.toolIconWrap, calculatorVisible && { backgroundColor: theme.primary + '1F', borderColor: theme.primary }]}>
            <CalculatorIcon size={22} color={calculatorVisible ? theme.primary : theme.foreground} />
          </View>
          <Text style={[styles.toolLabel, { color: calculatorVisible ? theme.primary : theme.foreground }]} numberOfLines={1}>Calc</Text>
        </Pressable>
      </ScrollView>
    </View>
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
  workspace: { flex: 1, flexDirection: 'row', position: 'relative' },
  rail: { width: 84, borderRightWidth: 1 },
  railContent: { alignItems: 'center', paddingTop: spacing.md, gap: spacing.xs },
  canvas: { flex: 1, margin: spacing.md, borderWidth: 1, borderRadius: radii.md },
  canvasClip: { flex: 1, overflow: 'hidden', borderRadius: radii.md },
  canvasGuidance: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg },
  canvasTitle: { ...typography.subtitle },
  canvasBody: { ...typography.body, opacity: 0.7, textAlign: 'center' },
  /** Tablet tool rail entries (the phone layout uses ActionIsland). */
  tool: { minWidth: DOCK_TOUCH_TARGET, minHeight: DOCK_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, gap: 2 },
  toolIconWrap: { width: 36, height: 32, borderWidth: 1, borderColor: 'transparent', borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  toolLabel: { ...typography.caption, fontSize: 11, textAlign: 'center' },
  toolPressed: { opacity: 0.65 },
  objectEditor: { position: 'absolute', zIndex: 10, textAlignVertical: 'top' },
  selectionRail: { position: 'absolute', zIndex: 20, borderWidth: 1, borderRadius: radii.sm, overflow: 'hidden' },
  selectionAction: { height: touchTarget, alignItems: 'center', justifyContent: 'center' },
  selectionActionSeparator: { borderTopWidth: 1 },
  editingFloatingBar: {
    position: 'absolute',
    zIndex: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: 4,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  editingBarButton: {
    minWidth: touchTarget,
    minHeight: touchTarget,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  editingBarLabel: {
    ...typography.caption,
    fontWeight: '600',
  },
  pressed: { opacity: 0.65 },
  storageBanner: { marginHorizontal: spacing.md, marginTop: spacing.sm, padding: spacing.md, borderWidth: 1, borderRadius: radii.sm },
  storageBannerText: { ...typography.caption, lineHeight: 18 },
  editorLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  editorLoadingText: { ...typography.body },
  railDivider: { width: 32, height: 1, marginVertical: spacing.xs },
  styleModalScrim: {
    flex: 1,
    backgroundColor: 'rgba(19, 78, 74, 0.24)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  styleModalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  styleModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  styleModalTitle: {
    ...typography.subtitle,
  },
  styleModalDone: {
    ...typography.bodyStrong,
  },
  bgColorRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  bgColorChip: {
    flex: 1,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
  },
  bgColorChipText: {
    ...typography.caption,
    fontWeight: '600',
  },
  styleOptionList: {
    borderRadius: radii.sm,
    borderWidth: 1,
    overflow: 'hidden',
  },
  styleOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  styleOptionText: {
    flex: 1,
    gap: 2,
  },
  styleOptionLabel: {
    ...typography.bodyStrong,
  },
  styleOptionDesc: {
    fontSize: 12,
    opacity: 0.72,
  },
});
