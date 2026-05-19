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

export default function HaircarePhoto() {
  const { routinePhotos, setRoutinePhoto } = useLook();
  const uri = routinePhotos.haircare;

  return (
    <Screen>
      <StepHeader
        step="Last step"
        title="Show us your hair"
        subtitle="Dry, unstyled if possible — we want to see the real texture and condition."
      />

      <View style={styles.body}>
        <PhotoSlot
          uri={uri}
          onPress={() =>
            presentPickerSheet((picked) => setRoutinePhoto('haircare', picked), {
              title: 'Add a hair photo',
              cameraLabel: 'Take photo',
              libraryLabel: 'Pick from library',
            })
          }
          emptyTitle="Add a hair photo"
          emptyHint="Front or side angle. Natural light works best."
        />
      </View>

      <View style={styles.cta}>
        <Button
          label="See my routine"
          onPress={() => router.push('/haircare-result')}
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
