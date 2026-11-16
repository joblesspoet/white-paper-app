import { StyleSheet } from 'react-native';

import { radii, spacing, touchTarget, typography } from '../../theme';

export const boardOptionsModalStyles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(19, 78, 74, 0.24)',
  },
  scrimCentered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  keyboardWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  keyboardWrapCentered: {
    justifyContent: 'center',
  },
  sheet: {
    width: '100%',
    padding: spacing.lg,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderTopWidth: 1,
    gap: spacing.sm,
  },
  sheetModal: {
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  grabber: {
    width: 44,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  titleWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.subtitle,
  },
  meta: {
    ...typography.caption,
    opacity: 0.78,
  },
  closeButton: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: touchTarget + 8,
  },
  actionDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionPressed: {
    opacity: 0.72,
  },
  actionText: {
    ...typography.bodyStrong,
    flex: 1,
    fontSize: 15,
  },
  renameInput: {
    ...typography.body,
    minHeight: touchTarget + 4,
    borderWidth: 1.5,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    marginVertical: spacing.xs,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  secondaryButton: {
    flex: 1,
    minHeight: touchTarget + 4,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  secondaryButtonText: {
    ...typography.bodyStrong,
  },
  primaryButton: {
    flex: 1,
    minHeight: touchTarget + 4,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  primaryButtonText: {
    ...typography.bodyStrong,
  },
  deleteBody: {
    ...typography.body,
    lineHeight: 22,
    opacity: 0.88,
  },
  deleteStack: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  destructiveButton: {
    minHeight: touchTarget + 4,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  destructiveText: {
    ...typography.bodyStrong,
  },
  cancelButton: {
    minHeight: touchTarget + 2,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
});
