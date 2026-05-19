import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowRight, Check, Clock, Heart, Home } from 'lucide-react-native';
import { Screen } from '../components/Screen';
import { StepHeader } from '../components/StepHeader';
import { Button } from '../components/Button';
import { AiError, AiLoading, NoCredits } from '../components/AiStatus';
import { CreditsBadge } from '../components/CreditsBadge';
import { colors, radius, shadow, spacing, type } from '../lib/theme';
import { useLook } from '../lib/state';
import { discoverFragrances, type FragrancePick } from '../lib/blendrr';
import {
  canUseCredit,
  saveAnalysis,
  saveWishlistItem,
  type WishlistItem,
} from '../lib/storage';
import { consumeCreditWithPrompt } from '../lib/credits';

type State =
  | { kind: 'loading' }
  | { kind: 'ok'; picks: FragrancePick[] }
  | { kind: 'error'; message: string }
  | { kind: 'no-credits'; reason: string };

export default function FragranceResult() {
  const { routineAnswers } = useLook();
  const answers = routineAnswers.fragrance;
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [savedStates, setSavedStates] = useState<Record<string, 'saved' | 'view'>>({});
  const inFlight = useRef(false);

  const run = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setState({ kind: 'loading' });

    const credit = await canUseCredit();
    if (!credit.ok) {
      setState({ kind: 'no-credits', reason: credit.reason });
      inFlight.current = false;
      return;
    }

    try {
      const { picks } = await discoverFragrances({ answers });
      await consumeCreditWithPrompt();
      const summary = picks
        .slice(0, 3)
        .map((p) => `${p.brand} ${p.name}`)
        .join(' · ');
      await saveAnalysis({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: Date.now(),
        category: 'fragrance',
        summary,
        photoUri: null,
        data: { picks },
      });
      setState({ kind: 'ok', picks });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Something went wrong.';
      setState({ kind: 'error', message });
    } finally {
      inFlight.current = false;
    }
  }, [answers]);

  useEffect(() => {
    run();
  }, [run]);

  const addToWishlist = async (pick: FragrancePick) => {
    const key = `${pick.brand}-${pick.name}`;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const item: WishlistItem = {
      id,
      createdAt: Date.now(),
      name: `${pick.brand} ${pick.name}`,
      price: pick.price,
      url: '',
      category: 'fragrance',
      notes: pick.reason,
    };
    await saveWishlistItem(item);
    setSavedStates((prev) => ({ ...prev, [key]: 'saved' }));
    setTimeout(() => {
      setSavedStates((prev) => ({ ...prev, [key]: 'view' }));
    }, 1800);
  };

  const goHistory = () => {
    Alert.alert('Saved to history', "Your fragrance picks are in History. You'll be able to revisit them anytime.", [
      { text: 'OK' },
      { text: 'Open history', onPress: () => router.push('/history') },
    ]);
  };

  const savedAny = Object.keys(savedStates).length > 0;
  const tryBackHome = () => {
    if (!savedAny && state.kind === 'ok') {
      Alert.alert(
        'Heads up',
        "You haven't added any picks to your wishlist. Tap 'Add to wishlist' on one to keep it. Your scent profile is already in History.",
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
        title="Your scent profile"
        subtitle="Three fragrances matched to your taste."
        onBack={tryBackHome}
      />

      <ScrollView style={styles.body} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {state.kind === 'loading' && <AiLoading label="Sniffing out picks…" />}
        {state.kind === 'error' && <AiError message={state.message} onRetry={run} />}
        {state.kind === 'no-credits' && <NoCredits reason={state.reason} />}

        {state.kind === 'ok' &&
          state.picks.map((pick) => {
            const key = `${pick.brand}-${pick.name}`;
            const savedState = savedStates[key];
            return (
              <View key={key} style={[styles.pick, shadow.card]}>
                <View style={styles.pickHeader}>
                  <View style={styles.pickHeaderText}>
                    <Text style={styles.brand}>{pick.brand}</Text>
                    <Text style={styles.name}>{pick.name}</Text>
                  </View>
                  <View style={styles.priceTag}>
                    <Text style={styles.priceText}>{pick.price}</Text>
                  </View>
                </View>

                {pick.trend && (
                  <View style={styles.trendBadge}>
                    <Text style={styles.trendText}>{pick.trend}</Text>
                  </View>
                )}

                <Text style={styles.reason}>{pick.reason}</Text>

                <View style={styles.notesGrid}>
                  <NoteCol label="Top" notes={pick.notes.top} />
                  <NoteCol label="Middle" notes={pick.notes.middle} />
                  <NoteCol label="Base" notes={pick.notes.base} />
                </View>

                {savedState === undefined && (
                  <Pressable onPress={() => addToWishlist(pick)} style={styles.addBtn}>
                    <Heart size={16} color={colors.primaryOn} strokeWidth={2.2} />
                    <Text style={styles.addLabel}>Add to wishlist</Text>
                  </Pressable>
                )}
                {savedState === 'saved' && (
                  <View style={[styles.addBtn, styles.addBtnSaved]}>
                    <Check size={16} color={colors.text} strokeWidth={2.4} />
                    <Text style={styles.addLabelSaved}>Saved</Text>
                  </View>
                )}
                {savedState === 'view' && (
                  <Pressable
                    onPress={() => router.push('/menu/wishlist')}
                    style={[styles.addBtn, styles.addBtnSaved]}
                  >
                    <Text style={styles.addLabelSaved}>View wishlist</Text>
                    <ArrowRight size={16} color={colors.text} strokeWidth={2.2} />
                  </Pressable>
                )}
              </View>
            );
          })}

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

function NoteCol({ label, notes }: { label: string; notes: string[] }) {
  return (
    <View style={styles.noteCol}>
      <Text style={styles.noteLabel}>{label}</Text>
      {notes.map((n, i) => (
        <Text key={i} style={styles.noteText}>
          {n}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: spacing.sm,
  },
  body: { flex: 1 },
  content: { paddingBottom: spacing.xxl, gap: spacing.md },
  pick: {
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  pickHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  pickHeaderText: { flex: 1 },
  brand: { ...type.eyebrow, color: colors.textMuted, fontSize: 11 },
  name: { ...type.heading, color: colors.text, fontSize: 18, marginTop: 2 },
  priceTag: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  priceText: { ...type.heading, color: colors.text, fontSize: 14 },
  trendBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  trendText: { ...type.caption, color: colors.primaryOn, fontSize: 11, fontWeight: '600' },
  reason: { ...type.body, color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  notesGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.bg,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noteCol: { flex: 1, gap: 2 },
  noteLabel: {
    ...type.eyebrow,
    color: colors.textFaint,
    fontSize: 10,
    marginBottom: 4,
  },
  noteText: { ...type.body, color: colors.text, fontSize: 12 },
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
  cta: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
