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

export default function AcnePhoto() {
  const { routinePhotos, setRoutinePhoto } = useLook();
  const uri = routinePhotos.acne;

  return (
    <Screen>
      <StepHeader
        step="Last step"
        title="Show us the area"
        subtitle="No makeup, natural light, close-up of where the breakouts are. The clearer the photo, the better the plan."
      />

      <View style={styles.body}>
        <PhotoSlot
          uri={uri}
          onPress={() =>
            presentPickerSheet((picked) => setRoutinePhoto('acne', picked), {
              title: 'Add a photo',
              cameraLabel: 'Take photo',
              libraryLabel: 'Pick from library',
            })
          }
          emptyTitle="Add a clear photo"
          emptyHint="Front-facing or close-up of the affected area. Stay close, stay natural."
        />
      </View>

      <View style={styles.cta}>
        <Button
          label="See my plan"
          onPress={() => router.push('/acne-result')}
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
