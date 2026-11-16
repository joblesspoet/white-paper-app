import { StyleSheet } from 'react-native';

import { radii, spacing, touchTarget, typography } from '../theme';

export const imageSourceSheetStyles = StyleSheet.create({
  layer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  layerCentered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(19, 78, 74, 0.24)',
  },
  sheet: {
    width: '100%',
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    maxHeight: '85%',
  },
  sheetModal: {
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  title: {
    ...typography.title,
  },
  close: {
    padding: spacing.sm,
    minHeight: touchTarget,
    minWidth: touchTarget,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  errorBanner: {
    padding: spacing.md,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#F87171',
    borderRadius: radii.sm,
    gap: spacing.sm,
  },
  errorText: {
    ...typography.caption,
    color: '#991B1B',
  },
  settingsBtn: {
    minHeight: touchTarget,
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: '#FEE2E2',
    borderRadius: radii.sm,
  },
  settingsBtnText: {
    ...typography.caption,
    color: '#B91C1C',
    fontWeight: '600',
  },
  cardsStack: {
    gap: spacing.lg,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  card: {
    gap: spacing.sm,
  },
  cardColumn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  cardTitle: {
    ...typography.bodyStrong,
  },
  cardHint: {
    ...typography.body,
  },
});
