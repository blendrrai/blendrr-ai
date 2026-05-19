import { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { Screen } from '../components/Screen';
import { StepHeader } from '../components/StepHeader';
import { PhotoSlot } from '../components/PhotoSlot';
import { Button } from '../components/Button';
import { Divider, UrlInput } from '../components/UrlInput';
import { colors, radius, spacing, type } from '../lib/theme';
import { useLook } from '../lib/state';
import { presentPickerSheet } from '../lib/pickImage';
import { fetchProductImage } from '../lib/fetchProductImage';

export default function ProductStep() {
  const { productUri, setProduct } = useLook();
  const [loadingUrl, setLoadingUrl] = useState(false);

  const handleUrl = async (url: string) => {
    setLoadingUrl(true);
    try {
      const uri = await fetchProductImage(url);
      if (!uri) {
        Alert.alert(
          "Couldn't find a product image",
          'Some sites hide their photos behind login walls. Try uploading a screenshot instead.',
        );
        return;
      }
      setProduct(uri, url);
    } finally {
      setLoadingUrl(false);
    }
  };

  return (
    <Screen>
      <StepHeader
        step="Step 2 of 3"
        title="Pick a product"
        subtitle="Upload a screenshot for best results, or paste a product link."
      />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.body}>
          <OptionHeader number={1} label="Upload a screenshot" recommended />
          <View style={styles.slotWrap}>
            <PhotoSlot
              uri={productUri}
              onPress={() =>
                presentPickerSheet((uri) => setProduct(uri, null), {
                  title: 'Add product image',
                  cameraLabel: 'Snap product',
                  libraryLabel: 'Pick screenshot',
                })
              }
              emptyTitle="Upload a screenshot"
              emptyHint="A clear shot of the lipstick, shadow, or hair colour. Swatches work best."
            />
          </View>

          <Divider label="Or" />

          <OptionHeader number={2} label="Paste a product link" />
          <UrlInput loading={loadingUrl} onSubmit={handleUrl} />
        </View>

        <View style={styles.cta}>
          <Button
            label="Continue"
            onPress={() => router.push('/zone')}
            disabled={!productUri}
            trailing={<ArrowRight size={20} color={colors.primaryOn} strokeWidth={2.4} />}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

function OptionHeader({
  number,
  label,
  recommended,
}: {
  number: number;
  label: string;
  recommended?: boolean;
}) {
  return (
    <View style={styles.optionHeader}>
      <View style={styles.numberCircle}>
        <Text style={styles.numberText}>{number}</Text>
      </View>
      <Text style={styles.optionLabel}>{label}</Text>
      {recommended && (
        <View style={styles.pill}>
          <Text style={styles.pillText}>Recommended</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xxl },
  body: { paddingVertical: spacing.md, gap: spacing.sm },
  slotWrap: { height: 320 },
  cta: { marginTop: spacing.md, paddingBottom: spacing.lg },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  numberCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: {
    ...type.caption,
    color: colors.primaryOn,
    fontWeight: '700',
    fontSize: 12,
  },
  optionLabel: { ...type.heading, fontSize: 15, color: colors.text, flex: 1 },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  pillText: {
    ...type.caption,
    color: colors.primaryOn,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});
