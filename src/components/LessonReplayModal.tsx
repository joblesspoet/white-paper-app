import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { BoardBackground, BoardStyle } from '../persistence/schema';
import {
  formatDurationMMSS,
  interpolateLessonAtTime,
  type LessonRecordingPackage,
} from '../recorder/lesson-recorder';
import type { ThemeColors } from '../theme';
import { CanvasViewport } from './CanvasViewport';
import { lessonReplayModalStyles as styles } from './LessonReplayModal.styles';

const PLAYBACK_SPEEDS = [0.5, 1, 1.5, 2] as const;
const EMPTY_STRING_ARRAY: string[] = [];
const NOOP = () => {};

export type LessonReplayModalProps = {
  visible: boolean;
  lesson: LessonRecordingPackage | null;
  alreadySaved: boolean;
  dark: boolean;
  boardBackground: BoardBackground;
  boardStyle: BoardStyle;
  theme: ThemeColors;
  notice: string | null;
  onSaveToLibrary: (lesson: LessonRecordingPackage) => void;
  onShareLesson: (lesson: LessonRecordingPackage) => void;
  onDiscard: () => void;
  onClose: () => void;
};

export const LessonReplayModal = memo(function LessonReplayModal({
  visible,
  lesson,
  alreadySaved,
  dark,
  boardBackground,
  boardStyle,
  theme,
  notice,
  onSaveToLibrary,
  onShareLesson,
  onDiscard,
  onClose,
}: LessonReplayModalProps) {
  const insets = useSafeAreaInsets();
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof PLAYBACK_SPEEDS)[number]>(1);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [trackWidth, setTrackWidth] = useState(280);
  const lastTickRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!visible || !lesson) {
      setPlaying(false);
      setCurrentTimeMs(0);
      return;
    }
    setCurrentTimeMs(0);
    setPlaying(false);
  }, [lesson, visible]);

  useEffect(() => {
    if (!visible || !playing || !lesson) return;
    lastTickRef.current = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const delta = (now - lastTickRef.current) * speed;
      lastTickRef.current = now;
      setCurrentTimeMs((prev) => {
        const next = prev + delta;
        if (next >= lesson.durationMs) {
          setPlaying(false);
          return lesson.durationMs;
        }
        return next;
      });
    }, 33);
    return () => clearInterval(id);
  }, [lesson, playing, speed, visible]);

  const replayed = useMemo(() => {
    if (!lesson) return null;
    return interpolateLessonAtTime(lesson, currentTimeMs);
  }, [currentTimeMs, lesson]);

  const handleTogglePlay = useCallback(() => {
    if (!lesson) return;
    setPlaying((prev) => {
      if (!prev && currentTimeMs >= lesson.durationMs) {
        setCurrentTimeMs(0);
      }
      return !prev;
    });
  }, [currentTimeMs, lesson]);

  const handleTrackLayout = useCallback((event: LayoutChangeEvent) => {
    const w = event.nativeEvent.layout.width;
    if (w > 0) setTrackWidth(w);
  }, []);

  const seekFromEvent = useCallback(
    (event: GestureResponderEvent) => {
      if (!lesson || trackWidth <= 0) return;
      const ratio = Math.max(0, Math.min(1, event.nativeEvent.locationX / trackWidth));
      setCurrentTimeMs(Math.round(ratio * lesson.durationMs));
    },
    [lesson, trackWidth],
  );

  const handleSave = useCallback(() => {
    if (lesson) onSaveToLibrary(lesson);
  }, [lesson, onSaveToLibrary]);

  const handleShare = useCallback(() => {
    if (lesson) onShareLesson(lesson);
  }, [lesson, onShareLesson]);

  if (!visible || !lesson || !replayed) return null;

  const progressPct = `${Math.round(replayed.progress * 100)}%` as const;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.backdrop,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 },
        ]}
      >
        <View
          style={[
            styles.dialog,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <View style={styles.headerTitleWrap}>
              <Text numberOfLines={1} style={[styles.title, { color: theme.foreground }]}>
                {lesson.title || 'Lesson Replay'}
              </Text>
              <Text style={[styles.subtitle, { color: theme.foreground }]}>
                {lesson.quality} • {formatDurationMMSS(lesson.durationMs)} •{' '}
                {lesson.videoUri ? 'Video + Timeline' : '60 FPS Canvas Replay'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close replay"
              onPress={onClose}
              style={[styles.closeButton, { borderColor: theme.border }]}
            >
              <Text style={[styles.closeText, { color: theme.foreground }]}>Close</Text>
            </Pressable>
          </View>

          <View
            pointerEvents="none"
            style={[
              styles.stage,
              { backgroundColor: theme.background, borderBottomColor: theme.border },
            ]}
          >
            <CanvasViewport
              dark={dark}
              boardBackground={boardBackground}
              boardStyle={boardStyle}
              initialViewport={replayed.viewport}
              activeTool="select"
              color="slate"
              width={4}
              opacity={1}
              eraserRadius={18}
              laserColorKey={replayed.laserTrail?.colorKey ?? 'red'}
              shapeKind="rectangle"
              shapeColorKey="slate"
              shapeFillKey="none"
              shapeStrokeWidth={2}
              connectorStyle="arrow"
              connectorColorKey="slate"
              connectorStrokeWidth={2}
              document={replayed.document}
              selectedObjectIds={EMPTY_STRING_ARRAY}
              editingObjectId={null}
              editingTableCell={null}
              editingMath={false}
              editingMathSpan={null}
              viewportRequest={{
                key: Math.floor(currentTimeMs / 100),
                viewport: replayed.viewport,
              }}
              activeInstrument={null}
              stylusOnlyDrawing={false}
              pressureSensitivity={true}
              holdToSnapShapes={false}
              selectedInkIds={EMPTY_STRING_ARRAY}
              onViewportChange={NOOP}
              onCommand={NOOP}
              onCommitPending={NOOP}
              onObjectCreate={NOOP}
              onSelectionChange={NOOP}
              onInkSelectionChange={NOOP}
              onSnapStrokeToShape={NOOP}
              onObjectEdit={NOOP}
              onObjectMeasure={NOOP}
              onCanvasTouch={NOOP}
            />
            <View
              style={[
                styles.pageBadge,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.pageBadgeText, { color: theme.foreground }]}>
                Page {replayed.pageIndex + 1}
              </Text>
            </View>
          </View>

          <View style={styles.scrubberSection}>
            <View
              onLayout={handleTrackLayout}
              onStartShouldSetResponder={() => true}
              onResponderGrant={seekFromEvent}
              onResponderMove={seekFromEvent}
              style={styles.scrubberTrack}
            >
              <View style={[styles.scrubberRail, { backgroundColor: theme.muted }]}>
                <View
                  style={[
                    styles.scrubberFill,
                    { width: progressPct, backgroundColor: theme.primary },
                  ]}
                />
              </View>
            </View>
            <View style={styles.scrubberMetaRow}>
              <Text style={[styles.timeText, { color: theme.foreground }]}>
                {formatDurationMMSS(currentTimeMs)}
              </Text>
              <Text style={[styles.timeText, { color: theme.foreground }]}>
                {formatDurationMMSS(lesson.durationMs)}
              </Text>
            </View>
          </View>

          <View style={styles.controlsRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={playing ? 'Pause lesson replay' : 'Play lesson replay'}
              onPress={handleTogglePlay}
              style={[styles.playButton, { backgroundColor: theme.primary }]}
            >
              <Text style={[styles.playButtonText, { color: '#FFFFFF' }]}>
                {playing ? 'Pause' : 'Play'}
              </Text>
            </Pressable>

            <View style={styles.speedGroup}>
              {PLAYBACK_SPEEDS.map((s) => {
                const selected = speed === s;
                return (
                  <Pressable
                    key={s}
                    accessibilityRole="button"
                    accessibilityLabel={`Playback speed ${s}x`}
                    accessibilityState={{ selected }}
                    onPress={() => setSpeed(s)}
                    style={[
                      styles.speedChip,
                      {
                        backgroundColor: selected ? theme.primary : theme.muted,
                        borderColor: selected ? theme.primary : theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.speedText,
                        { color: selected ? '#FFFFFF' : theme.foreground },
                      ]}
                    >
                      {s}×
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {notice && (
            <View
              style={[
                styles.noticeBanner,
                { backgroundColor: theme.muted, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.noticeText, { color: theme.foreground }]}>{notice}</Text>
            </View>
          )}

          <View style={[styles.footer, { borderTopColor: theme.border }]}>
            {!alreadySaved && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Discard recorded lesson"
                onPress={onDiscard}
                style={[styles.footerButton, { borderColor: theme.border }]}
              >
                <Text style={[styles.footerButtonText, { color: theme.destructive }]}>
                  Discard
                </Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={alreadySaved ? 'Lesson saved in library' : 'Save lesson to library'}
              disabled={alreadySaved}
              onPress={handleSave}
              style={[
                styles.footerButton,
                {
                  backgroundColor: alreadySaved ? theme.muted : theme.surface,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text style={[styles.footerButtonText, { color: theme.foreground }]}>
                {alreadySaved ? 'Saved ✓' : 'Save'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Share lesson"
              onPress={handleShare}
              style={[
                styles.footerButton,
                { backgroundColor: theme.primary, borderColor: theme.primary },
              ]}
            >
              <Text style={[styles.footerButtonText, { color: '#FFFFFF' }]}>
                Share
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
});
