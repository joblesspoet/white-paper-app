import { StyleSheet } from 'react-native';

import { radii, spacing, touchTarget, typography } from '../../theme';

export const settingsRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 2,
    minHeight: touchTarget + 8,
    gap: spacing.md,
  },
  rowPressed: {
    opacity: 0.72,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowLeft: {
    flex: 1,
    flexShrink: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 0,
  },
  rowLabel: {
    ...typography.bodyStrong,
    fontSize: 16,
  },
  rowSubtitle: {
    ...typography.caption,
    opacity: 0.76,
    lineHeight: 17,
  },
  rowValue: {
    ...typography.body,
    fontSize: 14,
    opacity: 0.85,
  },
  themeRow: {
    padding: spacing.md,
    gap: spacing.sm + 2,
  },
  themeRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  segmentContainer: {
    flexDirection: 'row',
    borderRadius: radii.sm + 2,
    padding: 3,
    position: 'relative',
  },
  segmentPill: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 3,
    borderRadius: radii.sm,
  },
  segmentButton: {
    flex: 1,
    minHeight: touchTarget - 4,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  segmentButtonText: {
    ...typography.caption,
    fontSize: 14,
  },
});
