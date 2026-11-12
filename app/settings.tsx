import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBoards } from '../src/board-context';
import { ClearLocalDataDialog } from '../src/components/ClearLocalDataDialog';
import {
  AboutModal,
  CanvasPickerModal,
  ExportFormatPickerModal,
  PenColorPickerModal,
  PenWidthPickerModal,
  PrivacyModal,
} from '../src/components/SettingsPickers';
import { ChevronRightIcon, InfoIcon, TrashIcon } from '../src/components/icons';
import { CANVAS_COLORS } from '../src/canvas/document';
import { BOARD_STYLE_OPTIONS } from '../src/persistence/schema';
import { INK_WIDTHS } from '../src/canvas/ink';
import { getLocalDatabase } from '../src/persistence/expo-store';
import { getLocalDataStats, type LocalDataStats } from '../src/persistence/repository';
import type {
  AppTheme,
  DefaultCanvasBackground,
  DefaultCanvasStyle,
  DefaultExportFormat,
} from '../src/persistence/schema';
import { usePreferences } from '../src/settings/preferences-context';
import { PHONE_GUTTER, resolveViewportProfile, TABLET_GUTTER } from '../src/responsive/layout';
import { colors, radii, spacing, touchTarget, typography } from '../src/theme';
import { triggerHapticFeedback } from '../src/utils/haptics';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const profile = resolveViewportProfile(width, height);
  const isTablet = profile.isTablet;
  const baseGutter = isTablet ? TABLET_GUTTER : PHONE_GUTTER;

  const {
    preferences,
    resolvedTheme,
    theme,
    isDark,
    reducedMotion,
    updatePreference,
    clearAllData,
  } = usePreferences();
  const { resetBoards } = useBoards();

  // Dialog & Modal visibility states
  const [canvasModalOpen, setCanvasModalOpen] = useState(false);
  const [penColorModalOpen, setPenColorModalOpen] = useState(false);
  const [penWidthModalOpen, setPenWidthModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [aboutModalOpen, setAboutModalOpen] = useState(false);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);

  // Clear data dialog
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [stats, setStats] = useState<LocalDataStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const handleOpenClearDialog = useCallback(async () => {
    void triggerHapticFeedback('warning', preferences.haptics);
    setClearDialogOpen(true);
    setLoadingStats(true);
    try {
      const database = await getLocalDatabase();
      const currentStats = await getLocalDataStats(database);
      setStats(currentStats);
    } catch {
      setStats(null);
    } finally {
      setLoadingStats(false);
    }
  }, [preferences.haptics]);

  const handleConfirmClearData = useCallback(async () => {
    await clearAllData();
    resetBoards();
    setClearDialogOpen(false);
    void triggerHapticFeedback('impact', preferences.haptics);
    router.replace('/');
  }, [clearAllData, preferences.haptics, resetBoards, router]);

  // Resolve pen color preview name
  const penColorToken = CANVAS_COLORS.find(
    (c) =>
      c.key === preferences.defaultPenColor ||
      c.light.toLowerCase() === preferences.defaultPenColor.toLowerCase() ||
      c.dark.toLowerCase() === preferences.defaultPenColor.toLowerCase(),
  );
  const penColorName = penColorToken ? penColorToken.name : preferences.defaultPenColor;
  const penColorHex = penColorToken
    ? isDark
      ? penColorToken.dark
      : penColorToken.light
    : preferences.defaultPenColor;

  // Format label
  const formatNames: Record<DefaultExportFormat, string> = {
    png: 'Lossless PNG',
    jpeg: 'Compressed JPEG',
    pdf: 'PDF Document',
    backup: 'FlowCanvas Backup',
  };

  const styleLabel = BOARD_STYLE_OPTIONS.find((opt) => opt.key === preferences.canvasStyle)?.label ?? 'Blank';
  const canvasLabel = `${preferences.canvasBackground === 'dark' ? 'Dark' : 'Light'} · ${styleLabel}`;

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: theme.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingLeft: baseGutter + insets.left,
          paddingRight: baseGutter + insets.right,
          paddingBottom: spacing.xxl + insets.bottom,
        },
      ]}
    >
      <View style={[styles.column, isTablet && styles.tabletColumn]}>
        {/* ================================================= APPEARANCE */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.primary }]}>APPEARANCE</Text>
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.themeRow}>
              <View style={styles.themeRowHeader}>
                <Text style={[styles.rowLabel, { color: theme.foreground }]}>Theme</Text>
                <Text style={[styles.rowSubtitle, { color: theme.foreground }]}>
                  {isDark ? 'Dark mode active' : 'Light mode active'}
                </Text>
              </View>

              {/* Segmented control: System, Light, Dark */}
              <View
                accessibilityRole="radiogroup"
                accessibilityLabel="Application theme"
                style={[styles.segmentContainer, { backgroundColor: isDark ? '#0A2522' : theme.muted }]}
              >
                {(['system', 'light', 'dark'] as const).map((mode) => {
                  const active = preferences.theme === mode;
                  const modeLabels: Record<AppTheme, string> = {
                    system: 'System',
                    light: 'Light',
                    dark: 'Dark',
                  };
                  return (
                    <Pressable
                      key={mode}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`${modeLabels[mode]} theme`}
                      style={[
                        styles.segmentButton,
                        active && [
                          styles.segmentButtonActive,
                          {
                            backgroundColor: theme.primary,
                            borderColor: theme.primary,
                          },
                        ],
                      ]}
                      onPress={() => {
                        void triggerHapticFeedback('selection', preferences.haptics);
                        void updatePreference('theme', mode);
                      }}
                    >
                      <Text
                        style={[
                          styles.segmentButtonText,
                          {
                            color: active ? colors.onPrimary : theme.foreground,
                            fontWeight: active ? '700' : '500',
                          },
                        ]}
                      >
                        {modeLabels[mode]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </View>

        {/* ================================================= CANVAS */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.primary }]}>CANVAS</Text>
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {/* Default canvas background/style */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Default canvas, currently ${canvasLabel}`}
              accessibilityHint="Opens canvas background and texture settings"
              style={styles.row}
              onPress={() => {
                void triggerHapticFeedback('selection', preferences.haptics);
                setCanvasModalOpen(true);
              }}
            >
              <View style={styles.rowLeft}>
                <Text style={[styles.rowLabel, { color: theme.foreground }]}>Default canvas</Text>
                <Text style={[styles.rowSubtitle, { color: theme.foreground }]}>
                  New whiteboard surface
                </Text>
              </View>
              <View style={styles.rowRight}>
                <Text style={[styles.rowValue, { color: theme.foreground }]}>{canvasLabel}</Text>
                <ChevronRightIcon size={18} color={theme.primary} />
              </View>
            </Pressable>

            {/* Default pen color */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Default pen color, currently ${penColorName}`}
              accessibilityHint="Opens palette selector"
              style={[styles.row, styles.divider, { borderTopColor: theme.border }]}
              onPress={() => {
                void triggerHapticFeedback('selection', preferences.haptics);
                setPenColorModalOpen(true);
              }}
            >
              <View style={styles.rowLeft}>
                <Text style={[styles.rowLabel, { color: theme.foreground }]}>Default pen color</Text>
                <Text style={[styles.rowSubtitle, { color: theme.foreground }]}>
                  Active drawing pigment
                </Text>
              </View>
              <View style={styles.rowRight}>
                <View style={[styles.colorChip, { backgroundColor: penColorHex }]} />
                <Text style={[styles.rowValue, { color: theme.foreground }]}>{penColorName}</Text>
                <ChevronRightIcon size={18} color={theme.primary} />
              </View>
            </Pressable>

            {/* Default pen width */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Default pen width, currently ${preferences.defaultPenWidth}px`}
              accessibilityHint="Opens vector line weight selector"
              style={[styles.row, styles.divider, { borderTopColor: theme.border }]}
              onPress={() => {
                void triggerHapticFeedback('selection', preferences.haptics);
                setPenWidthModalOpen(true);
              }}
            >
              <View style={styles.rowLeft}>
                <Text style={[styles.rowLabel, { color: theme.foreground }]}>Default pen width</Text>
                <Text style={[styles.rowSubtitle, { color: theme.foreground }]}>
                  Vector line weight
                </Text>
              </View>
              <View style={styles.rowRight}>
                <View
                  style={[
                    styles.widthIndicator,
                    {
                      height: preferences.defaultPenWidth,
                      backgroundColor: theme.foreground,
                    },
                  ]}
                />
                <Text style={[styles.rowValue, { color: theme.foreground }]}>
                  {preferences.defaultPenWidth}px
                </Text>
                <ChevronRightIcon size={18} color={theme.primary} />
              </View>
            </Pressable>
          </View>
        </View>

        {/* ================================================= INTERACTION */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.primary }]}>INTERACTION</Text>
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {/* Haptics toggle */}
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={[styles.rowLabel, { color: theme.foreground }]}>Haptic feedback</Text>
                <Text style={[styles.rowSubtitle, { color: theme.foreground }]}>
                  Tactile clicks on tools and snapping
                </Text>
              </View>
              <Switch
                accessibilityRole="switch"
                accessibilityLabel="Haptic feedback"
                accessibilityState={{ checked: preferences.haptics }}
                value={preferences.haptics}
                onValueChange={(enabled) => {
                  void updatePreference('haptics', enabled);
                  if (enabled) void triggerHapticFeedback('impact', true);
                }}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Reduced motion banner */}
            <View
              accessibilityRole="text"
              style={[
                styles.infoRow,
                styles.divider,
                { borderTopColor: theme.border, backgroundColor: isDark ? '#092723' : '#F0FDFA' },
              ]}
            >
              <InfoIcon size={20} color={theme.primary} />
              <Text style={[styles.infoText, { color: theme.foreground }]}>
                {reducedMotion
                  ? 'Reduced motion is active on your device. Canvas animations and transitions stay immediate.'
                  : 'Reduced motion follows system accessibility settings. Canvas transitions adjust automatically.'}
              </Text>
            </View>
          </View>
        </View>

        {/* ================================================= EXPORT */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.primary }]}>EXPORT</Text>
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Default export format, currently ${formatNames[preferences.exportFormat]}`}
              accessibilityHint="Opens default export format selector"
              style={styles.row}
              onPress={() => {
                void triggerHapticFeedback('selection', preferences.haptics);
                setExportModalOpen(true);
              }}
            >
              <View style={styles.rowLeft}>
                <Text style={[styles.rowLabel, { color: theme.foreground }]}>Default export format</Text>
                <Text style={[styles.rowSubtitle, { color: theme.foreground }]}>
                  High-res canvas snapshots
                </Text>
              </View>
              <View style={styles.rowRight}>
                <Text style={[styles.rowValue, { color: theme.foreground }]}>
                  {formatNames[preferences.exportFormat]}
                </Text>
                <ChevronRightIcon size={18} color={theme.primary} />
              </View>
            </Pressable>
          </View>
        </View>

        {/* ================================================= ABOUT */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.primary }]}>ABOUT</Text>
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="About FlowCanvas, Version 1.0.0"
              style={styles.row}
              onPress={() => {
                void triggerHapticFeedback('selection', preferences.haptics);
                setAboutModalOpen(true);
              }}
            >
              <View style={styles.rowLeft}>
                <Text style={[styles.rowLabel, { color: theme.foreground }]}>About FlowCanvas</Text>
                <Text style={[styles.rowSubtitle, { color: theme.foreground }]}>
                  Version 1.0.0 · Local-only MVP
                </Text>
              </View>
              <View style={styles.rowRight}>
                <Text style={[styles.rowValue, { color: theme.foreground }]}>v1.0.0</Text>
                <ChevronRightIcon size={18} color={theme.primary} />
              </View>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Privacy policy"
              style={[styles.row, styles.divider, { borderTopColor: theme.border }]}
              onPress={() => {
                void triggerHapticFeedback('selection', preferences.haptics);
                setPrivacyModalOpen(true);
              }}
            >
              <View style={styles.rowLeft}>
                <Text style={[styles.rowLabel, { color: theme.foreground }]}>Privacy policy</Text>
                <Text style={[styles.rowSubtitle, { color: theme.foreground }]}>
                  100% on-device, zero telemetry
                </Text>
              </View>
              <View style={styles.rowRight}>
                <ChevronRightIcon size={18} color={theme.primary} />
              </View>
            </Pressable>
          </View>
        </View>

        {/* ================================================= DATA (Destructive) */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.destructive }]}>DATA</Text>
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear all local data"
              accessibilityHint="Opens confirmation dialog to delete every board and preference"
              style={styles.row}
              onPress={handleOpenClearDialog}
            >
              <View style={styles.rowLeft}>
                <View style={styles.destructiveHeader}>
                  <TrashIcon size={18} color={colors.destructive} />
                  <Text style={[styles.rowLabel, { color: colors.destructive }]}>
                    Clear all local data
                  </Text>
                </View>
                <Text style={[styles.rowSubtitle, { color: theme.foreground }]}>
                  Deletes every board and preference on this device
                </Text>
              </View>
              <View style={styles.rowRight}>
                <ChevronRightIcon size={18} color={colors.destructive} />
              </View>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Pickers & Modals */}
      <CanvasPickerModal
        visible={canvasModalOpen}
        theme={theme}
        isDark={isDark}
        background={preferences.canvasBackground}
        style={preferences.canvasStyle}
        onClose={() => setCanvasModalOpen(false)}
        onSelect={(bg, st) => {
          void updatePreference('canvasBackground', bg);
          void updatePreference('canvasStyle', st);
        }}
      />

      <PenColorPickerModal
        visible={penColorModalOpen}
        theme={theme}
        isDark={isDark}
        color={preferences.defaultPenColor}
        onClose={() => setPenColorModalOpen(false)}
        onSelect={(newColor) => {
          void updatePreference('defaultPenColor', newColor);
        }}
      />

      <PenWidthPickerModal
        visible={penWidthModalOpen}
        theme={theme}
        isDark={isDark}
        widthValue={preferences.defaultPenWidth}
        onClose={() => setPenWidthModalOpen(false)}
        onSelect={(newWidth) => {
          void updatePreference('defaultPenWidth', newWidth);
        }}
      />

      <ExportFormatPickerModal
        visible={exportModalOpen}
        theme={theme}
        isDark={isDark}
        format={preferences.exportFormat}
        onClose={() => setExportModalOpen(false)}
        onSelect={(newFormat) => {
          void updatePreference('exportFormat', newFormat);
        }}
      />

      <AboutModal
        visible={aboutModalOpen}
        theme={theme}
        isDark={isDark}
        onClose={() => setAboutModalOpen(false)}
      />

      <PrivacyModal
        visible={privacyModalOpen}
        theme={theme}
        isDark={isDark}
        onClose={() => setPrivacyModalOpen(false)}
      />

      <ClearLocalDataDialog
        visible={clearDialogOpen}
        theme={theme}
        isDark={isDark}
        stats={stats}
        loadingStats={loadingStats}
        onClose={() => setClearDialogOpen(false)}
        onConfirm={handleConfirmClearData}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingTop: spacing.md,
    gap: spacing.lg,
  },
  column: {
    width: '100%',
    gap: spacing.lg,
  },
  tabletColumn: {
    maxWidth: 640,
    alignSelf: 'center',
  },
  section: {
    gap: spacing.xs,
  },
  sectionTitle: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 0.8,
    paddingHorizontal: spacing.xs,
  },
  card: {
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 2,
    minHeight: touchTarget,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowLeft: {
    flexShrink: 1,
    gap: 2,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowLabel: {
    ...typography.bodyStrong,
    fontSize: 16,
  },
  rowSubtitle: {
    ...typography.caption,
    opacity: 0.75,
  },
  rowValue: {
    ...typography.body,
    fontSize: 14,
    opacity: 0.85,
  },
  themeRow: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  themeRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  segmentContainer: {
    flexDirection: 'row',
    borderRadius: radii.sm + 2,
    padding: 3,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentButtonActive: {
    borderWidth: 1,
  },
  segmentButtonText: {
    ...typography.caption,
    fontSize: 14,
  },
  colorChip: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  widthIndicator: {
    width: 24,
    borderRadius: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  infoText: {
    ...typography.caption,
    flexShrink: 1,
    lineHeight: 18,
    opacity: 0.9,
  },
  destructiveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
