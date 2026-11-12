import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  backupSummary,
  type BackupImportPlan,
  type BoardBackup,
} from '../export/backup';
import { importBackup } from '../export/backup-store';
import { formatBytes } from '../export/regions';
import { resolveFlowModalLayout } from '../responsive/layout';
import { radii, spacing, touchTarget, typography, type ThemeColors } from '../theme';
import { AppButton } from './AppButton';

export type ImportModalState =
  | { status: 'closed' }
  | {
      status: 'ready';
      plan: BackupImportPlan;
      backup: BoardBackup;
      warnings: string[];
      size: number;
    }
  | { status: 'error'; message: string };

type ImportBoardModalProps = {
  state: ImportModalState;
  theme: ThemeColors;
  onClose: () => void;
  onImported: (boardId: string) => void;
};

export function ImportBoardModal({
  state,
  theme,
  onClose,
  onImported,
}: ImportBoardModalProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { centeredModal, modalMaxWidth } = resolveFlowModalLayout(width, height);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  const visible = state.status !== 'closed';

  const handleConfirmImport = async () => {
    if (state.status !== 'ready' || busy) return;
    setBusy(true);
    setProgress(0.05);
    setProgressLabel('Starting import…');
    setImportError(null);

    try {
      const result = await importBackup(state.plan, (fraction, label) => {
        setProgress(fraction);
        setProgressLabel(label);
      });
      if ('canceled' in result) return;
      if (!result.ok) {
        setImportError(result.error);
        return;
      }
      onImported(result.boardId);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'The board could not be imported.');
    } finally {
      setBusy(false);
    }
  };

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
            <Text style={[styles.title, { color: theme.foreground }]}>
              {state.status === 'error' ? 'Cannot import board' : 'Import board'}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close import dialog"
              disabled={busy}
              onPress={() => { setImportError(null); onClose(); }}
              style={styles.closeButton}
            >
              <Text style={[styles.closeText, { color: theme.primary }]}>Close</Text>
            </Pressable>
          </View>

          {state.status === 'error' && (
            <>
              <View accessibilityRole="alert" style={[styles.banner, { borderColor: theme.destructive, backgroundColor: theme.muted }]}>
                <Text style={[typography.body, { color: theme.destructive }]}>{state.message}</Text>
              </View>
              <AppButton label="OK" onPress={onClose} />
            </>
          )}

          {state.status === 'ready' && (
            <>
              <View style={[styles.card, { borderColor: theme.border, backgroundColor: theme.muted }]}>
                <Text style={[typography.subtitle, { color: theme.foreground }]}>{state.plan.board.title}</Text>
                <Text style={[typography.caption, { color: theme.foreground, opacity: 0.8 }]}>
                  {backupSummary(state.backup)} · {formatBytes(state.size)}
                </Text>
                <Text style={[typography.caption, { color: theme.foreground, opacity: 0.7 }]}>
                  Creates a new local board without replacing any existing board.
                </Text>
              </View>

              {(state.warnings.length > 0 || state.plan.missingMedia.length > 0) && (
                <View style={[styles.banner, { borderColor: theme.border, backgroundColor: theme.muted }]}>
                  {state.warnings.slice(0, 3).map((warning, index) => (
                    <Text key={index} style={[typography.caption, { color: theme.foreground }]}>
                      • {warning}
                    </Text>
                  ))}
                  {state.plan.missingMedia.length > 0 && (
                    <Text style={[typography.caption, { color: theme.foreground }]}>
                      • {state.plan.missingMedia.length} referenced media file(s) were not embedded in this backup.
                    </Text>
                  )}
                </View>
              )}

              {busy && (
                <View style={[styles.progressBox, { borderColor: theme.border, backgroundColor: theme.muted }]}>
                  <View style={styles.progressHeader}>
                    <ActivityIndicator size="small" color={theme.primary} />
                    <Text style={[typography.caption, { color: theme.foreground, flex: 1 }]}>
                      {progressLabel || 'Importing…'}
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

              {importError && (
                <View accessibilityRole="alert" style={[styles.banner, { borderColor: theme.destructive, backgroundColor: theme.muted }]}>
                  <Text style={[typography.caption, { color: theme.destructive }]}>{importError}</Text>
                </View>
              )}

              <AppButton
                label={busy ? 'Importing…' : 'Import as new board'}
                disabled={busy}
                onPress={() => { void handleConfirmImport(); }}
              />
            </>
          )}
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
  card: { borderWidth: 1, borderRadius: radii.sm, padding: spacing.md, gap: spacing.xs },
  banner: { borderWidth: 1, borderRadius: radii.sm, padding: spacing.md, gap: spacing.xs },
  progressBox: { borderWidth: 1, borderRadius: radii.sm, padding: spacing.md, gap: spacing.sm },
  progressHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%' },
});
