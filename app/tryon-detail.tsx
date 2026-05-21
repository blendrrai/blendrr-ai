import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Keyboard,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ArrowRight, Heart, Link2, RotateCcw, Trash2 } from 'lucide-react-native';
import { Screen } from '../components/Screen';
import { StepHeader } from '../components/StepHeader';
import { Button } from '../components/Button';
import { EnlargeButton, ImageEnlargerModal } from '../components/ImageEnlarger';
import { colors, radius, shadow, spacing, type, zoneLabels } from '../lib/theme';
import {
  deleteTryOn,
  getTryOnById,
  saveWishlistItem,
  updateTryOn,
  type TryOn,
  type WishlistItem,
} from '../lib/storage';
import { useLook } from '../lib/state';

export default function TryOnDetail() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : null;

  const { setSelfie, setProducts, setZone, setMode } = useLook();

  const [tryOn, setTryOn] = useState<TryOn | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'before' | 'after'>('after');
  const [enlargedUri, setEnlargedUri] = useState<string | null>(null);
  const [productName, setProductName] = useState('');
  const [productUrl, setProductUrl] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);
  const [addedToWishlist, setAddedToWishlist] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    const t = await getTryOnById(id);
    setTryOn(t);
    setProductName(t?.productName ?? '');
    setProductUrl(t?.productUrl ?? '');
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const persistDetails = async () => {
    if (!tryOn) return;
    const trimmedName = productName.trim();
    const trimmedUrl = productUrl.trim();
    if (trimmedName === (tryOn.productName ?? '') && trimmedUrl === (tryOn.productUrl ?? '')) {
      return; // nothing changed
    }
    setSavingDetails(true);
    try {
      await updateTryOn(tryOn.id, {
        productName: trimmedName || undefined,
        productUrl: trimmedUrl || null,
      });
      setTryOn((prev) =>
        prev
          ? { ...prev, productName: trimmedName || undefined, productUrl: trimmedUrl || null }
          : prev,
      );
    } finally {
      setSavingDetails(false);
    }
  };

  const addToWishlist = async () => {
    if (!tryOn) return;
    const trimmedName = productName.trim();
    if (!trimmedName) {
      Alert.alert('Add a name first', 'Give this product a name before adding to your wishlist.');
      return;
    }
    // Persist any unsaved edits before adding to wishlist
    await persistDetails();
    const item: WishlistItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      name: trimmedName,
      price: '',
      url: productUrl.trim(),
      category: 'makeup',
      notes: null,
    };
    await saveWishlistItem(item);
    setAddedToWishlist(true);
  };

  const openUrl = () => {
    const url = productUrl.trim();
    if (!url) return;
    const withProtocol = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    Linking.openURL(withProtocol).catch(() => {
      Alert.alert('Could not open link', url);
    });
  };

  const reuseShade = () => {
    if (!tryOn) return;
    Alert.alert(
      `${zoneLabels[tryOn.zone]} try-on`,
      'Reuse this shade on a new selfie?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Try again',
          onPress: () => {
            setSelfie(null);
            const uris = tryOn.productUris ?? [tryOn.productUri];
            const urls = tryOn.productUrls ?? [tryOn.productUrl];
            setProducts(uris, urls);
            setZone(tryOn.zone);
            setMode(tryOn.mode ?? 'single');
            router.push('/selfie');
          },
        },
      ],
    );
  };

  const handleDelete = () => {
    if (!tryOn) return;
    Alert.alert(
      'Delete this try-on?',
      'This will remove it from your history. The image is not removed from your camera roll if you saved it there.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteTryOn(tryOn.id);
            router.back();
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <Screen>
        <StepHeader title="Try-on" />
        <View style={styles.center}>
          <Text style={styles.muted}>Loading…</Text>
        </View>
      </Screen>
    );
  }

  if (!tryOn) {
    return (
      <Screen>
        <StepHeader title="Try-on" />
        <View style={styles.center}>
          <Text style={styles.muted}>That try-on isn't in your history anymore.</Text>
        </View>
      </Screen>
    );
  }

  const productUris = tryOn.productUris ?? [tryOn.productUri];
  const displayUri = view === 'before' ? tryOn.selfieUri : tryOn.resultUri ?? tryOn.selfieUri;

  return (
    <Screen>
      <StepHeader
        title={zoneLabels[tryOn.zone]}
        subtitle={formatDate(tryOn.createdAt)}
      />

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Before/After image */}
        <View style={[styles.imageCard, shadow.card]}>
          {displayUri && (
            <Image source={{ uri: displayUri }} style={styles.image} resizeMode="cover" />
          )}

          <View style={styles.toggle}>
            <ToggleSeg label="Before" active={view === 'before'} onPress={() => setView('before')} />
            <ToggleSeg label="After" active={view === 'after'} onPress={() => setView('after')} />
          </View>

          {displayUri && (
            <EnlargeButton onPress={() => setEnlargedUri(displayUri)} style={styles.enlargeOverlay} />
          )}
        </View>

        {/* Product thumbnails (one for single, grid for multi) */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            {productUris.length === 1 ? 'Product' : `Products (${productUris.length})`}
          </Text>
          <View style={styles.productGrid}>
            {productUris.map((uri, i) => (
              <Pressable
                key={`${uri}-${i}`}
                onPress={() => setEnlargedUri(uri)}
                style={[styles.productThumb, shadow.card]}
              >
                <Image source={{ uri }} style={styles.productThumbImage} resizeMode="cover" />
              </Pressable>
            ))}
          </View>
        </View>

        {/* Editable product info */}
        <View style={[styles.detailsCard, shadow.card]}>
          <Text style={styles.detailsTitle}>Product details</Text>
          <Text style={styles.detailsHelper}>
            Add a name and link so you can find this look again.
          </Text>

          <Field
            label="Name"
            value={productName}
            onChangeText={setProductName}
            placeholder="e.g. MAC Velvet Teddy"
            onBlur={persistDetails}
          />
          <Field
            label="Link"
            value={productUrl}
            onChangeText={setProductUrl}
            placeholder="https://…"
            autoCapitalize="none"
            keyboardType="url"
            onBlur={persistDetails}
            trailingPress={productUrl.trim() ? openUrl : undefined}
            trailingIcon={<Link2 size={16} color={colors.text} strokeWidth={2} />}
          />

          {savingDetails && <Text style={styles.savingHint}>Saving…</Text>}
        </View>

        {/* Action buttons */}
        <View style={styles.cta}>
          <Button
            label={addedToWishlist ? 'Added to wishlist' : 'Add to wishlist'}
            onPress={() => {
              Keyboard.dismiss();
              addToWishlist();
            }}
            disabled={addedToWishlist}
            trailing={<Heart size={18} color={colors.primaryOn} strokeWidth={2.2} />}
          />
          {addedToWishlist && (
            <Pressable
              onPress={() => router.push('/menu/wishlist')}
              style={styles.viewWishlistBtn}
            >
              <Text style={styles.viewWishlistText}>View wishlist</Text>
              <ArrowRight size={16} color={colors.text} strokeWidth={2} />
            </Pressable>
          )}

          <Button
            label="Reuse this shade"
            onPress={reuseShade}
            variant="ghost"
            leading={<RotateCcw size={18} color={colors.text} strokeWidth={2} />}
          />

          <Pressable onPress={handleDelete} style={styles.deleteBtn}>
            <Trash2 size={14} color={colors.textFaint} strokeWidth={2} />
            <Text style={styles.deleteLabel}>Delete from history</Text>
          </Pressable>
        </View>
      </ScrollView>

      <ImageEnlargerModal uri={enlargedUri} visible={!!enlargedUri} onClose={() => setEnlargedUri(null)} />
    </Screen>
  );
}

function ToggleSeg({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.toggleSeg, active && styles.toggleSegActive]}>
      <Text style={[styles.toggleLabel, active && styles.toggleLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  onBlur,
  autoCapitalize,
  keyboardType,
  trailingPress,
  trailingIcon,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  onBlur?: () => void;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'url' | 'email-address' | 'numeric';
  trailingPress?: () => void;
  trailingIcon?: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          placeholder={placeholder}
          placeholderTextColor={colors.textFaint}
          autoCapitalize={autoCapitalize ?? 'sentences'}
          autoCorrect={false}
          keyboardType={keyboardType ?? 'default'}
          style={[styles.input, trailingIcon ? styles.inputWithTrailing : null]}
        />
        {trailingIcon && trailingPress && (
          <Pressable onPress={trailingPress} hitSlop={10} style={styles.inputTrailing}>
            {trailingIcon}
          </Pressable>
        )}
      </View>
    </View>
  );
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  bodyContent: { paddingBottom: spacing.xxl, gap: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  muted: { ...type.body, color: colors.textMuted, textAlign: 'center' },

  imageCard: {
    backgroundColor: colors.bgSoft,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
  },
  image: { width: '100%', aspectRatio: 1 },
  toggle: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    backgroundColor: 'rgba(10,10,10,0.72)',
    borderRadius: radius.pill,
    padding: 4,
    gap: 2,
  },
  toggleSeg: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  toggleSegActive: { backgroundColor: colors.primaryOn },
  toggleLabel: { ...type.caption, color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
  toggleLabelActive: { color: colors.text },
  enlargeOverlay: { position: 'absolute', top: spacing.md, right: spacing.md },

  section: { gap: spacing.sm },
  sectionLabel: { ...type.eyebrow, color: colors.textMuted },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  productThumb: {
    width: 88,
    height: 88,
    borderRadius: radius.md,
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  productThumbImage: { width: '100%', height: '100%' },

  detailsCard: {
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  detailsTitle: { ...type.heading, fontSize: 16, color: colors.text },
  detailsHelper: { ...type.caption, color: colors.textMuted, lineHeight: 17 },
  field: { gap: 6 },
  fieldLabel: { ...type.eyebrow, color: colors.textMuted, fontSize: 11 },
  inputWrap: { position: 'relative' },
  input: {
    ...type.body,
    color: colors.text,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    fontSize: 14,
  },
  inputWithTrailing: { paddingRight: 44 },
  inputTrailing: {
    position: 'absolute',
    right: spacing.sm,
    top: 0,
    bottom: 0,
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savingHint: { ...type.caption, color: colors.textFaint, fontSize: 11 },

  cta: { gap: spacing.sm, marginTop: spacing.md },
  viewWishlistBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  viewWishlistText: { ...type.caption, color: colors.text, fontWeight: '600' },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: spacing.sm,
  },
  deleteLabel: { ...type.caption, color: colors.textFaint, fontWeight: '500' },
});
