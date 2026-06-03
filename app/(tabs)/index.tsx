import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useEffect, useState } from 'react';
import { ArrowRight, Flame, Sparkles, Trophy } from 'lucide-react-native';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { TabHeader } from '../../components/TabHeader';
import { colors, radius, shadow, spacing, type } from '../../lib/theme';
import { useLook } from '../../lib/state';
import {
  ACHIEVEMENTS,
  getCurrentStreak,
  getTodayScore,
  loadGlow,
  subscribeGlow,
  type GlowState,
} from '../../lib/glow';

const logo = require('../../assets/logo.png');

export default function Landing() {
  const { resetTryOn } = useLook();
  const float = useSharedValue(0);
  const [glow, setGlow] = useState<GlowState | null>(null);

  useEffect(() => {
    float.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [float]);

  useEffect(() => {
    loadGlow().then(setGlow);
    return subscribeGlow(setGlow);
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -float.value * 10 }, { scale: 1 + float.value * 0.02 }],
  }));

  const start = () => {
    resetTryOn();
    router.push('/selfie');
  };

  const score = glow ? getTodayScore(glow) : 0;
  const streak = glow ? getCurrentStreak(glow) : 0;
  const unlocked = glow?.achievements.length ?? 0;

  return (
    <Screen edges={['top']}>
      <TabHeader />

      <View style={styles.hero}>
        <Animated.View style={logoStyle}>
          <Image source={logo} style={styles.logo} resizeMode="contain" />
        </Animated.View>

        <Text style={styles.title}>Slay before{'\n'}you pay.</Text>
        <Text style={styles.subtitle}>
          Match any shade online, try it on, build your skincare and haircare routines, and find
          your signature scent.
        </Text>
      </View>

      <View style={styles.statsRow}>
        <StatCard
          icon={Sparkles}
          label="Glow Score"
          value={score}
          tint="primary"
          onPress={() => router.push('/menu/glow')}
        />
        <StatCard
          icon={Trophy}
          label="Achievements"
          value={unlocked}
          suffix={`/${ACHIEVEMENTS.length}`}
          onPress={() => router.push('/menu/achievements')}
        />
        <StatCard
          icon={Flame}
          label="Streak"
          value={streak}
          suffix={streak === 1 ? ' day' : ' days'}
          onPress={() => router.push('/menu/streak')}
        />
      </View>

      <View style={styles.cta}>
        <Button
          label="Start a try-on"
          onPress={start}
          trailing={<ArrowRight size={20} color={colors.primaryOn} strokeWidth={2.4} />}
        />
      </View>
    </Screen>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  suffix,
  tint,
  onPress,
}: {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
  label: string;
  value: number;
  suffix?: string;
  tint?: 'primary';
  onPress: () => void;
}) {
  const isPrimary = tint === 'primary';
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.statCard,
        shadow.card,
        isPrimary && styles.statCardPrimary,
      ]}
    >
      <View
        style={[
          styles.statIconWrap,
          isPrimary && styles.statIconWrapPrimary,
        ]}
      >
        <Icon
          size={18}
          color={isPrimary ? colors.primaryOn : colors.text}
          strokeWidth={1.8}
        />
      </View>
      <Text style={[styles.statValue, isPrimary && styles.statValuePrimary]}>
        {value}
        {suffix && <Text style={[styles.statSuffix, isPrimary && styles.statSuffixPrimary]}>{suffix}</Text>}
      </Text>
      <Text style={[styles.statLabel, isPrimary && styles.statLabelPrimary]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  logo: {
    width: 240,
    height: 240,
  },
  title: { ...type.display, color: colors.text, textAlign: 'center' },
  subtitle: {
    ...type.body,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 320,
    marginTop: spacing.xs,
    lineHeight: 22,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'flex-start',
    gap: 6,
  },
  statCardPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statIconWrapPrimary: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.3)',
  },
  statValue: { ...type.title, color: colors.text, fontSize: 22, lineHeight: 26 },
  statValuePrimary: { color: colors.primaryOn },
  statSuffix: { ...type.caption, fontSize: 11, color: colors.textFaint, fontWeight: '500' },
  statSuffixPrimary: { color: 'rgba(255,255,255,0.85)' },
  statLabel: { ...type.caption, color: colors.textMuted, fontWeight: '600', fontSize: 11 },
  statLabelPrimary: { color: 'rgba(255,255,255,0.85)' },
  cta: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
});
