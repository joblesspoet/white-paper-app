import { useCallback, useMemo } from 'react';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ClearLocalDataDialog } from '../src/components/ClearLocalDataDialog';
import {
  AboutModal,
  CanvasPickerModal,
  ExportFormatPickerModal,
  PenColorPickerModal,
  PenWidthPickerModal,
  PrivacyModal,
} from '../src/components/SettingsPickers';
import { InfoIcon, TrashIcon } from '../src/components/icons';
import {
  SettingsNavRow,
  SettingsToggleRow,
  ThemeSegmentControl,
} from '../src/components/settings/SettingsRow';
import { SettingsSection } from '../src/components/settings/SettingsSection';
import { useSettingsScreen } from '../src/hooks/useSettingsScreen';
import { useMonetization } from '../src/monetization/monetization-context';
import type { UserPlanTier } from '../src/monetization/iap-catalog';
import type {
  AppTheme,
  DefaultCanvasBackground,
  DefaultCanvasStyle,
  DefaultExportFormat,
} from '../src/persistence/schema';
import { PHONE_GUTTER, resolveViewportProfile, TABLET_GUTTER } from '../src/responsive/layout';
import { settingsStyles as styles } from '../src/screens/settings.styles';
import { spacing } from '../src/theme';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const profile = useMemo(() => resolveViewportProfile(width, height), [height, width]);
  const isTablet = profile.isTablet;
  const baseGutter = isTablet ? TABLET_GUTTER : PHONE_GUTTER;

  const {
    tier,
    state: monetizationState,
    getLiveClassAccess,
    openPaywall,
    restorePurchases,
  } = useMonetization();
  const voiceAccess = getLiveClassAccess('voice');
  const tierDisplayNames: Record<UserPlanTier, string> = {
    free: 'Free (Ad-Supported)',
    ad_free: 'Ad-Free ($1.99)',
    offline_studio: 'Offline Studio ($4.99)',
    teacher_pro: 'Teacher Pro',
  };

  const {
    preferences,
    theme,
    isDark,
    reducedMotion,
    activeModal,
    stats,
    loadingStats,
    penColorName,
    penColorHex,
    canvasLabel,
    exportFormatLabel,
    openModal,
    closeModal,
    openClearDialog,
    confirmClearData,
    setPreference,
    updatePreference,
  } = useSettingsScreen();

  const contentContainerStyle = useMemo(
    () => [
      styles.content,
      {
        paddingLeft: baseGutter + insets.left,
        paddingRight: baseGutter + insets.right,
        paddingBottom: spacing.xxl + insets.bottom,
      },
    ],
    [baseGutter, insets.bottom, insets.left, insets.right],
  );

  const handleThemeSelect = useCallback(
    (mode: AppTheme) => {
      setPreference('theme', mode);
    },
    [setPreference],
  );

  const handleOpenCanvas = useCallback(() => openModal('canvas'), [openModal]);
  const handleOpenPenColor = useCallback(() => openModal('penColor'), [openModal]);
  const handleOpenPenWidth = useCallback(() => openModal('penWidth'), [openModal]);
  const handleOpenExport = useCallback(() => openModal('export'), [openModal]);
  const handleOpenAbout = useCallback(() => openModal('about'), [openModal]);
  const handleOpenPrivacy = useCallback(() => openModal('privacy'), [openModal]);

  const handleToggleHaptics = useCallback(
    (enabled: boolean) => setPreference('haptics', enabled, 'impact'),
    [setPreference],
  );
  const handleToggleStylusOnly = useCallback(
    (enabled: boolean) => setPreference('stylusOnlyDrawing', enabled),
    [setPreference],
  );
  const handleTogglePressure = useCallback(
    (enabled: boolean) => setPreference('pressureSensitivity', enabled),
    [setPreference],
  );
  const handleToggleHoldToSnap = useCallback(
    (enabled: boolean) => setPreference('holdToSnapShapes', enabled),
    [setPreference],
  );

  const handleSelectCanvas = useCallback(
    (bg: DefaultCanvasBackground, st: DefaultCanvasStyle) => {
      void updatePreference('canvasBackground', bg);
      void updatePreference('canvasStyle', st);
    },
    [updatePreference],
  );
  const handleSelectPenColor = useCallback(
    (newColor: string) => {
      void updatePreference('defaultPenColor', newColor);
    },
    [updatePreference],
  );
  const handleSelectPenWidth = useCallback(
    (newWidth: number) => {
      void updatePreference('defaultPenWidth', newWidth);
    },
    [updatePreference],
  );
  const handleSelectExportFormat = useCallback(
    (newFormat: DefaultExportFormat) => {
      void updatePreference('exportFormat', newFormat);
    },
    [updatePreference],
  );

  const handleStartClear = useCallback(() => {
    void openClearDialog();
  }, [openClearDialog]);

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: theme.background }]}
      contentContainerStyle={contentContainerStyle}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.column, isTablet && styles.tabletColumn]}>
        {isTablet && (
          <View
            style={[
              styles.tabletStatusBanner,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View style={styles.tabletStatusLeft}>
              <View style={[styles.statusDot, { backgroundColor: theme.primary }]} />
              <Text style={[styles.tabletStatusTitle, { color: theme.primary }]}>
                LOCAL SQLITE · OFFLINE-FIRST
              </Text>
            </View>
            <Text style={[styles.tabletStatusMeta, { color: theme.foreground }]}>
              Zero cloud accounts
            </Text>
          </View>
        )}

        <SettingsSection title="PLANS & PURCHASES" caption="Subscriptions, studio & passes" theme={theme}>
          <SettingsNavRow
            label="Current plan"
            subtitle={
              tier === 'teacher_pro'
                ? 'Live Classroom + 1080p Video + Offline Studio + Ad-Free'
                : 'Upgrade for Live Voice, HD Video, PDF Markup & No Ads'
            }
            value={tierDisplayNames[tier]}
            accessibilityLabel={`Current plan: ${tierDisplayNames[tier]}`}
            theme={theme}
            onPress={() => openPaywall({ reason: 'upgrade' })}
          />
          <SettingsNavRow
            hasDivider
            label="Live Voice balance"
            subtitle="Students always join free"
            value={
              tier === 'teacher_pro'
                ? '25 voice hrs/mo'
                : `${voiceAccess.remainingVoiceTrials} trials · ${monetizationState.liveClassPasses} passes`
            }
            accessibilityLabel="View Live Voice passes and plans"
            theme={theme}
            onPress={() =>
              openPaywall({
                reason: 'live_voice',
                remainingTrials: voiceAccess.remainingVoiceTrials,
                passesRemaining: monetizationState.liveClassPasses,
              })
            }
          />
          <SettingsNavRow
            hasDivider
            label="Restore purchases"
            subtitle="Re-sync non-consumables & subscriptions"
            value="Restore"
            accessibilityLabel="Restore purchases"
            theme={theme}
            onPress={() => void restorePurchases()}
          />
        </SettingsSection>

        <SettingsSection title="APPEARANCE" caption="Canvas environment" theme={theme}>
          <ThemeSegmentControl
            mode={preferences.theme}
            isDark={isDark}
            reducedMotion={reducedMotion}
            theme={theme}
            onSelect={handleThemeSelect}
          />
        </SettingsSection>

        <SettingsSection title="CANVAS" caption="Infinite plane defaults" theme={theme}>
          <SettingsNavRow
            label="Default canvas"
            subtitle="New whiteboard surface"
            value={canvasLabel}
            accessibilityLabel={`Default canvas, currently ${canvasLabel}`}
            accessibilityHint="Opens canvas background and texture settings"
            theme={theme}
            onPress={handleOpenCanvas}
          />
          <SettingsNavRow
            hasDivider
            label="Default pen color"
            subtitle="Active drawing pigment"
            value={penColorName}
            accessibilityLabel={`Default pen color, currently ${penColorName}`}
            accessibilityHint="Opens palette selector"
            rightAccessory={<View style={[styles.colorChip, { backgroundColor: penColorHex }]} />}
            theme={theme}
            onPress={handleOpenPenColor}
          />
          <SettingsNavRow
            hasDivider
            label="Default pen width"
            subtitle="Vector line weight"
            value={`${preferences.defaultPenWidth}px`}
            accessibilityLabel={`Default pen width, currently ${preferences.defaultPenWidth}px`}
            accessibilityHint="Opens vector line weight selector"
            rightAccessory={
              <View
                style={[
                  styles.widthIndicator,
                  { height: preferences.defaultPenWidth, backgroundColor: theme.foreground },
                ]}
              />
            }
            theme={theme}
            onPress={handleOpenPenWidth}
          />
        </SettingsSection>

        <SettingsSection title="INTERACTION" caption="Tactile & stylus" theme={theme}>
          <SettingsToggleRow
            label="Haptic feedback"
            subtitle="Tactile clicks on tools and snapping"
            value={preferences.haptics}
            theme={theme}
            onValueChange={handleToggleHaptics}
          />
          <SettingsToggleRow
            hasDivider
            label="Stylus-only drawing"
            subtitle="Palm rejection: fingers pan & zoom while Apple Pencil or S-Pen inks"
            value={preferences.stylusOnlyDrawing}
            theme={theme}
            onValueChange={handleToggleStylusOnly}
          />
          <SettingsToggleRow
            hasDivider
            label="Pressure sensitivity"
            subtitle="Variable-width tapered strokes from stylus pressure"
            value={preferences.pressureSensitivity}
            theme={theme}
            onValueChange={handleTogglePressure}
          />
          <SettingsToggleRow
            hasDivider
            label="Hold to snap shapes"
            subtitle="Pause 350 ms at stroke end to convert freehand into crisp shapes"
            value={preferences.holdToSnapShapes}
            theme={theme}
            onValueChange={handleToggleHoldToSnap}
          />
          <View
            accessibilityRole="text"
            style={[
              styles.infoRow,
              {
                borderTopColor: theme.border,
                backgroundColor: isDark ? '#092723' : '#F0FDFA',
              },
            ]}
          >
            <InfoIcon size={20} color={theme.primary} />
            <Text style={[styles.infoText, { color: theme.foreground }]}>
              {reducedMotion
                ? 'Reduced motion is active on your device. Canvas animations and transitions stay immediate.'
                : 'Reduced motion follows system accessibility settings. Canvas transitions adjust automatically.'}
            </Text>
          </View>
        </SettingsSection>

        <SettingsSection title="EXPORT" caption="Artifact sharing" theme={theme}>
          <SettingsNavRow
            label="Default export format"
            subtitle="High-res canvas snapshots"
            value={exportFormatLabel}
            accessibilityLabel={`Default export format, currently ${exportFormatLabel}`}
            accessibilityHint="Opens default export format selector"
            theme={theme}
            onPress={handleOpenExport}
          />
        </SettingsSection>

        <SettingsSection title="ABOUT" caption="Zero cloud footprint" theme={theme}>
          <SettingsNavRow
            label="About FlowCanvas"
            subtitle="Version 1.0.0 · Local-only MVP"
            value="v1.0.0"
            accessibilityLabel="About FlowCanvas, Version 1.0.0"
            theme={theme}
            onPress={handleOpenAbout}
          />
          <SettingsNavRow
            hasDivider
            label="Privacy policy"
            subtitle="100% on-device, zero telemetry"
            accessibilityLabel="Privacy policy"
            theme={theme}
            onPress={handleOpenPrivacy}
          />
        </SettingsSection>

        <SettingsSection title="DATA" caption="Local persistence" destructive theme={theme}>
          <SettingsNavRow
            destructive
            label="Clear all local data"
            subtitle="Deletes every board and preference on this device"
            accessibilityLabel="Clear all local data"
            accessibilityHint="Opens confirmation dialog to delete every board and preference"
            leftIcon={<TrashIcon size={18} color={theme.destructive} />}
            theme={theme}
            onPress={handleStartClear}
          />
        </SettingsSection>

        <View style={styles.footerColophon}>
          <Text style={[styles.footerTitle, { color: theme.foreground }]}>
            FlowCanvas — Crafted for intentional visual ideation
          </Text>
          <Text style={[styles.footerSubtitle, { color: theme.foreground }]}>
            Local-First Architecture · Zero Telemetry
          </Text>
        </View>
      </View>

      <CanvasPickerModal
        visible={activeModal === 'canvas'}
        theme={theme}
        isDark={isDark}
        reducedMotion={reducedMotion}
        background={preferences.canvasBackground}
        style={preferences.canvasStyle}
        onClose={closeModal}
        onSelect={handleSelectCanvas}
      />

      <PenColorPickerModal
        visible={activeModal === 'penColor'}
        theme={theme}
        isDark={isDark}
        reducedMotion={reducedMotion}
        color={preferences.defaultPenColor}
        onClose={closeModal}
        onSelect={handleSelectPenColor}
      />

      <PenWidthPickerModal
        visible={activeModal === 'penWidth'}
        theme={theme}
        isDark={isDark}
        reducedMotion={reducedMotion}
        widthValue={preferences.defaultPenWidth}
        onClose={closeModal}
        onSelect={handleSelectPenWidth}
      />

      <ExportFormatPickerModal
        visible={activeModal === 'export'}
        theme={theme}
        isDark={isDark}
        reducedMotion={reducedMotion}
        format={preferences.exportFormat}
        onClose={closeModal}
        onSelect={handleSelectExportFormat}
      />

      <AboutModal
        visible={activeModal === 'about'}
        theme={theme}
        isDark={isDark}
        reducedMotion={reducedMotion}
        onClose={closeModal}
      />

      <PrivacyModal
        visible={activeModal === 'privacy'}
        theme={theme}
        isDark={isDark}
        reducedMotion={reducedMotion}
        onClose={closeModal}
      />

      <ClearLocalDataDialog
        visible={activeModal === 'clear'}
        theme={theme}
        isDark={isDark}
        reducedMotion={reducedMotion}
        stats={stats}
        loadingStats={loadingStats}
        onClose={closeModal}
        onConfirm={confirmClearData}
      />
    </ScrollView>
  );
}
