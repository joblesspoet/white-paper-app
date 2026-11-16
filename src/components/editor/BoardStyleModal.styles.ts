import { StyleSheet } from 'react-native';

import { radii, spacing, touchTarget, typography } from '../../theme';

export const boardStyleModalStyles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(19, 78, 74, 0.24)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...typography.subtitle,
  },
  done: {
    ...typography.bodyStrong,
  },
  bgColorRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  bgColorChip: {
    flex: 1,
    minHeight: touchTarget,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bgColorChipText: {
    ...typography.caption,
    fontWeight: '600',
  },
  optionList: {
    borderRadius: radii.sm,
    borderWidth: 1,
    overflow: 'hidden',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minHeight: touchTarget + 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  optionLabel: {
    ...typography.bodyStrong,
  },
  optionDesc: {
    fontSize: 12,
    opacity: 0.72,
  },
});
