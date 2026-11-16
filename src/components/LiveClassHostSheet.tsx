import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Share,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { StudentBoardSnapshot } from '../classroom/classroom-session';
import {
  formatRoomCode,
  type ClassroomParticipant,
  type ClassroomRoomInfo,
} from '../classroom/protocol';
import type { TransportStatus } from '../classroom/transport';
import type { ThemeColors } from '../theme';
import { fcprobe } from '../dev-probe';
import { HostControlsCard, HostInviteCard } from './live-class-host/HostControlsSection';
import { ParticipantRow } from './live-class-host/ParticipantRow';
import { StudentBoardCard } from './live-class-host/StudentBoardCard';
import { liveClassHostStyles as styles } from './LiveClassHostSheet.styles';

export type LiveClassHostSheetProps = {
  visible: boolean;
  centered?: boolean;
  roomInfo: ClassroomRoomInfo | null;
  status: TransportStatus;
  participants: ClassroomParticipant[];
  studentBoards: Record<string, StudentBoardSnapshot>;
  showcasedStudentPeerId: string | null;
  theme: ThemeColors;
  onClose: () => void;
  onToggleLock: (locked: boolean) => void;
  onToggleFollowViewport: (follow: boolean) => void;
  onToggleDrawPermission: (peerId: string, currentlyCanDraw: boolean) => void;
  onToggleVoicePermission: (peerId: string, currentlyCanSpeak: boolean) => void;
  onLowerHand: (peerId: string) => void;
  onShowcaseStudent: (peerId: string | null) => void;
  onKickParticipant: (peerId: string) => void;
  onEndClass: () => void;
};

type HostTab = 'roster' | 'gallery';

/** Host control sheet for managing an active Live Classroom session. */
export const LiveClassHostSheet = React.memo(function LiveClassHostSheet({
  visible,
  centered = false,
  roomInfo,
  status,
  participants,
  studentBoards,
  showcasedStudentPeerId,
  theme,
  onClose,
  onToggleLock,
  onToggleFollowViewport,
  onToggleDrawPermission,
  onToggleVoicePermission,
  onLowerHand,
  onShowcaseStudent,
  onKickParticipant,
  onEndClass,
}: LiveClassHostSheetProps) {
  // FCPROBE
  fcprobe(`sheet render visible=${visible} participants=${participants?.length}`);

  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isCompactPhone = !centered && windowWidth < 400;
  const qrSize = isCompactPhone ? 88 : 110;
  const maxScrollHeight = Math.max(200, Math.round(windowHeight * (centered ? 0.48 : 0.50)));

  const [tab, setTab] = useState<HostTab>('roster');
  const [copiedNotice, setCopiedNotice] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }
    };
  }, []);

  const sortedStudents = useMemo(() => {
    return participants
      .filter((p) => p.role === 'student')
      .sort((a, b) => {
        if (a.handRaised !== b.handRaised) return a.handRaised ? -1 : 1;
        return (a.handRaisedAt ?? 0) - (b.handRaisedAt ?? 0);
      });
  }, [participants]);

  const galleryItems = useMemo(() => Object.values(studentBoards), [studentBoards]);

  const handleCopyCode = useCallback(() => {
    if (!roomInfo) return;
    setCopiedNotice(true);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopiedNotice(false), 1800);
    void Share.share({
      message: `Join my FlowCanvas Live Class with code ${roomInfo.roomCode} or link: ${roomInfo.deepLinkUri}`,
    });
  }, [roomInfo]);

  const handleShareLink = useCallback(() => {
    if (!roomInfo) return;
    void Share.share({
      title: `Join ${roomInfo.boardTitle}`,
      message: `Join my live whiteboard class (${formatRoomCode(roomInfo.roomCode)}): ${roomInfo.deepLinkUri}`,
    });
  }, [roomInfo]);

  if (!visible || !roomInfo) {
    return null;
  }

  return (
    <View
      style={[styles.overlay, centered && styles.overlayCentered]}
      accessibilityViewIsModal
      testID="live-class-host-sheet"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close live classroom sheet"
        onPress={onClose}
        style={styles.scrim}
      />
      <View
        style={[
          styles.sheet,
          centered && styles.sheetCentered,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            paddingBottom: (centered ? 0 : insets.bottom) + 16,
          },
        ]}
      >
        {!centered && <View style={[styles.grabber, { backgroundColor: theme.border }]} />}

        <View style={styles.header}>
          <View style={styles.titleWrap}>
            <Text style={[styles.title, { color: theme.foreground }]}>Live Classroom</Text>
            <Text style={[styles.statusLine, { color: theme.primary }]}>
              {status === 'connected'
                ? `Connected • ${sortedStudents.length} ${sortedStudents.length === 1 ? 'student' : 'students'}`
                : `Status: ${status}`}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close live classroom sheet"
            hitSlop={16}
            onPress={onClose}
            style={styles.closeBtn}
          >
            <Text style={[styles.closeText, { color: theme.foreground }]}>✕</Text>
          </Pressable>
        </View>

        <ScrollView
          style={[styles.list, { maxHeight: maxScrollHeight }]}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          <HostInviteCard
            roomInfo={roomInfo}
            qrSize={qrSize}
            copiedNotice={copiedNotice}
            theme={theme}
            onCopyCode={handleCopyCode}
            onShareLink={handleShareLink}
          />

          <HostControlsCard
            isLocked={roomInfo.isLocked}
            followTeacherViewport={roomInfo.followTeacherViewport}
            theme={theme}
            onToggleLock={onToggleLock}
            onToggleFollowViewport={onToggleFollowViewport}
          />

          <View
            style={[styles.tabRow, { borderColor: theme.border, backgroundColor: theme.background }]}
          >
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === 'roster' }}
              onPress={() => setTab('roster')}
              style={[styles.tabBtn, tab === 'roster' && { backgroundColor: theme.primary }]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: tab === 'roster' ? '#FFFFFF' : theme.foreground },
                ]}
              >
                Roster & Hands ({sortedStudents.length})
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === 'gallery' }}
              onPress={() => setTab('gallery')}
              style={[styles.tabBtn, tab === 'gallery' && { backgroundColor: theme.primary }]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: tab === 'gallery' ? '#FFFFFF' : theme.foreground },
                ]}
              >
                Student Boards ({galleryItems.length})
              </Text>
            </Pressable>
          </View>

          {tab === 'roster' ? (
            sortedStudents.length === 0 ? (
              <View style={styles.emptyList}>
                <Text style={[styles.emptyText, { color: theme.foreground }]}>
                  Waiting for students… Share the 6-digit code or let them scan the QR code.
                </Text>
              </View>
            ) : (
              sortedStudents.map((item) => (
                <ParticipantRow
                  key={item.peerId}
                  item={item}
                  theme={theme}
                  onToggleDraw={onToggleDrawPermission}
                  onToggleVoice={onToggleVoicePermission}
                  onLowerHand={onLowerHand}
                  onKick={onKickParticipant}
                />
              ))
            )
          ) : galleryItems.length === 0 ? (
            <View style={styles.emptyList}>
              <Text style={[styles.emptyText, { color: theme.foreground }]}>
                Student scratchpad previews will appear here as students draw.
              </Text>
            </View>
          ) : (
            galleryItems.map((item) => (
              <StudentBoardCard
                key={item.peerId}
                item={item}
                isShowcased={showcasedStudentPeerId === item.peerId}
                theme={theme}
                onShowcase={onShowcaseStudent}
              />
            ))
          )}
        </ScrollView>

        <View style={styles.footerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Minimize live classroom sheet"
            onPress={onClose}
            style={[
              styles.minimizeBtn,
              { borderColor: theme.border, backgroundColor: theme.background },
            ]}
          >
            <Text style={[styles.minimizeBtnText, { color: theme.foreground }]}>Minimize</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="End live class"
            onPress={onEndClass}
            style={[styles.endBtn, { backgroundColor: theme.destructive }]}
          >
            <Text style={styles.endBtnText}>End Live Class</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
});
