import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft, Home } from 'lucide-react-native';
import { router } from 'expo-router';
import { colors, spacing, type } from '../lib/theme';

type Props = {
  step?: string;
  title: string;
  subtitle?: string;
  showBack?: boolean;
  /** Override the default back behaviour (router.back). Useful on result pages where back should go home. */
  onBack?: () => void;
  /**
   * If true, shows a Home button on the top-right that confirms and bails to
   * the root tab nav, discarding any try-on progress. Use on every try-on
   * step (selfie, mode, zone, product, quality).
   */
  showHomeButton?: boolean;
};

export function StepHeader({ step, title, subtitle, showBack = true, onBack, showHomeButton }: Props) {
  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (router.canGoBack()) router.back();
  };
  const canShow = showBack && (onBack ? true : router.canGoBack());

  const handleHome = () => {
    Alert.alert(
      'Leave try-on?',
      "Your selfie, products, and selections so far won't be saved.",
      [
        { text: 'Stay here', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => router.dismissAll(),
        },
      ],
    );
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        {canShow ? (
          <Pressable onPress={handleBack} hitSlop={12} style={styles.back}>
            <ChevronLeft size={22} color={colors.text} strokeWidth={2} />
          </Pressable>
        ) : (
          <View style={styles.back} />
        )}

        {showHomeButton && (
          <Pressable onPress={handleHome} hitSlop={12} style={styles.home}>
            <Home size={18} color={colors.text} strokeWidth={2} />
          </Pressable>
        )}
      </View>

      {step && <Text style={styles.eyebrow}>{step}</Text>}
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.xs,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spacing.sm,
  },
  home: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: -spacing.sm,
  },
  eyebrow: { ...type.eyebrow, color: colors.textFaint, marginBottom: spacing.xs },
  title: { ...type.title, color: colors.text },
  subtitle: { ...type.body, color: colors.textMuted, marginTop: spacing.xs },
});
