import { useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { ArrowRight, Plus, X } from 'lucide-react-native';
import { Screen } from '../components/Screen';
import { StepHeader } from '../components/StepHeader';
import { PhotoSlot } from '../components/PhotoSlot';
import { Button } from '../components/Button';
import { Divider, UrlInput } from '../components/UrlInput';
import { colors, MAX_PRODUCTS_MULTI, radius, shadow, spacing, type } from '../lib/theme';
import { useLook } from '../lib/state';
import { presentPickerSheet } from '../lib/pickImage';
import { fetchProductImage } from '../lib/fetchProductImage';

export default function ProductStep() {
  const { mode, productUris, addProduct, removeProduct, replaceProduct } = useLook();
  const [loadingUrl, setLoadingUrl] = useState(false);

  const isSingle = mode === 'single';
  const canAddMore = isSingle ? productUris.length === 0 : productUris.length < MAX_PRODUCTS_MULTI;

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
      addProduct(uri, url);
    } finally {
      setLoadingUrl(false);
    }
  };

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

  const continueDisabled = productUris.length === 0;

  return (
    <Screen>
      <StepHeader
        step="Step 4 of 5"
        title={isSingle ? 'Pick a product' : 'Add your products'}
        subtitle={
          isSingle
            ? 'Upload a screenshot for best results, or paste a product link.'
            : `Up to ${MAX_PRODUCTS_MULTI} products. The AI figures out where each one goes.`
        }
      />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {isSingle ? (
          <View style={styles.body}>
            <OptionHeader number={1} label="Upload a screenshot" recommended />
            <View style={styles.slotWrap}>
              <PhotoSlot
                uri={productUris[0] ?? null}
                onPress={pickProductFromCameraOrLibrary}
                emptyTitle="Upload a screenshot"
                emptyHint="A clear shot of the lipstick, shadow, or hair colour. Swatches work best."
              />
            </View>

            <Divider label="Or" />

            <OptionHeader number={2} label="Paste a product link" />
            <UrlInput loading={loadingUrl} onSubmit={handleUrl} />
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

            {canAddMore && (
              <>
                <Divider label="Or paste a product link" />
                <UrlInput loading={loadingUrl} onSubmit={handleUrl} />
              </>
            )}
          </View>
        )}

        <View style={styles.cta}>
          <Button
            label="Continue"
            onPress={() => router.push('/quality')}
            disabled={continueDisabled}
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
