import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import {
  Check,
  Flame,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Trophy,
  X,
} from 'lucide-react-native';
import { Screen } from '../../components/Screen';
import { StepHeader } from '../../components/StepHeader';
import { colors, radius, shadow, spacing, type } from '../../lib/theme';
import {
  ACHIEVEMENTS,
  addCustomTask,
  getCurrentStreak,
  getTodayCompletedIds,
  getTodayMaxScore,
  getTodayScore,
  loadGlow,
  removeTask,
  subscribeGlow,
  tickTask,
  untickTask,
  type GlowState,
  type GlowTask,
} from '../../lib/glow';

export default function GlowScreen() {
  const [state, setState] = useState<GlowState | null>(null);
  const [addingOpen, setAddingOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newPoints, setNewPoints] = useState('10');

  useEffect(() => {
    loadGlow().then(setState);
    return subscribeGlow(setState);
  }, []);

  const todayDone = useMemo(() => new Set(state ? getTodayCompletedIds(state) : []), [state]);
  const score = state ? getTodayScore(state) : 0;
  const maxScore = state ? getTodayMaxScore(state) : 0;
  const streak = state ? getCurrentStreak(state) : 0;
  const unlockedCount = state?.achievements.length ?? 0;

  const onToggleTask = useCallback(
    async (taskId: string) => {
      if (todayDone.has(taskId)) {
        await untickTask(taskId);
      } else {
        await tickTask(taskId);
      }
    },
    [todayDone],
  );

  const onAddTask = useCallback(async () => {
    const label = newLabel.trim();
    if (!label) {
      Alert.alert('Add a label', 'Give your task a short name first.');
      return;
    }
    const points = parseInt(newPoints, 10);
    await addCustomTask(label, Number.isFinite(points) ? points : 10);
    setNewLabel('');
    setNewPoints('10');
    setAddingOpen(false);
  }, [newLabel, newPoints]);

  const onRemoveTask = useCallback((task: GlowTask) => {
    Alert.alert(
      'Remove task?',
      `Remove "${task.label}" from your daily list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeTask(task.id),
        },
      ],
    );
  }, []);

  const progressPct = maxScore > 0 ? Math.min(100, Math.round((score / maxScore) * 100)) : 0;

  return (
    <Screen>
      <StepHeader
        title="Glow Score"
        subtitle="Tick off your daily rituals to grow your glow."
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.scoreCard, shadow.card]}>
          <View style={styles.scoreRow}>
            <View style={styles.scoreIconWrap}>
              <Sparkles size={24} color={colors.primaryOn} strokeWidth={1.8} />
            </View>
            <View style={styles.scoreText}>
              <Text style={styles.scoreEyebrow}>TODAY</Text>
              <Text style={styles.scoreValue}>{score}</Text>
              <Text style={styles.scoreSub}>of {maxScore} possible</Text>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>

          <View style={styles.statsRow}>
            <StatChip icon={Flame} label={`${streak}-day streak`} />
            <StatChip icon={Trophy} label={`${unlockedCount}/${ACHIEVEMENTS.length} unlocked`} />
          </View>
        </View>

        <View style={styles.tasksHeader}>
          <Text style={styles.tasksTitle}>Daily tasks</Text>
          <View style={styles.tasksHeaderActions}>
            <Pressable
              onPress={() => setEditing((v) => !v)}
              style={[styles.iconBtn, editing && styles.iconBtnActive]}
              hitSlop={10}
            >
              {editing ? (
                <Check size={16} color={colors.primaryOn} strokeWidth={2.4} />
              ) : (
                <Pencil size={14} color={colors.text} strokeWidth={2.2} />
              )}
              <Text style={[styles.iconBtnLabel, editing && styles.iconBtnLabelActive]}>
                {editing ? 'Done' : 'Edit'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setAddingOpen((v) => !v)}
              style={styles.iconBtn}
              hitSlop={10}
            >
              {addingOpen ? (
                <X size={16} color={colors.text} strokeWidth={2.2} />
              ) : (
                <Plus size={16} color={colors.text} strokeWidth={2.2} />
              )}
              <Text style={styles.iconBtnLabel}>{addingOpen ? 'Cancel' : 'Add'}</Text>
            </Pressable>
          </View>
        </View>

        {addingOpen && (
          <View style={[styles.addCard, shadow.card]}>
            <Text style={styles.addLabel}>Task name</Text>
            <TextInput
              value={newLabel}
              onChangeText={setNewLabel}
              placeholder="e.g. Read for 20 minutes"
              placeholderTextColor={colors.textFaint}
              style={styles.addInput}
              autoFocus
              maxLength={60}
            />
            <Text style={styles.addLabel}>Points (1–50)</Text>
            <TextInput
              value={newPoints}
              onChangeText={(t) => setNewPoints(t.replace(/[^0-9]/g, '').slice(0, 2))}
              placeholder="10"
              placeholderTextColor={colors.textFaint}
              style={styles.addInput}
              keyboardType="number-pad"
              maxLength={2}
            />
            <Pressable onPress={onAddTask} style={styles.addSave}>
              <Text style={styles.addSaveLabel}>Save task</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.taskList}>
          {state?.tasks.map((t) => {
            const done = todayDone.has(t.id);
            return (
              <Pressable
                key={t.id}
                onPress={() => {
                  if (editing) {
                    onRemoveTask(t);
                  } else {
                    onToggleTask(t.id);
                  }
                }}
                style={[styles.taskRow, done && !editing && styles.taskRowDone, shadow.card]}
              >
                {editing ? (
                  <View style={[styles.checkbox, styles.checkboxRemove]}>
                    <Trash2 size={14} color={colors.primaryOn} strokeWidth={2.4} />
                  </View>
                ) : (
                  <View style={[styles.checkbox, done && styles.checkboxDone]}>
                    {done && <Check size={14} color={colors.primaryOn} strokeWidth={3} />}
                  </View>
                )}
                <View style={styles.taskText}>
                  <Text style={[styles.taskLabel, done && !editing && styles.taskLabelDone]}>
                    {t.label}
                  </Text>
                  <Text style={styles.taskPoints}>
                    +{t.points} pts{t.isDefault ? '' : ' · Custom'}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {editing && (
          <Text style={styles.editHint}>Tap any task to remove it from your daily list.</Text>
        )}

        <View style={[styles.hintCard, shadow.card]}>
          <Text style={styles.hintTitle}>How Glow Score works</Text>
          <Text style={styles.hintBody}>
            Your score resets at midnight, but your streak keeps building as long as you tick at
            least one task per day. Tap Edit to remove tasks, or Add to create your own.
          </Text>
          <Pressable onPress={() => router.push('/menu/achievements')} style={styles.hintCta}>
            <Text style={styles.hintCtaLabel}>See achievements</Text>
            <Trophy size={14} color={colors.text} strokeWidth={2} />
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

function StatChip({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
  label: string;
}) {
  return (
    <View style={styles.statChip}>
      <Icon size={13} color={colors.primaryOn} strokeWidth={2} />
      <Text style={styles.statChipLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl, gap: spacing.md },
  scoreCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  scoreIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  scoreText: { flex: 1, gap: 2 },
  scoreEyebrow: { ...type.eyebrow, color: 'rgba(255,255,255,0.75)', fontSize: 10 },
  scoreValue: { ...type.display, color: colors.primaryOn, fontSize: 44, lineHeight: 48 },
  scoreSub: { ...type.caption, color: 'rgba(255,255,255,0.8)' },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },
  progressFill: { height: 8, backgroundColor: colors.primaryOn, borderRadius: 4 },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  statChipLabel: { ...type.caption, color: colors.primaryOn, fontSize: 11, fontWeight: '600' },
  tasksHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tasksHeaderActions: { flexDirection: 'row', gap: spacing.xs },
  tasksTitle: { ...type.heading, fontSize: 16, color: colors.text },
  iconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  iconBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  iconBtnLabel: { ...type.caption, color: colors.text, fontWeight: '600' },
  iconBtnLabelActive: { color: colors.primaryOn },
  editHint: {
    ...type.caption,
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 12,
    paddingHorizontal: spacing.md,
  },
  addCard: {
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  addLabel: { ...type.caption, color: colors.textMuted, fontWeight: '600' },
  addInput: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    ...type.body,
    color: colors.text,
    fontSize: 14,
  },
  addSave: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    marginTop: spacing.xs,
  },
  addSaveLabel: { ...type.heading, fontSize: 14, color: colors.primaryOn },
  taskList: { gap: spacing.sm },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  taskRowDone: { backgroundColor: colors.bg, borderColor: colors.borderStrong },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  checkboxDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxRemove: { backgroundColor: '#D14A4A', borderColor: '#D14A4A' },
  taskText: { flex: 1, gap: 2 },
  taskLabel: { ...type.body, fontSize: 14, color: colors.text, fontWeight: '500' },
  taskLabelDone: { color: colors.textMuted, textDecorationLine: 'line-through' },
  taskPoints: { ...type.caption, color: colors.textFaint, fontSize: 11 },
  hintCard: {
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  hintTitle: { ...type.heading, fontSize: 13, color: colors.text },
  hintBody: { ...type.caption, color: colors.textMuted, lineHeight: 18 },
  hintCta: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  hintCtaLabel: { ...type.caption, color: colors.text, fontWeight: '600' },
});
