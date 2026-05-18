import { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Sparkles } from 'lucide-react-native';
import { Screen } from '../components/Screen';
import { StepHeader } from '../components/StepHeader';
import { colors, radius, shadow, spacing, type, zoneLabels } from '../lib/theme';
import { loadHistory, type TryOn } from '../lib/storage';

export default function HistoryScreen() {
  const [items, setItems] = useState<TryOn[]>([]);

  const refresh = useCallback(() => {
    loadHistory().then(setItems);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return (
    <Screen>
      <StepHeader
        title="History"
        subtitle="Every shade you've tried, saved on this phone only."
      />

      {items.length === 0 ? (
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, shadow.card]}>
            <Sparkles size={30} color={colors.primary} strokeWidth={1.6} />
          </View>
          <Text style={styles.emptyTitle}>No try-ons yet</Text>
          <Text style={styles.emptyBody}>
            Pick a selfie, drop a product link, and your try-ons will live here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <Row item={item} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}

function Row({ item }: { item: TryOn }) {
  const preview = item.resultUri ?? item.selfieUri;
  return (
    <View style={[styles.row, shadow.card]}>
      <Image source={{ uri: preview }} style={styles.rowImage} />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{zoneLabels[item.zone]} try-on</Text>
        <Text style={styles.rowDate}>
          {new Date(item.createdAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  list: { paddingBottom: spacing.xxl, gap: spacing.md },
  row: {
    flexDirection: 'row',
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
    alignItems: 'center',
  },
  rowImage: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
  },
  rowText: { flex: 1, gap: 4 },
  rowTitle: { ...type.heading, fontSize: 16, color: colors.text },
  rowDate: { ...type.caption, color: colors.textFaint },
});
