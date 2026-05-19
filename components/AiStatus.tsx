import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AlertCircle, Sparkles } from 'lucide-react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { colors, radius, shadow, spacing, type } from '../lib/theme';

export function AiLoading({ label }: { label: string }) {
  const rotate = useSharedValue(0);
  const breathe = useSharedValue(0);
  useEffect(() => {
    // Continuous spin via a very long single timing — avoids any repeat boundary snap
    rotate.value = withTiming(10000, { duration: 2200 * 10000, easing: Easing.linear });
    breathe.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [rotate, breathe]);
  const style = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${(rotate.value * 36) % 360}deg` },
      { scale: 1 + breathe.value * 0.08 },
    ],
  }));

  return (
    <View style={[styles.panel, shadow.card]}>
      <Animated.View style={[styles.iconRing, style]}>
        <Sparkles size={32} color={colors.primary} strokeWidth={1.6} />
      </Animated.View>
      <Text style={styles.title}>{label}</Text>
      <Text style={styles.body}>Usually 3–6 seconds. Keep the app open.</Text>
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
