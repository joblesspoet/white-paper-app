import { memo, useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { formatBytes } from '../export/regions';
import type { LocalDataStats } from '../persistence/repository';
import { resolveFlowModalLayout } from '../responsive/layout';
import { colors, spacing, type ThemeColors } from '../theme';
import { clearLocalDataDialogStyles as styles } from './ClearLocalDataDialog.styles';
import { BoardIcon, CheckIcon, DatabaseIcon, SettingsIcon, TrashIcon } from './icons';

type ClearLocalDataDialogProps = {
  visible: boolean;
  theme: ThemeColors;
  isDark: boolean;
  reducedMotion?: boolean;
  stats: LocalDataStats | null;
  loadingStats?: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

export const ClearLocalDataDialog = memo(function ClearLocalDataDialog({
  visible,
  theme,
  isDark,
  reducedMotion = false,
  stats,
  loadingStats,
  onClose,
  onConfirm,
}: ClearLocalDataDialogProps) {
  const { width, height } = useWindowDimensions();
  const { centeredModal, modalMaxWidth } = resolveFlowModalLayout(width, height);
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setAcknowledged(false);
      setBusy(false);
    }
  }, [visible]);

  const toggleAcknowledge = useCallback(() => {
    setAcknowledged((curr) => !curr);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!acknowledged || busy) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }, [acknowledged, busy, onConfirm]);

  const boardCount = stats?.boardCount ?? 0;
  const stickyCount = stats?.stickyCount ?? 0;
  const drawingCount =
    (stats?.strokeCount ?? 0) + (stats?.shapeCount ?? 0) + (stats?.connectorCount ?? 0);
  const mediaBytes = stats?.mediaBytes ?? 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reducedMotion ? 'none' : 'fade'}
      statusBarTranslucent
      onRequestClose={busy ? undefined : onClose}
    >
      <View style={styles.scrim}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={busy ? undefined : onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss dialog"
        />

        <View
          style={[
            styles.dialog,
            {
              backgroundColor: theme.surface,
              borderColor: isDark ? theme.border : '#FECACA',
              maxWidth: centeredModal ? modalMaxWidth : width - spacing.lg * 2,
            },
          ]}
        >
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: isDark ? '#451A1A' : '#FEE2E2' },
            ]}
          >
            <TrashIcon size={24} color={colors.destructive} />
          </View>

          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.foreground }]}>
              Clear all local data?
            </Text>
            <Text style={[styles.consequence, { color: theme.foreground }]}>
              Every local board, exported backup, and canvas preference stored on this device will
              be permanently deleted. Because FlowCanvas has zero cloud accounts or remote servers,
              this action is irreversible and your data cannot be recovered.
            </Text>
          </View>

          <View
            style={[
              styles.purgedBox,
              {
                backgroundColor: isDark ? '#082320' : '#F0FDFA',
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.purgedHeader, { color: theme.primary }]}>
              ITEMS TO BE PURGED
            </Text>

            {loadingStats ? (
              <ActivityIndicator
                size="small"
                color={theme.primary}
                style={styles.purgedSpinner}
              />
            ) : (
              <View style={styles.purgedList}>
                <View style={styles.purgedItem}>
                  <BoardIcon size={18} color={colors.destructive} />
                  <Text style={[styles.purgedItemText, { color: theme.foreground }]}>
                    {boardCount} active {boardCount === 1 ? 'board' : 'boards'} ({stickyCount}{' '}
                    sticky notes, {drawingCount} vector drawings)
                  </Text>
                </View>

                <View style={styles.purgedItem}>
                  <DatabaseIcon size={18} color={colors.destructive} />
                  <Text style={[styles.purgedItemText, { color: theme.foreground }]}>
                    Local database cache ({formatBytes(mediaBytes)})
                  </Text>
                </View>

                <View style={styles.purgedItem}>
                  <SettingsIcon size={18} color={colors.destructive} />
                  <Text style={[styles.purgedItemText, { color: theme.foreground }]}>
                    Custom tool preferences & presets
                  </Text>
                </View>
              </View>
            )}
          </View>

          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acknowledged }}
            accessibilityLabel="I understand this cannot be undone"
            style={styles.checkboxRow}
            onPress={toggleAcknowledge}
            hitSlop={8}
          >
            <View
              style={[
                styles.checkbox,
                {
                  borderColor: acknowledged ? theme.primary : theme.border,
                  backgroundColor: acknowledged ? theme.primary : 'transparent',
                },
              ]}
            >
              {acknowledged && <CheckIcon size={16} color={colors.onPrimary} />}
            </View>
            <Text style={[styles.checkboxLabel, { color: theme.foreground }]}>
              I understand this cannot be undone
            </Text>
          </Pressable>

          <View style={styles.buttons}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete everything"
              accessibilityState={{ disabled: !acknowledged || busy }}
              style={[
                styles.deleteButton,
                (!acknowledged || busy) && styles.buttonDisabled,
              ]}
              disabled={!acknowledged || busy}
              onPress={handleConfirm}
            >
              {busy ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <>
                  <TrashIcon size={18} color={colors.onPrimary} />
                  <Text style={styles.deleteButtonText}>Delete everything</Text>
                </>
              )}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              style={[
                styles.cancelButton,
                {
                  borderColor: theme.border,
                  backgroundColor: isDark ? theme.surface : colors.onPrimary,
                },
              ]}
              disabled={busy}
              onPress={onClose}
            >
              <Text style={[styles.cancelButtonText, { color: theme.foreground }]}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
});
