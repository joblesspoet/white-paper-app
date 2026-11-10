import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from './AppButton';
import { IMAGE_SOURCE_COPY, type ImageSource } from '../media/image-source';
import { radii, spacing, touchTarget, typography, type ThemeColors } from '../theme';

type Props = {
  theme: ThemeColors;
  errorMessage?: string | null;
  onClose: () => void;
  onPick: (source: ImageSource) => void;
};

export function ImageSourceSheet({ theme, errorMessage, onClose, onPick }: Props) {
  const sources: ImageSource[] = ['camera', 'library'];
  return (
    <View style={[styles.layer, { backgroundColor: theme.background + 'E6' }]}>
      <View style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.foreground }]}>Add image</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.close}>
            <Text style={{ color: theme.foreground }}>Close</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {errorMessage && (
            <View style={styles.errorBanner} accessibilityRole="alert">
              <Text style={styles.errorText}>{errorMessage}</Text>
              {errorMessage.includes('Settings') && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open system settings"
                  onPress={() => { void Linking.openSettings(); }}
                  style={styles.settingsBtn}
                >
                  <Text style={styles.settingsBtnText}>Open Settings</Text>
                </Pressable>
              )}
            </View>
          )}
          {sources.map((source) => {
            const copy = IMAGE_SOURCE_COPY[source];
            return (
              <View key={source} style={styles.card}>
                <Text style={[styles.cardTitle, { color: theme.foreground }]}>{copy.title}</Text>
                <Text style={[styles.cardHint, { color: theme.foreground }]}>{copy.hint}</Text>
                <AppButton label={copy.action} accessibilityHint={copy.hint} onPress={() => onPick(source)} />
              </View>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderWidth: 1,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#99F6E4',
  },
  title: { ...typography.title },
  close: { padding: spacing.sm, minHeight: touchTarget, justifyContent: 'center' },
  content: { padding: spacing.lg, gap: spacing.lg },
  errorBanner: {
    padding: spacing.md,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#F87171',
    borderRadius: radii.sm,
    gap: spacing.sm,
  },
  errorText: {
    ...typography.caption,
    color: '#991B1B',
  },
  settingsBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: '#FEE2E2',
    borderRadius: radii.sm,
  },
  settingsBtnText: {
    ...typography.caption,
    color: '#B91C1C',
    fontWeight: '600',
  },
  card: { gap: spacing.sm },
  cardTitle: { ...typography.bodyStrong },
  cardHint: { ...typography.body },
});