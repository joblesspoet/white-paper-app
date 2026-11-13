import { StyleSheet } from 'react-native';

import { radii, spacing, typography } from '../theme';

export const faceCamStyles = StyleSheet.create({
  bubbleContainer: {
    position: 'absolute',
    zIndex: 45,
    overflow: 'hidden',
  },
  pressableFill: {
    flex: 1,
    overflow: 'hidden',
  },
  cameraFill: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  fallbackPreview: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xs,
  },
  fallbackBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  fallbackLabel: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  fallbackSubLabel: {
    ...typography.caption,
    fontSize: 9,
    marginTop: 2,
    textAlign: 'center',
  },
  recDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#DC2626',
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xs,
    gap: 4,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  controlButton: {
    minWidth: 32,
    height: 28,
    paddingHorizontal: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlText: {
    fontSize: 10,
    fontWeight: '700',
  },
  permissionBanner: {
    position: 'absolute',
    zIndex: 45,
    width: 224,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  permissionTitle: {
    ...typography.caption,
    fontWeight: '700',
  },
  permissionBody: {
    ...typography.caption,
    fontSize: 12,
  },
  permissionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
    marginTop: 2,
  },
  permissionButton: {
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionButtonText: {
    ...typography.caption,
    fontWeight: '700',
  },
});
