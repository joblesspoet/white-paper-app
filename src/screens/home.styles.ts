import { StyleSheet } from 'react-native';

import { colors, radii, spacing, touchTarget, typography } from '../theme';

export const homeStyles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.md, paddingBottom: spacing.lg },
  wordmark: { ...typography.display },
  subtitle: { ...typography.body, marginTop: spacing.xs },
  iconButton: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm },
  row: { gap: spacing.md },
  customizeLink: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  customizeLinkText: { fontSize: 14, fontWeight: '600' },
  listHeader: { marginBottom: spacing.lg },
  empty: { alignItems: 'center', marginTop: spacing.xxl, padding: spacing.xl, borderWidth: 1, borderRadius: radii.lg },
  emptyIcon: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  emptyTitle: { ...typography.title, textAlign: 'center' },
  emptyBody: { ...typography.body, textAlign: 'center', marginTop: spacing.sm, maxWidth: 300, lineHeight: 24 },
  emptyButton: { minHeight: touchTarget + 4, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radii.sm, marginTop: spacing.xl },
  emptyButtonText: { ...typography.bodyStrong, color: colors.onAccent },
  import: { minHeight: touchTarget, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg },
  importText: { ...typography.bodyStrong },
  storageBanner: { marginHorizontal: spacing.lg, marginBottom: spacing.md, padding: spacing.md, borderWidth: 1, borderRadius: radii.sm },
  storageBannerText: { ...typography.caption, lineHeight: 18 },
  loading: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  loadingText: { ...typography.body },
});
