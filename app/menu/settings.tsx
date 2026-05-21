import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  AtSign,
  Bell,
  Check,
  ChevronRight,
  Globe,
  Info,
  Mail,
  Sparkles,
  Trash2,
} from 'lucide-react-native';
import { Screen } from '../../components/Screen';
import { StepHeader } from '../../components/StepHeader';
import { colors, radius, shadow, spacing, type } from '../../lib/theme';
import {
  clearAllData,
  loadAppSettings,
  loadSubscription,
  saveAppSettings,
  saveSubscription,
  type AppSettings,
  type Currency,
  type Subscription,
} from '../../lib/storage';
import {
  cancelReminders,
  ensureNotificationPermission,
  scheduleReminders,
} from '../../lib/notifications';
import { LEGAL_URLS } from '../../lib/legal';

const CURRENCY_OPTIONS: { value: Currency; label: string; symbol: string }[] = [
  { value: 'GBP', label: 'British Pound', symbol: '£' },
  { value: 'USD', label: 'US Dollar', symbol: '$' },
  { value: 'EUR', label: 'Euro', symbol: '€' },
];

const FEEDBACK_EMAIL = 'blendrr.app.ai@gmail.com';
const INSTAGRAM_HANDLE = 'blendrr.ai';

export default function Settings() {
  const [sub, setSub] = useState<Subscription | null>(null);
  const [settings, setSettings] = useState<AppSettings>({ notificationsEnabled: false });

  const refresh = useCallback(() => {
    loadSubscription().then(setSub);
    loadAppSettings().then(setSettings);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useFocusEffect(useCallback(() => refresh(), [refresh]));

  const setCurrency = async (c: Currency) => {
    if (!sub) return;
    const next: Subscription = { ...sub, currency: c };
    await saveSubscription(next);
    setSub(next);
  };

  const toggleNotifications = async (value: boolean) => {
    if (value) {
      const ok = await ensureNotificationPermission();
      if (!ok) {
        Alert.alert(
          'Notifications off',
          'Enable notifications for BLENDRR in iPhone Settings to receive reminders.',
        );
        return;
      }
      await scheduleReminders();
    } else {
      await cancelReminders();
    }
    const next: AppSettings = { ...settings, notificationsEnabled: value };
    await saveAppSettings(next);
    setSettings(next);
  };

  const emailFeedback = () => {
    const subject = encodeURIComponent('BLENDRR Ai feedback');
    const body = encodeURIComponent('\n\n---\nVersion: 1.0.0');
    Linking.openURL(`mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${body}`).catch(() =>
      Alert.alert('No mail app', `Send feedback to ${FEEDBACK_EMAIL}`),
    );
  };

  const openInstagram = async () => {
    const appUrl = `instagram://user?username=${INSTAGRAM_HANDLE}`;
    const webUrl = `https://instagram.com/${INSTAGRAM_HANDLE}`;
    const can = await Linking.canOpenURL(appUrl);
    Linking.openURL(can ? appUrl : webUrl).catch(() => {
      Alert.alert('Find us', `@${INSTAGRAM_HANDLE} on Instagram`);
    });
  };

  const wipe = () => {
    Alert.alert(
      'Clear all data?',
      'Wipes your wishlist, routines, history, analyses, and subscription. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear everything',
          style: 'destructive',
          onPress: async () => {
            await clearAllData();
            refresh();
            Alert.alert('Cleared', 'Everything is gone. The app is fresh.');
          },
        },
      ],
    );
  };

  const currency = sub?.currency ?? 'GBP';

  return (
    <Screen>
      <StepHeader title="Settings" subtitle="Preferences, notifications, feedback." />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
      >
        <SectionCard Icon={Globe} title="Currency" helper="Used for displaying prices in the app.">
          <View style={styles.currencyRow}>
            {CURRENCY_OPTIONS.map((opt) => {
              const active = currency === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setCurrency(opt.value)}
                  style={[styles.currencyChip, active && styles.currencyChipActive]}
                >
                  <Text style={[styles.currencySymbol, active && styles.currencyTextActive]}>
                    {opt.symbol}
                  </Text>
                  <Text style={[styles.currencyLabel, active && styles.currencyTextActive]}>
                    {opt.value}
                  </Text>
                  {active && <Check size={14} color={colors.primaryOn} strokeWidth={2.4} />}
                </Pressable>
              );
            })}
          </View>
        </SectionCard>

        <SectionCard
          Icon={Bell}
          title="Reminders"
          helper="Friendly nudges every few days so you don't forget your routine."
        >
          <View style={styles.toggleRow}>
            <View style={styles.toggleText}>
              <Text style={styles.toggleTitle}>Notifications</Text>
              <Text style={styles.toggleSub}>
                {settings.notificationsEnabled ? 'On — every 3 days' : 'Off'}
              </Text>
            </View>
            <Switch
              value={settings.notificationsEnabled}
              onValueChange={toggleNotifications}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.primaryOn}
              ios_backgroundColor={colors.border}
            />
          </View>
        </SectionCard>

        <SectionCard
          Icon={Mail}
          title="Give us feedback"
          helper="Idea, bug, or product request? We read every email."
        >
          <Pressable onPress={emailFeedback} style={styles.linkRow}>
            <Mail size={18} color={colors.text} strokeWidth={2} />
            <View style={styles.linkText}>
              <Text style={styles.linkTitle}>Email us</Text>
              <Text style={styles.linkSub}>{FEEDBACK_EMAIL}</Text>
            </View>
            <ChevronRight size={18} color={colors.textFaint} strokeWidth={2} />
          </Pressable>
          <Pressable onPress={openInstagram} style={styles.linkRow}>
            <AtSign size={18} color={colors.text} strokeWidth={2} />
            <View style={styles.linkText}>
              <Text style={styles.linkTitle}>Instagram</Text>
              <Text style={styles.linkSub}>@{INSTAGRAM_HANDLE}</Text>
            </View>
            <ChevronRight size={18} color={colors.textFaint} strokeWidth={2} />
          </Pressable>
        </SectionCard>

        <Pressable
          onPress={() => router.push('/menu/how-it-works')}
          style={[styles.simpleRow, shadow.card]}
        >
          <View style={styles.simpleIcon}>
            <Sparkles size={20} color={colors.text} strokeWidth={1.8} />
          </View>
          <View style={styles.simpleText}>
            <Text style={styles.simpleTitle}>How BLENDRR Ai works</Text>
            <Text style={styles.simpleSub}>AI, quizzes, privacy, FAQ.</Text>
          </View>
          <ChevronRight size={20} color={colors.textFaint} strokeWidth={2} />
        </Pressable>

        <Pressable onPress={wipe} style={[styles.dangerRow, shadow.card]}>
          <View style={styles.dangerIcon}>
            <Trash2 size={18} color={colors.primary} strokeWidth={2} />
          </View>
          <View style={styles.simpleText}>
            <Text style={styles.dangerTitle}>Clear all app data</Text>
            <Text style={styles.simpleSub}>
              Wishlist, routines, history, subscription — all gone.
            </Text>
          </View>
        </Pressable>

        <View style={[styles.aboutCard, shadow.card]}>
          <View style={styles.aboutHeader}>
            <Info size={18} color={colors.text} strokeWidth={2} />
            <Text style={styles.aboutTitle}>About BLENDRR Ai</Text>
          </View>
          <Text style={styles.aboutBody}>
            Version 1.0.0. Everything stays on this phone — no account, no cloud.
          </Text>
          <View style={styles.legalRow}>
            <Text
              onPress={() => Linking.openURL(LEGAL_URLS.terms)}
              style={styles.legalLink}
              suppressHighlighting
            >
              Terms of Service
            </Text>
            <Text style={styles.legalSeparator}>·</Text>
            <Text
              onPress={() => Linking.openURL(LEGAL_URLS.privacy)}
              style={styles.legalLink}
              suppressHighlighting
            >
              Privacy Policy
            </Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

function SectionCard({
  Icon,
  title,
  helper,
  children,
}: {
  Icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
  title: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.card, shadow.card]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardIcon}>
          <Icon size={20} color={colors.text} strokeWidth={1.8} />
        </View>
        <View style={styles.cardHeaderText}>
          <Text style={styles.cardTitle}>{title}</Text>
          {helper && <Text style={styles.cardHelper}>{helper}</Text>}
        </View>
      </View>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl, gap: spacing.md },
  card: {
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  cardHeader: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeaderText: { flex: 1, gap: 2 },
  cardTitle: { ...type.heading, fontSize: 16, color: colors.text },
  cardHelper: { ...type.caption, color: colors.textMuted, lineHeight: 18 },
  cardBody: { gap: spacing.sm },
  currencyRow: { flexDirection: 'row', gap: spacing.sm },
  currencyChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  currencyChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  currencySymbol: { ...type.heading, fontSize: 18, color: colors.text },
  currencyLabel: { ...type.caption, color: colors.text, fontWeight: '600' },
  currencyTextActive: { color: colors.primaryOn },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleText: { flex: 1, gap: 2 },
  toggleTitle: { ...type.heading, fontSize: 15, color: colors.text },
  toggleSub: { ...type.caption, color: colors.textMuted },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 10,
  },
  linkText: { flex: 1, gap: 2 },
  linkTitle: { ...type.heading, fontSize: 14, color: colors.text },
  linkSub: { ...type.caption, color: colors.textMuted },
  simpleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  simpleIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  simpleText: { flex: 1, gap: 2 },
  simpleTitle: { ...type.heading, fontSize: 16, color: colors.text },
  simpleSub: { ...type.caption, color: colors.textMuted },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    gap: spacing.md,
  },
  dangerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  dangerTitle: { ...type.heading, fontSize: 16, color: colors.primary },
  aboutCard: {
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  aboutHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  aboutTitle: { ...type.heading, fontSize: 15, color: colors.text },
  aboutBody: { ...type.caption, color: colors.textMuted, lineHeight: 18 },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  legalLink: {
    ...type.caption,
    color: colors.textMuted,
    fontSize: 11,
    textDecorationLine: 'underline',
    textDecorationColor: colors.borderStrong,
  },
  legalSeparator: { ...type.caption, color: colors.textFaint, fontSize: 11 },
});
