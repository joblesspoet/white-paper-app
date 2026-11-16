import { StyleSheet } from 'react-native';

import { radii, spacing, touchTarget, typography } from '../theme';

export const shapeOptionsSheetStyles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    zIndex: 25,
  },
  popoverLayer: {
    position: 'absolute',
    zIndex: 25,
  },
  sheet: {
    width: '100%',
    maxWidth: 460,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  sheetContent: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    ...typography.bodyStrong,
  },
  done: {
    minHeight: touchTarget,
    minWidth: touchTarget,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  doneText: {
    ...typography.bodyStrong,
  },
  label: {
    ...typography.caption,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
  },
  choice: {
    minWidth: touchTarget,
    minHeight: touchTarget,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radii.sm,
    borderWidth: 2,
  },
  customSwatch: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
