import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Plus, Wand2, X } from 'lucide-react-native';
import { Screen } from '../components/Screen';
import { StepHeader } from '../components/StepHeader';
import { PhotoSlot } from '../components/PhotoSlot';
import { Button } from '../components/Button';
import { colors, MAX_PRODUCTS_MULTI, radius, shadow, spacing, type } from '../lib/theme';
import { useLook } from '../lib/state';
import { presentPickerSheet } from '../lib/pickImage';
import { startTryOn } from '../lib/blendrr';
import { canUseCredit } from '../lib/storage';
import { scheduleTryOnReadyNotification } from '../lib/notifications';

export default function ProductStep() {
  const { selfieUri, mode, zone, quality, productUris, addProduct, removeProduct, replaceProduct } = useLook();
  const [submitting, setSubmitting] = useState(false);

  const isSingle = mode === 'single';
  const canAddMore = isSingle ? productUris.length === 0 : productUris.length < MAX_PRODUCTS_MULTI;

  const pickProductFromCameraOrLibrary = () => {
    presentPickerSheet((uri) => addProduct(uri, null), {
      title: isSingle ? 'Add product image' : `Add product ${productUris.length + 1} of ${MAX_PRODUCTS_MULTI}`,
      cameraLabel: 'Snap product',
      libraryLabel: 'Pick screenshot',
    });
  };

  const replaceFromPicker = (index: number) => {
    presentPickerSheet((uri) => replaceProduct(index, uri, null), {
      title: 'Replace product image',
      cameraLabel: 'Snap product',
      libraryLabel: 'Pick screenshot',
    });
  };

  const continueDisabled = productUris.length === 0 || submitting;

  const handleVisualize = async () => {
    if (!selfieUri || productUris.length === 0) {
      Alert.alert('Missing inputs', 'Please add a selfie and at least one product.');
      return;
    }
    setSubmitting(true);
    const credit = await canUseCredit();
    if (!credit.ok) {
      setSubmitting(false);
      Alert.alert('Out of credits', credit.reason);
      return;
    }
    try {
      await startTryOn({ selfieUri, productUris, zone, mode, quality });
      // Schedule a local notification timed for when the try-on should
      // finish. Fire-and-forget — if permission isn't granted, it no-ops.
      void scheduleTryOnReadyNotification(mode, quality);
      router.push('/result');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not start try-on.';
      Alert.alert("Couldn't start try-on", message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <StepHeader
        step="Step 4 of 4"
        title={isSingle ? 'Add a product' : 'Add your products'}
        subtitle={
          isSingle
            ? 'Upload a screenshot or photo of the product you want to try on.'
            : `Up to ${MAX_PRODUCTS_MULTI} products. The AI figures out where each one goes.`
        }
        showHomeButton
      />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {isSingle ? (
          <View style={styles.body}>
            <View style={styles.slotWrap}>
              <PhotoSlot
                uri={productUris[0] ?? null}
                onPress={pickProductFromCameraOrLibrary}
                emptyTitle="Upload a screenshot"
                emptyHint="A clear shot of the lipstick, shadow, or hair colour. Brand swatches and product photos with the shade clearly visible work best."
              />
            </View>
          </View>
        ) : (
          <View style={styles.body}>
            <Text style={styles.helperText}>
              {productUris.length}/{MAX_PRODUCTS_MULTI} products added
            </Text>

            <View style={styles.grid}>
              {productUris.map((uri, i) => (
                <ProductThumb
                  key={`${uri}-${i}`}
                  uri={uri}
                  onReplace={() => replaceFromPicker(i)}
                  onRemove={() => removeProduct(i)}
                />
              ))}

              {canAddMore && (
                <AddProductCard onPress={pickProductFromCameraOrLibrary} />
              )}
            </View>
          </View>
        )}

        <View style={styles.cta}>
          <Button
            label={submitting ? 'Starting…' : 'Visualize'}
            onPress={handleVisualize}
            disabled={continueDisabled}
            trailing={
              submitting ? (
                <ActivityIndicator color={colors.primaryOn} size="small" />
              ) : (
                <Wand2 size={20} color={colors.primaryOn} strokeWidth={2.2} />
              )
            }
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

function ProductThumb({
  uri,
  onReplace,
  onRemove,
}: {
  uri: string;
  onReplace: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={[styles.thumb, shadow.card]}>
      <Pressable onPress={onReplace} style={styles.thumbPressable}>
        <Image source={{ uri }} style={styles.thumbImage} resizeMode="cover" />
      </Pressable>
      <Pressable onPress={onRemove} hitSlop={10} style={styles.removeBtn}>
        <X size={14} color={colors.primaryOn} strokeWidth={2.4} />
      </Pressable>
    </View>
  );
}

function AddProductCard({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.addCard, shadow.card]}>
      <View style={styles.addIcon}>
        <Plus size={22} color={colors.primary} strokeWidth={2} />
      </View>
      <Text style={styles.addLabel}>Add product</Text>
    </Pressable>
  );
}

const THUMB_SIZE_PERCENT = '48%';

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xxl },
  body: { paddingVertical: spacing.md, gap: spacing.md },
  slotWrap: { height: 320 },
  cta: { marginTop: spacing.md, paddingBottom: spacing.lg },
  helperText: { ...type.caption, color: colors.textMuted, fontWeight: '600' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  thumb: {
    width: THUMB_SIZE_PERCENT,
    aspectRatio: 1,
    borderRadius: radius.lg,
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbPressable: { flex: 1 },
  thumbImage: { width: '100%', height: '100%' },
  removeBtn: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(10,10,10,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCard: {
    width: THUMB_SIZE_PERCENT,
    aspectRatio: 1,
    borderRadius: radius.lg,
    backgroundColor: colors.bgSoft,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  addIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  addLabel: { ...type.caption, color: colors.text, fontWeight: '600' },
});
