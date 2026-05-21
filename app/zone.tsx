import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { Screen } from '../components/Screen';
import { StepHeader } from '../components/StepHeader';
import { Button } from '../components/Button';
import { ZoneChip } from '../components/ZoneChip';
import { colors, spacing, type, ZONES_BY_CATEGORY } from '../lib/theme';
import { useLook } from '../lib/state';
import type { Zone, ZoneCategory } from '../lib/theme';

const CATEGORY_LABELS: Record<ZoneCategory, string> = {
  lips: 'Lips',
  face: 'Face',
  eyes: 'Eyes',
  hair: 'Hair',
};

const CATEGORY_ORDER: ZoneCategory[] = ['lips', 'face', 'eyes', 'hair'];

export default function ZoneStep() {
  const { zone, setZone } = useLook();

  return (
    <Screen>
      <StepHeader
        step="Step 3 of 5"
        title="What are you trying on?"
        subtitle="Pick the product type so we can apply it to the right spot."
        showHomeButton
      />

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {CATEGORY_ORDER.map((cat) => (
          <CategorySection
            key={cat}
            label={CATEGORY_LABELS[cat]}
            zones={ZONES_BY_CATEGORY[cat]}
            selected={zone}
            onSelect={setZone}
          />
        ))}
      </ScrollView>

      <View style={styles.cta}>
        <Button
          label="Continue"
          onPress={() => router.push('/product')}
          trailing={<ArrowRight size={20} color={colors.primaryOn} strokeWidth={2.2} />}
        />
      </View>
    </Screen>
  );
}

function CategorySection({
  label,
  zones,
  selected,
  onSelect,
}: {
  label: string;
  zones: Zone[];
  selected: Zone;
  onSelect: (zone: Zone) => void;
}) {
  // Lay out in rows of 2 so face (4 items) and eyes (4 items) form 2x2 grids,
  // while lips (1) and hair (1) sit alone on a row.
  const rows: Zone[][] = [];
  for (let i = 0; i < zones.length; i += 2) {
    rows.push(zones.slice(i, i + 2));
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.sectionRows}>
        {rows.map((row, i) => (
          <View key={i} style={styles.row}>
            {row.map((z) => (
              <ZoneChip
                key={z}
                zone={z}
                selected={selected === z}
                onPress={() => onSelect(z)}
              />
            ))}
            {row.length === 1 && <View style={styles.spacer} />}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  bodyContent: { paddingVertical: spacing.sm, paddingBottom: spacing.xl, gap: spacing.lg },
  section: { gap: spacing.sm },
  sectionLabel: { ...type.eyebrow, color: colors.textMuted },
  sectionRows: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  // Empty placeholder so single-item rows (lips, hair) still align to half-width
  // and don't stretch to full width.
  spacer: { flex: 1 },
  cta: { paddingBottom: spacing.lg },
});
