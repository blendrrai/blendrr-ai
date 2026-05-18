import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Wand2 } from 'lucide-react-native';
import { Screen } from '../components/Screen';
import { StepHeader } from '../components/StepHeader';
import { Button } from '../components/Button';
import { ZoneChip } from '../components/ZoneChip';
import { colors, spacing } from '../lib/theme';
import { useLook } from '../lib/state';
import type { Zone } from '../lib/theme';

const ZONES: Zone[] = ['lips', 'face', 'hair'];

export default function ZoneStep() {
  const { zone, setZone } = useLook();

  return (
    <Screen>
      <StepHeader
        step="Step 3 of 3"
        title="Where should it go?"
        subtitle="Pick the area where Blendrr should apply the shade."
      />

      <View style={styles.body}>
        <View style={styles.row}>
          {ZONES.map((z) => (
            <ZoneChip
              key={z}
              zone={z}
              selected={zone === z}
              onPress={() => setZone(z)}
            />
          ))}
        </View>
      </View>

      <View style={styles.cta}>
        <Button
          label="Visualize"
          onPress={() => router.push('/result')}
          trailing={<Wand2 size={20} color={colors.primaryOn} strokeWidth={2.2} />}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingVertical: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  cta: { paddingBottom: spacing.lg },
});
