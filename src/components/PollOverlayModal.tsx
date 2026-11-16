import { memo, useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
  type ListRenderItemInfo,
} from 'react-native';

import {
  computePollSummary,
  defaultPollOptions,
  type ClassroomPoll,
  type PollKind,
  type PollOptionSummary,
} from '../classroom/poll-model';
import type { ClassroomRole } from '../classroom/protocol';
import type { ThemeColors } from '../theme';
import { pollOverlayModalStyles as styles } from './PollOverlayModal.styles';

export type PollOverlayModalProps = {
  visible: boolean;
  role: ClassroomRole;
  peerId: string;
  activePoll: ClassroomPoll | null;
  theme: ThemeColors;
  onStartPoll: (params: {
    kind: PollKind;
    question: string;
    correctOptionId?: string;
  }) => void;
  onVote: (pollId: string, optionId: string) => void;
  onClosePoll: (pollId: string) => void;
  onInsertChartOnBoard: (poll: ClassroomPoll) => void;
  onClearPoll: () => void;
  onDismiss: () => void;
};

export const PollOverlayModal = memo(function PollOverlayModal({
  visible,
  role,
  peerId,
  activePoll,
  theme,
  onStartPoll,
  onVote,
  onClosePoll,
  onInsertChartOnBoard,
  onClearPoll,
  onDismiss,
}: PollOverlayModalProps) {
  const [kind, setKind] = useState<PollKind>('abcd');
  const [question, setQuestion] = useState('');
  const [correctOptionId, setCorrectOptionId] = useState<string | undefined>(undefined);

  const draftOptions = useMemo(() => defaultPollOptions(kind), [kind]);
  const summary = useMemo(
    () => (activePoll ? computePollSummary(activePoll) : null),
    [activePoll],
  );
  const myVoteOptionId = activePoll?.votesByPeerId[peerId] ?? null;

  const handleSelectAbcd = useCallback(() => {
    setKind('abcd');
    setCorrectOptionId(undefined);
  }, []);

  const handleSelectTrueFalse = useCallback(() => {
    setKind('true-false');
    setCorrectOptionId(undefined);
  }, []);

  const handleLaunch = useCallback(() => {
    onStartPoll({
      kind,
      question: question.trim() || 'Quick Poll',
      correctOptionId,
    });
    setQuestion('');
    setCorrectOptionId(undefined);
  }, [correctOptionId, kind, onStartPoll, question]);

  const handleVoteOption = useCallback(
    (optionId: string) => {
      if (!activePoll || activePoll.status !== 'open') return;
      onVote(activePoll.id, optionId);
    },
    [activePoll, onVote],
  );

  const handleCloseActivePoll = useCallback(() => {
    if (!activePoll) return;
    onClosePoll(activePoll.id);
  }, [activePoll, onClosePoll]);

  const handleInsertChart = useCallback(() => {
    if (!activePoll) return;
    onInsertChartOnBoard(activePoll);
    onDismiss();
  }, [activePoll, onDismiss, onInsertChartOnBoard]);

  const renderOption = useCallback(
    ({ item }: ListRenderItemInfo<PollOptionSummary>) => {
      const selected = myVoteOptionId === item.id;
      const canVote =
        role === 'student' && activePoll?.status === 'open' && myVoteOptionId === null;
      const showCounts = role === 'teacher' || activePoll?.status === 'closed' || myVoteOptionId !== null;

      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Option ${item.label}`}
          accessibilityState={{ selected }}
          disabled={!canVote}
          onPress={() => handleVoteOption(item.id)}
          style={({ pressed }) => [
            styles.optionRow,
            {
              borderColor: selected || item.isCorrect ? theme.primary : theme.border,
              backgroundColor: selected ? theme.muted : theme.background,
            },
            pressed && canVote && styles.pressed,
          ]}
        >
          <View style={styles.optionTop}>
            <Text style={[styles.optionLabel, { color: theme.foreground }]}>
              {item.label}
              {item.isCorrect && (role === 'teacher' || activePoll?.status === 'closed') ? ' ✓' : ''}
            </Text>
            {showCounts && (
              <Text style={[styles.optionMeta, { color: theme.foreground }]}>
                {item.count} ({item.percentage}%)
              </Text>
            )}
          </View>
          {showCounts && (
            <View style={[styles.barTrack, { backgroundColor: theme.border }]}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${item.percentage}%`,
                    backgroundColor: item.isCorrect ? theme.primary : theme.accent,
                  },
                ]}
              />
            </View>
          )}
        </Pressable>
      );
    },
    [activePoll?.status, handleVoteOption, myVoteOptionId, role, theme],
  );

  const keyExtractor = useCallback((item: PollOptionSummary) => item.id, []);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.scrim} onPress={onDismiss}>
        <Pressable
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
          onPress={() => undefined}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.foreground }]}>
              {activePoll ? activePoll.question : 'Start Quick Poll'}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close poll dialog"
              onPress={onDismiss}
              style={styles.closeButton}
            >
              <Text style={[styles.closeText, { color: theme.primary }]}>Close</Text>
            </Pressable>
          </View>

          {!activePoll && role === 'teacher' && (
            <>
              <View style={styles.row}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: kind === 'abcd' }}
                  onPress={handleSelectAbcd}
                  style={[
                    styles.chip,
                    {
                      borderColor: kind === 'abcd' ? theme.primary : theme.border,
                      backgroundColor: kind === 'abcd' ? theme.muted : theme.background,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: theme.foreground }]}>A / B / C / D</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: kind === 'true-false' }}
                  onPress={handleSelectTrueFalse}
                  style={[
                    styles.chip,
                    {
                      borderColor: kind === 'true-false' ? theme.primary : theme.border,
                      backgroundColor: kind === 'true-false' ? theme.muted : theme.background,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: theme.foreground }]}>True / False</Text>
                </Pressable>
              </View>

              <TextInput
                value={question}
                onChangeText={setQuestion}
                placeholder="Optional prompt (e.g., Which derivative is correct?)"
                placeholderTextColor={theme.foreground + '70'}
                style={[
                  styles.input,
                  {
                    color: theme.foreground,
                    borderColor: theme.border,
                    backgroundColor: theme.background,
                  },
                ]}
              />

              <Text style={[styles.label, { color: theme.foreground }]}>
                Optional answer key
              </Text>
              <View style={styles.row}>
                {draftOptions.map((opt) => {
                  const selected = correctOptionId === opt.id;
                  return (
                    <Pressable
                      key={opt.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() =>
                        setCorrectOptionId((prev) => (prev === opt.id ? undefined : opt.id))
                      }
                      style={[
                        styles.chip,
                        {
                          borderColor: selected ? theme.primary : theme.border,
                          backgroundColor: selected ? theme.muted : theme.background,
                        },
                      ]}
                    >
                      <Text style={[styles.chipText, { color: theme.foreground }]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Launch quick poll"
                onPress={handleLaunch}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { backgroundColor: theme.primary },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.primaryBtnText}>Start Quick Poll</Text>
              </Pressable>
            </>
          )}

          {activePoll && summary && (
            <>
              <Text style={[styles.label, { color: theme.foreground }]}>
                {activePoll.status === 'open' ? 'Live responses' : 'Final results'} ·{' '}
                {summary.totalVotes} vote{summary.totalVotes === 1 ? '' : 's'}
                {myVoteOptionId ? ` · You voted ${myVoteOptionId}` : ''}
              </Text>

              <FlatList
                data={summary.options}
                keyExtractor={keyExtractor}
                renderItem={renderOption}
                style={styles.list}
                contentContainerStyle={styles.listContent}
              />

              {role === 'teacher' && (
                <View style={styles.footer}>
                  {activePoll.status === 'open' ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Close active poll"
                      onPress={handleCloseActivePoll}
                      style={({ pressed }) => [
                        styles.secondaryBtn,
                        { borderColor: theme.border, backgroundColor: theme.background },
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={[styles.secondaryBtnText, { color: theme.foreground }]}>
                        End Poll
                      </Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Start another poll"
                      onPress={onClearPoll}
                      style={({ pressed }) => [
                        styles.secondaryBtn,
                        { borderColor: theme.border, backgroundColor: theme.background },
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={[styles.secondaryBtnText, { color: theme.foreground }]}>
                        New Poll
                      </Text>
                    </Pressable>
                  )}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Insert results chart on board"
                    onPress={handleInsertChart}
                    style={({ pressed }) => [
                      styles.primaryBtn,
                      { backgroundColor: theme.primary },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.primaryBtnText}>Insert results chart on board</Text>
                  </Pressable>
                </View>
              )}
            </>
          )}

          {!activePoll && role === 'student' && (
            <Text style={[styles.label, { color: theme.foreground }]}>
              No live poll is active right now.
            </Text>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
});
