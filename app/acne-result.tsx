import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  AlertCircle,
  ArrowRight,
  Check,
  Clock,
  Heart,
  Home,
  ShieldCheck,
  Sparkles,
} from 'lucide-react-native';
import { Screen } from '../components/Screen';
import { StepHeader } from '../components/StepHeader';
import { Button } from '../components/Button';
import { AiError, AiLoading, NoCredits } from '../components/AiStatus';
import { CreditsBadge } from '../components/CreditsBadge';
import { colors, radius, shadow, spacing, type } from '../lib/theme';
import { useLook } from '../lib/state';
import { analyzeAcne, type AcneAnalysis, type AcneProduct } from '../lib/blendrr';
import {
  canUseCredit,
  saveAnalysis,
  saveWishlistItem,
  type WishlistItem,
} from '../lib/storage';
import { consumeCreditWithPrompt } from '../lib/credits';

type State =
  | { kind: 'loading' }
  | { kind: 'ok'; data: AcneAnalysis }
  | { kind: 'error'; message: string }
  | { kind: 'no-credits'; reason: string };

const SEVERITY_LABEL: Record<AcneAnalysis['severity'], string> = {
  mild: 'Mild',
  moderate: 'Moderate',
  severe: 'Severe',
};

export default function AcneResult() {
  const { routineAnswers, routinePhotos } = useLook();
  const answers = routineAnswers.acne;
  const photo = routinePhotos.acne;
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const inFlight = useRef(false);

  const run = useCallback(async () => {
    if (inFlight.current) return;
    if (!photo) {
      setState({ kind: 'error', message: 'No photo found.' });
      return;
    }
    inFlight.current = true;
    setState({ kind: 'loading' });

    const credit = await canUseCredit();
    if (!credit.ok) {
      setState({ kind: 'no-credits', reason: credit.reason });
      inFlight.current = false;
      return;
    }

    try {
      const data = await analyzeAcne({ selfieUri: photo, answers });
      await consumeCreditWithPrompt();
      await saveAnalysis({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: Date.now(),
        category: 'acne',
        summary: `${data.acne_type} (${SEVERITY_LABEL[data.severity]})`,
        photoUri: photo,
        data,
      });
      setState({ kind: 'ok', data });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Something went wrong.';
      setState({ kind: 'error', message });
    } finally {
      inFlight.current = false;
    }
  }, [photo, answers]);

  useEffect(() => {
    run();
  }, [run]);

  const addToWishlist = async (product: AcneProduct) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const item: WishlistItem = {
      id,
      createdAt: Date.now(),
      name: `${product.brand} ${product.name}`,
      price: product.price,
      url: '',
      category: 'skincare',
      notes: `${product.where} — ${product.why}`,
    };
    await saveWishlistItem(item);
    setSavedIds((prev) => new Set(prev).add(`${product.brand}-${product.name}`));
  };

  const goHistory = () => {
    Alert.alert('Saved to history', "Your acne plan is in History. You'll be able to revisit it anytime.", [
      { text: 'OK' },
      { text: 'Open history', onPress: () => router.push('/history') },
    ]);
  };

  const tryBackHome = () => {
    if (savedIds.size === 0 && state.kind === 'ok') {
      Alert.alert(
        'Heads up',
        "You haven't added any products to your wishlist from this analysis. Tap 'Add to skincare wishlist' on a product to keep it. Your plan is already in History.",
        [
          { text: 'Stay here', style: 'cancel' },
          { text: 'Leave anyway', style: 'destructive', onPress: () => router.dismissAll() },
        ],
      );
      return;
    }
    router.dismissAll();
  };

  return (
    <Screen>
      <View style={styles.topRow}>
        <CreditsBadge />
      </View>
      <StepHeader
        title="Your acne plan"
        subtitle="Informational, not medical advice."
        onBack={tryBackHome}
      />

      <ScrollView style={styles.body} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {state.kind === 'loading' && <AiLoading label="Reading your skin…" />}
        {state.kind === 'error' && <AiError message={state.message} onRetry={run} />}
        {state.kind === 'no-credits' && <NoCredits reason={state.reason} />}

        {state.kind === 'ok' && (
          <>
            <View style={[styles.diagnosis, shadow.card]}>
              <View style={styles.diagnosisHeader}>
                <View style={styles.diagnosisIcon}>
                  <ShieldCheck size={22} color={colors.primary} strokeWidth={1.8} />
                </View>
                <View style={styles.diagnosisHeaderText}>
                  <Text style={styles.diagnosisEyebrow}>Pattern</Text>
                  <Text style={styles.diagnosisTitle}>{state.data.acne_type}</Text>
                </View>
                <View style={[styles.severityTag, severityStyle(state.data.severity)]}>
                  <Text style={[styles.severityText, severityTextStyle(state.data.severity)]}>
                    {SEVERITY_LABEL[state.data.severity]}
                  </Text>
                </View>
              </View>
              <Text style={styles.diagnosisBody}>{state.data.observations}</Text>
            </View>

            <View style={[styles.card, shadow.card]}>
              <View style={styles.cardHeader}>
                <Sparkles size={18} color={colors.text} strokeWidth={1.8} />
                <Text style={styles.cardTitle}>What helps</Text>
              </View>
              <Text style={styles.cardBody}>{state.data.what_helps}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Your routine</Text>
              {state.data.routine.map((s, i) => (
                <View key={i} style={[styles.stepRow, shadow.card]}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{i + 1}</Text>
                  </View>
                  <View style={styles.stepText}>
                    <Text style={styles.stepName}>{s.step}</Text>
                    <Text style={styles.stepWhat}>{s.what}</Text>
                    <View style={styles.stepWhenChip}>
                      <Text style={styles.stepWhenText}>{s.when}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>

            {state.data.products.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Try these</Text>
                {state.data.products.map((p) => {
                  const key = `${p.brand}-${p.name}`;
                  const saved = savedIds.has(key);
                  return (
                    <View key={key} style={[styles.product, shadow.card]}>
                      <View style={styles.productHeader}>
                        <View style={styles.productHeaderText}>
                          <Text style={styles.productBrand}>{p.brand}</Text>
                          <Text style={styles.productName}>{p.name}</Text>
                        </View>
                        <View style={styles.priceTag}>
                          <Text style={styles.priceText}>{p.price}</Text>
                        </View>
                      </View>
                      {p.where ? <Text style={styles.productWhere}>{p.where}</Text> : null}
                      <Text style={styles.productWhy}>{p.why}</Text>
                      <Pressable
                        onPress={() => !saved && addToWishlist(p)}
                        disabled={saved}
                        style={[styles.addBtn, saved && styles.addBtnSaved]}
                      >
                        {saved ? (
                          <>
                            <Check size={16} color={colors.text} strokeWidth={2.4} />
                            <Text style={styles.addLabelSaved}>Saved</Text>
                          </>
                        ) : (
                          <>
                            <Heart size={16} color={colors.primaryOn} strokeWidth={2.2} />
                            <Text style={styles.addLabel}>Add to skincare wishlist</Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}

            {state.data.avoid && state.data.avoid.length > 0 && (
              <View style={[styles.avoidCard, shadow.card]}>
                <View style={styles.cardHeader}>
                  <AlertCircle size={18} color={colors.primary} strokeWidth={2} />
                  <Text style={styles.cardTitle}>Avoid</Text>
                </View>
                {state.data.avoid.map((a, i) => (
                  <View key={i} style={styles.avoidRow}>
                    <View style={styles.avoidDot} />
                    <Text style={styles.avoidText}>{a}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {photo && state.kind === 'ok' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Your photo</Text>
            <Image source={{ uri: photo }} style={styles.photo} resizeMode="cover" />
          </View>
        )}

        <View style={styles.cta}>
          {state.kind === 'ok' && (
            <Button
              label="Saved to history — view"
              onPress={goHistory}
              trailing={<Clock size={18} color={colors.primaryOn} strokeWidth={2} />}
            />
          )}
          <Button
            label="Back to home"
            onPress={tryBackHome}
            leading={<Home size={18} color={colors.primaryOn} strokeWidth={2} />}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

function severityStyle(s: AcneAnalysis['severity']) {
  if (s === 'severe') return { backgroundColor: colors.primary };
  if (s === 'moderate') return { backgroundColor: colors.bg, borderColor: colors.primary, borderWidth: 1 };
  return { backgroundColor: colors.bgSoft, borderColor: colors.border, borderWidth: 1 };
}

function severityTextStyle(s: AcneAnalysis['severity']) {
  if (s === 'severe') return { color: colors.primaryOn };
  return { color: colors.text };
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: spacing.sm,
  },
  body: { flex: 1 },
  content: { paddingBottom: spacing.xxl, gap: spacing.md },
  diagnosis: {
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  diagnosisHeader: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  diagnosisIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  diagnosisHeaderText: { flex: 1, gap: 2 },
  diagnosisEyebrow: { ...type.eyebrow, color: colors.textMuted, fontSize: 10 },
  diagnosisTitle: { ...type.heading, color: colors.text, fontSize: 15, lineHeight: 19 },
  severityTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  severityText: { ...type.caption, fontWeight: '700', fontSize: 11 },
  diagnosisBody: { ...type.body, color: colors.text, fontSize: 14, lineHeight: 20 },
  card: {
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitle: { ...type.heading, fontSize: 15, color: colors.text },
  cardBody: { ...type.body, color: colors.text, fontSize: 14, lineHeight: 21 },
  section: { gap: spacing.sm },
  sectionLabel: { ...type.eyebrow, color: colors.textMuted },
  stepRow: {
    flexDirection: 'row',
    backgroundColor: colors.bgSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepNumberText: { ...type.caption, color: colors.primaryOn, fontWeight: '700', fontSize: 12 },
  stepText: { flex: 1, gap: 4 },
  stepName: { ...type.heading, fontSize: 14, color: colors.text },
  stepWhat: { ...type.body, fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  stepWhenChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 2,
  },
  stepWhenText: { ...type.caption, color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  product: {
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  productHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  productHeaderText: { flex: 1 },
  productBrand: { ...type.eyebrow, color: colors.textMuted, fontSize: 11 },
  productName: { ...type.heading, fontSize: 17, color: colors.text, marginTop: 2 },
  priceTag: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  priceText: { ...type.heading, color: colors.text, fontSize: 14 },
  productWhere: { ...type.caption, color: colors.textMuted, fontSize: 12 },
  productWhy: { ...type.body, color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  addBtnSaved: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  addLabel: { ...type.heading, fontSize: 14, color: colors.primaryOn },
  addLabelSaved: { ...type.heading, fontSize: 14, color: colors.text },
  avoidCard: {
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    gap: spacing.sm,
  },
  avoidRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  avoidDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 8,
  },
  avoidText: { ...type.body, fontSize: 13, color: colors.text, flex: 1, lineHeight: 19 },
  photo: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.lg,
    backgroundColor: colors.bgSoft,
  },
  cta: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
