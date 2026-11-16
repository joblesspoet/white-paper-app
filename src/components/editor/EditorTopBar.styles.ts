import { StyleSheet } from 'react-native';

import { radii, spacing, touchTarget, typography } from '../../theme';

export const editorTopBarStyles = StyleSheet.create({
  topBar: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    gap: spacing.xs + 2,
  },
  backButton: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '180deg' }],
  },
  titleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
  },
  title: {
    flex: 1,
    ...typography.bodyStrong,
    paddingVertical: spacing.sm,
    minWidth: 80,
  },
  savePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  saveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  saveText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  action: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
  },
  actionDisabled: {
    opacity: 0.3,
  },
  presenterPill: {
    minHeight: 34,
    paddingHorizontal: 8,
    borderRadius: radii.sm + 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presenterPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  liveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 34,
    paddingHorizontal: 9,
    borderRadius: radii.sm + 2,
    borderWidth: 1,
  },
  liveButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.68,
  },
});
