import { Image, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { RotateCcw, Sparkles } from 'lucide-react-native';
import { Screen } from '../components/Screen';
import { StepHeader } from '../components/StepHeader';
import { Button } from '../components/Button';
import { colors, radius, shadow, spacing, type, zoneLabels } from '../lib/theme';
import { useLook } from '../lib/state';

export default function ResultScreen() {
  const { selfieUri, productUri, zone, reset } = useLook();

  const startOver = () => {
    reset();
    router.dismissAll();
  };

  return (
    <Screen>
      <StepHeader
        step="Result"
        title="Your shade match"
        subtitle={`AI compositing for ${zoneLabels[zone].toLowerCase()} wires up in the next step.`}
      />

      <View style={styles.body}>
        <View style={[styles.placeholder, shadow.card]}>
          <View style={styles.placeholderIcon}>
            <Sparkles size={28} color={colors.primary} strokeWidth={1.6} />
          </View>
          <Text style={styles.placeholderTitle}>Nano Banana will render here</Text>
          <Text style={styles.placeholderBody}>
            The shell is wired up. Next we connect the model and turn your selfie plus the
            product shade into a single try-on.
          </Text>
        </View>

        <View style={styles.thumbRow}>
          <Thumb uri={selfieUri} label="Selfie" />
          <Thumb uri={productUri} label="Product" />
        </View>
      </View>

      <View style={styles.cta}>
        <Button
          label="Start over"
          onPress={startOver}
          variant="ghost"
          leading={<RotateCcw size={18} color={colors.text} strokeWidth={2} />}
        />
      </View>
    </Screen>
  );
}

function Thumb({ uri, label }: { uri: string | null; label: string }) {
  return (
    <View style={styles.thumb}>
      {uri ? (
        <Image source={{ uri }} style={styles.thumbImage} resizeMode="cover" />
      ) : (
        <View style={[styles.thumbImage, styles.thumbEmpty]} />
      )}
      <Text style={styles.thumbLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, gap: spacing.lg, paddingTop: spacing.sm },
  placeholder: {
    backgroundColor: colors.bgSoft,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  placeholderIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  placeholderTitle: { ...type.heading, color: colors.text, textAlign: 'center' },
  placeholderBody: {
    ...type.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  thumbRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  thumb: { flex: 1, gap: spacing.sm },
  thumbImage: {
    aspectRatio: 1,
    width: '100%',
    borderRadius: radius.lg,
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumbEmpty: { backgroundColor: colors.bgSoft },
  thumbLabel: {
    ...type.caption,
    color: colors.textFaint,
    textAlign: 'center',
  },
  cta: { paddingBottom: spacing.lg },
});
