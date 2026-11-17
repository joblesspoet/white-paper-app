import { memo } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import {
  BOARD_STYLE_OPTIONS,
  DEFAULT_BOARD_SETTINGS,
  type BoardBackground,
  type BoardSettings,
  type BoardStyle,
} from '../../persistence/schema';
import { useMonetization } from '../../monetization/monetization-context';
import type { ThemeColors } from '../../theme';
import { CheckIcon } from '../icons';
import { ProBadge } from '../monetization/ProBadge';
import { boardStyleModalStyles as styles } from './BoardStyleModal.styles';

type BoardStyleModalProps = {
  visible: boolean;
  settings: BoardSettings;
  theme: ThemeColors;
  reducedMotion?: boolean;
  onChangeSettings: (next: BoardSettings) => void;
  onClose: () => void;
};

export const BoardStyleModal = memo(function BoardStyleModal({
  visible,
  settings,
  theme,
  reducedMotion = false,
  onChangeSettings,
  onClose,
}: BoardStyleModalProps) {
  const currentBg = settings.background ?? DEFAULT_BOARD_SETTINGS.background;
  const currentStyle = settings.style ?? DEFAULT_BOARD_SETTINGS.style;
  const { canUseStyle, promptGatedFeature } = useMonetization();

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reducedMotion ? 'none' : 'fade'}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
          onPress={() => undefined}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.foreground }]}>Board background</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close board background options"
              onPress={onClose}
              hitSlop={8}
            >
              <Text style={[styles.done, { color: theme.primary }]}>Done</Text>
            </Pressable>
          </View>

          <View style={styles.bgColorRow}>
            {(['light', 'white', 'dark'] as const).map((bg) => {
              const active = currentBg === bg;
              const label = bg === 'white' ? 'White' : bg === 'dark' ? 'Dark' : 'Light';
              return (
                <Pressable
                  key={bg}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${label} canvas color`}
                  onPress={() =>
                    onChangeSettings({ ...settings, background: bg as BoardBackground })
                  }
                  style={[
                    styles.bgColorChip,
                    {
                      borderColor: active ? theme.primary : theme.border,
                      backgroundColor: active ? `${theme.primary}16` : theme.background,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.bgColorChipText,
                      { color: active ? theme.primary : theme.foreground },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View
            style={[
              styles.optionList,
              { borderColor: theme.border, backgroundColor: theme.background },
            ]}
          >
            {BOARD_STYLE_OPTIONS.map((opt, idx) => {
              const active = currentStyle === opt.key;
              const locked = !canUseStyle(opt.key as BoardStyle);
              return (
                <Pressable
                  key={opt.key}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${opt.label}, ${opt.description}`}
                  onPress={() => {
                    if (locked) {
                      onClose();
                      promptGatedFeature('board_styles', () => {
                        onChangeSettings({ ...settings, style: opt.key as BoardStyle });
                      });
                      return;
                    }
                    onChangeSettings({ ...settings, style: opt.key as BoardStyle });
                    onClose();
                  }}
                  style={[
                    styles.optionRow,
                    idx > 0 && { borderTopWidth: 1, borderTopColor: theme.border },
                    active && { backgroundColor: `${theme.primary}16` },
                  ]}
                >
                  <View style={styles.optionText}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text
                        style={[
                          styles.optionLabel,
                          { color: active ? theme.primary : theme.foreground },
                        ]}
                      >
                        {opt.label}
                      </Text>
                      {locked && <ProBadge label="PRO" variant="pro" theme={theme} compact />}
                    </View>
                    <Text style={[styles.optionDesc, { color: theme.foreground }]}>
                      {opt.description}
                    </Text>
                  </View>
                  {active && <CheckIcon size={20} color={theme.primary} />}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
});
