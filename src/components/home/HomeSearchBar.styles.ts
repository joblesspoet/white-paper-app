import { StyleSheet } from 'react-native';

import { radii, spacing, touchTarget, typography } from '../../theme';

export const homeSearchBarStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touchTarget,
    borderWidth: 1,
    borderRadius: radii.sm + 2,
    paddingLeft: spacing.sm + 4,
    paddingRight: spacing.xs,
    gap: spacing.sm,
  },
  input: {
    ...typography.body,
    flex: 1,
    minHeight: touchTarget,
    paddingVertical: spacing.xs,
    fontSize: 15,
  },
  clearButton: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearPressed: {
    opacity: 0.65,
  },
});
