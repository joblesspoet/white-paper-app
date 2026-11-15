import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polyline } from 'react-native-svg';

import type { StudentBoardSnapshot } from '../classroom/classroom-session';
import {
  formatRoomCode,
  type ClassroomParticipant,
  type ClassroomRoomInfo,
} from '../classroom/protocol';
import type { TransportStatus } from '../classroom/transport';
import type { ThemeColors } from '../theme';
import { ClassroomQrCode } from './ClassroomQrCode';
import { liveClassHostStyles as styles } from './LiveClassHostSheet.styles';

type LiveClassHostSheetProps = {
  visible: boolean;
  centered?: boolean;
  roomInfo: ClassroomRoomInfo;
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

type ParticipantRowProps = {
  item: ClassroomParticipant;
  theme: ThemeColors;
  onToggleDraw: (peerId: string, currentlyCanDraw: boolean) => void;
  onToggleVoice: (peerId: string, currentlyCanSpeak: boolean) => void;
  onLowerHand: (peerId: string) => void;
  onKick: (peerId: string) => void;
};

const ParticipantRow = React.memo(function ParticipantRow({
  item,
  theme,
  onToggleDraw,
  onToggleVoice,
  onLowerHand,
  onKick,
}: ParticipantRowProps) {
  const canDraw = item.permission === 'can-draw';
  const canSpeak = item.voicePermission === 'can-speak';

  return (
    <View
      style={[
        styles.participantRow,
        {
          borderColor: item.handRaised ? '#EA580C' : theme.border,
          backgroundColor: theme.background,
        },
      ]}
    >
      <View style={styles.participantMeta}>
        <Text style={[styles.participantName, { color: theme.foreground }]} numberOfLines={1}>
          {item.handRaised ? '👋 ' : ''}
          {item.displayName}
        </Text>
        <Text style={[styles.participantSub, { color: theme.foreground }]}>
          {canDraw ? 'Marker active' : item.permission === 'locked' ? 'Locked' : 'View-only'}
          {canSpeak ? ' • Speaking' : ''}
        </Text>
      </View>

      <View style={styles.rowActions}>
        {item.handRaised && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Lower hand for ${item.displayName}`}
            onPress={() => onLowerHand(item.peerId)}
            style={[styles.pillBtn, { borderColor: '#EA580C' }]}
          >
            <Text style={[styles.pillBtnText, { color: '#EA580C' }]}>Ack</Text>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${canDraw ? 'Revoke' : 'Allow'} drawing for ${item.displayName}`}
          onPress={() => onToggleDraw(item.peerId, canDraw)}
          style={[
            styles.pillBtn,
            {
              borderColor: canDraw ? theme.primary : theme.border,
              backgroundColor: canDraw ? theme.muted : theme.surface,
            },
          ]}
        >
          <Text style={[styles.pillBtnText, { color: canDraw ? theme.primary : theme.foreground }]}>
            {canDraw ? 'Marker' : 'Draw'}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${canSpeak ? 'Mute' : 'Allow to talk'} ${item.displayName}`}
          onPress={() => onToggleVoice(item.peerId, canSpeak)}
          style={[
            styles.pillBtn,
            {
              borderColor: canSpeak ? theme.accent : theme.border,
              backgroundColor: canSpeak ? theme.accent : theme.surface,
            },
          ]}
        >
          <Text style={[styles.pillBtnText, { color: canSpeak ? '#FFFFFF' : theme.foreground }]}>
            {canSpeak ? 'Speaking' : 'Talk'}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${item.displayName}`}
          onPress={() => onKick(item.peerId)}
          style={[styles.pillBtn, { borderColor: theme.border }]}
        >
          <Text style={[styles.pillBtnText, { color: theme.destructive }]}>✕</Text>
        </Pressable>
      </View>
    </View>
  );
});

type StudentBoardCardProps = {
  item: StudentBoardSnapshot;
  isShowcased: boolean;
  theme: ThemeColors;
  onShowcase: (peerId: string | null) => void;
};

const StudentBoardCard = React.memo(function StudentBoardCard({
  item,
  isShowcased,
  theme,
  onShowcase,
}: StudentBoardCardProps) {
  const previewPolylines = useMemo(() => {
    const strokes = item.document.strokes.slice(-12);
    if (strokes.length === 0) return [];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const stroke of strokes) {
      for (const pt of stroke.points) {
        if (pt.x < minX) minX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y > maxY) maxY = pt.y;
      }
    }
    const width = Math.max(40, maxX - minX);
    const height = Math.max(40, maxY - minY);
    const scale = Math.min(120 / width, 64 / height);
    return strokes.map((stroke) => ({
      id: stroke.id,
      points: stroke.points
        .map((pt) => `${((pt.x - minX) * scale + 8).toFixed(1)},${((pt.y - minY) * scale + 6).toFixed(1)}`)
        .join(' '),
    }));
  }, [item.document.strokes]);

  return (
    <View
      style={[
        styles.galleryCard,
        {
          borderColor: isShowcased ? theme.accent : theme.border,
          backgroundColor: theme.background,
        },
      ]}
    >
      <View
        style={[
          styles.galleryPreview,
          { borderColor: theme.border, backgroundColor: '#FFFFFF' },
        ]}
      >
        {previewPolylines.length > 0 ? (
          <Svg width={136} height={76}>
            {previewPolylines.map((line) => (
              <Polyline
                key={line.id}
                points={line.points}
                fill="none"
                stroke="#0F172A"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </Svg>
        ) : (
          <Text style={[styles.emptyText, { color: '#64748B' }]}>
            {item.objectCount > 0 ? `${item.objectCount} objects` : 'Blank scratchpad'}
          </Text>
        )}
      </View>

      <View style={styles.galleryFooter}>
        <View style={styles.participantMeta}>
          <Text style={[styles.participantName, { color: theme.foreground }]} numberOfLines={1}>
            {item.displayName}
          </Text>
          <Text style={[styles.participantSub, { color: theme.foreground }]}>
            {item.strokeCount} strokes • {item.objectCount} objs
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isShowcased ? `Stop showcasing ${item.displayName}` : `Showcase ${item.displayName}`}
          onPress={() => onShowcase(isShowcased ? null : item.peerId)}
          style={[
            styles.pillBtn,
            {
              borderColor: isShowcased ? theme.accent : theme.primary,
              backgroundColor: isShowcased ? theme.accent : theme.surface,
            },
          ]}
        >
          <Text style={[styles.pillBtnText, { color: isShowcased ? '#FFFFFF' : theme.primary }]}>
            {isShowcased ? 'Showing' : 'Showcase'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
});

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
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const isCompactPhone = !centered && windowWidth < 400;
  const qrSize = isCompactPhone ? 88 : 110;
  const [tab, setTab] = useState<'roster' | 'gallery'>('roster');
  const [copiedNotice, setCopiedNotice] = useState(false);

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
    setCopiedNotice(true);
    setTimeout(() => setCopiedNotice(false), 1800);
    void Share.share({
      message: `Join my FlowCanvas Live Class with code ${roomInfo.roomCode} or link: ${roomInfo.deepLinkUri}`,
    });
  }, [roomInfo.deepLinkUri, roomInfo.roomCode]);

  const handleShareLink = useCallback(() => {
    void Share.share({
      title: `Join ${roomInfo.boardTitle}`,
      message: `Join my live whiteboard class (${formatRoomCode(roomInfo.roomCode)}): ${roomInfo.deepLinkUri}`,
    });
  }, [roomInfo.boardTitle, roomInfo.deepLinkUri, roomInfo.roomCode]);

  const renderParticipant = useCallback(
    ({ item }: { item: ClassroomParticipant }) => (
      <ParticipantRow
        item={item}
        theme={theme}
        onToggleDraw={onToggleDrawPermission}
        onToggleVoice={onToggleVoicePermission}
        onLowerHand={onLowerHand}
        onKick={onKickParticipant}
      />
    ),
    [onKickParticipant, onLowerHand, onToggleDrawPermission, onToggleVoicePermission, theme],
  );

  const renderGalleryCard = useCallback(
    ({ item }: { item: StudentBoardSnapshot }) => (
      <StudentBoardCard
        item={item}
        isShowcased={showcasedStudentPeerId === item.peerId}
        theme={theme}
        onShowcase={onShowcaseStudent}
      />
    ),
    [onShowcaseStudent, showcasedStudentPeerId, theme],
  );

  const keyExtractorPeer = useCallback((item: ClassroomParticipant) => item.peerId, []);
  const keyExtractorBoard = useCallback((item: StudentBoardSnapshot) => item.peerId, []);

  const renderHeader = useCallback(
    () => (
      <View style={styles.headerSpacer}>
        <View
          style={[
            styles.inviteCard,
            { backgroundColor: theme.background, borderColor: theme.border },
          ]}
        >
          <View style={styles.inviteInfo}>
            <Text style={[styles.codeLabel, { color: theme.primary }]}>6-Digit Join Code</Text>
            <Text style={[styles.codeValue, { color: theme.foreground }]}>
              {formatRoomCode(roomInfo.roomCode)}
            </Text>
            <View style={styles.inviteActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Share or copy class code"
                onPress={handleCopyCode}
                style={[styles.smallBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}
              >
                <Text style={[styles.smallBtnText, { color: theme.foreground }]}>
                  {copiedNotice ? 'Shared!' : 'Copy code'}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Share deep link"
                onPress={handleShareLink}
                style={[styles.smallBtn, { borderColor: theme.primary, backgroundColor: theme.surface }]}
              >
                <Text style={[styles.smallBtnText, { color: theme.primary }]}>Share link</Text>
              </Pressable>
            </View>
          </View>
          <ClassroomQrCode value={roomInfo.deepLinkUri} size={qrSize} borderColor={theme.border} />
        </View>

        <View
          style={[
            styles.controlsCard,
            { backgroundColor: theme.background, borderColor: theme.border },
          ]}
        >
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: theme.foreground }]}>
              Lock class (freeze edits & new joins)
            </Text>
            <Switch
              accessibilityLabel="Lock class"
              value={roomInfo.isLocked}
              onValueChange={onToggleLock}
              trackColor={{ false: theme.border, true: theme.destructive }}
            />
          </View>
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: theme.foreground }]}>
              Sync teacher camera to students/projector
            </Text>
            <Switch
              accessibilityLabel="Sync teacher camera"
              value={roomInfo.followTeacherViewport}
              onValueChange={onToggleFollowViewport}
              trackColor={{ false: theme.border, true: theme.primary }}
            />
          </View>
        </View>

        <View style={[styles.tabRow, { borderColor: theme.border, backgroundColor: theme.background }]}>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === 'roster' }}
            onPress={() => setTab('roster')}
            style={[
              styles.tabBtn,
              tab === 'roster' && { backgroundColor: theme.primary },
            ]}
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
            style={[
              styles.tabBtn,
              tab === 'gallery' && { backgroundColor: theme.primary },
            ]}
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
      </View>
    ),
    [
      copiedNotice,
      galleryItems.length,
      handleCopyCode,
      handleShareLink,
      onToggleFollowViewport,
      onToggleLock,
      qrSize,
      roomInfo.deepLinkUri,
      roomInfo.followTeacherViewport,
      roomInfo.isLocked,
      roomInfo.roomCode,
      sortedStudents.length,
      tab,
      theme,
    ],
  );

  const renderFooter = useCallback(
    () => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="End live class"
        onPress={onEndClass}
        style={[styles.endBtn, { backgroundColor: theme.destructive }]}
      >
        <Text style={styles.endBtnText}>End Live Class</Text>
      </Pressable>
    ),
    [onEndClass, theme.destructive],
  );

  return (
    <Modal
      transparent
      visible={visible}
      animationType={centered ? 'fade' : 'slide'}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.scrim, centered && styles.scrimCentered]}>
        <Pressable
          accessibilityLabel="Close live classroom sheet"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
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
              style={[styles.closeBtn, { zIndex: 10 }]}
            >
              <Text style={[styles.closeText, { color: theme.foreground }]}>✕</Text>
            </Pressable>
          </View>

          {tab === 'roster' ? (
            <FlatList
              key="roster-1col"
              data={sortedStudents}
              renderItem={renderParticipant}
              keyExtractor={keyExtractorPeer}
              ListHeaderComponent={renderHeader}
              ListFooterComponent={renderFooter}
              showsVerticalScrollIndicator={false}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyList}>
                  <Text style={[styles.emptyText, { color: theme.foreground }]}>
                    Waiting for students… Share the 6-digit code or let them scan the QR code.
                  </Text>
                </View>
              }
            />
          ) : (
            <FlatList
              key="gallery-2col"
              data={galleryItems}
              numColumns={2}
              renderItem={renderGalleryCard}
              keyExtractor={keyExtractorBoard}
              ListHeaderComponent={renderHeader}
              ListFooterComponent={renderFooter}
              showsVerticalScrollIndicator={false}
              style={styles.list}
              columnWrapperStyle={galleryItems.length > 1 ? styles.galleryRow : undefined}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyList}>
                  <Text style={[styles.emptyText, { color: theme.foreground }]}>
                    Student scratchpad previews will appear here as students draw.
                  </Text>
                </View>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
});
