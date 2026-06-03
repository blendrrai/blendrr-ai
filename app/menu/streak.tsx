import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Flame, Sparkles, TrendingUp } from 'lucide-react-native';
import { Screen } from '../../components/Screen';
import { StepHeader } from '../../components/StepHeader';
import { colors, radius, shadow, spacing, type } from '../../lib/theme';
import {
  getCurrentStreak,
  loadGlow,
  subscribeGlow,
  toLocalDateStr,
  type GlowState,
} from '../../lib/glow';

const GRID_DAYS = 28; // 4 weeks back

export default function StreakScreen() {
  const [state, setState] = useState<GlowState | null>(null);

  useEffect(() => {
    loadGlow().then(setState);
    return subscribeGlow(setState);
  }, []);

  const current = state ? getCurrentStreak(state) : 0;
  const longest = state?.streakLongest ?? 0;
  const totalActiveDays = state?.history.filter((d) => d.completedTaskIds.length > 0).length ?? 0;

  const grid = useMemo(() => buildGrid(state), [state]);

  return (
    <Screen>
      <StepHeader
        title="Streak"
        subtitle="Tick at least one task every day to keep your streak alive."
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroCard, shadow.card]}>
          <View style={styles.heroIconWrap}>
            <Flame size={32} color={colors.primaryOn} strokeWidth={1.8} />
          </View>
          <Text style={styles.heroEyebrow}>CURRENT STREAK</Text>
          <Text style={styles.heroValue}>
            {current} <Text style={styles.heroUnit}>day{current === 1 ? '' : 's'}</Text>
          </Text>
          <Text style={styles.heroHint}>
            {current === 0
              ? 'Tick a task today to start your streak.'
              : current === 1
              ? "You're on day one — come back tomorrow to keep it going."
              : `Keep the chain alive — don't skip tomorrow.`}
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, shadow.card]}>
            <TrendingUp size={18} color={colors.text} strokeWidth={1.8} />
            <Text style={styles.statValue}>{longest}</Text>
            <Text style={styles.statLabel}>Longest streak</Text>
          </View>
          <View style={[styles.statCard, shadow.card]}>
            <Sparkles size={18} color={colors.text} strokeWidth={1.8} />
            <Text style={styles.statValue}>{totalActiveDays}</Text>
            <Text style={styles.statLabel}>Active days total</Text>
          </View>
        </View>

        <View style={[styles.calendarCard, shadow.card]}>
          <Text style={styles.calendarTitle}>Last 4 weeks</Text>
          <Text style={styles.calendarSub}>Each square is one day — filled means you ticked a task.</Text>
          <View style={styles.calendarGrid}>
            {grid.map((d) => (
              <View
                key={d.date}
                style={[
                  styles.cell,
                  d.active && styles.cellActive,
                  d.isToday && styles.cellToday,
                ]}
              />
            ))}
          </View>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.cell, styles.cellActive, styles.legendCell]} />
              <Text style={styles.legendLabel}>Active</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.cell, styles.legendCell]} />
              <Text style={styles.legendLabel}>Missed</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.cell, styles.cellToday, styles.legendCell]} />
              <Text style={styles.legendLabel}>Today</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

type GridCell = { date: string; active: boolean; isToday: boolean };

function buildGrid(state: GlowState | null): GridCell[] {
  const today = toLocalDateStr();
  const activeSet = new Set(
    state?.history.filter((d) => d.completedTaskIds.length > 0).map((d) => d.date) ?? [],
  );
  const cells: GridCell[] = [];
  const todayDate = new Date();
  for (let i = GRID_DAYS - 1; i >= 0; i--) {
    const d = new Date(todayDate);
    d.setDate(d.getDate() - i);
    const dateStr = toLocalDateStr(d);
    cells.push({
      date: dateStr,
      active: activeSet.has(dateStr),
      isToday: dateStr === today,
    });
  }
  return cells;
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl, gap: spacing.md },
  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    gap: 6,
  },
  heroIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    marginBottom: spacing.sm,
  },
  heroEyebrow: { ...type.eyebrow, color: 'rgba(255,255,255,0.75)', fontSize: 10 },
  heroValue: { ...type.display, color: colors.primaryOn, fontSize: 56, lineHeight: 60 },
  heroUnit: { fontSize: 18, fontWeight: '500' },
  heroHint: {
    ...type.body,
    color: 'rgba(255,255,255,0.88)',
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statCard: {
    flex: 1,
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { ...type.title, color: colors.text, fontSize: 22 },
  statLabel: { ...type.caption, color: colors.textMuted, textAlign: 'center' },
  calendarCard: {
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  calendarTitle: { ...type.heading, fontSize: 15, color: colors.text },
  calendarSub: { ...type.caption, color: colors.textMuted, lineHeight: 18 },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.xs,
  },
  cell: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cellActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  cellToday: { borderWidth: 2, borderColor: colors.text },
  legendRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
    justifyContent: 'center',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendCell: { width: 14, height: 14, borderRadius: 4 },
  legendLabel: { ...type.caption, color: colors.textMuted, fontSize: 12 },
});
