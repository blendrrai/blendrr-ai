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
import { ArrowRight, Flame, Trophy } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { TabHeader } from '../../components/TabHeader';
import { colors, radius, shadow, spacing, type } from '../../lib/theme';
import { useLook } from '../../lib/state';
import {
  ACHIEVEMENTS,
  getCurrentStreak,
  getTodayMaxScore,
  getTodayScore,
  loadGlow,
  subscribeGlow,
  type GlowState,
} from '../../lib/glow';

const SCORE_GREEN = '#22A06B';
const SCORE_RED = '#D14A4A';

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
  const maxScore = glow ? getTodayMaxScore(glow) : 100;
  const streak = glow ? getCurrentStreak(glow) : 0;
  const unlocked = glow?.achievements.length ?? 0;
  const pct = maxScore > 0 ? score / maxScore : 0;
  const ringColor = pct >= 0.5 ? SCORE_GREEN : SCORE_RED;

  return (
    <Screen edges={['top']}>
      <TabHeader />

      <View style={styles.statsRow}>
        <StatCard
          label="Achievements"
          value={`${unlocked}/${ACHIEVEMENTS.length}`}
          icon={Trophy}
          onPress={() => router.push('/menu/achievements')}
        />
        <GlowRingCard
          score={score}
          maxScore={maxScore}
          color={ringColor}
          onPress={() => router.push('/menu/glow')}
        />
        <StatCard
          label="Streak"
          value={`${streak}${streak === 1 ? ' day' : ' days'}`}
          icon={Flame}
          onPress={() => router.push('/menu/streak')}
        />
      </View>

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

/**
 * Circular progress ring for the Glow Score. Stroke goes green at >=50% of
 * the day's max, red below. Centre shows the raw score number.
 */
function GlowRingCard({
  score,
  maxScore,
  color,
  onPress,
}: {
  score: number;
  maxScore: number;
  color: string;
  onPress: () => void;
}) {
  const SIZE = 84;
  const STROKE = 8;
  const RADIUS = (SIZE - STROKE) / 2;
  const CIRC = 2 * Math.PI * RADIUS;
  const pct = maxScore > 0 ? Math.min(1, score / maxScore) : 0;
  const offset = CIRC * (1 - pct);

  return (
    <Pressable onPress={onPress} style={[styles.statCard, styles.ringCard, shadow.card]}>
      <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={SIZE} height={SIZE} style={{ position: 'absolute' }}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={colors.border}
            strokeWidth={STROKE}
            fill="none"
          />
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={color}
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={CIRC}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </Svg>
        <Text style={styles.ringScore}>{score}</Text>
      </View>
      <Text style={styles.ringLabel}>Glow Score</Text>
    </Pressable>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  onPress,
}: {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.statCard, shadow.card]}>
      <View style={styles.statIconWrap}>
        <Icon size={18} color={colors.text} strokeWidth={1.8} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 6,
    minHeight: 124,
    justifyContent: 'center',
  },
  ringCard: {
    flex: 1.2,
    paddingVertical: spacing.sm,
  },
  ringScore: { ...type.title, fontSize: 24, color: colors.text },
  ringLabel: { ...type.caption, color: colors.textMuted, fontWeight: '600', fontSize: 11, marginTop: 4 },
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
  statValue: { ...type.title, color: colors.text, fontSize: 17, lineHeight: 22, textAlign: 'center' },
  statLabel: { ...type.caption, color: colors.textMuted, fontWeight: '600', fontSize: 11, textAlign: 'center' },
  cta: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
});
