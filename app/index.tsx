import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { ArrowRight, Clock, Sparkles } from 'lucide-react-native';
import { Screen } from '../components/Screen';
import { Button } from '../components/Button';
import { colors, radius, shadow, spacing, type } from '../lib/theme';
import { useLook } from '../lib/state';

export default function Landing() {
  const { reset } = useLook();
  const float = useSharedValue(0);
  const shimmer = useSharedValue(0);

  useEffect(() => {
    float.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 2400, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
    shimmer.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [float, shimmer]);

  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -float.value * 14 }, { scale: 1 + float.value * 0.04 }],
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: 0.4 + shimmer.value * 0.6,
  }));

  const start = () => {
    reset();
    router.push('/selfie');
  };

  return (
    <Screen>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.push('/history')} hitSlop={12} style={styles.historyBtn}>
          <Clock size={18} color={colors.text} strokeWidth={2} />
          <Text style={styles.historyLabel}>History</Text>
        </Pressable>
      </View>

      <View style={styles.hero}>
        <Animated.View style={[styles.orb, shadow.card, orbStyle]}>
          <Animated.View style={shimmerStyle}>
            <Sparkles size={44} color={colors.primary} strokeWidth={1.6} />
          </Animated.View>
        </Animated.View>

        <Text style={styles.eyebrow}>Blendrr Ai</Text>
        <Text style={styles.title}>Slay before{'\n'}you pay.</Text>
        <Text style={styles.subtitle}>
          Match any shade you see online and try it on your face, lips, or hair in seconds.
        </Text>
      </View>

      <View style={styles.cta}>
        <Button
          label="Start a try-on"
          onPress={start}
          trailing={<ArrowRight size={20} color={colors.primaryOn} strokeWidth={2.4} />}
        />
        <Text style={styles.footnote}>Powered by Nano Banana</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: spacing.sm,
  },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  historyLabel: { ...type.caption, color: colors.text },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  orb: {
    width: 140,
    height: 140,
    borderRadius: radius.xl,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eyebrow: {
    ...type.eyebrow,
    color: colors.primary,
  },
  title: { ...type.display, color: colors.text, textAlign: 'center' },
  subtitle: {
    ...type.body,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 320,
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  cta: {
    paddingBottom: spacing.lg,
    gap: spacing.md,
    alignItems: 'center',
  },
  footnote: { ...type.caption, color: colors.textFaint },
});
