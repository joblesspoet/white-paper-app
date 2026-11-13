import { memo, useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  VIDEO_QUALITY_OPTIONS,
  formatDurationMMSS,
  type RecorderStatus,
  type VideoQuality,
} from '../recorder/lesson-recorder';
import type { ThemeColors } from '../theme';
import { lessonRecorderBarStyles as styles } from './LessonRecorderBar.styles';

export type LessonRecorderBarProps = {
  visible: boolean;
  status: RecorderStatus;
  elapsedMs: number;
  countdownRemaining: number;
  quality: VideoQuality;
  includeMic: boolean;
  savedCount: number;
  theme: ThemeColors;
  onSelectQuality: (quality: VideoQuality) => void;
  onToggleMic: () => void;
  onStart: () => void;
  onCancelCountdown: () => void;
  onPauseResume: () => void;
  onStop: () => void;
  onOpenSavedLessons: () => void;
  onClose: () => void;
};

export const LessonRecorderBar = memo(function LessonRecorderBar({
  visible,
  status,
  elapsedMs,
  countdownRemaining,
  quality,
  includeMic,
  savedCount,
  theme,
  onSelectQuality,
  onToggleMic,
  onStart,
  onCancelCountdown,
  onPauseResume,
  onStop,
  onOpenSavedLessons,
  onClose,
}: LessonRecorderBarProps) {
  const [pulseOn, setPulseOn] = useState(true);

  useEffect(() => {
    if (status !== 'recording') {
      setPulseOn(true);
      return;
    }
    const id = setInterval(() => {
      setPulseOn((prev) => !prev);
    }, 550);
    return () => clearInterval(id);
  }, [status]);

  const handleQualityPress = useCallback(
    (q: VideoQuality) => {
      onSelectQuality(q);
    },
    [onSelectQuality],
  );

  if (!visible) return null;

  const isActive = status === 'recording' || status === 'paused' || status === 'stopping';

  return (
    <View pointerEvents="box-none" style={styles.wrapper}>
      <View
        style={[
          styles.pill,
          {
            backgroundColor: theme.surface,
            borderColor: status === 'recording' ? '#DC2626' : theme.border,
          },
        ]}
      >
        {status === 'countdown' ? (
          <>
            <View style={styles.statusRow}>
              <View style={[styles.recDot, { backgroundColor: '#DC2626' }]} />
              <Text style={[styles.timerText, { color: theme.foreground }]}>
                Starting in {countdownRemaining}…
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel recording countdown"
              onPress={onCancelCountdown}
              style={[styles.chipButton, { borderColor: theme.border }]}
            >
              <Text style={[styles.chipText, { color: theme.foreground }]}>Cancel</Text>
            </Pressable>
          </>
        ) : isActive ? (
          <>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.recDot,
                  {
                    backgroundColor: status === 'paused' ? theme.accent : '#DC2626',
                    opacity: status === 'recording' ? (pulseOn ? 1 : 0.3) : 1,
                  },
                ]}
              />
              <Text style={[styles.timerText, { color: theme.foreground }]}>
                {status === 'paused' ? 'Paused' : 'Rec'} ● {formatDurationMMSS(elapsedMs)}
              </Text>
            </View>
            <View
              style={[
                styles.micBadge,
                {
                  borderColor: theme.border,
                  backgroundColor: includeMic ? `${theme.primary}18` : theme.muted,
                },
              ]}
            >
              <Text style={[styles.micBadgeText, { color: theme.foreground }]}>
                {includeMic ? 'Mic On' : 'Muted'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={status === 'paused' ? 'Resume recording' : 'Pause recording'}
              onPress={onPauseResume}
              style={[
                styles.targetButton,
                { borderColor: theme.border, backgroundColor: theme.muted },
              ]}
            >
              <Text style={[styles.chipText, { color: theme.foreground }]}>
                {status === 'paused' ? 'Resume' : 'Pause'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Stop recording"
              onPress={onStop}
              style={[styles.stopAction, { backgroundColor: '#DC2626' }]}
            >
              <Text style={[styles.primaryActionText, { color: '#FFFFFF' }]}>Stop</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.qualityGroup}>
              {VIDEO_QUALITY_OPTIONS.map((opt) => {
                const selected = quality === opt;
                return (
                  <Pressable
                    key={opt}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${opt} quality`}
                    accessibilityState={{ selected }}
                    onPress={() => handleQualityPress(opt)}
                    style={[
                      styles.chipButton,
                      {
                        backgroundColor: selected ? theme.primary : theme.muted,
                        borderColor: selected ? theme.primary : theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: selected ? '#FFFFFF' : theme.foreground },
                      ]}
                    >
                      {opt}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={includeMic ? 'Disable microphone' : 'Enable microphone'}
              accessibilityState={{ selected: includeMic }}
              onPress={onToggleMic}
              style={[
                styles.chipButton,
                {
                  backgroundColor: includeMic ? `${theme.primary}1F` : theme.muted,
                  borderColor: includeMic ? theme.primary : theme.border,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: theme.foreground }]}>
                {includeMic ? 'Mic On' : 'Mic Off'}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Start lesson recording"
              onPress={onStart}
              style={[styles.primaryAction, { backgroundColor: '#DC2626' }]}
            >
              <Text style={[styles.primaryActionText, { color: '#FFFFFF' }]}>Rec ●</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open saved lessons"
              onPress={onOpenSavedLessons}
              style={[styles.chipButton, { borderColor: theme.border, backgroundColor: theme.muted }]}
            >
              <Text style={[styles.chipText, { color: theme.foreground }]}>
                Saved ({savedCount})
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close lesson recorder"
              onPress={onClose}
              style={[styles.chipButton, { borderColor: theme.border }]}
            >
              <Text style={[styles.chipText, { color: theme.foreground }]}>Close</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
});
