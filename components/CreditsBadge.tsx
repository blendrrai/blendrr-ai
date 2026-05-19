import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Coins, Crown } from 'lucide-react-native';
import { colors, radius, spacing, type } from '../lib/theme';
import { loadSubscription, subscribeSubscription, type Subscription } from '../lib/storage';

export function CreditsBadge() {
  const [sub, setSub] = useState<Subscription | null>(null);

  const refresh = useCallback(() => {
    loadSubscription().then(setSub);
  }, []);

  useEffect(() => {
    refresh();
    return subscribeSubscription((next) => setSub(next));
  }, [refresh]);

  useFocusEffect(useCallback(() => refresh(), [refresh]));

  const isPro = sub?.tier === 'pro';
  const credits = sub?.credits ?? 0;

  return (
    <Pressable
      onPress={() => router.push('/menu/credits')}
      hitSlop={8}
      style={[styles.pill, isPro && styles.pillPro]}
    >
      {isPro ? (
        <Crown size={14} color={colors.primaryOn} strokeWidth={2} />
      ) : (
        <Coins size={14} color={colors.text} strokeWidth={2} />
      )}
      <Text style={[styles.label, isPro && styles.labelPro]}>
        {credits} {credits === 1 ? 'credit' : 'credits'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  pillPro: { backgroundColor: colors.primary, borderColor: colors.primary },
  label: { ...type.caption, color: colors.text, fontWeight: '700', fontSize: 12 },
  labelPro: { color: colors.primaryOn },
});
