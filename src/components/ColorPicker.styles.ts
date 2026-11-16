import { StyleSheet } from 'react-native';

import { radii, spacing, touchTarget, typography } from '../theme';

export const COLOR_PICKER_FIELD_HEIGHT = 148;
export const COLOR_PICKER_HUE_HEIGHT = 28;
export const COLOR_PICKER_THUMB_SIZE = 22;

export const colorPickerStyles = StyleSheet.create({
  root: {
    borderTopWidth: 1,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...typography.caption,
  },
  preview: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
  },
  hex: {
    ...typography.caption,
    opacity: 0.75,
  },
  close: {
    minWidth: touchTarget,
    minHeight: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  closeText: {
    ...typography.caption,
  },
  field: {
    height: COLOR_PICKER_FIELD_HEIGHT,
    borderRadius: radii.sm,
    borderWidth: 1,
    overflow: 'hidden',
  },
  thumb: {
    position: 'absolute',
    width: COLOR_PICKER_THUMB_SIZE,
    height: COLOR_PICKER_THUMB_SIZE,
    borderRadius: COLOR_PICKER_THUMB_SIZE / 2,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  hue: {
    height: COLOR_PICKER_HUE_HEIGHT,
    borderRadius: radii.sm,
    borderWidth: 1,
    overflow: 'hidden',
  },
  hueThumb: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 4,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  hint: {
    ...typography.caption,
    opacity: 0.75,
  },
  pressed: {
    opacity: 0.65,
  },
});
