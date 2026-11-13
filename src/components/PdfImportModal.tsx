import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getPdfCapabilityStatus,
  importPdfPagesToBoard,
  MAX_PDF_IMPORT_PAGES,
  parsePageRange,
  pickPdfDocument,
  type PickedPdfFile,
} from '../pdf/pdf-import-service';
import { getLocalDatabase } from '../persistence/expo-store';
import type { BoardPageRecord } from '../persistence/repository';
import { resolveFlowModalLayout } from '../responsive/layout';
import { spacing, typography, type ThemeColors } from '../theme';
import { AppButton } from './AppButton';
import { pdfImportModalStyles as styles } from './PdfImportModal.styles';

type PdfImportModalProps = {
  visible: boolean;
  boardId: string | null;
  theme: ThemeColors;
  insertAtIndex?: number;
  onClose: () => void;
  onImportedPages: (pages: BoardPageRecord[]) => void;
  onFallbackImageImport?: () => void;
};

export const PdfImportModal = React.memo(function PdfImportModal({
  visible,
  boardId,
  theme,
  insertAtIndex,
  onClose,
  onImportedPages,
  onFallbackImageImport,
}: PdfImportModalProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { centeredModal, modalMaxWidth } = resolveFlowModalLayout(width, height);

  const capability = useMemo(() => getPdfCapabilityStatus(), [visible]);

  const [pickedFile, setPickedFile] = useState<PickedPdfFile | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [rangeMode, setRangeMode] = useState<'all' | 'custom'>('all');
  const [rangeText, setRangeText] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setPickedFile(null);
      setTotalPages(0);
      setRangeMode('all');
      setRangeText('');
      setBusy(false);
      setProgress(0);
      setProgressLabel('');
      setErrorMessage(null);
    }
  }, [visible]);

  const handlePickPdf = useCallback(async () => {
    if (busy || !capability.available) return;
    setErrorMessage(null);
    try {
      const picked = await pickPdfDocument();
      if (picked.canceled) return;
      const count = await capability.adapter.getPageCount(picked.file.uri);
      setPickedFile(picked.file);
      setTotalPages(Math.max(1, count));
      setRangeMode('all');
      setRangeText('');
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not open the selected PDF.',
      );
    }
  }, [busy, capability]);

  const parsedRange = useMemo(() => {
    if (!pickedFile || totalPages <= 0) return null;
    return parsePageRange(rangeMode === 'all' ? 'all' : rangeText, totalPages);
  }, [pickedFile, rangeMode, rangeText, totalPages]);

  const handleImport = useCallback(async () => {
    if (busy || !capability.available || !pickedFile || !boardId) return;
    if (!parsedRange || !parsedRange.ok) {
      setErrorMessage(parsedRange ? parsedRange.error : 'Choose valid pages to import.');
      return;
    }

    setBusy(true);
    setProgress(0.05);
    setProgressLabel('Preparing PDF import…');
    setErrorMessage(null);

    try {
      const database = await getLocalDatabase();
      const created = await importPdfPagesToBoard({
        database,
        boardId,
        pdfUri: pickedFile.uri,
        pdfName: pickedFile.name,
        pageNumbers: parsedRange.pages,
        adapter: capability.adapter,
        insertAtIndex,
        onProgress: (fraction, label) => {
          setProgress(fraction);
          setProgressLabel(label);
        },
      });
      onImportedPages(created);
      onClose();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not import PDF pages.',
      );
    } finally {
      setBusy(false);
    }
  }, [
    boardId,
    busy,
    capability,
    insertAtIndex,
    onClose,
    onImportedPages,
    parsedRange,
    pickedFile,
  ]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType={centeredModal ? 'fade' : 'slide'}
      statusBarTranslucent
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <Pressable
        style={[styles.scrim, centeredModal && styles.scrimCentered]}
        onPress={() => {
          if (!busy) onClose();
        }}
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
          {!centeredModal && (
            <View style={[styles.grabber, { backgroundColor: theme.border }]} />
          )}

          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.foreground }]}>Import PDF for markup</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close PDF import"
              disabled={busy}
              onPress={onClose}
              style={styles.closeButton}
            >
              <Text style={[styles.closeText, { color: theme.primary }]}>Close</Text>
            </Pressable>
          </View>

          {!capability.available ? (
            <View>
              <View
                style={[
                  styles.banner,
                  { borderColor: theme.border, backgroundColor: theme.muted },
                ]}
              >
                <Text style={[styles.bannerTitle, { color: theme.foreground }]}>
                  Development build required for PDF pages
                </Text>
                <Text style={[styles.bannerBody, { color: theme.foreground + '99' }]}>
                  {capability.reason}
                </Text>
              </View>
              <View style={styles.actions}>
                {onFallbackImageImport ? (
                  <AppButton
                    label="Import worksheet photo instead"
                    variant="primary"
                    onPress={() => {
                      onClose();
                      onFallbackImageImport();
                    }}
                  />
                ) : null}
                <AppButton
                  label="Close"
                  variant="secondary"
                  onPress={onClose}
                />
              </View>
            </View>
          ) : (
            <View>
              {pickedFile ? (
                <>
                  <View
                    style={[
                      styles.fileCard,
                      { borderColor: theme.border, backgroundColor: theme.muted },
                    ]}
                  >
                    <Text style={[styles.fileName, { color: theme.foreground }]} numberOfLines={1}>
                      {pickedFile.name}
                    </Text>
                    <Text style={[styles.fileMeta, { color: theme.foreground + '99' }]}>
                      {totalPages} page{totalPages === 1 ? '' : 's'} · up to {MAX_PDF_IMPORT_PAGES} per batch
                    </Text>
                  </View>

                  <View style={styles.section}>
                    <Text style={[styles.sectionLabel, { color: theme.foreground }]}>
                      Pages to import
                    </Text>
                    <View style={styles.modeRow}>
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityState={{ selected: rangeMode === 'all' }}
                        disabled={busy}
                        onPress={() => setRangeMode('all')}
                        style={[
                          styles.modeChip,
                          {
                            borderColor: rangeMode === 'all' ? theme.primary : theme.border,
                            backgroundColor: rangeMode === 'all' ? theme.muted : theme.surface,
                          },
                        ]}
                      >
                        <Text style={[typography.bodyStrong, { color: theme.foreground }]}>
                          All ({Math.min(totalPages, MAX_PDF_IMPORT_PAGES)})
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityState={{ selected: rangeMode === 'custom' }}
                        disabled={busy}
                        onPress={() => setRangeMode('custom')}
                        style={[
                          styles.modeChip,
                          {
                            borderColor: rangeMode === 'custom' ? theme.primary : theme.border,
                            backgroundColor: rangeMode === 'custom' ? theme.muted : theme.surface,
                          },
                        ]}
                      >
                        <Text style={[typography.bodyStrong, { color: theme.foreground }]}>
                          Custom range
                        </Text>
                      </Pressable>
                    </View>

                    {rangeMode === 'custom' ? (
                      <TextInput
                        value={rangeText}
                        onChangeText={setRangeText}
                        placeholder="e.g. 1-5, 8"
                        placeholderTextColor={theme.foreground + '99'}
                        editable={!busy}
                        style={[
                          styles.rangeInput,
                          {
                            color: theme.foreground,
                            borderColor: theme.border,
                            backgroundColor: theme.background,
                          },
                        ]}
                      />
                    ) : null}
                  </View>
                </>
              ) : (
                <View
                  style={[
                    styles.banner,
                    { borderColor: theme.border, backgroundColor: theme.muted },
                  ]}
                >
                  <Text style={[styles.bannerBody, { color: theme.foreground + '99' }]}>
                    Each selected PDF page becomes its own board page with a locked worksheet background ready for pen, highlighter, and sticky-note markup.
                  </Text>
                </View>
              )}

              {busy ? (
                <View
                  style={[
                    styles.progressBox,
                    { borderColor: theme.border, backgroundColor: theme.muted },
                  ]}
                >
                  <View style={styles.progressHeader}>
                    <ActivityIndicator size="small" color={theme.primary} />
                    <Text style={[typography.bodyStrong, { color: theme.foreground }]}>
                      {progressLabel}
                    </Text>
                  </View>
                  <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.round(Math.max(0.05, Math.min(1, progress)) * 100)}%`,
                          backgroundColor: theme.primary,
                        },
                      ]}
                    />
                  </View>
                </View>
              ) : null}

              {errorMessage ? (
                <Text style={[styles.errorText, { color: theme.destructive }]}>
                  {errorMessage}
                </Text>
              ) : null}

              <View style={styles.actions}>
                {!pickedFile ? (
                  <AppButton
                    label="Choose PDF file"
                    variant="primary"
                    onPress={handlePickPdf}
                  />
                ) : (
                  <>
                    <AppButton
                      label={
                        busy
                          ? 'Importing…'
                          : parsedRange?.ok
                            ? `Import ${parsedRange.pages.length} page${parsedRange.pages.length === 1 ? '' : 's'}`
                            : 'Import pages'
                      }
                      variant="primary"
                      disabled={busy || !parsedRange?.ok}
                      onPress={handleImport}
                    />
                    <AppButton
                      label="Choose another PDF"
                      variant="secondary"
                      disabled={busy}
                      onPress={handlePickPdf}
                    />
                  </>
                )}
              </View>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
});
