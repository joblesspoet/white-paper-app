import React from 'react';
import { Pressable, Text, View } from 'react-native';

import type { ClassroomParticipant } from '../../classroom/protocol';
import type { ThemeColors } from '../../theme';
import { liveClassHostStyles as styles } from '../LiveClassHostSheet.styles';

export type ParticipantRowProps = {
  item: ClassroomParticipant;
  theme: ThemeColors;
  onToggleDraw: (peerId: string, currentlyCanDraw: boolean) => void;
  onToggleVoice: (peerId: string, currentlyCanSpeak: boolean) => void;
  onLowerHand: (peerId: string) => void;
  onKick: (peerId: string) => void;
};

/** Renders a single student row with hand-raise acknowledgement, draw/voice permissions, and kick action. */
export const ParticipantRow = React.memo(function ParticipantRow({
  item,
  theme,
  onToggleDraw,
  onToggleVoice,
  onLowerHand,
  onKick,
}: ParticipantRowProps) {
  const canDraw = item.permission === 'can-draw';
  const canSpeak = item.voicePermission === 'can-speak';
  const statusLabel = canDraw
    ? 'Marker active'
    : item.permission === 'locked'
      ? 'Locked'
      : 'View-only';

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
          {statusLabel}
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
