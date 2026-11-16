import { StyleSheet } from 'react-native';

import { radii, spacing, touchTarget, typography } from '../theme';

export const editorStyles = StyleSheet.create({
  root: {
    flex: 1,
  },
  workspace: {
    flex: 1,
    flexDirection: 'row',
    position: 'relative',
  },
  canvas: {
    flex: 1,
    margin: spacing.md,
    borderWidth: 1,
    borderRadius: radii.md,
  },
  canvasClip: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: radii.md,
  },
  canvasGuidance: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  guidanceIconBadge: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  canvasTitle: {
    ...typography.title,
    textAlign: 'center',
  },
  canvasBody: {
    ...typography.body,
    opacity: 0.72,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 22,
  },
  guidanceHintPill: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  guidanceHintText: {
    ...typography.caption,
    fontWeight: '600',
  },
  objectEditor: {
    position: 'absolute',
    zIndex: 10,
    textAlignVertical: 'top',
  },
  selectionRail: {
    position: 'absolute',
    zIndex: 20,
    borderWidth: 1,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  selectionAction: {
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionActionSeparator: {
    borderTopWidth: 1,
  },
  railTextAction: {
    fontSize: 12,
    fontWeight: '700',
  },
  editingFloatingBar: {
    position: 'absolute',
    zIndex: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: 4,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  editingBarButton: {
    minWidth: touchTarget,
    minHeight: touchTarget,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  editingBarLabel: {
    ...typography.caption,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.65,
  },
  storageBanner: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radii.sm,
  },
  storageBannerText: {
    ...typography.caption,
    lineHeight: 18,
  },
  editorLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  editorLoadingText: {
    ...typography.body,
  },
  pageNavigatorWrap: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    zIndex: 20,
  },
  tableCellInput: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 30,
  },
  revealTapeBanner: {
    position: 'absolute',
    top: spacing.md + 52,
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    zIndex: 16,
  },
  revealTapeBannerText: {
    ...typography.caption,
    fontWeight: '600',
  },
  convertInkWrap: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 30,
  },
  convertInkButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  convertInkText: {
    fontWeight: '700',
    fontSize: 13,
  },
});
