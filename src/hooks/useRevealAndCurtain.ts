import { useCallback, useMemo, useState } from 'react';

import type { CanvasDocument, CanvasObject, DocumentCommand } from '../canvas/document';
import {
  buildResetAllRevealTapesCommands,
  createRevealTapeCoveringObject,
  createRevealTapeObject,
} from '../canvas/reveal-tape';
import type { Point } from '../canvas/viewport';
import type { StageOverlayMode } from '../components/StageCurtainOverlay';
import { triggerHapticFeedback } from '../utils/haptics';

export type UseRevealAndCurtainParams = {
  document: CanvasDocument;
  selectedObjects: readonly CanvasObject[];
  haptics: boolean;
  isReadOnly?: boolean;
  dispatchCommand: (command: DocumentCommand, transient?: boolean) => void;
  dispatchBatchCommands: (commands: readonly DocumentCommand[]) => void;
  setSelectedIds: (ids: string[]) => void;
};

export function useRevealAndCurtain({
  document,
  selectedObjects,
  haptics,
  isReadOnly = false,
  dispatchCommand,
  dispatchBatchCommands,
  setSelectedIds,
}: UseRevealAndCurtainParams) {
  const [stageOverlayVisible, setStageOverlayVisible] = useState(false);
  const [stageOverlayMode, setStageOverlayMode] = useState<StageOverlayMode>('curtain');
  const [hidePrivatePreview, setHidePrivatePreview] = useState(false);

  const selectedRevealTape = useMemo(() => {
    if (selectedObjects.length !== 1) return null;
    const only = selectedObjects[0];
    return only?.type === 'reveal-tape' ? only : null;
  }, [selectedObjects]);

  const canCoverWithTape = useMemo(() => {
    if (isReadOnly || selectedObjects.length !== 1) return false;
    const only = selectedObjects[0];
    return (
      only?.type === 'text' ||
      only?.type === 'math' ||
      only?.type === 'sticky'
    );
  }, [isReadOnly, selectedObjects]);

  const singleSelectedObject = useMemo(
    () => (selectedObjects.length === 1 ? selectedObjects[0] : null),
    [selectedObjects],
  );

  const hasRevealedTapes = useMemo(
    () => document.objects.some((o) => o.type === 'reveal-tape' && o.isRevealed),
    [document.objects],
  );

  const hasPrivateObjects = useMemo(
    () => document.objects.some((o) => o.isPrivate === true),
    [document.objects],
  );

  const handleToggleRevealTape = useCallback(
    (objectId: string) => {
      const target = document.objects.find((o) => o.id === objectId);
      if (!target || target.type !== 'reveal-tape') return;
      void triggerHapticFeedback('selection', haptics);
      dispatchCommand({
        type: 'object.update',
        id: target.id,
        isRevealed: !target.isRevealed,
      });
    },
    [dispatchCommand, document.objects, haptics],
  );

  const handleInsertRevealTapeAt = useCallback(
    (point: Point, rect?: { x: number; y: number; width: number; height: number }) => {
      if (isReadOnly) return;
      const id = `reveal-tape-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const tape = rect
        ? createRevealTapeObject({
            id,
            point: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
            width: rect.width,
            height: rect.height,
          })
        : createRevealTapeObject({ id, point });
      dispatchCommand({ type: 'object.insert', object: tape });
      setSelectedIds([tape.id]);
      void triggerHapticFeedback('selection', haptics);
    },
    [dispatchCommand, haptics, isReadOnly, setSelectedIds],
  );

  const handleCoverSelectionWithTape = useCallback(() => {
    if (isReadOnly || selectedObjects.length !== 1) return;
    const target = selectedObjects[0];
    if (!target) return;
    const id = `reveal-tape-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const tape = createRevealTapeCoveringObject(id, target);
    dispatchCommand({ type: 'object.insert', object: tape });
    setSelectedIds([tape.id]);
    void triggerHapticFeedback('selection', haptics);
  }, [dispatchCommand, haptics, isReadOnly, selectedObjects, setSelectedIds]);

  const handleResetAllTapes = useCallback(() => {
    const commands = buildResetAllRevealTapesCommands(document);
    if (commands.length === 0) return;
    dispatchBatchCommands(commands);
    void triggerHapticFeedback('selection', haptics);
  }, [dispatchBatchCommands, document, haptics]);

  const handleToggleSelectedPrivate = useCallback(() => {
    if (isReadOnly || selectedObjects.length === 0) return;
    const allPrivate = selectedObjects.every((o) => o.isPrivate === true);
    const nextPrivate = !allPrivate;
    const commands: DocumentCommand[] = selectedObjects.map((o) => ({
      type: 'object.update',
      id: o.id,
      isPrivate: nextPrivate,
    }));
    dispatchBatchCommands(commands);
    void triggerHapticFeedback('selection', haptics);
  }, [dispatchBatchCommands, haptics, isReadOnly, selectedObjects]);

  const handleOpenStageOverlay = useCallback((mode: StageOverlayMode) => {
    setStageOverlayMode(mode);
    setStageOverlayVisible(true);
  }, []);

  const handleCloseStageOverlay = useCallback(() => {
    setStageOverlayVisible(false);
  }, []);

  const handleToggleHidePrivatePreview = useCallback(() => {
    setHidePrivatePreview((prev) => !prev);
  }, []);

  return {
    stageOverlayVisible,
    stageOverlayMode,
    setStageOverlayMode,
    hidePrivatePreview,
    selectedRevealTape,
    canCoverWithTape,
    singleSelectedObject,
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
  };
}
