import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '../src/components/AppButton';
import { BoardIcon, SettingsIcon } from '../src/components/icons';
import { colors, radii, spacing, touchTarget, typography } from '../src/theme';

/**
 * Home placeholder. Navigation shell only — the board list, board creation and
 * persistence land in later slices.
 */
export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.wordmark}>FlowCanvas</Text>
          <Text style={styles.subtitle}>Capture ideas naturally.</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open settings"
          onPress={() => router.push('/settings')}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <SettingsIcon />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.notice}>
          <BoardIcon size={28} />
          <Text style={styles.noticeTitle}>No boards yet</Text>
          <Text style={styles.noticeBody}>
            The board grid, creation, and local storage arrive in the next slices.
            For now this screen exercises the navigation shell.
          </Text>
        </View>

        <View style={styles.actions}>
          <AppButton
            label="New board"
            accessibilityHint="Opens the board editor placeholder"
            onPress={() => router.push('/editor')}
          />
          <AppButton
            label="Settings"
            variant="secondary"
            accessibilityHint="Opens the settings placeholder"
            onPress={() => router.push('/settings')}
          />
        </View>

        <Text style={styles.hint}>
          Stack ready: Home → Board editor, Home → Settings, and back to Home.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  headerText: {
    flexShrink: 1,
  },
  wordmark: {
    ...typography.display,
    color: colors.foreground,
  },
  subtitle: {
    ...typography.body,
    marginTop: spacing.xs,
    color: colors.primary,
  },
  iconButton: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pressed: {
    opacity: 0.7,
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  notice: {
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
  },
  noticeTitle: {
    ...typography.subtitle,
    color: colors.foreground,
  },
  noticeBody: {
    ...typography.body,
    color: colors.foreground,
    opacity: 0.85,
  },
  actions: {
    gap: spacing.sm,
  },
  hint: {
    ...typography.caption,
    color: colors.primary,
  },
});
