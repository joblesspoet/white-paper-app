import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChevronRightIcon } from '../src/components/icons';
import { colors, radii, spacing, typography } from '../src/theme';

type SettingsRow = {
  label: string;
  description: string;
  destructive?: boolean;
};

/**
 * Settings placeholder. Every row is a non-interactive preview; preferences and
 * their persistence are implemented in the settings slice.
 */
const ROWS: SettingsRow[] = [
  { label: 'Theme', description: 'Follows the system light theme for now.' },
  { label: 'Default canvas', description: 'Blank background, dot grid optional.' },
  { label: 'Pen color and width', description: 'Defaults for new strokes.' },
  { label: 'Haptics', description: 'Feedback on tool selection.' },
  { label: 'Export format', description: 'PNG, JPEG, PDF, or editable backup.' },
  { label: 'About FlowCanvas', description: 'Version 1.0.0 — local-only MVP.' },
  { label: 'Clear local data', description: 'Deletes every board on this device.', destructive: true },
];

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
    >
      <Text style={styles.intro}>
        Settings are read-only placeholders in this slice. Values below describe
        the planned defaults.
      </Text>

      <View style={styles.list}>
        {ROWS.map((row, index) => (
          <View key={row.label} style={[styles.row, index > 0 && styles.rowDivider]}>
            <View style={styles.rowText}>
              <Text style={[styles.rowLabel, row.destructive && styles.destructiveLabel]}>
                {row.label}
              </Text>
              <Text style={styles.rowDescription}>{row.description}</Text>
            </View>
            <View style={styles.trailing}>
              <Text style={styles.badge}>Soon</Text>
              <ChevronRightIcon size={18} color={colors.border} />
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  intro: {
    ...typography.body,
    color: colors.foreground,
    opacity: 0.8,
  },
  list: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowText: {
    flexShrink: 1,
    gap: spacing.xs,
  },
  rowLabel: {
    ...typography.bodyStrong,
    color: colors.foreground,
  },
  destructiveLabel: {
    color: colors.destructive,
  },
  rowDescription: {
    ...typography.caption,
    color: colors.foreground,
    opacity: 0.7,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  badge: {
    ...typography.caption,
    color: colors.primary,
    backgroundColor: colors.muted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
});
