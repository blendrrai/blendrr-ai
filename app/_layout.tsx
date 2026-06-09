import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LookProvider } from '../lib/state';
import { colors } from '../lib/theme';
import { ensureUserProvisioned, refreshUser } from '../lib/user';
import { AchievementUnlockModal } from '../components/AchievementUnlockModal';
import { PaywallModal } from '../components/PaywallModal';

export default function RootLayout() {
  // Provision an anonymous user (server-side) on first mount. Fires once; the
  // result is cached in module state and broadcast to subscribers. Doesn't block
  // rendering — the home screen shows fallback "0 credits" until this resolves.
  useEffect(() => {
    ensureUserProvisioned().catch((e) => {
      console.warn('[blendrr] user provisioning failed', e);
    });
  }, []);

  // Refetch user state from server whenever the app returns from background.
  // Catches external credit changes (admin top-up, future IAP webhook, manual
  // DB edits during testing) without requiring a full app restart.
  const appState = useRef<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const wasBackground = appState.current.match(/inactive|background/);
      const isActive = next === 'active';
      appState.current = next;
      if (wasBackground && isActive) {
        refreshUser().catch(() => {
          // ignore — next user-triggered action will retry
        });
      }
    });
    return () => sub.remove();
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
          {/* Mounted at root so achievement unlocks float above any screen.
              Subscribes to the unlock broadcast in lib/glow.ts and queues
              celebrations sequentially. */}
          <AchievementUnlockModal />
          {/* Paywall — fires whenever a free user with 0 credits attempts
              any AI-credited action (see callEdge in lib/blendrr.ts). */}
          <PaywallModal />
        </LookProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
