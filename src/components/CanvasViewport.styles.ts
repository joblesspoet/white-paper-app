import { StyleSheet } from 'react-native';

import { radii, spacing, touchTarget, typography } from '../theme';

export const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  object: { position: 'absolute', overflow: 'hidden' },
  hud: { position: 'absolute', top: spacing.sm, right: spacing.sm, alignItems: 'flex-end', gap: spacing.xs },
  viewBadge: { borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, alignItems: 'flex-end' },
  zoomText: { ...typography.bodyStrong },
  resetButton: { minHeight: touchTarget, minWidth: touchTarget, borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center' },
  resetText: { ...typography.caption },
  pressed: { opacity: 0.6 },
  tableCellOverlay: {
    position: 'absolute',
    padding: 4,
    justifyContent: 'center',
  },
  measurementLabelWrap: {
    position: 'absolute',
    transform: [{ translateX: -20 }, { translateY: -8 }],
  },
  measurementLabelText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    minWidth: 40,
  },
});
