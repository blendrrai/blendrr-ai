import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Award, Droplet, Flame, Lock, Sparkles, Trophy, Wand2 } from 'lucide-react-native';
import { Screen } from '../../components/Screen';
import { StepHeader } from '../../components/StepHeader';
import { colors, radius, shadow, spacing, type } from '../../lib/theme';
import {
  ACHIEVEMENTS,
  checkAchievements,
  loadGlow,
  subscribeGlow,
  type Achievement,
  type AchievementCategory,
  type GlowState,
} from '../../lib/glow';

const CATEGORY_META: Record<AchievementCategory, {
  label: string;
  icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
}> = {
  'try-on':  { label: 'Try-ons',     icon: Wand2 },
  glow:      { label: 'Glow Score',  icon: Sparkles },
  streak:    { label: 'Streak',      icon: Flame },
  routine:   { label: 'Routines',    icon: Droplet },
  misc:      { label: 'Other',       icon: Award },
};

const ORDER: AchievementCategory[] = ['try-on', 'glow', 'streak', 'routine', 'misc'];

export default function AchievementsScreen() {
  const [state, setState] = useState<GlowState | null>(null);

  useEffect(() => {
    // Recompute on mount in case external events (try-on completes) added
    // achievements that haven't been reflected yet.
    checkAchievements().then(() => loadGlow().then(setState));
    return subscribeGlow(setState);
  }, []);

  const unlockedSet = useMemo(
    () => new Set(state?.achievements.map((a) => a.id) ?? []),
    [state],
  );
  const unlockedCount = unlockedSet.size;
  const totalCount = ACHIEVEMENTS.length;

  const byCategory = useMemo(() => {
    const groups: Record<AchievementCategory, Achievement[]> = {
      'try-on': [], glow: [], streak: [], routine: [], misc: [],
    };
    for (const a of ACHIEVEMENTS) groups[a.category].push(a);
    return groups;
  }, []);

  return (
    <Screen>
      <StepHeader
        title="Achievements"
        subtitle={`${unlockedCount} of ${totalCount} unlocked.`}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.summaryCard, shadow.card]}>
          <View style={styles.summaryIconWrap}>
            <Trophy size={28} color={colors.primaryOn} strokeWidth={1.8} />
          </View>
          <View style={styles.summaryText}>
            <Text style={styles.summaryEyebrow}>YOUR PROGRESS</Text>
            <Text style={styles.summaryTitle}>
              {unlockedCount} / {totalCount}
            </Text>
            <View style={styles.summaryBarTrack}>
              <View
                style={[
                  styles.summaryBarFill,
                  { width: `${Math.round((unlockedCount / totalCount) * 100)}%` },
                ]}
              />
            </View>
          </View>
        </View>

        {ORDER.map((cat) => {
          const meta = CATEGORY_META[cat];
          const list = byCategory[cat];
          const catUnlocked = list.filter((a) => unlockedSet.has(a.id)).length;
          const Icon = meta.icon;
          return (
            <View key={cat} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Icon size={16} color={colors.text} strokeWidth={2} />
                <Text style={styles.sectionTitle}>{meta.label}</Text>
                <Text style={styles.sectionCount}>
                  {catUnlocked}/{list.length}
                </Text>
              </View>
              <View style={styles.grid}>
                {list.map((a) => (
                  <AchievementCard
                    key={a.id}
                    achievement={a}
                    unlocked={unlockedSet.has(a.id)}
                  />
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

function AchievementCard({
  achievement,
  unlocked,
}: {
  achievement: Achievement;
  unlocked: boolean;
}) {
  return (
    <View
      style={[
        styles.card,
        shadow.card,
        unlocked ? styles.cardUnlocked : styles.cardLocked,
      ]}
    >
      <View
        style={[
          styles.cardIcon,
          unlocked ? styles.cardIconUnlocked : styles.cardIconLocked,
        ]}
      >
        {unlocked ? (
          <Award size={20} color={colors.primaryOn} strokeWidth={1.8} />
        ) : (
          <Lock size={16} color={colors.textFaint} strokeWidth={2} />
        )}
      </View>
      <Text style={[styles.cardTitle, !unlocked && styles.cardTitleLocked]} numberOfLines={1}>
        {achievement.title}
      </Text>
      <Text style={styles.cardDesc} numberOfLines={2}>
        {achievement.desc}
      </Text>
      <Text style={styles.cardPoints}>+{achievement.bonusPoints} pts</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl, gap: spacing.lg },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  summaryIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  summaryText: { flex: 1, gap: 6 },
  summaryEyebrow: { ...type.eyebrow, color: 'rgba(255,255,255,0.75)', fontSize: 10 },
  summaryTitle: { ...type.title, color: colors.primaryOn, fontSize: 26 },
  summaryBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },
  summaryBarFill: { height: 6, backgroundColor: colors.primaryOn, borderRadius: 3 },
  section: { gap: spacing.sm },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: 2,
  },
  sectionTitle: { ...type.heading, fontSize: 15, color: colors.text, flex: 1 },
  sectionCount: { ...type.caption, color: colors.textFaint, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: {
    width: '48%',
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    gap: 6,
  },
  cardUnlocked: { borderColor: colors.borderStrong },
  cardLocked: { borderColor: colors.border, opacity: 0.7 },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  cardIconUnlocked: { backgroundColor: colors.primary },
  cardIconLocked: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.borderStrong },
  cardTitle: { ...type.heading, fontSize: 14, color: colors.text },
  cardTitleLocked: { color: colors.textMuted },
  cardDesc: { ...type.caption, color: colors.textMuted, fontSize: 12, lineHeight: 16 },
  cardPoints: { ...type.caption, color: colors.primary, fontSize: 11, fontWeight: '700', marginTop: 2 },
});
