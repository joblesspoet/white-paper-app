import { StyleSheet } from 'react-native';

import { radii, spacing, touchTarget, typography } from '../theme';

export const pageNavigatorStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    overflow: 'hidden',
  },
  pillButton: {
    minWidth: touchTarget,
    minHeight: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  pillButtonCompact: {
    minWidth: 32,
    minHeight: 34,
    paddingHorizontal: 3,
  },
  pillButtonDisabled: {
    opacity: 0.35,
  },
  pillLabelButton: {
    minHeight: touchTarget,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  pillLabelButtonCompact: {
    minHeight: 34,
    paddingHorizontal: 6,
  },
  pillLabelText: {
    ...typography.caption,
    fontWeight: '600',
  },
  pillLabelTextCompact: {
    fontSize: 12,
    lineHeight: 16,
  },
  pillAddButton: {
    minWidth: touchTarget,
    minHeight: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    paddingHorizontal: spacing.xs,
  },
  pillAddButtonCompact: {
    minWidth: 32,
    minHeight: 34,
    paddingHorizontal: 3,
  },
  pillGlyph: {
    fontSize: 16,
    fontWeight: '600',
  },
  pillGlyphCompact: {
    fontSize: 14,
  },

  scrim: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.36)',
    justifyContent: 'flex-end',
  },
  scrimCentered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  sheet: {
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderWidth: 1,
    maxHeight: '82%',
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  sheetModal: {
    width: '100%',
    borderRadius: radii.lg,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 999,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.title,
  },
  subtitle: {
    ...typography.caption,
    marginTop: 2,
  },
  closeButton: {
    minWidth: touchTarget,
    minHeight: touchTarget,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  closeText: {
    ...typography.bodyStrong,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingBottom: spacing.sm,
  },
  separator: {
    height: spacing.sm,
  },
  card: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pageBadge: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageBadgeText: {
    ...typography.bodyStrong,
  },
  cardInfo: {
    flex: 1,
    minWidth: 0,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  cardTitle: {
    ...typography.bodyStrong,
    flexShrink: 1,
  },
  pdfTag: {
    borderRadius: radii.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pdfTagText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '600',
  },
  cardMeta: {
    ...typography.caption,
    marginTop: 2,
  },
  renameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  renameInput: {
    flex: 1,
    minHeight: 36,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    ...typography.body,
  },
  renameSaveBtn: {
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  renameSaveText: {
    ...typography.caption,
    fontWeight: '600',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  actionChip: {
    minWidth: touchTarget,
    minHeight: touchTarget,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionChipDisabled: {
    opacity: 0.35,
  },
  actionChipText: {
    ...typography.caption,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
  footerButton: {
    flex: 1,
  },
});
