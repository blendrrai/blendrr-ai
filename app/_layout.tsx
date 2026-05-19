import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LookProvider } from '../lib/state';
import { colors } from '../lib/theme';
import { ensureUserProvisioned } from '../lib/user';

export default function RootLayout() {
  // Provision an anonymous user (server-side) on first mount. Fires once; the
  // result is cached in module state and broadcast to subscribers. Doesn't block
  // rendering — the home screen shows fallback "0 credits" until this resolves.
  useEffect(() => {
    ensureUserProvisioned().catch((e) => {
      console.warn('[blendrr] user provisioning failed', e);
    });
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <LookProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
              animation: 'slide_from_bottom',
              animationDuration: 320,
              gestureEnabled: true,
            }}
          />
        </LookProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
