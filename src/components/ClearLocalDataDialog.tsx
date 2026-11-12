import { useEffect, useState } from 'react';
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
import { colors, radii, spacing, touchTarget, typography, type ThemeColors } from '../theme';
import { CheckIcon, DatabaseIcon, BoardIcon, SettingsIcon, TrashIcon } from './icons';

type ClearLocalDataDialogProps = {
  visible: boolean;
  theme: ThemeColors;
  isDark: boolean;
  stats: LocalDataStats | null;
  loadingStats?: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

export function ClearLocalDataDialog({
  visible,
  theme,
  isDark,
  stats,
  loadingStats,
  onClose,
  onConfirm,
}: ClearLocalDataDialogProps) {
  const { width } = useWindowDimensions();
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setAcknowledged(false);
      setBusy(false);
    }
  }, [visible]);

  const handleConfirm = async () => {
    if (!acknowledged || busy) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  const isWide = width >= 768;
  const boardCount = stats?.boardCount ?? 0;
  const stickyCount = stats?.stickyCount ?? 0;
  const drawingCount = (stats?.strokeCount ?? 0) + (stats?.shapeCount ?? 0) + (stats?.connectorCount ?? 0);
  const mediaBytes = stats?.mediaBytes ?? 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
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
              maxWidth: isWide ? 440 : width - spacing.lg * 2,
            },
          ]}
        >
          {/* Destructive badge icon */}
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: isDark ? '#451A1A' : '#FEE2E2' },
            ]}
          >
            <TrashIcon size={24} color={colors.destructive} />
          </View>

          {/* Heading and consequence */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.foreground }]}>
              Clear all local data?
            </Text>
            <Text style={[styles.consequence, { color: theme.foreground }]}>
              Every local board, exported backup, and canvas preference stored on
              this device will be permanently deleted. Because FlowCanvas has
              zero cloud accounts or remote servers, this action is irreversible
              and your data cannot be recovered.
            </Text>
          </View>

          {/* Items to be purged container */}
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
              <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: spacing.sm }} />
            ) : (
              <View style={styles.purgedList}>
                <View style={styles.purgedItem}>
                  <BoardIcon size={18} color={colors.destructive} />
                  <Text style={[styles.purgedItemText, { color: theme.foreground }]}>
                    {boardCount} active {boardCount === 1 ? 'board' : 'boards'} ({stickyCount} sticky notes, {drawingCount} vector drawings)
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

          {/* Checkbox acknowledgement */}
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acknowledged }}
            accessibilityLabel="I understand this cannot be undone"
            style={styles.checkboxRow}
            onPress={() => setAcknowledged((curr) => !curr)}
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

          {/* Action buttons */}
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
                  backgroundColor: isDark ? theme.surface : '#FFFFFF',
                },
              ]}
              disabled={busy}
              onPress={onClose}
            >
              <Text style={[styles.cancelButtonText, { color: theme.foreground }]}>
                Cancel
              </Text>
            </Pressable>
          </View>
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
    gap: spacing.md,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    gap: spacing.xs,
  },
  title: {
    ...typography.title,
  },
  consequence: {
    ...typography.body,
    opacity: 0.85,
    lineHeight: 22,
  },
  purgedBox: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  purgedHeader: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  purgedList: {
    gap: spacing.xs,
  },
  purgedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  purgedItemText: {
    ...typography.caption,
    flexShrink: 1,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radii.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxLabel: {
    ...typography.bodyStrong,
    fontSize: 15,
  },
  buttons: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  deleteButton: {
    minHeight: touchTarget,
    backgroundColor: colors.destructive,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  deleteButtonText: {
    ...typography.bodyStrong,
    color: colors.onPrimary,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  cancelButton: {
    minHeight: touchTarget,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  cancelButtonText: {
    ...typography.bodyStrong,
  },
});
