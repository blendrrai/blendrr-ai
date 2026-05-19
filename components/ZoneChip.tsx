import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Smile, Sparkles, Wind } from 'lucide-react-native';
import { colors, radius, spacing, type } from '../lib/theme';
import type { Zone } from '../lib/theme';

const ICONS = {
  face: Sparkles,
  lips: Smile,
  hair: Wind,
} as const;

const LABELS: Record<Zone, string> = {
  face: 'Face',
  lips: 'Lips',
  hair: 'Hair',
};

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
          size={22}
          color={selected ? colors.primaryOn : colors.primary}
          strokeWidth={1.8}
        />
      </View>
      <Text style={[styles.label, selected && styles.labelSelected]}>
        {LABELS[zone]}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
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
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconWrapSelected: {
    backgroundColor: colors.primary,
  },
  label: { ...type.caption, color: colors.textMuted, fontSize: 14 },
  labelSelected: { color: colors.text, fontWeight: '600' },
});
