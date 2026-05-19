import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const REMINDER_IDENTIFIER = 'blendrr-reminder';

const MESSAGES = [
  { title: 'Got a shade in mind? 💄', body: 'Drop a screenshot and try it on with Blendrr.' },
  { title: 'New look, no commitment ✨', body: "Tap a try-on before you check out — see if it's really you." },
  { title: 'Your routine misses you 🌸', body: 'Quick selfie, fresh recommendations.' },
  { title: 'Scent inspo? 🌷', body: 'Three fragrance picks await — just answer a few questions.' },
  { title: 'Slay before you pay 💅', body: "Open Blendrr and shop smarter." },
];

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
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
