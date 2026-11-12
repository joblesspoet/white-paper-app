import { Linking, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from './AppButton';
import { IMAGE_SOURCE_COPY, type ImageSource } from '../media/image-source';
import { resolveFlowModalLayout } from '../responsive/layout';
import { radii, spacing, touchTarget, typography, type ThemeColors } from '../theme';

type Props = {
  theme: ThemeColors;
  errorMessage?: string | null;
  onClose: () => void;
  onPick: (source: ImageSource) => void;
};

export function ImageSourceSheet({ theme, errorMessage, onClose, onPick }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { centeredModal, wideModalMaxWidth, imageSourceTwoColumn } = resolveFlowModalLayout(width, height);
  const sources: ImageSource[] = ['camera', 'library'];

  return (
    <View style={[styles.layer, centeredModal && styles.layerCentered]}>
      <Pressable
        style={styles.scrim}
        onPress={onClose}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      />
      <View
        style={[
          styles.sheet,
          centeredModal
            ? [
                styles.sheetModal,
                {
                  maxWidth: wideModalMaxWidth,
                  borderColor: theme.border,
                },
              ]
            : {
                borderColor: theme.border,
                paddingBottom: insets.bottom,
              },
          { backgroundColor: theme.surface },
        ]}
      >
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
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
          <View style={imageSourceTwoColumn ? styles.cardsRow : styles.cardsStack}>
            {sources.map((source) => {
              const copy = IMAGE_SOURCE_COPY[source];
              return (
                <View
                  key={source}
                  style={[
                    styles.card,
                    imageSourceTwoColumn && [
                      styles.cardColumn,
                      { borderColor: theme.border, backgroundColor: theme.background },
                    ],
                  ]}
                >
                  <Text style={[styles.cardTitle, { color: theme.foreground }]}>{copy.title}</Text>
                  <Text style={[styles.cardHint, { color: theme.foreground }]}>{copy.hint}</Text>
                  <AppButton label={copy.action} accessibilityHint={copy.hint} onPress={() => onPick(source)} />
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  layerCentered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(19, 78, 74, 0.24)' },
  sheet: {
    width: '100%',
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    maxHeight: '85%',
  },
  sheetModal: {
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  title: { ...typography.title },
  close: { padding: spacing.sm, minHeight: touchTarget, minWidth: touchTarget, alignItems: 'flex-end', justifyContent: 'center' },
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
    minHeight: touchTarget,
    justifyContent: 'center',
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
  cardsStack: { gap: spacing.lg },
  cardsRow: { flexDirection: 'row', gap: spacing.md },
  card: { gap: spacing.sm },
  cardColumn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  cardTitle: { ...typography.bodyStrong },
  cardHint: { ...typography.body },
});
