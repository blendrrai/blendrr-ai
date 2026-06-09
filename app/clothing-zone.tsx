import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowRight, Check, Footprints, Gem, Shirt, ShoppingBag } from 'lucide-react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import type { ComponentType } from 'react';
import { Screen } from '../components/Screen';
import { StepHeader } from '../components/StepHeader';
import { Button } from '../components/Button';
import {
  ClothingTutorialModal,
  hasSeenClothingTutorial,
} from '../components/ClothingTutorialModal';
import { colors, radius, shadow, spacing, type } from '../lib/theme';
import type { ClothingZone } from '../lib/theme';
import { useLook } from '../lib/state';

type IconProps = { size: number; color: string; strokeWidth: number };

type Option = {
  value: ClothingZone;
  label: string;
  Icon: ComponentType<IconProps>;
  hint: string;
};

const OPTIONS: Option[] = [
  { value: 'top',       label: 'Top half',    Icon: Shirt,       hint: 'Shirts, tops, jackets, hoodies, blouses.' },
  { value: 'bottom',    label: 'Bottom half', Icon: Shirt,       hint: 'Trousers, jeans, shorts, skirts.' },
  { value: 'dress',     label: 'Full outfit', Icon: Shirt,       hint: 'Dresses, jumpsuits, full-body co-ords.' },
  { value: 'shoes',     label: 'Shoes',       Icon: Footprints,  hint: 'Trainers, heels, boots, sandals.' },
  { value: 'jewelry',   label: 'Jewelry',     Icon: Gem,         hint: 'Necklaces, earrings, bracelets, rings.' },
  { value: 'accessory', label: 'Accessory',   Icon: ShoppingBag, hint: 'Bags, hats, scarves, sunglasses.' },
];

export default function ClothingZoneStep() {
  const { clothingZone, setClothingZone } = useLook();
  const [tutorialOpen, setTutorialOpen] = useState(false);

  // First-visit tutorial check. Runs once on mount.
  useEffect(() => {
    hasSeenClothingTutorial().then((seen) => {
      if (!seen) setTutorialOpen(true);
    });
  }, []);

  return (
    <Screen>
      <StepHeader
        step="Step 1 of 4"
        title="What are you trying on?"
        subtitle="Pick the item type so the AI knows which part of the body to edit."
        showHomeButton
      />

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {OPTIONS.map((opt) => (
          <ZoneCard
            key={opt.value}
            option={opt}
            selected={clothingZone === opt.value}
            onPress={() => setClothingZone(opt.value)}
          />
        ))}
      </ScrollView>

      <View style={styles.cta}>
        <Button
          label="Continue"
          onPress={() => router.push('/selfie')}
          trailing={<ArrowRight size={20} color={colors.primaryOn} strokeWidth={2.4} />}
        />
      </View>

      <ClothingTutorialModal
        visible={tutorialOpen}
        onDismiss={() => setTutorialOpen(false)}
      />
    </Screen>
  );
}

function ZoneCard({
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
      <View style={[styles.iconRing, selected && styles.iconRingSelected]}>
        <option.Icon
          size={20}
          color={selected ? colors.primaryOn : colors.primary}
          strokeWidth={1.8}
        />
      </View>
      <View style={styles.cardText}>
        <Text style={styles.cardTitle}>{option.label}</Text>
        <Text style={styles.cardHint}>{option.hint}</Text>
      </View>
      {selected && (
        <View style={styles.selectedBadge}>
          <Check size={14} color={colors.primaryOn} strokeWidth={2.6} />
        </View>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  bodyContent: { paddingVertical: spacing.sm, paddingBottom: spacing.xl, gap: spacing.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  cardSelected: { borderColor: colors.primary },
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
  cardText: { flex: 1, gap: 2 },
  cardTitle: { ...type.heading, fontSize: 16, color: colors.text },
  cardHint: { ...type.caption, color: colors.textMuted, lineHeight: 17, fontSize: 12 },
  selectedBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cta: { paddingBottom: spacing.lg },
});
