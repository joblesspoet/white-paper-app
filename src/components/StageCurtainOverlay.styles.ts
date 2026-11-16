import { StyleSheet } from 'react-native';

import { radii, spacing, touchTarget, typography } from '../theme';

export const stageCurtainOverlayStyles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 18,
  },
  curtainShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(13, 148, 136, 0.94)',
    borderColor: '#0F766E',
  },
  curtainHandleBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  curtainHandlePill: {
    minWidth: 140,
    height: 32,
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  curtainHandleGrip: {
    width: 28,
    height: 4,
    borderRadius: 2,
  },
  curtainHandleLabel: {
    ...typography.caption,
    fontWeight: '600',
  },
  spotlightCanvas: {
    ...StyleSheet.absoluteFill,
  },
  spotlightMoveRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderWidth: 2,
    borderColor: '#2DD4BF',
  },
  spotlightResizeHandle: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotlightResizeDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#0D9488',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  controlBar: {
    position: 'absolute',
    top: spacing.sm,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    padding: 4,
    gap: 4,
  },
  modeChip: {
    minHeight: touchTarget,
    minWidth: touchTarget,
    paddingHorizontal: spacing.sm,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeChipText: {
    ...typography.caption,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.72,
  },
});
