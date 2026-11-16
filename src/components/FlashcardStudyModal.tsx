import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  Text,
  useWindowDimensions,
  View,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { stickyColorValue, type CanvasDocument } from '../canvas/document';
import { extractFlashcardsFromDocument, type FlashcardItem } from '../canvas/flashcards';
import type { ThemeColors } from '../theme';
import { flashcardStudyModalStyles as styles } from './FlashcardStudyModal.styles';

export type FlashcardStudyModalProps = {
  visible: boolean;
  document: CanvasDocument;
  theme: ThemeColors;
  onClose: () => void;
};

export const FlashcardStudyModal = memo(function FlashcardStudyModal({
  visible,
  document,
  theme,
  onClose,
}: FlashcardStudyModalProps) {
  const { width: windowWidth } = useWindowDimensions();
  const cardContainerWidth = Math.min(480, Math.max(280, windowWidth - 32));
  const listRef = useRef<FlatList<FlashcardItem>>(null);

  const cards = useMemo(
    () => (visible ? extractFlashcardsFromDocument(document) : []),
    [document, visible],
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [flippedIds, setFlippedIds] = useState<Record<string, boolean>>({});
  const [knownCount, setKnownCount] = useState(0);
  const [reviewQueue, setReviewQueue] = useState<string[]>([]);

  useEffect(() => {
    if (!visible) return;
    setCurrentIndex(0);
    setFlippedIds({});
    setKnownCount(0);
    setReviewQueue([]);
  }, [visible]);

  const handleToggleFlip = useCallback((id: string) => {
    setFlippedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const advanceCard = useCallback(() => {
    if (currentIndex + 1 < cards.length) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      listRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    }
  }, [cards.length, currentIndex]);

  const handleKnowIt = useCallback(() => {
    setKnownCount((c) => c + 1);
    advanceCard();
  }, [advanceCard]);

  const handleReviewAgain = useCallback(() => {
    const current = cards[currentIndex];
    if (current) {
      setReviewQueue((prev) => (prev.includes(current.id) ? prev : [...prev, current.id]));
    }
    advanceCard();
  }, [advanceCard, cards, currentIndex]);

  const handleMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (cardContainerWidth <= 0) return;
      const next = Math.round(event.nativeEvent.contentOffset.x / cardContainerWidth);
      if (next >= 0 && next < cards.length) {
        setCurrentIndex(next);
      }
    },
    [cardContainerWidth, cards.length],
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<FlashcardItem> | null | undefined, index: number) => ({
      length: cardContainerWidth,
      offset: cardContainerWidth * index,
      index,
    }),
    [cardContainerWidth],
  );

  const keyExtractor = useCallback((item: FlashcardItem) => item.id, []);

  const renderCard = useCallback(
    ({ item }: ListRenderItemInfo<FlashcardItem>) => {
      const isFlipped = Boolean(flippedIds[item.id]);
      const cardTint = stickyColorValue(item.colorKey);
      return (
        <View style={[styles.cardSlide, { width: cardContainerWidth }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isFlipped ? 'Showing answer. Tap to view prompt' : 'Showing prompt. Tap to reveal answer'}
            onPress={() => handleToggleFlip(item.id)}
            style={({ pressed }) => [
              styles.flashcard,
              {
                borderColor: isFlipped ? theme.primary : theme.border,
                backgroundColor: isFlipped ? theme.muted : cardTint,
              },
              pressed && styles.pressed,
            ]}
          >
            <View
              style={[
                styles.badge,
                { backgroundColor: isFlipped ? theme.primary : '#134E4A1A' },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  { color: isFlipped ? '#FFFFFF' : '#134E4A' },
                ]}
              >
                {isFlipped
                  ? 'Answer'
                  : item.source === 'reveal-tape'
                    ? 'Reveal Tape'
                    : 'Connected Note'}
              </Text>
            </View>
            <Text
              style={[
                styles.cardBody,
                { color: isFlipped ? theme.foreground : '#134E4A' },
              ]}
            >
              {isFlipped ? item.answer : item.prompt}
            </Text>
            <Text
              style={[
                styles.tapHint,
                { color: isFlipped ? theme.foreground : '#134E4A' },
              ]}
            >
              Tap card to flip
            </Text>
          </Pressable>
        </View>
      );
    },
    [cardContainerWidth, flippedIds, handleToggleFlip, theme],
  );

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable
          style={[
            styles.container,
            {
              width: cardContainerWidth,
              backgroundColor: theme.surface,
              borderColor: theme.border,
            },
          ]}
          onPress={() => undefined}
        >
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: theme.foreground }]}>Study Flashcards</Text>
              {cards.length > 0 && (
                <Text style={[styles.progressText, { color: theme.foreground }]}>
                  Card {Math.min(currentIndex + 1, cards.length)} of {cards.length} · Know {knownCount} · Review {reviewQueue.length}
                </Text>
              )}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close flashcards"
              onPress={onClose}
              style={styles.closeButton}
            >
              <Text style={[styles.closeText, { color: theme.primary }]}>Done</Text>
            </Pressable>
          </View>

          {cards.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={[styles.emptyText, { color: theme.foreground }]}>
                No study cards found on this page yet.{'\n\n'}To generate flashcards:{'\n'}• Cover a Text block, Math formula, or Sticky Note with Reveal Tape, OR{'\n'}• Connect two Sticky Notes with a magnetic arrow.
              </Text>
            </View>
          ) : (
            <>
              <FlatList
                ref={listRef}
                data={cards}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={keyExtractor}
                renderItem={renderCard}
                getItemLayout={getItemLayout}
                onMomentumScrollEnd={handleMomentumEnd}
                style={styles.deckList}
              />
              <View style={styles.actionsRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Mark card to review again"
                  onPress={handleReviewAgain}
                  style={({ pressed }) => [
                    styles.reviewBtn,
                    { borderColor: theme.border, backgroundColor: theme.background },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.actionLabel, { color: theme.foreground }]}>
                    Review again
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Mark card as known"
                  onPress={handleKnowIt}
                  style={({ pressed }) => [
                    styles.knowBtn,
                    { backgroundColor: theme.primary },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.actionLabel, { color: '#FFFFFF' }]}>Know it</Text>
                </Pressable>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
});
