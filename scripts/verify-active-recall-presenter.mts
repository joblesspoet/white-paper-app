import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

import {
  MAX_VOICE_PIN_DURATION_MS,
  createVoicePinObject,
  formatVoiceDuration,
  normalizeWaveformPeaks,
  voicePinStoragePath,
} from '../src/audio/voice-pin-model.ts';
import {
  createConnectorObject,
  createDocumentHistory,
  createMathObject,
  createStickyObject,
  createTextObject,
  documentReducer,
  documentsEqual,
  filterPublicDocument,
  findObject,
  objectAtPoint,
  type CanvasDocument,
} from '../src/canvas/document.ts';
import { extractFlashcardsFromDocument } from '../src/canvas/flashcards.ts';
import {
  buildResetAllRevealTapesCommands,
  createRevealTapeCoveringObject,
  createRevealTapeObject,
  findCoveredObjectsUnderTape,
  resetAllRevealTapes,
  toggleRevealTape,
} from '../src/canvas/reveal-tape.ts';
import { IDENTITY_VIEWPORT } from '../src/canvas/viewport.ts';
import { ClassroomSession } from '../src/classroom/classroom-session.ts';
import {
  buildPollResultsChartObject,
  closeClassroomPoll,
  computePollSummary,
  createClassroomPoll,
  submitPollVote,
} from '../src/classroom/poll-model.ts';
import { filterPublicSerializableCommand } from '../src/classroom/protocol.ts';
import { LocalLoopbackTransport, LoopbackHub } from '../src/classroom/transport.ts';
import { buildBoardBackup, parseBackup, planBackupImport, serializeBackup } from '../src/export/backup.ts';
import type { PersistenceDatabase, SqlParams } from '../src/persistence/database.ts';
import {
  insertBoard,
  insertImportedBoard,
  insertMediaAsset,
  listMediaAssets,
  loadBoardDocument,
  saveBoardDocument,
} from '../src/persistence/repository.ts';
import { DEFAULT_BOARD_SETTINGS, MIGRATIONS } from '../src/persistence/schema.ts';
import {
  classifyPermissionOutcome,
  parseAndroidApiLevel,
  requiredAndroidMediaPermissions,
} from '../src/recorder/permission-model.ts';

function openTestDb(): PersistenceDatabase {
  const raw = new DatabaseSync(':memory:');
  const db: PersistenceDatabase = {
    execAsync: async (sql: string) => {
      raw.exec(sql);
    },
    runAsync: async (sql: string, params: SqlParams = []) => {
      const stmt = raw.prepare(sql);
      const res = stmt.run(...(params as never[]));
      return {
        changes: Number(res.changes ?? 0),
        lastInsertRowId: Number(res.lastInsertRowid ?? 0),
      };
    },
    getFirstAsync: async <T,>(sql: string, params: SqlParams = []) => {
      const stmt = raw.prepare(sql);
      return (stmt.get(...(params as never[])) as T | undefined) ?? null;
    },
    getAllAsync: async <T,>(sql: string, params: SqlParams = []) => {
      const stmt = raw.prepare(sql);
      return stmt.all(...(params as never[])) as T[];
    },
    withTransactionAsync: async <T,>(action: () => Promise<T>) => {
      raw.exec('BEGIN');
      try {
        const result = await action();
        raw.exec('COMMIT');
        return result;
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
  };
  for (const migration of MIGRATIONS) {
    for (const stmt of migration.statements) {
      raw.exec(stmt);
    }
  }
  return db;
}

async function run(): Promise<void> {
  // 1. Tap-to-Reveal Tape creation, toggle, resetAllRevealTapes, & spatial overlap
  const promptText = {
    ...createTextObject({ id: 'q1', point: { x: 200, y: 120 } }),
    text: 'Derivative of sin(x)',
  };
  const answerMath = createMathObject({
    id: 'a1',
    point: { x: 200, y: 190 },
    latex: '\\cos(x)',
  });
  const tape = createRevealTapeCoveringObject('tape-1', answerMath, 'mint', 'Answer');
  assert.equal(tape.type, 'reveal-tape');
  assert.equal(tape.isRevealed, false);

  const covered = findCoveredObjectsUnderTape(tape, [promptText, answerMath, tape]);
  assert.equal(covered.length, 1);
  assert.equal(covered[0]?.id, answerMath.id);

  // Hit-testing a RevealTape covering a StickyObject must return the tape, not the sticky underneath.
  const coveredSticky = createStickyObject({ id: 's-under', point: { x: 800, y: 800 } });
  const stickyTape = createRevealTapeCoveringObject('tape-over-sticky', coveredSticky);
  const hitTop = objectAtPoint([coveredSticky, stickyTape], { x: 800, y: 800 });
  assert.equal(hitTop?.id, stickyTape.id);

  const toggled = toggleRevealTape(tape);
  assert.equal(toggled.isRevealed, true);

  let history = createDocumentHistory({
    strokes: [],
    objects: [
      promptText,
      answerMath,
      tape,
      createRevealTapeObject({ id: 'tape-2', point: { x: 500, y: 200 } }),
    ],
  });
  history = documentReducer(history, {
    type: 'command',
    command: { type: 'object.update', id: 'tape-1', isRevealed: true },
  });
  history = documentReducer(history, {
    type: 'command',
    command: { type: 'object.update', id: 'tape-2', isRevealed: true },
  });
  assert.equal((findObject(history.present, 'tape-1') as typeof tape).isRevealed, true);
  assert.equal((findObject(history.present, 'tape-2') as typeof tape).isRevealed, true);

  const resetDoc = resetAllRevealTapes(history.present);
  assert.equal((findObject(resetDoc, 'tape-1') as typeof tape).isRevealed, false);
  assert.equal((findObject(resetDoc, 'tape-2') as typeof tape).isRevealed, false);

  const resetCmds = buildResetAllRevealTapesCommands(history.present);
  assert.equal(resetCmds.length, 2);
  history = documentReducer(history, { type: 'commands', commands: resetCmds });
  assert.equal((findObject(history.present, 'tape-1') as typeof tape).isRevealed, false);
  assert.equal((findObject(history.present, 'tape-2') as typeof tape).isRevealed, false);

  // 2. VoicePinObject normalization, SQLite persistence, and `.flowcanvas.json` backup round-trip
  const peaksFromDb = normalizeWaveformPeaks([-60, -30, -10, 0, -20, -5]);
  assert.equal(peaksFromDb.length, 16);
  for (const p of peaksFromDb) {
    assert.ok(p >= 0.08 && p <= 1, `Expected normalized peak in [0.08, 1], got ${p}`);
  }
  assert.equal(formatVoiceDuration(14_200), '0:14');
  assert.equal(formatVoiceDuration(MAX_VOICE_PIN_DURATION_MS), '5:00');

  const voiceStorage = voicePinStoragePath('board-1', 'voice-abc');
  assert.equal(voiceStorage, 'media/board-1/audio/voice-abc.m4a');

  const voicePin = createVoicePinObject({
    id: 'vp-1',
    point: { x: 320, y: 240 },
    audioAssetId: 'voice-abc',
    storagePath: voiceStorage,
    durationMs: 14_200,
    waveformPeaks: peaksFromDb,
    transcript: 'Check sign on step 2',
    isPrivate: true,
  });

  const db = openTestDb();
  const now = new Date().toISOString();
  await insertBoard(db, {
    id: 'board-1',
    title: 'Active Recall Lesson',
    settings: DEFAULT_BOARD_SETTINGS,
    createdAt: now,
  });
  await insertMediaAsset(db, {
    id: 'voice-abc',
    boardId: 'board-1',
    ownerId: null,
    storagePath: voiceStorage,
    mimeType: 'audio/m4a',
    bytes: 1280,
    metadata: { durationMs: 14_200, kind: 'voice-pin' },
    createdAt: now,
  });

  const privateNote = {
    ...createStickyObject({ id: 'priv-1', point: { x: 640, y: 120 }, colorKey: 'lilac' }),
    text: 'Teacher cue: pause before revealing answer',
    isPrivate: true,
  };
  const publicNote = {
    ...createStickyObject({ id: 'pub-1', point: { x: 100, y: 400 }, colorKey: 'mint' }),
    text: 'Class takeaway',
  };
  const childNote = {
    ...createStickyObject({ id: 'pub-2', point: { x: 360, y: 400 }, colorKey: 'sky' }),
    text: 'Derivative of sin(x) is cos(x)',
  };
  const noteConnector = createConnectorObject({
    id: 'conn-1',
    style: 'arrow',
    start: { x: publicNote.x + publicNote.width, y: publicNote.y + 56 },
    end: { x: childNote.x, y: childNote.y + 56 },
    startBinding: { objectId: publicNote.id, port: 'right' },
    endBinding: { objectId: childNote.id, port: 'left' },
  });

  const fullDoc: CanvasDocument = {
    strokes: [],
    objects: [promptText, answerMath, tape, voicePin, privateNote, publicNote, childNote, noteConnector],
  };

  await saveBoardDocument(db, 'board-1', fullDoc, IDENTITY_VIEWPORT);
  const loaded = await loadBoardDocument(db, 'board-1');
  assert.ok(loaded, 'Expected saved board document to load');
  assert.ok(documentsEqual(loaded.document, fullDoc), 'SQLite round-trip should preserve RevealTape, VoicePin, and isPrivate');
  const assets = await listMediaAssets(db, 'board-1');
  assert.equal(assets.length, 1);
  assert.equal(assets[0]?.mimeType, 'audio/m4a');

  // Backup round-trip keeps `isPrivate` objects AND embeds/remaps `voice-pin` audio
  const dummyAudioBase64 = Buffer.from('FAKE_M4A_BYTES_FOR_TEST').toString('base64');
  const backup = buildBoardBackup({
    title: 'Active Recall Lesson',
    document: fullDoc,
    viewport: IDENTITY_VIEWPORT,
    settings: DEFAULT_BOARD_SETTINGS,
    media: [
      {
        path: voiceStorage,
        mimeType: 'audio/m4a',
        data: dummyAudioBase64,
      },
    ],
  });
  const parsed = parseBackup(serializeBackup(backup));
  const importPlan = planBackupImport(parsed.backup, 'board-imported-1', now);
  assert.equal(importPlan.media.length, 1);
  assert.equal(importPlan.media[0]?.mimeType, 'audio/m4a');
  const importedPin = importPlan.document.objects.find((o) => o.type === 'voice-pin');
  assert.ok(importedPin && importedPin.type === 'voice-pin');
  assert.equal(importedPin.audioAssetId, importPlan.media[0]?.assetId);
  assert.equal(importedPin.storagePath, importPlan.media[0]?.storagePath);
  assert.equal(importedPin.isPrivate, true);
  assert.ok(
    importPlan.document.objects.some((o) => o.type === 'sticky' && o.isPrivate === true),
    'Backup round-trip must preserve presenter-only objects',
  );

  await insertImportedBoard(db, importPlan, now);
  const reloadedImport = await loadBoardDocument(db, 'board-imported-1');
  assert.ok(reloadedImport && documentsEqual(reloadedImport.document, importPlan.document));

  // 3. Presenter-only (`isPrivate`) filtering for Live Classroom & default exports
  const publicOnlyDoc = filterPublicDocument(fullDoc);
  assert.equal(publicOnlyDoc.objects.some((o) => o.isPrivate === true), false);
  assert.equal(publicOnlyDoc.objects.length, fullDoc.objects.length - 2);

  assert.equal(
    filterPublicSerializableCommand({ kind: 'object.create', object: privateNote }),
    null,
  );
  const hideUpdate = filterPublicSerializableCommand({
    kind: 'object.update',
    objectId: publicNote.id,
    fullObject: { ...publicNote, isPrivate: true },
    previousObject: publicNote,
  });
  assert.deepEqual(hideUpdate, { kind: 'object.delete', objectId: publicNote.id });

  // Live Classroom teacher -> student session strips `isPrivate` from snapshots & broadcasts
  const hub = new LoopbackHub();
  const teacherTransport = new LocalLoopbackTransport(hub);
  const studentTransport = new LocalLoopbackTransport(hub);
  let studentSnapshot: CanvasDocument | null = null;
  let studentReceivedCommands = 0;

  const teacherSession = new ClassroomSession(teacherTransport, {}, 'teacher-peer');
  const studentSession = new ClassroomSession(
    studentTransport,
    {
      onSnapshot: (snap) => {
        studentSnapshot = snap.document;
      },
      onRemoteCommand: () => {
        studentReceivedCommands += 1;
      },
    },
    'student-peer-1',
  );

  const roomInfo = await teacherSession.startAsTeacher({
    boardId: 'board-1',
    boardTitle: 'Active Recall Lesson',
    pageId: 'page-1',
    pageName: 'Page 1',
    pageOrderIndex: 0,
    boardSettings: DEFAULT_BOARD_SETTINGS,
    document: fullDoc,
    viewport: IDENTITY_VIEWPORT,
  });
  await studentSession.joinAsStudent({
    roomCode: roomInfo.roomCode,
    displayName: 'Alice',
  });

  assert.ok(studentSnapshot !== null, 'Student should receive initial snapshot');
  const snapDoc = studentSnapshot as CanvasDocument;
  assert.equal(
    snapDoc.objects.some((o) => o.isPrivate === true),
    false,
    'Student snapshot must never contain isPrivate objects',
  );

  await teacherSession.broadcastCommand('page-1', {
    kind: 'object.create',
    object: { ...privateNote, id: 'priv-2' },
  });
  assert.equal(studentReceivedCommands, 0, 'isPrivate create command must not broadcast to students');

  // 4. Live Classroom Pop-Quiz Poll & deduplication + chart generation
  let poll = createClassroomPoll({
    id: 'poll-1',
    kind: 'abcd',
    question: 'What is d/dx sin(x)?',
    correctOptionId: 'B',
  });
  poll = submitPollVote(poll, 'student-1', 'B');
  poll = submitPollVote(poll, 'student-1', 'A'); // duplicate peerId must be ignored
  poll = submitPollVote(poll, 'student-2', 'B');
  poll = submitPollVote(poll, 'student-3', 'C');

  const summary = computePollSummary(poll);
  assert.equal(summary.totalVotes, 3);
  assert.equal(summary.leadingOptionId, 'B');
  const optB = summary.options.find((o) => o.id === 'B');
  assert.equal(optB?.count, 2);
  assert.equal(optB?.percentage, 67);
  assert.equal(optB?.isCorrect, true);

  const closed = closeClassroomPoll(poll);
  assert.equal(closed.status, 'closed');
  const afterClose = submitPollVote(closed, 'student-4', 'A');
  assert.equal(computePollSummary(afterClose).totalVotes, 3);

  const pollChart = buildPollResultsChartObject({
    id: 'chart-poll-1',
    poll: closed,
    point: { x: 400, y: 400 },
  });
  assert.equal(pollChart.type, 'chart');
  assert.equal(pollChart.chartType, 'bar');
  assert.deepEqual(pollChart.series[0]?.values, [0, 2, 1, 0]);

  // Live poll transport sync between teacher and student
  await teacherSession.startPoll(
    createClassroomPoll({ id: 'poll-live', kind: 'true-false', question: 'Ready?' }),
  );
  assert.equal(studentSession.getState().activePoll?.id, 'poll-live');
  await studentSession.voteInPoll('poll-live', 'T');
  assert.equal(teacherSession.getState().activePoll?.votesByPeerId['student-peer-1'], 'T');
  await teacherSession.closePoll('poll-live');
  assert.equal(studentSession.getState().activePoll?.status, 'closed');

  await studentSession.endOrLeave();
  await teacherSession.endOrLeave();

  // 5. Flashcard study deck extraction (Reveal Tapes + Connected Sticky Notes)
  const flashcards = extractFlashcardsFromDocument(fullDoc);
  assert.equal(flashcards.length, 2);
  const tapeCard = flashcards.find((c) => c.source === 'reveal-tape');
  assert.ok(tapeCard);
  assert.equal(tapeCard.prompt, 'Derivative of sin(x)');
  assert.ok(tapeCard.answer.includes('cos(x)'));

  const stickyCard = flashcards.find((c) => c.source === 'connected-sticky');
  assert.ok(stickyCard);
  assert.equal(stickyCard.prompt, 'Class takeaway');
  assert.equal(stickyCard.answer, 'Derivative of sin(x) is cos(x)');

  // 6. Cross-version iOS & Android permission helpers
  assert.equal(parseAndroidApiLevel(34), 34);
  assert.deepEqual(requiredAndroidMediaPermissions(33), [
    'android.permission.READ_MEDIA_VIDEO',
    'android.permission.READ_MEDIA_AUDIO',
  ]);
  assert.deepEqual(requiredAndroidMediaPermissions(30), ['android.permission.READ_EXTERNAL_STORAGE']);
  assert.deepEqual(requiredAndroidMediaPermissions(28), [
    'android.permission.READ_EXTERNAL_STORAGE',
    'android.permission.WRITE_EXTERNAL_STORAGE',
  ]);
  assert.equal(classifyPermissionOutcome('microphone', false, false).status, 'blocked');

  console.log('verify-active-recall-presenter: all checks passed');
}

void run();
