import { memo } from 'react';
import { Linking, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from './AppButton';
import { IMAGE_SOURCE_COPY, type ImageSource } from '../media/image-source';
import { resolveFlowModalLayout } from '../responsive/layout';
import type { ThemeColors } from '../theme';
import { imageSourceSheetStyles as styles } from './ImageSourceSheet.styles';

type Props = {
  theme: ThemeColors;
  errorMessage?: string | null;
  onClose: () => void;
  onPick: (source: ImageSource) => void;
};

export const ImageSourceSheet = memo(function ImageSourceSheet({ theme, errorMessage, onClose, onPick }: Props) {
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
});
