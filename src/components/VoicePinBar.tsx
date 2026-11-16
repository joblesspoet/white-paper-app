import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { MAX_VOICE_PIN_DURATION_MS, formatVoiceDuration } from '../audio/voice-pin-model';
import type { ThemeColors } from '../theme';
import { voicePinBarStyles as styles } from './VoicePinBar.styles';

export type VoicePinBarProps = {
  isRecording: boolean;
  recordingMs: number;
  livePeaks: readonly number[];
  playingPinId: string | null;
  errorMessage: string | null;
  permissionBlocked: boolean;
  bottomOffset: number;
  theme: ThemeColors;
  onStopRecording: () => void;
  onCancelRecording: () => void;
  onStopPlayback: () => void;
  onOpenSettings: () => void;
  onDismissError: () => void;
};

export const VoicePinBar = memo(function VoicePinBar({
  isRecording,
  recordingMs,
  livePeaks,
  playingPinId,
  errorMessage,
  permissionBlocked,
  bottomOffset,
  theme,
  onStopRecording,
  onCancelRecording,
  onStopPlayback,
  onOpenSettings,
  onDismissError,
}: VoicePinBarProps) {
  if (!isRecording && !playingPinId && !errorMessage) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={[styles.wrapper, { bottom: bottomOffset }]}>
      <View
        style={[
          styles.card,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        {isRecording && (
          <View style={styles.row}>
            <View style={styles.recDot} />
            <Text style={[styles.timerText, { color: theme.foreground }]}>
              {formatVoiceDuration(recordingMs)} / {formatVoiceDuration(MAX_VOICE_PIN_DURATION_MS)}
            </Text>
            <View style={styles.meterRow}>
              {livePeaks.map((peak, index) => (
                <View
                  key={index}
                  style={[
                    styles.meterBar,
                    {
                      height: Math.max(4, Math.round(peak * 22)),
                      backgroundColor: theme.primary,
                    },
                  ]}
                />
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel voice pin recording"
              onPress={onCancelRecording}
              style={({ pressed }) => [
                styles.actionBtn,
                { borderColor: theme.border, backgroundColor: theme.background },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.actionText, { color: theme.foreground }]}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save voice pin"
              onPress={onStopRecording}
              style={({ pressed }) => [
                styles.actionBtn,
                { borderColor: theme.primary, backgroundColor: theme.primary },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.actionText, { color: '#FFFFFF' }]}>Pin</Text>
            </Pressable>
          </View>
        )}

        {!isRecording && playingPinId && (
          <View style={styles.row}>
            <Text style={[styles.timerText, { color: theme.primary }]}>Playing voice pin…</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Stop voice pin playback"
              onPress={onStopPlayback}
              style={({ pressed }) => [
                styles.actionBtn,
                { borderColor: theme.border, backgroundColor: theme.background },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.actionText, { color: theme.foreground }]}>Stop</Text>
            </Pressable>
          </View>
        )}

        {errorMessage && (
          <View style={styles.row}>
            <Text style={[styles.errorText, { color: theme.destructive }]}>{errorMessage}</Text>
            {permissionBlocked && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open device settings"
                onPress={onOpenSettings}
                style={({ pressed }) => [
                  styles.actionBtn,
                  { borderColor: theme.primary, backgroundColor: theme.muted },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.actionText, { color: theme.primary }]}>Open Settings</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss voice pin message"
              onPress={onDismissError}
              style={({ pressed }) => [
                styles.actionBtn,
                { borderColor: theme.border },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.actionText, { color: theme.foreground }]}>OK</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
});
