import { StyleSheet } from 'react-native';

import { radii, spacing, touchTarget, typography } from '../../theme';

export const paywallStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(11, 43, 40, 0.45)',
  },
  backdropCentered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  sheet: {
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    maxHeight: '90%',
  },
  sheetCentered: {
    width: '100%',
    maxWidth: 520,
    borderRadius: radii.lg,
    maxHeight: '88%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  title: {
    ...typography.title,
    fontSize: 21,
  },
  subtitle: {
    ...typography.caption,
    opacity: 0.85,
  },
  closeBtn: {
    minWidth: touchTarget,
    minHeight: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    ...typography.bodyStrong,
  },
  devBanner: {
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  devBannerText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  devResetText: {
    fontSize: 12,
    fontWeight: '700',
  },
  scrollContent: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: spacing.xs,
  },
  planCard: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  planCardFeatured: {
    borderWidth: 2,
  },
  planTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  planTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  planTitle: {
    ...typography.bodyStrong,
  },
  planPrice: {
    ...typography.bodyStrong,
  },
  planDesc: {
    ...typography.caption,
    opacity: 0.85,
  },
  bullets: {
    gap: 4,
    marginTop: 2,
  },
  bulletText: {
    fontSize: 13,
    lineHeight: 18,
  },
  ctaBtn: {
    minHeight: touchTarget,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  ctaBtnText: {
    ...typography.bodyStrong,
    fontSize: 15,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  compactCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: spacing.xs,
    justifyContent: 'space-between',
  },
  compactTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  compactSub: {
    fontSize: 12,
    lineHeight: 16,
    opacity: 0.85,
  },
  compactPriceBtn: {
    minHeight: 38,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    marginTop: spacing.xs,
  },
  compactPriceText: {
    fontSize: 13,
    fontWeight: '700',
  },
  footer: {
    borderTopWidth: 1,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  footerLink: {
    fontSize: 13,
    fontWeight: '600',
    paddingVertical: 4,
  },
  legalNote: {
    fontSize: 11,
    lineHeight: 15,
    opacity: 0.75,
  },
  pressed: {
    opacity: 0.78,
  },
});
