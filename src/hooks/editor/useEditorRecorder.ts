import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { CanvasDocument } from '../../canvas/document';
import type { Viewport } from '../../canvas/viewport';
import { shareFile } from '../../export/share';
import { useMonetization } from '../../monetization/monetization-context';
import type { BoardPageRecord } from '../../persistence/repository';
import {
  beginCountdown,
  completeRecording,
  createRecorderSession,
  getElapsedMs,
  pauseRecording,
  recordDocumentChange,
  recordPageSwitch,
  recordViewportSample,
  resumeRecording,
  startRecording,
  stopRecordingBegin,
  type LessonRecorderSession,
  type LessonRecordingPackage,
  type RecorderStatus,
  type VideoQuality,
} from '../../recorder/lesson-recorder';
import {
  clearRecoveryCheckpoint,
  deleteSavedLesson,
  listSavedLessons,
  loadLessonPackage,
  saveLessonPackage,
  saveRecoveryCheckpoint,
  type SavedLessonSummary,
} from '../../recorder/lesson-store';
import {
  pauseNativeCapture,
  resumeNativeCapture,
  saveVideoToGallery,
  startNativeCapture,
  stopNativeCapture,
} from '../../recorder/native-recorder';
import { requestMicrophonePermission } from '../../recorder/permissions';

type UseEditorRecorderArgs = {
  boardId?: string;
  title: string;
  document: CanvasDocument;
  pages: BoardPageRecord[];
  activePageIdRef: React.MutableRefObject<string | null>;
  viewportLive: React.MutableRefObject<Viewport>;
  initialDefaultViewport: Viewport;
  canvasRect: { x: number; y: number; width: number; height: number };
};

export function useEditorRecorder({
  boardId,
  title,
  document,
  pages,
  activePageIdRef,
  viewportLive,
  initialDefaultViewport,
  canvasRect,
}: UseEditorRecorderArgs) {
  const { limits, openPaywall } = useMonetization();
  const [recorderBarVisible, setRecorderBarVisible] = useState(false);
  const [recorderQualityState, setRecorderQualityState] = useState<VideoQuality>(
    limits.lessonRecorderMaxQuality,
  );
  const recorderQuality: VideoQuality = limits.lessonVideoUnlimitedEnabled
    ? recorderQualityState
    : limits.lessonRecorderMaxQuality;

  const setRecorderQuality = useCallback(
    (next: VideoQuality) => {
      if (!limits.lessonVideoUnlimitedEnabled && next !== '480p') {
        openPaywall({ reason: 'lesson_recorder_hd' });
        return;
      }
      setRecorderQualityState(next);
    },
    [limits.lessonVideoUnlimitedEnabled, openPaywall],
  );
  const [recorderMic, setRecorderMic] = useState(true);
  const [recorderStatus, setRecorderStatus] = useState<RecorderStatus>('idle');
  const [recorderElapsedMs, setRecorderElapsedMs] = useState(0);
  const [recorderCountdown, setRecorderCountdown] = useState(3);
  const recorderSessionRef = useRef<LessonRecorderSession | null>(null);

  const [replayLesson, setReplayLesson] = useState<LessonRecordingPackage | null>(null);
  const [replayAlreadySaved, setReplayAlreadySaved] = useState(false);
  const [replayNotice, setReplayNotice] = useState<string | null>(null);
  const [savedLessonsVisible, setSavedLessonsVisible] = useState(false);
  const [savedLessons, setSavedLessons] = useState<SavedLessonSummary[]>([]);

  const refreshSavedLessons = useCallback(async () => {
    const list = await listSavedLessons();
    setSavedLessons(list);
  }, []);

  useEffect(() => {
    if (recorderBarVisible || savedLessonsVisible) {
      void refreshSavedLessons();
    }
  }, [recorderBarVisible, refreshSavedLessons, savedLessonsVisible]);

  // Capture document mutations while recording
  useEffect(() => {
    const session = recorderSessionRef.current;
    const pageId = activePageIdRef.current;
    if (!session || session.status !== 'recording' || !pageId) return;
    recorderSessionRef.current = recordDocumentChange(session, pageId, document, Date.now());
  }, [activePageIdRef, document]);

  // Auto-pause on background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        const session = recorderSessionRef.current;
        if (session && session.status === 'recording') {
          const paused = pauseRecording(session, Date.now());
          recorderSessionRef.current = paused;
          setRecorderStatus('paused');
          setRecorderElapsedMs(getElapsedMs(paused, Date.now()));
          void pauseNativeCapture();
          const { pkg } = completeRecording(paused, Date.now());
          void saveRecoveryCheckpoint(pkg);
        }
      }
    });
    return () => subscription.remove();
  }, []);

  // Countdown tick -> start recording
  useEffect(() => {
    if (recorderStatus !== 'countdown') return;
    if (recorderCountdown <= 0) {
      const session = recorderSessionRef.current;
      if (!session) return;
      const started = startRecording(session, Date.now());
      recorderSessionRef.current = started;
      setRecorderStatus('recording');
      setRecorderElapsedMs(0);
      const hasCanvasRect = canvasRect.width > 0 && canvasRect.height > 0;
      const aspect = hasCanvasRect ? canvasRect.width / canvasRect.height : 16 / 9;
      void startNativeCapture({
        quality: started.quality,
        includeMic: started.includeMic,
        aspectRatio: aspect,
        cropRect: hasCanvasRect ? canvasRect : undefined,
      });
      return;
    }
    const timer = setTimeout(() => {
      setRecorderCountdown((c) => c - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [canvasRect, recorderCountdown, recorderStatus]);

  const autoStoppedForLimitRef = useRef(false);
  const stopRecordingRef = useRef<(() => Promise<void>) | null>(null);

  // Elapsed timer tick while recording (enforces free/studio preview cap)
  useEffect(() => {
    if (recorderStatus !== 'recording') return;
    autoStoppedForLimitRef.current = false;
    const maxMs =
      limits.lessonRecorderMaxSeconds !== null
        ? limits.lessonRecorderMaxSeconds * 1000
        : null;
    const id = setInterval(() => {
      const session = recorderSessionRef.current;
      if (!session) return;
      const elapsed = getElapsedMs(session, Date.now());
      setRecorderElapsedMs(elapsed);
      if (maxMs !== null && elapsed >= maxMs && !autoStoppedForLimitRef.current) {
        autoStoppedForLimitRef.current = true;
        void stopRecordingRef.current?.();
      }
    }, 250);
    return () => clearInterval(id);
  }, [limits.lessonRecorderMaxSeconds, recorderStatus]);

  const recordViewportIfActive = useCallback(
    (next: Viewport) => {
      if (recorderSessionRef.current?.status === 'recording' && activePageIdRef.current) {
        recorderSessionRef.current = recordViewportSample(
          recorderSessionRef.current,
          activePageIdRef.current,
          next,
          Date.now(),
        );
      }
    },
    [activePageIdRef],
  );

  const recordPageSwitchIfActive = useCallback(
    (pageId: string, pageIndex: number, doc: CanvasDocument, nextViewport: Viewport) => {
      if (recorderSessionRef.current?.status === 'recording') {
        recorderSessionRef.current = recordPageSwitch(
          recorderSessionRef.current,
          pageId,
          pageIndex,
          doc,
          nextViewport,
          Date.now(),
        );
      }
    },
    [],
  );

  const handleStartRecording = useCallback(async () => {
    if (!boardId) return;
    if (recorderMic) {
      await requestMicrophonePermission();
    }
    const initialPages =
      pages.length > 0
        ? pages.map((p) => ({
            id: p.id,
            title: p.name,
            document: p.id === activePageIdRef.current ? document : p.document,
            viewport:
              p.id === activePageIdRef.current
                ? viewportLive.current
                : (p.viewport ?? initialDefaultViewport),
          }))
        : [
            {
              id: activePageIdRef.current ?? 'page-1',
              title: 'Page 1',
              document,
              viewport: viewportLive.current,
            },
          ];

    const session = createRecorderSession({
      id: `lesson-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      boardId,
      title: title.trim() || 'Whiteboard Lesson',
      quality: recorderQuality,
      includeMic: recorderMic,
      initialPageId: activePageIdRef.current ?? initialPages[0].id,
      pages: initialPages,
    });
    recorderSessionRef.current = beginCountdown(session, 3);
    setRecorderCountdown(3);
    setRecorderElapsedMs(0);
    setRecorderStatus('countdown');
  }, [
    activePageIdRef,
    boardId,
    document,
    initialDefaultViewport,
    pages,
    recorderMic,
    recorderQuality,
    title,
    viewportLive,
  ]);

  const handleCancelCountdown = useCallback(() => {
    recorderSessionRef.current = null;
    setRecorderStatus('idle');
    setRecorderCountdown(3);
  }, []);

  const handlePauseResumeRecording = useCallback(() => {
    const session = recorderSessionRef.current;
    if (!session) return;
    if (session.status === 'recording') {
      const paused = pauseRecording(session, Date.now());
      recorderSessionRef.current = paused;
      setRecorderStatus('paused');
      setRecorderElapsedMs(getElapsedMs(paused, Date.now()));
      void pauseNativeCapture();
    } else if (session.status === 'paused') {
      const resumed = resumeRecording(session, Date.now());
      recorderSessionRef.current = resumed;
      setRecorderStatus('recording');
      void resumeNativeCapture();
    }
  }, []);

  const handleStopRecording = useCallback(async () => {
    const session = recorderSessionRef.current;
    if (!session) return;
    const stopping = stopRecordingBegin(session, Date.now());
    recorderSessionRef.current = stopping;
    setRecorderStatus('stopping');
    const nativeResult = await stopNativeCapture();
    const { pkg } = completeRecording(stopping, Date.now(), {
      videoUri: nativeResult.videoUri,
      audioUri: nativeResult.audioUri,
    });
    recorderSessionRef.current = null;
    setRecorderStatus('idle');
    setRecorderElapsedMs(0);
    await clearRecoveryCheckpoint();
    setReplayLesson(pkg);
    setReplayAlreadySaved(false);
    setReplayNotice(
      autoStoppedForLimitRef.current
        ? 'Reached 4-minute free recording limit. Upgrade to Teacher Pro for unlimited HD video.'
        : nativeResult.videoUri
          ? 'Recorded MP4 video + 60 FPS FlowCanvas replay.'
          : nativeResult.audioUri
            ? 'Recorded voice audio + 60 FPS FlowCanvas replay.'
            : 'Recorded as an interactive 60 FPS FlowCanvas replay (.flowlesson.json).',
    );
  }, []);

  stopRecordingRef.current = handleStopRecording;

  const handleSaveReplayLesson = useCallback(
    async (lesson: LessonRecordingPackage) => {
      if (lesson.videoUri) {
        const galleryResult = await saveVideoToGallery(lesson.videoUri);
        if (galleryResult.saved) {
          setReplayAlreadySaved(true);
          setReplayNotice('Video saved to your device Gallery.');
          return;
        }
        setReplayNotice(galleryResult.message ?? 'Could not save video to Gallery.');
        return;
      }
      await saveLessonPackage(lesson);
      setReplayAlreadySaved(true);
      setReplayNotice('Saved to your in-app Saved Lessons library.');
      void refreshSavedLessons();
    },
    [refreshSavedLessons],
  );

  const handleShareReplayLesson = useCallback(
    async (lesson: LessonRecordingPackage) => {
      let uriToShare = lesson.videoUri;
      let mimeType = 'video/mp4';
      if (!uriToShare) {
        const saved = await saveLessonPackage(lesson);
        uriToShare = saved.lessonUri;
        mimeType = 'application/json';
        setReplayAlreadySaved(true);
        void refreshSavedLessons();
      }
      const result = await shareFile({
        uri: uriToShare,
        mimeType,
        dialogTitle: `Share ${lesson.title}`,
      });
      if (result.outcome === 'unavailable') {
        setReplayNotice('System share sheet is unavailable on this device.');
      } else if (result.outcome === 'failed') {
        setReplayNotice(result.message ?? 'Could not open the share sheet.');
      } else if (result.outcome === 'shared') {
        setReplayNotice('Lesson shared.');
      }
    },
    [refreshSavedLessons],
  );

  const handlePlaySavedLesson = useCallback(async (item: SavedLessonSummary) => {
    const pkg = await loadLessonPackage(item.lessonUri);
    if (!pkg) return;
    setSavedLessonsVisible(false);
    setReplayLesson(pkg);
    setReplayAlreadySaved(true);
    setReplayNotice(null);
  }, []);

  const handleShareSavedLesson = useCallback(async (item: SavedLessonSummary) => {
    await shareFile({
      uri: item.videoUri ?? item.lessonUri,
      mimeType: item.videoUri ? 'video/mp4' : 'application/json',
      dialogTitle: `Share ${item.title}`,
    });
  }, []);

  const handleDeleteSavedLesson = useCallback(
    async (item: SavedLessonSummary) => {
      await deleteSavedLesson(item);
      void refreshSavedLessons();
    },
    [refreshSavedLessons],
  );

  const closeReplayModal = useCallback(() => {
    setReplayLesson(null);
    setReplayNotice(null);
  }, []);

  return {
    recorderBarVisible,
    setRecorderBarVisible,
    recorderQuality,
    setRecorderQuality,
    recorderMic,
    setRecorderMic,
    recorderStatus,
    recorderElapsedMs,
    recorderCountdown,
    replayLesson,
    replayAlreadySaved,
    replayNotice,
    savedLessonsVisible,
    setSavedLessonsVisible,
    savedLessons,
    recordViewportIfActive,
    recordPageSwitchIfActive,
    handleStartRecording,
    handleCancelCountdown,
    handlePauseResumeRecording,
    handleStopRecording,
    handleSaveReplayLesson,
    handleShareReplayLesson,
    handlePlaySavedLesson,
    handleShareSavedLesson,
    handleDeleteSavedLesson,
    closeReplayModal,
  };
}
