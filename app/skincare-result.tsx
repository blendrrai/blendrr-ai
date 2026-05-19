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
import { analyzeSkin, type SkinAnalysis } from '../lib/blendrr';
import { canUseCredit, saveAnalysis } from '../lib/storage';
import { consumeCreditWithPrompt } from '../lib/credits';

type State =
  | { kind: 'loading' }
  | { kind: 'ok'; data: SkinAnalysis }
  | { kind: 'error'; message: string }
  | { kind: 'no-credits'; reason: string };

export default function SkincareResult() {
  const { routineAnswers, routinePhotos } = useLook();
  const answers = routineAnswers.skincare;
  const photo = routinePhotos.skincare;
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [savedCount, setSavedCount] = useState(0);
  const inFlight = useRef(false);

  const run = useCallback(async () => {
    if (inFlight.current) return;
    if (!photo) {
      setState({ kind: 'error', message: 'No selfie found.' });
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
      const data = await analyzeSkin({ selfieUri: photo, answers });
      await consumeCreditWithPrompt();
      await saveAnalysis({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: Date.now(),
        category: 'skincare',
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
        title="Your skin plan"
        subtitle="Personalised from your selfie + answers."
        onBack={tryBackHome}
      />

      <ScrollView style={styles.body} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {state.kind === 'loading' && <AiLoading label="Reading your skin…" />}
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

            <Routine label="Morning" steps={state.data.morning_routine} />
            <Routine label="Evening" steps={state.data.evening_routine} />

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Look for</Text>
              <Text style={styles.sectionHelper}>
                Tap "Find products" on any to get current real picks (1 credit each).
              </Text>
              {state.data.key_products.map((p, i) => (
                <KeyProductCard
                  key={i}
                  product={p}
                  category="skincare"
                  userAnswers={answers}
                  onProductSaved={() => setSavedCount((c) => c + 1)}
                />
              ))}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Habits</Text>
              {state.data.habits.map((h, i) => (
                <View key={i} style={styles.bulletRow}>
                  <View style={styles.bulletDot} />
                  <Text style={styles.bulletText}>{h}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {photo && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Your selfie</Text>
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

function Routine({ label, steps }: { label: string; steps: string[] }) {
  return (
    <View style={[styles.card, shadow.card]}>
      <Text style={styles.cardEyebrow}>{label} routine</Text>
      {steps.map((step, i) => (
        <View key={i} style={styles.stepRow}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>{i + 1}</Text>
          </View>
          <Text style={styles.stepText}>{step}</Text>
        </View>
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
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: { ...type.caption, color: colors.primaryOn, fontWeight: '700', fontSize: 12 },
  stepText: { ...type.body, color: colors.text, flex: 1, fontSize: 14, lineHeight: 20 },
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
    aspectRatio: 1,
    borderRadius: radius.lg,
    backgroundColor: colors.bgSoft,
  },
  cta: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
