import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowRight, Check, Heart, Sparkles } from 'lucide-react-native';
import { colors, radius, shadow, spacing, type } from '../lib/theme';
import { findProductsForRecommendation, type FoundProduct } from '../lib/blendrr';
import {
  canUseCredit,
  saveWishlistItem,
  type Category,
  type WishlistItem,
} from '../lib/storage';
import { consumeCreditWithPrompt } from '../lib/credits';
import type { Answers } from './Questionnaire';

type Product = { type: string; what_to_look_for: string; why: string };

type FindState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; products: FoundProduct[] }
  | { kind: 'error'; message: string };

type Props = {
  product: Product;
  category: 'skincare' | 'haircare';
  userAnswers: Answers;
  onProductSaved?: () => void;
};

type SavedState = 'idle' | 'saved' | 'view';

export function KeyProductCard({ product, category, userAnswers, onProductSaved }: Props) {
  const [state, setState] = useState<FindState>({ kind: 'idle' });
  const [savedStates, setSavedStates] = useState<Record<string, SavedState>>({});

  const runFind = async () => {
    setState({ kind: 'loading' });
    try {
      const products = await findProductsForRecommendation({
        category,
        productType: product.type,
        whatToLookFor: product.what_to_look_for,
        why: product.why,
        userAnswers,
      });
      await consumeCreditWithPrompt();
      setState({ kind: 'ok', products });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Something went wrong.';
      setState({ kind: 'error', message });
    }
  };

  const onFindPress = async () => {
    const credit = await canUseCredit();
    if (!credit.ok) {
      Alert.alert('Out of credits', credit.reason);
      return;
    }
    Alert.alert(
      `Find products for ${product.type}?`,
      'Uses 1 credit. We’ll search the web for current UK picks that match this recommendation.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Find them', onPress: runFind },
      ],
    );
  };

  const addToWishlist = async (p: FoundProduct) => {
    const key = `${p.brand}-${p.name}`;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const item: WishlistItem = {
      id,
      createdAt: Date.now(),
      name: `${p.brand} ${p.name}`,
      price: p.price,
      url: '',
      category: category as Category,
      notes: `${p.where} — ${p.why}`,
    };
    await saveWishlistItem(item);
    onProductSaved?.();
    setSavedStates((prev) => ({ ...prev, [key]: 'saved' }));
    setTimeout(() => {
      setSavedStates((prev) => ({ ...prev, [key]: 'view' }));
    }, 1800);
  };

  return (
    <View style={[styles.card, shadow.card]}>
      <Text style={styles.type}>{product.type}</Text>
      <Text style={styles.look}>{product.what_to_look_for}</Text>
      <Text style={styles.why}>{product.why}</Text>

      {state.kind === 'idle' && (
        <Pressable onPress={onFindPress} style={styles.findBtn}>
          <Sparkles size={14} color={colors.primaryOn} strokeWidth={2.2} />
          <Text style={styles.findLabel}>Find products (1 credit)</Text>
        </Pressable>
      )}

      {state.kind === 'loading' && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingLabel}>Searching the web…</Text>
        </View>
      )}

      {state.kind === 'error' && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{state.message}</Text>
          <Pressable onPress={onFindPress} style={styles.retryBtn}>
            <Text style={styles.retryLabel}>Try again</Text>
          </Pressable>
        </View>
      )}

      {state.kind === 'ok' && (
        <View style={styles.results}>
          {state.products.map((p) => {
            const key = `${p.brand}-${p.name}`;
            const savedState = savedStates[key];
            return (
              <View key={key} style={styles.foundCard}>
                <View style={styles.foundHeader}>
                  <View style={styles.foundHeaderText}>
                    <Text style={styles.foundBrand}>{p.brand}</Text>
                    <Text style={styles.foundName}>{p.name}</Text>
                  </View>
                  <View style={styles.priceTag}>
                    <Text style={styles.priceText}>{p.price}</Text>
                  </View>
                </View>
                {p.where ? <Text style={styles.foundWhere}>{p.where}</Text> : null}
                <Text style={styles.foundWhy}>{p.why}</Text>

                {!savedState && (
                  <Pressable onPress={() => addToWishlist(p)} style={styles.addBtn}>
                    <Heart size={14} color={colors.primaryOn} strokeWidth={2.2} />
                    <Text style={styles.addLabel}>Add to wishlist</Text>
                  </Pressable>
                )}
                {savedState === 'saved' && (
                  <View style={[styles.addBtn, styles.addBtnSaved]}>
                    <Check size={14} color={colors.text} strokeWidth={2.4} />
                    <Text style={styles.addLabelSaved}>Saved to wishlist</Text>
                  </View>
                )}
                {savedState === 'view' && (
                  <Pressable
                    onPress={() => router.push('/menu/wishlist')}
                    style={[styles.addBtn, styles.addBtnSaved]}
                  >
                    <Text style={styles.addLabelSaved}>View wishlist</Text>
                    <ArrowRight size={14} color={colors.text} strokeWidth={2.4} />
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  type: { ...type.eyebrow, color: colors.primary, fontSize: 11 },
  look: { ...type.heading, fontSize: 15, color: colors.text },
  why: { ...type.body, fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  findBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    marginTop: 4,
  },
  findLabel: { ...type.caption, color: colors.primaryOn, fontWeight: '700', fontSize: 13 },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  loadingLabel: { ...type.caption, color: colors.textMuted, fontWeight: '600' },
  errorBox: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    gap: spacing.sm,
  },
  errorText: { ...type.caption, color: colors.text, lineHeight: 18 },
  retryBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  retryLabel: { ...type.caption, color: colors.primaryOn, fontWeight: '600' },
  results: { gap: spacing.sm },
  foundCard: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  foundHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  foundHeaderText: { flex: 1 },
  foundBrand: { ...type.eyebrow, color: colors.textMuted, fontSize: 10 },
  foundName: { ...type.heading, fontSize: 15, color: colors.text, marginTop: 2 },
  priceTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  priceText: { ...type.heading, color: colors.text, fontSize: 13 },
  foundWhere: { ...type.caption, color: colors.textMuted, fontSize: 11 },
  foundWhy: { ...type.body, color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  addBtnSaved: {
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  addLabel: { ...type.caption, color: colors.primaryOn, fontWeight: '700', fontSize: 13 },
  addLabelSaved: { ...type.caption, color: colors.text, fontWeight: '600', fontSize: 13 },
});
