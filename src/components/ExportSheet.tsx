import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { CanvasDocument } from '../canvas/document';
import type { Viewport } from '../canvas/viewport';
import { deleteExportFile, exportBoard, type ExportPageInput } from '../export/export-service';
import { formatBytes, type ExportFileFormat, type ExportScope } from '../export/regions';
import { isShareAvailable, shareFile } from '../export/share';
import type { BoardSettings } from '../persistence/schema';
import { resolveFlowModalLayout } from '../responsive/layout';
import { radii, spacing, touchTarget, typography, type ThemeColors } from '../theme';
import { AppButton } from './AppButton';

type ExportSheetProps = {
  visible: boolean;
  theme: ThemeColors;
  dark: boolean;
  boardTitle: string;
  document: CanvasDocument;
  viewport: Viewport;
  canvasSize: { width: number; height: number };
  settings: BoardSettings;
  selectedIds: readonly string[];
  pages?: readonly ExportPageInput[];
  defaultFormat?: ExportFileFormat;
  onClose: () => void;
};

type FormatOption = {
  format: ExportFileFormat;
  label: string;
  subtitle: string;
  supported: boolean;
};

export function ExportSheet({
  visible,
  theme,
  dark,
  boardTitle,
  document,
  viewport,
  canvasSize,
  settings,
  selectedIds,
  pages,
  defaultFormat = 'png',
  onClose,
}: ExportSheetProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const modalLayout = resolveFlowModalLayout(width, height);
  const { centeredModal, modalMaxWidth } = modalLayout;
  const hasSelection = selectedIds.length > 0;
  const pageCount = pages && pages.length > 0 ? pages.length : 1;
  const pdfSupported = Platform.OS !== 'web';

  const [format, setFormat] = useState<ExportFileFormat>(defaultFormat);
  const [scope, setScope] = useState<ExportScope>('visible');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setBusy(false);
      setProgress(0);
      setProgressLabel('');
      setStatusMessage(null);
      setErrorMessage(null);
      return;
    }
    setFormat(defaultFormat);
    if (!hasSelection && scope === 'selection') {
      setScope('visible');
    }
  }, [defaultFormat, hasSelection, scope, visible]);

  const formatOptions: FormatOption[] = [
    { format: 'png', label: 'PNG image', subtitle: 'Lossless raster image', supported: true },
    { format: 'jpeg', label: 'JPEG image', subtitle: 'Smaller compressed image', supported: true },
    {
      format: 'pdf',
      label: 'PDF document',
      subtitle: pdfSupported
        ? scope === 'all-pages'
          ? `Multi-page PDF (${pageCount} page${pageCount === 1 ? '' : 's'})`
          : 'Current page local PDF'
        : 'Available on iOS and Android',
      supported: pdfSupported,
    },
    {
      format: 'backup',
      label: 'FlowCanvas backup',
      subtitle: 'Editable .flowcanvas.json with media',
      supported: true,
    },
  ];

  const handleExport = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setProgress(0.02);
    setProgressLabel('Starting export…');
    setStatusMessage(null);
    setErrorMessage(null);

    let exportedUri: string | null = null;
    try {
      const effectiveScope: ExportScope = format === 'backup' ? 'all-pages' : scope;
      const result = await exportBoard({
        boardTitle,
        document,
        viewport,
        canvasSize,
        settings,
        dark,
        format,
        scope: effectiveScope,
        selectedIds,
        pages,
        onProgress: (fraction, label) => {
          setProgress(fraction);
          setProgressLabel(label);
        },
      });

      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }

      exportedUri = result.uri;
      const canShare = await isShareAvailable();
      if (!canShare) {
        setStatusMessage(`Saved ${result.fileName} (${formatBytes(result.bytes)}). Sharing is not available on this device.`);
        return;
      }

      setProgressLabel('Opening share sheet…');
      const shareOutcome = await shareFile({
        uri: result.uri,
        mimeType: result.mimeType,
        uti: result.uti,
        dialogTitle: `Share ${boardTitle || 'board'}`,
      });

      if (shareOutcome.outcome === 'shared') {
        setStatusMessage(`Exported ${result.fileName} (${formatBytes(result.bytes)}).`);
      } else if (shareOutcome.outcome === 'cancelled') {
        setStatusMessage('Share cancelled.');
      } else {
        setErrorMessage(shareOutcome.message);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Export failed.');
    } finally {
      setBusy(false);
      if (exportedUri) {
        await deleteExportFile(exportedUri);
      }
    }
  }, [boardTitle, busy, canvasSize, dark, document, format, pages, scope, selectedIds, settings, viewport]);

  const showScopePicker = format !== 'backup';

  return (
    <Modal
      transparent
      visible={visible}
      animationType={centeredModal ? 'fade' : 'slide'}
      statusBarTranslucent
      onRequestClose={() => { if (!busy) onClose(); }}
    >
      <Pressable
        style={[styles.scrim, centeredModal && styles.scrimCentered]}
        onPress={() => { if (!busy) onClose(); }}
      >
        <Pressable
          style={[
            styles.sheet,
            centeredModal
              ? [
                  styles.sheetModal,
                  {
                    maxWidth: modalMaxWidth,
                    borderColor: theme.border,
                    paddingBottom: spacing.lg,
                  },
                ]
              : {
                  borderColor: theme.border,
                  paddingBottom: Math.max(spacing.lg, insets.bottom + spacing.md),
                },
            { backgroundColor: theme.surface },
          ]}
          onPress={() => undefined}
        >
          {!centeredModal && <View style={[styles.grabber, { backgroundColor: theme.border }]} />}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.foreground }]}>Export board</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close export options"
              disabled={busy}
              onPress={onClose}
              style={styles.closeButton}
            >
              <Text style={[styles.closeText, { color: theme.primary }]}>Close</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {showScopePicker && (
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: theme.foreground }]}>Region</Text>
                <View style={styles.scopeRow}>
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ selected: scope === 'visible' }}
                    disabled={busy}
                    onPress={() => setScope('visible')}
                    style={[
                      styles.scopeChip,
                      {
                        borderColor: scope === 'visible' ? theme.primary : theme.border,
                        backgroundColor: scope === 'visible' ? theme.muted : theme.surface,
                      },
                    ]}
                  >
                    <Text style={[typography.bodyStrong, { color: theme.foreground }]}>Visible board</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ selected: scope === 'selection', disabled: !hasSelection }}
                    disabled={!hasSelection || busy}
                    onPress={() => setScope('selection')}
                    style={[
                      styles.scopeChip,
                      {
                        borderColor: scope === 'selection' ? theme.primary : theme.border,
                        backgroundColor: scope === 'selection' ? theme.muted : theme.surface,
                        opacity: hasSelection ? 1 : 0.45,
                      },
                    ]}
                  >
                    <Text style={[typography.bodyStrong, { color: theme.foreground }]}>
                      Selection{hasSelection ? ` (${selectedIds.length})` : ''}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ selected: scope === 'all-pages' }}
                    disabled={busy}
                    onPress={() => {
                      setScope('all-pages');
                      if (format === 'png' || format === 'jpeg') {
                        setFormat(pdfSupported ? 'pdf' : 'backup');
                      }
                    }}
                    style={[
                      styles.scopeChip,
                      {
                        borderColor: scope === 'all-pages' ? theme.primary : theme.border,
                        backgroundColor: scope === 'all-pages' ? theme.muted : theme.surface,
                      },
                    ]}
                  >
                    <Text style={[typography.bodyStrong, { color: theme.foreground }]}>
                      All pages ({pageCount})
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: theme.foreground }]}>Format</Text>
              <View style={styles.formatList}>
                {formatOptions.map((option) => {
                  const selected = format === option.format;
                  return (
                    <Pressable
                      key={option.format}
                      accessibilityRole="radio"
                      accessibilityState={{ selected, disabled: !option.supported }}
                      disabled={!option.supported || busy}
                      onPress={() => {
                        setFormat(option.format);
                        if ((option.format === 'png' || option.format === 'jpeg') && scope === 'all-pages') {
                          setScope('visible');
                        }
                      }}
                      style={[
                        styles.formatRow,
                        {
                          borderColor: selected ? theme.primary : theme.border,
                          backgroundColor: selected ? theme.muted : theme.surface,
                          opacity: option.supported ? 1 : 0.45,
                        },
                      ]}
                    >
                      <View style={styles.formatText}>
                        <Text style={[typography.bodyStrong, { color: theme.foreground }]}>{option.label}</Text>
                        <Text style={[typography.caption, { color: theme.foreground, opacity: 0.7 }]}>{option.subtitle}</Text>
                      </View>
                      <View
                        style={[
                          styles.radioOuter,
                          { borderColor: selected ? theme.primary : theme.border },
                        ]}
                      >
                        {selected && <View style={[styles.radioInner, { backgroundColor: theme.primary }]} />}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {busy && (
              <View style={[styles.progressBox, { borderColor: theme.border, backgroundColor: theme.muted }]}>
                <View style={styles.progressHeader}>
                  <ActivityIndicator size="small" color={theme.primary} />
                  <Text style={[typography.caption, { color: theme.foreground, flex: 1 }]}>
                    {progressLabel || 'Exporting…'}
                  </Text>
                  <Text style={[typography.caption, { color: theme.primary }]}>
                    {Math.round(progress * 100)}%
                  </Text>
                </View>
                <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
                  <View
                    style={[
                      styles.progressFill,
                      { backgroundColor: theme.primary, width: `${Math.round(progress * 100)}%` },
                    ]}
                  />
                </View>
              </View>
            )}

            {statusMessage && (
              <View style={[styles.banner, { borderColor: theme.primary, backgroundColor: theme.muted }]}>
                <Text style={[typography.caption, { color: theme.foreground }]}>{statusMessage}</Text>
              </View>
            )}

            {errorMessage && (
              <View accessibilityRole="alert" style={[styles.banner, { borderColor: theme.destructive, backgroundColor: theme.muted }]}>
                <Text style={[typography.caption, { color: theme.destructive }]}>{errorMessage}</Text>
              </View>
            )}
          </ScrollView>

          <AppButton
            label={busy ? 'Exporting…' : format === 'backup' ? 'Export backup' : 'Export and share'}
            disabled={busy}
            onPress={() => { void handleExport(); }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000055' },
  scrimCentered: { justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  sheet: {
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderTopWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
    maxHeight: '85%',
  },
  sheetModal: {
    width: '100%',
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  grabber: { width: 44, height: 4, borderRadius: 2, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...typography.title },
  closeButton: { minHeight: touchTarget, minWidth: touchTarget, alignItems: 'flex-end', justifyContent: 'center' },
  closeText: { ...typography.bodyStrong },
  scroll: { flexGrow: 0 },
  scrollContent: { gap: spacing.md, paddingBottom: spacing.xs },
  section: { gap: spacing.sm },
  sectionLabel: { ...typography.bodyStrong },
  scopeRow: { flexDirection: 'row', gap: spacing.sm },
  scopeChip: {
    flex: 1,
    minHeight: touchTarget,
    borderWidth: 1,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  formatList: { gap: spacing.sm },
  formatRow: {
    minHeight: touchTarget + 12,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  formatText: { flex: 1, gap: 2 },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  progressBox: { borderWidth: 1, borderRadius: radii.sm, padding: spacing.md, gap: spacing.sm },
  progressHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%' },
  banner: { borderWidth: 1, borderRadius: radii.sm, padding: spacing.md },
});
