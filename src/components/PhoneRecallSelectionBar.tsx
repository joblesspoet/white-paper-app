import { memo, useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { CanvasObject } from '../canvas/document';
import type { ThemeColors } from '../theme';
import { phoneRecallSelectionBarStyles as styles } from './PhoneRecallSelectionBar.styles';

export type PhoneRecallSelectionBarProps = {
  theme: ThemeColors;
  bottomOffset: number;
  selectedObjects: readonly CanvasObject[];
  canCoverWithTape: boolean;
  playingPinId: string | null;
  onCoverWithTape: () => void;
  onToggleRevealTape: (id: string) => void;
  onTogglePlayVoicePin: (id: string) => void;
  onTogglePrivate: () => void;
};

const HIT_SLOP = { top: 4, bottom: 4, left: 2, right: 2 } as const;

export const PhoneRecallSelectionBar = memo(function PhoneRecallSelectionBar({
  theme,
  bottomOffset,
  selectedObjects,
  canCoverWithTape,
  playingPinId,
  onCoverWithTape,
  onToggleRevealTape,
  onTogglePlayVoicePin,
  onTogglePrivate,
}: PhoneRecallSelectionBarProps) {
  const single = selectedObjects.length === 1 ? selectedObjects[0] : null;
  const isAllPrivate =
    selectedObjects.length > 0 && selectedObjects.every((o) => o.isPrivate === true);

  const handleToggleTape = useCallback(() => {
    if (single?.type === 'reveal-tape') onToggleRevealTape(single.id);
  }, [onToggleRevealTape, single]);

  const handleToggleVoice = useCallback(() => {
    if (single?.type === 'voice-pin') onTogglePlayVoicePin(single.id);
  }, [onTogglePlayVoicePin, single]);

  if (selectedObjects.length === 0) return null;

  return (
    <View pointerEvents="box-none" style={[styles.wrapper, { bottom: bottomOffset }]}>
      <View
        style={[
          styles.compactCard,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        {canCoverWithTape && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cover with tape"
            hitSlop={HIT_SLOP}
            onPress={onCoverWithTape}
            style={({ pressed }) => [
              styles.chip,
              { borderColor: theme.border, backgroundColor: theme.background },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.chipText, { color: theme.foreground }]}>Cover with tape</Text>
          </Pressable>
        )}

        {single?.type === 'reveal-tape' && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={single.isRevealed ? 'Hide reveal tape' : 'Reveal answer'}
            hitSlop={HIT_SLOP}
            onPress={handleToggleTape}
            style={({ pressed }) => [
              styles.chip,
              { borderColor: theme.primary, backgroundColor: theme.muted },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.chipText, { color: theme.primary }]}>
              {single.isRevealed ? 'Hide tape' : 'Reveal answer'}
            </Text>
          </Pressable>
        )}

        {single?.type === 'voice-pin' && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={playingPinId === single.id ? 'Pause voice pin' : 'Play voice pin'}
            hitSlop={HIT_SLOP}
            onPress={handleToggleVoice}
            style={({ pressed }) => [
              styles.chip,
              { borderColor: theme.primary, backgroundColor: theme.muted },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.chipText, { color: theme.primary }]}>
              {playingPinId === single.id ? 'Stop audio' : 'Play audio'}
            </Text>
          </Pressable>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Presenter-only (Private)"
          accessibilityState={{ selected: isAllPrivate }}
          hitSlop={HIT_SLOP}
          onPress={onTogglePrivate}
          style={({ pressed }) => [
            styles.chip,
            {
              borderColor: isAllPrivate ? theme.primary : theme.border,
              backgroundColor: isAllPrivate ? theme.muted : theme.background,
            },
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.chipText,
              { color: isAllPrivate ? theme.primary : theme.foreground },
            ]}
          >
            {isAllPrivate ? 'Private ✓' : 'Presenter-only'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
});
