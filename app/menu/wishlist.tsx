import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ArrowRight, Heart, Sparkles, Trash2, X } from 'lucide-react-native';
import { Screen } from '../../components/Screen';
import { StepHeader } from '../../components/StepHeader';
import { ProductCard } from '../../components/ProductCard';
import { ProductForm } from '../../components/ProductForm';
import { AddProductForm, type ProductPrefill } from '../../components/AddProductForm';
import { colors, radius, shadow, spacing, type } from '../../lib/theme';
import {
  Category,
  deleteWishlistItem,
  deleteWishlistItems,
  loadWishlist,
  saveWishlistItem,
  type WishlistItem,
} from '../../lib/storage';

export default function Wishlist() {
  const params = useLocalSearchParams<{
    openForm?: string;
    category?: string;
    url?: string;
    name?: string;
    notes?: string;
  }>();

  const [items, setItems] = useState<WishlistItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const prefillCategory = useMemo<Category | null>(() => {
    const c = params.category;
    if (c === 'skincare' || c === 'haircare' || c === 'fragrance' || c === 'makeup') return c;
    return null;
  }, [params.category]);

  const prefill = useMemo<ProductPrefill | null>(() => {
    if (params.openForm !== '1') return null;
    return {
      url: params.url ?? '',
      name: params.name ?? '',
      notes: params.notes ?? '',
    };
  }, [params.openForm, params.url, params.name, params.notes]);

  const refresh = useCallback(() => {
    loadWishlist().then(setItems);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startSelect = (id?: string) => {
    setEditingId(null);
    setSelectMode(true);
    if (id) setSelectedIds(new Set([id]));
  };

  const selectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)));
    }
  };

  const bulkDelete = () => {
    const count = selectedIds.size;
    if (count === 0) return;
    Alert.alert(`Delete ${count} item${count === 1 ? '' : 's'}?`, 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: `Delete ${count}`,
        style: 'destructive',
        onPress: async () => {
          const next = await deleteWishlistItems(Array.from(selectedIds));
          setItems(next);
          exitSelectMode();
        },
      },
    ]);
  };

  const onAdd = async (item: WishlistItem) => {
    const next = await saveWishlistItem(item);
    setItems(next);
  };

  const onSaveEdit = async (item: WishlistItem) => {
    const next = await saveWishlistItem(item);
    setItems(next);
    setEditingId(null);
  };

  const onDelete = async (id: string) => {
    const next = await deleteWishlistItem(id);
    setItems(next);
  };

  return (
    <Screen>
      {selectMode ? (
        <SelectionBar
          count={selectedIds.size}
          total={items.length}
          onCancel={exitSelectMode}
          onSelectAll={selectAll}
          onDelete={bulkDelete}
        />
      ) : (
        <View style={styles.headerWrap}>
          <StepHeader
            title="Wishlist"
            subtitle="Drop links, prices, notes — copy or share anytime."
          />
          {items.length > 0 && (
            <Pressable
              onPress={() => startSelect()}
              hitSlop={8}
              style={styles.selectBtn}
            >
              <Text style={styles.selectLabel}>Select</Text>
            </Pressable>
          )}
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        {!selectMode && (
          <AddProductForm
            category={prefillCategory}
            onAdd={onAdd}
            defaultOpen={params.openForm === '1'}
            prefill={prefill}
          />
        )}

        {items.length === 0 && !selectMode ? (
          <View style={[styles.empty, shadow.card]}>
            <View style={styles.emptyIcon}>
              <Heart size={26} color={colors.primary} strokeWidth={1.8} />
            </View>
            <Text style={styles.emptyTitle}>Nothing saved yet</Text>
            <Text style={styles.emptyBody}>
              Add the lipsticks, serums, and bottles you're considering. Everything stays on this
              phone.
            </Text>

            <View style={styles.emptyCtas}>
              <Pressable onPress={() => router.push('/selfie')} style={styles.emptyPrimary}>
                <Sparkles size={16} color={colors.primaryOn} strokeWidth={2.2} />
                <Text style={styles.emptyPrimaryLabel}>Start a try-on</Text>
                <ArrowRight size={16} color={colors.primaryOn} strokeWidth={2.4} />
              </Pressable>
              <Pressable onPress={() => router.push('/menu')} style={styles.emptyGhost}>
                <Text style={styles.emptyGhostLabel}>Or browse the quizzes</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          items.map((item) =>
            editingId === item.id ? (
              <ProductForm
                key={item.id}
                category={item.category}
                initialItem={item}
                onSave={onSaveEdit}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <ProductCard
                key={item.id}
                item={item}
                onDelete={onDelete}
                onEdit={(id) => setEditingId(id)}
                selectMode={selectMode}
                selected={selectedIds.has(item.id)}
                onToggleSelect={toggleSelected}
                onLongPress={(id) => startSelect(id)}
              />
            ),
          )
        )}
      </ScrollView>
    </Screen>
  );
}

function SelectionBar({
  count,
  total,
  onCancel,
  onSelectAll,
  onDelete,
}: {
  count: number;
  total: number;
  onCancel: () => void;
  onSelectAll: () => void;
  onDelete: () => void;
}) {
  const allSelected = count === total && total > 0;
  return (
    <View style={styles.selectionBar}>
      <Pressable onPress={onCancel} hitSlop={10} style={styles.barIconBtn}>
        <X size={18} color={colors.text} strokeWidth={2} />
      </Pressable>
      <Text style={styles.selectionTitle}>
        {count === 0 ? 'Select items' : `${count} selected`}
      </Text>
      <View style={styles.barActions}>
        <Pressable onPress={onSelectAll} hitSlop={8} style={styles.selectAllBtn}>
          <Text style={styles.selectAllLabel}>{allSelected ? 'Clear' : 'All'}</Text>
        </Pressable>
        <Pressable
          onPress={onDelete}
          disabled={count === 0}
          hitSlop={8}
          style={[styles.deleteBtn, count === 0 && styles.deleteBtnDisabled]}
        >
          <Trash2 size={16} color={colors.primaryOn} strokeWidth={2.2} />
          <Text style={styles.deleteLabel}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerWrap: {
    position: 'relative',
  },
  selectBtn: {
    position: 'absolute',
    top: 60,
    right: 0,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  selectLabel: { ...type.caption, color: colors.text, fontWeight: '600' },
  content: { paddingBottom: spacing.xxl, gap: spacing.md },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bgSoft,
    borderRadius: radius.pill,
    paddingLeft: 6,
    paddingRight: 6,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  barIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectionTitle: { ...type.heading, fontSize: 15, color: colors.text },
  barActions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  selectAllBtn: {
    paddingHorizontal: spacing.md,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
  },
  selectAllLabel: { ...type.caption, color: colors.text, fontWeight: '600' },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
  },
  deleteBtnDisabled: { opacity: 0.4 },
  deleteLabel: { ...type.caption, color: colors.primaryOn, fontWeight: '600' },
  empty: {
    alignItems: 'center',
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  emptyTitle: { ...type.heading, color: colors.text },
  emptyBody: {
    ...type.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  emptyCtas: { gap: spacing.sm, marginTop: spacing.md, alignItems: 'center' },
  emptyPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.xl,
    paddingVertical: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  emptyPrimaryLabel: { ...type.heading, fontSize: 14, color: colors.primaryOn },
  emptyGhost: { paddingVertical: 6 },
  emptyGhostLabel: { ...type.caption, color: colors.textMuted, fontWeight: '600' },
});
