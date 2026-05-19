import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Plus } from 'lucide-react-native';
import { ProductForm, type ProductPrefill } from './ProductForm';
import { colors, radius, shadow, spacing, type } from '../lib/theme';
import type { Category, WishlistItem } from '../lib/storage';

type Props = {
  category: Category | null;
  onAdd: (item: WishlistItem) => void;
  defaultOpen?: boolean;
  prefill?: ProductPrefill | null;
};

export function AddProductForm({ category, onAdd, defaultOpen, prefill }: Props) {
  const [open, setOpen] = useState(!!defaultOpen);

  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  if (!open) {
    return (
      <Pressable onPress={() => setOpen(true)} style={[styles.openBtn, shadow.card]}>
        <Plus size={18} color={colors.text} strokeWidth={2.4} />
        <Text style={styles.openLabel}>Add a product</Text>
      </Pressable>
    );
  }

  return (
    <ProductForm
      category={category}
      prefill={prefill}
      onSave={(item) => {
        onAdd(item);
        setOpen(false);
      }}
      onCancel={() => setOpen(false)}
    />
  );
}

export type { ProductPrefill };

const styles = StyleSheet.create({
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  openLabel: { ...type.heading, fontSize: 15, color: colors.text },
});
