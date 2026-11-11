import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from './AppButton';
import {
  canAddRecognizedText,
  ocrEngineLabel,
  ocrTextLineLabel,
  type OcrReviewState,
} from '../ocr/ocr-service';
import { radii, spacing, touchTarget, typography, type ThemeColors } from '../theme';

type Props = {
  theme: ThemeColors;
  /** Durable placed image; the review never reads the cache working copy. */
  uri: string;
  width: number;
  height: number;
  state: OcrReviewState;
  onChangeText: (text: string) => void;
  onRetry: () => void;
  onAddText: () => void;
  onAddImageOnly: () => void;
  onClose: () => void;
};

/**
 * OCR review: preview the placed image, correct the recognized text, then
 * either add the text with the image or place the image alone. The image action
 * stays available in loading, empty, and error states by design.
 */
export function OcrReviewScreen({
  theme,
  uri,
  width,
  height,
  state,
  onChangeText,
  onRetry,
  onAddText,
  onAddImageOnly,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const canAddText = canAddRecognizedText(state);
  const ratio = height > 0 ? width / height : 1;
  const previewRatio = Math.min(Math.max(ratio, 0.55), 2.4);

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.foreground }]}>Review text</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close text review"
          onPress={onClose}
          style={styles.close}
        >
          <Text style={[styles.closeLabel, { color: theme.foreground }]}>Close</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.lg }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.preview,
            { borderColor: theme.border, backgroundColor: theme.muted },
          ]}
        >
          <Image
            source={{ uri }}
            style={[styles.previewImage, { aspectRatio: previewRatio }]}
            resizeMode="contain"
            accessibilityLabel="Imported image being reviewed"
          />
        </View>

        <Text style={[styles.assurance, { color: theme.foreground }]}>
          Text is read on this device. Nothing is uploaded.
        </Text>

        {state.status === 'loading' && (
          <View style={styles.statusRow} accessibilityRole="progressbar" accessibilityLabel="Reading text on this device">
            <ActivityIndicator color={theme.primary} />
            <Text style={[styles.statusText, { color: theme.foreground }]}>
              Reading text on this device…
            </Text>
          </View>
        )}

        {state.status === 'empty' && (
          <View style={[styles.notice, { borderColor: theme.border, backgroundColor: theme.surface }]}>
            <Text style={[styles.noticeTitle, { color: theme.foreground }]}>No text found</Text>
            <Text style={[styles.noticeText, { color: theme.foreground }]}>
              This image may be blank or contain only handwriting or artwork. You can still add
              the image, or try recognition again.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Try text recognition again"
              onPress={onRetry}
              style={styles.retry}
            >
              <Text style={[styles.retryLabel, { color: theme.primary }]}>Try again</Text>
            </Pressable>
          </View>
        )}

        {state.status === 'error' && (
          <View style={styles.errorBanner} accessibilityRole="alert">
            <Text style={styles.errorTitle}>Text recognition did not finish</Text>
            <Text style={styles.errorText}>{state.errorMessage}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Try text recognition again"
              onPress={onRetry}
              style={styles.retry}
            >
              <Text style={styles.retryLabel}>Try again</Text>
            </Pressable>
          </View>
        )}

        {state.status === 'success' && (
          <>
            <Text style={[styles.summary, { color: theme.foreground }]}>
              {ocrTextLineLabel(state.regionCount)} · {ocrEngineLabel(state.engine)}
            </Text>
            <TextInput
              style={[
                styles.textField,
                { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.surface },
              ]}
              value={state.text}
              onChangeText={onChangeText}
              multiline
              textAlignVertical="top"
              accessibilityLabel="Extracted text"
              accessibilityHint="Correct the recognized text before adding it to the board."
              placeholder="Correct the text before adding it"
              placeholderTextColor={theme.foreground}
              autoCapitalize="sentences"
              autoCorrect={false}
              spellCheck
            />
            {!canAddText && (
              <Text style={[styles.hint, { color: theme.foreground }]}>
                Add some text to place a text block, or add the image only.
              </Text>
            )}
          </>
        )}

        <View style={styles.actions}>
          <AppButton
            label="Add text to board"
            onPress={onAddText}
            disabled={!canAddText}
            accessibilityHint="Place the reviewed text as a text block below the image."
          />
          <AppButton
            label="Add image only"
            variant="secondary"
            onPress={onAddImageOnly}
            accessibilityHint="Place the image and keep the recognized text attached to it without adding a text block."
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  title: { ...typography.title },
  close: {
    padding: spacing.sm,
    minHeight: touchTarget,
    justifyContent: 'center',
  },
  closeLabel: { ...typography.bodyStrong },
  content: { padding: spacing.lg, gap: spacing.md },
  preview: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  previewImage: { width: '100%' },
  assurance: { ...typography.caption },
  summary: { ...typography.caption },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  statusText: { ...typography.body },
  notice: {
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radii.sm,
    gap: spacing.xs,
  },
  noticeTitle: { ...typography.bodyStrong },
  noticeText: { ...typography.caption },
  errorBanner: {
    padding: spacing.md,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#F87171',
    borderRadius: radii.sm,
    gap: spacing.xs,
  },
  errorTitle: { ...typography.bodyStrong, color: '#991B1B' },
  errorText: { ...typography.caption, color: '#991B1B' },
  retry: {
    alignSelf: 'flex-start',
    minHeight: touchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  retryLabel: { ...typography.caption, color: '#B91C1C', fontWeight: '700' },
  textField: {
    ...typography.body,
    minHeight: 180,
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: spacing.md,
  },
  hint: { ...typography.caption },
  actions: { gap: spacing.sm, paddingTop: spacing.sm },
});
