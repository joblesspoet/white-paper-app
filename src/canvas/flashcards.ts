/**
 * 1-Thumb Flashcard Study Deck extractor.
 *
 * Builds swipeable study cards from:
 * 1. `RevealTapeObject`s paired with text/math/sticky objects hidden underneath.
 * 2. Parent `StickyObject`s linked to child `StickyObject`s via magnetic
 *    `ConnectorObject`s (`startBinding` -> `endBinding`).
 *
 * Kept free of React Native / Expo imports so it can be verified in plain Node.
 */

import type {
  CanvasDocument,
  CanvasObject,
  ConnectorObject,
  RevealTapeObject,
  StickyObject,
} from './document.ts';
import { findCoveredObjectsUnderTape } from './reveal-tape.ts';

export type FlashcardSource = 'reveal-tape' | 'connected-sticky';

export type FlashcardItem = {
  id: string;
  source: FlashcardSource;
  prompt: string;
  answer: string;
  colorKey: string;
};

function objectStudyText(object: CanvasObject): string {
  if (object.type === 'text' || object.type === 'sticky') {
    return object.text.trim();
  }
  if (object.type === 'math') {
    const cleanLatex = object.latex.replace(/\\([a-zA-Z]+)/g, '$1').trim();
    return cleanLatex || object.displayText.trim();
  }
  return '';
}

function findNearestPromptAboveOrLeft(
  tape: RevealTapeObject,
  objects: readonly CanvasObject[],
  coveredIds: Set<string>,
): string | null {
  const tapeCx = tape.x + tape.width / 2;
  const tapeCy = tape.y + tape.height / 2;
  let bestText: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of objects) {
    if (candidate.id === tape.id || coveredIds.has(candidate.id)) continue;
    if (candidate.type !== 'text' && candidate.type !== 'sticky' && candidate.type !== 'math') {
      continue;
    }
    const text = objectStudyText(candidate);
    if (!text) continue;
    const cx = candidate.x + candidate.width / 2;
    const cy = candidate.y + candidate.height / 2;
    // Prefer labels located near/above/left of the reveal tape within 260 canvas units.
    if (cy > tape.y + tape.height + 40 && cx > tape.x + tape.width + 40) continue;
    const dist = Math.hypot(cx - tapeCx, cy - tapeCy);
    if (dist <= 260 && dist < bestDistance) {
      bestDistance = dist;
      bestText = text;
    }
  }
  return bestText;
}

export function extractFlashcardsFromDocument(
  document: CanvasDocument,
): FlashcardItem[] {
  const cards: FlashcardItem[] = [];
  const byId = new Map<string, CanvasObject>(document.objects.map((o) => [o.id, o]));

  // 1. Reveal Tape cards
  for (const obj of document.objects) {
    if (obj.type !== 'reveal-tape') continue;
    const covered = findCoveredObjectsUnderTape(obj, document.objects);
    const answerParts = covered
      .map(objectStudyText)
      .filter((t) => t.length > 0);
    if (answerParts.length === 0) continue;

    const coveredIds = new Set(covered.map((c) => c.id));
    const nearbyPrompt = findNearestPromptAboveOrLeft(obj, document.objects, coveredIds);
    const prompt =
      nearbyPrompt ??
      (obj.label && obj.label !== 'Tap to reveal' ? obj.label : 'Hidden board item');

    cards.push({
      id: `tape:${obj.id}`,
      source: 'reveal-tape',
      prompt,
      answer: answerParts.join('\n'),
      colorKey: obj.colorKey,
    });
  }

  // 2. Magnetic connected Sticky Note pairs (parent -> child)
  const seenPairs = new Set<string>();
  for (const obj of document.objects) {
    if (obj.type !== 'connector') continue;
    const connector: ConnectorObject = obj;
    const startId = connector.startBinding?.objectId;
    const endId = connector.endBinding?.objectId;
    if (!startId || !endId || startId === endId) continue;

    const parent = byId.get(startId);
    const child = byId.get(endId);
    if (!parent || !child) continue;
    if (parent.type !== 'sticky' || child.type !== 'sticky') continue;

    const front = (parent as StickyObject).text.trim();
    const back = (child as StickyObject).text.trim();
    if (!front || !back) continue;

    const pairKey = `${parent.id}->${child.id}`;
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);

    cards.push({
      id: `pair:${pairKey}`,
      source: 'connected-sticky',
      prompt: front,
      answer: back,
      colorKey: parent.colorKey,
    });
  }

  return cards;
}
