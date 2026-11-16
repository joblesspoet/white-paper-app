import { memo, useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from './AppButton';
import { EXPLODE_MIN_TEXT_LENGTH } from '../ocr/ocr-explode';
import {
  canAddRecognizedText,
  normalizeRecognizedText,
  ocrEngineLabel,
  ocrRegionLabel,
  type OcrRegion,
  type OcrReviewState,
} from '../ocr/ocr-service';
import { resolveFlowModalLayout } from '../responsive/layout';
import { spacing, type ThemeColors } from '../theme';
import { ocrReviewScreenStyles as styles } from './OcrReviewScreen.styles';

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
  onExplodeStickyNotes?: () => void;
  onAddImageOnly: () => void;
  onClose: () => void;
};

const RegionChip = memo(function RegionChip({
  region,
  theme,
}: {
  region: OcrRegion;
  theme: ThemeColors;
}) {
  return (
    <View
      style={[
        styles.regionChip,
        { borderColor: theme.border, backgroundColor: theme.surface },
      ]}
    >
      <Text numberOfLines={1} style={[styles.regionChipText, { color: theme.foreground }]}>
        {region.text}
      </Text>
    </View>
  );
});

/**
 * OCR review: preview the placed image, correct the recognized text, then
 * add a text block, explode regions into spatial sticky notes, or place the
 * image alone. Adapts to a two-column layout on tablets and landscape viewports.
 */
export const OcrReviewScreen = memo(function OcrReviewScreen({
  theme,
  uri,
  width,
  height,
  state,
  onChangeText,
  onRetry,
  onAddText,
  onExplodeStickyNotes,
  onAddImageOnly,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const { ocrLayout, profile } = resolveFlowModalLayout(winWidth, winHeight);
  const twoColumn = ocrLayout === 'two-column';

  const canAddText = canAddRecognizedText(state);
  const explodableRegions = useMemo(
    () =>
      (state.regions ?? []).filter(
        (r) => normalizeRecognizedText(r.text).length >= EXPLODE_MIN_TEXT_LENGTH,
      ),
    [state.regions],
  );
  const explodeCount =
    explodableRegions.length >= 2 ? explodableRegions.length : state.regionCount;
  const canExplode =
    Boolean(onExplodeStickyNotes) &&
    state.status === 'success' &&
    state.regionCount >= 2 &&
    explodeCount >= 2;

  const ratio = height > 0 ? width / height : 1;
  const previewRatio = Math.min(Math.max(ratio, 0.55), 2.4);

  const keyExtractor = useCallback(
    (item: OcrRegion, index: number) => `${index}-${item.boundingBox.x}-${item.boundingBox.y}`,
    [],
  );

  const renderRegionChip = useCallback(
    ({ item }: ListRenderItemInfo<OcrRegion>) => <RegionChip region={item} theme={theme} />,
    [theme],
  );

  const previewSection = (
    <View style={[styles.previewColumn, twoColumn && styles.previewColumnTwoPane]}>
      <View
        style={[
          styles.preview,
          { borderColor: theme.border, backgroundColor: theme.muted },
        ]}
      >
        <Image
          source={{ uri }}
          style={[
            styles.previewImage,
            { aspectRatio: previewRatio, maxHeight: twoColumn ? 360 : 260 },
          ]}
          resizeMode="contain"
          accessibilityLabel="Imported image being reviewed"
        />
      </View>

      <Text style={[styles.assurance, { color: theme.foreground }]}>
        Text is read on this device. Nothing is uploaded.
      </Text>
    </View>
  );

  const textAndActionsSection = (
    <View style={[styles.textColumn, twoColumn && styles.textColumnTwoPane]}>
      {state.status === 'loading' && (
        <View
          style={styles.statusRow}
          accessibilityRole="progressbar"
          accessibilityLabel="Reading text on this device"
        >
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
            {ocrRegionLabel(state.regionCount)} · {ocrEngineLabel(state.engine)}
          </Text>
          {explodableRegions.length >= 2 && (
            <FlatList
              horizontal
              data={explodableRegions}
              keyExtractor={keyExtractor}
              renderItem={renderRegionChip}
              style={styles.regionStrip}
              contentContainerStyle={styles.regionStripContent}
              showsHorizontalScrollIndicator={false}
            />
          )}
          <TextInput
            style={[
              styles.textField,
              {
                color: theme.foreground,
                borderColor: theme.border,
                backgroundColor: theme.surface,
                minHeight: twoColumn ? 220 : 180,
              },
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
        {canExplode && onExplodeStickyNotes && (
          <AppButton
            label={`Explode into sticky notes (${explodeCount})`}
            variant="secondary"
            onPress={onExplodeStickyNotes}
            accessibilityHint="Split each recognized text region into movable sticky notes in the same 2D layout."
          />
        )}
        <AppButton
          label="Add image only"
          variant="secondary"
          onPress={onAddImageOnly}
          accessibilityHint="Place the image and keep the recognized text attached to it without adding a text block."
        />
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[
        styles.root,
        {
          backgroundColor: theme.background,
          paddingTop: insets.top,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={[
          styles.header,
          profile.isCompactHeight && styles.headerCompact,
          { borderBottomColor: theme.border },
        ]}
      >
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
        contentContainerStyle={[
          styles.content,
          twoColumn && styles.contentTwoColumn,
          { paddingBottom: insets.bottom + spacing.lg },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {previewSection}
        {textAndActionsSection}
      </ScrollView>
    </KeyboardAvoidingView>
  );
});
