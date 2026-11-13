import { StyleSheet } from 'react-native';

import { radii, typography } from '../theme';

export const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 6,
    paddingBottom: 2,
  },
  categoryChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  categoryChipText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '600',
  },
  gridContent: {
    gap: 6,
  },
  gridRow: {
    gap: 6,
  },
  tile: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  tileCompact: {
    minHeight: 42,
    paddingVertical: 4,
  },
  tileLabel: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
