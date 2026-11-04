import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radii, spacing, touchTarget, typography } from '../theme';

type AppButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  accessibilityHint?: string;
};

/**
 * Design-system button: primary uses the accent/CTA color, secondary is an
 * outline button. Flat design — color shift on press, no elevation.
 */
export function AppButton({
  label,
  onPress,
  variant = 'primary',
  accessibilityHint,
}: AppButtonProps) {
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : styles.secondary,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.label, isPrimary ? styles.primaryLabel : styles.secondaryLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchTarget + 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md - 4,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.sm,
  },
  primary: {
    backgroundColor: colors.accent,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    ...typography.bodyStrong,
  },
  primaryLabel: {
    color: colors.onAccent,
  },
  secondaryLabel: {
    color: colors.primary,
  },
});
