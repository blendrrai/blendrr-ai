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
  const { selfieUri, setSelfie } = useLook();

  return (
    <Screen>
      <StepHeader
        step="Step 1 of 5"
        title="Drop a selfie"
        subtitle="Front-facing, soft light, hair pulled back if you're trying lips or face shades."
      />

      <View style={styles.body}>
        <PhotoSlot
          uri={selfieUri}
          onPress={() =>
            presentPickerSheet(setSelfie, {
              title: 'Add a selfie',
              cameraLabel: 'Take selfie',
              libraryLabel: 'Pick from library',
            })
          }
          emptyTitle="Add your selfie"
          emptyHint="Take one now or pick a recent shot. Plain backgrounds work best."
        />
      </View>

      <View style={styles.cta}>
        <Button
          label="Continue"
          onPress={() => router.push('/mode')}
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
