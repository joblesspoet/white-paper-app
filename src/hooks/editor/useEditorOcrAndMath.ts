import { useCallback, useRef, useState } from 'react';
import type { TextInput } from 'react-native';

import {
  createMathObject,
  createTextObject,
  OBJECT_PADDING,
  withObjectText,
  type CanvasDocument,
  type ConnectorObject,
  type DocumentAction,
  type DocumentCommand,
  type ImageObject,
  type MathObject,
  type ShapeObject,
  type StickyObject,
  type TextObject,
} from '../../canvas/document';
import type { InkStroke } from '../../canvas/ink';
import {
  hitTestMathSlot,
  layoutMathExpression,
  type MathSourceSpan,
} from '../../canvas/math-layout';
import type { InkTool } from '../../components/CanvasViewport';
import type { EditingMathInlineState } from '../../components/editor/InlineMathBar';
import { deleteExportFile, renderInkStrokesToTempPng } from '../../export/export-service';
import { cropMetadata } from '../../media/asset-store';
import { recognizeImageText } from '../../ocr/native-ocr';
import {
  loadingOcrState,
  ocrReviewStateFromError,
  ocrReviewStateFromResult,
  withOcrCorrection,
  type OcrReviewState,
} from '../../ocr/ocr-service';
import { getLocalDatabase } from '../../persistence/expo-store';
import { insertMediaAsset, type MediaAssetRecord } from '../../persistence/repository';
import { triggerHapticFeedback } from '../../utils/haptics';

export function mathSpanAtPoint(
  object: MathObject,
  latex: string,
  point: { x: number; y: number },
): MathSourceSpan | null {
  let wx = point.x;
  let wy = point.y;
  if (object.rotation !== 0) {
    const cx = object.x + object.width / 2;
    const cy = object.y + object.height / 2;
    const rad = (-object.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = point.x - cx;
    const dy = point.y - cy;
    wx = cx + dx * cos - dy * sin;
    wy = cy + dx * sin + dy * cos;
  }
  const layout = layoutMathExpression(latex, object.fontSize);
  const availW = Math.max(12, object.width - OBJECT_PADDING * 2);
  const availH = Math.max(16, object.height - OBJECT_PADDING * 2);
  const contentScale = Math.min(
    availW / Math.max(1, layout.width),
    availH / Math.max(1, layout.height),
  );
  const originX = object.x + OBJECT_PADDING + (availW - layout.width * contentScale) / 2;
  const originY = object.y + OBJECT_PADDING + (availH - layout.height * contentScale) / 2;
  const localX = (wx - originX) / Math.max(0.01, contentScale);
  const localY = (wy - originY) / Math.max(0.01, contentScale);
  return hitTestMathSlot(layout, localX, localY)?.span ?? null;
}

type UseEditorOcrAndMathArgs = {
  boardId?: string;
  document: CanvasDocument;
  haptics: boolean;
  textColorKey: string;
  textSize: number;
  selectedInkIds: string[];
  getViewportCenterPoint: () => { x: number; y: number };
  dispatch: React.Dispatch<DocumentAction>;
  setSelectedObjectIds: React.Dispatch<React.SetStateAction<string[]>>;
  setSelectedInkIds: React.Dispatch<React.SetStateAction<string[]>>;
  setActiveTool: (tool: InkTool) => void;
};

export function useEditorOcrAndMath({
  boardId,
  document,
  haptics,
  textColorKey,
  textSize,
  selectedInkIds,
  getViewportCenterPoint,
  dispatch,
  setSelectedObjectIds,
  setSelectedInkIds,
  setActiveTool,
}: UseEditorOcrAndMathArgs) {
  const [mathSheetVisible, setMathSheetVisible] = useState(false);
  const [editingMathObject, setEditingMathObject] = useState<MathObject | null>(null);
  const mathInlineInputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [editingMathInline, setEditingMathInline] = useState<EditingMathInlineState | null>(null);
  const [inkOcrSession, setInkOcrSession] = useState<{
    uri: string;
    bounds: { x: number; y: number; width: number; height: number };
    strokeIds: string[];
    state: OcrReviewState;
  } | null>(null);

  const insertMediaAssetRow = useCallback(
    async (asset: MediaAssetRecord) => {
      if (!boardId) return;
      const database = await getLocalDatabase();
      await insertMediaAsset(database, asset);
    },
    [boardId],
  );

  const placeImageObject = useCallback(
    (object: ImageObject, textObject?: TextObject) => {
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
          ...cropMetadata(object.crop, object.originalAssetId, '', {
            width: object.sourceWidth,
            height: object.sourceHeight,
          }),
          ...(object.ocr ? { ocr: object.ocr } : {}),
        },
        createdAt: new Date().toISOString(),
      });
      setSelectedObjectIds([object.id]);
    },
    [boardId, dispatch, insertMediaAssetRow, setSelectedObjectIds],
  );

  const explodeImageStickyNotes = useCallback(
    (image: ImageObject, stickyNotes: StickyObject[]) => {
      if (!boardId) return;
      const commands: DocumentCommand[] = [
        { type: 'object.insert', object: image },
        ...stickyNotes.map((note) => ({ type: 'object.insert' as const, object: note })),
      ];
      dispatch({ type: 'commands', commands });
      void insertMediaAssetRow({
        id: image.originalAssetId,
        boardId,
        ownerId: null,
        storagePath: image.originalStoragePath,
        mimeType: '',
        bytes: 0,
        metadata: {},
        createdAt: new Date().toISOString(),
      });
      void insertMediaAssetRow({
        id: image.assetId,
        boardId,
        ownerId: null,
        storagePath: image.storagePath,
        mimeType: '',
        bytes: 0,
        metadata: {
          ...cropMetadata(image.crop, image.originalAssetId, '', {
            width: image.sourceWidth,
            height: image.sourceHeight,
          }),
          ...(image.ocr ? { ocr: image.ocr } : {}),
        },
        createdAt: new Date().toISOString(),
      });
      setActiveTool('select');
      setSelectedObjectIds(stickyNotes.map((note) => note.id));
    },
    [boardId, dispatch, insertMediaAssetRow, setActiveTool, setSelectedObjectIds],
  );

  const handleSnapStrokeToShape = useCallback(
    (stroke: InkStroke, shape: ShapeObject | ConnectorObject) => {
      void triggerHapticFeedback('impact', haptics);
      dispatch({ type: 'command', command: { type: 'ink.add', stroke } });
      dispatch({
        type: 'commands',
        commands: [
          { type: 'ink.delete', id: stroke.id },
          { type: 'object.insert', object: shape },
        ],
      });
      setSelectedObjectIds([shape.id]);
    },
    [dispatch, haptics, setSelectedObjectIds],
  );

  const handleSubmitMath = useCallback(
    (latex: string) => {
      if (editingMathObject) {
        if (latex !== editingMathObject.latex) {
          dispatch({
            type: 'command',
            command: { type: 'object.update', id: editingMathObject.id, latex },
          });
        }
        setMathSheetVisible(false);
        setEditingMathObject(null);
        return;
      }
      const center = getViewportCenterPoint();
      const mathObj = createMathObject({
        id: `math-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        point: center,
        latex,
        colorKey: textColorKey,
      });
      dispatch({ type: 'command', command: { type: 'object.insert', object: mathObj } });
      setSelectedObjectIds([mathObj.id]);
      setActiveTool('select');
      setMathSheetVisible(false);
    },
    [
      dispatch,
      editingMathObject,
      getViewportCenterPoint,
      setActiveTool,
      setSelectedObjectIds,
      textColorKey,
    ],
  );

  const commitInlineMath = useCallback(() => {
    if (!editingMathInline) return;
    const trimmed = editingMathInline.latex.trim();
    if (trimmed.length === 0) {
      dispatch({
        type: 'command',
        command: { type: 'object.delete', id: editingMathInline.objectId },
      });
    } else {
      dispatch({ type: 'commit' });
    }
    setEditingMathInline(null);
  }, [dispatch, editingMathInline]);

  const handleTransientMathLatex = useCallback(
    (objectId: string, latex: string) => {
      dispatch({
        type: 'command',
        command: { type: 'object.update', id: objectId, latex },
        transient: true,
      });
    },
    [dispatch],
  );

  const runInkOcr = useCallback(async (uri: string) => {
    try {
      const result = await recognizeImageText(uri);
      setInkOcrSession((prev) =>
        prev && prev.uri === uri ? { ...prev, state: ocrReviewStateFromResult(result) } : prev,
      );
    } catch (error) {
      setInkOcrSession((prev) =>
        prev && prev.uri === uri ? { ...prev, state: ocrReviewStateFromError(error) } : prev,
      );
    }
  }, []);

  const handleConvertInkToText = useCallback(async () => {
    const targetStrokes = document.strokes.filter((s) => selectedInkIds.includes(s.id));
    if (targetStrokes.length === 0) return;
    const rendered = await renderInkStrokesToTempPng(targetStrokes);
    if (!rendered) return;
    setInkOcrSession({
      uri: rendered.uri,
      bounds: rendered.bounds,
      strokeIds: targetStrokes.map((s) => s.id),
      state: loadingOcrState(),
    });
    void runInkOcr(rendered.uri);
  }, [document.strokes, runInkOcr, selectedInkIds]);

  const handleCloseInkOcr = useCallback(() => {
    setInkOcrSession((prev) => {
      if (prev) void deleteExportFile(prev.uri);
      return null;
    });
  }, []);

  const handleCommitInkOcrText = useCallback(() => {
    if (!inkOcrSession) return;
    const text = inkOcrSession.state.text.trim();
    if (!text) return;
    const targetStrokes = document.strokes.filter((s) =>
      inkOcrSession.strokeIds.includes(s.id),
    );
    const created = createTextObject({
      id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      point: {
        x: inkOcrSession.bounds.x + inkOcrSession.bounds.width / 2,
        y: inkOcrSession.bounds.y + inkOcrSession.bounds.height / 2,
      },
      colorKey: textColorKey,
      fontSize: textSize,
    });
    const textObj = withObjectText(
      {
        ...created,
        x: Math.round(inkOcrSession.bounds.x),
        y: Math.round(inkOcrSession.bounds.y),
        width: Math.max(120, Math.round(inkOcrSession.bounds.width)),
      },
      text,
    );
    const commands: DocumentCommand[] = [
      ...targetStrokes.map((stroke): DocumentCommand => ({ type: 'ink.delete', id: stroke.id })),
      { type: 'object.insert', object: textObj },
    ];
    dispatch({ type: 'commands', commands });
    setSelectedInkIds([]);
    setSelectedObjectIds([textObj.id]);
    handleCloseInkOcr();
  }, [
    dispatch,
    document.strokes,
    handleCloseInkOcr,
    inkOcrSession,
    setSelectedInkIds,
    setSelectedObjectIds,
    textColorKey,
    textSize,
  ]);

  const handleChangeInkOcrText = useCallback((nextText: string) => {
    setInkOcrSession((prev) =>
      prev ? { ...prev, state: withOcrCorrection(prev.state, nextText) } : null,
    );
  }, []);

  const handleRetryInkOcr = useCallback(() => {
    if (!inkOcrSession) return;
    const targetUri = inkOcrSession.uri;
    setInkOcrSession((prev) => (prev ? { ...prev, state: loadingOcrState() } : null));
    void runInkOcr(targetUri);
  }, [inkOcrSession, runInkOcr]);

  return {
    mathSheetVisible,
    setMathSheetVisible,
    editingMathObject,
    setEditingMathObject,
    mathInlineInputRef,
    editingMathInline,
    setEditingMathInline,
    inkOcrSession,
    placeImageObject,
    explodeImageStickyNotes,
    handleSnapStrokeToShape,
    handleSubmitMath,
    commitInlineMath,
    handleTransientMathLatex,
    handleConvertInkToText,
    handleCloseInkOcr,
    handleCommitInkOcrText,
    handleChangeInkOcrText,
    handleRetryInkOcr,
  };
}
