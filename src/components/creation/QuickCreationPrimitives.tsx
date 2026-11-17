import { memo, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { type ThemeColors } from '../../theme';
import { PlusIcon } from '../icons';
import { ProBadge, type ProBadgeVariant } from '../monetization/ProBadge';
import { styles } from '../QuickCreationSheet.styles';

type SectionAction = {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
};

export const QuickCreationSection = memo(function QuickCreationSection({
  theme,
  label,
  action,
  children,
}: {
  theme: ThemeColors;
  label: string;
  action?: SectionAction;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionLabel, { color: theme.foreground }]}>{label}</Text>
        {action && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={action.accessibilityLabel}
            onPress={action.onPress}
            style={({ pressed }) => [styles.sectionAction, pressed && styles.pressed]}
          >
            <Text style={[styles.sectionActionText, { color: theme.primary }]}>{action.label}</Text>
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
});

export const QuickCreationCard = memo(function QuickCreationCard({
  theme,
  accessibilityLabel,
  accessibilityHint,
  title,
  caption,
  icon,
  iconBackground,
  onPress,
}: {
  theme: ThemeColors;
  accessibilityLabel: string;
  accessibilityHint: string;
  title: string;
  caption: string;
  icon: ReactNode;
  iconBackground?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.background, borderColor: theme.border },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.iconPill, { backgroundColor: iconBackground ?? theme.primary + '18' }]}>
        {icon}
      </View>
      <View style={styles.cardText}>
        <Text style={[styles.cardTitle, { color: theme.foreground }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.cardCaption, { color: theme.foreground + '99' }]} numberOfLines={2}>
          {caption}
        </Text>
      </View>
    </Pressable>
  );
});

export const QuickCreationTile = memo(function QuickCreationTile({
  theme,
  accessibilityLabel,
  label,
  icon,
  badge,
  badgeVariant = 'pro',
  onPress,
}: {
  theme: ThemeColors;
  accessibilityLabel: string;
  label: string;
  icon: ReactNode;
  badge?: string;
  badgeVariant?: ProBadgeVariant;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: theme.background, borderColor: theme.border },
        pressed && styles.pressed,
      ]}
    >
      {badge && (
        <View style={{ position: 'absolute', top: 4, right: 4 }}>
          <ProBadge label={badge} variant={badgeVariant} theme={theme} compact />
        </View>
      )}
      {icon}
      <Text style={[styles.tileLabel, { color: theme.foreground }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
});

export const QuickCreationSwatchRow = memo(function QuickCreationSwatchRow({
  theme,
  label,
  addLabel,
  onAdd,
  children,
}: {
  theme: ThemeColors;
  label: string;
  addLabel: string;
  onAdd: () => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.swatchGroup}>
      <Text style={[styles.swatchLabel, { color: theme.foreground }]}>{label}</Text>
      <View style={styles.swatchRow}>
        {children}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={addLabel}
          onPress={onAdd}
          style={({ pressed }) => [styles.swatch, pressed && styles.pressed]}
        >
          <View
            style={[
              styles.swatchChip,
              styles.swatchAdd,
              { borderColor: theme.border, backgroundColor: theme.muted },
            ]}
          >
            <PlusIcon size={12} color={theme.foreground} />
          </View>
        </Pressable>
      </View>
    </View>
  );
});

export const QuickCreationSwatch = memo(function QuickCreationSwatch({
  accessibilityLabel,
  color,
  borderColor,
  onPress,
}: {
  accessibilityLabel: string;
  color: string;
  borderColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.swatch, pressed && styles.pressed]}
    >
      <View style={[styles.swatchChip, { backgroundColor: color, borderColor }]} />
    </Pressable>
  );
});
