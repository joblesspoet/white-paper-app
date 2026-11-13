import assert from 'node:assert/strict';

import { EMPTY_DOCUMENT, createShapeObject } from '../src/canvas/document.ts';
import { createInkStroke } from '../src/canvas/ink.ts';
import {
  FACECAM_IDLE_RING_COLOR,
  FACECAM_RECORDING_RING_COLOR,
  clampFaceCamPosition,
  cycleFaceCamSize,
  faceCamBorderRadius,
  faceCamRingColor,
  faceCamSizePt,
  snapFaceCamToNearestCorner,
} from '../src/recorder/facecam-model.ts';
import {
  beginCountdown,
  completeRecording,
  createRecorderSession,
  failRecording,
  formatDurationMMSS,
  getElapsedMs,
  interpolateLessonAtTime,
  parseLessonPackage,
  pauseRecording,
  recordDocumentChange,
  recordLaserSample,
  recordPageSwitch,
  recordViewportSample,
  resolutionForQuality,
  resumeRecording,
  startRecording,
  stopRecordingBegin,
} from '../src/recorder/lesson-recorder.ts';
import {
  classifyPermissionOutcome,
  parseAndroidApiLevel,
  requiredAndroidMediaPermissions,
} from '../src/recorder/permission-model.ts';

// 1. Face-Cam size presets, shape radius, ring color, clamping & corner snapping
assert.equal(faceCamSizePt('small'), 88);
assert.equal(faceCamSizePt('medium'), 124);
assert.equal(faceCamSizePt('large'), 164);
assert.equal(cycleFaceCamSize('small'), 'medium');
assert.equal(cycleFaceCamSize('medium'), 'large');
assert.equal(cycleFaceCamSize('large'), 'small');

assert.equal(faceCamBorderRadius('circle', 124), 62);
assert.equal(faceCamBorderRadius('rounded-card', 124), 16);
assert.equal(faceCamRingColor(false), FACECAM_IDLE_RING_COLOR);
assert.equal(faceCamRingColor(true), FACECAM_RECORDING_RING_COLOR);

// Phone viewport with bottom ActionIsland exclusion (76pt)
const clampedPhone = clampFaceCamPosition({ x: 999, y: 999 }, 390, 720, 124, 76);
assert.equal(clampedPhone.x, 390 - 124 - 12);
assert.equal(clampedPhone.y, 720 - 124 - 76 - 12);

const snapTopLeft = snapFaceCamToNearestCorner({ x: 30, y: 40 }, 390, 720, 88, 76);
assert.equal(snapTopLeft.corner, 'top-left');
assert.deepEqual(snapTopLeft.position, { x: 12, y: 12 });

// Tablet viewport
const snapBottomRight = snapFaceCamToNearestCorner({ x: 900, y: 700 }, 1024, 768, 164, 0);
assert.equal(snapBottomRight.corner, 'bottom-right');
assert.deepEqual(snapBottomRight.position, { x: 1024 - 164 - 12, y: 768 - 164 - 12 });

// 2. Cross-version Android & iOS permission policy
assert.equal(parseAndroidApiLevel(34), 34);
assert.equal(parseAndroidApiLevel('33'), 33);
assert.deepEqual(requiredAndroidMediaPermissions(34), [
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.READ_MEDIA_AUDIO',
]);
assert.deepEqual(requiredAndroidMediaPermissions(31), [
  'android.permission.READ_EXTERNAL_STORAGE',
]);
assert.deepEqual(requiredAndroidMediaPermissions(28), [
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
]);

const blockedMic = classifyPermissionOutcome('microphone', false, false);
assert.equal(blockedMic.status, 'blocked');
assert.ok(blockedMic.message?.includes('Settings'));

// 3. Video resolution presets
const res480 = resolutionForQuality('480p', 16 / 9);
const res720 = resolutionForQuality('720p', 16 / 9);
const res1080 = resolutionForQuality('1080p', 16 / 9);
assert.equal(res480.height, 480);
assert.equal(res480.width % 2, 0);
assert.equal(res720.height, 720);
assert.equal(res720.width, 1280);
assert.equal(res1080.height, 1080);
assert.equal(res1080.width, 1920);

// 4. Recorder state machine & pause/resume elapsed time accounting
let session = createRecorderSession({
  id: 'lesson-test-1',
  boardId: 'board-1',
  title: 'Physics 101',
  quality: '720p',
  includeMic: true,
  initialPageId: 'page-1',
  pages: [
    {
      id: 'page-1',
      title: 'Page 1',
      document: EMPTY_DOCUMENT,
      viewport: { x: 0, y: 0, scale: 1 },
    },
  ],
  nowMs: 1000,
});
assert.equal(session.status, 'idle');

session = beginCountdown(session, 3);
assert.equal(session.status, 'countdown');

session = startRecording(session, 4000);
assert.equal(session.status, 'recording');

// Add a stroke at t = 1500ms (nowMs = 5500)
const stroke1 = createInkStroke({
  id: 'stroke-1',
  tool: 'pen',
  color: '#0F172A',
  width: 4,
  opacity: 1,
  point: { x: 10, y: 10 },
});
const docAfterStroke = { strokes: [stroke1], objects: [] };
session = recordDocumentChange(session, 'page-1', docAfterStroke, 5500);

// Viewport pan at t = 2000ms (nowMs = 6000)
session = recordViewportSample(session, 'page-1', { x: -40, y: -20, scale: 1.25 }, 6000);

// Pause at t = 3000ms (nowMs = 7000) -> 3000ms elapsed
session = pauseRecording(session, 7000);
assert.equal(session.status, 'paused');
assert.equal(getElapsedMs(session, 12000), 3000);

// Events while paused must be ignored
const beforePausedEventCount = session.events.length;
session = recordViewportSample(session, 'page-1', { x: 999, y: 999, scale: 2 }, 10000);
assert.equal(session.events.length, beforePausedEventCount);

// Resume at nowMs = 15000 (paused for 8000ms)
session = resumeRecording(session, 15000);
assert.equal(session.status, 'recording');

// Laser sample at t = 3500ms (nowMs = 15500)
session = recordLaserSample(
  session,
  'page-1',
  { colorKey: 'red', points: [{ x: 50, y: 50 }, { x: 80, y: 80 }] },
  15500,
);

// Switch to page-2 at t = 4500ms (nowMs = 16500) and insert shape
const rectShape = createShapeObject({
  id: 'shape-1',
  shape: 'rectangle',
  start: { x: 40, y: 40 },
  end: { x: 160, y: 120 },
  colorKey: 'teal',
  fillKey: 'none',
  strokeWidth: 2,
});
session = recordPageSwitch(
  session,
  'page-2',
  1,
  EMPTY_DOCUMENT,
  { x: 0, y: 0, scale: 1 },
  16500,
);
session = recordDocumentChange(
  session,
  'page-2',
  { strokes: [], objects: [rectShape] },
  17000,
);

// Stop at nowMs = 18000 -> total active duration = 3000 + (18000 - 15000) = 6000ms
session = stopRecordingBegin(session, 18000);
assert.equal(session.status, 'stopping');
const completed = completeRecording(session, 18000);
assert.equal(completed.session.status, 'completed');
assert.equal(completed.pkg.durationMs, 6000);
assert.equal(formatDurationMMSS(completed.pkg.durationMs), '00:06');

// Error transition check
const errored = failRecording(session, 'Disk full', 18500);
assert.equal(errored.status, 'error');
assert.equal(errored.errorMessage, 'Disk full');

// 5. Deterministic replay interpolation & .flowlesson.json round-trip
const roundTripped = parseLessonPackage(JSON.stringify(completed.pkg));
assert.ok(roundTripped !== null);

const atStart = interpolateLessonAtTime(roundTripped, 0);
assert.equal(atStart.pageId, 'page-1');
assert.equal(atStart.document.strokes.length, 0);

const at2500 = interpolateLessonAtTime(roundTripped, 2500);
assert.equal(at2500.pageId, 'page-1');
assert.equal(at2500.document.strokes.length, 1);
assert.equal(at2500.viewport.scale, 1.25);

const at3800 = interpolateLessonAtTime(roundTripped, 3800);
assert.ok(at3800.laserTrail !== null);
assert.ok(at3800.laserTrail.opacity > 0.5);

const atEnd = interpolateLessonAtTime(roundTripped, 6000);
assert.equal(atEnd.pageId, 'page-2');
assert.equal(atEnd.pageIndex, 1);
assert.equal(atEnd.document.objects.length, 1);
assert.equal(atEnd.document.objects[0].id, 'shape-1');

console.log(
  'lesson-recorder checks passed: Face-Cam geometry/snapping, iOS/Android permissions, recorder state machine, and deterministic 60 FPS replay',
);
