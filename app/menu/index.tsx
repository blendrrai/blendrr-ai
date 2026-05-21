import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  ChevronRight,
  Coins,
  Droplet,
  Flower2,
  Heart,
  ScanLine,
  Settings as SettingsIcon,
  Wind,
} from 'lucide-react-native';
import type { ComponentType } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Screen } from '../../components/Screen';
import { StepHeader } from '../../components/StepHeader';
import { colors, radius, shadow, spacing, type } from '../../lib/theme';

type Item = {
  label: string;
  helper: string;
  Icon: ComponentType<{ size: number; color: string; strokeWidth: number }>;
  route: string;
};

const ITEMS: Item[] = [
  {
    label: 'Wishlist',
    helper: 'Save links, prices, and notes for later',
    Icon: Heart,
    route: '/menu/wishlist',
  },
  {
    label: 'Check ingredient health score',
    helper: 'Snap or paste any INCI list — get a 0–100 score',
    Icon: ScanLine,
    route: '/ingredient-scan',
  },
  {
    label: 'My skincare routine',
    helper: 'Quiz snapshot + shopping list',
    Icon: Droplet,
    route: '/menu/skincare-routine',
  },
  {
    label: 'My haircare routine',
    helper: 'Quiz snapshot + shopping list',
    Icon: Wind,
    route: '/menu/haircare-routine',
  },
  {
    label: 'My scent picks',
    helper: 'Fragrance profile + shopping list',
    Icon: Flower2,
    route: '/menu/fragrance-routine',
  },
  {
    label: 'Credits',
    helper: 'Subscription, balance, packs',
    Icon: Coins,
    route: '/menu/credits',
  },
  {
    label: 'Settings',
    helper: 'Currency, notifications, feedback',
    Icon: SettingsIcon,
    route: '/menu/settings',
  },
];

export default function MenuIndex() {
  return (
    <Screen>
      <StepHeader title="Menu" subtitle="Everything BLENDRR is keeping for you." />

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {ITEMS.map((item) => (
          <Row key={item.label} item={item} />
        ))}
      </ScrollView>
    </Screen>
  );
}

function Row({ item }: { item: Item }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

  return (
    <AnimatedPressable
      onPress={() => router.push(item.route as never)}
      onPressIn={() => {
        scale.value = withSpring(0.98, { damping: 18, stiffness: 260 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 14, stiffness: 220 });
      }}
      style={[styles.row, shadow.card, animStyle]}
    >
      <View style={styles.iconRing}>
        <item.Icon size={22} color={colors.text} strokeWidth={1.8} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{item.label}</Text>
        <Text style={styles.rowHelper}>{item.helper}</Text>
      </View>
      <ChevronRight size={20} color={colors.textFaint} strokeWidth={2} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: spacing.xxl, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
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
  rowText: { flex: 1, gap: 2 },
  rowTitle: { ...type.heading, fontSize: 16, color: colors.text },
  rowHelper: { ...type.caption, color: colors.textMuted },
});
