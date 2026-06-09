import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AlertCircle, Sparkles } from 'lucide-react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useEffect, useState } from 'react';
import { colors, radius, shadow, spacing, type } from '../lib/theme';

const LABEL_INTERVAL_MS = 2500;

/**
 * Loading panel for AI-driven flows. Accepts either:
 *   - `label`: a single static string (legacy callers).
 *   - `labels`: a rotating array — each entry shows for ~2.5s with a soft
 *     fade transition between, so the screen never feels stuck on one
 *     message. Useful when the underlying request takes 10-60s.
 */
export function AiLoading({
  label,
  labels,
  hint,
}: {
  label?: string;
  labels?: readonly string[];
  hint?: string;
}) {
  const rotate = useSharedValue(0);
  const breathe = useSharedValue(0);
  const [labelIdx, setLabelIdx] = useState(0);

  useEffect(() => {
    // Continuous spin via a very long single timing — avoids any repeat boundary snap
    rotate.value = withTiming(10000, { duration: 2200 * 10000, easing: Easing.linear });
    breathe.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [rotate, breathe]);

  // Rotate through `labels` every LABEL_INTERVAL_MS. When the list runs out,
  // wrap around so longer-than-expected requests still feel alive.
  useEffect(() => {
    if (!labels || labels.length <= 1) return;
    const t = setInterval(() => {
      setLabelIdx((i) => (i + 1) % labels.length);
    }, LABEL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [labels]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${(rotate.value * 36) % 360}deg` },
      { scale: 1 + breathe.value * 0.08 },
    ],
  }));

  const currentLabel = labels?.[labelIdx] ?? label ?? 'Loading…';

  return (
    <View style={[styles.panel, shadow.card]}>
      <Animated.View style={[styles.iconRing, style]}>
        <Sparkles size={32} color={colors.primary} strokeWidth={1.6} />
      </Animated.View>
      {/* key={labelIdx} forces a remount on label change so the FadeIn
          entering animation fires for each new message. */}
      <Animated.Text
        key={labelIdx}
        entering={FadeIn.duration(450)}
        style={styles.title}
      >
        {currentLabel}
      </Animated.Text>
      <Text style={styles.body}>{hint ?? 'This usually takes 10–30 seconds. Keep the app open.'}</Text>
    </View>
  );
}

export function AiError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={[styles.panel, shadow.card]}>
      <View style={[styles.iconRing, styles.iconRingError]}>
        <AlertCircle size={28} color={colors.primary} strokeWidth={1.8} />
      </View>
      <Text style={styles.title}>That didn't land</Text>
      <Text style={styles.body}>{message}</Text>
      <Pressable onPress={onRetry} style={styles.retryBtn}>
        <Text style={styles.retryLabel}>Try again</Text>
      </Pressable>
    </View>
  );
}

export function NoCredits({ reason }: { reason: string }) {
  return (
    <View style={[styles.panel, shadow.card]}>
      <View style={[styles.iconRing, styles.iconRingError]}>
        <Sparkles size={28} color={colors.primary} strokeWidth={1.8} />
      </View>
      <Text style={styles.title}>Out of credits</Text>
      <Text style={styles.body}>{reason}</Text>
      <Pressable onPress={() => router.push('/menu/credits')} style={styles.retryBtn}>
        <Text style={styles.retryLabel}>Get more credits</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.bgSoft,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  iconRingError: { borderColor: colors.borderStrong },
  title: { ...type.heading, color: colors.text, textAlign: 'center' },
  body: {
    ...type.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },
  retryBtn: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  retryLabel: { ...type.heading, fontSize: 15, color: colors.primaryOn },
});
