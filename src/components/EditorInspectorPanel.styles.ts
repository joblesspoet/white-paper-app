import { StyleSheet } from 'react-native';

import { radii, spacing, touchTarget, typography } from '../theme';

export const editorInspectorStyles = StyleSheet.create({
  panel: {
    borderLeftWidth: 1,
  },
  dockedPanel: {
    height: '100%',
  },
  overlayPanel: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 25,
    borderLeftWidth: 1,
  },
  edgeTabContainer: {
    position: 'absolute',
    right: 0,
    top: spacing.lg,
    zIndex: 24,
  },
  edgeTab: {
    minWidth: touchTarget,
    minHeight: touchTarget * 2,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderTopLeftRadius: radii.md,
    borderBottomLeftRadius: radii.md,
    borderWidth: 1,
    borderRightWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  edgeTabBadge: {
    ...typography.caption,
    fontWeight: '700',
    fontSize: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    gap: spacing.xs,
  },
  headerTextWrap: {
    flex: 1,
    gap: 4,
  },
  headerTitle: {
    ...typography.bodyStrong,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  badgeText: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '700',
  },
  collapseButton: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  section: {
    gap: spacing.xs,
  },
  sectionLabel: {
    ...typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    opacity: 0.72,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  actionButton: {
    flex: 1,
    minWidth: 76,
    minHeight: touchTarget,
    borderRadius: radii.sm,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
  },
  actionLabel: {
    ...typography.caption,
    fontWeight: '600',
  },
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
  },
  swatchButton: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  customSwatch: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    minWidth: touchTarget,
    minHeight: touchTarget,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  chipLabel: {
    ...typography.caption,
    fontWeight: '600',
  },
  boldPreview: {
    fontWeight: '700',
  },
  italicPreview: {
    fontStyle: 'italic',
  },
  metaCard: {
    borderRadius: radii.sm,
    borderWidth: 1,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaKey: {
    ...typography.caption,
    opacity: 0.72,
  },
  metaValue: {
    ...typography.caption,
    fontWeight: '600',
  },
  multiHint: {
    ...typography.caption,
    lineHeight: 18,
    opacity: 0.85,
  },
  pressed: {
    opacity: 0.65,
  },
});
