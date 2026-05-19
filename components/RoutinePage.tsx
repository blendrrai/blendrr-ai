import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ChevronRight, Sparkles } from 'lucide-react-native';
import { Screen } from './Screen';
import { StepHeader } from './StepHeader';
import { ProductCard } from './ProductCard';
import { AddProductForm } from './AddProductForm';
import { colors, radius, shadow, spacing, type } from '../lib/theme';
import {
  deleteWishlistItem,
  loadRoutineAnswers,
  loadRoutinePhoto,
  loadRoutineTimestamp,
  loadWishlist,
  saveWishlistItem,
  type RoutineCategory,
  type WishlistItem,
} from '../lib/storage';
import type { Answers } from './Questionnaire';

type Props = {
  category: RoutineCategory;
  title: string;
  subtitle: string;
  quizRoute: string;
  labels: Record<string, string>;
  emptyQuizPrompt: string;
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function RoutinePage({
  category,
  title,
  subtitle,
  quizRoute,
  labels,
  emptyQuizPrompt,
}: Props) {
  const [answers, setAnswers] = useState<Answers | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [completedAt, setCompletedAt] = useState<number | null>(null);
  const [items, setItems] = useState<WishlistItem[]>([]);

  const refresh = useCallback(async () => {
    const [a, p, t, w] = await Promise.all([
      loadRoutineAnswers(category),
      loadRoutinePhoto(category),
      loadRoutineTimestamp(category),
      loadWishlist(),
    ]);
    setAnswers(a);
    setPhoto(p);
    setCompletedAt(t);
    setItems(w.filter((i) => i.category === category));
  }, [category]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const onAdd = async (item: WishlistItem) => {
    await saveWishlistItem(item);
    refresh();
  };

  const onDelete = async (id: string) => {
    await deleteWishlistItem(id);
    refresh();
  };

  return (
    <Screen>
      <StepHeader title={title} subtitle={subtitle} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        {answers ? (
          <View style={[styles.card, shadow.card]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardEyebrow}>Quiz snapshot</Text>
              {completedAt && <Text style={styles.cardDate}>{formatDate(completedAt)}</Text>}
            </View>

            {photo && (
              <Image source={{ uri: photo }} style={styles.photo} resizeMode="cover" />
            )}

            <View style={styles.answersList}>
              {Object.entries(answers).map(([key, value]) => (
                <View key={key} style={styles.answerRow}>
                  <Text style={styles.answerKey}>{labels[key] ?? key}</Text>
                  <Text style={styles.answerValue}>
                    {Array.isArray(value) ? value.join(', ') : value}
                  </Text>
                </View>
              ))}
            </View>

            <Pressable
              onPress={() => router.push(quizRoute as never)}
              style={styles.retakeBtn}
            >
              <Text style={styles.retakeLabel}>Retake quiz</Text>
              <ChevronRight size={16} color={colors.text} strokeWidth={2} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => router.push(quizRoute as never)}
            style={[styles.emptyQuiz, shadow.card]}
          >
            <View style={styles.emptyIcon}>
              <Sparkles size={24} color={colors.primary} strokeWidth={1.8} />
            </View>
            <View style={styles.emptyText}>
              <Text style={styles.emptyTitle}>Take the quiz</Text>
              <Text style={styles.emptyBody}>{emptyQuizPrompt}</Text>
            </View>
            <ChevronRight size={20} color={colors.textFaint} strokeWidth={2} />
          </Pressable>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Shopping list</Text>
          <Text style={styles.sectionHelper}>Things you want to buy for this routine.</Text>
        </View>

        <AddProductForm category={category} onAdd={onAdd} />

        {items.map((item) => (
          <ProductCard key={item.id} item={item} onDelete={onDelete} />
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl, gap: spacing.md },
  card: {
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardEyebrow: { ...type.eyebrow, color: colors.textMuted },
  cardDate: { ...type.caption, color: colors.textFaint },
  photo: {
    width: '100%',
    aspectRatio: 1.6,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
  },
  answersList: { gap: 6 },
  answerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  answerKey: { ...type.caption, color: colors.textMuted, flex: 1 },
  answerValue: {
    ...type.body,
    color: colors.text,
    fontSize: 14,
    flex: 2,
    textAlign: 'right',
  },
  retakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retakeLabel: { ...type.caption, color: colors.text, fontWeight: '500' },
  emptyQuiz: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: { flex: 1, gap: 2 },
  emptyTitle: { ...type.heading, fontSize: 16, color: colors.text },
  emptyBody: { ...type.caption, color: colors.textMuted },
  section: { gap: 4, marginTop: spacing.md },
  sectionLabel: { ...type.eyebrow, color: colors.textMuted },
  sectionHelper: { ...type.caption, color: colors.textFaint },
});
