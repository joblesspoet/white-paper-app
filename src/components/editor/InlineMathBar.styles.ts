import { StyleSheet } from 'react-native';

import { radii } from '../../theme';

export const inlineMathBarStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radii.sm + 2,
    borderWidth: 1.5,
    zIndex: 40,
  },
  slotLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  input: {
    flex: 1,
    minHeight: 36,
    fontSize: 14,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  navButton: {
    minHeight: 36,
    paddingHorizontal: 7,
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keypadButton: {
    minHeight: 36,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  doneButton: {
    minHeight: 36,
    paddingHorizontal: 10,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
