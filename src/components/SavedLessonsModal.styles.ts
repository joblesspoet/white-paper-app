import { StyleSheet } from 'react-native';

import { radii, spacing, typography } from '../theme';

export const savedLessonsModalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.56)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  dialog: {
    width: '100%',
    maxWidth: 640,
    maxHeight: '86%',
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
    fontSize: 18,
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
  listContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  rowCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rowTitle: {
    ...typography.body,
    fontWeight: '700',
    flex: 1,
  },
  qualityBadge: {
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  qualityText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '700',
  },
  rowMeta: {
    ...typography.caption,
    fontVariant: ['tabular-nums'],
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
    marginTop: 4,
  },
  actionButton: {
    minHeight: 38,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    ...typography.caption,
    fontWeight: '700',
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  emptyTitle: {
    ...typography.body,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyBody: {
    ...typography.caption,
    textAlign: 'center',
  },
});
