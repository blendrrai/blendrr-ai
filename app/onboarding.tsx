import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  ArrowRight,
  Droplet,
  Flower2,
  Lock,
  Smile,
  Sparkles,
  Wind,
} from 'lucide-react-native';
import type { ComponentType } from 'react';
import { colors, radius, shadow, spacing, type } from '../lib/theme';
import { markOnboardingSeen } from '../lib/storage';
import { redeemReferralCode } from '../lib/user';

const { width: WIDTH } = Dimensions.get('window');

type IconProps = { size: number; color: string; strokeWidth: number };

type Page = {
  eyebrow: string;
  title: string;
  body: string;
  Hero: ComponentType<{ active: boolean }>;
};

const PAGES: Page[] = [
  {
    eyebrow: 'Try-ons',
    title: 'Try any shade\nyou scroll past.',
    body: 'Screenshot a product from any website, or snap a photo in store. See any lipstick, foundation, or hair shade on you in seconds.',
    Hero: TryOnHero,
  },
  {
    eyebrow: 'Routines',
    title: 'Skincare & hair,\ndecoded.',
    body: 'Quick quiz, one selfie. Personalised routine — what to add, what to skip, what habits matter.',
    Hero: RoutineHero,
  },
  {
    eyebrow: 'Fragrance',
    title: 'Your signature\nscent, found.',
    body: 'Six taste questions. Three currently-trending bottles, matched to your mood and budget.',
    Hero: FragranceHero,
  },
  {
    eyebrow: 'Privacy',
    title: 'Stays on your\nphone, always.',
    body: 'No accounts, no cloud, no tracking. Your photos, wishlist, and history live on this device only.',
    Hero: PrivacyHero,
  },
];

export default function Onboarding() {
  const [index, setIndex] = useState(0);
  const [referralCode, setReferralCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / WIDTH);
    if (i !== index) setIndex(i);
  };

  // Dismiss the keyboard as soon as the user starts swiping between pages —
  // swipe = "I'm done typing".
  const onScrollBeginDrag = () => {
    Keyboard.dismiss();
  };

  const finish = async () => {
    await markOnboardingSeen();
    router.replace('/');
  };

  const goNext = async () => {
    if (index < PAGES.length - 1) {
      scrollRef.current?.scrollTo({ x: (index + 1) * WIDTH, animated: true });
      return;
    }
    // On the last slide: try redeem if a code was entered, then finish.
    const code = referralCode.trim();
    if (!code) {
      await finish();
      return;
    }
    setRedeeming(true);
    const result = await redeemReferralCode(code);
    setRedeeming(false);
    if (result.ok) {
      Alert.alert(
        'Code applied 🎉',
        `+${result.reward} credits added. You're all set.`,
        [{ text: 'Continue', onPress: finish }],
      );
    } else {
      Alert.alert(
        "Code didn't apply",
        `${result.error}\n\nYou can continue without it — you can always add a code later from Settings.`,
        [
          { text: 'Try again', style: 'cancel' },
          { text: 'Continue anyway', onPress: finish },
        ],
      );
    }
  };

  const skip = async () => {
    await finish();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
      <View style={styles.topRow}>
        {index < PAGES.length - 1 ? (
          <Pressable onPress={skip} hitSlop={10} style={styles.skipBtn}>
            <Text style={styles.skipLabel}>Skip</Text>
          </Pressable>
        ) : (
          <View style={styles.skipBtn} />
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        onScrollBeginDrag={onScrollBeginDrag}
        scrollEventThrottle={16}
        bounces={false}
        keyboardShouldPersistTaps="handled"
        style={styles.scroller}
      >
        {PAGES.map((p, i) => {
          const isLast = i === PAGES.length - 1;
          return (
            <TouchableWithoutFeedback key={p.eyebrow} onPress={Keyboard.dismiss} accessible={false}>
              <View style={styles.page}>
                <View style={styles.heroWrap}>
                  <p.Hero active={index === i} />
                </View>
                <Text style={styles.eyebrow}>{p.eyebrow}</Text>
                <Text style={styles.title}>{p.title}</Text>
                <Text style={styles.body}>{p.body}</Text>

                {isLast && (
                  <View style={styles.referralWrap}>
                    <Text style={styles.referralLabel}>Got a friend's code?</Text>
                    <TextInput
                      value={referralCode}
                      onChangeText={(t) => setReferralCode(t.toUpperCase())}
                      placeholder="e.g. LUNA42"
                      placeholderTextColor={colors.textFaint}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      maxLength={6}
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                      style={styles.referralInput}
                    />
                    <Text style={styles.referralHelper}>
                      +5 credits for you, +3 for them. Optional — skip if you don't have one.
                    </Text>
                  </View>
                )}
              </View>
            </TouchableWithoutFeedback>
          );
        })}
      </ScrollView>

      <View style={styles.bottomRow}>
        <View style={styles.dots}>
          {PAGES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === index && styles.dotActive]}
            />
          ))}
        </View>

        <Pressable onPress={goNext} disabled={redeeming} style={[styles.cta, redeeming && styles.ctaDisabled]}>
          <Text style={styles.ctaLabel}>
            {redeeming
              ? 'Checking code…'
              : index === PAGES.length - 1
                ? 'Get started'
                : 'Next'}
          </Text>
          <ArrowRight size={18} color={colors.primaryOn} strokeWidth={2.4} />
        </Pressable>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function TryOnHero({ active }: { active: boolean }) {
  const float = useSharedValue(0);
  const swap = useSharedValue(0);

  useEffect(() => {
    if (!active) return;
    float.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    swap.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.cubic) }),
      -1,
      true,
    );
  }, [active, float, swap]);

  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -float.value * 8 }],
  }));

  const shadeStyle = useAnimatedStyle(() => ({
    opacity: swap.value,
    transform: [{ scale: 0.7 + swap.value * 0.3 }],
  }));

  const sparkleStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + swap.value * 0.7,
    transform: [{ rotate: `${swap.value * 180}deg` }],
  }));

  return (
    <View style={styles.heroBox}>
      <Animated.View style={[styles.faceRing, faceStyle]}>
        <Smile size={64} color={colors.text} strokeWidth={1.4} />
        <Animated.View style={[styles.shadeOverlay, shadeStyle]} />
      </Animated.View>
      <Animated.View style={[styles.sparkleOrbit, sparkleStyle]}>
        <Sparkles size={28} color={colors.primary} strokeWidth={1.8} />
      </Animated.View>
    </View>
  );
}

function RoutineHero({ active }: { active: boolean }) {
  const a = useSharedValue(0);
  const b = useSharedValue(0);

  useEffect(() => {
    if (!active) return;
    a.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    b.value = withDelay(
      600,
      withRepeat(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      ),
    );
  }, [active, a, b]);

  const dropStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -a.value * 14 },
      { scale: 1 + a.value * 0.06 },
      { rotate: `${a.value * -8}deg` },
    ],
  }));

  const windStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -b.value * 14 },
      { scale: 1 + b.value * 0.06 },
      { rotate: `${b.value * 8}deg` },
    ],
  }));

  return (
    <View style={styles.heroBox}>
      <Animated.View style={[styles.miniOrb, styles.orbLeft, dropStyle]}>
        <Droplet size={36} color={colors.text} strokeWidth={1.5} />
      </Animated.View>
      <Animated.View style={[styles.miniOrb, styles.orbRight, windStyle]}>
        <Wind size={36} color={colors.text} strokeWidth={1.5} />
      </Animated.View>
    </View>
  );
}

function FragranceHero({ active }: { active: boolean }) {
  const rotate = useSharedValue(0);
  const petalA = useSharedValue(0);
  const petalB = useSharedValue(0);
  const petalC = useSharedValue(0);

  useEffect(() => {
    if (!active) return;
    // Long single timing avoids the 360→0 snap of withRepeat at iteration boundary
    rotate.value = withTiming(10000, { duration: 8000 * 10000, easing: Easing.linear });
    petalA.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    petalB.value = withDelay(
      600,
      withRepeat(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      ),
    );
    petalC.value = withDelay(
      1200,
      withRepeat(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      ),
    );
  }, [active, rotate, petalA, petalB, petalC]);

  const flowerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${(rotate.value * 36) % 360}deg` }],
  }));

  const petalAStyle = useAnimatedStyle(() => ({
    opacity: petalA.value,
    transform: [
      { translateX: Math.cos((-60 * Math.PI) / 180) * (50 + petalA.value * 30) },
      { translateY: Math.sin((-60 * Math.PI) / 180) * (50 + petalA.value * 30) },
      { scale: 0.4 + petalA.value * 0.6 },
    ],
  }));

  const petalBStyle = useAnimatedStyle(() => ({
    opacity: petalB.value,
    transform: [
      { translateX: Math.cos((180 * Math.PI) / 180) * (50 + petalB.value * 30) },
      { translateY: Math.sin((180 * Math.PI) / 180) * (50 + petalB.value * 30) },
      { scale: 0.4 + petalB.value * 0.6 },
    ],
  }));

  const petalCStyle = useAnimatedStyle(() => ({
    opacity: petalC.value,
    transform: [
      { translateX: Math.cos((60 * Math.PI) / 180) * (50 + petalC.value * 30) },
      { translateY: Math.sin((60 * Math.PI) / 180) * (50 + petalC.value * 30) },
      { scale: 0.4 + petalC.value * 0.6 },
    ],
  }));

  return (
    <View style={styles.heroBox}>
      <Animated.View style={[styles.faceRing, flowerStyle]}>
        <Flower2 size={64} color={colors.text} strokeWidth={1.4} />
      </Animated.View>
      <Animated.View style={[styles.petal, petalAStyle]} />
      <Animated.View style={[styles.petal, petalBStyle]} />
      <Animated.View style={[styles.petal, petalCStyle]} />
    </View>
  );
}

function PrivacyHero({ active }: { active: boolean }) {
  const pulse = useSharedValue(0);
  const halo = useSharedValue(0);

  useEffect(() => {
    if (!active) return;
    pulse.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    halo.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }),
      -1,
      false,
    );
  }, [active, pulse, halo]);

  const lockStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.06 }],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: interpolate(halo.value, [0, 0.4, 1], [0, 0.5, 0]),
    transform: [{ scale: 1 + halo.value * 0.6 }],
  }));

  return (
    <View style={styles.heroBox}>
      <Animated.View style={[styles.halo, haloStyle]} />
      <Animated.View style={[styles.faceRing, lockStyle]}>
        <Lock size={56} color={colors.text} strokeWidth={1.6} />
      </Animated.View>
    </View>
  );
}

const HERO_SIZE = 220;
const FACE_RING_SIZE = 140;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroller: { flex: 1 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    height: 40,
  },
  skipBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  skipLabel: { ...type.caption, color: colors.textMuted, fontWeight: '600' },
  page: {
    width: WIDTH,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.lg,
  },
  heroWrap: {
    height: HERO_SIZE,
    width: HERO_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  heroBox: {
    width: HERO_SIZE,
    height: HERO_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceRing: {
    width: FACE_RING_SIZE,
    height: FACE_RING_SIZE,
    borderRadius: FACE_RING_SIZE / 2,
    backgroundColor: colors.bgSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  shadeOverlay: {
    position: 'absolute',
    bottom: 30,
    width: 50,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primary,
  },
  sparkleOrbit: {
    position: 'absolute',
    top: 12,
    right: 28,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.bgSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  miniOrb: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.bgSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  orbLeft: { left: 14, top: 60 },
  orbRight: { right: 14, top: 60 },
  petal: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
  },
  halo: {
    position: 'absolute',
    width: FACE_RING_SIZE,
    height: FACE_RING_SIZE,
    borderRadius: FACE_RING_SIZE / 2,
    backgroundColor: colors.primary,
  },
  eyebrow: {
    ...type.eyebrow,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  title: {
    ...type.display,
    fontSize: 34,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: 38,
  },
  body: {
    ...type.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },
  bottomRow: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.md,
    alignItems: 'center',
  },
  dots: { flexDirection: 'row', gap: 6 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  dotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    width: 24,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: 16,
    borderRadius: radius.pill,
    minWidth: 200,
    ...shadow.button,
  },
  ctaDisabled: { opacity: 0.6 },
  ctaLabel: { ...type.heading, fontSize: 16, color: colors.primaryOn },
  referralWrap: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    width: '100%',
    maxWidth: 320,
    gap: spacing.xs,
    alignItems: 'center',
  },
  referralLabel: { ...type.caption, color: colors.text, fontWeight: '600', fontSize: 13 },
  referralInput: {
    width: '100%',
    height: 48,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bgSoft,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    ...type.heading,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: 2,
    fontSize: 16,
  },
  referralHelper: {
    ...type.caption,
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 16,
  },
});
