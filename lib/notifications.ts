import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import type { Mode, Quality } from './theme';

const REMINDER_IDENTIFIER = 'blendrr-reminder';
const TRYON_NOTIFICATION_KEY = 'blendrr.tryonNotification.v1';

const MESSAGES = [
  { title: 'Got a shade in mind? 💄', body: 'Drop a screenshot and try it on with BLENDRR.' },
  { title: 'New look, no commitment ✨', body: "Tap a try-on before you check out — see if it's really you." },
  { title: 'Your routine misses you 🌸', body: 'Quick selfie, fresh recommendations.' },
  { title: 'Scent inspo? 🌷', body: 'Three fragrance picks await — just answer a few questions.' },
  { title: 'Slay before you pay 💅', body: "Open BLENDRR and shop smarter." },
];

Notifications.setNotificationHandler({
  handleNotification: async () => {
    // If the user is already in the app, suppress try-on notifications — they
    // can see the result directly and a banner would just be annoying.
    // Routine reminders also stay quiet if you're actively using the app.
    const inForeground = AppState.currentState === 'active';
    return {
      shouldShowAlert: !inForeground,
      shouldShowBanner: !inForeground,
      shouldShowList: true, // keep in notification centre for later viewing
      shouldPlaySound: false,
      shouldSetBadge: false,
    };
  },
});

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (current.canAskAgain === false) return false;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

export async function scheduleReminders(): Promise<void> {
  await cancelReminders();

  // Schedule a reminder every 3 days, 5 occurrences ahead, between 11am-7pm local
  const now = new Date();
  for (let i = 1; i <= 5; i++) {
    const trigger = new Date(now);
    trigger.setDate(trigger.getDate() + i * 3);
    // pick an hour between 11 and 19
    const hour = 11 + ((i * 2) % 8);
    trigger.setHours(hour, 0, 0, 0);

    const msg = MESSAGES[i % MESSAGES.length];

    await Notifications.scheduleNotificationAsync({
      identifier: `${REMINDER_IDENTIFIER}-${i}`,
      content: {
        title: msg.title,
        body: msg.body,
        sound: false,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: trigger,
      },
    });
  }
}

export async function cancelReminders(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(REMINDER_IDENTIFIER))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

export function isNotificationsSupported(): boolean {
  // Expo Go on Android no longer supports remote notifications, but local scheduling is fine.
  // On iOS Simulator, local notifications work but won't fire visually in some cases.
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

// ============================================================================
// Try-on completion notifications
// Local notification scheduled when a try-on starts. Fires at the expected
// completion time so users who swipe out of the app get a "ready" tap.
// Cancelled when the result actually arrives (whether success or failure).
// ============================================================================

/**
 * Estimated completion time in seconds for a given try-on configuration.
 * Used to schedule the "your try-on is ready" notification — we want it to
 * fire approximately when the work finishes, not 10 seconds early/late.
 *
 * Numbers are based on observed try-on image-model latency:
 *   medium quality:  ~20s for single, ~25s for multi
 *   ultra (high):    ~45s for single, ~55s for multi
 * Add a 5s buffer so the notification fires *after* completion rather than
 * before — users tapping the notification expect a finished result.
 */
function estimatedCompletionSeconds(mode: Mode, quality: Quality): number {
  const base = quality === 'ultra' ? 45 : 20;
  const multiBump = mode === 'multi' ? 8 : 0;
  const buffer = 5;
  return base + multiBump + buffer;
}

/**
 * Schedule a local notification timed for when the try-on should finish.
 * Returns the notification id (also persisted) so we can cancel it if the
 * result arrives while the app is open. Silent no-op if notification
 * permission isn't granted — try-ons still work, users just don't get pinged.
 */
export async function scheduleTryOnReadyNotification(
  mode: Mode,
  quality: Quality,
): Promise<string | null> {
  const ok = await ensureNotificationPermission();
  if (!ok) return null;

  // Cancel any existing scheduled try-on notification first — only one
  // active try-on at a time.
  await cancelTryOnReadyNotification();

  const seconds = estimatedCompletionSeconds(mode, quality);

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Your try-on is ready ✨',
        body: 'Tap to see how it looks.',
        sound: false,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        repeats: false,
      },
    });
    await AsyncStorage.setItem(TRYON_NOTIFICATION_KEY, id);
    return id;
  } catch (e) {
    console.warn('[notifications] could not schedule try-on notification', e);
    return null;
  }
}

/**
 * Cancel any pending "try-on ready" notification. Called when the result
 * arrives in the foreground (no point pinging the user about something they
 * already see) or when the job fails (we'll show an in-app error instead).
 */
export async function cancelTryOnReadyNotification(): Promise<void> {
  const id = await AsyncStorage.getItem(TRYON_NOTIFICATION_KEY);
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // already fired or doesn't exist
  }
  await AsyncStorage.removeItem(TRYON_NOTIFICATION_KEY);
}
