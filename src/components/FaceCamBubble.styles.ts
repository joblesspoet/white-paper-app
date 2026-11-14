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
  controlsPill: {
    position: 'absolute',
    zIndex: 60,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    padding: 5,
    borderRadius: radii.md,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 20,
  },
  controlButton: {
    minWidth: 36,
    height: 32,
    paddingHorizontal: 7,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlText: {
    fontSize: 11,
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
