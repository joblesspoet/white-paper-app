import { StyleSheet } from 'react-native';

import { radii, spacing, typography } from '../theme';

export const lessonReplayModalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.56)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  dialog: {
    width: '100%',
    maxWidth: 720,
    maxHeight: '92%',
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  headerTitleWrap: {
    flex: 1,
  },
  title: {
    ...typography.title,
    fontSize: 17,
  },
  subtitle: {
    ...typography.caption,
    marginTop: 2,
  },
  closeButton: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    ...typography.caption,
    fontWeight: '700',
  },
  stage: {
    height: 280,
    borderBottomWidth: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  pageBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  pageBadgeText: {
    ...typography.caption,
    fontWeight: '700',
  },
  scrubberSection: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    gap: spacing.xs,
  },
  scrubberTrack: {
    height: 32,
    justifyContent: 'center',
  },
  scrubberRail: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  scrubberFill: {
    height: '100%',
    borderRadius: 3,
  },
  scrubberMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeText: {
    ...typography.caption,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  playButton: {
    minWidth: 88,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonText: {
    ...typography.body,
    fontWeight: '700',
  },
  speedGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  speedChip: {
    minWidth: 44,
    minHeight: 36,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedText: {
    ...typography.caption,
    fontWeight: '700',
  },
  noticeBanner: {
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  noticeText: {
    ...typography.caption,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: spacing.md,
    borderTopWidth: 1,
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  footerButton: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerButtonText: {
    ...typography.body,
    fontSize: 15,
    fontWeight: '700',
  },
});
