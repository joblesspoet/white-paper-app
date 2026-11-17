import { memo } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import {
  BOARD_STYLE_OPTIONS,
  type BoardBackground,
  type BoardOrientation,
  type BoardStyle,
} from '../../persistence/schema';
import { useMonetization } from '../../monetization/monetization-context';
import { colors, spacing, type ThemeColors } from '../../theme';
import { AppButton } from '../AppButton';
import { ProBadge } from '../monetization/ProBadge';
import { customizeBoardModalStyles as styles } from './CustomizeBoardModal.styles';

type CustomizeBoardModalProps = {
  visible: boolean;
  centered: boolean;
  maxWidth: number;
  bottomInset: number;
  theme: ThemeColors;
  reducedMotion: boolean;
  canvasBackground: BoardBackground;
  canvasStyle: BoardStyle;
  orientation: BoardOrientation;
  onSelectBackground: (value: BoardBackground) => void;
  onSelectStyle: (value: BoardStyle) => void;
  onSelectOrientation: (value: BoardOrientation) => void;
  onCreate: () => void;
  onClose: () => void;
};

const Choice = memo(function Choice({
  label,
  active,
  swatchColor,
  badge,
  onPress,
  theme,
}: {
  label: string;
  active: boolean;
  swatchColor?: string;
  badge?: string;
  onPress: () => void;
  theme: ThemeColors;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        styles.choice,
        {
          borderColor: active ? theme.primary : theme.border,
          backgroundColor: active ? theme.muted : theme.surface,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        },
      ]}
    >
      {swatchColor !== undefined && (
        <View
          style={[
            styles.swatch,
            { backgroundColor: swatchColor, borderColor: theme.border },
          ]}
        />
      )}
      <Text style={[styles.choiceText, { color: theme.foreground }]}>{label}</Text>
      {badge && <ProBadge label={badge} variant="pro" theme={theme} compact />}
    </Pressable>
  );
});

export const CustomizeBoardModal = memo(function CustomizeBoardModal({
  visible,
  centered,
  maxWidth,
  bottomInset,
  theme,
  reducedMotion,
  canvasBackground,
  canvasStyle,
  orientation,
  onSelectBackground,
  onSelectStyle,
  onSelectOrientation,
  onCreate,
  onClose,
}: CustomizeBoardModalProps) {
  const { canUseStyle, promptGatedFeature } = useMonetization();

  return (
    <Modal
      transparent
      visible={visible}
      animationType={reducedMotion ? 'none' : centered ? 'fade' : 'slide'}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        style={[styles.scrim, centered && styles.scrimCentered]}
        onPress={onClose}
      >
        <Pressable
          style={[
            styles.sheet,
            centered
              ? [styles.sheetModal, { maxWidth, borderColor: theme.border }]
              : { paddingBottom: bottomInset + spacing.md, borderColor: theme.border },
            { backgroundColor: theme.surface },
          ]}
          onPress={() => undefined}
        >
          {!centered && <View style={[styles.grabber, { backgroundColor: theme.border }]} />}
          <Text style={[styles.title, { color: theme.foreground }]}>Customize your board</Text>
          <Text style={[styles.body, { color: theme.foreground }]}>
            Choose a canvas style before you start.
          </Text>

          <Text style={[styles.label, { color: theme.primary }]}>CANVAS BACKGROUND</Text>
          <View style={styles.choiceRow}>
            <Choice
              label="Light"
              swatchColor={colors.background}
              active={canvasBackground === 'light'}
              onPress={() => onSelectBackground('light')}
              theme={theme}
            />
            <Choice
              label="White"
              swatchColor={colors.onPrimary}
              active={canvasBackground === 'white'}
              onPress={() => onSelectBackground('white')}
              theme={theme}
            />
            <Choice
              label="Dark"
              swatchColor={colors.darkBackground}
              active={canvasBackground === 'dark'}
              onPress={() => onSelectBackground('dark')}
              theme={theme}
            />
          </View>

          <Text style={[styles.label, { color: theme.primary }]}>CANVAS SURFACE</Text>
          <View style={[styles.choiceRow, styles.choiceWrap]}>
            {BOARD_STYLE_OPTIONS.map((opt) => {
              const locked = !canUseStyle(opt.key);
              return (
                <Choice
                  key={opt.key}
                  label={opt.shortLabel}
                  badge={locked ? 'PRO' : undefined}
                  active={canvasStyle === opt.key}
                  onPress={() => {
                    if (locked) {
                      promptGatedFeature('board_styles', () => onSelectStyle(opt.key));
                      return;
                    }
                    onSelectStyle(opt.key);
                  }}
                  theme={theme}
                />
              );
            })}
          </View>

          <Text style={[styles.label, { color: theme.primary }]}>STARTING FRAME</Text>
          <View style={styles.choiceRow}>
            <Choice
              label="Portrait"
              active={orientation === 'portrait'}
              onPress={() => onSelectOrientation('portrait')}
              theme={theme}
            />
            <Choice
              label="Landscape"
              active={orientation === 'landscape'}
              onPress={() => onSelectOrientation('landscape')}
              theme={theme}
            />
          </View>

          <AppButton label="Create board" onPress={onCreate} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel customization"
            onPress={onClose}
            style={styles.cancel}
          >
            <Text style={[styles.cancelText, { color: theme.primary }]}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
});
