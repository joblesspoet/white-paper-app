import { StyleSheet } from 'react-native';

import { radii, spacing, touchTarget, typography } from '../theme';

export const boardCardStyles = StyleSheet.create({
  card: {
    minWidth: 0,
    borderWidth: 1,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  cardFlex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.82,
  },
  thumbnail: {
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  thumbnailPattern: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  styleBadge: {
    position: 'absolute',
    left: spacing.sm,
    bottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.sm - 2,
    borderWidth: 1,
  },
  styleBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  menu: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: touchTarget,
    height: touchTarget,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuPressed: {
    opacity: 0.65,
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    gap: 3,
  },
  title: {
    ...typography.bodyStrong,
    fontSize: 15,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  meta: {
    ...typography.caption,
    fontSize: 12,
    flexShrink: 1,
  },
  objectBadge: {
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.78,
  },
});
