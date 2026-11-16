import { StyleSheet } from 'react-native';

import { radii, spacing, touchTarget, typography } from '../../theme';

export const customizeBoardModalStyles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(19, 78, 74, 0.24)',
  },
  scrimCentered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  sheet: {
    padding: spacing.lg,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderTopWidth: 1,
    gap: spacing.md,
  },
  sheetModal: {
    width: '100%',
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  grabber: {
    width: 44,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
  },
  title: {
    ...typography.title,
  },
  body: {
    ...typography.body,
    opacity: 0.78,
    fontSize: 15,
  },
  label: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: spacing.xs,
  },
  choiceRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  choiceWrap: {
    flexWrap: 'wrap',
  },
  choice: {
    flex: 1,
    minWidth: 92,
    minHeight: touchTarget,
    paddingHorizontal: spacing.sm,
    borderWidth: 1.5,
    borderRadius: radii.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
  },
  swatch: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
  },
  choiceText: {
    ...typography.bodyStrong,
    fontSize: 14,
  },
  cancel: {
    minHeight: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    ...typography.bodyStrong,
  },
});
