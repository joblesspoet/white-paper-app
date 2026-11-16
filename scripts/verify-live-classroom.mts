import assert from 'node:assert/strict';

import { applyCommand, EMPTY_DOCUMENT } from '../src/canvas/document.ts';
import { createInkStroke } from '../src/canvas/ink.ts';
import { IDENTITY_VIEWPORT } from '../src/canvas/viewport.ts';
import { DEFAULT_BOARD_SETTINGS } from '../src/persistence/schema.ts';
import {
  buildClassroomDeepLink,
  formatRoomCode,
  generateRoomCode,
  normalizeRoomCode,
  parseClassroomDeepLink,
  parseClassroomEnvelope,
  applySerializableCommand,
} from '../src/classroom/protocol.ts';
import { encodeQrMatrix } from '../src/classroom/qr.ts';
import { diffDocumentsToSerializableCommand } from '../src/classroom/diff.ts';
import { LocalLoopbackTransport, LoopbackHub } from '../src/classroom/transport.ts';
import { ClassroomSession } from '../src/classroom/classroom-session.ts';

async function main() {
  // 1. Room code, deep link & QR matrix
  const code = generateRoomCode(() => 0.5);
  assert.match(code, /^\d{6}$/);
  assert.equal(normalizeRoomCode('482 - 910'), '482910');
  assert.equal(normalizeRoomCode('12345'), null);
  assert.equal(formatRoomCode('482910'), '482 - 910');

  const deepLink = buildClassroomDeepLink('482910');
  assert.equal(deepLink, 'flowcanvas://join?code=482910');
  assert.equal(parseClassroomDeepLink(deepLink), '482910');
  assert.equal(parseClassroomDeepLink('482 - 910'), '482910');

  const qr = encodeQrMatrix(deepLink);
  assert.ok(qr.size >= 21 && qr.modules.length === qr.size);
  // Top-left finder pattern outer dark border
  assert.equal(qr.modules[0][0], true);
  assert.equal(qr.modules[0][6], true);
  assert.equal(qr.modules[6][0], true);
  assert.equal(qr.modules[1][1], false);

  // 2. Envelope schema validation
  assert.equal(parseClassroomEnvelope(null), null);
  assert.equal(parseClassroomEnvelope({ v: 1, type: 'unknown' }), null);

  // 3. Multi-peer simulation: 1 Teacher + 3 Students
  const hub = new LoopbackHub();
  const teacherDoc = applyCommand(EMPTY_DOCUMENT, {
    type: 'ink.add',
    stroke: createInkStroke({
      id: 'initial-stroke',
      tool: 'pen',
      point: { x: 10, y: 20 },
      color: '#0F172A',
      width: 4,
      opacity: 1,
    }),
  });

  let student1Doc = EMPTY_DOCUMENT;
  let student2Doc = EMPTY_DOCUMENT;
  let student3Doc = EMPTY_DOCUMENT;
  let student1EphemeralCount = 0;
  let student2ShowcaseName: string | null = null;

  const teacher = new ClassroomSession(
    new LocalLoopbackTransport(hub),
    {},
    'teacher-1',
  );
  const student1 = new ClassroomSession(
    new LocalLoopbackTransport(hub),
    {
      onSnapshot: (snap) => {
        student1Doc = snap.document;
      },
      onRemoteCommand: (_pageId, cmd) => {
        student1Doc = applySerializableCommand(student1Doc, cmd);
      },
      onEphemeral: () => {
        student1EphemeralCount += 1;
      },
    },
    'student-1',
  );
  const student2 = new ClassroomSession(
    new LocalLoopbackTransport(hub),
    {
      onSnapshot: (snap) => {
        student2Doc = snap.document;
      },
      onRemoteCommand: (_pageId, cmd) => {
        student2Doc = applySerializableCommand(student2Doc, cmd);
      },
      onShowcase: (sc) => {
        student2ShowcaseName = sc.studentName ?? null;
      },
    },
    'student-2',
  );
  const student3 = new ClassroomSession(
    new LocalLoopbackTransport(hub),
    {
      onSnapshot: (snap) => {
        student3Doc = snap.document;
      },
      onRemoteCommand: (_pageId, cmd) => {
        student3Doc = applySerializableCommand(student3Doc, cmd);
      },
    },
    'student-3',
  );

  const room = await teacher.startAsTeacher({
    boardId: 'board-1',
    boardTitle: 'Algebra 101',
    pageId: 'page-1',
    pageName: 'Page 1',
    pageOrderIndex: 0,
    boardSettings: DEFAULT_BOARD_SETTINGS,
    document: teacherDoc,
    viewport: IDENTITY_VIEWPORT,
    roomCode: '482910',
  });
  assert.equal(room.roomCode, '482910');

  await student1.joinAsStudent({ roomCode: '482910', displayName: 'Ali' });
  await student2.joinAsStudent({ roomCode: '482910', displayName: 'Sara' });
  await student3.joinAsStudent({ roomCode: '482910', displayName: 'Zain' });

  // Initial snapshot.sync received by all 3 students
  assert.equal(student1Doc.strokes.length, 1);
  assert.equal(student2Doc.strokes.length, 1);
  assert.equal(student3Doc.strokes.length, 1);
  assert.equal(teacher.getState().participants.length, 3);

  // Ephemeral 30 Hz stream propagation
  await teacher.sendEphemeral(
    {
      pageId: 'page-1',
      activeStroke: {
        strokeId: 'live-1',
        authorPeerId: 'teacher-1',
        tool: 'pen',
        color: 'ink',
        width: 4,
        opacity: 1,
        points: [{ x: 50, y: 60 }],
      },
    },
    true,
  );
  assert.equal(student1EphemeralCount, 1);

  // Teacher broadcasts a shape creation via diffDocumentsToSerializableCommand
  const shapeDoc = applyCommand(teacherDoc, {
    type: 'object.insert',
    object: {
      id: 'shape-1',
      type: 'shape',
      shape: 'rectangle',
      x: 100,
      y: 100,
      width: 120,
      height: 80,
      rotation: 0,
      direction: 'tlbr',
      colorKey: 'blue',
      fillKey: null,
      strokeWidth: 2,
    },
  });
  const cmd = diffDocumentsToSerializableCommand(teacherDoc, shapeDoc);
  assert.ok(cmd);
  teacher.updateHostSnapshot({
    pageId: 'page-1',
    pageName: 'Page 1',
    pageOrderIndex: 0,
    boardSettings: DEFAULT_BOARD_SETTINGS,
    document: shapeDoc,
    viewport: IDENTITY_VIEWPORT,
  });
  await teacher.broadcastCommand('page-1', cmd);
  assert.equal(student1Doc.objects.length, 1);
  assert.equal(student2Doc.objects.length, 1);

  // Security check: view-only student cannot broadcast commands
  await student1.getState(); // sanity
  const rogueTransport = new LocalLoopbackTransport(hub);
  await rogueTransport.connect('482910', {
    peerId: 'student-1',
    displayName: 'Ali',
    role: 'student',
    joinedAt: new Date().toISOString(),
  });
  await rogueTransport.send({
    v: 1,
    type: 'command.broadcast',
    roomCode: '482910',
    senderPeerId: 'student-1',
    seq: 99,
    sentAt: Date.now(),
    payload: {
      pageId: 'page-1',
      command: { kind: 'object.delete', objectId: 'shape-1' },
    },
  });
  assert.equal(teacher.getState().rejectedCommandsCount, 1);
  assert.equal(student2Doc.objects.length, 1);
  await rogueTransport.disconnect();

  // Grant can-draw to student1
  await teacher.grantDrawPermission('student-1');
  assert.equal(student1.getState().myPermission, 'can-draw');

  const studentStroke = createInkStroke({
    id: 'student1-stroke',
    tool: 'pen',
    point: { x: 200, y: 200 },
    color: '#0D9488',
    width: 4,
    opacity: 1,
  });
  await student1.broadcastCommand('page-1', { kind: 'stroke.add', stroke: studentStroke });
  assert.equal(student2Doc.strokes.length, 2);

  // Raise hand & 1-student-at-a-time voice enforcement
  await student1.raiseHand();
  await student2.raiseHand();
  assert.equal(
    teacher.getState().participants.filter((p) => p.handRaised).length,
    2,
  );

  await teacher.allowStudentVoice('student-1');
  assert.equal(student1.getState().myCanSpeak, true);
  assert.equal(student2.getState().myCanSpeak, false);

  // Allowing student-2 automatically revokes student-1
  await teacher.allowStudentVoice('student-2');
  assert.equal(student1.getState().myCanSpeak, false);
  assert.equal(student2.getState().myCanSpeak, true);

  // Student scratchpad gallery & showcase
  const scratchDoc = applyCommand(EMPTY_DOCUMENT, {
    type: 'ink.add',
    stroke: createInkStroke({
      id: 'scratch-1',
      tool: 'pen',
      point: { x: 30, y: 40 },
      color: '#EA580C',
      width: 4,
      opacity: 1,
    }),
  });
  await student1.sendStudentScratchpad(scratchDoc, IDENTITY_VIEWPORT, true);
  assert.ok(teacher.getState().studentBoards['student-1']);
  await teacher.showcaseStudentBoard('student-1');
  assert.equal(student2ShowcaseName, 'Ali');

  // Lock class revokes drawing and active student speaker
  await teacher.setClassLocked(true);
  assert.equal(student1.getState().myPermission, 'locked');
  assert.equal(student2.getState().myCanSpeak, false);
  assert.equal(teacher.getState().roomInfo?.isLocked, true);

  // Follow teacher viewport toggle broadcasts to students
  await teacher.setFollowTeacherViewport(false);
  assert.equal(student1.getState().roomInfo?.followTeacherViewport, false);
  await teacher.setFollowTeacherViewport(true);
  assert.equal(student1.getState().roomInfo?.followTeacherViewport, true);

  // Reconnect & seq resync check
  await student3.resume();
  assert.equal(student3Doc.strokes.length, 2);

  await teacher.endOrLeave();
  assert.equal(teacher.getState().active, false);

  console.log('✓ Live Classroom verification passed (1 teacher + 3 students).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
