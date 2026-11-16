import { StyleSheet } from 'react-native';

import { radii, spacing, touchTarget, typography } from '../theme';

export const homeStyles = StyleSheet.create({
  root: {
    flex: 1,
  },
  row: {
    gap: spacing.md,
  },
  listHeader: {
    paddingTop: spacing.md,
    marginBottom: spacing.md,
  },
  twoPaneBody: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xl,
    paddingTop: spacing.md,
  },
  sidebar: {
    borderRightWidth: 1,
    paddingRight: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm + 2,
  },
  sidebarButton: {
    minHeight: touchTarget + 4,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: radii.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sidebarButtonPressed: {
    opacity: 0.78,
  },
  sidebarButtonText: {
    ...typography.bodyStrong,
    fontSize: 14,
  },
  sidebarCard: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  sidebarMetaTitle: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  sidebarMetaBody: {
    ...typography.caption,
    opacity: 0.82,
    lineHeight: 18,
  },
  gridPane: {
    flex: 1,
    gap: spacing.md,
  },
  twoPaneSearchHeader: {
    gap: spacing.sm,
  },
  sectionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeading: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  sectionCount: {
    ...typography.caption,
    opacity: 0.78,
  },
  storageBanner: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radii.sm,
  },
  storageBannerText: {
    ...typography.caption,
    lineHeight: 18,
  },
  importFooter: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  importFooterText: {
    ...typography.bodyStrong,
    fontSize: 14,
  },
  itemSeparator: {
    height: spacing.md,
  },
});
