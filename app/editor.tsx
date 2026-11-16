import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ComponentRef,
} from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Pressable,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBoards } from '../src/board-context';
import { createCalculatorPasteCommand } from '../src/calculator/calculator-engine';
import {
  CANVAS_COLORS,
  OBJECT_PADDING,
  createDocumentHistory,
  createTableObject,
  documentHasContent,
  documentReducer,
  findObject,
  isMathObject,
  isTableObject,
  isTextualObject,
  objectFill,
  objectScreenRect,
  objectTextColor,
  tableCellRect,
  textColorKeyForValue,
  textColorValue,
  textLineHeight,
  type CanvasObject,
  type DocumentCommand,
} from '../src/canvas/document';
import {
  createDefaultInstrument,
  type GeometryInstrumentState,
  type InstrumentKind,
} from '../src/canvas/geometry-box';
import {
  canRedo as historyCanRedo,
  canUndo as historyCanUndo,
  nextRedoLabel,
  nextUndoLabel,
} from '../src/canvas/history';
import { createInkStroke, type FreehandTool } from '../src/canvas/ink';
import type { LaserColorKey } from '../src/canvas/laser';
import { canvasRectToScreen, selectionActionRail, selectionBounds } from '../src/canvas/selection';
import { screenToCanvas, type Point, type Viewport } from '../src/canvas/viewport';
import { ACTION_ISLAND_HEIGHT, ActionIsland } from '../src/components/ActionIsland';
import { CanvasViewport, type InkTool, type ViewportRequest } from '../src/components/CanvasViewport';
import { ClassroomHud } from '../src/components/ClassroomHud';
import { EditorInspectorPanel } from '../src/components/EditorInspectorPanel';
import { ExportSheet } from '../src/components/ExportSheet';
import { FaceCamBubble } from '../src/components/FaceCamBubble';
import { FlashcardStudyModal } from '../src/components/FlashcardStudyModal';
import { FloatingCalculator } from '../src/components/FloatingCalculator';
import { FloatingTimer } from '../src/components/FloatingTimer';
import { GeometryBoxOverlay } from '../src/components/GeometryBoxOverlay';
import { ImageImportFlow } from '../src/components/ImageImportFlow';
import { InkOptionsSheet, type InkSheetTool } from '../src/components/InkOptionsSheet';
import { InkingQuickTray } from '../src/components/InkingQuickTray';
import { LessonRecorderBar } from '../src/components/LessonRecorderBar';
import { LessonReplayModal } from '../src/components/LessonReplayModal';
import { LiveClassHostSheet } from '../src/components/LiveClassHostSheet';
import { MathKeyboardSheet } from '../src/components/MathKeyboardSheet';
import { ObjectOptionsSheet } from '../src/components/ObjectOptionsSheet';
import { OcrReviewScreen } from '../src/components/OcrReviewScreen';
import { PageNavigatorPill, PageSorterSheet } from '../src/components/PageNavigator';
import { PdfImportModal } from '../src/components/PdfImportModal';
import { PhoneRecallSelectionBar } from '../src/components/PhoneRecallSelectionBar';
import { PhoneStemSelectionBar } from '../src/components/PhoneStemSelectionBar';
import { PollOverlayModal } from '../src/components/PollOverlayModal';
import { QuickBranchHandles } from '../src/components/QuickBranchHandles';
import { QuickCreationSheet, type InsertToolRequest } from '../src/components/QuickCreationSheet';
import { SavedLessonsModal } from '../src/components/SavedLessonsModal';
import { ShapeOptionsSheet } from '../src/components/ShapeOptionsSheet';
import { StageCurtainOverlay } from '../src/components/StageCurtainOverlay';
import { VoicePinBar } from '../src/components/VoicePinBar';
import { BoardStyleModal } from '../src/components/editor/BoardStyleModal';
import { EditorToolRail } from '../src/components/editor/EditorToolRail';
import { EditorTopBar } from '../src/components/editor/EditorTopBar';
import { InlineMathBar } from '../src/components/editor/InlineMathBar';
import { SelectionActionRail } from '../src/components/editor/SelectionActionRail';
import { PenIcon, StyleIcon } from '../src/components/icons';
import { useEditorLiveClass } from '../src/hooks/editor/useEditorLiveClass';
import { useEditorOcrAndMath } from '../src/hooks/editor/useEditorOcrAndMath';
import { useEditorPersistence } from '../src/hooks/editor/useEditorPersistence';
import { useEditorRecorder } from '../src/hooks/editor/useEditorRecorder';
import { useEditorSelectionAndEditing } from '../src/hooks/editor/useEditorSelectionAndEditing';
import { useClassroomPoll } from '../src/hooks/useClassroomPoll';
import { useMagneticMindMap } from '../src/hooks/useMagneticMindMap';
import { useRevealAndCurtain } from '../src/hooks/useRevealAndCurtain';
import { useStemGraphing } from '../src/hooks/useStemGraphing';
import { useVoicePins } from '../src/hooks/useVoicePins';
import { DEFAULT_BOARD_SETTINGS, type BoardPageRecord } from '../src/persistence/repository';
import type { BoardSettings } from '../src/persistence/schema';
import { isSoftwareKeyboardVisible, resolveEditorLayout } from '../src/responsive/layout';
import { editorStyles as styles } from '../src/screens/editor.styles';
import { usePreferences } from '../src/settings/preferences-context';
import { colors, radii, spacing } from '../src/theme';
import { createTimerPinCommand, type TimerState } from '../src/timer/timer-model';
import { triggerHapticFeedback } from '../src/utils/haptics';

/** Zoomed in enough that ink is comfortable under a finger. */
const INITIAL_VIEWPORT: Viewport = { x: 150, y: -80, scale: 2 };
/** How long viewport reports may be batched before the editor re-renders. */
const VIEWPORT_RENDER_INTERVAL = 60;

export default function BoardEditorScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const {
    boardId,
    liveRole,
    roomCode: paramRoomCode,
    displayName: paramDisplayName,
    projectorMode: paramProjectorMode,
  } = useLocalSearchParams<{
    boardId?: string;
    liveRole?: string;
    roomCode?: string;
    displayName?: string;
    projectorMode?: string;
  }>();

  const isStudentRoute = liveRole === 'student' && Boolean(paramRoomCode);
  const isProjectorMode = isStudentRoute && paramProjectorMode === '1';

  const { boards, updateTitle, updateSettings, touchBoard } = useBoards();
  const board = useMemo(
    () => boards.find((item) => item.id === boardId),
    [boardId, boards],
  );
  const [title, setTitle] = useState(board?.title ?? 'Untitled board');
  const boardTitle = board?.title;
  useEffect(() => {
    if (boardTitle) setTitle(boardTitle);
  }, [board?.id, boardTitle]);

  const insets = useSafeAreaInsets();
  const { width, height: windowHeight } = useWindowDimensions();
  const { preferences, updatePreference, theme, isDark, reducedMotion } = usePreferences();
  const dark = isDark;

  const [history, dispatch] = useReducer(documentReducer, createDocumentHistory());
  const document = history.present;
  const canUndo = historyCanUndo(history);
  const canRedo = historyCanRedo(history);
  const undoLabel = nextUndoLabel(history);
  const redoLabel = nextRedoLabel(history);

  const [activeTool, setActiveTool] = useState<InkTool>('select');
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);
  const [selectedInkIds, setSelectedInkIds] = useState<string[]>([]);
  const [activeInstrument, setActiveInstrument] = useState<GeometryInstrumentState | null>(null);

  const [canvasRect, setCanvasRect] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const canvasRef = useRef<ComponentRef<typeof View> | null>(null);

  const viewportLive = useRef<Viewport>(INITIAL_VIEWPORT);
  const [initialViewport, setInitialViewport] = useState<Viewport>(INITIAL_VIEWPORT);
  const [viewport, setViewport] = useState<Viewport>(INITIAL_VIEWPORT);
  const viewportFlushedAt = useRef(0);
  const viewportTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [viewportRequest, setViewportRequest] = useState<ViewportRequest | null>(null);

  const canvasBounds = useMemo(
    () => ({
      width: canvasRect.width > 0 ? canvasRect.width : width,
      height: canvasRect.height > 0 ? canvasRect.height : windowHeight - 120,
    }),
    [canvasRect.height, canvasRect.width, width, windowHeight],
  );

  const getViewportCenterPoint = useCallback(
    () =>
      screenToCanvas(
        { x: canvasBounds.width / 2, y: canvasBounds.height / 2 },
        viewport,
      ),
    [canvasBounds.height, canvasBounds.width, viewport],
  );

  const requestViewport = useCallback((next: Viewport) => {
    if (
      !next ||
      !Number.isFinite(next.x) ||
      !Number.isFinite(next.y) ||
      !Number.isFinite(next.scale) ||
      next.scale <= 0
    ) {
      return;
    }
    viewportLive.current = next;
    setViewport(next);
    setViewportRequest((current) => ({ key: (current?.key ?? 0) + 1, viewport: next }));
  }, []);

  const selectedObjects = useMemo(
    () => document.objects.filter((object) => selectedObjectIds.includes(object.id)),
    [document.objects, selectedObjectIds],
  );
  const selectedObject = selectedObjects.length === 1 ? selectedObjects[0] : null;

  // Tool preferences (ink)
  const [color, setColor] = useState<string>(() => {
    const token = CANVAS_COLORS.find(
      (c) =>
        c.key === preferences.defaultPenColor ||
        c.light.toLowerCase() === preferences.defaultPenColor.toLowerCase() ||
        c.dark.toLowerCase() === preferences.defaultPenColor.toLowerCase(),
    );
    if (token) return dark ? token.dark : token.light;
    return preferences.defaultPenColor || theme.foreground;
  });
  const [strokeWidth, setStrokeWidth] = useState(preferences.defaultPenWidth ?? 4);
  const [opacity, setOpacity] = useState(1);
  const [eraserRadius, setEraserRadius] = useState(24);
  const [inkOptionsVisible, setInkOptionsVisible] = useState(false);
  const [inkTrayOpen, setInkTrayOpen] = useState(false);
  const [lastInkingTool, setLastInkingTool] = useState<FreehandTool | 'eraser' | 'laser'>('pen');
  const [laserColorKey, setLaserColorKey] = useState<LaserColorKey>('red');

  const [exportSheetVisible, setExportSheetVisible] = useState(false);
  const [quickCreationOpen, setQuickCreationOpen] = useState(false);
  const [imageFlowOpen, setImageFlowOpen] = useState(false);
  const [imageFlowId, setImageFlowId] = useState<string | null>(null);
  const [timerVisible, setTimerVisible] = useState(false);
  const [calculatorVisible, setCalculatorVisible] = useState(false);
  const [faceCamVisible, setFaceCamVisible] = useState(false);
  const [boardStyleModalVisible, setBoardStyleModalVisible] = useState(false);
  const [pageSorterVisible, setPageSorterVisible] = useState(false);
  const [pdfImportVisible, setPdfImportVisible] = useState(false);
  const [flashcardsVisible, setFlashcardsVisible] = useState(false);

  // Keep ink colour legible when theme changes
  useEffect(() => {
    setColor((current) => {
      const key = textColorKeyForValue(current);
      return key ? textColorValue(key, dark) : current;
    });
  }, [dark]);

  useEffect(
    () => () => {
      if (viewportTimer.current) clearTimeout(viewportTimer.current);
    },
    [],
  );

  // Preliminary tablet classification for hook coordination
  const prelimTablet = useMemo(() => {
    const prelim = resolveEditorLayout(width, windowHeight, insets);
    return {
      tablet: prelim.navigationMode === 'rail',
      isTabletLandscape: prelim.profile.isTabletLandscape,
    };
  }, [insets, width, windowHeight]);

  // Ref-forwarded callbacks so persistence/selection hooks integrate cleanly with math/recorder/live
  const onBeforePageSwitchRef = useRef<
    ((target: BoardPageRecord, index: number, vp: Viewport) => void) | null
  >(null);

  const ocrAndMath = useEditorOcrAndMath({
    boardId,
    document,
    haptics: preferences.haptics,
    textColorKey: 'ink',
    textSize: 16,
    selectedInkIds,
    getViewportCenterPoint,
    dispatch,
    setSelectedObjectIds,
    setSelectedInkIds,
    setActiveTool,
  });

  const selectionEditing = useEditorSelectionAndEditing({
    document,
    viewportLive,
    canvasRect,
    windowHeight,
    tablet: prelimTablet.tablet,
    isTabletLandscape: prelimTablet.isTabletLandscape,
    selectedObjectIds,
    setSelectedObjectIds,
    dispatch,
    requestViewport,
    editingMathInline: ocrAndMath.editingMathInline,
    setEditingMathInline: ocrAndMath.setEditingMathInline,
    mathInlineInputRef: ocrAndMath.mathInlineInputRef,
    commitInlineMath: ocrAndMath.commitInlineMath,
    setMathSheetVisible: ocrAndMath.setMathSheetVisible,
    setEditingMathObject: ocrAndMath.setEditingMathObject,
  });

  const layout = useMemo(
    () =>
      resolveEditorLayout(
        width,
        windowHeight,
        insets,
        {
          hasSelection: selectedObjects.length > 0,
          inspectorOpen: selectionEditing.inspectorOpen,
          isEditingText: Boolean(selectionEditing.editing),
        },
        ACTION_ISLAND_HEIGHT,
      ),
    [
      insets,
      selectedObjects.length,
      selectionEditing.editing,
      selectionEditing.inspectorOpen,
      width,
      windowHeight,
    ],
  );
  const tablet = layout.navigationMode === 'rail';

  const persistence = useEditorPersistence({
    boardId,
    initialDefaultViewport: INITIAL_VIEWPORT,
    document,
    viewport,
    viewportLive,
    dispatch,
    touchBoard,
    setInitialViewport,
    setViewport,
    commitEditing: selectionEditing.commitEditing,
    setSelectedObjectIds,
    setSelectedInkIds,
    setActiveTool,
    onBeforePageSwitch: useCallback(
      (target: BoardPageRecord, idx: number, nextVp: Viewport) =>
        onBeforePageSwitchRef.current?.(target, idx, nextVp),
      [],
    ),
  });

  const recorder = useEditorRecorder({
    boardId,
    title,
    document,
    pages: persistence.pages,
    activePageIdRef: persistence.activePageIdRef,
    viewportLive,
    initialDefaultViewport: INITIAL_VIEWPORT,
    canvasRect,
  });

  const liveClass = useEditorLiveClass({
    boardId,
    boardSettings: board?.settings,
    title,
    setTitle,
    isStudentRoute,
    isProjectorMode,
    paramRoomCode,
    paramDisplayName,
    document,
    documentRef: persistence.documentRef,
    pages: persistence.pages,
    activePageId: persistence.activePageId,
    activePageIdRef: persistence.activePageIdRef,
    viewportLive,
    dispatch,
    requestViewport,
    setActiveInstrument,
    router,
    navigation,
  });

  onBeforePageSwitchRef.current = (target, targetIndex, nextViewport) => {
    recorder.recordPageSwitchIfActive(target.id, targetIndex, target.document, nextViewport);
    liveClass.broadcastHostPageSwitchIfActive(target, nextViewport);
  };

  // Phone landscape orientation lock
  useEffect(() => {
    if (tablet) return;
    let active = true;
    void (async () => {
      try {
        const ScreenOrientation = await import('expo-screen-orientation');
        if (active) {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        }
      } catch {
        // Ignore if unavailable in build
      }
    })();
    return () => {
      active = false;
      void (async () => {
        try {
          const ScreenOrientation = await import('expo-screen-orientation');
          await ScreenOrientation.unlockAsync();
        } catch {
          // Ignore cleanup errors
        }
      })();
    };
  }, [tablet]);

  const reportViewport = useCallback(
    (next: Viewport) => {
      viewportLive.current = next;
      persistence.scheduleViewportSave(next);
      recorder.recordViewportIfActive(next);
      liveClass.broadcastHostViewportIfActive(next);

      const now = Date.now();
      if (now - viewportFlushedAt.current >= VIEWPORT_RENDER_INTERVAL) {
        viewportFlushedAt.current = now;
        setViewport(next);
        return;
      }
      if (viewportTimer.current) return;
      viewportTimer.current = setTimeout(() => {
        viewportTimer.current = null;
        viewportFlushedAt.current = Date.now();
        setViewport(viewportLive.current);
      }, VIEWPORT_RENDER_INTERVAL);
    },
    [liveClass, persistence, recorder],
  );

  const measureCanvas = useCallback(() => {
    canvasRef.current?.measureInWindow((x, y, measuredWidth, measuredHeight) => {
      setCanvasRect({ x, y, width: measuredWidth, height: measuredHeight });
    });
  }, []);

  useEffect(() => {
    if (!persistence.hydrated) return;
    const timer = setTimeout(measureCanvas, 32);
    return () => clearTimeout(timer);
  }, [
    persistence.hydrated,
    width,
    windowHeight,
    layout.navigationMode,
    layout.inspectorPresentation,
    measureCanvas,
  ]);

  const runCommand = useCallback((command: DocumentCommand, transient?: boolean) => {
    dispatch({ type: 'command', command, transient });
  }, []);
  const runBatchCommands = useCallback((commands: readonly DocumentCommand[]) => {
    dispatch({ type: 'commands', commands });
  }, []);
  const measureObject = useCallback((id: string, height: number) => {
    dispatch({ type: 'measure', id, height });
  }, []);
  const commitPending = useCallback(() => dispatch({ type: 'commit' }), []);

  const pressTool = useCallback(
    (tool: InkTool) => {
      void triggerHapticFeedback('selection', preferences.haptics);
      if (selectionEditing.editingRef.current) selectionEditing.commitEditing();
      selectionEditing.setStylingObjectId(null);
      if (tool !== 'select') setSelectedObjectIds([]);
      if (tool === 'pen' || tool === 'highlighter' || tool === 'eraser' || tool === 'laser') {
        selectionEditing.setObjectOptionsVisible(false);
        selectionEditing.setShapeOptionsVisible(false);
        setLastInkingTool(tool);
        const retap = activeTool === tool;
        setActiveTool(tool);
        if (tablet) {
          setInkTrayOpen(false);
          setInkOptionsVisible((v) => (retap ? !v : true));
        } else {
          setInkOptionsVisible(false);
          setInkTrayOpen((open) => (retap ? !open : true));
        }
        return;
      }
      setInkTrayOpen(false);
      setInkOptionsVisible(false);
      if (tool === 'shape' || tool === 'connector') {
        selectionEditing.setObjectOptionsVisible(false);
        selectionEditing.setShapeOptionsVisible((v) => (activeTool === tool ? !v : true));
      } else if (tool === 'text' || tool === 'sticky') {
        selectionEditing.setObjectOptionsVisible((v) => (activeTool === tool ? !v : true));
      } else if (tool === 'image') {
        setImageFlowId(`${boardId}-${Date.now()}`);
        setImageFlowOpen(true);
        return;
      }
      setActiveTool(tool);
    },
    [activeTool, boardId, preferences.haptics, selectionEditing, tablet],
  );

  const toggleInking = useCallback(() => {
    void triggerHapticFeedback('selection', preferences.haptics);
    if (selectionEditing.editingRef.current) selectionEditing.commitEditing();
    selectionEditing.setStylingObjectId(null);
    setSelectedObjectIds([]);
    selectionEditing.setObjectOptionsVisible(false);
    selectionEditing.setShapeOptionsVisible(false);
    if (
      activeTool === 'pen' ||
      activeTool === 'highlighter' ||
      activeTool === 'eraser' ||
      activeTool === 'laser'
    ) {
      setInkTrayOpen((open) => !open);
    } else {
      setActiveTool(lastInkingTool);
      setInkTrayOpen(true);
    }
  }, [activeTool, lastInkingTool, preferences.haptics, selectionEditing]);

  const handleSwitchInstrument = useCallback((kind: InstrumentKind) => {
    setActiveInstrument((prev) =>
      createDefaultInstrument(kind, { x: prev?.x ?? 0, y: prev?.y ?? 0 }),
    );
  }, []);

  const handleCommitGeometryStroke = useCallback(
    (points: readonly { x: number; y: number }[]) => {
      if (points.length === 0) return;
      let stroke = createInkStroke({
        id: `geo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        tool: 'pen',
        point: points[0],
        color,
        width: strokeWidth,
        opacity: 1,
      });
      for (let i = 1; i < points.length; i += 1) {
        stroke = { ...stroke, points: [...stroke.points, points[i]] };
      }
      dispatch({ type: 'command', command: { type: 'ink.add', stroke } });
    },
    [color, strokeWidth],
  );

  const handleCloseGeometryBox = useCallback(() => {
    setActiveInstrument(null);
  }, []);

  const selectInkTool = useCallback((tool: FreehandTool) => {
    setActiveTool(tool);
    setInkOptionsVisible(true);
  }, []);

  const undo = useCallback(() => {
    void triggerHapticFeedback('selection', preferences.haptics);
    if (selectionEditing.editingRef.current) {
      selectionEditing.commitEditing();
      return;
    }
    dispatch({ type: 'undo' });
  }, [preferences.haptics, selectionEditing]);

  const redo = useCallback(() => {
    void triggerHapticFeedback('selection', preferences.haptics);
    if (selectionEditing.editingRef.current) {
      selectionEditing.commitEditing();
      return;
    }
    dispatch({ type: 'redo' });
  }, [preferences.haptics, selectionEditing]);

  const isCanvasReadOnly = Boolean(
    Boolean(liveClass.showcasedName) ||
      (liveClass.classroomState?.active &&
        liveClass.classroomState.role === 'student' &&
        !liveClass.isScratchpadMode &&
        (isProjectorMode ||
          liveClass.classroomState.myPermission !== 'can-draw' ||
          liveClass.classroomState.roomInfo?.isLocked)),
  );

  const { quickBranchTarget, canTidySelection, handleQuickBranch, handleTidyLayout } =
    useMagneticMindMap({
      document,
      selectedObjects,
      editing: Boolean(selectionEditing.editing),
      isReadOnly: isCanvasReadOnly,
      connectorColorKey: selectionEditing.connectorColorKey,
      dispatchCommand: runCommand,
      dispatchBatchCommands: runBatchCommands,
      setSelectedIds: setSelectedObjectIds,
    });

  const {
    plottableMath,
    selectedFunctionPlot,
    numericTable,
    handlePlotMathObject,
    handleUpdatePlotParam,
    handleCommitPlotChanges,
    handleTogglePlotTangent,
    handleUpdateTangentX,
    handleGenerateChart,
    handleComputeTableStats,
  } = useStemGraphing({
    selectedObjects,
    isReadOnly: isCanvasReadOnly,
    dispatchCommand: runCommand,
    commitPending,
    setSelectedIds: setSelectedObjectIds,
  });

  const {
    stageOverlayVisible,
    stageOverlayMode,
    setStageOverlayMode,
    hidePrivatePreview,
    canCoverWithTape,
    hasRevealedTapes,
    hasPrivateObjects,
    handleToggleRevealTape,
    handleInsertRevealTapeAt,
    handleCoverSelectionWithTape,
    handleResetAllTapes,
    handleToggleSelectedPrivate,
    handleOpenStageOverlay,
    handleCloseStageOverlay,
    handleToggleHidePrivatePreview,
  } = useRevealAndCurtain({
    document,
    selectedObjects,
    haptics: preferences.haptics,
    isReadOnly: isCanvasReadOnly,
    dispatchCommand: runCommand,
    dispatchBatchCommands: runBatchCommands,
    setSelectedIds: setSelectedObjectIds,
  });

  const {
    isRecording: voicePinRecording,
    recordingMs: voicePinRecordingMs,
    livePeaks: voicePinLivePeaks,
    playingPinId: playingVoicePinId,
    errorMessage: voicePinError,
    permissionBlocked: voicePinPermissionBlocked,
    handleStartVoicePinAt,
    handleStopVoicePinRecording,
    handleCancelVoicePinRecording,
    handleTogglePlayById: handleTogglePlayVoicePinById,
    handleStopPlayback: handleStopVoicePinPlayback,
    handleOpenSettings: handleOpenVoicePinSettings,
    handleDismissError: handleDismissVoicePinError,
  } = useVoicePins({
    boardId: boardId ?? 'local-board',
    document,
    haptics: preferences.haptics,
    isReadOnly: isCanvasReadOnly,
    getViewportCenterPoint,
    dispatchCommand: runCommand,
    setSelectedIds: setSelectedObjectIds,
  });

  const {
    pollModalVisible,
    activePoll,
    handleOpenPollModal,
    handleClosePollModal,
    handleStartPoll,
    handleVote: handleVoteInPoll,
    handleClosePoll,
    handleClearPoll,
    handleInsertChartOnBoard: handleInsertPollChartOnBoard,
  } = useClassroomPoll({
    classroomSession: liveClass.classroomSessionRef.current,
    classroomState: liveClass.classroomState,
    getViewportCenterPoint,
    dispatchCommand: runCommand,
    setSelectedIds: setSelectedObjectIds,
  });

  const handlePlaceRevealTapeAt = useCallback(
    (point: Point, rect?: { x: number; y: number; width: number; height: number }) => {
      handleInsertRevealTapeAt(point, rect);
      setActiveTool('select');
    },
    [handleInsertRevealTapeAt],
  );

  const handleSelectInsert = useCallback(
    (request: InsertToolRequest) => {
      if (request.type === 'sticky') {
        if (request.colorKey) selectionEditing.setStickyColorKey(request.colorKey);
        pressTool('sticky');
      } else if (request.type === 'text') {
        if (request.colorKey) selectionEditing.setTextColorKey(request.colorKey);
        pressTool('text');
      } else if (request.type === 'shape') {
        selectionEditing.setShapeKind(request.shape);
        pressTool('shape');
      } else if (request.type === 'connector') {
        selectionEditing.setConnectorStyle(request.style);
        pressTool('connector');
      } else if (request.type === 'table') {
        const center = getViewportCenterPoint();
        const table = createTableObject({
          id: `table-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          point: center,
          rows: request.rows,
          columns: request.columns,
        });
        dispatch({ type: 'command', command: { type: 'object.insert', object: table } });
        setSelectedObjectIds([table.id]);
        setActiveTool('select');
      } else if (request.type === 'geometry') {
        const center = getViewportCenterPoint();
        setActiveInstrument(createDefaultInstrument(request.instrument, center));
        if (activeTool === 'select') setActiveTool('pen');
      } else if (request.type === 'math') {
        ocrAndMath.setEditingMathObject(null);
        ocrAndMath.setMathSheetVisible(true);
      } else if (request.type === 'image') {
        if (!boardId) return;
        setImageFlowId(`${boardId}-${Date.now()}`);
        setImageFlowOpen(true);
      } else if (request.type === 'pdf') {
        if (!boardId) return;
        setPdfImportVisible(true);
      } else if (request.type === 'timer') {
        setTimerVisible(true);
      } else if (request.type === 'calculator') {
        setCalculatorVisible(true);
      } else if (request.type === 'facecam') {
        setFaceCamVisible((prev) => !prev);
      } else if (request.type === 'recorder') {
        recorder.setRecorderBarVisible(true);
      } else if (request.type === 'saved-lessons') {
        recorder.setSavedLessonsVisible(true);
      } else if (request.type === 'reveal-tape') {
        pressTool('reveal-tape');
      } else if (request.type === 'voice-pin') {
        void handleStartVoicePinAt();
      } else if (request.type === 'curtain') {
        handleOpenStageOverlay('curtain');
      } else if (request.type === 'spotlight') {
        handleOpenStageOverlay('spotlight');
      } else if (request.type === 'flashcards') {
        setFlashcardsVisible(true);
      }
    },
    [
      activeTool,
      boardId,
      getViewportCenterPoint,
      handleOpenStageOverlay,
      handleStartVoicePinAt,
      ocrAndMath,
      pressTool,
      recorder,
      selectionEditing,
    ],
  );

  // Derived selection metrics
  const selectedBounds = useMemo(() => selectionBounds(selectedObjects), [selectedObjects]);
  const selectedRect = useMemo(
    () =>
      selectedBounds && !selectionEditing.editing
        ? canvasRectToScreen(selectedBounds, viewport)
        : null,
    [selectedBounds, selectionEditing.editing, viewport],
  );
  const selectedIsTextual = selectedObject ? isTextualObject(selectedObject) : false;
  const selectedIsMath = selectedObject ? isMathObject(selectedObject) : false;
  const selectedIsImage = selectedObject?.type === 'image';
  const selectedIsTable = selectedObject?.type === 'table';
  const selectedIsStemDiagram =
    selectedObject?.type === 'function-plot' || selectedObject?.type === 'chart';

  const selectionActionCount =
    selectedObjects.length === 0
      ? 0
      : selectedObject
        ? selectedIsTextual
          ? 4
          : selectedIsMath
            ? plottableMath
              ? 4
              : 3
            : selectedIsTable
              ? 4
              : selectedIsImage || selectedIsStemDiagram
                ? 2
                : 3
        : canTidySelection
          ? 5
          : 2;

  const canvasBorder = 1;
  const rawActionRail =
    selectedRect && !selectionEditing.editing && canvasRect.width > 0
      ? selectionActionRail(
          selectedRect,
          selectionActionCount,
          canvasRect.width - canvasBorder * 2,
          canvasRect.height - canvasBorder * 2,
        )
      : null;

  const actionRail = useMemo(() => {
    if (!rawActionRail || !selectedRect) return rawActionRail;
    const isRotatedSideways =
      selectedObject &&
      Math.abs(Math.sin((selectedObject.rotation * Math.PI) / 180)) > 0.35;
    if (!isRotatedSideways && rawActionRail.placement !== 'inside') {
      return rawActionRail;
    }
    const maxCanvasH = Math.max(80, canvasRect.height - canvasBorder * 2);
    const belowY = selectedRect.y + selectedRect.height + 18;
    const aboveY = selectedRect.y - rawActionRail.height - 18;
    const nextY =
      belowY + rawActionRail.height <= maxCanvasH - 8
        ? belowY
        : aboveY >= 8
          ? aboveY
          : rawActionRail.y;
    return { ...rawActionRail, y: nextY };
  }, [canvasRect.height, rawActionRail, selectedObject, selectedRect]);

  const selectionLabel =
    selectedObjects.length === 1
      ? `${selectedObjects[0].type} selected`
      : `${selectedObjects.length} objects selected`;

  const stylingObject = selectionEditing.stylingObjectId
    ? findObject(document, selectionEditing.stylingObjectId)
    : null;
  const stylingTextObject =
    stylingObject && isTextualObject(stylingObject) ? stylingObject : null;
  const stylingGeometricObject =
    stylingObject && (stylingObject.type === 'shape' || stylingObject.type === 'connector')
      ? stylingObject
      : null;

  const sheetTool: InkSheetTool =
    activeTool === 'eraser'
      ? 'eraser'
      : activeTool === 'highlighter'
        ? 'highlighter'
        : activeTool === 'laser'
          ? 'laser'
          : 'pen';
  const isInkingTool =
    activeTool === 'pen' ||
    activeTool === 'highlighter' ||
    activeTool === 'eraser' ||
    activeTool === 'laser';
  const islandBottom = layout.islandBottom;
  const optionsBottom = layout.optionsBottom;
  const showGuidance = !documentHasContent(document) && !selectionEditing.editing;

  const editingTextObject =
    selectionEditing.editing && isTextualObject(selectionEditing.editing.object)
      ? selectionEditing.editing.object
      : null;
  const overlayRect = editingTextObject ? objectScreenRect(editingTextObject, viewport) : null;
  const overlayFill = editingTextObject ? objectFill(editingTextObject) : undefined;
  const overlayTextColor = editingTextObject
    ? objectTextColor(editingTextObject, dark)
    : theme.foreground;
  const overlayLineHeight = editingTextObject ? textLineHeight(editingTextObject.fontSize) : 0;

  const editingMathSpan = useMemo(
    () =>
      ocrAndMath.editingMathInline?.span
        ? {
            objectId: ocrAndMath.editingMathInline.objectId,
            span: ocrAndMath.editingMathInline.span,
          }
        : null,
    [ocrAndMath.editingMathInline],
  );

  // Stable UI callbacks
  const handleBack = useCallback(() => {
    selectionEditing.commitEditing();
    router.back();
  }, [router, selectionEditing]);

  const handleChangeTitle = useCallback(
    (value: string) => {
      setTitle(value);
      if (boardId) updateTitle(boardId, value);
    },
    [boardId, updateTitle],
  );

  const handleOpenBoardStyle = useCallback(() => {
    selectionEditing.commitEditing();
    setBoardStyleModalVisible(true);
  }, [selectionEditing]);

  const handlePressLiveClass = useCallback(() => {
    selectionEditing.commitEditing();
    liveClass.handlePressLiveClassButton();
  }, [liveClass, selectionEditing]);

  const handleOpenExportMenu = useCallback(() => {
    selectionEditing.commitEditing();
    setExportSheetVisible(true);
  }, [selectionEditing]);

  const handleToggleGeometryBox = useCallback(() => {
    setActiveInstrument((prev) =>
      prev ? null : createDefaultInstrument('ruler', { x: 0, y: 0 }),
    );
  }, []);

  const handleOpenMathSheet = useCallback(() => {
    ocrAndMath.setEditingMathObject(null);
    ocrAndMath.setMathSheetVisible(true);
  }, [ocrAndMath]);

  const handleOpenPdfImport = useCallback(() => {
    selectionEditing.commitEditing();
    setPdfImportVisible(true);
  }, [selectionEditing]);

  const handleToggleTimer = useCallback(() => setTimerVisible((v) => !v), []);
  const handleToggleCalculator = useCallback(() => setCalculatorVisible((v) => !v), []);
  const handleToggleFaceCam = useCallback(() => setFaceCamVisible((v) => !v), []);
  const handleToggleRecorder = useCallback(
    () => recorder.setRecorderBarVisible((v) => !v),
    [recorder],
  );
  const handleOpenSavedLessons = useCallback(
    () => recorder.setSavedLessonsVisible(true),
    [recorder],
  );
  const handleStartVoicePinFromRail = useCallback(() => {
    void handleStartVoicePinAt();
  }, [handleStartVoicePinAt]);
  const handleStartVoicePinAtPoint = useCallback(
    (pt: Point) => {
      void handleStartVoicePinAt(pt);
      setActiveTool('select');
    },
    [handleStartVoicePinAt],
  );
  const handleOpenFlashcards = useCallback(() => setFlashcardsVisible(true), []);

  const handlePinTimerToBoard = useCallback(
    (timerState: TimerState) => {
      const center = getViewportCenterPoint();
      const id = `timer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const cmd = createTimerPinCommand(
        timerState,
        center,
        id,
        selectionEditing.stickyColorKey,
      );
      runCommand(cmd, false);
      if (cmd.type === 'object.insert') setSelectedObjectIds([cmd.object.id]);
    },
    [getViewportCenterPoint, runCommand, selectionEditing.stickyColorKey],
  );

  const handlePasteCalcToBoard = useCallback(
    (expr: string, res: string) => {
      const center = getViewportCenterPoint();
      const id = `calc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const cmd = createCalculatorPasteCommand(
        expr,
        res,
        center,
        id,
        selectionEditing.textColorKey,
      );
      runCommand(cmd, false);
      if (cmd.type === 'object.insert') setSelectedObjectIds([cmd.object.id]);
    },
    [getViewportCenterPoint, runCommand, selectionEditing.textColorKey],
  );

  const handleChangeBoardSettings = useCallback(
    (next: BoardSettings) => {
      if (boardId) updateSettings(boardId, next);
    },
    [boardId, updateSettings],
  );

  const effectiveBoardSettings =
    liveClass.liveBoardSettings ?? board?.settings ?? DEFAULT_BOARD_SETTINGS;

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <EditorTopBar
        title={title}
        theme={theme}
        isDark={dark}
        isTablet={tablet}
        topBarHeight={layout.topBarHeight}
        leftInset={insets.left}
        rightInset={insets.right}
        saveStatus={persistence.saveStatus}
        canUndo={canUndo}
        canRedo={canRedo}
        undoLabel={undoLabel}
        redoLabel={redoLabel}
        showPresenterButton={hasPrivateObjects || hidePrivatePreview}
        hidePrivatePreview={hidePrivatePreview}
        isStudentRoute={isStudentRoute}
        startingLiveClass={liveClass.startingLiveClass}
        liveClassActive={Boolean(liveClass.classroomState?.active)}
        hostSheetVisible={liveClass.hostSheetVisible}
        onBack={handleBack}
        onChangeTitle={handleChangeTitle}
        onFocusTitle={selectionEditing.commitEditing}
        onUndo={undo}
        onRedo={redo}
        onTogglePresenter={handleToggleHidePrivatePreview}
        onOpenBoardStyle={handleOpenBoardStyle}
        onPressLiveClass={handlePressLiveClass}
        onOpenExportMenu={handleOpenExportMenu}
      />

      {persistence.storageError && (
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
            Not saved: {persistence.storageError} The board stays editable and the next change
            retries the save.
          </Text>
        </View>
      )}

      <View
        style={[
          styles.workspace,
          { paddingLeft: insets.left, paddingRight: insets.right },
        ]}
      >
        {tablet && (
          <EditorToolRail
            theme={theme}
            activeTool={activeTool}
            bottomInset={insets.bottom}
            timerVisible={timerVisible}
            calculatorVisible={calculatorVisible}
            geometryActive={Boolean(activeInstrument)}
            faceCamVisible={faceCamVisible}
            recorderBarVisible={recorder.recorderBarVisible}
            stageOverlayVisible={stageOverlayVisible}
            stageOverlayMode={stageOverlayMode}
            voicePinRecording={voicePinRecording}
            onToolPress={pressTool}
            onToggleGeometryBox={handleToggleGeometryBox}
            onOpenMath={handleOpenMathSheet}
            onOpenPdfImport={handleOpenPdfImport}
            onToggleTimer={handleToggleTimer}
            onToggleCalculator={handleToggleCalculator}
            onToggleFaceCam={handleToggleFaceCam}
            onToggleRecorder={handleToggleRecorder}
            onOpenSavedLessons={handleOpenSavedLessons}
            onStartVoicePin={handleStartVoicePinFromRail}
            onOpenStageOverlay={handleOpenStageOverlay}
            onOpenFlashcards={handleOpenFlashcards}
          />
        )}

        {!persistence.hydrated ? (
          <View style={styles.editorLoading}>
            <ActivityIndicator color={theme.primary} />
            <Text style={[styles.editorLoadingText, { color: theme.foreground }]}>
              Opening board…
            </Text>
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
                boardBackground={effectiveBoardSettings.background}
                boardStyle={effectiveBoardSettings.style}
                initialViewport={initialViewport}
                readOnly={isCanvasReadOnly}
                remoteActiveStroke={liveClass.remoteActiveStroke}
                remoteLaserStroke={liveClass.remoteLaserStroke}
                onLiveStrokeSample={liveClass.handleLiveStrokeSample}
                onLiveLaserSample={liveClass.handleLiveLaserSample}
                activeTool={activeTool}
                color={color}
                width={strokeWidth}
                opacity={opacity}
                eraserRadius={eraserRadius}
                laserColorKey={laserColorKey}
                shapeKind={selectionEditing.shapeKind}
                shapeColorKey={selectionEditing.shapeColorKey}
                shapeFillKey={selectionEditing.shapeFillKey}
                shapeStrokeWidth={selectionEditing.shapeStrokeWidth}
                connectorStyle={selectionEditing.connectorStyle}
                connectorColorKey={selectionEditing.connectorColorKey}
                connectorStrokeWidth={selectionEditing.connectorStrokeWidth}
                document={document}
                selectedObjectIds={selectedObjectIds}
                editingObjectId={selectionEditing.editingId}
                editingTableCell={selectionEditing.editingTableCell}
                editingMath={Boolean(ocrAndMath.editingMathInline)}
                editingMathSpan={editingMathSpan}
                viewportRequest={viewportRequest}
                activeInstrument={activeInstrument}
                stylusOnlyDrawing={preferences.stylusOnlyDrawing}
                pressureSensitivity={preferences.pressureSensitivity}
                holdToSnapShapes={preferences.holdToSnapShapes}
                selectedInkIds={selectedInkIds}
                compactHud={!tablet}
                onViewportChange={reportViewport}
                onCommand={runCommand}
                onCommitPending={commitPending}
                onObjectCreate={selectionEditing.startNewObject}
                onSelectionChange={setSelectedObjectIds}
                onInkSelectionChange={setSelectedInkIds}
                onSnapStrokeToShape={ocrAndMath.handleSnapStrokeToShape}
                onObjectEdit={selectionEditing.startEditingExisting}
                onObjectMeasure={measureObject}
                onCanvasTouch={selectionEditing.handleCanvasTouch}
                hidePrivatePreview={hidePrivatePreview}
                playingVoicePinId={playingVoicePinId}
                onToggleRevealTape={handleToggleRevealTape}
                onToggleVoicePinPlay={handleTogglePlayVoicePinById}
                onInsertRevealTapeAt={handlePlaceRevealTapeAt}
                onStartVoicePinAt={handleStartVoicePinAtPoint}
              />

              <StageCurtainOverlay
                visible={stageOverlayVisible}
                mode={stageOverlayMode}
                bounds={canvasRect}
                theme={theme}
                onChangeMode={setStageOverlayMode}
                onClose={handleCloseStageOverlay}
              />

              {liveClass.classroomState?.active && liveClass.classroomState.roomInfo && (
                <ClassroomHud
                  role={liveClass.classroomState.role}
                  status={liveClass.classroomState.status}
                  hasSnapshot={liveClass.classroomState.hasSnapshot}
                  roomCode={liveClass.classroomState.roomInfo.roomCode}
                  studentCount={
                    liveClass.classroomState.participants.filter((p) => p.role === 'student')
                      .length
                  }
                  raisedHandsCount={
                    liveClass.classroomState.participants.filter((p) => p.handRaised).length
                  }
                  myPermission={liveClass.classroomState.myPermission}
                  myHandRaised={liveClass.classroomState.myHandRaised}
                  myCanSpeak={liveClass.classroomState.myCanSpeak}
                  teacherMuted={liveClass.classroomState.roomInfo.teacherMuted}
                  voiceAvailable={liveClass.voiceAvailable}
                  micEnabled={liveClass.voiceMicEnabled}
                  isScratchpadMode={liveClass.isScratchpadMode}
                  projectorMode={isProjectorMode}
                  followTeacherViewport={liveClass.followTeacherViewport}
                  showcasedName={liveClass.showcasedName}
                  notice={liveClass.classroomNotice}
                  hasActivePoll={Boolean(activePoll)}
                  theme={theme}
                  onOpenPoll={handleOpenPollModal}
                  onOpenHostSheet={liveClass.handlePressLiveClassButton}
                  onRequestSync={() => void liveClass.classroomSessionRef.current?.requestSync()}
                  onToggleTeacherMute={liveClass.handleToggleTeacherMute}
                  onToggleRaiseHand={liveClass.handleToggleRaiseHand}
                  onToggleScratchpad={liveClass.handleToggleScratchpad}
                  onToggleFollowTeacher={liveClass.handleToggleFollowTeacher}
                  onToggleStudentMic={liveClass.handleToggleStudentMic}
                  onLeaveClass={liveClass.handleLeaveClass}
                />
              )}

              {persistence.hydrated &&
                persistence.pages.length > 0 &&
                !selectionEditing.editing &&
                !isProjectorMode && (
                  <View style={styles.pageNavigatorWrap}>
                    <PageNavigatorPill
                      theme={theme}
                      currentIndex={persistence.activePageIndex}
                      totalPages={persistence.pages.length}
                      compact={!tablet}
                      canDeleteCurrentPage={persistence.pages.length > 1}
                      hasBackgroundImage={Boolean(persistence.activeBackgroundPdfObject)}
                      isBackgroundLocked={Boolean(persistence.activeBackgroundPdfObject?.locked)}
                      onPrevPage={persistence.handlePrevPage}
                      onNextPage={persistence.handleNextPage}
                      onAddPage={persistence.handleAddPage}
                      onDeleteCurrentPage={() => {
                        if (persistence.activePageId) {
                          void persistence.handleDeletePage(persistence.activePageId);
                        }
                      }}
                      onToggleBackgroundLock={persistence.handleToggleBackgroundLock}
                      onOpenSorter={() => {
                        selectionEditing.commitEditing();
                        setPageSorterVisible(true);
                      }}
                    />
                  </View>
                )}

              {activeInstrument ? (
                <GeometryBoxOverlay
                  instrument={activeInstrument}
                  viewport={viewport}
                  dark={dark}
                  theme={theme}
                  penColor={color}
                  onChangeInstrument={setActiveInstrument}
                  onSwitchInstrument={handleSwitchInstrument}
                  onCommitStroke={handleCommitGeometryStroke}
                  onClose={handleCloseGeometryBox}
                />
              ) : null}

              {selectionEditing.editingTableCell ? (() => {
                const tbl = findObject(document, selectionEditing.editingTableCell.objectId);
                if (!tbl || !isTableObject(tbl)) return null;
                const cellRect = tableCellRect(
                  tbl,
                  selectionEditing.editingTableCell.row,
                  selectionEditing.editingTableCell.col,
                );
                return (
                  <TextInput
                    autoFocus
                    value={selectionEditing.editingTableCell.text}
                    onChangeText={(text) =>
                      selectionEditing.setEditingTableCell((prev) =>
                        prev ? { ...prev, text } : null,
                      )
                    }
                    onSubmitEditing={selectionEditing.advanceTableCell}
                    onBlur={selectionEditing.commitTableCell}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    style={[
                      styles.tableCellInput,
                      {
                        left: cellRect.x * viewport.scale + viewport.x,
                        top: cellRect.y * viewport.scale + viewport.y,
                        width: Math.max(44, cellRect.width * viewport.scale),
                        height: Math.max(32, cellRect.height * viewport.scale),
                        color: textColorValue(tbl.colorKey, dark),
                        backgroundColor: theme.surface,
                        borderColor: theme.primary,
                        fontSize: Math.max(11, tbl.fontSize * viewport.scale),
                      },
                    ]}
                  />
                );
              })() : null}

              {ocrAndMath.editingMathInline ? (() => {
                const mathObj = findObject(document, ocrAndMath.editingMathInline.objectId);
                if (!mathObj || !isMathObject(mathObj)) return null;
                return (
                  <InlineMathBar
                    mathObj={mathObj}
                    editingState={ocrAndMath.editingMathInline}
                    viewport={viewport}
                    canvasWidth={canvasBounds.width}
                    canvasHeight={canvasBounds.height}
                    theme={theme}
                    inputRef={ocrAndMath.mathInlineInputRef}
                    onChangeState={ocrAndMath.setEditingMathInline}
                    onTransientLatex={ocrAndMath.handleTransientMathLatex}
                    onOpenKeypad={() => {
                      dispatch({ type: 'commit' });
                      const currentLatex = ocrAndMath.editingMathInline?.latex ?? mathObj.latex;
                      ocrAndMath.setEditingMathInline(null);
                      ocrAndMath.setEditingMathObject({ ...mathObj, latex: currentLatex });
                      ocrAndMath.setMathSheetVisible(true);
                    }}
                    onDone={ocrAndMath.commitInlineMath}
                  />
                );
              })() : null}

              {showGuidance && (
                <View pointerEvents="none" style={styles.canvasGuidance}>
                  <View
                    style={[
                      styles.guidanceIconBadge,
                      { backgroundColor: theme.background, borderColor: theme.border },
                    ]}
                  >
                    <PenIcon size={24} color={theme.primary} />
                  </View>
                  <Text style={[styles.canvasTitle, { color: theme.foreground }]}>
                    Your canvas awaits
                  </Text>
                  <Text style={[styles.canvasBody, { color: theme.foreground }]}>
                    Capture thoughts freely. Draw with a pen, or add a sticky note or formula.
                  </Text>
                  <View
                    style={[
                      styles.guidanceHintPill,
                      { backgroundColor: theme.background, borderColor: theme.border },
                    ]}
                  >
                    <Text style={[styles.guidanceHintText, { color: theme.primary }]}>
                      {tablet ? 'Pick a tool on the left rail' : 'Pick a tool below to begin'}
                    </Text>
                  </View>
                </View>
              )}

              <FloatingTimer
                visible={timerVisible}
                theme={theme}
                haptics={preferences.haptics}
                bounds={canvasBounds}
                onPinToBoard={handlePinTimerToBoard}
                onClose={handleToggleTimer}
              />

              <FloatingCalculator
                visible={calculatorVisible}
                theme={theme}
                haptics={preferences.haptics}
                isTablet={tablet}
                bounds={canvasBounds}
                onPasteToBoard={handlePasteCalcToBoard}
                onClose={handleToggleCalculator}
              />

              <LessonRecorderBar
                visible={recorder.recorderBarVisible}
                status={recorder.recorderStatus}
                elapsedMs={recorder.recorderElapsedMs}
                countdownRemaining={recorder.recorderCountdown}
                quality={recorder.recorderQuality}
                includeMic={recorder.recorderMic}
                theme={theme}
                isTablet={tablet}
                bounds={canvasBounds}
                bottomExclusion={tablet ? 0 : ACTION_ISLAND_HEIGHT}
                onSelectQuality={recorder.setRecorderQuality}
                onToggleMic={() => recorder.setRecorderMic((v) => !v)}
                onStart={() => void recorder.handleStartRecording()}
                onCancelCountdown={recorder.handleCancelCountdown}
                onPauseResume={recorder.handlePauseResumeRecording}
                onStop={() => void recorder.handleStopRecording()}
                onClose={() => recorder.setRecorderBarVisible(false)}
              />

              <FaceCamBubble
                visible={faceCamVisible}
                isRecording={recorder.recorderStatus === 'recording'}
                theme={theme}
                haptics={preferences.haptics}
                bounds={canvasBounds}
                bottomExclusion={tablet ? 0 : ACTION_ISLAND_HEIGHT}
                onClose={() => setFaceCamVisible(false)}
              />

              {editingTextObject && overlayRect && (
                <TextInput
                  multiline
                  autoFocus
                  returnKeyType="done"
                  submitBehavior="blurAndSubmit"
                  accessibilityLabel={
                    editingTextObject.type === 'sticky'
                      ? 'Sticky note editor'
                      : 'Canvas text editor'
                  }
                  value={editingTextObject.text}
                  onChangeText={(text) => selectionEditing.updateDraft({ text })}
                  onSubmitEditing={() => {
                    selectionEditing.commitEditing();
                    Keyboard.dismiss();
                  }}
                  onBlur={selectionEditing.commitEditing}
                  placeholder={
                    editingTextObject.type === 'sticky' ? 'Write a note' : 'Type something'
                  }
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
              <SelectionActionRail
                theme={theme}
                x={actionRail.x}
                y={actionRail.y}
                width={actionRail.width}
                height={actionRail.height}
                selectionLabel={selectionLabel}
                selectedObjectsCount={selectedObjects.length}
                selectedObject={selectedObject}
                selectedIsTextual={selectedIsTextual}
                selectedIsMath={selectedIsMath}
                selectedIsImage={selectedIsImage}
                selectedIsTable={selectedIsTable}
                selectedIsStemDiagram={selectedIsStemDiagram}
                plottableMath={Boolean(plottableMath)}
                canTidySelection={canTidySelection}
                onEditObject={selectionEditing.startEditingExisting}
                onToggleStyleSheet={selectionEditing.toggleStyleSheet}
                onPlotMath={handlePlotMathObject}
                onTidyLayout={handleTidyLayout}
                onTableAction={selectionEditing.handleTableAction}
                onDuplicate={selectionEditing.duplicateSelected}
                onDelete={selectionEditing.deleteSelected}
              />
            )}

            {quickBranchTarget && activeTool === 'select' && !selectionEditing.editing && (
              <QuickBranchHandles
                object={quickBranchTarget}
                viewport={viewport}
                canvasWidth={canvasRect.width}
                canvasHeight={canvasRect.height}
                theme={theme}
                onBranch={handleQuickBranch}
              />
            )}

            {!tablet && !selectionEditing.editing && selectedObjects.length > 0 && (
              <>
                <PhoneStemSelectionBar
                  theme={theme}
                  bottomOffset={ACTION_ISLAND_HEIGHT + spacing.sm + islandBottom}
                  canTidySelection={canTidySelection}
                  canPlotMath={Boolean(plottableMath)}
                  canChartTable={Boolean(numericTable)}
                  selectedFunctionPlot={selectedFunctionPlot}
                  onTidyLayout={handleTidyLayout}
                  onPlotMath={handlePlotMathObject}
                  onGenerateChart={handleGenerateChart}
                  onComputeTableStats={handleComputeTableStats}
                  onUpdatePlotParam={handleUpdatePlotParam}
                  onUpdateTangentX={handleUpdateTangentX}
                  onTogglePlotTangent={handleTogglePlotTangent}
                  onCommitPlotChanges={handleCommitPlotChanges}
                />
                <PhoneRecallSelectionBar
                  theme={theme}
                  bottomOffset={
                    ACTION_ISLAND_HEIGHT +
                    spacing.sm +
                    islandBottom +
                    (canTidySelection || plottableMath || numericTable || selectedFunctionPlot
                      ? 56
                      : 0)
                  }
                  selectedObjects={selectedObjects}
                  canCoverWithTape={canCoverWithTape}
                  playingPinId={playingVoicePinId}
                  onCoverWithTape={handleCoverSelectionWithTape}
                  onToggleRevealTape={handleToggleRevealTape}
                  onTogglePlayVoicePin={handleTogglePlayVoicePinById}
                  onTogglePrivate={handleToggleSelectedPrivate}
                />
              </>
            )}

            <VoicePinBar
              isRecording={voicePinRecording}
              recordingMs={voicePinRecordingMs}
              livePeaks={voicePinLivePeaks}
              playingPinId={playingVoicePinId}
              errorMessage={voicePinError}
              permissionBlocked={voicePinPermissionBlocked}
              bottomOffset={ACTION_ISLAND_HEIGHT + spacing.sm + islandBottom}
              theme={theme}
              onStopRecording={handleStopVoicePinRecording}
              onCancelRecording={handleCancelVoicePinRecording}
              onStopPlayback={handleStopVoicePinPlayback}
              onOpenSettings={handleOpenVoicePinSettings}
              onDismissError={handleDismissVoicePinError}
            />

            {activeTool === 'reveal-tape' && !selectionEditing.editing && (
              <View
                pointerEvents="none"
                style={[
                  styles.revealTapeBanner,
                  { backgroundColor: theme.surface, borderColor: theme.primary },
                ]}
              >
                <Text style={[styles.revealTapeBannerText, { color: theme.primary }]}>
                  Tap or drag on the board to place Reveal Tape
                </Text>
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
                  onPress={() => selectionEditing.setObjectOptionsVisible((v) => !v)}
                  style={({ pressed }) => [
                    styles.editingBarButton,
                    selectionEditing.objectOptionsVisible && {
                      backgroundColor: `${theme.primary}1F`,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <StyleIcon
                    size={16}
                    color={selectionEditing.objectOptionsVisible ? theme.primary : theme.foreground}
                  />
                  <Text
                    style={[
                      styles.editingBarLabel,
                      {
                        color: selectionEditing.objectOptionsVisible
                          ? theme.primary
                          : theme.foreground,
                      },
                    ]}
                  >
                    Style
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Done editing text"
                  onPress={selectionEditing.commitEditing}
                  style={({ pressed }) => [
                    styles.editingBarButton,
                    { backgroundColor: theme.primary },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.editingBarLabel, { color: colors.onPrimary, fontWeight: '700' }]}>
                    Done
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {tablet &&
          !selectionEditing.editing &&
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
              onToggleOpen={() => selectionEditing.setInspectorOpen((open) => !open)}
              onEditTextObject={selectionEditing.startEditingExisting}
              onDuplicateSelected={selectionEditing.duplicateSelected}
              onDeleteSelected={selectionEditing.deleteSelected}
              onUpdateObjectStyle={selectionEditing.updateObjectStyleById}
              onTableAction={selectionEditing.handleTableAction}
              canTidySelection={canTidySelection}
              canPlotMath={Boolean(plottableMath)}
              canChartTable={Boolean(numericTable)}
              selectedFunctionPlot={selectedFunctionPlot}
              onTidyLayout={handleTidyLayout}
              onPlotMath={handlePlotMathObject}
              onGenerateChart={handleGenerateChart}
              onComputeTableStats={handleComputeTableStats}
              onUpdatePlotParam={handleUpdatePlotParam}
              onUpdateTangentX={handleUpdateTangentX}
              onTogglePlotTangent={handleTogglePlotTangent}
              onCommitPlotChanges={handleCommitPlotChanges}
              canCoverWithTape={canCoverWithTape}
              playingPinId={playingVoicePinId}
              onCoverWithTape={handleCoverSelectionWithTape}
              onToggleRevealTape={handleToggleRevealTape}
              onTogglePlayVoicePin={handleTogglePlayVoicePinById}
              onTogglePrivate={handleToggleSelectedPrivate}
            />
          )}
      </View>

      {editingTextObject && selectionEditing.objectOptionsVisible && (
        <ObjectOptionsSheet
          theme={theme}
          dark={dark}
          kind={editingTextObject.type}
          colorKey={editingTextObject.colorKey}
          fontSize={editingTextObject.fontSize}
          fontWeight={editingTextObject.fontWeight ?? 'normal'}
          fontStyle={editingTextObject.fontStyle ?? 'normal'}
          bottomOffset={
            isSoftwareKeyboardVisible(selectionEditing.keyboardHeight)
              ? selectionEditing.keyboardHeight + spacing.xs
              : optionsBottom
          }
          variant={layout.toolOptionsVariant}
          leftOffset={layout.toolPopoverLeft}
          topOffset={layout.toolPopoverTop}
          maxWidth={layout.toolPopoverMaxWidth}
          doneLabel="Close"
          doneHint="Closes text style options while keeping the editor active"
          showScrim={false}
          onHeightChange={selectionEditing.setSheetHeight}
          onColorChange={(key) => selectionEditing.updateDraft({ colorKey: key })}
          onFontSizeChange={(size) => selectionEditing.updateDraft({ fontSize: size })}
          onFontWeightChange={(weight) => selectionEditing.updateDraft({ fontWeight: weight })}
          onFontStyleChange={(style) => selectionEditing.updateDraft({ fontStyle: style })}
          onDone={selectionEditing.closeObjectOptions}
        />
      )}

      {!selectionEditing.editing &&
        selectionEditing.objectOptionsVisible &&
        (activeTool === 'text' || activeTool === 'sticky') && (
          <ObjectOptionsSheet
            theme={theme}
            dark={dark}
            kind={activeTool}
            colorKey={
              activeTool === 'sticky'
                ? selectionEditing.stickyColorKey
                : selectionEditing.textColorKey
            }
            fontSize={
              activeTool === 'sticky' ? selectionEditing.stickySize : selectionEditing.textSize
            }
            fontWeight={
              activeTool === 'sticky'
                ? selectionEditing.stickyBold
                  ? 'bold'
                  : 'normal'
                : selectionEditing.textBold
                  ? 'bold'
                  : 'normal'
            }
            fontStyle={
              activeTool === 'sticky'
                ? selectionEditing.stickyItalic
                  ? 'italic'
                  : 'normal'
                : selectionEditing.textItalic
                  ? 'italic'
                  : 'normal'
            }
            bottomOffset={optionsBottom}
            variant={layout.toolOptionsVariant}
            leftOffset={layout.toolPopoverLeft}
            topOffset={layout.toolPopoverTop}
            maxWidth={layout.toolPopoverMaxWidth}
            doneLabel="Done"
            doneHint="Closes the style options"
            showScrim={false}
            onColorChange={(key) =>
              activeTool === 'sticky'
                ? selectionEditing.setStickyColorKey(key)
                : selectionEditing.setTextColorKey(key)
            }
            onFontSizeChange={(size) =>
              activeTool === 'sticky'
                ? selectionEditing.setStickySize(size)
                : selectionEditing.setTextSize(size)
            }
            onFontWeightChange={(weight) => {
              if (activeTool === 'sticky') selectionEditing.setStickyBold(weight === 'bold');
              else selectionEditing.setTextBold(weight === 'bold');
            }}
            onFontStyleChange={(style) => {
              if (activeTool === 'sticky') selectionEditing.setStickyItalic(style === 'italic');
              else selectionEditing.setTextItalic(style === 'italic');
            }}
            onDone={selectionEditing.closeObjectOptions}
          />
        )}

      {!selectionEditing.editing &&
        selectionEditing.shapeOptionsVisible &&
        (activeTool === 'shape' || activeTool === 'connector') && (
          <ShapeOptionsSheet
            theme={theme}
            mode={activeTool}
            shapeKind={selectionEditing.shapeKind}
            shapeColorKey={selectionEditing.shapeColorKey}
            shapeFillKey={selectionEditing.shapeFillKey}
            shapeStrokeWidth={selectionEditing.shapeStrokeWidth}
            showMeasurements={selectionEditing.shapeShowMeasurements}
            connectorStyle={selectionEditing.connectorStyle}
            connectorColorKey={selectionEditing.connectorColorKey}
            connectorStrokeWidth={selectionEditing.connectorStrokeWidth}
            bottomOffset={optionsBottom}
            variant={layout.toolOptionsVariant}
            leftOffset={layout.toolPopoverLeft}
            topOffset={layout.toolPopoverTop}
            maxWidth={layout.toolPopoverMaxWidth}
            onShapeKind={selectionEditing.setShapeKind}
            onShapeColor={selectionEditing.setShapeColorKey}
            onShapeFill={selectionEditing.setShapeFillKey}
            onShapeStrokeWidth={selectionEditing.setShapeStrokeWidth}
            onShowMeasurements={selectionEditing.setShapeShowMeasurements}
            onConnectorStyle={selectionEditing.setConnectorStyle}
            onConnectorColor={selectionEditing.setConnectorColorKey}
            onConnectorStrokeWidth={selectionEditing.setConnectorStrokeWidth}
            onDone={() => selectionEditing.setShapeOptionsVisible(false)}
          />
        )}

      {!selectionEditing.editing && !tablet && stylingTextObject && (
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
          onColorChange={(key) => selectionEditing.updateStyledObject({ colorKey: key })}
          onFontSizeChange={(size) => selectionEditing.updateStyledObject({ fontSize: size })}
          onFontWeightChange={(weight) =>
            selectionEditing.updateStyledObject({ fontWeight: weight })
          }
          onFontStyleChange={(style) => selectionEditing.updateStyledObject({ fontStyle: style })}
          onDone={() => selectionEditing.setStylingObjectId(null)}
        />
      )}

      {!selectionEditing.editing && !tablet && stylingGeometricObject && (
        <ShapeOptionsSheet
          theme={theme}
          mode={stylingGeometricObject.type}
          shapeKind={
            stylingGeometricObject.type === 'shape'
              ? stylingGeometricObject.shape
              : selectionEditing.shapeKind
          }
          shapeColorKey={
            stylingGeometricObject.type === 'shape'
              ? stylingGeometricObject.colorKey
              : selectionEditing.shapeColorKey
          }
          shapeFillKey={
            stylingGeometricObject.type === 'shape'
              ? stylingGeometricObject.fillKey
              : selectionEditing.shapeFillKey
          }
          shapeStrokeWidth={
            stylingGeometricObject.type === 'shape'
              ? stylingGeometricObject.strokeWidth
              : selectionEditing.shapeStrokeWidth
          }
          showMeasurements={
            stylingGeometricObject.type === 'shape'
              ? Boolean(stylingGeometricObject.showMeasurements)
              : false
          }
          connectorStyle={
            stylingGeometricObject.type === 'connector'
              ? stylingGeometricObject.style
              : selectionEditing.connectorStyle
          }
          connectorColorKey={
            stylingGeometricObject.type === 'connector'
              ? stylingGeometricObject.colorKey
              : selectionEditing.connectorColorKey
          }
          connectorStrokeWidth={
            stylingGeometricObject.type === 'connector'
              ? stylingGeometricObject.strokeWidth
              : selectionEditing.connectorStrokeWidth
          }
          bottomOffset={optionsBottom}
          onShapeKind={(value) => selectionEditing.updateStyledObject({ shape: value })}
          onShapeColor={(value) => selectionEditing.updateStyledObject({ colorKey: value })}
          onShapeFill={(value) => selectionEditing.updateStyledObject({ fillKey: value })}
          onShapeStrokeWidth={(value) =>
            selectionEditing.updateStyledObject({ strokeWidth: value })
          }
          onShowMeasurements={(value) =>
            selectionEditing.updateStyledObject({ showMeasurements: value })
          }
          onConnectorStyle={(value) => selectionEditing.updateStyledObject({ style: value })}
          onConnectorColor={(value) => selectionEditing.updateStyledObject({ colorKey: value })}
          onConnectorStrokeWidth={(value) =>
            selectionEditing.updateStyledObject({ strokeWidth: value })
          }
          onDone={() => selectionEditing.setStylingObjectId(null)}
        />
      )}

      {!selectionEditing.editing && inkOptionsVisible && (
        <InkOptionsSheet
          theme={theme}
          dark={dark}
          tool={sheetTool}
          color={color}
          width={strokeWidth}
          opacity={opacity}
          eraserRadius={eraserRadius}
          laserColorKey={laserColorKey}
          stylusOnlyDrawing={preferences.stylusOnlyDrawing}
          holdToSnapShapes={preferences.holdToSnapShapes}
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
          onToggleStylusOnly={() =>
            void updatePreference('stylusOnlyDrawing', !preferences.stylusOnlyDrawing)
          }
          onToggleHoldToSnap={() =>
            void updatePreference('holdToSnapShapes', !preferences.holdToSnapShapes)
          }
          onClose={() => setInkOptionsVisible(false)}
        />
      )}

      {!tablet && !selectionEditing.editing && isInkingTool && inkTrayOpen && (
        <InkingQuickTray
          theme={theme}
          dark={dark}
          activeTool={lastInkingTool}
          color={color}
          strokeWidth={strokeWidth}
          eraserRadius={eraserRadius}
          laserColorKey={laserColorKey}
          stylusOnlyDrawing={preferences.stylusOnlyDrawing}
          bottomOffset={ACTION_ISLAND_HEIGHT + spacing.sm + islandBottom}
          onToolChange={(tool) => {
            setLastInkingTool(tool);
            setInkOptionsVisible(false);
            setActiveTool(tool);
          }}
          onColorChange={setColor}
          onWidthChange={setStrokeWidth}
          onEraserRadiusChange={setEraserRadius}
          onLaserColorChange={setLaserColorKey}
          onToggleStylusOnly={() =>
            void updatePreference('stylusOnlyDrawing', !preferences.stylusOnlyDrawing)
          }
          onOpenFullOptions={() => {
            setInkTrayOpen(false);
            setInkOptionsVisible(true);
          }}
        />
      )}

      {!tablet && !selectionEditing.editing && (
        <ActionIsland
          theme={theme}
          bottom={islandBottom}
          activeTool={activeTool}
          inkTool={lastInkingTool}
          inkColor={color}
          insertOpen={quickCreationOpen}
          onSelect={() => pressTool('select')}
          onPan={() => pressTool('pan')}
          onDraw={toggleInking}
          onInsert={() => {
            setInkTrayOpen(false);
            setInkOptionsVisible(false);
            selectionEditing.setObjectOptionsVisible(false);
            selectionEditing.setShapeOptionsVisible(false);
            setQuickCreationOpen(true);
          }}
        />
      )}

      {!tablet && !selectionEditing.editing && (
        <QuickCreationSheet
          theme={theme}
          dark={dark}
          visible={quickCreationOpen}
          onClose={() => setQuickCreationOpen(false)}
          onSelectInsert={handleSelectInsert}
          onOpenShapeOptions={(kind) => {
            pressTool(kind);
            selectionEditing.setShapeOptionsVisible(true);
          }}
          onOpenObjectOptions={(kind) => {
            pressTool(kind);
            selectionEditing.setObjectOptionsVisible(true);
          }}
        />
      )}

      <LessonReplayModal
        visible={Boolean(recorder.replayLesson)}
        lesson={recorder.replayLesson}
        alreadySaved={recorder.replayAlreadySaved}
        dark={dark}
        boardBackground={board?.settings.background ?? DEFAULT_BOARD_SETTINGS.background}
        boardStyle={board?.settings.style ?? DEFAULT_BOARD_SETTINGS.style}
        theme={theme}
        notice={recorder.replayNotice}
        onSaveToLibrary={(lesson) => void recorder.handleSaveReplayLesson(lesson)}
        onShareLesson={(lesson) => void recorder.handleShareReplayLesson(lesson)}
        onDiscard={recorder.closeReplayModal}
        onClose={recorder.closeReplayModal}
      />

      <SavedLessonsModal
        visible={recorder.savedLessonsVisible}
        lessons={recorder.savedLessons}
        theme={theme}
        onPlayLesson={(item) => void recorder.handlePlaySavedLesson(item)}
        onShareLesson={(item) => void recorder.handleShareSavedLesson(item)}
        onDeleteLesson={(item) => void recorder.handleDeleteSavedLesson(item)}
        onClose={() => recorder.setSavedLessonsVisible(false)}
      />

      {imageFlowOpen && imageFlowId && boardId && (
        <ImageImportFlow
          key={imageFlowId}
          theme={theme}
          boardId={boardId}
          point={getViewportCenterPoint()}
          onPlace={ocrAndMath.placeImageObject}
          onExplodeStickyNotes={ocrAndMath.explodeImageStickyNotes}
          onClose={() => {
            setImageFlowOpen(false);
            setImageFlowId(null);
          }}
        />
      )}

      <LiveClassHostSheet
        visible={Boolean(
          liveClass.hostSheetVisible &&
            liveClass.classroomState?.active &&
            liveClass.classroomState.role === 'teacher' &&
            liveClass.classroomState.roomInfo,
        )}
        centered={tablet}
        roomInfo={liveClass.classroomState?.roomInfo ?? null}
        status={liveClass.classroomState?.status ?? 'disconnected'}
        participants={liveClass.classroomState?.participants ?? []}
        studentBoards={liveClass.classroomState?.studentBoards ?? {}}
        showcasedStudentPeerId={liveClass.classroomState?.showcasedStudentPeerId ?? null}
        theme={theme}
        onClose={() => liveClass.setHostSheetVisible(false)}
        onToggleLock={(locked) => void liveClass.classroomSessionRef.current?.setClassLocked(locked)}
        onToggleFollowViewport={(follow) =>
          void liveClass.classroomSessionRef.current?.setFollowTeacherViewport(follow)
        }
        onToggleDrawPermission={(peerId, currentlyCanDraw) => {
          if (currentlyCanDraw) {
            void liveClass.classroomSessionRef.current?.revokeDrawPermission(peerId);
          } else {
            void liveClass.classroomSessionRef.current?.grantDrawPermission(peerId);
          }
        }}
        onToggleVoicePermission={(peerId, currentlyCanSpeak) => {
          if (currentlyCanSpeak) {
            void liveClass.classroomSessionRef.current?.revokeStudentVoice(peerId);
          } else {
            void liveClass.classroomSessionRef.current?.allowStudentVoice(peerId);
          }
        }}
        onLowerHand={(peerId) =>
          void liveClass.classroomSessionRef.current?.lowerStudentHand(peerId)
        }
        onShowcaseStudent={(peerId) =>
          void liveClass.classroomSessionRef.current?.showcaseStudentBoard(peerId)
        }
        onKickParticipant={(peerId) =>
          void liveClass.classroomSessionRef.current?.kickParticipant(peerId)
        }
        onEndClass={liveClass.handleEndClassFromSheet}
      />

      <ExportSheet
        visible={exportSheetVisible}
        theme={theme}
        dark={dark}
        boardTitle={title}
        document={document}
        viewport={viewport}
        canvasSize={canvasBounds}
        settings={board?.settings ?? DEFAULT_BOARD_SETTINGS}
        selectedIds={selectedObjectIds}
        pages={persistence.exportPages}
        defaultFormat={preferences.exportFormat}
        hasRevealedTapes={hasRevealedTapes}
        onResetAllTapes={handleResetAllTapes}
        onClose={() => setExportSheetVisible(false)}
      />

      <PollOverlayModal
        visible={pollModalVisible}
        role={liveClass.classroomState?.role ?? 'teacher'}
        peerId={liveClass.classroomState?.peerId ?? 'teacher'}
        activePoll={activePoll}
        theme={theme}
        onStartPoll={handleStartPoll}
        onVote={handleVoteInPoll}
        onClosePoll={handleClosePoll}
        onInsertChartOnBoard={handleInsertPollChartOnBoard}
        onClearPoll={handleClearPoll}
        onDismiss={handleClosePollModal}
      />

      <FlashcardStudyModal
        visible={flashcardsVisible}
        document={document}
        theme={theme}
        onClose={() => setFlashcardsVisible(false)}
      />

      <PageSorterSheet
        visible={pageSorterVisible}
        theme={theme}
        pages={persistence.pages}
        activePageId={persistence.activePageId}
        onClose={() => setPageSorterVisible(false)}
        onSelectPage={(pageId) => persistence.switchToPage(pageId)}
        onAddPage={persistence.handleAddPage}
        onDuplicatePage={persistence.handleDuplicatePage}
        onRenamePage={persistence.handleRenamePage}
        onMovePage={persistence.handleMovePage}
        onDeletePage={persistence.handleDeletePage}
        onOpenPdfImport={() => setPdfImportVisible(true)}
      />

      <PdfImportModal
        visible={pdfImportVisible}
        boardId={boardId ?? null}
        theme={theme}
        insertAtIndex={persistence.activePageIndex + 1}
        onClose={() => setPdfImportVisible(false)}
        onImportedPages={persistence.handleImportedPdfPages}
        onFallbackImageImport={() => {
          if (!boardId) return;
          setImageFlowId(`${boardId}-${Date.now()}`);
          setImageFlowOpen(true);
        }}
      />

      {selectedInkIds.length > 0 && !selectionEditing.editing && (
        <View
          style={[
            styles.convertInkWrap,
            { bottom: ACTION_ISLAND_HEIGHT + spacing.md + islandBottom },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Convert selected ink to text"
            onPress={() => void ocrAndMath.handleConvertInkToText()}
            style={({ pressed }) => [
              styles.convertInkButton,
              { backgroundColor: theme.primary, borderColor: theme.border },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.convertInkText, { color: theme.surface }]}>
              Convert to text ({selectedInkIds.length})
            </Text>
          </Pressable>
        </View>
      )}

      <MathKeyboardSheet
        visible={ocrAndMath.mathSheetVisible}
        theme={theme}
        initialLatex={ocrAndMath.editingMathObject?.latex ?? ''}
        isEditing={Boolean(ocrAndMath.editingMathObject)}
        onSubmit={ocrAndMath.handleSubmitMath}
        onClose={() => {
          ocrAndMath.setMathSheetVisible(false);
          ocrAndMath.setEditingMathObject(null);
        }}
      />

      <Modal
        visible={Boolean(ocrAndMath.inkOcrSession)}
        transparent={false}
        animationType={reducedMotion ? 'none' : 'slide'}
        statusBarTranslucent
        onRequestClose={ocrAndMath.handleCloseInkOcr}
      >
        {ocrAndMath.inkOcrSession && (
          <OcrReviewScreen
            theme={theme}
            uri={ocrAndMath.inkOcrSession.uri}
            width={Math.max(1, Math.round(ocrAndMath.inkOcrSession.bounds.width))}
            height={Math.max(1, Math.round(ocrAndMath.inkOcrSession.bounds.height))}
            state={ocrAndMath.inkOcrSession.state}
            onChangeText={ocrAndMath.handleChangeInkOcrText}
            onRetry={ocrAndMath.handleRetryInkOcr}
            onAddText={ocrAndMath.handleCommitInkOcrText}
            onAddImageOnly={ocrAndMath.handleCloseInkOcr}
            onClose={ocrAndMath.handleCloseInkOcr}
          />
        )}
      </Modal>

      <BoardStyleModal
        visible={boardStyleModalVisible}
        settings={board?.settings ?? DEFAULT_BOARD_SETTINGS}
        theme={theme}
        reducedMotion={reducedMotion}
        onChangeSettings={handleChangeBoardSettings}
        onClose={() => setBoardStyleModalVisible(false)}
      />
    </View>
  );
}
