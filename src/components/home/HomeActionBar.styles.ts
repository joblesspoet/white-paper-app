import { StyleSheet } from 'react-native';

import { radii, spacing, touchTarget, typography } from '../../theme';

export const homeActionBarStyles = StyleSheet.create({
  phoneStack: {
    gap: spacing.sm + 4,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
  },
  tabletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm + 4,
  },
  tabletPrimaryWrap: {
    minWidth: 196,
  },
  secondaryButton: {
    minHeight: touchTarget + 4,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: radii.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
  },
  secondaryFlex: {
    flex: 1,
  },
  secondaryPressed: {
    opacity: 0.78,
  },
  secondaryText: {
    ...typography.bodyStrong,
    fontSize: 14,
  },
  sectionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  sectionHeading: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  sectionCount: {
    ...typography.caption,
    opacity: 0.78,
  },
});
