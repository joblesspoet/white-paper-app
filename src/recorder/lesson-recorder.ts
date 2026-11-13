/**
 * Deterministic Lesson Recorder & 60 FPS Canvas Replay Engine.
 *
 * Captures initial board/page state plus compact JSON-serializable deltas
 * (`DocumentDelta`), viewport samples, laser pointer trails, and page switches.
 * Even long 30-60+ minute whiteboard lessons stay small in memory and on disk
 * (`.flowlesson.json`), and can be scrubbed deterministically from `0.5x` to `2x`.
 *
 * Kept free of React Native / Expo imports so it can be verified directly in Node.
 */

import type { CanvasDocument, CanvasObject } from '../canvas/document';
import type { InkStroke } from '../canvas/ink';
import type { LaserColorKey } from '../canvas/laser';
import { IDENTITY_VIEWPORT, type Viewport } from '../canvas/viewport.ts';

export const FLOWLESSON_VERSION = 1;
export const LESSON_LASER_DECAY_MS = 1200;
export const VIEWPORT_SAMPLE_MIN_INTERVAL_MS = 40;
export const LASER_SAMPLE_MIN_INTERVAL_MS = 24;

export type VideoQuality = '480p' | '720p' | '1080p';
export const VIDEO_QUALITY_OPTIONS: readonly VideoQuality[] = ['480p', '720p', '1080p'];

export type VideoResolution = {
  quality: VideoQuality;
  width: number;
  height: number;
  bitrate: number;
};

function makeEven(value: number): number {
  const rounded = Math.round(value);
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

/**
 * Computes even pixel dimensions and target bitrate for `480p`, `720p`, or `1080p`
 * preserving the canvas aspect ratio (defaulting to 16:9).
 */
export function resolutionForQuality(
  quality: VideoQuality,
  aspectRatio: number = 16 / 9,
): VideoResolution {
  const safeAspect = Number.isFinite(aspectRatio) && aspectRatio > 0.2 ? aspectRatio : 16 / 9;
  const shortSide = quality === '480p' ? 480 : quality === '720p' ? 720 : 1080;
  const bitrate =
    quality === '480p' ? 1_800_000 : quality === '720p' ? 3_500_000 : 6_000_000;

  if (safeAspect >= 1) {
    return {
      quality,
      width: makeEven(shortSide * safeAspect),
      height: shortSide,
      bitrate,
    };
  }
  return {
    quality,
    width: shortSide,
    height: makeEven(shortSide / safeAspect),
    bitrate,
  };
}

export type RecorderStatus =
  | 'idle'
  | 'countdown'
  | 'recording'
  | 'paused'
  | 'stopping'
  | 'completed'
  | 'error';

export type DocumentDelta = {
  addedStrokes?: InkStroke[];
  removedStrokeIds?: string[];
  addedObjects?: CanvasObject[];
  updatedObjects?: CanvasObject[];
  removedObjectIds?: string[];
};

export type LessonLaserPoint = {
  x: number;
  y: number;
};

export type LessonLaserSample = {
  points: LessonLaserPoint[];
  colorKey: LaserColorKey;
} | null;

export type LessonEvent =
  | {
      type: 'command';
      tMs: number;
      pageId: string;
      delta: DocumentDelta;
    }
  | {
      type: 'viewport';
      tMs: number;
      pageId: string;
      viewport: Viewport;
    }
  | {
      type: 'laser';
      tMs: number;
      pageId: string;
      stroke: LessonLaserSample;
    }
  | {
      type: 'page.switch';
      tMs: number;
      pageId: string;
      pageIndex: number;
    };

export type LessonInitialPage = {
  id: string;
  title: string;
  document: CanvasDocument;
  viewport: Viewport;
};

export type LessonRecordingPackage = {
  version: number;
  id: string;
  boardId: string;
  title: string;
  createdAt: number;
  durationMs: number;
  quality: VideoQuality;
  includeMic: boolean;
  initialPageId: string;
  pages: LessonInitialPage[];
  events: LessonEvent[];
  videoUri?: string | null;
  audioUri?: string | null;
};

export type LessonRecorderSession = {
  id: string;
  boardId: string;
  title: string;
  status: RecorderStatus;
  quality: VideoQuality;
  includeMic: boolean;
  createdAt: number;
  countdownRemaining: number;
  accumulatedMs: number;
  activeSegmentStartMs: number | null;
  initialPageId: string;
  activePageId: string;
  pages: LessonInitialPage[];
  lastDocByPage: Record<string, CanvasDocument>;
  lastViewportSampleMs: number;
  lastLaserSampleMs: number;
  events: LessonEvent[];
  errorMessage: string | null;
};

export function formatDurationMMSS(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function cloneDocumentShallow(doc: CanvasDocument): CanvasDocument {
  return {
    strokes: [...doc.strokes],
    objects: [...doc.objects],
  };
}

/**
 * Computes a compact, JSON-serializable delta between two immutable `CanvasDocument`s.
 * Returns `null` when nothing changed.
 */
export function computeDocumentDelta(
  prev: CanvasDocument,
  next: CanvasDocument,
): DocumentDelta | null {
  const prevStrokeMap = new Map<string, InkStroke>();
  for (const stroke of prev.strokes) prevStrokeMap.set(stroke.id, stroke);

  const nextStrokeIds = new Set<string>();
  const addedStrokes: InkStroke[] = [];
  for (const stroke of next.strokes) {
    nextStrokeIds.add(stroke.id);
    const old = prevStrokeMap.get(stroke.id);
    if (!old || old !== stroke) {
      addedStrokes.push(stroke);
    }
  }

  const removedStrokeIds: string[] = [];
  for (const stroke of prev.strokes) {
    if (!nextStrokeIds.has(stroke.id)) {
      removedStrokeIds.push(stroke.id);
    }
  }

  const prevObjMap = new Map<string, CanvasObject>();
  for (const obj of prev.objects) prevObjMap.set(obj.id, obj);

  const nextObjIds = new Set<string>();
  const addedObjects: CanvasObject[] = [];
  const updatedObjects: CanvasObject[] = [];
  for (const obj of next.objects) {
    nextObjIds.add(obj.id);
    const old = prevObjMap.get(obj.id);
    if (!old) {
      addedObjects.push(obj);
    } else if (old !== obj) {
      updatedObjects.push(obj);
    }
  }

  const removedObjectIds: string[] = [];
  for (const obj of prev.objects) {
    if (!nextObjIds.has(obj.id)) {
      removedObjectIds.push(obj.id);
    }
  }

  if (
    addedStrokes.length === 0 &&
    removedStrokeIds.length === 0 &&
    addedObjects.length === 0 &&
    updatedObjects.length === 0 &&
    removedObjectIds.length === 0
  ) {
    return null;
  }

  const delta: DocumentDelta = {};
  if (addedStrokes.length > 0) delta.addedStrokes = addedStrokes;
  if (removedStrokeIds.length > 0) delta.removedStrokeIds = removedStrokeIds;
  if (addedObjects.length > 0) delta.addedObjects = addedObjects;
  if (updatedObjects.length > 0) delta.updatedObjects = updatedObjects;
  if (removedObjectIds.length > 0) delta.removedObjectIds = removedObjectIds;
  return delta;
}

export function applyDocumentDelta(
  doc: CanvasDocument,
  delta: DocumentDelta,
): CanvasDocument {
  let strokes = doc.strokes;
  if (delta.removedStrokeIds && delta.removedStrokeIds.length > 0) {
    const removed = new Set(delta.removedStrokeIds);
    strokes = strokes.filter((s) => !removed.has(s.id));
  }
  if (delta.addedStrokes && delta.addedStrokes.length > 0) {
    const addedIds = new Set(delta.addedStrokes.map((s) => s.id));
    strokes = [...strokes.filter((s) => !addedIds.has(s.id)), ...delta.addedStrokes];
  }

  let objects = doc.objects;
  if (delta.removedObjectIds && delta.removedObjectIds.length > 0) {
    const removed = new Set(delta.removedObjectIds);
    objects = objects.filter((o) => !removed.has(o.id));
  }
  if (delta.updatedObjects && delta.updatedObjects.length > 0) {
    const updates = new Map<string, CanvasObject>();
    for (const o of delta.updatedObjects) updates.set(o.id, o);
    objects = objects.map((o) => updates.get(o.id) ?? o);
  }
  if (delta.addedObjects && delta.addedObjects.length > 0) {
    const addedIds = new Set(delta.addedObjects.map((o) => o.id));
    objects = [...objects.filter((o) => !addedIds.has(o.id)), ...delta.addedObjects];
  }

  return { strokes, objects };
}

export function createRecorderSession(params: {
  id: string;
  boardId: string;
  title: string;
  quality: VideoQuality;
  includeMic: boolean;
  initialPageId: string;
  pages: LessonInitialPage[];
  nowMs?: number;
}): LessonRecorderSession {
  const lastDocByPage: Record<string, CanvasDocument> = {};
  for (const p of params.pages) {
    lastDocByPage[p.id] = cloneDocumentShallow(p.document);
  }
  return {
    id: params.id,
    boardId: params.boardId,
    title: params.title,
    status: 'idle',
    quality: params.quality,
    includeMic: params.includeMic,
    createdAt: params.nowMs ?? Date.now(),
    countdownRemaining: 3,
    accumulatedMs: 0,
    activeSegmentStartMs: null,
    initialPageId: params.initialPageId,
    activePageId: params.initialPageId,
    pages: params.pages.map((p) => ({
      ...p,
      document: cloneDocumentShallow(p.document),
      viewport: { ...p.viewport },
    })),
    lastDocByPage,
    lastViewportSampleMs: -Infinity,
    lastLaserSampleMs: -Infinity,
    events: [],
    errorMessage: null,
  };
}

export function beginCountdown(
  session: LessonRecorderSession,
  seconds: number = 3,
): LessonRecorderSession {
  if (session.status !== 'idle' && session.status !== 'error' && session.status !== 'completed') {
    return session;
  }
  return {
    ...session,
    status: 'countdown',
    countdownRemaining: Math.max(0, Math.floor(seconds)),
    errorMessage: null,
  };
}

export function startRecording(
  session: LessonRecorderSession,
  nowMs: number,
): LessonRecorderSession {
  if (session.status !== 'idle' && session.status !== 'countdown') {
    return session;
  }
  return {
    ...session,
    status: 'recording',
    countdownRemaining: 0,
    accumulatedMs: 0,
    activeSegmentStartMs: nowMs,
    errorMessage: null,
  };
}

export function getElapsedMs(session: LessonRecorderSession, nowMs: number): number {
  if (session.status === 'recording' && session.activeSegmentStartMs !== null) {
    return Math.max(0, session.accumulatedMs + Math.max(0, nowMs - session.activeSegmentStartMs));
  }
  return Math.max(0, session.accumulatedMs);
}

export function pauseRecording(
  session: LessonRecorderSession,
  nowMs: number,
): LessonRecorderSession {
  if (session.status !== 'recording') return session;
  return {
    ...session,
    status: 'paused',
    accumulatedMs: getElapsedMs(session, nowMs),
    activeSegmentStartMs: null,
  };
}

export function resumeRecording(
  session: LessonRecorderSession,
  nowMs: number,
): LessonRecorderSession {
  if (session.status !== 'paused') return session;
  return {
    ...session,
    status: 'recording',
    activeSegmentStartMs: nowMs,
  };
}

export function stopRecordingBegin(
  session: LessonRecorderSession,
  nowMs: number,
): LessonRecorderSession {
  if (session.status !== 'recording' && session.status !== 'paused') {
    return session;
  }
  return {
    ...session,
    status: 'stopping',
    accumulatedMs: getElapsedMs(session, nowMs),
    activeSegmentStartMs: null,
  };
}

export function failRecording(
  session: LessonRecorderSession,
  message: string,
  nowMs: number,
): LessonRecorderSession {
  return {
    ...session,
    status: 'error',
    accumulatedMs: getElapsedMs(session, nowMs),
    activeSegmentStartMs: null,
    errorMessage: message,
  };
}

export function recordDocumentChange(
  session: LessonRecorderSession,
  pageId: string,
  nextDocument: CanvasDocument,
  nowMs: number,
): LessonRecorderSession {
  if (session.status !== 'recording') return session;
  const prevDoc = session.lastDocByPage[pageId] ?? { strokes: [], objects: [] };
  const delta = computeDocumentDelta(prevDoc, nextDocument);
  if (!delta) return session;

  const tMs = getElapsedMs(session, nowMs);
  return {
    ...session,
    lastDocByPage: {
      ...session.lastDocByPage,
      [pageId]: cloneDocumentShallow(nextDocument),
    },
    events: [
      ...session.events,
      { type: 'command', tMs, pageId, delta },
    ],
  };
}

export function recordViewportSample(
  session: LessonRecorderSession,
  pageId: string,
  viewport: Viewport,
  nowMs: number,
): LessonRecorderSession {
  if (session.status !== 'recording') return session;
  const tMs = getElapsedMs(session, nowMs);
  if (tMs - session.lastViewportSampleMs < VIEWPORT_SAMPLE_MIN_INTERVAL_MS) {
    return session;
  }
  return {
    ...session,
    lastViewportSampleMs: tMs,
    events: [
      ...session.events,
      { type: 'viewport', tMs, pageId, viewport: { ...viewport } },
    ],
  };
}

export function recordLaserSample(
  session: LessonRecorderSession,
  pageId: string,
  stroke: LessonLaserSample,
  nowMs: number,
): LessonRecorderSession {
  if (session.status !== 'recording') return session;
  const tMs = getElapsedMs(session, nowMs);
  if (stroke !== null && tMs - session.lastLaserSampleMs < LASER_SAMPLE_MIN_INTERVAL_MS) {
    return session;
  }
  return {
    ...session,
    lastLaserSampleMs: stroke === null ? -Infinity : tMs,
    events: [
      ...session.events,
      {
        type: 'laser',
        tMs,
        pageId,
        stroke: stroke
          ? { colorKey: stroke.colorKey, points: stroke.points.map((p) => ({ ...p })) }
          : null,
      },
    ],
  };
}

export function recordPageSwitch(
  session: LessonRecorderSession,
  pageId: string,
  pageIndex: number,
  initialDocIfNew: CanvasDocument,
  initialViewportIfNew: Viewport,
  nowMs: number,
): LessonRecorderSession {
  if (session.status !== 'recording') return session;
  const tMs = getElapsedMs(session, nowMs);
  const hasPage = session.pages.some((p) => p.id === pageId);
  const pages = hasPage
    ? session.pages
    : [
        ...session.pages,
        {
          id: pageId,
          title: `Page ${pageIndex + 1}`,
          document: cloneDocumentShallow(initialDocIfNew),
          viewport: { ...initialViewportIfNew },
        },
      ];
  const lastDocByPage = hasPage
    ? session.lastDocByPage
    : { ...session.lastDocByPage, [pageId]: cloneDocumentShallow(initialDocIfNew) };

  return {
    ...session,
    activePageId: pageId,
    pages,
    lastDocByPage,
    events: [
      ...session.events,
      { type: 'page.switch', tMs, pageId, pageIndex },
    ],
  };
}

export function completeRecording(
  session: LessonRecorderSession,
  nowMs: number,
  artifacts?: { videoUri?: string | null; audioUri?: string | null },
): { session: LessonRecorderSession; pkg: LessonRecordingPackage } {
  const durationMs = getElapsedMs(session, nowMs);
  const nextSession: LessonRecorderSession = {
    ...session,
    status: 'completed',
    accumulatedMs: durationMs,
    activeSegmentStartMs: null,
  };
  const pkg: LessonRecordingPackage = {
    version: FLOWLESSON_VERSION,
    id: session.id,
    boardId: session.boardId,
    title: session.title,
    createdAt: session.createdAt,
    durationMs,
    quality: session.quality,
    includeMic: session.includeMic,
    initialPageId: session.initialPageId,
    pages: session.pages,
    events: session.events,
    videoUri: artifacts?.videoUri ?? null,
    audioUri: artifacts?.audioUri ?? null,
  };
  return { session: nextSession, pkg };
}

export type ReplayedLessonState = {
  pageId: string;
  pageIndex: number;
  document: CanvasDocument;
  viewport: Viewport;
  laserTrail: {
    points: LessonLaserPoint[];
    colorKey: LaserColorKey;
    opacity: number;
  } | null;
  currentTimeMs: number;
  durationMs: number;
  progress: number;
};

/**
 * Deterministically reconstructs the exact canvas document, active page,
 * viewport, and decaying laser trail at any timestamp `tMs` in `[0, durationMs]`.
 */
export function interpolateLessonAtTime(
  pkg: LessonRecordingPackage,
  tMs: number,
): ReplayedLessonState {
  const durationMs = Math.max(0, pkg.durationMs);
  const clampedT = Math.max(0, Math.min(durationMs, tMs));

  const docsByPage = new Map<string, CanvasDocument>();
  const viewportsByPage = new Map<string, Viewport>();
  const pageIndexById = new Map<string, number>();

  pkg.pages.forEach((p, idx) => {
    docsByPage.set(p.id, cloneDocumentShallow(p.document));
    viewportsByPage.set(p.id, { ...p.viewport });
    pageIndexById.set(p.id, idx);
  });

  let activePageId = pkg.initialPageId || pkg.pages[0]?.id || 'page-1';
  let activePageIndex = pageIndexById.get(activePageId) ?? 0;

  let lastLaser: {
    tMs: number;
    pageId: string;
    stroke: LessonLaserSample;
  } | null = null;

  for (const event of pkg.events) {
    if (event.tMs > clampedT) break;
    switch (event.type) {
      case 'command': {
        const cur = docsByPage.get(event.pageId) ?? { strokes: [], objects: [] };
        docsByPage.set(event.pageId, applyDocumentDelta(cur, event.delta));
        break;
      }
      case 'viewport': {
        viewportsByPage.set(event.pageId, { ...event.viewport });
        break;
      }
      case 'page.switch': {
        activePageId = event.pageId;
        activePageIndex = event.pageIndex;
        break;
      }
      case 'laser': {
        lastLaser = { tMs: event.tMs, pageId: event.pageId, stroke: event.stroke };
        break;
      }
    }
  }

  let laserTrail: ReplayedLessonState['laserTrail'] = null;
  if (lastLaser && lastLaser.stroke && lastLaser.pageId === activePageId) {
    const age = clampedT - lastLaser.tMs;
    if (age >= 0 && age <= LESSON_LASER_DECAY_MS) {
      laserTrail = {
        points: lastLaser.stroke.points,
        colorKey: lastLaser.stroke.colorKey,
        opacity: Math.max(0, 1 - age / LESSON_LASER_DECAY_MS),
      };
    }
  }

  return {
    pageId: activePageId,
    pageIndex: activePageIndex,
    document: docsByPage.get(activePageId) ?? { strokes: [], objects: [] },
    viewport: viewportsByPage.get(activePageId) ?? IDENTITY_VIEWPORT,
    laserTrail,
    currentTimeMs: clampedT,
    durationMs,
    progress: durationMs > 0 ? clampedT / durationMs : 0,
  };
}

export function parseLessonPackage(raw: string): LessonRecordingPackage | null {
  try {
    const parsed = JSON.parse(raw) as Partial<LessonRecordingPackage>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.version !== 'number' || parsed.version > FLOWLESSON_VERSION) return null;
    if (typeof parsed.id !== 'string' || !Array.isArray(parsed.pages) || !Array.isArray(parsed.events)) {
      return null;
    }
    return parsed as LessonRecordingPackage;
  } catch {
    return null;
  }
}
