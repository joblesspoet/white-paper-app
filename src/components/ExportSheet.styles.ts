import { StyleSheet } from 'react-native';

import { radii, spacing, touchTarget, typography } from '../theme';

export const exportSheetStyles = StyleSheet.create({
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
    maxHeight: '85%',
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
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    gap: spacing.md,
    paddingBottom: spacing.xs,
  },
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    ...typography.bodyStrong,
  },
  scopeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  scopeChip: {
    flex: 1,
    minHeight: touchTarget,
    borderWidth: 1,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  formatList: {
    gap: spacing.sm,
  },
  formatRow: {
    minHeight: touchTarget + 12,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  formatText: {
    flex: 1,
    gap: 2,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
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
  banner: {
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: spacing.md,
  },
});
