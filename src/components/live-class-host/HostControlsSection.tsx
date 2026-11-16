import React from 'react';
import { Pressable, Switch, Text, View } from 'react-native';

import { formatRoomCode, type ClassroomRoomInfo } from '../../classroom/protocol';
import type { ThemeColors } from '../../theme';
import { ClassroomQrCode } from '../ClassroomQrCode';
import { liveClassHostStyles as styles } from '../LiveClassHostSheet.styles';

export type HostInviteCardProps = {
  roomInfo: ClassroomRoomInfo;
  qrSize: number;
  copiedNotice: boolean;
  theme: ThemeColors;
  onCopyCode: () => void;
  onShareLink: () => void;
};

/** Displays the 6-digit join code, share actions, and QR code for students to join. */
export const HostInviteCard = React.memo(function HostInviteCard({
  roomInfo,
  qrSize,
  copiedNotice,
  theme,
  onCopyCode,
  onShareLink,
}: HostInviteCardProps) {
  return (
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
            onPress={onCopyCode}
            style={[
              styles.smallBtn,
              { borderColor: theme.border, backgroundColor: theme.surface },
            ]}
          >
            <Text style={[styles.smallBtnText, { color: theme.foreground }]}>
              {copiedNotice ? 'Shared!' : 'Copy code'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share deep link"
            onPress={onShareLink}
            style={[
              styles.smallBtn,
              { borderColor: theme.primary, backgroundColor: theme.surface },
            ]}
          >
            <Text style={[styles.smallBtnText, { color: theme.primary }]}>Share link</Text>
          </Pressable>
        </View>
      </View>
      <ClassroomQrCode
        value={roomInfo.deepLinkUri}
        size={qrSize}
        borderColor={theme.border}
      />
    </View>
  );
});

export type HostControlsCardProps = {
  isLocked: boolean;
  followTeacherViewport: boolean;
  theme: ThemeColors;
  onToggleLock: (locked: boolean) => void;
  onToggleFollowViewport: (follow: boolean) => void;
};

/** Displays classroom-wide host switches (lock class and sync teacher camera). */
export const HostControlsCard = React.memo(function HostControlsCard({
  isLocked,
  followTeacherViewport,
  theme,
  onToggleLock,
  onToggleFollowViewport,
}: HostControlsCardProps) {
  return (
    <View
      style={[
        styles.controlsCard,
        { backgroundColor: theme.background, borderColor: theme.border },
      ]}
    >
      <View style={styles.switchRow}>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: isLocked }}
          onPress={() => onToggleLock(!isLocked)}
          style={styles.switchLabelWrap}
        >
          <Text style={[styles.switchLabel, { color: theme.foreground }]}>
            Lock class (freeze edits & new joins)
          </Text>
        </Pressable>
        <Switch
          accessibilityLabel="Lock class"
          value={isLocked}
          onValueChange={onToggleLock}
          trackColor={{ false: theme.border, true: theme.destructive }}
        />
      </View>
      <View style={styles.switchRow}>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: followTeacherViewport }}
          onPress={() => onToggleFollowViewport(!followTeacherViewport)}
          style={styles.switchLabelWrap}
        >
          <Text style={[styles.switchLabel, { color: theme.foreground }]}>
            Sync teacher camera to students/projector
          </Text>
        </Pressable>
        <Switch
          accessibilityLabel="Sync teacher camera"
          value={followTeacherViewport}
          onValueChange={onToggleFollowViewport}
          trackColor={{ false: theme.border, true: theme.primary }}
        />
      </View>
    </View>
  );
});
