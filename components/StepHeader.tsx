import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { router } from 'expo-router';
import { colors, spacing, type } from '../lib/theme';

type Props = {
  step?: string;
  title: string;
  subtitle?: string;
  showBack?: boolean;
  /** Override the default back behaviour (router.back). Useful on result pages where back should go home. */
  onBack?: () => void;
};

export function StepHeader({ step, title, subtitle, showBack = true, onBack }: Props) {
  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (router.canGoBack()) router.back();
  };
  const canShow = showBack && (onBack ? true : router.canGoBack());

  return (
    <View style={styles.wrap}>
      {canShow && (
        <Pressable onPress={handleBack} hitSlop={12} style={styles.back}>
          <ChevronLeft size={22} color={colors.text} strokeWidth={2} />
        </Pressable>
      )}
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
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spacing.sm,
    marginBottom: spacing.sm,
  },
  eyebrow: { ...type.eyebrow, color: colors.textFaint, marginBottom: spacing.xs },
  title: { ...type.title, color: colors.text },
  subtitle: { ...type.body, color: colors.textMuted, marginTop: spacing.xs },
});
