import { StyleSheet } from 'react-native';

import { spacing } from '../theme';

export const actionIslandStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  // Flat design: depth comes from the 1px border, never a drop shadow.
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    padding: 4,
    gap: 4,
  },
  anchor: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  iconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  insert: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
  },
  insertActive: {
    opacity: 0.92,
  },
  pressed: {
    opacity: 0.65,
  },
  label: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '600',
  },
  dot: {
    position: 'absolute',
    right: -3,
    top: -2,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
});
