import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Wand2 } from 'lucide-react-native';
import { Screen } from '../components/Screen';
import { StepHeader } from '../components/StepHeader';
import { PhotoSlot } from '../components/PhotoSlot';
import { Button } from '../components/Button';
import { colors, spacing } from '../lib/theme';
import { useLook } from '../lib/state';
import { presentPickerSheet } from '../lib/pickImage';

export default function SkincarePhoto() {
  const { routinePhotos, setRoutinePhoto } = useLook();
  const uri = routinePhotos.skincare;

  return (
    <Screen>
      <StepHeader
        step="Last step"
        title="Send a fresh selfie"
        subtitle="No makeup, natural light, front-facing. We're reading your skin, not your filters."
      />

      <View style={styles.body}>
        <PhotoSlot
          uri={uri}
          onPress={() =>
            presentPickerSheet((picked) => setRoutinePhoto('skincare', picked), {
              title: 'Add a skin selfie',
              cameraLabel: 'Take selfie',
              libraryLabel: 'Pick from library',
              preferredCamera: 'front',
            })
          }
          emptyTitle="Add a skin selfie"
          emptyHint="A clean, well-lit close-up gives the most accurate read."
        />
      </View>

      <View style={styles.cta}>
        <Button
          label="See my routine"
          onPress={() => router.push('/skincare-result')}
          disabled={!uri}
          trailing={<Wand2 size={20} color={colors.primaryOn} strokeWidth={2.2} />}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingVertical: spacing.md },
  cta: { paddingBottom: spacing.lg },
});
