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
  // Display always normalises to "X/100" regardless of the user's actual
  // task total. For the default 8-task config max=100 so display=score; for
  // custom configs we project onto a 100-scale so the number reads the same.
  const displayScore = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const pct = displayScore / 100;
  const ringColor = pct >= 0.5 ? SCORE_GREEN : SCORE_RED;

  return (
    <Screen edges={['top']}>
      <TabHeader />

      <View style={styles.statsRow}>
        <StatCard
          label={'Badges\nUnlocked'}
          value={`${unlocked}/${ACHIEVEMENTS.length}`}
          icon={Trophy}
          onPress={() => router.push('/menu/achievements')}
        />
        <GlowRingCard
          displayScore={displayScore}
          color={ringColor}
          onPress={() => router.push('/menu/glow')}
        />
        <StatCard
          label={'Daily\nStreak'}
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
 * Circular progress ring for the Glow Score. Stroke goes green at >=50%,
 * red below. Centre shows the normalised score as "X/100".
 */
function GlowRingCard({
  displayScore,
  color,
  onPress,
}: {
  displayScore: number;
  color: string;
  onPress: () => void;
}) {
  const SIZE = 64;
  const STROKE = 6;
  const RADIUS = (SIZE - STROKE) / 2;
  const CIRC = 2 * Math.PI * RADIUS;
  const pct = Math.min(1, displayScore / 100);
  const offset = CIRC * (1 - pct);

  return (
    <Pressable onPress={onPress} style={[styles.statCard, styles.ringCard, shadow.card]}>
      <View style={styles.ringWrap}>
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
        <View style={styles.ringCentre}>
          <Text style={styles.ringScore}>{displayScore}</Text>
          <Text style={styles.ringScoreDenom}>/100</Text>
        </View>
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
        <Icon size={20} color={colors.text} strokeWidth={1.8} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  logo: {
    width: 220,
    height: 220,
    marginTop: -spacing.sm,
  },
  // Title overlaps the bottom of the logo PNG — by -32px so it sits visually
  // "on" the pink area. zIndex/elevation guarantee it paints above the logo
  // image even on Android where document-order stacking can be unreliable.
  title: {
    ...type.display,
    color: colors.text,
    textAlign: 'center',
    marginTop: -spacing.xl,
    zIndex: 3,
    elevation: 3,
  },
  subtitle: {
    ...type.body,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 320,
    marginTop: spacing.md,
    lineHeight: 22,
    zIndex: 3,
    elevation: 3,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    // The hero logo PNG has a pink background and we pull it up with a
    // negative margin to tuck it under the stat row. Without an explicit
    // stacking order the logo paints OVER the icons (later sibling wins by
    // default in RN). Force the cards to render above the logo.
    zIndex: 2,
    elevation: 2, // Android counterpart
  },
  hero: {
    alignItems: 'center',
    gap: 2,
    paddingTop: 0,
    marginTop: -spacing.xs,
    zIndex: 1,
    elevation: 1,
  },
  // Common card shell — content is centred so the Trophy / Flame icons sit
  // on the same Y as the centre of the Glow ring without manual margins.
  statCard: {
    flex: 1,
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 108,
  },
  ringCard: {
    flex: 1.15,
  },
  ringWrap: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCentre: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  ringScore: { ...type.title, fontSize: 17, color: colors.text, lineHeight: 20 },
  ringScoreDenom: { ...type.caption, color: colors.textFaint, fontSize: 9, fontWeight: '500' },
  ringLabel: { ...type.caption, color: colors.textMuted, fontWeight: '600', fontSize: 10, textAlign: 'center' },
  statIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: { ...type.title, color: colors.text, fontSize: 15, lineHeight: 19, textAlign: 'center' },
  statLabel: {
    ...type.caption,
    color: colors.textMuted,
    fontWeight: '600',
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 13,
  },
  cta: {
    // Push to the bottom of the screen with flex:auto so the "Start a try-on"
    // button lines up with the equivalent button on the Skin / Hair / Scent
    // / Scan tabs (which use the same trick in CategoryHome). Big
    // paddingBottom lifts the button well above the floating tab bar so it
    // sits in the lower-middle of the screen rather than at the bottom.
    marginTop: 'auto',
    paddingBottom: 220,
    alignItems: 'center',
    zIndex: 3,
    elevation: 3,
  },
});
