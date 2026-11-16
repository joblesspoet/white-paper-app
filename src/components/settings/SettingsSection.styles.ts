import { StyleSheet } from 'react-native';

import { radii, spacing, typography } from '../../theme';

export const settingsSectionStyles = StyleSheet.create({
  section: {
    gap: spacing.xs + 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
  title: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  subtitle: {
    ...typography.caption,
    fontSize: 12,
    opacity: 0.72,
  },
  card: {
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
