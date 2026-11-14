import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

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
  theme: ThemeColors;
  bounds?: { width: number; height: number };
  bottomExclusion?: number;
  isTablet?: boolean;
  onSelectQuality: (quality: VideoQuality) => void;
  onToggleMic: () => void;
  onStart: () => void;
  onCancelCountdown: () => void;
  onPauseResume: () => void;
  onStop: () => void;
  onClose: () => void;
};

export const LessonRecorderBar = memo(function LessonRecorderBar({
  visible,
  status,
  elapsedMs,
  countdownRemaining,
  quality,
  includeMic,
  theme,
  bounds = { width: 800, height: 600 },
  bottomExclusion = 0,
  isTablet = true,
  onSelectQuality,
  onToggleMic,
  onStart,
  onCancelCountdown,
  onPauseResume,
  onStop,
  onClose,
}: LessonRecorderBarProps) {
  const [pulseOn, setPulseOn] = useState(true);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [pillSize, setPillSize] = useState({ width: isTablet ? 360 : 196, height: 44 });
  const defaultTop = isTablet ? 12 : 52;
  const [pos, setPos] = useState({
    x: Math.max(8, (bounds.width - (isTablet ? 360 : 196)) / 2),
    y: defaultTop,
  });
  const hasDraggedRef = useRef(false);
  const dragStartRef = useRef(pos);

  const clampPos = useCallback(
    (nextX: number, nextY: number) => {
      const maxX = Math.max(8, bounds.width - pillSize.width - 8);
      const maxY = Math.max(8, bounds.height - bottomExclusion - pillSize.height - 8);
      return {
        x: Math.max(8, Math.min(nextX, maxX)),
        y: Math.max(8, Math.min(nextY, maxY)),
      };
    },
    [bottomExclusion, bounds.height, bounds.width, pillSize.height, pillSize.width],
  );

  useEffect(() => {
    if (!visible) {
      hasDraggedRef.current = false;
      setOptionsOpen(false);
      return;
    }
    if (status !== 'idle') {
      setOptionsOpen(false);
    }
    if (!hasDraggedRef.current) {
      setPos(clampPos((bounds.width - pillSize.width) / 2, isTablet ? 12 : 52));
    } else {
      setPos((prev) => clampPos(prev.x, prev.y));
    }
  }, [bounds.width, clampPos, isTablet, pillSize.width, status, visible]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(6)
        .runOnJS(true)
        .onStart(() => {
          dragStartRef.current = pos;
          hasDraggedRef.current = true;
        })
        .onUpdate((event) => {
          setPos(
            clampPos(
              dragStartRef.current.x + event.translationX,
              dragStartRef.current.y + event.translationY,
            ),
          );
        }),
    [clampPos, pos],
  );

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

  const maxPillWidth = Math.max(220, bounds.width - 16);

  return (
    <GestureDetector gesture={panGesture}>
      <View
        pointerEvents="box-none"
        style={[
          styles.wrapper,
          {
            left: pos.x,
            top: pos.y,
            maxWidth: maxPillWidth,
          },
        ]}
      >
        <View
          onLayout={(event) => {
            const { width: w, height: h } = event.nativeEvent.layout;
            if (Math.abs(w - pillSize.width) > 2 || Math.abs(h - pillSize.height) > 2) {
              setPillSize({ width: w, height: h });
            }
          }}
          style={[
            styles.pill,
            !isTablet && styles.pillCompact,
            {
              backgroundColor: theme.surface,
              borderColor: status === 'recording' ? '#DC2626' : theme.border,
            },
          ]}
        >
          <View style={styles.dragHandle} accessible accessibilityLabel="Drag recorder bar">
            <Text style={[styles.dragHandleText, { color: theme.foreground }]}>⋮⋮</Text>
          </View>
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
        ) : isTablet ? (
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
              accessibilityLabel="Close lesson recorder"
              onPress={onClose}
              style={[styles.chipButton, { borderColor: theme.border }]}
            >
              <Text style={[styles.chipText, { color: theme.foreground }]}>Close</Text>
            </Pressable>
          </>
        ) : (
          <>
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
              accessibilityLabel="Toggle recording options"
              accessibilityState={{ expanded: optionsOpen }}
              onPress={() => setOptionsOpen((prev) => !prev)}
              style={[
                styles.chipButton,
                {
                  backgroundColor: optionsOpen ? theme.primary : theme.muted,
                  borderColor: optionsOpen ? theme.primary : theme.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: optionsOpen ? '#FFFFFF' : theme.foreground },
                ]}
              >
                {optionsOpen ? 'Options ▲' : 'Options ▾'}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close lesson recorder"
              onPress={onClose}
              style={[styles.chipButton, { borderColor: theme.border }]}
            >
              <Text style={[styles.chipText, { color: theme.foreground }]}>✕</Text>
            </Pressable>
          </>
        )}
        </View>

        {!isTablet && status === 'idle' && optionsOpen && (
          <View
            style={[
              styles.optionsDropdown,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View style={styles.optionsRow}>
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
            <View style={styles.optionsRow}>
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
            </View>
          </View>
        )}
      </View>
    </GestureDetector>
  );
});
