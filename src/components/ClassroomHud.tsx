import React, { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';

import { formatRoomCode, type ClassroomRole, type StudentPermission } from '../classroom/protocol';
import type { TransportStatus } from '../classroom/transport';
import type { ThemeColors } from '../theme';
import { classroomHudStyles as styles } from './ClassroomHud.styles';

type ClassroomHudProps = {
  role: ClassroomRole;
  status?: TransportStatus;
  hasSnapshot?: boolean;
  roomCode: string;
  studentCount: number;
  raisedHandsCount: number;
  myPermission: StudentPermission;
  myHandRaised: boolean;
  myCanSpeak: boolean;
  teacherMuted: boolean;
  voiceAvailable: boolean;
  micEnabled: boolean;
  isScratchpadMode: boolean;
  projectorMode: boolean;
  followTeacherViewport: boolean;
  showcasedName: string | null;
  notice: string | null;
  theme: ThemeColors;
  onOpenHostSheet: () => void;
  onRequestSync?: () => void;
  onToggleTeacherMute: () => void;
  onToggleRaiseHand: () => void;
  onToggleScratchpad: () => void;
  onToggleFollowTeacher: () => void;
  onToggleStudentMic: () => void;
  onLeaveClass: () => void;
};

export const ClassroomHud = React.memo(function ClassroomHud({
  role,
  status = 'connected',
  hasSnapshot = true,
  roomCode,
  studentCount,
  raisedHandsCount,
  myPermission,
  myHandRaised,
  myCanSpeak,
  teacherMuted,
  voiceAvailable,
  micEnabled,
  isScratchpadMode,
  projectorMode,
  followTeacherViewport,
  showcasedName,
  notice,
  theme,
  onOpenHostSheet,
  onRequestSync,
  onToggleTeacherMute,
  onToggleRaiseHand,
  onToggleScratchpad,
  onToggleFollowTeacher,
  onToggleStudentMic,
  onLeaveClass,
}: ClassroomHudProps) {
  const handleHostPress = useCallback(() => onOpenHostSheet(), [onOpenHostSheet]);
  const dotColor =
    status === 'connected' ? '#16A34A' : status === 'error' || status === 'disconnected' ? '#DC2626' : '#D97706';

  if (role === 'student' && projectorMode) {
    return (
      <View style={styles.wrapper} pointerEvents="box-none">
        <View
          style={[
            styles.projectorPill,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={[styles.liveDot, { backgroundColor: dotColor }]} />
          <Text style={[styles.liveText, { color: theme.foreground }]}>
            {showcasedName ? `Showcase: ${showcasedName}` : `Projector • ${formatRoomCode(roomCode)}`}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Leave projector mode"
            onPress={onLeaveClass}
            style={[styles.actionChip, { borderColor: theme.border }]}
          >
            <Text style={[styles.actionChipText, { color: theme.destructive }]}>Exit</Text>
          </Pressable>
        </View>
        {notice && (
          <View
            style={[
              styles.noticeBanner,
              { backgroundColor: theme.surface, borderColor: theme.primary },
            ]}
          >
            <Text style={[styles.noticeText, { color: theme.foreground }]}>{notice}</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <View
        style={[
          styles.pill,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <View style={[styles.liveDot, { backgroundColor: dotColor }]} />
        {role === 'teacher' ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open live classroom controls"
              onPress={handleHostPress}
              style={[styles.codeChip, { backgroundColor: theme.muted }]}
            >
              <Text style={[styles.codeText, { color: theme.primary }]}>
                {formatRoomCode(roomCode)}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Live students ${studentCount}`}
              onPress={handleHostPress}
              style={[styles.actionChip, { borderColor: theme.border }]}
            >
              <Text style={[styles.actionChipText, { color: theme.foreground }]}>
                {studentCount} {studentCount === 1 ? 'student' : 'students'}
              </Text>
              {raisedHandsCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>👋 {raisedHandsCount}</Text>
                </View>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={teacherMuted ? 'Unmute teacher microphone' : 'Mute teacher microphone'}
              onPress={onToggleTeacherMute}
              style={[
                styles.actionChip,
                {
                  borderColor: teacherMuted ? theme.destructive : theme.primary,
                  backgroundColor: teacherMuted ? theme.muted : theme.surface,
                },
              ]}
            >
              <Text
                style={[
                  styles.actionChipText,
                  { color: teacherMuted ? theme.destructive : theme.primary },
                ]}
              >
                {teacherMuted ? 'Mic Off' : voiceAvailable ? 'Mic Live' : 'Mic'}
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={[styles.liveText, { color: theme.foreground }]}>
              {showcasedName
                ? `Showcase: ${showcasedName}`
                : isScratchpadMode
                  ? 'My Scratchpad'
                  : status !== 'connected'
                    ? status === 'reconnecting' || status === 'connecting'
                      ? 'Connecting…'
                      : 'Offline'
                    : !hasSnapshot
                      ? 'Syncing…'
                      : myPermission === 'can-draw'
                        ? 'Marker Active'
                        : 'View-only'}
            </Text>
            {!hasSnapshot && onRequestSync && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sync board from teacher"
                onPress={onRequestSync}
                style={[styles.actionChip, { borderColor: theme.primary }]}
              >
                <Text style={[styles.actionChipText, { color: theme.primary }]}>Sync</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={myHandRaised ? 'Lower hand' : 'Raise hand'}
              onPress={onToggleRaiseHand}
              style={[
                styles.actionChip,
                {
                  borderColor: myHandRaised ? '#EA580C' : theme.border,
                  backgroundColor: myHandRaised ? '#FFF7ED' : theme.surface,
                },
              ]}
            >
              <Text style={[styles.actionChipText, { color: myHandRaised ? '#EA580C' : theme.foreground }]}>
                {myHandRaised ? '👋 Raised' : '👋'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isScratchpadMode ? 'Switch to live board' : 'Switch to my scratchpad'}
              onPress={onToggleScratchpad}
              style={[
                styles.actionChip,
                {
                  borderColor: isScratchpadMode ? theme.primary : theme.border,
                  backgroundColor: isScratchpadMode ? theme.muted : theme.surface,
                },
              ]}
            >
              <Text style={[styles.actionChipText, { color: theme.foreground }]}>
                {isScratchpadMode ? 'Live Board' : 'Scratchpad'}
              </Text>
            </Pressable>
            {!isScratchpadMode && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={followTeacherViewport ? 'Unfollow teacher view' : 'Follow teacher view'}
                onPress={onToggleFollowTeacher}
                style={[
                  styles.actionChip,
                  {
                    borderColor: followTeacherViewport ? theme.primary : theme.border,
                  },
                ]}
              >
                <Text style={[styles.actionChipText, { color: theme.primary }]}>
                  {followTeacherViewport ? 'Following' : 'Follow'}
                </Text>
              </Pressable>
            )}
            {myCanSpeak && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={micEnabled ? 'Mute my microphone' : 'Unmute my microphone'}
                onPress={onToggleStudentMic}
                style={[
                  styles.actionChip,
                  {
                    borderColor: theme.primary,
                    backgroundColor: micEnabled ? theme.primary : theme.surface,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.actionChipText,
                    { color: micEnabled ? '#FFFFFF' : theme.primary },
                  ]}
                >
                  {micEnabled ? 'Speaking' : 'Unmute'}
                </Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Leave live class"
              onPress={onLeaveClass}
              style={[styles.actionChip, { borderColor: theme.border }]}
            >
              <Text style={[styles.actionChipText, { color: theme.destructive }]}>Leave</Text>
            </Pressable>
          </>
        )}
      </View>

      {notice && (
        <View
          style={[
            styles.noticeBanner,
            { backgroundColor: theme.surface, borderColor: theme.primary },
          ]}
        >
          <Text style={[styles.noticeText, { color: theme.foreground }]}>{notice}</Text>
        </View>
      )}
    </View>
  );
});
