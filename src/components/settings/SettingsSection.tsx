import { memo, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import type { ThemeColors } from '../../theme';
import { settingsSectionStyles as styles } from './SettingsSection.styles';

type SettingsSectionProps = {
  title: string;
  caption?: string;
  destructive?: boolean;
  theme: ThemeColors;
  children: ReactNode;
};

export const SettingsSection = memo(function SettingsSection({
  title,
  caption,
  destructive = false,
  theme,
  children,
}: SettingsSectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text
          style={[
            styles.title,
            { color: destructive ? theme.destructive : theme.primary },
          ]}
        >
          {title}
        </Text>
        {caption ? (
          <Text style={[styles.subtitle, { color: theme.foreground }]}>{caption}</Text>
        ) : null}
      </View>
      <View
        style={[
          styles.card,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        {children}
      </View>
    </View>
  );
});
