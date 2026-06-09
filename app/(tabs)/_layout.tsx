import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Redirect, withLayoutContext } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Droplet, Flower2, ScanLine, Shirt, Wand2, Wind } from 'lucide-react-native';
import ReAnimated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import {
  createMaterialTopTabNavigator,
  type MaterialTopTabBarProps,
  type MaterialTopTabNavigationOptions,
  type MaterialTopTabNavigationEventMap,
} from '@react-navigation/material-top-tabs';
import type { ParamListBase, TabNavigationState } from '@react-navigation/native';
import type { ComponentType } from 'react';
import { colors, radius, shadow, spacing } from '../../lib/theme';
import { loadOnboardingSeen } from '../../lib/storage';

const { Navigator } = createMaterialTopTabNavigator();

const MaterialTopTabs = withLayoutContext<
  MaterialTopTabNavigationOptions,
  typeof Navigator,
  TabNavigationState<ParamListBase>,
  MaterialTopTabNavigationEventMap
>(Navigator);

type IconProps = { size: number; color: string; strokeWidth: number };

const TAB_ICONS: Record<string, ComponentType<IconProps>> = {
  index: Wand2,
  clothing: Shirt,
  skincare: Droplet,
  haircare: Wind,
  fragrance: Flower2,
  ingredients: ScanLine,
};

const TAB_LABELS: Record<string, string> = {
  index: 'Try-on',
  clothing: 'Fit',
  skincare: 'Skin',
  haircare: 'Hair',
  fragrance: 'Scent',
  ingredients: 'Scan',
};

export default function TabsLayout() {
  const [ready, setReady] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    loadOnboardingSeen().then((seen) => {
      setNeedsOnboarding(!seen);
      setReady(true);
    });
  }, []);

  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  if (needsOnboarding) return <Redirect href="/onboarding" />;

  return (
    <MaterialTopTabs
      tabBarPosition="bottom"
      screenOptions={{
        swipeEnabled: true,
        animationEnabled: true,
        tabBarStyle: { backgroundColor: 'transparent' },
        lazy: false,
      }}
      tabBar={(props) => <FloatingTabBar {...props} />}
    >
      <MaterialTopTabs.Screen name="index" />
      <MaterialTopTabs.Screen name="clothing" />
      <MaterialTopTabs.Screen name="ingredients" />
      <MaterialTopTabs.Screen name="skincare" />
      <MaterialTopTabs.Screen name="haircare" />
      <MaterialTopTabs.Screen name="fragrance" />
    </MaterialTopTabs>
  );
}

function getInputOutput(index: number, total: number, peak: number, trough: number) {
  if (total <= 1) return { inputRange: [0, 1], outputRange: [peak, peak] };
  if (index === 0) return { inputRange: [0, 1], outputRange: [peak, trough] };
  if (index === total - 1) return { inputRange: [total - 2, total - 1], outputRange: [trough, peak] };
  return {
    inputRange: [index - 1, index, index + 1],
    outputRange: [trough, peak, trough],
  };
}

function FloatingTabBar({ state, descriptors, navigation, position }: MaterialTopTabBarProps) {
  const insets = useSafeAreaInsets();
  const total = state.routes.length;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.container, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}
    >
      <View style={styles.dotRow}>
        {state.routes.map((route, i) => (
          <Dot key={route.key} index={i} total={total} position={position} />
        ))}
      </View>

      <View style={[styles.bar, shadow.button]}>
        {state.routes.map((route, index) => {
          const Icon = TAB_ICONS[route.name] ?? Wand2;
          const label = TAB_LABELS[route.name] ?? route.name;
          const { options } = descriptors[route.key];
          const focused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TabButton
              key={route.key}
              index={index}
              total={total}
              position={position}
              Icon={Icon}
              onPress={onPress}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
            />
          );
        })}
      </View>
    </View>
  );
}

function Dot({
  index,
  total,
  position,
}: {
  index: number;
  total: number;
  position: MaterialTopTabBarProps['position'];
}) {
  const opacityRange = getInputOutput(index, total, 1, 0);

  const activeOpacity = position.interpolate({
    inputRange: opacityRange.inputRange,
    outputRange: opacityRange.outputRange,
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.dotBase}>
      <View style={styles.dotInactive} />
      <Animated.View style={[StyleSheet.absoluteFill, styles.dotActive, { opacity: activeOpacity }]} />
    </View>
  );
}

function TabButton({
  index,
  total,
  position,
  Icon,
  onPress,
  accessibilityLabel,
}: {
  index: number;
  total: number;
  position: MaterialTopTabBarProps['position'];
  Icon: ComponentType<IconProps>;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const AnimatedPressable = ReAnimated.createAnimatedComponent(Pressable);

  const opacityRange = getInputOutput(index, total, 1, 0);
  const activeOpacity = position.interpolate({
    inputRange: opacityRange.inputRange,
    outputRange: opacityRange.outputRange,
    extrapolate: 'clamp',
  });

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.94, { damping: 18, stiffness: 280 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 14, stiffness: 220 });
      }}
      style={[styles.tab, pressStyle]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.tabActiveBg, { opacity: activeOpacity }]} />
      <View style={styles.iconStack}>
        <Icon size={22} color={colors.text} strokeWidth={1.8} />
        <Animated.View style={[StyleSheet.absoluteFill, styles.iconCenter, { opacity: activeOpacity }]}>
          <Icon size={22} color={colors.primaryOn} strokeWidth={2.2} />
        </Animated.View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  dotRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    height: 8,
  },
  dotBase: {
    width: 22,
    height: 6,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  dotInactive: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  dotActive: {
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.bgSoft,
    borderRadius: radius.pill,
    padding: 6,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tabActiveBg: {
    backgroundColor: colors.primary,
    borderRadius: 26,
  },
  iconStack: { width: 22, height: 22 },
  iconCenter: { alignItems: 'center', justifyContent: 'center' },
});
