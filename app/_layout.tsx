import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const lk = require('@livekit/react-native') as { registerGlobals?: () => void };
  lk.registerGlobals?.();
} catch {
  // Safe in environments where WebRTC globals are unavailable
}

import { typography } from '../src/theme';
import { BoardProvider } from '../src/board-context';
import { MonetizationProvider } from '../src/monetization/monetization-context';
import { PreferencesProvider, usePreferences } from '../src/settings/preferences-context';

/**
 * Screens that are opened from a deep link or a cold start still resolve a stack
 * with Home underneath, so the header back button, the iOS swipe gesture, and
 * Android hardware back always return to Home.
 */
export const unstable_settings = {
  anchor: 'index',
};

function RootNavigation() {
  const { theme, isDark } = usePreferences();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.foreground,
          headerTitleStyle: { fontSize: typography.subtitle.fontSize, fontWeight: '600' },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: theme.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="editor" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PreferencesProvider>
          <MonetizationProvider>
            <BoardProvider>
              <RootNavigation />
            </BoardProvider>
          </MonetizationProvider>
        </PreferencesProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
