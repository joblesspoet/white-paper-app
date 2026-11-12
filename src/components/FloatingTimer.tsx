import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import {
  TIMER_PRESETS_SECONDS,
  adjustTimerDuration,
  createTimerState,
  pauseTimer,
  recordLap,
  resetTimer,
  selectTimerPreset,
  setTimerMode,
  startTimer,
  tickTimer,
  timerFormattedDisplay,
  timerProgress,
  type TimerState,
} from '../timer/timer-model';
import { radii, spacing, typography, type ThemeColors } from '../theme';
import { triggerHapticFeedback } from '../utils/haptics';
import { TimerIcon } from './icons';

type FloatingTimerProps = {
  visible: boolean;
  theme: ThemeColors;
  haptics: boolean;
  bounds: { width: number; height: number };
  onPinToBoard: (state: TimerState) => void;
  onClose: () => void;
};

const FULL_WIDTH = 220;
const PILL_WIDTH = 104;
const PILL_HEIGHT = 40;
const CARD_EST_HEIGHT = 250;

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function FloatingTimer({
  visible,
  theme,
  haptics,
  bounds,
  onPinToBoard,
  onClose,
}: FloatingTimerProps) {
  const [timer, setTimer] = useState<TimerState>(() => createTimerState());
  const [minimized, setMinimized] = useState(false);
  const [pos, setPos] = useState({ x: 16, y: 16 });
  const dragStart = useRef({ x: 16, y: 16 });
  const prevStatusRef = useRef(timer.status);

  useEffect(() => {
    if (timer.status !== 'running') return;
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const delta = now - last;
      last = now;
      setTimer((prev) => tickTimer(prev, delta));
    }, 200);
    return () => clearInterval(id);
  }, [timer.status]);

  useEffect(() => {
    if (prevStatusRef.current !== 'completed' && timer.status === 'completed') {
      void triggerHapticFeedback('warning', haptics);
    }
    prevStatusRef.current = timer.status;
  }, [haptics, timer.status]);

  useEffect(() => {
    const activeW = minimized ? PILL_WIDTH : FULL_WIDTH;
    const activeH = minimized ? PILL_HEIGHT : CARD_EST_HEIGHT;
    setPos((prev) => ({
      x: clamp(prev.x, 8, Math.max(8, bounds.width - activeW - 8)),
      y: clamp(prev.y, 8, Math.max(8, bounds.height - activeH - 8)),
    }));
  }, [bounds.height, bounds.width, minimized]);

  if (!visible) return null;

  const activeW = minimized ? PILL_WIDTH : FULL_WIDTH;
  const activeH = minimized ? PILL_HEIGHT : CARD_EST_HEIGHT;

  const panGesture = Gesture.Pan()
    .runOnJS(true)
    .onStart(() => {
      dragStart.current = pos;
    })
    .onUpdate((event) => {
      setPos({
        x: clamp(dragStart.current.x + event.translationX, 8, Math.max(8, bounds.width - activeW - 8)),
        y: clamp(dragStart.current.y + event.translationY, 8, Math.max(8, bounds.height - activeH - 8)),
      });
    });

  const display = timerFormattedDisplay(timer);
  const completed = timer.status === 'completed';
  const progress = timerProgress(timer);

  if (minimized) {
    return (
      <GestureDetector gesture={panGesture}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Expand timer ${display}`}
          onPress={() => setMinimized(false)}
          style={[
            styles.pill,
            {
              left: pos.x,
              top: pos.y,
              backgroundColor: theme.surface,
              borderColor: completed ? theme.accent : theme.border,
              borderWidth: completed ? 2 : 1,
            },
          ]}
        >
          <TimerIcon size={16} color={completed ? theme.accent : theme.primary} />
          <Text style={[styles.pillText, { color: completed ? theme.accent : theme.foreground }]}>
            {display}
          </Text>
        </Pressable>
      </GestureDetector>
    );
  }

  return (
    <View
      accessibilityLabel="Floating classroom timer"
      style={[
        styles.card,
        {
          left: pos.x,
          top: pos.y,
          width: FULL_WIDTH,
          backgroundColor: theme.surface,
          borderColor: completed ? theme.accent : theme.border,
          borderWidth: completed ? 2 : 1,
        },
      ]}
    >
      <GestureDetector gesture={panGesture}>
        <View style={styles.header}>
          <View style={styles.modeSegment}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Countdown mode"
              accessibilityState={{ selected: timer.mode === 'countdown' }}
              onPress={() => setTimer((prev) => setTimerMode(prev, 'countdown'))}
              style={[
                styles.modeChip,
                timer.mode === 'countdown' && { backgroundColor: theme.primary + '1F' },
              ]}
            >
              <Text style={[styles.modeText, { color: timer.mode === 'countdown' ? theme.primary : theme.foreground }]}>
                Timer
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Stopwatch mode"
              accessibilityState={{ selected: timer.mode === 'stopwatch' }}
              onPress={() => setTimer((prev) => setTimerMode(prev, 'stopwatch'))}
              style={[
                styles.modeChip,
                timer.mode === 'stopwatch' && { backgroundColor: theme.primary + '1F' },
              ]}
            >
              <Text style={[styles.modeText, { color: timer.mode === 'stopwatch' ? theme.primary : theme.foreground }]}>
                Watch
              </Text>
            </Pressable>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Minimize timer"
              onPress={() => setMinimized(true)}
              hitSlop={8}
              style={styles.iconBtn}
            >
              <Text style={[styles.headerActionText, { color: theme.foreground }]}>—</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close timer"
              onPress={onClose}
              hitSlop={8}
              style={styles.iconBtn}
            >
              <Text style={[styles.headerActionText, { color: theme.foreground }]}>×</Text>
            </Pressable>
          </View>
        </View>
      </GestureDetector>

      <Text
        accessibilityLiveRegion="polite"
        style={[styles.readout, { color: completed ? theme.accent : theme.foreground }]}
      >
        {display}
      </Text>

      {completed && (
        <Text style={[styles.completedBadge, { color: theme.accent }]}>Time's up!</Text>
      )}

      {timer.mode === 'countdown' ? (
        <>
          <View style={[styles.progressTrack, { backgroundColor: theme.muted }]}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.round(progress * 100)}%`,
                  backgroundColor: completed ? theme.accent : theme.primary,
                },
              ]}
            />
          </View>

          <View style={styles.presetsRow}>
            {TIMER_PRESETS_SECONDS.map((sec) => {
              const label = `${sec / 60}m`;
              const selected = timer.durationMs === sec * 1000 && timer.mode === 'countdown';
              return (
                <Pressable
                  key={sec}
                  accessibilityRole="button"
                  accessibilityLabel={`Set ${sec / 60} minute timer`}
                  onPress={() => setTimer((prev) => selectTimerPreset(prev, sec))}
                  style={[
                    styles.presetChip,
                    { borderColor: selected ? theme.primary : theme.border },
                    selected && { backgroundColor: theme.primary + '18' },
                  ]}
                >
                  <Text style={[styles.presetText, { color: selected ? theme.primary : theme.foreground }]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.stepperRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Subtract 30 seconds"
              onPress={() => setTimer((prev) => adjustTimerDuration(prev, -30_000))}
              style={[styles.stepperBtn, { borderColor: theme.border }]}
            >
              <Text style={[styles.stepperText, { color: theme.foreground }]}>-30s</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add 1 minute"
              onPress={() => setTimer((prev) => adjustTimerDuration(prev, 60_000))}
              style={[styles.stepperBtn, { borderColor: theme.border }]}
            >
              <Text style={[styles.stepperText, { color: theme.foreground }]}>+1m</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <Text style={[styles.lapSummary, { color: theme.foreground }]}>
          {timer.laps.length > 0 ? `Laps: ${timer.laps.length}` : 'Elapsed stopwatch'}
        </Text>
      )}

      <View style={styles.controlsRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={timer.status === 'running' ? 'Pause timer' : 'Start timer'}
          onPress={() =>
            setTimer((prev) => (prev.status === 'running' ? pauseTimer(prev) : startTimer(prev)))
          }
          style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
        >
          <Text style={[styles.primaryBtnText, { color: theme.onPrimary }]}>
            {timer.status === 'running' ? 'Pause' : 'Start'}
          </Text>
        </Pressable>

        {timer.mode === 'stopwatch' && timer.status === 'running' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Record lap"
            onPress={() => setTimer((prev) => recordLap(prev))}
            style={[styles.secondaryBtn, { borderColor: theme.border }]}
          >
            <Text style={[styles.secondaryBtnText, { color: theme.foreground }]}>Lap</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reset timer"
            onPress={() => setTimer((prev) => resetTimer(prev))}
            style={[styles.secondaryBtn, { borderColor: theme.border }]}
          >
            <Text style={[styles.secondaryBtnText, { color: theme.foreground }]}>Reset</Text>
          </Pressable>
        )}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Pin timer to board"
        onPress={() => onPinToBoard(timer)}
        style={[styles.pinBtn, { borderColor: theme.border, backgroundColor: theme.background }]}
      >
        <Text style={[styles.pinBtnText, { color: theme.primary }]}>Pin to board</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    zIndex: 25,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  card: {
    position: 'absolute',
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: spacing.xs,
    zIndex: 25,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modeSegment: {
    flexDirection: 'row',
    gap: 4,
  },
  modeChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  modeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  readout: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    paddingVertical: 2,
  },
  completedBadge: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  presetsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  presetChip: {
    flex: 1,
    paddingVertical: 4,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
  },
  presetText: {
    fontSize: 11,
    fontWeight: '600',
  },
  stepperRow: {
    flexDirection: 'row',
    gap: 6,
  },
  stepperBtn: {
    flex: 1,
    paddingVertical: 5,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
  },
  stepperText: {
    fontSize: 12,
    fontWeight: '600',
  },
  lapSummary: {
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.75,
    paddingVertical: 4,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  primaryBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radii.sm,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  pinBtn: {
    paddingVertical: 7,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
  },
  pinBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
