import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import {
  Brush,
  Droplet,
  Eye,
  Heart,
  Palette,
  PenTool,
  Slash,
  Smile,
  Sparkles,
  Sun,
  Wind,
} from 'lucide-react-native';
import type { ComponentType } from 'react';
import { colors, radius, spacing, type, zoneLabels } from '../lib/theme';
import type { Zone } from '../lib/theme';

type IconProps = { size: number; color: string; strokeWidth: number };

const ICONS: Record<Zone, ComponentType<IconProps>> = {
  lips: Smile,
  foundation: Droplet,
  concealer: Sparkles,
  blush: Heart,
  bronzer: Sun,
  eyeliner: PenTool,
  eyeshadow: Palette,
  mascara: Brush,
  eyebrows: Slash,
  hair: Wind,
};

// Re-export so other places (e.g. result icons) can reuse if needed.
export function getZoneIcon(zone: Zone): ComponentType<IconProps> {
  return ICONS[zone] ?? Eye;
}

type Props = {
  zone: Zone;
  selected: boolean;
  onPress: () => void;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function ZoneChip({ zone, selected, onPress }: Props) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const Icon = ICONS[zone];

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.96, { damping: 18, stiffness: 260 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 14, stiffness: 220 });
      }}
      style={[styles.chip, selected && styles.chipSelected, animStyle]}
    >
      <View style={[styles.iconWrap, selected && styles.iconWrapSelected]}>
        <Icon
          size={20}
          color={selected ? colors.primaryOn : colors.primary}
          strokeWidth={1.8}
        />
      </View>
      <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
        {zoneLabels[zone]}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.bgSoft,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  chipSelected: {
    backgroundColor: colors.bgSoft,
    borderColor: colors.primary,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconWrapSelected: {
    backgroundColor: colors.primary,
  },
  label: { ...type.caption, color: colors.textMuted, fontSize: 13 },
  labelSelected: { color: colors.text, fontWeight: '600' },
});
