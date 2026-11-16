import { StyleSheet } from 'react-native';

import { SETTINGS_TABLET_MAX_WIDTH } from '../responsive/layout';
import { radii, spacing, typography } from '../theme';

export const settingsStyles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingTop: spacing.md,
    gap: spacing.lg,
  },
  column: {
    width: '100%',
    gap: spacing.lg,
  },
  tabletColumn: {
    maxWidth: SETTINGS_TABLET_MAX_WIDTH,
    alignSelf: 'center',
  },
  tabletStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  tabletStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tabletStatusTitle: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tabletStatusMeta: {
    ...typography.caption,
    opacity: 0.78,
  },
  colorChip: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(19, 78, 74, 0.2)',
  },
  widthIndicator: {
    width: 24,
    borderRadius: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  infoText: {
    ...typography.caption,
    flexShrink: 1,
    lineHeight: 18,
    opacity: 0.88,
  },
  footerColophon: {
    alignItems: 'center',
    paddingTop: spacing.sm,
    gap: 2,
  },
  footerTitle: {
    ...typography.caption,
    fontWeight: '600',
    opacity: 0.78,
  },
  footerSubtitle: {
    ...typography.caption,
    fontSize: 12,
    opacity: 0.62,
  },
});
