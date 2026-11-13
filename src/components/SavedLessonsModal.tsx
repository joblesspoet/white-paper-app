import { memo, useCallback, useMemo } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  Text,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatDurationMMSS } from '../recorder/lesson-recorder';
import { formatStorageBytes, type SavedLessonSummary } from '../recorder/lesson-store';
import type { ThemeColors } from '../theme';
import { savedLessonsModalStyles as styles } from './SavedLessonsModal.styles';

type LessonRowProps = {
  item: SavedLessonSummary;
  theme: ThemeColors;
  onPlay: (item: SavedLessonSummary) => void;
  onShare: (item: SavedLessonSummary) => void;
  onDelete: (item: SavedLessonSummary) => void;
};

const LessonRow = memo(function LessonRow({
  item,
  theme,
  onPlay,
  onShare,
  onDelete,
}: LessonRowProps) {
  const dateLabel = useMemo(() => {
    try {
      return new Date(item.createdAt).toLocaleDateString();
    } catch {
      return '';
    }
  }, [item.createdAt]);

  return (
    <View
      style={[
        styles.rowCard,
        { backgroundColor: theme.background, borderColor: theme.border },
      ]}
    >
      <View style={styles.rowTop}>
        <Text numberOfLines={1} style={[styles.rowTitle, { color: theme.foreground }]}>
          {item.title || 'Untitled lesson'}
        </Text>
        <View
          style={[
            styles.qualityBadge,
            { backgroundColor: theme.muted, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.qualityText, { color: theme.foreground }]}>
            {item.quality}
          </Text>
        </View>
      </View>

      <Text style={[styles.rowMeta, { color: theme.foreground }]}>
        {formatDurationMMSS(item.durationMs)} • {formatStorageBytes(item.sizeBytes)}
        {dateLabel ? ` • ${dateLabel}` : ''}
      </Text>

      <View style={styles.rowActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete ${item.title}`}
          onPress={() => onDelete(item)}
          style={[styles.actionButton, { borderColor: theme.border }]}
        >
          <Text style={[styles.actionText, { color: theme.destructive }]}>Delete</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Share ${item.title}`}
          onPress={() => onShare(item)}
          style={[
            styles.actionButton,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.actionText, { color: theme.foreground }]}>Share</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Play ${item.title}`}
          onPress={() => onPlay(item)}
          style={[
            styles.actionButton,
            { backgroundColor: theme.primary, borderColor: theme.primary },
          ]}
        >
          <Text style={[styles.actionText, { color: '#FFFFFF' }]}>Play</Text>
        </Pressable>
      </View>
    </View>
  );
});

export type SavedLessonsModalProps = {
  visible: boolean;
  lessons: SavedLessonSummary[];
  theme: ThemeColors;
  onPlayLesson: (item: SavedLessonSummary) => void;
  onShareLesson: (item: SavedLessonSummary) => void;
  onDeleteLesson: (item: SavedLessonSummary) => void;
  onClose: () => void;
};

export const SavedLessonsModal = memo(function SavedLessonsModal({
  visible,
  lessons,
  theme,
  onPlayLesson,
  onShareLesson,
  onDeleteLesson,
  onClose,
}: SavedLessonsModalProps) {
  const insets = useSafeAreaInsets();

  const totalBytes = useMemo(
    () => lessons.reduce((sum, item) => sum + item.sizeBytes, 0),
    [lessons],
  );

  const keyExtractor = useCallback((item: SavedLessonSummary) => item.id, []);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<SavedLessonSummary>) => (
      <LessonRow
        item={item}
        theme={theme}
        onPlay={onPlayLesson}
        onShare={onShareLesson}
        onDelete={onDeleteLesson}
      />
    ),
    [onDeleteLesson, onPlayLesson, onShareLesson, theme],
  );

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
              <Text style={[styles.title, { color: theme.foreground }]}>Saved Lessons</Text>
              <Text style={[styles.subtitle, { color: theme.foreground }]}>
                {lessons.length} {lessons.length === 1 ? 'recording' : 'recordings'} •{' '}
                {formatStorageBytes(totalBytes)} used
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close saved lessons"
              onPress={onClose}
              style={[styles.closeButton, { borderColor: theme.border }]}
            >
              <Text style={[styles.closeText, { color: theme.foreground }]}>Close</Text>
            </Pressable>
          </View>

          {lessons.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyTitle, { color: theme.foreground }]}>
                No saved lessons yet
              </Text>
              <Text style={[styles.emptyBody, { color: theme.foreground }]}>
                Record a whiteboard lesson from the Utilities menu and tap Save to keep it here for
                60 FPS replay or sharing.
              </Text>
            </View>
          ) : (
            <FlatList
              data={lessons}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              removeClippedSubviews
              initialNumToRender={8}
              maxToRenderPerBatch={8}
              windowSize={5}
            />
          )}
        </View>
      </View>
    </Modal>
  );
});
