import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';

import { clearAllMediaFiles } from '../media/asset-store';
import { getLocalDatabase } from '../persistence/expo-store';
import {
  clearAllLocalData,
  loadAppPreferences,
  resetAppPreferences,
  saveAppPreference,
} from '../persistence/repository';
import {
  DEFAULT_APP_PREFERENCES,
  type AppPreferences,
  type AppTheme,
  type DefaultCanvasBackground,
  type DefaultCanvasStyle,
  type DefaultExportFormat,
} from '../persistence/schema';
import { enqueuePersistenceWrite } from '../persistence/write-queue';
import { colors, darkColors, type ThemeColors } from '../theme';

export type {
  AppPreferences,
  AppTheme,
  DefaultCanvasBackground,
  DefaultCanvasStyle,
  DefaultExportFormat,
};

type PreferencesContextValue = {
  preferences: AppPreferences;
  resolvedTheme: 'light' | 'dark';
  theme: ThemeColors;
  isDark: boolean;
  reducedMotion: boolean;
  ready: boolean;
  updatePreference: <K extends keyof AppPreferences>(
    key: K,
    value: AppPreferences[K],
  ) => Promise<void>;
  resetPreferences: () => Promise<void>;
  clearAllData: () => Promise<{ boardsCleared: number; objectsCleared: number; mediaCleared: number }>;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<AppPreferences>(DEFAULT_APP_PREFERENCES);
  const [ready, setReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const systemColorScheme = useColorScheme();
  const mounted = useRef(true);

  // Monitor reduced motion accessibility setting.
  useEffect(() => {
    mounted.current = true;
    let subscription: { remove: () => void } | null = null;
    (async () => {
      try {
        const isEnabled = await AccessibilityInfo.isReduceMotionEnabled();
        if (mounted.current) setReducedMotion(isEnabled);
      } catch {
        // Fallback gracefully on unsupported environments
      }
    })();

    try {
      subscription = AccessibilityInfo.addEventListener(
        'reduceMotionChanged',
        (isEnabled: boolean) => {
          if (mounted.current) setReducedMotion(isEnabled);
        },
      );
    } catch {
      // Fallback
    }

    return () => {
      mounted.current = false;
      subscription?.remove();
    };
  }, []);

  // Hydrate preferences from SQLite on launch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const database = await getLocalDatabase();
        const loaded = await loadAppPreferences(database);
        if (!cancelled && mounted.current) {
          setPreferences(loaded);
          setReady(true);
        }
      } catch {
        if (!cancelled && mounted.current) {
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const isDark =
    preferences.theme === 'system'
      ? systemColorScheme === 'dark'
      : preferences.theme === 'dark';
  const resolvedTheme: 'light' | 'dark' = isDark ? 'dark' : 'light';
  const theme: ThemeColors = isDark ? darkColors : colors;

  const updatePreference = useCallback(
    async <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => {
      setPreferences((current) => ({ ...current, [key]: value }));
      await enqueuePersistenceWrite(async () => {
        const database = await getLocalDatabase();
        await saveAppPreference(database, key, value);
      });
    },
    [],
  );

  const resetAllPreferences = useCallback(async () => {
    setPreferences({ ...DEFAULT_APP_PREFERENCES });
    await enqueuePersistenceWrite(async () => {
      const database = await getLocalDatabase();
      await resetAppPreferences(database);
    });
  }, []);

  const clearAllData = useCallback(async () => {
    let result = { boardsCleared: 0, objectsCleared: 0, mediaCleared: 0 };
    await enqueuePersistenceWrite(async () => {
      const database = await getLocalDatabase();
      result = await clearAllLocalData(database);
      await clearAllMediaFiles();
    });
    setPreferences({ ...DEFAULT_APP_PREFERENCES });
    return result;
  }, []);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      preferences,
      resolvedTheme,
      theme,
      isDark,
      reducedMotion,
      ready,
      updatePreference,
      resetPreferences: resetAllPreferences,
      clearAllData,
    }),
    [
      preferences,
      resolvedTheme,
      theme,
      isDark,
      reducedMotion,
      ready,
      updatePreference,
      resetAllPreferences,
      clearAllData,
    ],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
}
