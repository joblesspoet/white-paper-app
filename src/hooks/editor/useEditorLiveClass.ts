import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, BackHandler } from 'react-native';
import type { useNavigation, useRouter } from 'expo-router';

import {
  EMPTY_DOCUMENT,
  type CanvasDocument,
  type DocumentAction,
} from '../../canvas/document';
import type { GeometryInstrumentState } from '../../canvas/geometry-box';
import type { Viewport } from '../../canvas/viewport';
import { LiveKitClassroomAudioAdapter } from '../../classroom/audio-adapter';
import {
  ClassroomSession,
  type ClassroomSessionState,
} from '../../classroom/classroom-session';
import { diffDocumentsToSerializableCommand } from '../../classroom/diff';
import { getLiveClassEntitlement } from '../../classroom/entitlement';
import {
  applySerializableCommand,
  type EphemeralLaserPacket,
  type EphemeralStrokePacket,
} from '../../classroom/protocol';
import { fcprobe } from '../../dev-probe';
import type { BoardPageRecord } from '../../persistence/repository';
import { DEFAULT_BOARD_SETTINGS, type BoardSettings } from '../../persistence/schema';
import { openAppSettings, requestMicrophonePermission } from '../../recorder/permissions';

type UseEditorLiveClassArgs = {
  boardId?: string;
  boardSettings?: BoardSettings;
  title: string;
  setTitle: React.Dispatch<React.SetStateAction<string>>;
  isStudentRoute: boolean;
  isProjectorMode: boolean;
  paramRoomCode?: string;
  paramDisplayName?: string;
  document: CanvasDocument;
  documentRef: React.MutableRefObject<CanvasDocument>;
  pages: BoardPageRecord[];
  activePageId: string | null;
  activePageIdRef: React.MutableRefObject<string | null>;
  viewportLive: React.MutableRefObject<Viewport>;
  dispatch: React.Dispatch<DocumentAction>;
  requestViewport: (next: Viewport) => void;
  setActiveInstrument: React.Dispatch<React.SetStateAction<GeometryInstrumentState | null>>;
  router: ReturnType<typeof useRouter>;
  navigation: ReturnType<typeof useNavigation>;
};

export function useEditorLiveClass({
  boardId,
  boardSettings,
  title,
  setTitle,
  isStudentRoute,
  isProjectorMode,
  paramRoomCode,
  paramDisplayName,
  document,
  documentRef,
  pages,
  activePageId,
  activePageIdRef,
  viewportLive,
  dispatch,
  requestViewport,
  setActiveInstrument,
  router,
  navigation,
}: UseEditorLiveClassArgs) {
  const [hostSheetVisible, setHostSheetVisible] = useState(false);
  const [startingLiveClass, setStartingLiveClass] = useState(false);
  const [classroomState, setClassroomState] = useState<ClassroomSessionState | null>(null);
  const [classroomNotice, setClassroomNotice] = useState<string | null>(null);
  const [remoteActiveStroke, setRemoteActiveStroke] = useState<EphemeralStrokePacket | null>(null);
  const [remoteLaserStroke, setRemoteLaserStroke] = useState<EphemeralLaserPacket | null>(null);
  const [isScratchpadMode, setIsScratchpadMode] = useState(false);
  const [followTeacherViewport, setFollowTeacherViewport] = useState(true);
  const [voiceMicEnabled, setVoiceMicEnabled] = useState(false);
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const [liveBoardSettings, setLiveBoardSettings] = useState<BoardSettings | null>(null);
  const [showcasedName, setShowcasedName] = useState<string | null>(null);

  const classroomSessionRef = useRef<ClassroomSession | null>(null);
  const audioAdapterRef = useRef<LiveKitClassroomAudioAdapter | null>(null);
  const startingLiveClassRef = useRef(false);
  const allowLeaveNavigationRef = useRef(false);
  const leavingClassroomPromptRef = useRef(false);
  const applyingRemoteCommandRef = useRef(false);
  const prevBroadcastDocRef = useRef<CanvasDocument>(document);
  const studentLiveDocRef = useRef<CanvasDocument>(EMPTY_DOCUMENT);
  const studentScratchpadDocRef = useRef<CanvasDocument>(EMPTY_DOCUMENT);
  const isScratchpadModeRef = useRef(false);
  const followTeacherViewportRef = useRef(true);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const routerRef = useRef(router);
  routerRef.current = router;

  const showClassroomNotice = useCallback((message: string) => {
    setClassroomNotice(message);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => {
      setClassroomNotice(null);
    }, 3500);
  }, []);

  const ensureClassroomSession = useCallback(() => {
    if (classroomSessionRef.current) return classroomSessionRef.current;
    const session = new ClassroomSession();
    const audio = new LiveKitClassroomAudioAdapter();
    audio.setOnStateChange((st) => {
      setVoiceAvailable(st.available);
      setVoiceMicEnabled(st.micEnabled);
    });
    audioAdapterRef.current = audio;
    setVoiceAvailable(audio.getState().available);

    session.setCallbacks({
      onSnapshot: (snapshot) => {
        studentLiveDocRef.current = snapshot.document;
        setLiveBoardSettings(snapshot.boardSettings);
        setTitle(snapshot.roomInfo.boardTitle || 'Live Class');
        if (typeof snapshot.roomInfo.followTeacherViewport === 'boolean') {
          followTeacherViewportRef.current = snapshot.roomInfo.followTeacherViewport;
          setFollowTeacherViewport(snapshot.roomInfo.followTeacherViewport);
        }
        if (!isScratchpadModeRef.current) {
          applyingRemoteCommandRef.current = true;
          dispatch({ type: 'hydrate', document: snapshot.document });
          prevBroadcastDocRef.current = snapshot.document;
          if (followTeacherViewportRef.current) {
            requestViewport(snapshot.viewport);
          }
          setTimeout(() => {
            applyingRemoteCommandRef.current = false;
          }, 0);
        }
      },
      onRemoteCommand: (pageId, command) => {
        if (session.getState().role === 'student') {
          const nextLive = applySerializableCommand(studentLiveDocRef.current, command);
          studentLiveDocRef.current = nextLive;
          if (!isScratchpadModeRef.current) {
            applyingRemoteCommandRef.current = true;
            dispatch({ type: 'hydrate', document: nextLive });
            prevBroadcastDocRef.current = nextLive;
            setTimeout(() => {
              applyingRemoteCommandRef.current = false;
            }, 0);
          }
          return;
        }
        if (pageId === activePageIdRef.current) {
          const nextDoc = applySerializableCommand(documentRef.current, command);
          applyingRemoteCommandRef.current = true;
          dispatch({ type: 'hydrate', document: nextDoc });
          prevBroadcastDocRef.current = nextDoc;
          setTimeout(() => {
            applyingRemoteCommandRef.current = false;
          }, 0);
        }
      },
      onEphemeral: (eph) => {
        if (eph.activeStroke) {
          setRemoteActiveStroke(eph.activeStroke.isDone ? null : eph.activeStroke);
        }
        if (eph.laser) {
          setRemoteLaserStroke(eph.laser.active ? eph.laser : null);
        }
        if (eph.geometryInstrument !== undefined && !isScratchpadModeRef.current) {
          setActiveInstrument(eph.geometryInstrument);
        }
        if (eph.viewport && followTeacherViewportRef.current && !isScratchpadModeRef.current) {
          requestViewport(eph.viewport);
        }
      },
      onShowcase: (showcase) => {
        if (!showcase.studentPeerId || !showcase.document) {
          setShowcasedName(null);
          if (session.getState().role === 'student' && !isScratchpadModeRef.current) {
            applyingRemoteCommandRef.current = true;
            dispatch({ type: 'hydrate', document: studentLiveDocRef.current });
            prevBroadcastDocRef.current = studentLiveDocRef.current;
            setTimeout(() => {
              applyingRemoteCommandRef.current = false;
            }, 0);
          }
          return;
        }
        setShowcasedName(showcase.studentName ?? 'Student');
        if (session.getState().role === 'student' && !isScratchpadModeRef.current) {
          applyingRemoteCommandRef.current = true;
          dispatch({ type: 'hydrate', document: showcase.document });
          prevBroadcastDocRef.current = showcase.document;
          if (showcase.viewport) requestViewport(showcase.viewport);
          setTimeout(() => {
            applyingRemoteCommandRef.current = false;
          }, 0);
        }
      },
      onFollowTeacherViewport: (follow, vp) => {
        followTeacherViewportRef.current = follow;
        setFollowTeacherViewport(follow);
        if (follow && vp && !isScratchpadModeRef.current) {
          requestViewport(vp);
        }
      },
      onNotice: (msg) => showClassroomNotice(msg),
      onKicked: () => {
        allowLeaveNavigationRef.current = true;
        void audioAdapterRef.current?.disconnect();
        Alert.alert('Removed from class', 'The teacher removed you from this live session.');
        routerRef.current.back();
      },
      onClassEnded: () => {
        allowLeaveNavigationRef.current = true;
        void audioAdapterRef.current?.disconnect();
        Alert.alert('Live class ended', 'The teacher ended the live class.');
        routerRef.current.back();
      },
    });

    session.subscribe((nextState) => {
      setClassroomState(nextState);
      if (nextState.role === 'student') {
        void audioAdapterRef.current?.setCanPublish(nextState.myCanSpeak);
      }
    });

    classroomSessionRef.current = session;
    return session;
  }, [
    activePageIdRef,
    dispatch,
    documentRef,
    requestViewport,
    setActiveInstrument,
    setTitle,
    showClassroomNotice,
  ]);

  // Auto-join when opened via Student Join route
  useEffect(() => {
    if (!isStudentRoute || !paramRoomCode) return;
    const session = ensureClassroomSession();
    let cancelled = false;
    void (async () => {
      try {
        await session.joinAsStudent({
          roomCode: paramRoomCode,
          displayName: paramDisplayName || (isProjectorMode ? 'Classroom Projector' : 'Student'),
        });
        if (cancelled) return;
        const audio = audioAdapterRef.current;
        if (audio) {
          const st = await audio.connect({
            roomCode: paramRoomCode,
            peerId: session.getState().peerId,
            displayName: session.getState().displayName,
            role: 'student',
            canPublish: false,
          });
          setVoiceAvailable(st.available);
          setVoiceMicEnabled(st.micEnabled);
          if (!st.connected && st.reason) {
            showClassroomNotice(st.reason);
          }
        }
      } catch (error) {
        if (!cancelled) {
          Alert.alert(
            'Unable to join class',
            error instanceof Error ? error.message : 'Check the 6-digit code and try again.',
          );
          allowLeaveNavigationRef.current = true;
          routerRef.current.back();
        }
      }
    })();

    return () => {
      cancelled = true;
      void audioAdapterRef.current?.disconnect();
      void session.endOrLeave();
    };
  }, [
    ensureClassroomSession,
    isProjectorMode,
    isStudentRoute,
    paramDisplayName,
    paramRoomCode,
    showClassroomNotice,
  ]);

  // Resumable foreground reconnect
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        void classroomSessionRef.current?.resume();
        if (classroomSessionRef.current?.getState().active) {
          void audioAdapterRef.current?.resume();
        }
      }
    });
    return () => sub.remove();
  }, []);

  const confirmLeaveActiveClassroom = useCallback((onConfirmLeave: () => void) => {
    const session = classroomSessionRef.current;
    const st = session?.getState();
    if (!session || !st?.active) {
      onConfirmLeave();
      return;
    }
    if (leavingClassroomPromptRef.current) return;
    leavingClassroomPromptRef.current = true;
    const isTeacher = st.role === 'teacher';
    Alert.alert(
      isTeacher ? 'End Live Class?' : 'Leave Live Class?',
      isTeacher
        ? 'An active live class session is running. Do you want to end it and leave?'
        : 'You are currently in a live class. Do you want to leave the session?',
      [
        {
          text: 'Stay',
          style: 'cancel',
          onPress: () => {
            leavingClassroomPromptRef.current = false;
          },
        },
        {
          text: isTeacher ? 'End & Leave' : 'Leave Class',
          style: 'destructive',
          onPress: () => {
            allowLeaveNavigationRef.current = true;
            leavingClassroomPromptRef.current = false;
            setHostSheetVisible(false);
            void audioAdapterRef.current?.disconnect();
            void session.endOrLeave().finally(() => {
              onConfirmLeave();
            });
          },
        },
      ],
      {
        cancelable: true,
        onDismiss: () => {
          leavingClassroomPromptRef.current = false;
        },
      },
    );
  }, []);

  useEffect(() => {
    const nav = navigation as unknown as {
      addListener: (
        event: 'beforeRemove',
        cb: (e: {
          preventDefault: () => void;
          data: { action: unknown };
        }) => void,
      ) => () => void;
      dispatch: (action: unknown) => void;
    };
    const unsubscribe = nav.addListener('beforeRemove', (event) => {
      if (allowLeaveNavigationRef.current) return;
      if (!classroomSessionRef.current?.getState().active) return;
      event.preventDefault();
      confirmLeaveActiveClassroom(() => {
        nav.dispatch(event.data.action);
      });
    });
    return unsubscribe;
  }, [confirmLeaveActiveClassroom, navigation]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (hostSheetVisible) {
        setHostSheetVisible(false);
        return true;
      }
      if (classroomSessionRef.current?.getState().active) {
        confirmLeaveActiveClassroom(() => {
          routerRef.current.back();
        });
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [confirmLeaveActiveClassroom, hostSheetVisible]);

  useEffect(() => {
    if (!classroomState?.active && hostSheetVisible) {
      setHostSheetVisible(false);
    }
  }, [classroomState?.active, hostSheetVisible]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      void audioAdapterRef.current?.disconnect();
      if (classroomSessionRef.current?.getState().active) {
        void classroomSessionRef.current.endOrLeave();
      }
    };
  }, []);

  // Broadcast committed local document mutations
  useEffect(() => {
    const session = classroomSessionRef.current;
    const prevDoc = prevBroadcastDocRef.current;
    prevBroadcastDocRef.current = document;
    fcprobe(`broadcast effect active=${classroomState?.active} sameDoc=${prevDoc === document}`);
    if (!session || !classroomState?.active) return;
    if (applyingRemoteCommandRef.current) return;

    if (classroomState.role === 'student' && isScratchpadMode) {
      studentScratchpadDocRef.current = document;
      void session.sendStudentScratchpad(document, viewportLive.current);
      return;
    }

    const cmd = diffDocumentsToSerializableCommand(prevDoc, document);
    if (!cmd) return;

    if (classroomState.role === 'teacher') {
      const currentPage = pages.find((p) => p.id === activePageId);
      session.updateHostSnapshot({
        pageId: activePageId || 'page-1',
        pageName: currentPage?.name ?? 'Page 1',
        pageOrderIndex: currentPage?.orderIndex ?? 0,
        boardSettings: boardSettings ?? DEFAULT_BOARD_SETTINGS,
        document,
        viewport: viewportLive.current,
      });
      void session.broadcastCommand(activePageId || 'page-1', cmd);
    } else if (classroomState.myPermission === 'can-draw' && !classroomState.roomInfo?.isLocked) {
      studentLiveDocRef.current = document;
      void session.broadcastCommand(activePageId || 'page-1', cmd);
    }
  }, [activePageId, boardSettings, classroomState, document, isScratchpadMode, pages, viewportLive]);

  const handleStartOrOpenLiveClass = useCallback(async () => {
    if (isStudentRoute || startingLiveClassRef.current) return;
    const session = ensureClassroomSession();
    if (session.getState().active) {
      setHostSheetVisible(true);
      return;
    }

    const entitlement = getLiveClassEntitlement();
    if (!entitlement.canHost) {
      Alert.alert('Teacher Pro Required', entitlement.reason ?? 'Upgrade to host Live Classes.');
      return;
    }

    startingLiveClassRef.current = true;
    setStartingLiveClass(true);
    setHostSheetVisible(false);
    try {
      const micPerm = await requestMicrophonePermission();
      if (!micPerm.granted) {
        Alert.alert(
          'Microphone Permission Required',
          'Allow microphone access before starting a live class so students can hear your voice.',
          micPerm.canAskAgain
            ? [{ text: 'OK' }]
            : [
                { text: 'Not Now', style: 'cancel' },
                { text: 'Open Settings', onPress: () => void openAppSettings() },
              ],
        );
        return;
      }

      const currentPage = pages.find((p) => p.id === activePageId);
      const roomInfo = await session.startAsTeacher({
        boardId: boardId ?? 'local-board',
        boardTitle: title,
        pageId: activePageId || 'page-1',
        pageName: currentPage?.name ?? 'Page 1',
        pageOrderIndex: currentPage?.orderIndex ?? 0,
        boardSettings: boardSettings ?? DEFAULT_BOARD_SETTINGS,
        document: documentRef.current,
        viewport: viewportLive.current,
        displayName: 'Teacher',
      });

      setHostSheetVisible(true);

      const audio = audioAdapterRef.current;
      if (audio) {
        void (async () => {
          const st = await audio.connect({
            roomCode: roomInfo.roomCode,
            peerId: session.getState().peerId,
            displayName: 'Teacher',
            role: 'teacher',
            canPublish: true,
          });
          setVoiceAvailable(st.available);
          setVoiceMicEnabled(st.micEnabled);
          if (st.reason) showClassroomNotice(st.reason);
        })();
      }
    } catch (error) {
      setHostSheetVisible(false);
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Could not connect to the Live Classroom server. Check your internet connection and try again.';
      Alert.alert('Unable to Start Live Class', message);
    } finally {
      startingLiveClassRef.current = false;
      setStartingLiveClass(false);
    }
  }, [
    activePageId,
    boardId,
    boardSettings,
    documentRef,
    ensureClassroomSession,
    isStudentRoute,
    pages,
    showClassroomNotice,
    title,
    viewportLive,
  ]);

  const handlePressLiveClassButton = useCallback(() => {
    if (startingLiveClassRef.current) return;
    if (classroomState?.active) {
      setHostSheetVisible((prev) => !prev);
    } else {
      void handleStartOrOpenLiveClass();
    }
  }, [classroomState?.active, handleStartOrOpenLiveClass]);

  const handleToggleScratchpad = useCallback(() => {
    const next = !isScratchpadModeRef.current;
    isScratchpadModeRef.current = next;
    setIsScratchpadMode(next);
    applyingRemoteCommandRef.current = true;
    if (next) {
      dispatch({ type: 'hydrate', document: studentScratchpadDocRef.current });
      prevBroadcastDocRef.current = studentScratchpadDocRef.current;
      showClassroomNotice('Switched to My Scratchpad');
    } else {
      dispatch({ type: 'hydrate', document: studentLiveDocRef.current });
      prevBroadcastDocRef.current = studentLiveDocRef.current;
      showClassroomNotice('Returned to Live Board');
    }
    setTimeout(() => {
      applyingRemoteCommandRef.current = false;
    }, 0);
  }, [dispatch, showClassroomNotice]);

  const handleToggleFollowTeacher = useCallback(() => {
    const next = !followTeacherViewportRef.current;
    followTeacherViewportRef.current = next;
    setFollowTeacherViewport(next);
  }, []);

  const handleLiveStrokeSample = useCallback(
    (sample: Omit<EphemeralStrokePacket, 'authorPeerId'>) => {
      const session = classroomSessionRef.current;
      if (!session || !classroomState?.active) return;
      if (classroomState.role === 'student' && isScratchpadModeRef.current) return;
      void session.sendEphemeral({
        pageId: activePageIdRef.current || 'page-1',
        activeStroke: { ...sample, authorPeerId: session.getState().peerId },
      });
    },
    [activePageIdRef, classroomState?.active, classroomState?.role],
  );

  const handleLiveLaserSample = useCallback(
    (sample: Omit<EphemeralLaserPacket, 'authorPeerId'>) => {
      const session = classroomSessionRef.current;
      if (!session || !classroomState?.active) return;
      if (classroomState.role === 'student' && isScratchpadModeRef.current) return;
      void session.sendEphemeral({
        pageId: activePageIdRef.current || 'page-1',
        laser: { ...sample, authorPeerId: session.getState().peerId },
      });
    },
    [activePageIdRef, classroomState?.active, classroomState?.role],
  );

  const broadcastHostViewportIfActive = useCallback(
    (next: Viewport) => {
      const liveState = classroomSessionRef.current?.getState();
      if (liveState?.active && liveState.role === 'teacher') {
        classroomSessionRef.current?.updateHostViewport(next);
        if (liveState.roomInfo?.followTeacherViewport) {
          void classroomSessionRef.current?.sendEphemeral({
            pageId: activePageIdRef.current || 'page-1',
            viewport: next,
          });
        }
      }
    },
    [activePageIdRef],
  );

  const broadcastHostPageSwitchIfActive = useCallback(
    (target: BoardPageRecord, nextViewport: Viewport) => {
      const liveState = classroomSessionRef.current?.getState();
      if (liveState?.active && liveState.role === 'teacher') {
        void classroomSessionRef.current?.broadcastPageSwitch({
          pageId: target.id,
          pageName: target.name,
          pageOrderIndex: target.orderIndex,
          boardSettings: boardSettings ?? DEFAULT_BOARD_SETTINGS,
          document: target.document,
          viewport: nextViewport,
        });
      }
    },
    [boardSettings],
  );

  const handleToggleTeacherMute = useCallback(() => {
    if (!voiceAvailable) {
      showClassroomNotice(
        audioAdapterRef.current?.getState().reason ??
          'Voice requires a dev build with @livekit/react-native.',
      );
      return;
    }
    const nextMuted = !classroomState?.roomInfo?.teacherMuted;
    if (!nextMuted) {
      void requestMicrophonePermission().then((micPerm) => {
        if (!micPerm.granted) {
          Alert.alert(
            'Microphone Permission Required',
            'Allow microphone access to unmute your voice in the live class.',
            micPerm.canAskAgain
              ? [{ text: 'OK' }]
              : [
                  { text: 'Not Now', style: 'cancel' },
                  { text: 'Open Settings', onPress: () => void openAppSettings() },
                ],
          );
          return;
        }
        void classroomSessionRef.current?.setTeacherMuted(false);
        void audioAdapterRef.current?.setMicEnabled(true).then((st) => {
          setVoiceMicEnabled(st.micEnabled);
          if (st.reason && !st.micEnabled) showClassroomNotice(st.reason);
        });
      });
      return;
    }
    void classroomSessionRef.current?.setTeacherMuted(true);
    void audioAdapterRef.current?.setMicEnabled(false).then((st) => {
      setVoiceMicEnabled(st.micEnabled);
    });
  }, [classroomState?.roomInfo?.teacherMuted, showClassroomNotice, voiceAvailable]);

  const handleToggleRaiseHand = useCallback(() => {
    if (classroomState?.myHandRaised) {
      void classroomSessionRef.current?.lowerHand();
    } else {
      void classroomSessionRef.current?.raiseHand();
    }
  }, [classroomState?.myHandRaised]);

  const handleToggleStudentMic = useCallback(() => {
    const nextEnabled = !voiceMicEnabled;
    if (nextEnabled) {
      void requestMicrophonePermission().then((micPerm) => {
        if (!micPerm.granted) {
          Alert.alert(
            'Microphone Permission Required',
            'Allow microphone access to speak in the live class.',
            micPerm.canAskAgain
              ? [{ text: 'OK' }]
              : [
                  { text: 'Not Now', style: 'cancel' },
                  { text: 'Open Settings', onPress: () => void openAppSettings() },
                ],
          );
          return;
        }
        void audioAdapterRef.current?.setMicEnabled(true).then((st) => {
          setVoiceMicEnabled(st.micEnabled);
          if (st.reason && !st.micEnabled) showClassroomNotice(st.reason);
        });
      });
      return;
    }
    void audioAdapterRef.current?.setMicEnabled(false).then((st) => {
      setVoiceMicEnabled(st.micEnabled);
    });
  }, [showClassroomNotice, voiceMicEnabled]);

  const handleLeaveClass = useCallback(() => {
    allowLeaveNavigationRef.current = true;
    void audioAdapterRef.current?.disconnect();
    void classroomSessionRef.current?.endOrLeave().then(() => {
      routerRef.current.back();
    });
  }, []);

  const handleEndClassFromSheet = useCallback(() => {
    setHostSheetVisible(false);
    void audioAdapterRef.current?.disconnect();
    void classroomSessionRef.current?.endOrLeave();
  }, []);

  return {
    classroomSessionRef,
    hostSheetVisible,
    setHostSheetVisible,
    startingLiveClass,
    classroomState,
    classroomNotice,
    remoteActiveStroke,
    remoteLaserStroke,
    isScratchpadMode,
    followTeacherViewport,
    voiceMicEnabled,
    voiceAvailable,
    liveBoardSettings,
    showcasedName,
    handlePressLiveClassButton,
    handleToggleScratchpad,
    handleToggleFollowTeacher,
    handleLiveStrokeSample,
    handleLiveLaserSample,
    broadcastHostViewportIfActive,
    broadcastHostPageSwitchIfActive,
    handleToggleTeacherMute,
    handleToggleRaiseHand,
    handleToggleStudentMic,
    handleLeaveClass,
    handleEndClassFromSheet,
  };
}
