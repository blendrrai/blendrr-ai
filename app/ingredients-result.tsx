import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AlertTriangle, Check, CircleSlash, Clock, Home, Minus, ScanLine, Sparkles } from 'lucide-react-native';
import { Screen } from '../components/Screen';
import { StepHeader } from '../components/StepHeader';
import { Button } from '../components/Button';
import { AiError, AiLoading, NoCredits } from '../components/AiStatus';
import { CreditsBadge } from '../components/CreditsBadge';
import { colors, radius, shadow, spacing, type } from '../lib/theme';
import { useLook } from '../lib/state';
import {
  analyzeIngredients,
  type IngredientAnalysis,
  type IngredientRating,
  type IngredientRow,
  type IngredientVerdict,
} from '../lib/blendrr';
import { canUseCredit, saveAnalysis } from '../lib/storage';
import { consumeCreditWithPrompt } from '../lib/credits';

type State =
  | { kind: 'loading' }
  | { kind: 'ok'; data: IngredientAnalysis }
  | { kind: 'error'; message: string }
  | { kind: 'no-credits'; reason: string };

export default function IngredientsResult() {
  const { ingredientPhoto, ingredientText, resetIngredients } = useLook();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const inFlight = useRef(false);

  const run = useCallback(async () => {
    if (inFlight.current) return;
    if (!ingredientPhoto && (!ingredientText || ingredientText.trim().length === 0)) {
      setState({ kind: 'error', message: 'Add a photo or paste the ingredient list first.' });
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
      const data = await analyzeIngredients({
        photoUri: ingredientPhoto ?? undefined,
        text: ingredientText.trim() || undefined,
      });
      await consumeCreditWithPrompt();
      await saveAnalysis({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: Date.now(),
        category: 'ingredients',
        summary: `${data.score}/100 — ${data.category_guess}. ${data.summary}`,
        photoUri: ingredientPhoto ?? null,
        data,
      });
      setState({ kind: 'ok', data });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Something went wrong.';
      setState({ kind: 'error', message });
    } finally {
      inFlight.current = false;
    }
  }, [ingredientPhoto, ingredientText]);

  useEffect(() => {
    run();
  }, [run]);

  const goHistory = () => {
    Alert.alert('Saved to history', "This scan is in History. You'll be able to revisit it anytime.", [
      { text: 'OK' },
      { text: 'Open history', onPress: () => router.push('/history') },
    ]);
  };

  const backHome = () => {
    resetIngredients();
    router.dismissAll();
  };

  const scanAnother = () => {
    resetIngredients();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/ingredient-scan');
    }
  };

  return (
    <Screen>
      <View style={styles.topRow}>
        <CreditsBadge />
      </View>

      <StepHeader
        title="Ingredient score"
        subtitle="Honest breakdown of what's in there."
        onBack={backHome}
      />

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {state.kind === 'loading' && <AiLoading label="Reading the label…" />}
        {state.kind === 'error' && <AiError message={state.message} onRetry={run} />}
        {state.kind === 'no-credits' && <NoCredits reason={state.reason} />}

        {state.kind === 'ok' && <ResultBody data={state.data} />}

        <View style={styles.cta}>
          {state.kind === 'ok' && (
            <>
              <Button
                label="Scan another"
                onPress={scanAnother}
                trailing={<ScanLine size={18} color={colors.primaryOn} strokeWidth={2} />}
              />
              <Button
                label="Saved to history — view"
                onPress={goHistory}
                variant="ghost"
                trailing={<Clock size={18} color={colors.text} strokeWidth={2} />}
              />
            </>
          )}
          <Button
            label="Back to home"
            onPress={backHome}
            variant="ghost"
            leading={<Home size={18} color={colors.text} strokeWidth={2} />}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

function ResultBody({ data }: { data: IngredientAnalysis }) {
  const tone = verdictTone(data.verdict, data.score);

  return (
    <>
      <View style={[styles.scoreCard, shadow.card, { borderColor: tone.border }]}>
        <View style={styles.scoreHeader}>
          <Text style={styles.scoreEyebrow}>{data.category_guess || 'Product'}</Text>
          <View style={[styles.verdictPill, { backgroundColor: tone.pillBg }]}>
            <Text style={[styles.verdictLabel, { color: tone.pillFg }]}>{tone.label}</Text>
          </View>
        </View>
        <View style={styles.scoreRow}>
          <Text style={[styles.scoreNumber, { color: tone.scoreColor }]}>{data.score}</Text>
          <Text style={styles.scoreSlash}>/100</Text>
        </View>
        <ScoreBar score={data.score} color={tone.scoreColor} />
        <Text style={styles.scoreSummary}>{data.summary}</Text>
      </View>

      {data.highlights.length > 0 && (
        <View style={[styles.card, shadow.card]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, { backgroundColor: '#E7F8EE' }]}>
              <Sparkles size={16} color="#1F8A4C" strokeWidth={2} />
            </View>
            <Text style={styles.cardTitle}>What's working</Text>
          </View>
          {data.highlights.map((h, i) => (
            <BulletRow key={i} text={h} color="#1F8A4C" />
          ))}
        </View>
      )}

      {data.concerns.length > 0 && (
        <View style={[styles.card, shadow.card]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, { backgroundColor: '#FFEFE2' }]}>
              <AlertTriangle size={16} color="#B0541F" strokeWidth={2} />
            </View>
            <Text style={styles.cardTitle}>Worth knowing</Text>
          </View>
          {data.concerns.map((c, i) => (
            <BulletRow key={i} text={c} color="#B0541F" />
          ))}
        </View>
      )}

      {(data.good_for.length > 0 || data.not_for.length > 0) && (
        <View style={styles.sideBySide}>
          {data.good_for.length > 0 && (
            <View style={[styles.miniCard, shadow.card]}>
              <Text style={styles.miniEyebrow}>Good for</Text>
              {data.good_for.map((g, i) => (
                <Text key={i} style={styles.miniLine}>
                  · {g}
                </Text>
              ))}
            </View>
          )}
          {data.not_for.length > 0 && (
            <View style={[styles.miniCard, shadow.card]}>
              <Text style={styles.miniEyebrow}>Not for</Text>
              {data.not_for.map((g, i) => (
                <Text key={i} style={styles.miniLine}>
                  · {g}
                </Text>
              ))}
            </View>
          )}
        </View>
      )}

      {data.ingredients.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Ingredient by ingredient</Text>
          <Text style={styles.sectionHelper}>
            In INCI order — top of the list = highest concentration.
          </Text>
          {data.ingredients.map((row, i) => (
            <IngredientRowView key={`${row.name}-${i}`} row={row} />
          ))}
        </View>
      )}

      <View style={styles.disclaimerCard}>
        <Text style={styles.disclaimerText}>
          This is informational, not medical advice. If you have a known allergy or skin condition, double-check with a dermatologist.
        </Text>
      </View>
    </>
  );
}

function ScoreBar({ score, color }: { score: number; color: string }) {
  const clamped = Math.max(0, Math.min(100, score));
  return (
    <View style={styles.bar}>
      <View
        style={[
          styles.barFill,
          { width: `${clamped}%`, backgroundColor: color },
        ]}
      />
    </View>
  );
}

function BulletRow({ text, color }: { text: string; color: string }) {
  return (
    <View style={styles.bulletRow}>
      <View style={[styles.bulletDot, { backgroundColor: color }]} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

function IngredientRowView({ row }: { row: IngredientRow }) {
  const visual = useMemo(() => ratingVisual(row.rating), [row.rating]);
  const Icon = visual.Icon;
  return (
    <View style={[styles.ingRow, { borderColor: visual.border }]}>
      <View style={[styles.ingIcon, { backgroundColor: visual.iconBg }]}>
        <Icon size={14} color={visual.iconFg} strokeWidth={2.4} />
      </View>
      <View style={styles.ingText}>
        <View style={styles.ingHeader}>
          <Text style={styles.ingName} numberOfLines={1}>
            {row.name}
          </Text>
          {row.role ? <Text style={styles.ingRole}>{row.role}</Text> : null}
        </View>
        {row.note ? <Text style={styles.ingNote}>{row.note}</Text> : null}
      </View>
    </View>
  );
}

function ratingVisual(rating: IngredientRating) {
  switch (rating) {
    case 'good':
      return { Icon: Check, iconBg: '#E7F8EE', iconFg: '#1F8A4C', border: '#CDEED9' };
    case 'caution':
      return { Icon: AlertTriangle, iconBg: '#FFEFE2', iconFg: '#B0541F', border: '#F2D5BD' };
    case 'bad':
      return { Icon: CircleSlash, iconBg: '#FCE4E8', iconFg: '#A6213A', border: '#F2C3CC' };
    case 'neutral':
    default:
      return { Icon: Minus, iconBg: '#F1ECF0', iconFg: colors.textMuted, border: colors.border };
  }
}

function verdictTone(verdict: IngredientVerdict, score: number) {
  if (score <= 0) {
    return {
      label: 'Unreadable',
      pillBg: colors.bg,
      pillFg: colors.text,
      scoreColor: colors.textMuted,
      border: colors.border,
    };
  }
  switch (verdict) {
    case 'great':
      return {
        label: 'Great',
        pillBg: '#E7F8EE',
        pillFg: '#1F8A4C',
        scoreColor: '#1F8A4C',
        border: '#CDEED9',
      };
    case 'good':
      return {
        label: 'Good',
        pillBg: '#E7F8EE',
        pillFg: '#1F8A4C',
        scoreColor: '#1F8A4C',
        border: '#CDEED9',
      };
    case 'okay':
      return {
        label: 'Okay',
        pillBg: '#FFF7E1',
        pillFg: '#8A6A1B',
        scoreColor: '#8A6A1B',
        border: '#F0E3B7',
      };
    case 'concerning':
      return {
        label: 'Concerning',
        pillBg: '#FFEFE2',
        pillFg: '#B0541F',
        scoreColor: '#B0541F',
        border: '#F2D5BD',
      };
    case 'poor':
    default:
      return {
        label: 'Poor',
        pillBg: '#FCE4E8',
        pillFg: '#A6213A',
        scoreColor: '#A6213A',
        border: '#F2C3CC',
      };
  }
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: spacing.sm,
  },
  body: { flex: 1 },
  content: { paddingBottom: spacing.xxl, gap: spacing.md },
  scoreCard: {
    backgroundColor: colors.bgSoft,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1.5,
    gap: spacing.sm,
  },
  scoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scoreEyebrow: {
    ...type.eyebrow,
    color: colors.textMuted,
  },
  verdictPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  verdictLabel: { ...type.caption, fontSize: 12, fontWeight: '700' },
  scoreRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  scoreNumber: { fontSize: 64, fontWeight: '800', letterSpacing: -2 },
  scoreSlash: {
    ...type.heading,
    color: colors.textFaint,
    fontSize: 22,
    paddingBottom: 12,
  },
  bar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  scoreSummary: {
    ...type.body,
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    marginTop: spacing.xs,
  },
  card: {
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  cardIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { ...type.heading, fontSize: 16, color: colors.text },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: 2,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 8,
  },
  bulletText: { ...type.body, fontSize: 14, color: colors.text, flex: 1, lineHeight: 20 },
  sideBySide: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  miniCard: {
    flex: 1,
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  miniEyebrow: {
    ...type.eyebrow,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  miniLine: { ...type.body, color: colors.text, fontSize: 13, lineHeight: 19 },
  section: { gap: spacing.sm },
  sectionLabel: { ...type.eyebrow, color: colors.textMuted },
  sectionHelper: {
    ...type.caption,
    color: colors.textFaint,
    lineHeight: 17,
    fontSize: 12,
    marginBottom: spacing.xs,
  },
  ingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.bgSoft,
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
  },
  ingIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  ingText: { flex: 1, gap: 2 },
  ingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ingName: {
    ...type.heading,
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  ingRole: {
    ...type.caption,
    color: colors.textFaint,
    fontSize: 11,
  },
  ingNote: {
    ...type.body,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  disclaimerCard: {
    backgroundColor: colors.bgSoft,
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  disclaimerText: {
    ...type.caption,
    color: colors.textFaint,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
  cta: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
