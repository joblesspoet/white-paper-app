import { useCallback, useMemo } from 'react';

import { computeTidyLayout, type TidyMode } from '../canvas/auto-layout';
import {
  buildQuickBranchSpec,
  canQuickBranchObject,
  type CardinalDirection,
} from '../canvas/connectors';
import type {
  CanvasDocument,
  CanvasObject,
  DocumentCommand,
  ShapeObject,
  StickyObject,
} from '../canvas/document';

export type UseMagneticMindMapParams = {
  document: CanvasDocument;
  selectedObjects: readonly CanvasObject[];
  editing: boolean;
  isReadOnly?: boolean;
  connectorColorKey: string;
  dispatchCommand: (command: DocumentCommand, transient?: boolean) => void;
  dispatchBatchCommands: (commands: readonly DocumentCommand[]) => void;
  setSelectedIds: (ids: string[]) => void;
};

export function useMagneticMindMap({
  selectedObjects,
  editing,
  isReadOnly = false,
  connectorColorKey,
  dispatchCommand,
  dispatchBatchCommands,
  setSelectedIds,
}: UseMagneticMindMapParams) {
  const quickBranchTarget = useMemo<StickyObject | ShapeObject | null>(() => {
    if (isReadOnly || editing || selectedObjects.length !== 1) return null;
    const only = selectedObjects[0];
    return canQuickBranchObject(only) ? only : null;
  }, [editing, isReadOnly, selectedObjects]);

  const canTidySelection = useMemo(() => {
    if (isReadOnly || editing) return false;
    const movableCount = selectedObjects.filter(
      (obj) => obj.type !== 'connector' && !obj.locked,
    ).length;
    return movableCount >= 3;
  }, [editing, isReadOnly, selectedObjects]);

  const handleQuickBranch = useCallback(
    (direction: CardinalDirection) => {
      if (!quickBranchTarget || isReadOnly) return;
      const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const newNodeId = `${quickBranchTarget.type}-branch-${suffix}`;
      const newConnectorId = `connector-branch-${suffix}`;
      const spec = buildQuickBranchSpec({
        source: quickBranchTarget,
        direction,
        newNodeId,
        newConnectorId,
        connectorColorKey,
      });

      dispatchBatchCommands([
        { type: 'object.insert', object: spec.child },
        { type: 'object.insert', object: spec.connector },
      ]);
      setSelectedIds([spec.child.id]);
    },
    [connectorColorKey, dispatchBatchCommands, isReadOnly, quickBranchTarget, setSelectedIds],
  );

  const handleTidyLayout = useCallback(
    (mode: TidyMode) => {
      if (isReadOnly) return;
      const updates = computeTidyLayout(selectedObjects, mode);
      if (updates.length === 0) return;
      const label =
        mode === 'grid'
          ? 'Tidy grid'
          : mode === 'row'
            ? 'Align row'
            : 'Align column';
      dispatchCommand({
        type: 'objects.geometry',
        label,
        updates,
      });
    },
    [dispatchCommand, isReadOnly, selectedObjects],
  );

  return {
    quickBranchTarget,
    canTidySelection,
    handleQuickBranch,
    handleTidyLayout,
  };
}
