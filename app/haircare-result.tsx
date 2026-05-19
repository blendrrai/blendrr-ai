import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Clock, Home, Sparkles } from 'lucide-react-native';
import { Screen } from '../components/Screen';
import { StepHeader } from '../components/StepHeader';
import { Button } from '../components/Button';
import { AiError, AiLoading, NoCredits } from '../components/AiStatus';
import { CreditsBadge } from '../components/CreditsBadge';
import { KeyProductCard } from '../components/KeyProductCard';
import { colors, radius, shadow, spacing, type } from '../lib/theme';
import { useLook } from '../lib/state';
import { analyzeHair, type HairAnalysis } from '../lib/blendrr';
import { canUseCredit, saveAnalysis } from '../lib/storage';
import { consumeCreditWithPrompt } from '../lib/credits';

type State =
  | { kind: 'loading' }
  | { kind: 'ok'; data: HairAnalysis }
  | { kind: 'error'; message: string }
  | { kind: 'no-credits'; reason: string };

export default function HaircareResult() {
  const { routineAnswers, routinePhotos } = useLook();
  const answers = routineAnswers.haircare;
  const photo = routinePhotos.haircare;
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [savedCount, setSavedCount] = useState(0);
  const inFlight = useRef(false);

  const run = useCallback(async () => {
    if (inFlight.current) return;
    if (!photo) {
      setState({ kind: 'error', message: 'No hair photo found.' });
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
      const data = await analyzeHair({ photoUri: photo, answers });
      await consumeCreditWithPrompt();
      await saveAnalysis({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: Date.now(),
        category: 'haircare',
        summary: data.observations,
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

  const goHistory = () => {
    Alert.alert('Saved to history', "Your analysis is in History. You'll be able to revisit it anytime.", [
      { text: 'OK' },
      { text: 'Open history', onPress: () => router.push('/history') },
    ]);
  };

  const tryBackHome = () => {
    if (savedCount === 0 && state.kind === 'ok') {
      Alert.alert(
        'Heads up',
        "You haven't added any products to your wishlist from this quiz. Tap 'Add to wishlist' on a recommendation to keep specific picks. Your analysis is already in History.",
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
        title="Your hair plan"
        subtitle="Personalised from your photo + answers."
        onBack={tryBackHome}
      />

      <ScrollView style={styles.body} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {state.kind === 'loading' && <AiLoading label="Reading your hair…" />}
        {state.kind === 'error' && <AiError message={state.message} onRetry={run} />}
        {state.kind === 'no-credits' && <NoCredits reason={state.reason} />}

        {state.kind === 'ok' && (
          <>
            <View style={[styles.card, shadow.card]}>
              <View style={styles.cardHeader}>
                <Sparkles size={20} color={colors.primary} strokeWidth={1.8} />
                <Text style={styles.cardTitle}>What we noticed</Text>
              </View>
              <Text style={styles.cardBody}>{state.data.observations}</Text>
            </View>

            <View style={[styles.card, shadow.card]}>
              <Text style={styles.cardEyebrow}>Wash routine</Text>
              <Text style={styles.cardBody}>{state.data.wash_routine}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Weekly treatments</Text>
              {state.data.weekly_treatments.map((t, i) => (
                <View key={i} style={styles.bulletRow}>
                  <View style={styles.bulletDot} />
                  <Text style={styles.bulletText}>{t}</Text>
                </View>
              ))}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Styling tips</Text>
              {state.data.styling_tips.map((t, i) => (
                <View key={i} style={styles.bulletRow}>
                  <View style={styles.bulletDot} />
                  <Text style={styles.bulletText}>{t}</Text>
                </View>
              ))}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Look for</Text>
              <Text style={styles.sectionHelper}>
                Tap "Find products" on any to get current real picks (1 credit each).
              </Text>
              {state.data.key_products.map((p, i) => (
                <KeyProductCard
                  key={i}
                  product={p}
                  category="haircare"
                  userAnswers={answers}
                  onProductSaved={() => setSavedCount((c) => c + 1)}
                />
              ))}
            </View>
          </>
        )}

        {photo && (
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

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: spacing.sm,
  },
  body: { flex: 1 },
  content: { paddingBottom: spacing.xxl, gap: spacing.md },
  card: {
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardEyebrow: { ...type.eyebrow, color: colors.textMuted },
  cardTitle: { ...type.heading, fontSize: 16, color: colors.text },
  cardBody: { ...type.body, color: colors.text, lineHeight: 22 },
  section: { gap: spacing.sm },
  sectionLabel: { ...type.eyebrow, color: colors.textMuted },
  sectionHelper: { ...type.caption, color: colors.textFaint, lineHeight: 17 },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: 4,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 8,
  },
  bulletText: { ...type.body, fontSize: 14, color: colors.text, flex: 1, lineHeight: 20 },
  photo: {
    width: '100%',
    aspectRatio: 1.4,
    borderRadius: radius.lg,
    backgroundColor: colors.bgSoft,
  },
  cta: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
