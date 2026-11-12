/**
 * Native backup store: pick a `.flowcanvas.json`, read it, plan the import, write
 * media files, and insert the board atomically.
 *
 * The pure schema work lives in `backup.ts`. This module owns the file system
 * and the database, so the plan itself stays testable in Node.
 */

import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';

import type { PersistenceDatabase } from '../persistence/database.ts';
import { getLocalDatabase } from '../persistence/expo-store.ts';
import { insertImportedBoard } from '../persistence/repository.ts';
import {
  assertBackupSize,
  BackupError,
  BACKUP_EXTENSION,
  type BackupImportPlan,
  type BoardBackup,
  planBackupImport,
  parseBackup,
} from './backup.ts';
import type { ImportedMediaPlan } from './backup.ts';

export type BackupPickResult =
  | { canceled: true }
  | { canceled: false; plan: BackupImportPlan; backup: BoardBackup; warnings: string[]; size: number };

/** Open the document picker restricted to FlowCanvas backups. */
export async function pickBackupFile(): Promise<BackupPickResult> {
  const result = await DocumentPicker.getDocumentAsync({
    type: BACKUP_EXTENSION,
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return { canceled: true };
  const asset = result.assets[0];
  if (!asset) throw new BackupError('empty-file', 'No file was returned by the picker.');
  if (!asset.uri) throw new BackupError('empty-file', 'The picked file has no local URI.');

  const file = new File(asset.uri);
  const size = file.size;
  assertBackupSize(size);
  const raw = await file.text();
  const parsed = parseBackup(raw);
  return {
    canceled: false,
    plan: planBackupImport(parsed.backup, newBoardId()),
    backup: parsed.backup,
    warnings: parsed.warnings,
    size: size ?? 0,
  };
}

/** A new board is always created; an import never overwrites an existing board. */
export function newBoardId(): string {
  return `imported-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export type ImportProgress = (fraction: number, label: string) => void;

export type ImportResult =
  | { canceled: true }
  | { ok: true; boardId: string; warnings: string[] }
  | { ok: false; error: string; warnings: string[]; cleanedUp: boolean };

/**
 * Write media files and insert the board in one database transaction. Media is
 * written first so a failed insert can clean up what it wrote.
 */
export async function importBackup(
  plan: BackupImportPlan,
  onProgress?: ImportProgress,
): Promise<ImportResult> {
  const warnings: string[] = [];
  const written: string[] = [];
  const database = await getLocalDatabase();

  try {
    onProgress?.(0.05, 'Writing media files…');
    for (let index = 0; index < plan.media.length; index += 1) {
      const entry = plan.media[index];
      if (entry.data.length === 0) {
        warnings.push(`Skipped a missing media file (${entry.oldPath}).`);
        continue;
      }
      const file = new File(Paths.document, ...entry.storagePath.split('/'));
      file.create({ intermediates: true, overwrite: true });
      file.write(entry.data, { encoding: 'base64' });
      written.push(entry.storagePath);
      onProgress?.(0.05 + 0.3 * (index + 1) / plan.media.length, `Writing media file ${index + 1} of ${plan.media.length}…`);
    }

    onProgress?.(0.4, 'Saving the board…');
    await insertImportedBoard(database, plan);
    onProgress?.(1, 'Board imported.');
    return { ok: true, boardId: plan.board.id, warnings };
  } catch (error) {
    for (const storagePath of written) {
      try {
        const file = new File(Paths.document, ...storagePath.split('/'));
        if (file.exists) file.delete();
      } catch {
        // Cleanup is best effort; an orphaned file is harmless.
      }
    }
    return {
      ok: false,
      error: error instanceof BackupError ? error.message : (error instanceof Error ? error.message : 'The board could not be imported.'),
      warnings,
      cleanedUp: true,
    };
  }
}

/** Re-exported so the UI can show a summary before confirming. */
export { backupSummary } from './backup.ts';
export type { BackupImportPlan, BoardBackup, ImportedMediaPlan } from './backup.ts';