import { StyleSheet } from 'react-native';

import { colors, radii, spacing, touchTarget, typography } from '../theme';

export const clearLocalDataDialogStyles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(19, 78, 74, 0.28)',
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
    letterSpacing: 0.6,
  },
  purgedSpinner: {
    marginVertical: spacing.sm,
  },
  purgedList: {
    gap: spacing.xs + 2,
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
    minHeight: touchTarget,
    paddingVertical: spacing.xs,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radii.sm - 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxLabel: {
    ...typography.bodyStrong,
    fontSize: 15,
    flexShrink: 1,
  },
  buttons: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  deleteButton: {
    minHeight: touchTarget + 4,
    backgroundColor: colors.destructive,
    borderRadius: radii.sm,
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
    minHeight: touchTarget + 2,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  cancelButtonText: {
    ...typography.bodyStrong,
  },
});
