/**
 * Local durable storage for `.flowlesson.json` packages, recovery checkpoints,
 * and the in-app Saved Lessons library.
 */

import { Directory, File, Paths } from 'expo-file-system';

import {
  parseLessonPackage,
  type LessonRecordingPackage,
  type VideoQuality,
} from './lesson-recorder';

export const LESSONS_DIR_NAME = 'lessons';
export const LESSON_FILE_EXTENSION = '.flowlesson.json';
const RECOVERY_FILENAME = '_recovery.flowlesson.json';

export type SavedLessonSummary = {
  id: string;
  boardId: string;
  title: string;
  createdAt: number;
  durationMs: number;
  quality: VideoQuality;
  sizeBytes: number;
  lessonUri: string;
  videoUri: string | null;
  audioUri: string | null;
  eventCount: number;
};

function getLessonsDirectory(): Directory {
  const dir = new Directory(Paths.document, LESSONS_DIR_NAME);
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

export function formatStorageBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

export async function saveLessonPackage(
  pkg: LessonRecordingPackage,
): Promise<SavedLessonSummary> {
  const dir = getLessonsDirectory();
  const safeId = pkg.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const file = new File(dir, `${safeId}${LESSON_FILE_EXTENSION}`);
  const serialized = JSON.stringify(pkg);
  file.write(serialized);

  return {
    id: pkg.id,
    boardId: pkg.boardId,
    title: pkg.title,
    createdAt: pkg.createdAt,
    durationMs: pkg.durationMs,
    quality: pkg.quality,
    sizeBytes: file.size || serialized.length,
    lessonUri: file.uri,
    videoUri: pkg.videoUri ?? null,
    audioUri: pkg.audioUri ?? null,
    eventCount: pkg.events.length,
  };
}

export async function loadLessonPackage(
  lessonUri: string,
): Promise<LessonRecordingPackage | null> {
  try {
    const file = new File(lessonUri);
    if (!file.exists) return null;
    const raw = await file.text();
    return parseLessonPackage(raw);
  } catch {
    return null;
  }
}

export async function listSavedLessons(): Promise<SavedLessonSummary[]> {
  try {
    const dir = getLessonsDirectory();
    const entries = dir.list();
    const summaries: SavedLessonSummary[] = [];

    for (const entry of entries) {
      if (!(entry instanceof File)) continue;
      if (!entry.name.endsWith(LESSON_FILE_EXTENSION)) continue;
      if (entry.name === RECOVERY_FILENAME) continue;

      try {
        const raw = await entry.text();
        const pkg = parseLessonPackage(raw);
        if (!pkg) continue;
        summaries.push({
          id: pkg.id,
          boardId: pkg.boardId,
          title: pkg.title,
          createdAt: pkg.createdAt,
          durationMs: pkg.durationMs,
          quality: pkg.quality,
          sizeBytes: entry.size || raw.length,
          lessonUri: entry.uri,
          videoUri: pkg.videoUri ?? null,
          audioUri: pkg.audioUri ?? null,
          eventCount: pkg.events.length,
        });
      } catch {
        // Skip corrupt lesson files without breaking the library list.
      }
    }

    summaries.sort((a, b) => b.createdAt - a.createdAt);
    return summaries;
  } catch {
    return [];
  }
}

function tryDeleteFile(uri: string | null | undefined): void {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }
  } catch {
    // Ignore cleanup failures for missing or external URIs.
  }
}

export async function deleteSavedLesson(summary: SavedLessonSummary): Promise<void> {
  tryDeleteFile(summary.lessonUri);
  tryDeleteFile(summary.videoUri);
  tryDeleteFile(summary.audioUri);
}

export async function saveRecoveryCheckpoint(pkg: LessonRecordingPackage): Promise<void> {
  try {
    const dir = getLessonsDirectory();
    const file = new File(dir, RECOVERY_FILENAME);
    file.write(JSON.stringify(pkg));
  } catch {
    // Best-effort checkpoint on backgrounding.
  }
}

export async function clearRecoveryCheckpoint(): Promise<void> {
  try {
    const dir = getLessonsDirectory();
    const file = new File(dir, RECOVERY_FILENAME);
    if (file.exists) file.delete();
  } catch {
    // Ignore cleanup errors.
  }
}
