/**
 * Computes a compact `SerializableCanvasCommand` from two `CanvasDocument`
 * revisions so every committed local mutation (pen, shapes, text, tables,
 * math, undo/redo) broadcasts cleanly without duplicating command builders.
 */

import type { CanvasDocument } from '../canvas/document.ts';
import type { SerializableCanvasCommand } from './protocol.ts';

export function diffDocumentsToSerializableCommand(
  prevDoc: CanvasDocument,
  nextDoc: CanvasDocument,
): SerializableCanvasCommand | null {
  if (prevDoc === nextDoc) return null;

  const commands: SerializableCanvasCommand[] = [];

  const prevStrokeMap = new Map(prevDoc.strokes.map((s) => [s.id, s]));
  const nextStrokeIds = new Set(nextDoc.strokes.map((s) => s.id));

  const removedStrokeIds: string[] = [];
  for (const s of prevDoc.strokes) {
    if (!nextStrokeIds.has(s.id)) {
      removedStrokeIds.push(s.id);
    }
  }
  if (removedStrokeIds.length > 0) {
    commands.push({ kind: 'strokes.erase', removedIds: removedStrokeIds });
  }

  for (const s of nextDoc.strokes) {
    if (!prevStrokeMap.has(s.id)) {
      commands.push({ kind: 'stroke.add', stroke: s });
    }
  }

  const prevObjMap = new Map(prevDoc.objects.map((o) => [o.id, o]));
  const nextObjIds = new Set(nextDoc.objects.map((o) => o.id));

  for (const obj of prevDoc.objects) {
    if (!nextObjIds.has(obj.id)) {
      commands.push({ kind: 'object.delete', objectId: obj.id, deletedObject: obj });
    }
  }

  for (const obj of nextDoc.objects) {
    const prevObj = prevObjMap.get(obj.id);
    if (!prevObj) {
      commands.push({ kind: 'object.create', object: obj });
    } else if (prevObj !== obj) {
      commands.push({
        kind: 'object.update',
        objectId: obj.id,
        fullObject: obj,
        previousObject: prevObj,
      });
    }
  }

  if (commands.length === 0) return null;
  if (commands.length === 1) return commands[0];
  return { kind: 'batch', commands };
}
