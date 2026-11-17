import React, { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { formatRoomCode } from '../../classroom/protocol';
import { colors, type ThemeColors } from '../../theme';
import { BroadcastIcon, MicIcon } from '../icons';
import { oneOnOneLiveBarStyles as styles } from './OneOnOneLiveBar.styles';

export type OneOnOneLiveBarProps = {
  theme: ThemeColors;
  isDark: boolean;
  role: 'teacher' | 'student';
  roomCode: string;
  voiceEnabled: boolean;
  connectedStudentName: string | null;
  studentCanSpeak: boolean;
  studentHandRaised: boolean;
  studentCanDraw: boolean;
  teacherMuted: boolean;
  myCanSpeak: boolean;
  myHandRaised: boolean;
  myCanDraw: boolean;
  onOpenQrSheet: () => void;
  onToggleStudentVoice: () => void;
  onAllowStudentHandRaise: () => void;
  onDismissStudentHandRaise: () => void;
  onToggleStudentDraw: () => void;
  onToggleTeacherMute: () => void;
  onToggleStudentSelfMic: () => void;
  onToggleStudentRaiseHand: () => void;
  onEndOrLeave: () => void;
};

export const OneOnOneLiveBar = memo(function OneOnOneLiveBar({
  theme,
  isDark,
  role,
  roomCode,
  voiceEnabled,
  connectedStudentName,
  studentCanSpeak,
  studentHandRaised,
  studentCanDraw,
  teacherMuted,
  myCanSpeak,
  myHandRaised,
  myCanDraw,
  onOpenQrSheet,
  onToggleStudentVoice,
  onAllowStudentHandRaise,
  onDismissStudentHandRaise,
  onToggleStudentDraw,
  onToggleTeacherMute,
  onToggleStudentSelfMic,
  onToggleStudentRaiseHand,
  onEndOrLeave,
}: OneOnOneLiveBarProps) {
  const isTeacher = role === 'teacher';
  const displayCode = formatRoomCode(roomCode);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? '#141A24' : '#F1F5F9',
          borderBottomColor: theme.border,
        },
      ]}
    >
      {/* --------------------------------- Left Group (Status & Connected Peer) */}
      <View style={styles.leftGroup}>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: isDark ? 'rgba(239, 68, 68, 0.18)' : '#FEE2E2',
              borderColor: colors.destructive,
            },
          ]}
        >
          <View style={[styles.pulseDot, { backgroundColor: colors.destructive }]} />
          <Text style={[styles.statusText, { color: colors.destructive }]}>
            1-ON-1 {voiceEnabled ? 'VOICE' : 'SYNC'}
          </Text>
        </View>

        {isTeacher ? (
          connectedStudentName ? (
            <View
              style={[
                styles.studentNamePill,
                {
                  backgroundColor: isDark ? '#1E293B' : '#E2E8F0',
                  borderColor: theme.border,
                },
              ]}
            >
              <View style={[styles.pulseDot, { backgroundColor: '#10B981' }]} />
              <Text
                style={[styles.studentNameText, { color: theme.foreground }]}
                numberOfLines={1}
              >
                Student: {connectedStudentName}
              </Text>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Waiting for student. Room code ${displayCode}. Tap for QR and share.`}
              onPress={onOpenQrSheet}
              style={({ pressed }) => [
                styles.waitingCodeBtn,
                {
                  backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                  borderColor: theme.primary,
                },
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.pulseDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={[styles.waitingCodeText, { color: theme.primary }]}>
                Waiting for student · {displayCode}
              </Text>
            </Pressable>
          )
        ) : (
          <View
            style={[
              styles.studentNamePill,
              {
                backgroundColor: isDark ? '#1E293B' : '#E2E8F0',
                borderColor: theme.border,
              },
            ]}
          >
            <View style={[styles.pulseDot, { backgroundColor: '#10B981' }]} />
            <Text style={[styles.studentNameText, { color: theme.foreground }]}>
              Teacher connected
            </Text>
          </View>
        )}
      </View>

      {/* --------------------------------- Middle Group (Audio & Permissions) */}
      <View style={styles.middleGroup}>
        {isTeacher ? (
          <>
            {studentHandRaised && connectedStudentName ? (
              <View
                style={[
                  styles.handRaiseAlert,
                  {
                    backgroundColor: isDark ? '#451A03' : '#FEF3C7',
                    borderColor: '#F59E0B',
                  },
                ]}
              >
                <Text style={[styles.handRaiseText, { color: isDark ? '#FDE68A' : '#92400E' }]}>
                  ✋ {connectedStudentName} wants to speak
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Allow student to speak"
                  onPress={onAllowStudentHandRaise}
                  style={({ pressed }) => [
                    styles.allowBtn,
                    { backgroundColor: theme.primary },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.allowBtnText}>Allow</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss hand raise"
                  onPress={onDismissStudentHandRaise}
                  style={({ pressed }) => [styles.dismissBtn, pressed && styles.pressed]}
                >
                  <Text style={[styles.dismissBtnText, { color: theme.foreground }]}>✕</Text>
                </Pressable>
              </View>
            ) : (
              voiceEnabled &&
              connectedStudentName && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    studentCanSpeak
                      ? 'Student microphone active. Tap to mute student.'
                      : 'Student microphone muted. Tap to allow student to speak.'
                  }
                  onPress={onToggleStudentVoice}
                  style={({ pressed }) => [
                    styles.controlPill,
                    {
                      backgroundColor: studentCanSpeak
                        ? isDark
                          ? '#064E3B'
                          : '#D1FAE5'
                        : isDark
                          ? '#1E293B'
                          : '#FFFFFF',
                      borderColor: studentCanSpeak ? '#10B981' : theme.border,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.controlPillText,
                      { color: studentCanSpeak ? '#059669' : theme.foreground },
                    ]}
                  >
                    {studentCanSpeak ? '🎙️ Student: Speaking' : '🔇 Student: Muted'}
                  </Text>
                </Pressable>
              )
            )}

            {connectedStudentName && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  studentCanDraw
                    ? 'Student drawing enabled. Tap to change to view-only.'
                    : 'Student view-only. Tap to allow student to draw.'
                }
                onPress={onToggleStudentDraw}
                style={({ pressed }) => [
                  styles.controlPill,
                  {
                    backgroundColor: studentCanDraw
                      ? isDark
                        ? '#1E1B4B'
                        : '#EDE9FE'
                      : isDark
                        ? '#1E293B'
                        : '#FFFFFF',
                    borderColor: studentCanDraw ? theme.primary : theme.border,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.controlPillText,
                    { color: studentCanDraw ? theme.primary : theme.foreground },
                  ]}
                >
                  {studentCanDraw ? '✏️ Student: Can Draw' : '👁️ Student: View Only'}
                </Text>
              </Pressable>
            )}

            {voiceEnabled && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  teacherMuted
                    ? 'Your microphone is muted. Tap to unmute.'
                    : 'Your microphone is on. Tap to mute.'
                }
                onPress={onToggleTeacherMute}
                style={({ pressed }) => [
                  styles.controlPill,
                  {
                    backgroundColor: teacherMuted
                      ? isDark
                        ? '#7F1D1D'
                        : '#FEE2E2'
                      : isDark
                        ? '#064E3B'
                        : '#D1FAE5',
                    borderColor: teacherMuted ? colors.destructive : '#10B981',
                  },
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.controlPillText,
                    { color: teacherMuted ? colors.destructive : '#059669' },
                  ]}
                >
                  {teacherMuted ? '🔇 My Mic: Muted' : '🎙️ My Mic: ON'}
                </Text>
              </Pressable>
            )}
          </>
        ) : (
          /* Student Controls */
          <>
            {voiceEnabled && (
              myCanSpeak ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Your mic is unlocked by the teacher. Tap to toggle your microphone."
                  onPress={onToggleStudentSelfMic}
                  style={({ pressed }) => [
                    styles.controlPill,
                    {
                      backgroundColor: isDark ? '#064E3B' : '#D1FAE5',
                      borderColor: '#10B981',
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.controlPillText, { color: '#059669' }]}>
                    🎙️ Mic: Speaking
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    myHandRaised
                      ? 'Hand is raised. Waiting for teacher.'
                      : 'Tap to raise hand and ask to speak.'
                  }
                  onPress={onToggleStudentRaiseHand}
                  style={({ pressed }) => [
                    styles.controlPill,
                    {
                      backgroundColor: myHandRaised
                        ? isDark
                          ? '#451A03'
                          : '#FEF3C7'
                        : isDark
                          ? '#1E293B'
                          : '#FFFFFF',
                      borderColor: myHandRaised ? '#F59E0B' : theme.border,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.controlPillText,
                      { color: myHandRaised ? '#D97706' : theme.foreground },
                    ]}
                  >
                    {myHandRaised ? '✋ Hand Raised' : '✋ Ask to Speak'}
                  </Text>
                </Pressable>
              )
            )}

            <View
              style={[
                styles.controlPill,
                {
                  backgroundColor: myCanDraw
                    ? isDark
                      ? '#1E1B4B'
                      : '#EDE9FE'
                    : isDark
                      ? '#1E293B'
                      : '#FFFFFF',
                  borderColor: myCanDraw ? theme.primary : theme.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.controlPillText,
                  { color: myCanDraw ? theme.primary : theme.foreground },
                ]}
              >
                {myCanDraw ? '✏️ Can Draw' : '👁️ View-Only'}
              </Text>
            </View>
          </>
        )}
      </View>

      {/* --------------------------------- Right Group (Share & End/Leave) */}
      <View style={styles.rightGroup}>
        {isTeacher && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Show QR code and room share"
            onPress={onOpenQrSheet}
            style={({ pressed }) => [
              styles.iconBtn,
              {
                backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                borderColor: theme.border,
              },
              pressed && styles.pressed,
            ]}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: theme.foreground }}>
              QR
            </Text>
          </Pressable>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isTeacher ? 'End live tutoring session' : 'Leave tutoring session'}
          onPress={onEndOrLeave}
          style={({ pressed }) => [
            styles.endBtn,
            { backgroundColor: colors.destructive },
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.endBtnText}>{isTeacher ? 'End' : 'Leave'}</Text>
        </Pressable>
      </View>
    </View>
  );
});
