import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { ImagePlus, RefreshCw } from 'lucide-react-native';
import { colors, radius, shadow, spacing, type } from '../lib/theme';

type Props = {
  uri: string | null;
  onPress: () => void;
  emptyTitle: string;
  emptyHint: string;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PhotoSlot({ uri, onPress, emptyTitle, emptyHint }: Props) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.98, { damping: 18, stiffness: 260 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 14, stiffness: 220 });
      }}
      style={[styles.slot, shadow.card, animStyle]}
    >
      {uri ? (
        <>
          <Image source={{ uri }} style={styles.image} resizeMode="cover" />
          <View style={styles.overlayBadge}>
            <RefreshCw size={14} color={colors.primaryOn} />
            <Text style={styles.overlayBadgeText}>Replace</Text>
          </View>
        </>
      ) : (
        <View style={styles.empty}>
          <View style={styles.iconRing}>
            <ImagePlus size={28} color={colors.primary} strokeWidth={1.8} />
          </View>
          <Text style={styles.emptyTitle}>{emptyTitle}</Text>
          <Text style={styles.emptyHint}>{emptyHint}</Text>
        </View>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  slot: {
    flex: 1,
    width: '100%',
    backgroundColor: colors.bgSoft,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  image: { width: '100%', height: '100%' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  iconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: { ...type.heading, color: colors.text, textAlign: 'center' },
  emptyHint: { ...type.body, color: colors.textMuted, textAlign: 'center' },
  overlayBadge: {
    position: 'absolute',
    bottom: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,79,139,0.92)',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  overlayBadgeText: {
    ...type.caption,
    color: colors.primaryOn,
  },
});
