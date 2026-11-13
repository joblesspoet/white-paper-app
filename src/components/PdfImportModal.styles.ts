import { StyleSheet } from 'react-native';

import { radii, spacing, touchTarget, typography } from '../theme';

export const pdfImportModalStyles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.36)',
    justifyContent: 'flex-end',
  },
  scrimCentered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  sheet: {
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderWidth: 1,
    maxHeight: '82%',
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  sheetModal: {
    width: '100%',
    borderRadius: radii.lg,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 999,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.title,
  },
  closeButton: {
    minWidth: touchTarget,
    minHeight: touchTarget,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  closeText: {
    ...typography.bodyStrong,
  },
  banner: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  bannerTitle: {
    ...typography.bodyStrong,
    marginBottom: spacing.xs,
  },
  bannerBody: {
    ...typography.body,
  },
  fileCard: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  fileName: {
    ...typography.bodyStrong,
  },
  fileMeta: {
    ...typography.caption,
    marginTop: 4,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionLabel: {
    ...typography.caption,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modeChip: {
    flex: 1,
    minHeight: touchTarget,
    borderWidth: 1,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  rangeInput: {
    marginTop: spacing.sm,
    minHeight: touchTarget,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    ...typography.body,
  },
  progressBox: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  errorText: {
    ...typography.caption,
    marginBottom: spacing.sm,
  },
  actions: {
    gap: spacing.sm,
  },
});
