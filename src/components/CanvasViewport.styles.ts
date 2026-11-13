import { StyleSheet } from 'react-native';

import { radii, spacing, touchTarget, typography } from '../theme';

export const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  object: { position: 'absolute', overflow: 'hidden' },
  hud: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  snapBadge: {
    minHeight: touchTarget,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  snapBadgeCompact: {
    minHeight: 34,
    paddingHorizontal: spacing.sm,
  },
  zoomPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    overflow: 'hidden',
  },
  zoomStepButton: {
    minHeight: touchTarget,
    minWidth: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  zoomStepButtonCompact: {
    minHeight: 34,
    minWidth: 32,
    paddingHorizontal: 3,
  },
  zoomStepGlyph: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 20,
  },
  zoomStepGlyphCompact: {
    fontSize: 15,
    lineHeight: 17,
  },
  zoomPercentWrap: {
    minHeight: touchTarget,
    minWidth: 54,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  zoomPercentWrapCompact: {
    minHeight: 34,
    minWidth: 40,
    paddingHorizontal: 5,
  },
  zoomText: { ...typography.caption, fontWeight: '600', fontVariant: ['tabular-nums'] },
  zoomTextCompact: { fontSize: 12, lineHeight: 16 },
  resetButton: {
    minHeight: touchTarget,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
  },
  resetButtonCompact: {
    minHeight: 34,
    paddingHorizontal: spacing.sm,
  },
  resetText: { ...typography.caption, fontWeight: '600' },
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
