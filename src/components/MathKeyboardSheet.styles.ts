import { StyleSheet } from 'react-native';

import { radii, spacing, touchTarget, typography } from '../theme';

export const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    justifyContent: 'flex-end',
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
    overflow: 'hidden',
    width: '100%',
  },
  sheetCentered: {
    borderRadius: radii.lg,
    maxWidth: 560,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  title: {
    ...typography.title,
    fontSize: 16,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerBtn: {
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnText: {
    ...typography.caption,
    fontWeight: '600',
  },
  primaryBtn: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    ...typography.caption,
    fontWeight: '700',
  },
  previewCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 92,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewPlaceholder: {
    ...typography.caption,
    opacity: 0.6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  latexInput: {
    flex: 1,
    minHeight: 40,
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    fontSize: 14,
  },
  iconActionBtn: {
    minWidth: touchTarget,
    minHeight: 40,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  iconActionText: {
    ...typography.caption,
    fontWeight: '600',
  },
  tabsContainer: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  tabChip: {
    minHeight: 34,
    paddingHorizontal: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
  },
  tabChipText: {
    ...typography.caption,
    fontWeight: '600',
  },
  listArea: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    height: 224,
  },
  keyGridContent: {
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  keyColumnWrapper: {
    gap: spacing.xs,
  },
  keyBtn: {
    flex: 1,
    minHeight: touchTarget,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  keyLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  formulaCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
    minHeight: touchTarget,
    justifyContent: 'center',
  },
  formulaTitle: {
    ...typography.caption,
    fontWeight: '700',
  },
  formulaPreview: {
    fontSize: 13,
    marginTop: 2,
    opacity: 0.85,
  },
  pressed: {
    opacity: 0.72,
  },
});
