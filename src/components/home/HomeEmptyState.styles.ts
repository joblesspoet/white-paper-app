import { StyleSheet } from 'react-native';

import { colors, radii, spacing, touchTarget, typography } from '../../theme';

export const homeEmptyStateStyles = StyleSheet.create({
  skeletonWrap: {
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  skeletonCard: {
    borderWidth: 1,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  skeletonThumb: {
    height: 112,
  },
  skeletonFooter: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  skeletonLineLg: {
    height: 14,
    width: '72%',
    borderRadius: 4,
  },
  skeletonLineSm: {
    height: 10,
    width: '48%',
    borderRadius: 4,
  },
  loadingCaption: {
    ...typography.caption,
    textAlign: 'center',
    opacity: 0.72,
    marginTop: spacing.xs,
  },
  empty: {
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 480,
    marginTop: spacing.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderRadius: radii.lg,
  },
  dashedFrame: {
    width: 96,
    height: 96,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.title,
    textAlign: 'center',
  },
  emptyBody: {
    ...typography.body,
    textAlign: 'center',
    marginTop: spacing.sm,
    maxWidth: 320,
    lineHeight: 23,
    opacity: 0.85,
  },
  primaryButton: {
    width: '100%',
    maxWidth: 300,
    minHeight: touchTarget + 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.sm,
    marginTop: spacing.lg,
  },
  primaryButtonText: {
    ...typography.bodyStrong,
    color: colors.onAccent,
  },
  secondaryAction: {
    width: '100%',
    maxWidth: 300,
    minHeight: touchTarget + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginTop: spacing.sm + 2,
  },
  secondaryActionText: {
    ...typography.bodyStrong,
    fontSize: 15,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  offlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  offlineText: {
    ...typography.caption,
    fontSize: 12,
  },
});
