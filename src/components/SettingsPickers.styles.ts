import { StyleSheet } from 'react-native';

import { radii, spacing, touchTarget, typography } from '../theme';

export const settingsPickersStyles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(19, 78, 74, 0.24)',
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
    letterSpacing: 0.6,
    marginTop: spacing.xs,
  },
  versionBadge: {
    ...typography.caption,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  bodyScroll: {
    maxHeight: 300,
  },
  colorScroll: {
    maxHeight: 320,
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
    minHeight: touchTarget + 4,
    gap: spacing.sm,
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
    opacity: 0.76,
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
    borderColor: 'rgba(19, 78, 74, 0.2)',
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
    minHeight: touchTarget + 2,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  doneButtonText: {
    ...typography.bodyStrong,
  },
});
