import { StyleSheet } from 'react-native';

import { radii, spacing, typography } from '../theme';

export const lessonRecorderBarStyles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    alignItems: 'center',
    zIndex: 35,
  },
  pill: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    gap: spacing.xs,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  recDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  timerText: {
    ...typography.caption,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  qualityGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chipButton: {
    minHeight: 36,
    paddingHorizontal: spacing.xs + 2,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '700',
  },
  targetButton: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryAction: {
    minHeight: 36,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionText: {
    ...typography.caption,
    fontWeight: '700',
  },
  stopAction: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  micBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
