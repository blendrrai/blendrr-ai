import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeInRight,
  FadeOutLeft,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { ArrowRight, Check, X } from 'lucide-react-native';
import { Button } from './Button';
import { colors, radius, shadow, spacing, type } from '../lib/theme';

export type Option = {
  value: string;
  label: string;
  helper?: string;
};

export type Question = {
  id: string;
  label: string;
  helper?: string;
  type: 'single' | 'multi';
  options: Option[];
};

export type Answers = Record<string, string | string[]>;

type Props = {
  title: string;
  questions: Question[];
  onComplete: (answers: Answers) => void;
};

export function Questionnaire({ title, questions, onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});

  const total = questions.length;
  const question = questions[step];
  const isLast = step === total - 1;

  const progress = useSharedValue((step + 1) / total);
  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const current = answers[question.id];
  const canContinue = useMemo(() => {
    if (question.type === 'single') return typeof current === 'string' && current.length > 0;
    return Array.isArray(current) && current.length > 0;
  }, [current, question]);

  const setSingle = (value: string) => {
    setAnswers((a) => ({ ...a, [question.id]: value }));
  };

  const toggleMulti = (value: string) => {
    setAnswers((a) => {
      const prev = (a[question.id] as string[] | undefined) ?? [];
      const next = prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value];
      return { ...a, [question.id]: next };
    });
  };

  const next = () => {
    if (!canContinue) return;
    if (isLast) {
      onComplete(answers);
      return;
    }
    const newStep = step + 1;
    progress.value = withTiming((newStep + 1) / total, { duration: 280 });
    setStep(newStep);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.close}>
          <X size={20} color={colors.text} strokeWidth={2} />
        </Pressable>
        <Text style={styles.stepLabel}>
          {step + 1} of {total}
        </Text>
      </View>

      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, progressStyle]} />
      </View>

      <Text style={styles.eyebrow}>{title}</Text>

      <Animated.View
        key={question.id}
        entering={FadeInRight.duration(260)}
        exiting={FadeOutLeft.duration(180)}
        style={styles.questionWrap}
      >
        <Text style={styles.questionText}>{question.label}</Text>
        {question.helper && <Text style={styles.questionHelper}>{question.helper}</Text>}

        <ScrollView
          style={styles.options}
          contentContainerStyle={styles.optionsContent}
          showsVerticalScrollIndicator={false}
        >
          {question.options.map((opt) => {
            const selected =
              question.type === 'single'
                ? current === opt.value
                : Array.isArray(current) && current.includes(opt.value);
            return (
              <OptionRow
                key={opt.value}
                option={opt}
                selected={selected}
                multi={question.type === 'multi'}
                onPress={() =>
                  question.type === 'single' ? setSingle(opt.value) : toggleMulti(opt.value)
                }
              />
            );
          })}
        </ScrollView>
      </Animated.View>

      <View style={styles.cta} pointerEvents="box-none">
        <View style={styles.ctaInner}>
          <Button
            label={isLast ? 'See recommendation' : 'Continue'}
            onPress={next}
            disabled={!canContinue}
            trailing={<ArrowRight size={20} color={colors.primaryOn} strokeWidth={2.4} />}
          />
        </View>
      </View>
    </View>
  );
}

function OptionRow({
  option,
  selected,
  multi,
  onPress,
}: {
  option: Option;
  selected: boolean;
  multi: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.98, { damping: 18, stiffness: 260 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 14, stiffness: 220 });
      }}
      style={[styles.option, selected && styles.optionSelected, animStyle]}
    >
      <View style={styles.optionText}>
        <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
          {option.label}
        </Text>
        {option.helper && <Text style={styles.optionHelper}>{option.helper}</Text>}
      </View>
      <View style={[styles.checkbox, selected && styles.checkboxSelected, !multi && styles.radio]}>
        {selected && <Check size={14} color={colors.primaryOn} strokeWidth={3} />}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bgSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepLabel: { ...type.caption, color: colors.textMuted },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.bgSoft,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  eyebrow: { ...type.eyebrow, color: colors.textMuted, marginBottom: spacing.sm },
  questionWrap: { flex: 1 },
  questionText: { ...type.title, color: colors.text },
  questionHelper: {
    ...type.body,
    color: colors.textMuted,
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  options: { flex: 1, marginTop: spacing.lg },
  optionsContent: { gap: spacing.sm, paddingBottom: 110 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    ...shadow.card,
    shadowOpacity: 0.04,
  },
  optionSelected: {
    borderColor: colors.primary,
  },
  optionText: { flex: 1 },
  optionLabel: { ...type.heading, fontSize: 16, color: colors.text },
  optionLabelSelected: { color: colors.text },
  optionHelper: { ...type.caption, color: colors.textFaint, marginTop: 2 },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.md,
  },
  radio: { borderRadius: 13 },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  cta: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: spacing.lg,
  },
  ctaInner: {
    paddingHorizontal: 0,
  },
});
