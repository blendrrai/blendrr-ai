import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowRight, Check, Layers, Sparkle } from 'lucide-react-native';
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
import type { Mode } from '../lib/theme';
import { useLook } from '../lib/state';

type IconProps = { size: number; color: string; strokeWidth: number };

type Option = {
  value: Mode;
  label: string;
  credits: number;
  Icon: ComponentType<IconProps>;
  description: string;
  bestFor: string;
};

const OPTIONS: Option[] = [
  {
    value: 'single',
    label: 'Single product',
    credits: 1,
    Icon: Sparkle,
    description: 'Try one product at a time on a specific area — lipstick on lips, foundation on skin, eyeshadow on lids.',
    bestFor: 'Best for: testing a specific shade you found online.',
  },
  {
    value: 'multi',
    label: 'Full face',
    credits: 2,
    Icon: Layers,
    description: 'Layer up to 5 products in one go for a complete makeup look — foundation, lipstick, blush, the works.',
    bestFor: 'Best for: planning a full glam look before going out.',
  },
];

export default function ModeStep() {
  const { mode, setMode } = useLook();

  return (
    <Screen>
      <StepHeader
        step="Step 2 of 5"
        title="How much are you trying on?"
        subtitle="One product, or a whole look?"
      />

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {OPTIONS.map((opt) => (
          <ModeCard
            key={opt.value}
            option={opt}
            selected={mode === opt.value}
            onPress={() => setMode(opt.value)}
          />
        ))}
      </ScrollView>

      <View style={styles.cta}>
        <Button
          label="Continue"
          onPress={() => {
            // Single product → pick a specific zone next.
            // Multi (full face) → skip zone screen; the AI figures out where each
            // product goes based on the product image (lipstick → lips, etc.).
            router.push(mode === 'single' ? '/zone' : '/product');
          }}
          trailing={<ArrowRight size={20} color={colors.primaryOn} strokeWidth={2.2} />}
        />
      </View>
    </Screen>
  );
}

function ModeCard({
  option,
  selected,
  onPress,
}: {
  option: Option;
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
  },
  cardSelected: { borderColor: colors.primary },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
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
  iconRingSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
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
