import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { ArrowRight } from 'lucide-react-native';
import { Screen } from './Screen';
import { Button } from './Button';
import { TabHeader } from './TabHeader';
import { colors, radius, shadow, spacing, type } from '../lib/theme';
import type { ComponentType } from 'react';

type SecondaryCta = {
  label: string;
  onPress: () => void;
};

type Props = {
  eyebrow: string;
  title: string;
  subtitle: string;
  Icon: ComponentType<{ size: number; color: string; strokeWidth: number }>;
  ctaLabel: string;
  onStart: () => void;
  secondaryCta?: SecondaryCta;
};

export function CategoryHome({
  eyebrow,
  title,
  subtitle,
  Icon,
  ctaLabel,
  onStart,
  secondaryCta,
}: Props) {
  const float = useSharedValue(0);

  useEffect(() => {
    float.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [float]);

  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -float.value * 12 }, { scale: 1 + float.value * 0.03 }],
  }));

  return (
    <Screen edges={['top']}>
      <TabHeader />
      <View style={styles.hero}>
        <Animated.View style={[styles.orb, shadow.card, orbStyle]}>
          <Icon size={48} color={colors.text} strokeWidth={1.6} />
        </Animated.View>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <View style={styles.cta}>
        <Button
          label={ctaLabel}
          onPress={onStart}
          trailing={<ArrowRight size={20} color={colors.primaryOn} strokeWidth={2.4} />}
        />
      </View>

      {/* Secondary CTA (e.g. "Got acne?" on the skincare tab) is positioned
          absolutely so its presence doesn't lift the primary button — the
          primary stays at the same Y on every tab whether or not a
          secondary exists. */}
      {secondaryCta && (
        <View style={styles.secondaryWrap}>
          <Pressable onPress={secondaryCta.onPress} style={styles.secondaryBtn}>
            <Text style={styles.secondaryLabel}>{secondaryCta.label}</Text>
            <ArrowRight size={16} color={colors.text} strokeWidth={2.2} />
          </Pressable>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.xxl + spacing.md,
  },
  orb: {
    width: 132,
    height: 132,
    borderRadius: radius.xl,
    backgroundColor: colors.bgSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: -spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eyebrow: { ...type.eyebrow, color: colors.textMuted },
  title: { ...type.display, color: colors.text, textAlign: 'center', fontSize: 36 },
  subtitle: {
    ...type.body,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 320,
    marginTop: spacing.xs,
    lineHeight: 22,
    minHeight: 88,
  },
  cta: {
    // marginTop: 'auto' + matching paddingBottom pins the primary CTA to
    // the same Y across every tab. MUST match `cta.paddingBottom` in
    // app/(tabs)/index.tsx — change them together or buttons drift.
    marginTop: 'auto',
    paddingBottom: 180,
    alignItems: 'center',
  },
  // Absolutely positioned so it sits below the primary CTA without
  // displacing it. bottom: 110 = 70px below where the primary's bottom
  // edge sits, leaving a comfortable ~30px gap between the two buttons.
  secondaryWrap: {
    position: 'absolute',
    bottom: 110,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  secondaryLabel: { ...type.caption, color: colors.text, fontWeight: '600', fontSize: 13 },
});
