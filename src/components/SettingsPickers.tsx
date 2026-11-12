import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { CANVAS_COLORS, type TextColorToken } from '../canvas/document';
import { INK_WIDTHS } from '../canvas/ink';
import type {
  DefaultCanvasBackground,
  DefaultCanvasStyle,
  DefaultExportFormat,
} from '../persistence/schema';
import { colors, radii, spacing, touchTarget, typography, type ThemeColors } from '../theme';
import { CheckIcon } from './icons';

type BaseModalProps = {
  visible: boolean;
  theme: ThemeColors;
  isDark: boolean;
  onClose: () => void;
};

// ----------------------------------------------------------------- Canvas Picker

type CanvasPickerProps = BaseModalProps & {
  background: DefaultCanvasBackground;
  style: DefaultCanvasStyle;
  onSelect: (bg: DefaultCanvasBackground, style: DefaultCanvasStyle) => void;
};

export function CanvasPickerModal({
  visible,
  theme,
  isDark,
  background,
  style,
  onClose,
  onSelect,
}: CanvasPickerProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const bgOptions: { key: DefaultCanvasBackground; label: string; desc: string }[] = [
    { key: 'light', label: 'Light canvas', desc: 'Soft mint paper background (#F0FDFA)' },
    { key: 'dark', label: 'Dark canvas', desc: 'Deep teal contrast background (#0B2B28)' },
  ];

  const styleOptions: { key: DefaultCanvasStyle; label: string; desc: string }[] = [
    { key: 'blank', label: 'Blank surface', desc: 'Clean unruled surface' },
    { key: 'dots', label: 'Dot Grid', desc: 'Subtle alignment grid points' },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.dialog, { backgroundColor: theme.surface, borderColor: theme.border, maxWidth: isWide ? 440 : width - spacing.lg * 2 }]}>
          <Text style={[styles.modalTitle, { color: theme.foreground }]}>Default Canvas</Text>

          <Text style={[styles.sectionSubtitle, { color: theme.primary }]}>SURFACE BACKGROUND</Text>
          <View style={[styles.optionGroup, { borderColor: theme.border, backgroundColor: theme.background }]}>
            {bgOptions.map((opt, i) => {
              const active = background === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${opt.label}, ${opt.desc}`}
                  style={[styles.optionRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}
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

          <Text style={[styles.sectionSubtitle, { color: theme.primary, marginTop: spacing.sm }]}>CANVAS TEXTURE</Text>
          <View style={[styles.optionGroup, { borderColor: theme.border, backgroundColor: theme.background }]}>
            {styleOptions.map((opt, i) => {
              const active = style === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${opt.label}, ${opt.desc}`}
                  style={[styles.optionRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}
                  onPress={() => onSelect(background, opt.key)}
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

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Done"
            style={[styles.doneButton, { backgroundColor: theme.primary }]}
            onPress={onClose}
          >
            <Text style={[styles.doneButtonText, { color: colors.onPrimary }]}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ----------------------------------------------------------------- Pen Color Picker

type PenColorPickerProps = BaseModalProps & {
  color: string;
  onSelect: (color: string) => void;
};

export function PenColorPickerModal({
  visible,
  theme,
  isDark,
  color,
  onClose,
  onSelect,
}: PenColorPickerProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.dialog, { backgroundColor: theme.surface, borderColor: theme.border, maxWidth: isWide ? 440 : width - spacing.lg * 2 }]}>
          <Text style={[styles.modalTitle, { color: theme.foreground }]}>Default Pen Color</Text>
          <Text style={[styles.optionDesc, { color: theme.foreground, marginBottom: spacing.sm }]}>
            Choose the default ink pigment applied when opening a board.
          </Text>

          <ScrollView style={{ maxHeight: 320 }}>
            <View style={[styles.optionGroup, { borderColor: theme.border, backgroundColor: theme.background }]}>
              {CANVAS_COLORS.map((item, i) => {
                const hex = isDark ? item.dark : item.light;
                const active = color === item.key || color.toLowerCase() === hex.toLowerCase();
                return (
                  <Pressable
                    key={item.key}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${item.name} color`}
                    style={[styles.optionRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}
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

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Done"
            style={[styles.doneButton, { backgroundColor: theme.primary }]}
            onPress={onClose}
          >
            <Text style={[styles.doneButtonText, { color: colors.onPrimary }]}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

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

export function PenWidthPickerModal({
  visible,
  theme,
  isDark,
  widthValue,
  onClose,
  onSelect,
}: PenWidthPickerProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.dialog, { backgroundColor: theme.surface, borderColor: theme.border, maxWidth: isWide ? 440 : width - spacing.lg * 2 }]}>
          <Text style={[styles.modalTitle, { color: theme.foreground }]}>Default Pen Width</Text>
          <Text style={[styles.optionDesc, { color: theme.foreground, marginBottom: spacing.sm }]}>
            Vector stroke weight for new ink strokes.
          </Text>

          <View style={[styles.optionGroup, { borderColor: theme.border, backgroundColor: theme.background }]}>
            {INK_WIDTHS.map((w, i) => {
              const active = widthValue === w;
              const meta = WIDTH_LABELS[w] ?? { name: `${w}px`, desc: '' };
              return (
                <Pressable
                  key={w}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={meta.name}
                  style={[styles.optionRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}
                  onPress={() => {
                    onSelect(w);
                    onClose();
                  }}
                >
                  <View style={styles.optionText}>
                    <Text style={[styles.optionLabel, { color: theme.foreground }]}>{meta.name}</Text>
                    <View style={styles.widthPreviewRow}>
                      <View style={[styles.strokePreview, { height: w, backgroundColor: theme.foreground }]} />
                    </View>
                  </View>
                  {active && <CheckIcon size={20} color={theme.primary} />}
                </Pressable>
              );
            })}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Done"
            style={[styles.doneButton, { backgroundColor: theme.primary }]}
            onPress={onClose}
          >
            <Text style={[styles.doneButtonText, { color: colors.onPrimary }]}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ----------------------------------------------------------------- Export Format Picker

type ExportFormatPickerProps = BaseModalProps & {
  format: DefaultExportFormat;
  onSelect: (format: DefaultExportFormat) => void;
};

const FORMAT_OPTIONS: { key: DefaultExportFormat; label: string; desc: string }[] = [
  { key: 'png', label: 'Lossless PNG', desc: 'Highest fidelity raster image snapshot' },
  { key: 'jpeg', label: 'Compressed JPEG', desc: 'Smaller file size for quick sharing' },
  { key: 'pdf', label: 'PDF Document', desc: 'Single-page vector/raster PDF document' },
  { key: 'backup', label: 'FlowCanvas Backup', desc: 'Editable .flowcanvas.json with media' },
];

export function ExportFormatPickerModal({
  visible,
  theme,
  format,
  onClose,
  onSelect,
}: ExportFormatPickerProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.dialog, { backgroundColor: theme.surface, borderColor: theme.border, maxWidth: isWide ? 440 : width - spacing.lg * 2 }]}>
          <Text style={[styles.modalTitle, { color: theme.foreground }]}>Default Export Format</Text>
          <Text style={[styles.optionDesc, { color: theme.foreground, marginBottom: spacing.sm }]}>
            Pre-selected format when opening the board export sheet.
          </Text>

          <View style={[styles.optionGroup, { borderColor: theme.border, backgroundColor: theme.background }]}>
            {FORMAT_OPTIONS.map((opt, i) => {
              const active = format === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${opt.label}, ${opt.desc}`}
                  style={[styles.optionRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}
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

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Done"
            style={[styles.doneButton, { backgroundColor: theme.primary }]}
            onPress={onClose}
          >
            <Text style={[styles.doneButtonText, { color: colors.onPrimary }]}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ----------------------------------------------------------------- About & Privacy Modals

export function AboutModal({ visible, theme, onClose }: BaseModalProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.dialog, { backgroundColor: theme.surface, borderColor: theme.border, maxWidth: isWide ? 440 : width - spacing.lg * 2 }]}>
          <Text style={[styles.modalTitle, { color: theme.foreground }]}>About FlowCanvas</Text>
          <Text style={[styles.versionBadge, { color: theme.primary }]}>Version 1.0.0 (Local-only MVP)</Text>

          <ScrollView style={{ maxHeight: 300 }}>
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

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close about dialog"
            style={[styles.doneButton, { backgroundColor: theme.primary }]}
            onPress={onClose}
          >
            <Text style={[styles.doneButtonText, { color: colors.onPrimary }]}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export function PrivacyModal({ visible, theme, onClose }: BaseModalProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.dialog, { backgroundColor: theme.surface, borderColor: theme.border, maxWidth: isWide ? 440 : width - spacing.lg * 2 }]}>
          <Text style={[styles.modalTitle, { color: theme.foreground }]}>Privacy Policy</Text>
          <Text style={[styles.versionBadge, { color: theme.primary }]}>100% on-device · Zero telemetry</Text>

          <ScrollView style={{ maxHeight: 300 }}>
            <Text style={[styles.bodyText, { color: theme.foreground }]}>
              Your privacy is fundamental to the design of FlowCanvas:
              {'\n\n'}
              1. Zero Network Transmission:
              FlowCanvas does not send your boards, text, images, or strokes to any server. There is no remote API or background synchronization.
              {'\n\n'}
              2. On-Device OCR:
              Image text recognition runs offline on your processor using Apple Vision (iOS) or ML Kit (Android). No images leave your device.
              {'\n\n'}
              3. No Analytics or Tracking:
              There are no advertising SDKs, session recording trackers, or crash telemetry libraries embedded in this application.
              {'\n\n'}
              4. Complete User Control:
              You can export portable backups or permanently purge all local data anytime from Settings.
            </Text>
          </ScrollView>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close privacy dialog"
            style={[styles.doneButton, { backgroundColor: theme.primary }]}
            onPress={onClose}
          >
            <Text style={[styles.doneButtonText, { color: colors.onPrimary }]}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  dialog: {
    width: '100%',
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  modalTitle: {
    ...typography.title,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: spacing.xs,
  },
  versionBadge: {
    ...typography.caption,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  bodyText: {
    ...typography.body,
    opacity: 0.9,
    lineHeight: 22,
  },
  optionGroup: {
    borderWidth: 1,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    minHeight: touchTarget,
  },
  optionText: {
    flexShrink: 1,
    gap: 2,
  },
  optionLabel: {
    ...typography.bodyStrong,
    fontSize: 15,
  },
  optionDesc: {
    ...typography.caption,
    opacity: 0.75,
  },
  colorRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  colorDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  widthPreviewRow: {
    marginTop: 4,
    width: 80,
    height: 14,
    justifyContent: 'center',
  },
  strokePreview: {
    width: 80,
    borderRadius: 2,
  },
  doneButton: {
    minHeight: touchTarget,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  doneButtonText: {
    ...typography.bodyStrong,
  },
});
