import { Stack, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radii, spacing, touchTarget, typography } from '../src/theme';

/**
 * Board editor placeholder. Canvas, tools, gestures and persistence are
 * intentionally absent — this slice only proves the route and back navigation.
 */
export default function BoardEditorScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: 'Untitled board' }} />

      <View style={styles.canvas}>
        <Text style={styles.canvasTitle}>Canvas placeholder</Text>
        <Text style={styles.canvasBody}>
          The Skia canvas, tool dock, and drawing gestures arrive in later
          slices. This route exists so navigation can be verified.
        </Text>
      </View>

      <View style={[styles.footer, { paddingBottom: spacing.md + insets.bottom }]}>
        <Text style={styles.hint}>
          Use the header back button, the iOS swipe gesture, or Android back to
          return Home.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Home"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Text style={styles.backLabel}>Back to Home</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  canvas: {
    flex: 1,
    margin: spacing.md,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.surface,
  },
  canvasTitle: {
    ...typography.subtitle,
    color: colors.foreground,
  },
  canvasBody: {
    ...typography.body,
    color: colors.foreground,
    opacity: 0.8,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  hint: {
    ...typography.caption,
    color: colors.foreground,
    opacity: 0.7,
  },
  backButton: {
    alignSelf: 'flex-start',
    minHeight: touchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  pressed: {
    opacity: 0.7,
  },
  backLabel: {
    ...typography.bodyStrong,
    color: colors.primary,
  },
});
