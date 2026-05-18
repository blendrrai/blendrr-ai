import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { Screen } from '../components/Screen';
import { StepHeader } from '../components/StepHeader';
import { PhotoSlot } from '../components/PhotoSlot';
import { Button } from '../components/Button';
import { Divider, UrlInput } from '../components/UrlInput';
import { colors, spacing } from '../lib/theme';
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
        subtitle="Drop a link or upload a screenshot from any cosmetics site."
      />

      <View style={styles.body}>
        <UrlInput loading={loadingUrl} onSubmit={handleUrl} />
        <Divider label="Or" />
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
            emptyHint="A clear shot of the lipstick, shadow, or hair colour."
          />
        </View>
      </View>

      <View style={styles.cta}>
        <Button
          label="Continue"
          onPress={() => router.push('/zone')}
          disabled={!productUri}
          trailing={<ArrowRight size={20} color={colors.primaryOn} strokeWidth={2.4} />}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingVertical: spacing.md, gap: spacing.sm },
  slotWrap: { flex: 1 },
  cta: { paddingBottom: spacing.lg },
});
