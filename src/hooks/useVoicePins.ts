import { useCallback, useEffect, useRef, useState } from 'react';

import {
  cancelVoicePinRecording,
  playVoicePinAudio,
  pollVoicePinRecordingProgress,
  startVoicePinRecording,
  stopVoicePinPlayback,
  stopVoicePinRecording,
} from '../audio/voice-pin-recorder';
import {
  VOICE_PIN_PEAK_COUNT,
  createVoicePinObject,
  deleteVoicePinAudioFile,
  resolveVoicePinUri,
  storeVoicePinAudioFile,
} from '../audio/voice-pin-store';
import type { CanvasDocument, DocumentCommand, VoicePinObject } from '../canvas/document';
import type { Point } from '../canvas/viewport';
import { getLocalDatabase } from '../persistence/expo-store';
import { insertMediaAsset } from '../persistence/repository';
import { openAppSettings } from '../recorder/permissions';
import { triggerHapticFeedback } from '../utils/haptics';

export type UseVoicePinsParams = {
  boardId: string;
  document: CanvasDocument;
  haptics: boolean;
  isReadOnly?: boolean;
  getViewportCenterPoint: () => Point;
  dispatchCommand: (command: DocumentCommand, transient?: boolean) => void;
  setSelectedIds: (ids: string[]) => void;
};

const EMPTY_PEAKS = Array.from({ length: VOICE_PIN_PEAK_COUNT }, () => 0.16);

export function useVoicePins({
  boardId,
  document,
  haptics,
  isReadOnly = false,
  getViewportCenterPoint,
  dispatchCommand,
  setSelectedIds,
}: UseVoicePinsParams) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingMs, setRecordingMs] = useState(0);
  const [livePeaks, setLivePeaks] = useState<number[]>(EMPTY_PEAKS);
  const [playingPinId, setPlayingPinId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [permissionBlocked, setPermissionBlocked] = useState(false);

  const pendingAnchorRef = useRef<Point | null>(null);
  const stoppingRef = useRef(false);

  const finalizeAndInsertRecording = useCallback(async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    try {
      const result = await stopVoicePinRecording();
      setIsRecording(false);
      setRecordingMs(0);
      setLivePeaks(EMPTY_PEAKS);

      if (!result.ok) {
        setErrorMessage(result.error);
        setPermissionBlocked(result.permission?.status === 'blocked');
        return;
      }

      const stored = await storeVoicePinAudioFile({
        boardId,
        sourceUri: result.uri,
        mimeType: 'audio/m4a',
        extension: 'm4a',
      });

      try {
        const db = await getLocalDatabase();
        await insertMediaAsset(db, {
          id: stored.assetId,
          boardId,
          ownerId: null,
          storagePath: stored.storagePath,
          mimeType: stored.mimeType,
          bytes: stored.bytes,
          metadata: { durationMs: result.durationMs, kind: 'voice-pin' },
          createdAt: new Date().toISOString(),
        });
      } catch {
        // SQLite media registration is best-effort; canvas object still carries storagePath.
      }

      const anchor = pendingAnchorRef.current ?? getViewportCenterPoint();
      pendingAnchorRef.current = null;
      const pinId = `voice-pin-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const pin = createVoicePinObject({
        id: pinId,
        point: anchor,
        audioAssetId: stored.assetId,
        storagePath: stored.storagePath,
        durationMs: result.durationMs,
        waveformPeaks: result.waveformPeaks,
      });
      dispatchCommand({ type: 'object.insert', object: pin });
      setSelectedIds([pin.id]);
      void triggerHapticFeedback('selection', haptics);
    } finally {
      stoppingRef.current = false;
    }
  }, [boardId, dispatchCommand, getViewportCenterPoint, haptics, setSelectedIds]);

  useEffect(() => {
    if (!isRecording) return;
    const timer = setInterval(() => {
      const progress = pollVoicePinRecordingProgress();
      setRecordingMs(progress.durationMs);
      setLivePeaks(progress.peaks);
      if (progress.reachedLimit) {
        void finalizeAndInsertRecording();
      }
    }, 120);
    return () => clearInterval(timer);
  }, [finalizeAndInsertRecording, isRecording]);

  useEffect(() => {
    return () => {
      void cancelVoicePinRecording();
      void stopVoicePinPlayback();
    };
  }, []);

  const handleStartVoicePinAt = useCallback(
    async (point?: Point) => {
      if (isReadOnly || isRecording) return;
      setErrorMessage(null);
      setPermissionBlocked(false);
      pendingAnchorRef.current = point ?? getViewportCenterPoint();
      const res = await startVoicePinRecording();
      if (!res.ok) {
        setErrorMessage(res.error);
        setPermissionBlocked(res.permission?.status === 'blocked');
        pendingAnchorRef.current = null;
        return;
      }
      setRecordingMs(0);
      setLivePeaks(EMPTY_PEAKS);
      setIsRecording(true);
      void triggerHapticFeedback('selection', haptics);
    },
    [getViewportCenterPoint, haptics, isReadOnly, isRecording],
  );

  const handleStopVoicePinRecording = useCallback(() => {
    void finalizeAndInsertRecording();
  }, [finalizeAndInsertRecording]);

  const handleCancelVoicePinRecording = useCallback(() => {
    pendingAnchorRef.current = null;
    setIsRecording(false);
    setRecordingMs(0);
    setLivePeaks(EMPTY_PEAKS);
    void cancelVoicePinRecording();
  }, []);

  const handleToggleVoicePinPlay = useCallback(
    async (pin: VoicePinObject) => {
      setErrorMessage(null);
      setPermissionBlocked(false);
      if (playingPinId === pin.id) {
        await stopVoicePinPlayback();
        setPlayingPinId(null);
        return;
      }
      const uri = resolveVoicePinUri(pin.storagePath);
      const res = await playVoicePinAudio(uri, () => {
        setPlayingPinId((current) => (current === pin.id ? null : current));
      });
      if (!res.ok) {
        setPlayingPinId(null);
        setErrorMessage(res.error);
        return;
      }
      setPlayingPinId(pin.id);
      void triggerHapticFeedback('selection', haptics);
    },
    [haptics, playingPinId],
  );

  const handleTogglePlayById = useCallback(
    (objectId: string) => {
      const target = document.objects.find((o) => o.id === objectId);
      if (!target || target.type !== 'voice-pin') return;
      void handleToggleVoicePinPlay(target);
    },
    [document.objects, handleToggleVoicePinPlay],
  );

  const handleStopPlayback = useCallback(() => {
    setPlayingPinId(null);
    void stopVoicePinPlayback();
  }, []);

  const handleOpenSettings = useCallback(() => {
    void openAppSettings();
  }, []);

  const handleDismissError = useCallback(() => {
    setErrorMessage(null);
    setPermissionBlocked(false);
  }, []);

  const cleanupDeletedVoicePin = useCallback(
    (pin: VoicePinObject) => {
      if (playingPinId === pin.id) {
        setPlayingPinId(null);
        void stopVoicePinPlayback();
      }
      void deleteVoicePinAudioFile(pin.storagePath);
    },
    [playingPinId],
  );

  return {
    isRecording,
    recordingMs,
    livePeaks,
    playingPinId,
    errorMessage,
    permissionBlocked,
    handleStartVoicePinAt,
    handleStopVoicePinRecording,
    handleCancelVoicePinRecording,
    handleToggleVoicePinPlay,
    handleTogglePlayById,
    handleStopPlayback,
    handleOpenSettings,
    handleDismissError,
    cleanupDeletedVoicePin,
  };
}
