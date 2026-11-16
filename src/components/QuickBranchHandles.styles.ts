import { StyleSheet } from 'react-native';

export const QUICK_BRANCH_PILL_SIZE = 28;

export const quickBranchHandlesStyles = StyleSheet.create({
  pill: {
    position: 'absolute',
    width: QUICK_BRANCH_PILL_SIZE,
    height: QUICK_BRANCH_PILL_SIZE,
    borderRadius: QUICK_BRANCH_PILL_SIZE / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillLabel: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.94 }],
  },
});
