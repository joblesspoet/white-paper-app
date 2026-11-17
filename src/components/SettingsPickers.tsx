import { memo, type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { CANVAS_COLORS } from '../canvas/document';
import { INK_WIDTHS } from '../canvas/ink';
import {
  BOARD_STYLE_OPTIONS,
  type DefaultCanvasBackground,
  type DefaultCanvasStyle,
  type DefaultExportFormat,
} from '../persistence/schema';
import { resolveFlowModalLayout } from '../responsive/layout';
import { useMonetization } from '../monetization/monetization-context';
import { colors, spacing, type ThemeColors } from '../theme';
import { CheckIcon } from './icons';
import { ProBadge } from './monetization/ProBadge';
import { settingsPickersStyles as styles } from './SettingsPickers.styles';

type BaseModalProps = {
  visible: boolean;
  theme: ThemeColors;
  isDark: boolean;
  reducedMotion?: boolean;
  onClose: () => void;
};

const SettingsDialogFrame = memo(function SettingsDialogFrame({
  visible,
  theme,
  title,
  subtitle,
  actionLabel = 'Close',
  reducedMotion = false,
  onClose,
  children,
}: {
  visible: boolean;
  theme: ThemeColors;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  reducedMotion?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const { width, height } = useWindowDimensions();
  const { centeredModal, modalMaxWidth } = resolveFlowModalLayout(width, height);
  const maxWidth = centeredModal ? modalMaxWidth : width - spacing.lg * 2;

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reducedMotion ? 'none' : 'fade'}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.dialog,
            { backgroundColor: theme.surface, borderColor: theme.border, maxWidth },
          ]}
        >
          <Text style={[styles.modalTitle, { color: theme.foreground }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.versionBadge, { color: theme.primary }]}>{subtitle}</Text>
          ) : null}
          {children}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            style={[styles.doneButton, { backgroundColor: theme.primary }]}
            onPress={onClose}
          >
            <Text style={[styles.doneButtonText, { color: colors.onPrimary }]}>{actionLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
});

// ----------------------------------------------------------------- Canvas Picker

type CanvasPickerProps = BaseModalProps & {
  background: DefaultCanvasBackground;
  style: DefaultCanvasStyle;
  onSelect: (bg: DefaultCanvasBackground, style: DefaultCanvasStyle) => void;
};

const BG_OPTIONS: ReadonlyArray<{
  key: DefaultCanvasBackground;
  label: string;
  desc: string;
}> = [
  { key: 'light', label: 'Light canvas', desc: 'Soft mint paper background (#F0FDFA)' },
  { key: 'white', label: 'White canvas', desc: 'Pure white paper background (#FFFFFF)' },
  { key: 'dark', label: 'Dark canvas', desc: 'Deep teal contrast background (#0B2B28)' },
];

export const CanvasPickerModal = memo(function CanvasPickerModal({
  visible,
  theme,
  reducedMotion,
  background,
  style,
  onClose,
  onSelect,
}: CanvasPickerProps) {
  const { canUseStyle, promptGatedFeature } = useMonetization();

  return (
    <SettingsDialogFrame
      visible={visible}
      theme={theme}
      title="Default Canvas"
      actionLabel="Done"
      reducedMotion={reducedMotion}
      onClose={onClose}
    >
      <Text style={[styles.sectionSubtitle, { color: theme.primary }]}>SURFACE BACKGROUND</Text>
      <View
        style={[
          styles.optionGroup,
          { borderColor: theme.border, backgroundColor: theme.background },
        ]}
      >
        {BG_OPTIONS.map((opt, i) => {
          const active = background === opt.key;
          return (
            <Pressable
              key={opt.key}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${opt.label}, ${opt.desc}`}
              style={[
                styles.optionRow,
                i > 0 && { borderTopWidth: 1, borderTopColor: theme.border },
              ]}
              onPress={() => onSelect(opt.key, style)}
            >
              <View style={styles.optionText}>
                <Text style={[styles.optionLabel, { color: theme.foreground }]}>{opt.label}</Text>
                <Text style={[styles.optionDesc, { color: theme.foreground }]}>{opt.desc}</Text>
              </View>
              {active && <CheckIcon size={20} color={theme.primary} />}
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.sectionSubtitle, { color: theme.primary }]}>CANVAS TEXTURE</Text>
      <View
        style={[
          styles.optionGroup,
          { borderColor: theme.border, backgroundColor: theme.background },
        ]}
      >
        {BOARD_STYLE_OPTIONS.map((opt, i) => {
          const active = style === opt.key;
          const locked = !canUseStyle(opt.key);
          return (
            <Pressable
              key={opt.key}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${opt.label}, ${opt.description}`}
              style={[
                styles.optionRow,
                i > 0 && { borderTopWidth: 1, borderTopColor: theme.border },
              ]}
              onPress={() => {
                if (locked) {
                  onClose();
                  promptGatedFeature('board_styles', () => onSelect(background, opt.key));
                  return;
                }
                onSelect(background, opt.key);
              }}
            >
              <View style={styles.optionText}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.optionLabel, { color: theme.foreground }]}>{opt.label}</Text>
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
    </SettingsDialogFrame>
  );
});

// ----------------------------------------------------------------- Pen Color Picker

type PenColorPickerProps = BaseModalProps & {
  color: string;
  onSelect: (color: string) => void;
};

export const PenColorPickerModal = memo(function PenColorPickerModal({
  visible,
  theme,
  isDark,
  reducedMotion,
  color,
  onClose,
  onSelect,
}: PenColorPickerProps) {
  return (
    <SettingsDialogFrame
      visible={visible}
      theme={theme}
      title="Default Pen Color"
      reducedMotion={reducedMotion}
      onClose={onClose}
    >
      <Text style={[styles.optionDesc, { color: theme.foreground, marginBottom: spacing.xs }]}>
        Choose the default ink pigment applied when opening a board.
      </Text>

      <ScrollView style={styles.colorScroll} showsVerticalScrollIndicator={false}>
        <View
          style={[
            styles.optionGroup,
            { borderColor: theme.border, backgroundColor: theme.background },
          ]}
        >
          {CANVAS_COLORS.map((item, i) => {
            const hex = isDark ? item.dark : item.light;
            const active = color === item.key || color.toLowerCase() === hex.toLowerCase();
            return (
              <Pressable
                key={item.key}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${item.name} color`}
                style={[
                  styles.optionRow,
                  i > 0 && { borderTopWidth: 1, borderTopColor: theme.border },
                ]}
                onPress={() => {
                  onSelect(item.key);
                  onClose();
                }}
              >
                <View style={styles.colorRowLeft}>
                  <View style={[styles.colorDot, { backgroundColor: hex }]} />
                  <Text style={[styles.optionLabel, { color: theme.foreground }]}>{item.name}</Text>
                </View>
                {active && <CheckIcon size={20} color={theme.primary} />}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SettingsDialogFrame>
  );
});

// ----------------------------------------------------------------- Pen Width Picker

type PenWidthPickerProps = BaseModalProps & {
  widthValue: number;
  onSelect: (width: number) => void;
};

const WIDTH_LABELS: Record<number, { name: string; desc: string }> = {
  2: { name: '2px (Fine)', desc: 'Detailed ink and notes' },
  4: { name: '4px (Medium)', desc: 'Standard writing stroke' },
  8: { name: '8px (Bold)', desc: 'Emphasis and headings' },
  12: { name: '12px (Heavy)', desc: 'Broad markers and callouts' },
};

export const PenWidthPickerModal = memo(function PenWidthPickerModal({
  visible,
  theme,
  reducedMotion,
  widthValue,
  onClose,
  onSelect,
}: PenWidthPickerProps) {
  return (
    <SettingsDialogFrame
      visible={visible}
      theme={theme}
      title="Default Pen Width"
      reducedMotion={reducedMotion}
      onClose={onClose}
    >
      <Text style={[styles.optionDesc, { color: theme.foreground, marginBottom: spacing.xs }]}>
        Vector stroke weight for new ink strokes.
      </Text>

      <View
        style={[
          styles.optionGroup,
          { borderColor: theme.border, backgroundColor: theme.background },
        ]}
      >
        {INK_WIDTHS.map((w, i) => {
          const active = widthValue === w;
          const meta = WIDTH_LABELS[w] ?? { name: `${w}px`, desc: '' };
          return (
            <Pressable
              key={w}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={meta.name}
              style={[
                styles.optionRow,
                i > 0 && { borderTopWidth: 1, borderTopColor: theme.border },
              ]}
              onPress={() => {
                onSelect(w);
                onClose();
              }}
            >
              <View style={styles.optionText}>
                <Text style={[styles.optionLabel, { color: theme.foreground }]}>{meta.name}</Text>
                <View style={styles.widthPreviewRow}>
                  <View
                    style={[styles.strokePreview, { height: w, backgroundColor: theme.foreground }]}
                  />
                </View>
              </View>
              {active && <CheckIcon size={20} color={theme.primary} />}
            </Pressable>
          );
        })}
      </View>
    </SettingsDialogFrame>
  );
});

// ----------------------------------------------------------------- Export Format Picker

type ExportFormatPickerProps = BaseModalProps & {
  format: DefaultExportFormat;
  onSelect: (format: DefaultExportFormat) => void;
};

const FORMAT_OPTIONS: ReadonlyArray<{
  key: DefaultExportFormat;
  label: string;
  desc: string;
}> = [
  { key: 'png', label: 'Lossless PNG', desc: 'Highest fidelity raster image snapshot' },
  { key: 'jpeg', label: 'Compressed JPEG', desc: 'Smaller file size for quick sharing' },
  { key: 'pdf', label: 'PDF Document', desc: 'Single-page vector/raster PDF document' },
  { key: 'backup', label: 'FlowCanvas Backup', desc: 'Editable .flowcanvas.json with media' },
];

export const ExportFormatPickerModal = memo(function ExportFormatPickerModal({
  visible,
  theme,
  reducedMotion,
  format,
  onClose,
  onSelect,
}: ExportFormatPickerProps) {
  return (
    <SettingsDialogFrame
      visible={visible}
      theme={theme}
      title="Default Export Format"
      reducedMotion={reducedMotion}
      onClose={onClose}
    >
      <Text style={[styles.optionDesc, { color: theme.foreground, marginBottom: spacing.xs }]}>
        Pre-selected format when opening the board export sheet.
      </Text>

      <View
        style={[
          styles.optionGroup,
          { borderColor: theme.border, backgroundColor: theme.background },
        ]}
      >
        {FORMAT_OPTIONS.map((opt, i) => {
          const active = format === opt.key;
          return (
            <Pressable
              key={opt.key}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${opt.label}, ${opt.desc}`}
              style={[
                styles.optionRow,
                i > 0 && { borderTopWidth: 1, borderTopColor: theme.border },
              ]}
              onPress={() => {
                onSelect(opt.key);
                onClose();
              }}
            >
              <View style={styles.optionText}>
                <Text style={[styles.optionLabel, { color: theme.foreground }]}>{opt.label}</Text>
                <Text style={[styles.optionDesc, { color: theme.foreground }]}>{opt.desc}</Text>
              </View>
              {active && <CheckIcon size={20} color={theme.primary} />}
            </Pressable>
          );
        })}
      </View>
    </SettingsDialogFrame>
  );
});

// ----------------------------------------------------------------- About & Privacy Modals

export const AboutModal = memo(function AboutModal({
  visible,
  theme,
  reducedMotion,
  onClose,
}: BaseModalProps) {
  return (
    <SettingsDialogFrame
      visible={visible}
      theme={theme}
      title="About FlowCanvas"
      subtitle="Version 1.0.0 (Local-only MVP)"
      reducedMotion={reducedMotion}
      onClose={onClose}
    >
      <ScrollView style={styles.bodyScroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.bodyText, { color: theme.foreground }]}>
          FlowCanvas is a fast, offline-first digital whiteboard engineered for phones and tablets.
          {'\n\n'}
          Key capabilities:
          {'\n'}• 60 FPS Skia canvas with smooth multi-point ink and erasing
          {'\n'}• Rich canvas objects: sticky notes, text blocks, shapes, and connectors
          {'\n'}• Aspect-locked image import, cropping, and on-device OCR
          {'\n'}• Lossless PNG, JPEG, PDF export, and versioned backups
          {'\n'}• Local SQLite durability with automatic write serialization
          {'\n\n'}
          Built without cloud dependencies or user accounts. Everything stays on your hardware.
        </Text>
      </ScrollView>
    </SettingsDialogFrame>
  );
});

export const PrivacyModal = memo(function PrivacyModal({
  visible,
  theme,
  reducedMotion,
  onClose,
}: BaseModalProps) {
  return (
    <SettingsDialogFrame
      visible={visible}
      theme={theme}
      title="Privacy Policy"
      subtitle="100% on-device · Zero telemetry"
      reducedMotion={reducedMotion}
      onClose={onClose}
    >
      <ScrollView style={styles.bodyScroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.bodyText, { color: theme.foreground }]}>
          Your privacy is fundamental to the design of FlowCanvas:
          {'\n\n'}
          1. Zero Network Transmission:
          FlowCanvas does not send your boards, text, images, or strokes to any server. There is no
          remote API or background synchronization.
          {'\n\n'}
          2. On-Device OCR:
          Image text recognition runs offline on your processor using Apple Vision (iOS) or ML Kit
          (Android). No images leave your device.
          {'\n\n'}
          3. No Analytics or Tracking:
          There are no advertising SDKs, session recording trackers, or crash telemetry libraries
          embedded in this application.
          {'\n\n'}
          4. Complete User Control:
          You can export portable backups or permanently purge all local data anytime from Settings.
        </Text>
      </ScrollView>
    </SettingsDialogFrame>
  );
});
