import { StyleSheet } from 'react-native';

import { radii, spacing, touchTarget, typography } from '../theme';

export const importBoardModalStyles = StyleSheet.create({
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
  sheet: {
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderTopWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  sheetModal: {
    width: '100%',
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  grabber: {
    width: 44,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...typography.title,
  },
  closeButton: {
    minHeight: touchTarget,
    minWidth: touchTarget,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  closeText: {
    ...typography.bodyStrong,
  },
  card: {
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: spacing.md,
    gap: spacing.xs,
  },
  banner: {
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: spacing.md,
    gap: spacing.xs,
  },
  progressBox: {
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: spacing.md,
    gap: spacing.sm,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
});
