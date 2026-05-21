import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Check, Sparkles, Wand2, Zap } from 'lucide-react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import type { ComponentType } from 'react';
import { Screen } from '../components/Screen';
import { StepHeader } from '../components/StepHeader';
import { Button } from '../components/Button';
import { colors, radius, shadow, spacing, type } from '../lib/theme';
import type { Quality } from '../lib/theme';
import { useLook } from '../lib/state';
import { startTryOn } from '../lib/blendrr';
import { canUseCredit } from '../lib/storage';
import { scheduleTryOnReadyNotification } from '../lib/notifications';

type IconProps = { size: number; color: string; strokeWidth: number };

type Option = {
  value: Quality;
  label: string;
  credits: number;
  duration: string;
  Icon: ComponentType<IconProps>;
  description: string;
  bestFor: string;
};

type OptionWithBadge = Option & { recommended?: boolean };

const OPTIONS: OptionWithBadge[] = [
  {
    value: 'medium',
    label: 'Standard',
    credits: 1,
    duration: '15–30 seconds',
    Icon: Zap,
    description: 'Roughly how a shade looks on you. Quick and good enough for browsing.',
    bestFor: 'Best for: browsing, scrolling, trying lots of products quickly.',
  },
  {
    value: 'ultra',
    label: 'Ultra HD',
    credits: 2,
    duration: '40 seconds – 1 minute',
    Icon: Sparkles,
    description: 'Pixel-perfect shade match with sharper detail. Worth the extra time when you are about to commit.',
    bestFor: 'Best for: deciding whether to actually buy the product.',
    recommended: true,
  },
];

export default function QualityPicker() {
  const { selfieUri, productUris, zone, mode, quality, setQuality } = useLook();
  const [submitting, setSubmitting] = useState(false);

  const handleVisualize = async () => {
    if (!selfieUri || productUris.length === 0) {
      Alert.alert('Missing inputs', 'Please add a selfie and at least one product.');
      return;
    }

    setSubmitting(true);
    // Up-front check on credits — server enforces this too, but a clean
    // local check avoids a wasted round-trip.
    const credit = await canUseCredit();
    if (!credit.ok) {
      setSubmitting(false);
      Alert.alert('Out of credits', credit.reason);
      return;
    }

    try {
      await startTryOn({
        selfieUri,
        productUris,
        zone,
        mode,
        quality,
      });
      // Schedule a local notification timed for when the try-on should finish,
      // so users who swipe out of the app get pinged. Fire-and-forget — if the
      // permission isn't granted, the schedule silently no-ops.
      void scheduleTryOnReadyNotification(mode, quality);
      router.push('/result');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not start try-on.';
      Alert.alert("Couldn't start try-on", message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <StepHeader
        step="Step 5 of 5"
        title="How sharp should it be?"
        subtitle="Pick a quality. You can change this on every try-on."
        showHomeButton
      />

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {OPTIONS.map((opt) => (
          <QualityCard
            key={opt.value}
            option={opt}
            selected={quality === opt.value}
            onPress={() => setQuality(opt.value)}
          />
        ))}
      </ScrollView>

      <View style={styles.cta}>
        <Button
          label={submitting ? 'Starting…' : 'Visualize'}
          onPress={handleVisualize}
          disabled={submitting}
          trailing={
            submitting ? (
              <ActivityIndicator color={colors.primaryOn} size="small" />
            ) : (
              <Wand2 size={20} color={colors.primaryOn} strokeWidth={2.2} />
            )
          }
        />
      </View>
    </Screen>
  );
}

function QualityCard({
  option,
  selected,
  onPress,
}: {
  option: OptionWithBadge;
  selected: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.98, { damping: 18, stiffness: 260 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 14, stiffness: 220 });
      }}
      style={[styles.card, shadow.card, selected && styles.cardSelected, animStyle]}
    >
      {option.recommended && (
        <View style={styles.recommendedPill}>
          <Text style={styles.recommendedText}>Recommended</Text>
        </View>
      )}
      <View style={styles.cardHeader}>
        <View style={[styles.iconRing, selected && styles.iconRingSelected]}>
          <option.Icon
            size={22}
            color={selected ? colors.primaryOn : colors.primary}
            strokeWidth={1.8}
          />
        </View>
        <View style={styles.cardHeaderText}>
          <View style={styles.titleRow}>
            <Text style={styles.cardTitle}>{option.label}</Text>
            <View style={styles.creditPill}>
              <Text style={styles.creditPillText}>
                {option.credits} {option.credits === 1 ? 'credit' : 'credits'}
              </Text>
            </View>
          </View>
          <Text style={styles.duration}>{option.duration}</Text>
        </View>
        {selected && (
          <View style={styles.selectedBadge}>
            <Check size={14} color={colors.primaryOn} strokeWidth={2.6} />
          </View>
        )}
      </View>

      <Text style={styles.description}>{option.description}</Text>
      <Text style={styles.bestFor}>{option.bestFor}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  bodyContent: { paddingVertical: spacing.sm, paddingBottom: spacing.xl, gap: spacing.md },
  card: {
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: spacing.sm,
    position: 'relative',
  },
  recommendedPill: {
    position: 'absolute',
    top: -10,
    right: spacing.md,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    zIndex: 1,
  },
  recommendedText: {
    ...type.caption,
    color: colors.primaryOn,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  cardSelected: {
    borderColor: colors.primary,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconRingSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  cardHeaderText: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitle: { ...type.heading, fontSize: 17, color: colors.text },
  creditPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  creditPillText: { ...type.caption, color: colors.text, fontWeight: '700', fontSize: 11 },
  duration: { ...type.caption, color: colors.textMuted, fontSize: 12 },
  selectedBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: { ...type.body, fontSize: 14, color: colors.text, lineHeight: 20 },
  bestFor: { ...type.caption, color: colors.textMuted, fontSize: 12, fontStyle: 'italic' },
  cta: { paddingBottom: spacing.lg },
});
