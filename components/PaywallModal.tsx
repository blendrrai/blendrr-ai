import { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Check, Crown, Sparkles, X } from 'lucide-react-native';
import { colors, radius, shadow, spacing, type } from '../lib/theme';
import { subscribePaywall } from '../lib/paywall';
import { LEGAL_URLS } from '../lib/legal';
import { purchaseMonthly, isProFromCustomerInfo } from '../lib/purchases';
import { refreshUser, updateCachedUser } from '../lib/user';

const PRO_PRICE = '£9.99';
const PRO_FEATURES = [
  '30 AI uses every month',
  'Spend on try-ons, quizzes, or ingredient scans',
  'Ultra HD quality on every generation',
  'Daily Glow Score + streak (stays free)',
  'All future features included',
];

/**
 * Global paywall modal. Mounts once at the root layout. Subscribes to the
 * paywall event bus and shows itself whenever an AI feature is attempted by
 * a free user with 0 credits remaining.
 *
 * The Subscribe button currently shows an "implementation pending" alert —
 * swap that for `Purchases.purchasePackage(...)` once RevenueCat is wired.
 */
export function PaywallModal() {
  const [open, setOpen] = useState(false);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    return subscribePaywall(() => setOpen(true));
  }, []);

  const dismiss = () => setOpen(false);

  const subscribe = async () => {
    if (purchasing) return;
    setPurchasing(true);
    try {
      const info = await purchaseMonthly();
      // Optimistic client update — the RC webhook will separately update
      // the server-side user row within seconds. refreshUser() below picks
      // that up once the webhook has landed.
      if (isProFromCustomerInfo(info)) {
        updateCachedUser({ tier: 'pro' });
      }
      // Pull the server-side row too so credits/pro_started_at reflect the
      // webhook's write. Fire-and-forget — modal already closes on success.
      refreshUser().catch(() => {});
      Alert.alert(
        "You're in ✨",
        "Welcome to BLENDRR Pro. You've got 30 AI uses this month — spend them on try-ons, quizzes, or ingredient scans.",
      );
      setOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong';
      // User cancelled the StoreKit sheet — no need to shout at them.
      if (msg === 'Purchase cancelled.') return;
      Alert.alert("Couldn't complete purchase", msg);
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={dismiss}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Animated.View
          style={[styles.sheet, shadow.card]}
          entering={FadeIn.duration(220)}
          exiting={FadeOut.duration(160)}
        >
          <Pressable style={styles.closeBtn} onPress={dismiss} hitSlop={12}>
            <X size={18} color={colors.text} strokeWidth={2.2} />
          </Pressable>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.crownWrap}>
              <Crown size={32} color={colors.primaryOn} strokeWidth={1.8} />
            </View>

            <Text style={styles.eyebrow}>YOU'VE USED YOUR FREE TRIES</Text>
            <Text style={styles.title}>Go Pro to keep going</Text>
            <Text style={styles.subtitle}>
              Your 5 free AI uses are up. BLENDRR Pro gives you 30 AI uses every month — spend them
              on try-ons, quizzes, or ingredient scans.
            </Text>

            <View style={styles.priceCard}>
              <View style={styles.priceHeader}>
                <View>
                  <Text style={styles.priceLabel}>BLENDRR Pro</Text>
                  <Text style={styles.priceValue}>
                    {PRO_PRICE}
                    <Text style={styles.pricePer}> / month</Text>
                  </Text>
                </View>
                <View style={styles.recommendedPill}>
                  <Sparkles size={11} color={colors.primaryOn} strokeWidth={2.4} />
                  <Text style={styles.recommendedText}>30 / MONTH</Text>
                </View>
              </View>

              <View style={styles.features}>
                {PRO_FEATURES.map((f) => (
                  <View key={f} style={styles.featureRow}>
                    <View style={styles.checkRing}>
                      <Check size={11} color={colors.primaryOn} strokeWidth={3} />
                    </View>
                    <Text style={styles.featureLabel}>{f}</Text>
                  </View>
                ))}
              </View>
            </View>

            <Pressable
              onPress={subscribe}
              disabled={purchasing}
              style={[styles.subscribeBtn, purchasing && styles.subscribeBtnDisabled]}
            >
              <Text style={styles.subscribeLabel}>
                {purchasing ? 'Opening App Store…' : 'Subscribe — £9.99 / month'}
              </Text>
            </Pressable>

            <Pressable onPress={dismiss} style={styles.laterBtn} hitSlop={8}>
              <Text style={styles.laterLabel}>Maybe later</Text>
            </Pressable>

            <Text style={styles.disclosure}>
              Auto-renews monthly until cancelled. Payment charged to your Apple ID. Manage in
              iPhone Settings → Apple ID → Subscriptions.
            </Text>

            <View style={styles.legalRow}>
              <Text
                onPress={() => Linking.openURL(LEGAL_URLS.terms)}
                style={styles.legalLink}
                suppressHighlighting
              >
                Terms
              </Text>
              <Text style={styles.legalSep}>·</Text>
              <Text
                onPress={() => Linking.openURL(LEGAL_URLS.privacy)}
                style={styles.legalLink}
                suppressHighlighting
              >
                Privacy
              </Text>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,10,10,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '92%',
    paddingTop: spacing.md,
  },
  closeBtn: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bgSoft,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    alignItems: 'center',
  },
  crownWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  eyebrow: {
    ...type.eyebrow,
    color: colors.primary,
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  title: { ...type.title, fontSize: 26, color: colors.text, textAlign: 'center', marginTop: 4 },
  subtitle: {
    ...type.body,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  priceCard: {
    width: '100%',
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.primary,
    padding: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  priceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  priceLabel: { ...type.eyebrow, color: colors.textMuted, fontSize: 11 },
  priceValue: { ...type.title, fontSize: 28, color: colors.text, marginTop: 2 },
  pricePer: { ...type.body, fontSize: 14, color: colors.textMuted, fontWeight: '500' },
  recommendedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  recommendedText: {
    ...type.caption,
    color: colors.primaryOn,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  features: { gap: spacing.sm },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkRing: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureLabel: { ...type.body, fontSize: 13, color: colors.text, flex: 1, lineHeight: 18 },
  subscribeBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  subscribeBtnDisabled: { opacity: 0.6 },
  subscribeLabel: { ...type.heading, color: colors.primaryOn, fontSize: 15 },
  laterBtn: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  laterLabel: { ...type.caption, color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  disclosure: {
    ...type.caption,
    color: colors.textFaint,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 4,
    paddingHorizontal: spacing.md,
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  legalLink: {
    ...type.caption,
    color: colors.text,
    fontSize: 11,
    fontWeight: '600',
    textDecorationLine: 'underline',
    textDecorationColor: colors.borderStrong,
  },
  legalSep: { ...type.caption, color: colors.textFaint, fontSize: 11 },
});
