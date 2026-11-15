import { StyleSheet } from 'react-native';

import { radii, spacing } from '../theme';

export const classroomQrStyles = StyleSheet.create({
  frame: {
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
