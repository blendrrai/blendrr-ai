import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { Screen } from '../components/Screen';
import { StepHeader } from '../components/StepHeader';
import { PhotoSlot } from '../components/PhotoSlot';
import { Button } from '../components/Button';
import { colors, spacing } from '../lib/theme';
import { useLook } from '../lib/state';
import { presentPickerSheet } from '../lib/pickImage';

export default function SelfieStep() {
  const { selfieUri, setSelfie, category, setMode } = useLook();
  const isClothing = category === 'clothing';

  // Clothing flow is always single-product (one item at a time), so we
  // skip the /mode step entirely and jump straight to /product. Beauty
  // flow still routes via /mode for single-vs-multi selection.
  const onContinue = () => {
    if (isClothing) {
      setMode('single');
      router.push('/product');
    } else {
      router.push('/mode');
    }
  };

  // The selfie advice also differs — clothing needs a body shot, beauty
  // needs a front-facing face shot.
  const subtitle = isClothing
    ? 'Use a clear body photo showing whatever the item covers — legs for bottoms, arms for short sleeves, etc.'
    : "Front-facing, soft light, hair pulled back if you're trying lips or face shades.";
  const emptyHint = isClothing
    ? 'A full-body or half-body shot works best. Plain backgrounds keep the AI focused.'
    : 'Take one now or pick a recent shot. Plain backgrounds work best.';

  return (
    <Screen>
      <StepHeader
        step={isClothing ? 'Step 2 of 4' : 'Step 1 of 4'}
        title={isClothing ? 'Drop a body photo' : 'Drop a selfie'}
        subtitle={subtitle}
        showHomeButton
      />

      <View style={styles.body}>
        <PhotoSlot
          uri={selfieUri}
          onPress={() =>
            presentPickerSheet(setSelfie, {
              title: isClothing ? 'Add a body photo' : 'Add a selfie',
              cameraLabel: isClothing ? 'Take photo' : 'Take selfie',
              libraryLabel: 'Pick from library',
              // Selfies want the front camera by default; body photos for
              // clothing try-on are usually taken by someone else with the
              // back camera or use a mirror, so leave that as back.
              preferredCamera: isClothing ? 'back' : 'front',
            })
          }
          emptyTitle={isClothing ? 'Add your body photo' : 'Add your selfie'}
          emptyHint={emptyHint}
        />
      </View>

      <View style={styles.cta}>
        <Button
          label="Continue"
          onPress={onContinue}
          disabled={!selfieUri}
          trailing={<ArrowRight size={20} color={colors.primaryOn} strokeWidth={2.4} />}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingVertical: spacing.md },
  cta: { paddingBottom: spacing.lg },
});
