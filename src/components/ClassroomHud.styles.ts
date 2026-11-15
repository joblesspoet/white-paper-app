import { StyleSheet } from 'react-native';

import { radii, spacing, touchTarget } from '../theme';

export const classroomHudStyles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 25,
    maxWidth: '92%',
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    gap: spacing.xs,
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DC2626',
  },
  liveText: {
    fontSize: 12,
    fontWeight: '700',
  },
  codeChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  codeText: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  actionChip: {
    minHeight: 34,
    minWidth: 34,
    paddingHorizontal: spacing.xs + 2,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  actionChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: '#EA580C',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  noticeBanner: {
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    maxWidth: 320,
  },
  noticeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  projectorPill: {
    minHeight: touchTarget,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
