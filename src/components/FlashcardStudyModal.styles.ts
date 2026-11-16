import { StyleSheet } from 'react-native';

import { radii, spacing, touchTarget, typography } from '../theme';

export const flashcardStudyModalStyles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#00000066',
    padding: spacing.md,
  },
  container: {
    width: '100%',
    maxWidth: 480,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  title: {
    ...typography.title,
  },
  progressText: {
    ...typography.caption,
    fontWeight: '600',
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
  deckList: {
    flexGrow: 0,
  },
  cardSlide: {
    paddingHorizontal: spacing.lg,
  },
  flashcard: {
    minHeight: 240,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    padding: spacing.lg,
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  badgeText: {
    ...typography.caption,
    fontWeight: '700',
  },
  cardBody: {
    ...typography.subtitle,
    textAlign: 'center',
  },
  tapHint: {
    ...typography.caption,
    textAlign: 'center',
    opacity: 0.7,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  reviewBtn: {
    flex: 1,
    minHeight: touchTarget + 4,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  knowBtn: {
    flex: 1,
    minHeight: touchTarget + 4,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    ...typography.bodyStrong,
  },
  emptyBox: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
});
