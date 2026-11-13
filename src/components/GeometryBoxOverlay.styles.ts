import { StyleSheet } from 'react-native';

import { radii, spacing, touchTarget, typography } from '../theme';

export const styles = StyleSheet.create({
  handle: {
    position: 'absolute',
    width: touchTarget,
    height: touchTarget,
    borderRadius: touchTarget / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleIcon: {
    fontSize: 18,
    fontWeight: '700',
  },
  hudBar: {
    position: 'absolute',
    top: spacing.sm,
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
    maxWidth: '94%',
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  tabChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  tabText: {
    ...typography.caption,
    fontWeight: '600',
  },
  closeChip: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  closeIconText: {
    fontSize: 16,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  readout: {
    ...typography.caption,
    fontWeight: '600',
  },
  inlineActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  smallBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  smallBtnText: {
    ...typography.caption,
    fontWeight: '600',
  },
  primaryBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.sm,
  },
  primaryBtnText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
