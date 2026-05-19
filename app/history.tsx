import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ArrowRight, Droplet, Flower2, RotateCcw, ScanLine, ShieldCheck, Sparkles, Wind } from 'lucide-react-native';
import { Screen } from '../components/Screen';
import { StepHeader } from '../components/StepHeader';
import { colors, radius, shadow, spacing, type, zoneLabels } from '../lib/theme';
import { useLook } from '../lib/state';
import {
  loadAnalyses,
  loadHistory,
  type AnalysisCategory,
  type AnalysisRecord,
  type TryOn,
} from '../lib/storage';
import type { ComponentType } from 'react';

type Tab = 'try-ons' | 'analyses';

export default function HistoryScreen() {
  const { setSelfie, setProduct, setZone } = useLook();
  const [tryOns, setTryOns] = useState<TryOn[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisRecord[]>([]);
  const [tab, setTab] = useState<Tab>('try-ons');

  const reuseShade = (item: TryOn) => {
    Alert.alert(
      `${zoneLabels[item.zone]} try-on`,
      'Reuse this shade on a new selfie?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Try again',
          onPress: () => {
            setSelfie(null);
            setProduct(item.productUri, item.productUrl);
            setZone(item.zone);
            router.push('/selfie');
          },
        },
      ],
    );
  };

  const refresh = useCallback(() => {
    loadHistory().then(setTryOns);
    loadAnalyses().then(setAnalyses);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const isTryOns = tab === 'try-ons';
  const isEmpty = isTryOns ? tryOns.length === 0 : analyses.length === 0;

  return (
    <Screen>
      <StepHeader title="History" subtitle="Everything Blendrr has made for you, kept on this phone." />

      <View style={styles.tabs}>
        <TabBtn
          label={`Try-ons${tryOns.length ? ` (${tryOns.length})` : ''}`}
          active={tab === 'try-ons'}
          onPress={() => setTab('try-ons')}
        />
        <TabBtn
          label={`Analyses${analyses.length ? ` (${analyses.length})` : ''}`}
          active={tab === 'analyses'}
          onPress={() => setTab('analyses')}
        />
      </View>

      {isEmpty ? (
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, shadow.card]}>
            <Sparkles size={30} color={colors.primary} strokeWidth={1.6} />
          </View>
          <Text style={styles.emptyTitle}>
            {isTryOns ? 'No try-ons yet' : 'No analyses yet'}
          </Text>
          <Text style={styles.emptyBody}>
            {isTryOns
              ? 'Pick a selfie, drop a product, and your try-ons will live here.'
              : 'Take a routine quiz or scan an ingredient list and your results will land here.'}
          </Text>

          {isTryOns ? (
            <Pressable
              onPress={() => router.push('/selfie')}
              style={styles.emptyCta}
            >
              <Text style={styles.emptyCtaLabel}>Start a try-on</Text>
              <ArrowRight size={16} color={colors.primaryOn} strokeWidth={2.4} />
            </Pressable>
          ) : (
            <View style={styles.emptyQuizRow}>
              <EmptyQuizChip
                Icon={Droplet}
                label="Skin"
                onPress={() => router.push('/skincare-quiz')}
              />
              <EmptyQuizChip
                Icon={Wind}
                label="Hair"
                onPress={() => router.push('/haircare-quiz')}
              />
              <EmptyQuizChip
                Icon={Flower2}
                label="Scent"
                onPress={() => router.push('/fragrance-quiz')}
              />
              <EmptyQuizChip
                Icon={ScanLine}
                label="Scan"
                onPress={() => router.push('/ingredients')}
              />
            </View>
          )}
        </View>
      ) : isTryOns ? (
        <FlatList
          data={tryOns}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <TryOnRow item={item} onReuse={() => reuseShade(item)} />}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={analyses}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <AnalysisRow item={item} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}

function TabBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Text
      onPress={onPress}
      style={[styles.tabBtn, active && styles.tabBtnActive]}
    >
      {label}
    </Text>
  );
}

function TryOnRow({ item, onReuse }: { item: TryOn; onReuse: () => void }) {
  const preview = item.resultUri ?? item.selfieUri;
  return (
    <Pressable onPress={onReuse} style={[styles.row, shadow.card]}>
      <Image source={{ uri: preview }} style={styles.rowImage} />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{zoneLabels[item.zone]} try-on</Text>
        <Text style={styles.rowDate}>{formatDate(item.createdAt)}</Text>
      </View>
      <View style={styles.reuseBtn}>
        <RotateCcw size={14} color={colors.text} strokeWidth={2} />
        <Text style={styles.reuseLabel}>Reuse</Text>
      </View>
    </Pressable>
  );
}

function EmptyQuizChip({
  Icon,
  label,
  onPress,
}: {
  Icon: ComponentType<{ size: number; color: string; strokeWidth: number }>;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.emptyQuizChip}>
      <Icon size={20} color={colors.text} strokeWidth={1.8} />
      <Text style={styles.emptyQuizLabel}>{label}</Text>
    </Pressable>
  );
}

const ANALYSIS_ICON: Record<AnalysisCategory, ComponentType<{ size: number; color: string; strokeWidth: number }>> = {
  skincare: Droplet,
  haircare: Wind,
  fragrance: Flower2,
  acne: ShieldCheck,
  ingredients: ScanLine,
};

const ANALYSIS_LABEL: Record<AnalysisCategory, string> = {
  skincare: 'Skincare analysis',
  haircare: 'Haircare analysis',
  fragrance: 'Fragrance picks',
  acne: 'Acne plan',
  ingredients: 'Ingredient scan',
};

function AnalysisRow({ item }: { item: AnalysisRecord }) {
  const Icon = ANALYSIS_ICON[item.category];
  return (
    <View style={[styles.row, shadow.card]}>
      {item.photoUri ? (
        <Image source={{ uri: item.photoUri }} style={styles.rowImage} />
      ) : (
        <View style={[styles.rowImage, styles.rowIconBg]}>
          <Icon size={22} color={colors.text} strokeWidth={1.8} />
        </View>
      )}
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{ANALYSIS_LABEL[item.category]}</Text>
        <Text style={styles.rowSummary} numberOfLines={2}>
          {item.summary}
        </Text>
        <Text style={styles.rowDate}>{formatDate(item.createdAt)}</Text>
      </View>
    </View>
  );
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  tabBtn: {
    ...type.caption,
    color: colors.text,
    fontWeight: '600',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  tabBtnActive: {
    backgroundColor: colors.primary,
    color: colors.primaryOn,
    borderColor: colors.primary,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  emptyTitle: { ...type.title, color: colors.text },
  emptyBody: {
    ...type.body,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 22,
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    marginTop: spacing.md,
  },
  emptyCtaLabel: { ...type.heading, fontSize: 15, color: colors.primaryOn },
  emptyQuizRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  emptyQuizChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  emptyQuizLabel: { ...type.caption, color: colors.text, fontWeight: '600' },
  reuseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reuseLabel: { ...type.caption, color: colors.text, fontWeight: '600', fontSize: 11 },
  list: { paddingBottom: spacing.xxl, gap: spacing.md },
  row: {
    flexDirection: 'row',
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  rowImage: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
  },
  rowIconBg: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowText: { flex: 1, gap: 4 },
  rowTitle: { ...type.heading, fontSize: 16, color: colors.text },
  rowSummary: { ...type.body, fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  rowDate: { ...type.caption, color: colors.textFaint },
});
