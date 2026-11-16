import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard } from 'react-native';

import {
  DEFAULT_STICKY_COLOR,
  DEFAULT_STICKY_FONT_SIZE,
  DEFAULT_TEXT_COLOR,
  DEFAULT_TEXT_FONT_SIZE,
  createStickyObject,
  createTextObject,
  duplicateObject,
  editingCommit,
  findObject,
  isMathObject,
  isTableObject,
  isTextualObject,
  keepObjectAboveKeyboard,
  keyboardOverlap,
  objectScreenRect,
  tableCellAtPoint,
  withObjectStyle,
  withObjectText,
  withTableCellText,
  withTableColumnAdded,
  withTableColumnRemoved,
  withTableRowAdded,
  withTableRowRemoved,
  type CanvasDocument,
  type CanvasObject,
  type DocumentAction,
  type DocumentCommand,
  type MathObject,
  type ObjectStylePatch,
  type ShapeKind,
  type TextSlant,
  type TextWeight,
} from '../../canvas/document';
import type { Point, Viewport } from '../../canvas/viewport';
import type { InkTool } from '../../components/CanvasViewport';
import type { EditingMathInlineState } from '../../components/editor/InlineMathBar';
import { isSoftwareKeyboardVisible } from '../../responsive/layout';
import { spacing } from '../../theme';
import { mathSpanAtPoint } from './useEditorOcrAndMath';

export type EditingObjectState = { object: CanvasObject; isNew: boolean };

export type EditingTableCellState = {
  objectId: string;
  row: number;
  col: number;
  text: string;
};

type UseEditorSelectionAndEditingArgs = {
  document: CanvasDocument;
  viewportLive: React.MutableRefObject<Viewport>;
  canvasRect: { x: number; y: number; width: number; height: number };
  windowHeight: number;
  tablet: boolean;
  isTabletLandscape: boolean;
  selectedObjectIds: string[];
  setSelectedObjectIds: React.Dispatch<React.SetStateAction<string[]>>;
  dispatch: React.Dispatch<DocumentAction>;
  requestViewport: (next: Viewport) => void;
  editingMathInline: EditingMathInlineState | null;
  setEditingMathInline: React.Dispatch<React.SetStateAction<EditingMathInlineState | null>>;
  mathInlineInputRef: React.RefObject<React.ComponentRef<typeof import('react-native').TextInput> | null>;
  commitInlineMath: () => void;
  setMathSheetVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setEditingMathObject: React.Dispatch<React.SetStateAction<MathObject | null>>;
};

export function useEditorSelectionAndEditing({
  document,
  viewportLive,
  canvasRect,
  windowHeight,
  tablet,
  isTabletLandscape,
  selectedObjectIds,
  setSelectedObjectIds,
  dispatch,
  requestViewport,
  editingMathInline,
  setEditingMathInline,
  mathInlineInputRef,
  commitInlineMath,
}: UseEditorSelectionAndEditingArgs) {
  const [editing, setEditing] = useState<EditingObjectState | null>(null);
  const editingRef = useRef<EditingObjectState | null>(null);
  const [editingTableCell, setEditingTableCell] = useState<EditingTableCellState | null>(null);
  const [stylingObjectId, setStylingObjectId] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [objectOptionsVisible, setObjectOptionsVisible] = useState(false);
  const [shapeOptionsVisible, setShapeOptionsVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [sheetHeight, setSheetHeight] = useState(0);

  // Default tool style preferences
  const [textColorKey, setTextColorKey] = useState<string>(DEFAULT_TEXT_COLOR);
  const [textSize, setTextSize] = useState(DEFAULT_TEXT_FONT_SIZE);
  const [textBold, setTextBold] = useState(false);
  const [textItalic, setTextItalic] = useState(false);

  const [stickyColorKey, setStickyColorKey] = useState<string>(DEFAULT_STICKY_COLOR);
  const [stickySize, setStickySize] = useState(DEFAULT_STICKY_FONT_SIZE);
  const [stickyBold, setStickyBold] = useState(false);
  const [stickyItalic, setStickyItalic] = useState(false);

  const [shapeKind, setShapeKind] = useState<ShapeKind>('rectangle');
  const [shapeShowMeasurements, setShapeShowMeasurements] = useState(false);
  const [shapeColorKey, setShapeColorKey] = useState<string>(DEFAULT_TEXT_COLOR);
  const [shapeFillKey, setShapeFillKey] = useState<string | null>(null);
  const [shapeStrokeWidth, setShapeStrokeWidth] = useState(4);

  const [connectorStyle, setConnectorStyle] = useState<'line' | 'arrow' | 'elbow'>('arrow');
  const [connectorColorKey, setConnectorColorKey] = useState<string>(DEFAULT_TEXT_COLOR);
  const [connectorStrokeWidth, setConnectorStrokeWidth] = useState(4);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', (event) =>
      setKeyboardHeight(event.endCoordinates.height),
    );
    const shown = Keyboard.addListener('keyboardDidShow', (event) =>
      setKeyboardHeight(event.endCoordinates.height),
    );
    const hide = Keyboard.addListener('keyboardWillHide', () => setKeyboardHeight(0));
    const hidden = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => {
      show.remove();
      shown.remove();
      hide.remove();
      hidden.remove();
    };
  }, []);

  // Default inspector open state by tablet orientation when a new selection begins.
  const prevSelectionCount = useRef(0);
  useEffect(() => {
    if (selectedObjectIds.length > 0 && prevSelectionCount.current === 0) {
      setInspectorOpen(isTabletLandscape);
    }
    prevSelectionCount.current = selectedObjectIds.length;
  }, [isTabletLandscape, selectedObjectIds.length]);

  // Selection can vanish through undo/redo/delete
  useEffect(() => {
    setSelectedObjectIds((current) => {
      const next = current.filter((id) => findObject(document, id));
      return next.length === current.length ? current : next;
    });
  }, [document, setSelectedObjectIds]);

  useEffect(() => {
    if (
      stylingObjectId &&
      (selectedObjectIds.length !== 1 || selectedObjectIds[0] !== stylingObjectId)
    ) {
      setStylingObjectId(null);
    }
  }, [selectedObjectIds, stylingObjectId]);

  useEffect(() => {
    if (stylingObjectId && !findObject(document, stylingObjectId)) {
      setStylingObjectId(null);
    }
  }, [document, stylingObjectId]);

  const setEditingState = useCallback((next: EditingObjectState | null) => {
    editingRef.current = next;
    setEditing(next);
  }, []);

  const closeObjectOptions = useCallback(() => setObjectOptionsVisible(false), []);

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
  }, [dispatch, setSelectedObjectIds]);

  const updateDraft = useCallback(
    (patch: {
      text?: string;
      colorKey?: string;
      fontSize?: number;
      fontWeight?: TextWeight;
      fontStyle?: TextSlant;
    }) => {
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
    },
    [setEditingState],
  );

  const startNewObject = useCallback(
    (type: 'text' | 'sticky', point: Point) => {
      if (editingRef.current) {
        commitEditing();
        return;
      }
      const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const object =
        type === 'sticky'
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
    },
    [
      commitEditing,
      setEditingState,
      setSelectedObjectIds,
      stickyBold,
      stickyColorKey,
      stickyItalic,
      stickySize,
      textBold,
      textColorKey,
      textItalic,
      textSize,
    ],
  );

  const commitTableCell = useCallback(() => {
    if (!editingTableCell) return;
    const obj = findObject(document, editingTableCell.objectId);
    if (obj && isTableObject(obj)) {
      const updated = withTableCellText(
        obj,
        editingTableCell.row,
        editingTableCell.col,
        editingTableCell.text,
      );
      if (updated !== obj) {
        dispatch({
          type: 'command',
          command: {
            type: 'object.update',
            id: obj.id,
            table: { cells: updated.cells },
          },
        });
      }
    }
    setEditingTableCell(null);
  }, [dispatch, document, editingTableCell]);

  const advanceTableCell = useCallback(() => {
    if (!editingTableCell) return;
    const obj = findObject(document, editingTableCell.objectId);
    if (!obj || !isTableObject(obj)) {
      commitTableCell();
      return;
    }
    const updated = withTableCellText(
      obj,
      editingTableCell.row,
      editingTableCell.col,
      editingTableCell.text,
    );
    if (updated !== obj) {
      dispatch({
        type: 'command',
        command: {
          type: 'object.update',
          id: obj.id,
          table: { cells: updated.cells },
        },
      });
    }
    let nextCol = editingTableCell.col + 1;
    let nextRow = editingTableCell.row;
    if (nextCol >= obj.columns) {
      nextCol = 0;
      nextRow += 1;
    }
    if (nextRow >= obj.rows) {
      setEditingTableCell(null);
      return;
    }
    const nextCellText = updated.cells[nextRow * obj.columns + nextCol]?.text ?? '';
    setEditingTableCell({
      objectId: obj.id,
      row: nextRow,
      col: nextCol,
      text: nextCellText,
    });
  }, [commitTableCell, dispatch, document, editingTableCell]);

  const handleTableAction = useCallback(
    (id: string, action: 'add-row' | 'remove-row' | 'add-col' | 'remove-col') => {
      const obj = findObject(document, id);
      if (!obj || !isTableObject(obj)) return;
      const next =
        action === 'add-row'
          ? withTableRowAdded(obj)
          : action === 'remove-row'
            ? withTableRowRemoved(obj)
            : action === 'add-col'
              ? withTableColumnAdded(obj)
              : withTableColumnRemoved(obj);
      if (next === obj) return;
      dispatch({
        type: 'command',
        command: {
          type: 'object.update',
          id: obj.id,
          table: {
            rows: next.rows,
            columns: next.columns,
            columnRatios: next.columnRatios,
            cells: next.cells,
            width: next.width,
            height: next.height,
          },
        },
      });
    },
    [dispatch, document],
  );

  const startEditingExisting = useCallback(
    (id: string, point?: { x: number; y: number }) => {
      const object = findObject(document, id);
      if (!object) return;
      if (isTableObject(object)) {
        const cellPos = (point ? tableCellAtPoint(object, point) : null) ?? { row: 0, col: 0 };
        const existingText = object.cells[cellPos.row * object.columns + cellPos.col]?.text ?? '';
        setSelectedObjectIds([id]);
        setObjectOptionsVisible(false);
        setStylingObjectId(null);
        setSheetHeight(0);
        setEditingTableCell({
          objectId: id,
          row: cellPos.row,
          col: cellPos.col,
          text: existingText,
        });
        return;
      }
      if (isMathObject(object)) {
        const span = point ? mathSpanAtPoint(object, object.latex, point) : null;
        const slotText = span ? object.latex.slice(span.start, span.end) : object.latex;
        setSelectedObjectIds([id]);
        setObjectOptionsVisible(false);
        setStylingObjectId(null);
        setSheetHeight(0);
        setEditingMathInline({ objectId: id, latex: object.latex, span, slotText });
        return;
      }
      if (!isTextualObject(object)) return;
      setSelectedObjectIds([id]);
      setObjectOptionsVisible(false);
      setStylingObjectId(null);
      setSheetHeight(0);
      setEditingState({ object, isNew: false });
    },
    [document, setEditingMathInline, setEditingState, setSelectedObjectIds],
  );

  const deleteSelected = useCallback(() => {
    const ids = selectedObjectIds.filter((id) => findObject(document, id));
    if (ids.length === 0) return;
    const commands: DocumentCommand[] = ids.map((id) => ({ type: 'object.delete', id }));
    dispatch({ type: 'commands', commands });
    setSelectedObjectIds([]);
    setStylingObjectId(null);
  }, [dispatch, document, selectedObjectIds, setSelectedObjectIds]);

  const duplicateSelected = useCallback(() => {
    const originals = selectedObjectIds
      .map((id) => findObject(document, id))
      .filter((object): object is CanvasObject => Boolean(object));
    if (originals.length === 0) return;
    const stamp = Date.now();
    const copies = originals.map((object, index) =>
      duplicateObject(
        object,
        `${object.type}-${stamp}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      ),
    );
    dispatch({
      type: 'commands',
      commands: copies.map((object) => ({ type: 'object.insert' as const, object })),
    });
    setSelectedObjectIds(copies.map((object) => object.id));
    setStylingObjectId(null);
  }, [dispatch, document, selectedObjectIds, setSelectedObjectIds]);

  const toggleStyleSheet = useCallback(() => {
    if (selectedObjectIds.length !== 1) return;
    if (tablet) {
      setInspectorOpen((open) => !open);
      return;
    }
    const id = selectedObjectIds[0];
    setStylingObjectId((current) => (current === id ? null : id));
  }, [selectedObjectIds, tablet]);

  const updateObjectStyleById = useCallback(
    (id: string, patch: ObjectStylePatch) => {
      dispatch({ type: 'command', command: { type: 'object.update', id, ...patch } });
    },
    [dispatch],
  );

  const updateStyledObject = useCallback(
    (patch: ObjectStylePatch) => {
      if (!stylingObjectId) return;
      dispatch({
        type: 'command',
        command: { type: 'object.update', id: stylingObjectId, ...patch },
      });
    },
    [dispatch, stylingObjectId],
  );

  const handleCanvasTouch = useCallback(
    (point?: { x: number; y: number }) => {
      if (editingMathInline && point) {
        const mathObj = findObject(document, editingMathInline.objectId);
        if (mathObj && isMathObject(mathObj)) {
          const margin = 12;
          const inside =
            point.x >= mathObj.x - margin &&
            point.x <= mathObj.x + mathObj.width + margin &&
            point.y >= mathObj.y - margin &&
            point.y <= mathObj.y + mathObj.height + margin;
          if (inside) {
            const nextSpan = mathSpanAtPoint(mathObj, editingMathInline.latex, point);
            if (nextSpan) {
              setEditingMathInline({
                ...editingMathInline,
                span: nextSpan,
                slotText: editingMathInline.latex.slice(nextSpan.start, nextSpan.end),
              });
              mathInlineInputRef.current?.focus();
              return;
            }
          }
        }
      }
      commitEditing();
      commitTableCell();
      commitInlineMath();
    },
    [
      commitEditing,
      commitInlineMath,
      commitTableCell,
      document,
      editingMathInline,
      mathInlineInputRef,
      setEditingMathInline,
    ],
  );

  // Keyboard-safe viewport adjustment while editing text/sticky
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
      bottomInset: keyboardOverlap(keyboardHeight, canvasRect, windowHeight) + sheetHeight + spacing.sm,
    });
    if (next.x !== viewportLive.current.x || next.y !== viewportLive.current.y) {
      requestViewport(next);
    }
  }, [
    editingId,
    editingObjectHeight,
    keyboardHeight,
    sheetHeight,
    canvasRect,
    windowHeight,
    requestViewport,
    viewportLive,
  ]);

  return {
    editing,
    editingRef,
    editingId,
    editingTableCell,
    setEditingTableCell,
    stylingObjectId,
    setStylingObjectId,
    inspectorOpen,
    setInspectorOpen,
    objectOptionsVisible,
    setObjectOptionsVisible,
    shapeOptionsVisible,
    setShapeOptionsVisible,
    keyboardHeight,
    setSheetHeight,
    textColorKey,
    setTextColorKey,
    textSize,
    setTextSize,
    textBold,
    setTextBold,
    textItalic,
    setTextItalic,
    stickyColorKey,
    setStickyColorKey,
    stickySize,
    setStickySize,
    stickyBold,
    setStickyBold,
    stickyItalic,
    setStickyItalic,
    shapeKind,
    setShapeKind,
    shapeShowMeasurements,
    setShapeShowMeasurements,
    shapeColorKey,
    setShapeColorKey,
    shapeFillKey,
    setShapeFillKey,
    shapeStrokeWidth,
    setShapeStrokeWidth,
    connectorStyle,
    setConnectorStyle,
    connectorColorKey,
    setConnectorColorKey,
    connectorStrokeWidth,
    setConnectorStrokeWidth,
    closeObjectOptions,
    commitEditing,
    updateDraft,
    startNewObject,
    commitTableCell,
    advanceTableCell,
    handleTableAction,
    startEditingExisting,
    deleteSelected,
    duplicateSelected,
    toggleStyleSheet,
    updateObjectStyleById,
    updateStyledObject,
    handleCanvasTouch,
  };
}
