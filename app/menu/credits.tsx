import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Check, Coins, Copy, Crown, Gift, Info, Share2 } from 'lucide-react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Screen } from '../../components/Screen';
import { StepHeader } from '../../components/StepHeader';
import { colors, radius, shadow, spacing, type } from '../../lib/theme';
import {
  loadSubscription,
  saveSubscription,
  type Currency,
  type Subscription,
} from '../../lib/storage';
import {
  ensureUserProvisioned,
  getCachedUser,
  redeemReferralCode,
  subscribeUser,
  type User,
} from '../../lib/user';
import { LEGAL_URLS } from '../../lib/legal';

const PRO_CREDITS_PER_MONTH = 30;

const PRO_PRICES: Record<Currency, string> = {
  GBP: '£9.99',
  USD: '$12.99',
  EUR: '€12.99',
};

const PACKS: Record<Currency, { credits: number; price: string; badge?: string }[]> = {
  GBP: [
    { credits: 10, price: '£6.99' },
    { credits: 30, price: '£12.99', badge: 'Best value' },
    { credits: 100, price: '£32.99' },
  ],
  USD: [
    { credits: 10, price: '$8.99' },
    { credits: 30, price: '$15.99', badge: 'Best value' },
    { credits: 100, price: '$39.99' },
  ],
  EUR: [
    { credits: 10, price: '€7.99' },
    { credits: 30, price: '€14.99', badge: 'Best value' },
    { credits: 100, price: '€36.99' },
  ],
};

const PRO_FEATURES = [
  `${PRO_CREDITS_PER_MONTH} credits every month`,
  'Shared across try-ons and analyses',
  'Priority AI processing',
  'Early access to new tools',
];

export default function Credits() {
  const [sub, setSub] = useState<Subscription>({ tier: 'free', credits: 2, currency: 'GBP' });
  const [user, setUser] = useState<User | null>(getCachedUser());
  const [codeInput, setCodeInput] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  // Always refetch user state from the server — credits can change externally
  // (admin top-up, future IAP, manual DB edit) and the local cache won't see
  // those changes until we refresh.
  const refresh = useCallback(() => {
    loadSubscription().then(setSub);
    ensureUserProvisioned()
      .then((u) => setUser(u))
      .catch(() => {
        // Fall back to local cache if offline / network failure
        setUser(getCachedUser());
      });
  }, []);

  useEffect(() => {
    refresh();
    return subscribeUser((u) => setUser(u));
  }, [refresh]);

  useFocusEffect(useCallback(() => refresh(), [refresh]));

  const copyMyCode = async () => {
    if (!user?.referral_code) return;
    await Clipboard.setStringAsync(user.referral_code);
    Alert.alert('Copied', `${user.referral_code} is on your clipboard.`);
  };

  const shareMyCode = async () => {
    if (!user?.referral_code) return;
    const message = `Try Blendrr Ai with my code ${user.referral_code} — match shades, build your routine, find your scent ✨`;
    try {
      await Share.share({ message });
    } catch {
      // user cancelled
    }
  };

  const redeemCode = async () => {
    const code = codeInput.trim().toUpperCase();
    if (!code) return;
    setRedeeming(true);
    const result = await redeemReferralCode(code);
    setRedeeming(false);
    if (result.ok) {
      setCodeInput('');
      Alert.alert('Code applied 🎉', 'Thanks — your friend just got a free credit.');
    } else {
      Alert.alert("Code didn't apply", result.error);
    }
  };

  const currency = sub.currency ?? 'GBP';
  const proPrice = PRO_PRICES[currency];
  const packs = PACKS[currency];

  const upgrade = () => {
    Alert.alert(
      `Upgrade to Pro — ${proPrice}/month`,
      `${PRO_CREDITS_PER_MONTH} credits a month, shared across try-ons and analyses. Billing wires up next.`,
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Simulate Pro',
          onPress: async () => {
            const next: Subscription = {
              ...sub,
              tier: 'pro',
              credits: Math.max(sub.credits, PRO_CREDITS_PER_MONTH),
            };
            await saveSubscription(next);
            setSub(next);
          },
        },
      ],
    );
  };

  const buyCredits = (pack: (typeof packs)[number]) => {
    Alert.alert(`Buy ${pack.credits} credits`, `${pack.price} — App Store sheet wires up next.`, [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Simulate purchase',
        onPress: async () => {
          const next: Subscription = { ...sub, credits: sub.credits + pack.credits };
          await saveSubscription(next);
          setSub(next);
        },
      },
    ]);
  };

  const isPro = sub.tier === 'pro';

  return (
    <Screen>
      <StepHeader title="Credits" subtitle="Your plan, credit balance, and packs." />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroCard, isPro && styles.heroCardPro, shadow.card]}>
          <View style={styles.heroHeader}>
            <View style={[styles.heroIcon, isPro && styles.heroIconPro]}>
              <Crown
                size={22}
                color={isPro ? colors.primaryOn : colors.text}
                strokeWidth={1.8}
              />
            </View>
            <View style={styles.heroText}>
              <Text style={[styles.heroEyebrow, isPro && styles.heroEyebrowPro]}>
                {isPro ? 'Blendrr Pro' : 'Free plan'}
              </Text>
              <Text style={[styles.heroTitle, isPro && styles.heroTitlePro]}>
                {isPro ? "You're in." : 'Go Pro.'}
              </Text>
            </View>
            {!isPro && (
              <View style={styles.pricePill}>
                <Text style={styles.pricePillAmount}>{proPrice}</Text>
                <Text style={styles.pricePillSuffix}>/mo</Text>
              </View>
            )}
          </View>

          <View style={styles.featureList}>
            {PRO_FEATURES.map((f) => (
              <View key={f} style={styles.featureRow}>
                <View style={[styles.checkRing, isPro && styles.checkRingPro]}>
                  <Check
                    size={12}
                    color={isPro ? colors.primary : colors.primaryOn}
                    strokeWidth={3}
                  />
                </View>
                <Text style={[styles.featureText, isPro && styles.featureTextPro]}>{f}</Text>
              </View>
            ))}
          </View>

          {!isPro ? (
            <>
              <Cta label="Upgrade to Pro" onPress={upgrade} />
              <Text style={styles.ctaLegal}>
                By subscribing you agree to our{' '}
                <Text
                  onPress={() => Linking.openURL(LEGAL_URLS.terms)}
                  style={styles.ctaLegalLink}
                  suppressHighlighting
                >
                  Terms
                </Text>
                {' '}and{' '}
                <Text
                  onPress={() => Linking.openURL(LEGAL_URLS.privacy)}
                  style={styles.ctaLegalLink}
                  suppressHighlighting
                >
                  Privacy Policy
                </Text>
                .
              </Text>
            </>
          ) : (
            <Pressable
              onPress={async () => {
                const next: Subscription = { ...sub, tier: 'free', credits: 3 };
                await saveSubscription(next);
                setSub(next);
              }}
              style={styles.resetBtn}
            >
              <Text style={styles.resetLabel}>Reset to Free (test)</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Credits</Text>
            <View style={styles.creditPill}>
              <Coins size={14} color={colors.text} strokeWidth={2} />
              <Text style={styles.creditCount}>{sub.credits}</Text>
            </View>
          </View>
          <Text style={styles.sectionHelper}>
            Most AI features (quizzes, ingredient scans, single-product try-ons) cost 1 credit.
            Try-ons can cost 1–3 credits depending on your selections: +1 for a full-face look
            (multiple products), +1 for Ultra HD quality. Pro members get {PRO_CREDITS_PER_MONTH} credits a month.
          </Text>
        </View>

        <View style={styles.packGrid}>
          {packs.map((pack) => (
            <CreditPack key={pack.credits} pack={pack} onBuy={() => buyCredits(pack)} />
          ))}
        </View>

        <View style={[styles.referralCard, shadow.card]}>
          <View style={styles.referralHeader}>
            <View style={styles.referralIcon}>
              <Gift size={20} color={colors.text} strokeWidth={1.8} />
            </View>
            <View style={styles.referralHeaderText}>
              <Text style={styles.referralTitle}>Refer a friend</Text>
              <Text style={styles.referralHelper}>
                Earn a free credit each time a friend enters your code.
              </Text>
            </View>
          </View>

          {user?.referral_code ? (
            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>YOUR CODE</Text>
              <Text style={styles.codeValue}>{user.referral_code}</Text>
            </View>
          ) : (
            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>YOUR CODE</Text>
              <Text style={styles.codeValuePending}>Loading…</Text>
            </View>
          )}

          <View style={styles.referralActions}>
            <Pressable onPress={copyMyCode} style={styles.refSecondary} disabled={!user?.referral_code}>
              <Copy size={15} color={colors.text} strokeWidth={2} />
              <Text style={styles.refSecondaryLabel}>Copy</Text>
            </Pressable>
            <Pressable onPress={shareMyCode} style={styles.refPrimary} disabled={!user?.referral_code}>
              <Share2 size={15} color={colors.primaryOn} strokeWidth={2.2} />
              <Text style={styles.refPrimaryLabel}>Share with a friend</Text>
            </Pressable>
          </View>

          {!user?.has_redeemed_referral && (
            <View style={styles.redeemWrap}>
              <Text style={styles.redeemLabel}>Got a code? Send your friend a thank-you credit</Text>
              <View style={styles.redeemRow}>
                <TextInput
                  value={codeInput}
                  onChangeText={(t) => setCodeInput(t.toUpperCase())}
                  placeholder="LUNA42"
                  placeholderTextColor={colors.textFaint}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={6}
                  style={styles.redeemInput}
                />
                <Pressable
                  onPress={redeemCode}
                  disabled={redeeming || codeInput.trim().length < 4}
                  style={[
                    styles.redeemBtn,
                    (redeeming || codeInput.trim().length < 4) && styles.redeemBtnDisabled,
                  ]}
                >
                  <Text style={styles.redeemBtnLabel}>{redeeming ? '…' : 'Redeem'}</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        <View style={[styles.disclosureCard, shadow.card]}>
          <View style={styles.disclosureHeader}>
            <Info size={16} color={colors.text} strokeWidth={2} />
            <Text style={styles.disclosureTitle}>Subscription details</Text>
          </View>
          <Text style={styles.disclosureBody}>
            <Text style={styles.disclosureStrong}>Blendrr Pro</Text> auto-renews monthly at{' '}
            <Text style={styles.disclosureStrong}>{proPrice}</Text> until cancelled. Payment is
            charged to your Apple ID at confirmation of purchase.
          </Text>
          <Text style={styles.disclosureBody}>
            Your account will be charged for renewal within 24 hours before the period ends.
          </Text>
          <Text style={styles.disclosureBody}>
            Manage or cancel anytime in{' '}
            <Text style={styles.disclosureStrong}>iPhone Settings → [Your Apple ID] → Subscriptions</Text>
            , at least 24 hours before the renewal date. Cancelling stops the next charge — you keep
            Pro for the rest of the current period.
          </Text>

          <Text style={styles.disclosureFootnote}>
            Credit packs are one-off purchases — no recurring charges. Unused credits do not expire.
          </Text>

          <View style={styles.disclosureLegalRow}>
            <Text
              onPress={() => Linking.openURL(LEGAL_URLS.terms)}
              style={styles.disclosureLegalLink}
              suppressHighlighting
            >
              Terms of Service
            </Text>
            <Text style={styles.disclosureLegalSep}>·</Text>
            <Text
              onPress={() => Linking.openURL(LEGAL_URLS.privacy)}
              style={styles.disclosureLegalLink}
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

function Cta({ label, onPress }: { label: string; onPress: () => void }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.97, { damping: 18, stiffness: 260 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 14, stiffness: 220 });
      }}
      style={[styles.cta, animStyle]}
    >
      <Text style={styles.ctaLabel}>{label}</Text>
    </AnimatedPressable>
  );
}

function CreditPack({
  pack,
  onBuy,
}: {
  pack: { credits: number; price: string; badge?: string };
  onBuy: () => void;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
  return (
    <AnimatedPressable
      onPress={onBuy}
      onPressIn={() => {
        scale.value = withSpring(0.97, { damping: 18, stiffness: 260 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 14, stiffness: 220 });
      }}
      style={[styles.pack, shadow.card, animStyle]}
    >
      {pack.badge && (
        <View style={styles.packBadge}>
          <Text style={styles.packBadgeText}>{pack.badge}</Text>
        </View>
      )}
      <Text style={styles.packCredits}>{pack.credits}</Text>
      <Text style={styles.packCreditsLabel}>credits</Text>
      <Text style={styles.packPrice}>{pack.price}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl, gap: spacing.md },
  heroCard: {
    backgroundColor: colors.bgSoft,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  heroCardPro: { backgroundColor: colors.primary, borderColor: colors.primary },
  heroHeader: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  pricePill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  pricePillAmount: { ...type.heading, fontSize: 15, color: colors.primaryOn },
  pricePillSuffix: { ...type.caption, color: colors.primaryOn, fontSize: 11, opacity: 0.8 },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroIconPro: { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.3)' },
  heroText: { flex: 1 },
  heroEyebrow: { ...type.eyebrow, color: colors.textMuted },
  heroEyebrowPro: { color: 'rgba(255,255,255,0.8)' },
  heroTitle: { ...type.title, fontSize: 22, color: colors.text },
  heroTitlePro: { color: colors.primaryOn },
  featureList: { gap: 10 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkRing: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkRingPro: { backgroundColor: colors.primaryOn },
  featureText: { ...type.body, fontSize: 14, color: colors.text },
  featureTextPro: { color: colors.primaryOn },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  ctaLabel: { ...type.heading, fontSize: 15, color: colors.primaryOn },
  ctaLegal: {
    ...type.caption,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 16,
  },
  ctaLegalLink: {
    color: colors.text,
    fontWeight: '600',
    textDecorationLine: 'underline',
    textDecorationColor: colors.borderStrong,
  },
  resetBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    marginTop: spacing.xs,
  },
  resetLabel: { ...type.caption, color: colors.primaryOn, fontWeight: '600' },
  section: { gap: 4, marginTop: spacing.md },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionLabel: { ...type.eyebrow, color: colors.textMuted },
  sectionHelper: { ...type.caption, color: colors.textFaint, lineHeight: 18 },
  creditPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  creditCount: { ...type.caption, color: colors.text, fontWeight: '600' },
  packGrid: { flexDirection: 'row', gap: spacing.sm },
  pack: {
    flex: 1,
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 2,
  },
  packBadge: {
    position: 'absolute',
    top: -8,
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  packBadgeText: { ...type.caption, color: colors.primaryOn, fontSize: 10, fontWeight: '600' },
  packCredits: { ...type.title, fontSize: 28, color: colors.text },
  packCreditsLabel: { ...type.caption, color: colors.textMuted, fontSize: 11 },
  packPrice: { ...type.body, color: colors.text, fontWeight: '600', marginTop: 4 },
  referralCard: {
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
    marginTop: spacing.md,
  },
  referralHeader: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  referralIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  referralHeaderText: { flex: 1, gap: 2 },
  referralTitle: { ...type.heading, fontSize: 16, color: colors.text },
  referralHelper: { ...type.caption, color: colors.textMuted, lineHeight: 18 },
  codeBox: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    gap: 4,
  },
  codeLabel: { ...type.eyebrow, color: colors.textMuted, fontSize: 10 },
  codeValue: {
    ...type.display,
    fontSize: 30,
    color: colors.text,
    letterSpacing: 4,
    fontWeight: '700',
  },
  codeValuePending: { ...type.heading, color: colors.textFaint, fontSize: 16 },
  referralActions: { flexDirection: 'row', gap: spacing.sm },
  refSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  refSecondaryLabel: { ...type.caption, color: colors.text, fontWeight: '600' },
  refPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  refPrimaryLabel: { ...type.caption, color: colors.primaryOn, fontWeight: '600' },
  redeemWrap: { gap: spacing.xs, marginTop: spacing.xs },
  redeemLabel: { ...type.caption, color: colors.textMuted, fontWeight: '600' },
  redeemRow: { flexDirection: 'row', gap: spacing.sm },
  redeemInput: {
    flex: 1,
    height: 44,
    paddingHorizontal: spacing.md,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    ...type.heading,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: 2,
    fontSize: 15,
  },
  redeemBtn: {
    paddingHorizontal: spacing.lg,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  redeemBtnDisabled: { opacity: 0.4 },
  redeemBtnLabel: { ...type.heading, fontSize: 14, color: colors.primaryOn },
  disclosureCard: {
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  disclosureHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  disclosureTitle: { ...type.heading, fontSize: 14, color: colors.text },
  disclosureBody: { ...type.body, fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  disclosureStrong: { color: colors.text, fontWeight: '700' },
  disclosureFootnote: { ...type.caption, color: colors.textFaint, lineHeight: 18, marginTop: spacing.xs },
  disclosureLegalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  disclosureLegalLink: {
    ...type.caption,
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
    textDecorationLine: 'underline',
    textDecorationColor: colors.borderStrong,
  },
  disclosureLegalSep: { ...type.caption, color: colors.textFaint, fontSize: 12 },
});
