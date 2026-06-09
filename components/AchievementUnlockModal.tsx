import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Award, Sparkles } from 'lucide-react-native';
import { colors, radius, shadow, spacing, type } from '../lib/theme';
import { subscribeAchievementUnlocks, type Achievement } from '../lib/glow';

/**
 * Global celebration modal. Mounts once at the root layout. Subscribes to
 * achievement unlocks and shows them one at a time with a spring + sparkle
 * intro. If multiple achievements unlock at the same instant they queue up
 * and play through in sequence — the user has to dismiss each.
 */
export function AchievementUnlockModal() {
  const [queue, setQueue] = useState<Achievement[]>([]);
  // Guard against double-broadcasts of the same unlock (can happen if
  // checkAchievements is called from multiple screens in quick succession).
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    return subscribeAchievementUnlocks((unlocked) => {
      const fresh = unlocked.filter((a) => !seen.current.has(a.id));
      fresh.forEach((a) => seen.current.add(a.id));
      if (fresh.length > 0) {
        setQueue((q) => [...q, ...fresh]);
      }
    });
  }, []);

  const current = queue[0] ?? null;

  const dismiss = useCallback(() => {
    setQueue((q) => q.slice(1));
  }, []);

  return (
    <Modal
      visible={!!current}
      transparent
      animationType="fade"
      onRequestClose={dismiss}
      statusBarTranslucent
    >
      <Pressable onPress={dismiss} style={styles.backdrop}>
        {current && <UnlockCard achievement={current} onDismiss={dismiss} />}
      </Pressable>
    </Modal>
  );
}

function UnlockCard({
  achievement,
  onDismiss,
}: {
  achievement: Achievement;
  onDismiss: () => void;
}) {
  const scale = useSharedValue(0.3);
  const opacity = useSharedValue(0);
  const ringRotate = useSharedValue(0);
  const sparkBreathe = useSharedValue(0);

  useEffect(() => {
    scale.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.back(1.6)) });
    opacity.value = withTiming(1, { duration: 280 });
    ringRotate.value = withRepeat(
      withTiming(1, { duration: 6000, easing: Easing.linear }),
      -1,
      false,
    );
    sparkBreathe.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 700, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [scale, opacity, ringRotate, sparkBreathe, achievement.id]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${ringRotate.value * 360}deg` }],
  }));
  const sparkStyle = useAnimatedStyle(() => ({
    opacity: 0.4 + sparkBreathe.value * 0.6,
    transform: [{ scale: 0.85 + sparkBreathe.value * 0.25 }],
  }));

  return (
    <Animated.View
      style={[styles.card, shadow.card, cardStyle]}
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(180)}
    >
      <Animated.View style={[styles.sparkle, styles.sparkleTL, sparkStyle]}>
        <Sparkles size={18} color={colors.primary} strokeWidth={2} />
      </Animated.View>
      <Animated.View style={[styles.sparkle, styles.sparkleTR, sparkStyle]}>
        <Sparkles size={14} color={colors.primary} strokeWidth={2} />
      </Animated.View>
      <Animated.View style={[styles.sparkle, styles.sparkleBR, sparkStyle]}>
        <Sparkles size={16} color={colors.primary} strokeWidth={2} />
      </Animated.View>

      <Text style={styles.eyebrow}>ACHIEVEMENT UNLOCKED</Text>

      <View style={styles.badgeWrap}>
        <Animated.View style={[styles.ring, ringStyle]} />
        <View style={styles.badge}>
          <Award size={42} color={colors.primaryOn} strokeWidth={1.6} />
        </View>
      </View>

      <Text style={styles.title}>{achievement.title}</Text>
      <Text style={styles.desc}>{achievement.desc}</Text>
      <View style={styles.bonusPill}>
        <Sparkles size={12} color={colors.primary} strokeWidth={2.2} />
        <Text style={styles.bonusText}>+{achievement.bonusPoints} bonus points</Text>
      </View>

      <Text style={styles.congrats}>Congratulations, girly! ✨</Text>

      <Pressable onPress={onDismiss} style={styles.cta}>
        <Text style={styles.ctaLabel}>Keep going</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,10,10,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.bg,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  sparkle: { position: 'absolute' },
  sparkleTL: { top: 16, left: 18 },
  sparkleTR: { top: 28, right: 22 },
  sparkleBR: { bottom: 90, right: 28 },
  eyebrow: {
    ...type.eyebrow,
    color: colors.primary,
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: '700',
  },
  badgeWrap: {
    width: 132,
    height: 132,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.sm,
  },
  ring: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  badge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...type.title, fontSize: 24, color: colors.text, textAlign: 'center' },
  desc: {
    ...type.body,
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 280,
  },
  bonusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    marginTop: spacing.xs,
  },
  bonusText: {
    ...type.caption,
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  congrats: {
    ...type.body,
    color: colors.text,
    fontStyle: 'italic',
    fontSize: 14,
    marginTop: spacing.sm,
  },
  cta: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.xxl,
    paddingVertical: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  ctaLabel: { ...type.heading, color: colors.primaryOn, fontSize: 15 },
});
