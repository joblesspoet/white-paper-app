import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';

import { useBoards } from '../board-context';
import { CANVAS_COLORS } from '../canvas/document';
import { getLocalDatabase } from '../persistence/expo-store';
import { getLocalDataStats, type LocalDataStats } from '../persistence/repository';
import {
  BOARD_STYLE_OPTIONS,
  type AppPreferences,
  type DefaultExportFormat,
} from '../persistence/schema';
import { usePreferences } from '../settings/preferences-context';
import { triggerHapticFeedback } from '../utils/haptics';

export type SettingsModalKind =
  | 'canvas'
  | 'penColor'
  | 'penWidth'
  | 'export'
  | 'about'
  | 'privacy'
  | 'clear'
  | null;

const FORMAT_NAMES: Record<DefaultExportFormat, string> = {
  png: 'Lossless PNG',
  jpeg: 'Compressed JPEG',
  pdf: 'PDF Document',
  backup: 'FlowCanvas Backup',
};

export function useSettingsScreen() {
  const router = useRouter();
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

  const [activeModal, setActiveModal] = useState<SettingsModalKind>(null);
  const [stats, setStats] = useState<LocalDataStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const openModal = useCallback(
    (kind: Exclude<SettingsModalKind, null>) => {
      void triggerHapticFeedback(kind === 'clear' ? 'warning' : 'selection', preferences.haptics);
      setActiveModal(kind);
    },
    [preferences.haptics],
  );

  const closeModal = useCallback(() => {
    setActiveModal(null);
  }, []);

  const openClearDialog = useCallback(async () => {
    void triggerHapticFeedback('warning', preferences.haptics);
    setActiveModal('clear');
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

  const confirmClearData = useCallback(async () => {
    await clearAllData();
    resetBoards();
    setActiveModal(null);
    void triggerHapticFeedback('impact', preferences.haptics);
    router.replace('/');
  }, [clearAllData, preferences.haptics, resetBoards, router]);

  const setPreference = useCallback(
    <K extends keyof AppPreferences>(key: K, value: AppPreferences[K], haptic: 'selection' | 'impact' = 'selection') => {
      void triggerHapticFeedback(haptic, preferences.haptics || (key === 'haptics' && Boolean(value)));
      void updatePreference(key, value);
    },
    [preferences.haptics, updatePreference],
  );

  const { penColorName, penColorHex } = useMemo(() => {
    const token = CANVAS_COLORS.find(
      (c) =>
        c.key === preferences.defaultPenColor ||
        c.light.toLowerCase() === preferences.defaultPenColor.toLowerCase() ||
        c.dark.toLowerCase() === preferences.defaultPenColor.toLowerCase(),
    );
    return {
      penColorName: token ? token.name : preferences.defaultPenColor,
      penColorHex: token
        ? isDark
          ? token.dark
          : token.light
        : preferences.defaultPenColor,
    };
  }, [isDark, preferences.defaultPenColor]);

  const canvasLabel = useMemo(() => {
    const styleLabel =
      BOARD_STYLE_OPTIONS.find((opt) => opt.key === preferences.canvasStyle)?.shortLabel ?? 'Blank';
    const bgLabel =
      preferences.canvasBackground === 'dark'
        ? 'Dark'
        : preferences.canvasBackground === 'white'
          ? 'White'
          : 'Light';
    return `${bgLabel} · ${styleLabel}`;
  }, [preferences.canvasBackground, preferences.canvasStyle]);

  const exportFormatLabel = FORMAT_NAMES[preferences.exportFormat];

  return {
    preferences,
    resolvedTheme,
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
  };
}
