import { StyleSheet } from 'react-native';

import { radii, spacing, typography } from '../theme';

export const inkingQuickTrayStyles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 15,
  },
  trayCard: {
    maxWidth: 420,
    marginHorizontal: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  rows: {
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  toolSegment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingRight: spacing.xs,
    borderRightWidth: 1,
  },
  toolButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sizeSegment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.xs,
  },
  segmentLabel: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.6,
  },
  sizeButton: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSegment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: spacing.xs,
    paddingRight: spacing.xs,
    borderLeftWidth: 1,
  },
  colorSwatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(19, 78, 74, 0.14)',
  },
  customColorSwatch: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  laserChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  laserDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
  },
  laserChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  optionsButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
  },
  colorPickerWrapper: {
    minWidth: 280,
    padding: spacing.xs,
  },
  pressed: {
    opacity: 0.65,
  },
});
