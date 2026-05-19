import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Clock, Coins, Crown, Menu } from 'lucide-react-native';
import { colors, radius, spacing, type } from '../lib/theme';
import { loadSubscription, subscribeSubscription, type Subscription } from '../lib/storage';

export function TabHeader() {
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
    <View style={styles.row}>
      <Pressable onPress={() => router.push('/menu')} hitSlop={12} style={styles.iconBtn}>
        <Menu size={20} color={colors.text} strokeWidth={2} />
      </Pressable>

      <Pressable
        onPress={() => router.push('/menu/credits')}
        hitSlop={8}
        style={[styles.creditsPill, isPro && styles.creditsPillPro]}
      >
        {isPro ? (
          <Crown size={14} color={colors.primaryOn} strokeWidth={2} />
        ) : (
          <Coins size={14} color={colors.text} strokeWidth={2} />
        )}
        <Text style={[styles.creditsLabel, isPro && styles.creditsLabelPro]}>
          {credits} {credits === 1 ? 'credit' : 'credits'}
        </Text>
      </Pressable>

      <Pressable onPress={() => router.push('/history')} hitSlop={12} style={styles.iconBtn}>
        <Clock size={18} color={colors.text} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creditsPill: {
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
  creditsPillPro: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  creditsLabel: {
    ...type.caption,
    color: colors.text,
    fontWeight: '700',
    fontSize: 13,
  },
  creditsLabelPro: { color: colors.primaryOn },
});
