import { StyleSheet } from 'react-native';

import { DOCK_TOUCH_TARGET, TOOL_RAIL_WIDTH } from '../../responsive/layout';
import { radii, spacing, typography } from '../../theme';

export const editorToolRailStyles = StyleSheet.create({
  rail: {
    width: TOOL_RAIL_WIDTH,
    borderRightWidth: 1,
  },
  railContent: {
    alignItems: 'center',
    paddingTop: spacing.md,
    gap: spacing.xs,
  },
  tool: {
    minWidth: DOCK_TOUCH_TARGET,
    minHeight: DOCK_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    gap: 2,
  },
  toolIconWrap: {
    width: 38,
    height: 32,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolLabel: {
    ...typography.caption,
    fontSize: 11,
    textAlign: 'center',
  },
  toolPressed: {
    opacity: 0.65,
  },
  railDivider: {
    width: 32,
    height: 1,
    marginVertical: spacing.xs,
  },
});
