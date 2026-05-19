import { Image, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { ArrowRight } from 'lucide-react-native';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { TabHeader } from '../../components/TabHeader';
import { colors, spacing, type } from '../../lib/theme';
import { useLook } from '../../lib/state';

const logo = require('../../assets/logo.png');

export default function Landing() {
  const { resetTryOn } = useLook();
  const float = useSharedValue(0);

  useEffect(() => {
    float.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [float]);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -float.value * 10 }, { scale: 1 + float.value * 0.02 }],
  }));

  const start = () => {
    resetTryOn();
    router.push('/selfie');
  };

  return (
    <Screen edges={['top']}>
      <TabHeader />

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

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  logo: {
    width: 240,
    height: 240,
  },
  title: { ...type.display, color: colors.text, textAlign: 'center' },
  subtitle: {
    ...type.body,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 320,
    marginTop: spacing.xs,
    lineHeight: 22,
  },
  cta: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
});
