import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { X } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { colors, radius, shadow, spacing, type } from '../lib/theme';
import type { Category, WishlistItem } from '../lib/storage';

export type ProductPrefill = {
  name?: string;
  price?: string;
  url?: string;
  notes?: string;
};

type Props = {
  category: Category | null;
  initialItem?: WishlistItem | null;
  prefill?: ProductPrefill | null;
  onSave: (item: WishlistItem) => void;
  onCancel?: () => void;
};

export function ProductForm({ category, initialItem, prefill, onSave, onCancel }: Props) {
  const seed = initialItem ?? prefill ?? null;
  const [name, setName] = useState(seed?.name ?? '');
  const [price, setPrice] = useState(seed?.price ?? '');
  const [url, setUrl] = useState(seed?.url ?? '');
  const [notes, setNotes] = useState(seed?.notes ?? '');

  const isEdit = !!initialItem;
  const canSubmit = name.trim().length > 0;

  const submit = () => {
    if (!canSubmit) return;
    const item: WishlistItem = {
      id: initialItem?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: initialItem?.createdAt ?? Date.now(),
      name: name.trim(),
      price: price.trim(),
      url: url.trim(),
      category: initialItem?.category ?? category,
      notes: notes.trim() || null,
    };
    onSave(item);
  };

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(120)}
      style={[styles.form, shadow.card]}
    >
      <View style={styles.headerRow}>
        <Text style={styles.formTitle}>{isEdit ? 'Edit product' : 'New product'}</Text>
        {onCancel && (
          <Pressable onPress={onCancel} hitSlop={10} style={styles.closeBtn}>
            <X size={16} color={colors.text} strokeWidth={2.2} />
          </Pressable>
        )}
      </View>

      <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Glow Drops" />
      <View style={styles.row}>
        <View style={styles.col}>
          <Field label="Price" value={price} onChangeText={setPrice} placeholder="£22" />
        </View>
        <View style={styles.col}>
          <Field
            label="Link"
            value={url}
            onChangeText={setUrl}
            placeholder="https://…"
            autoCapitalize="none"
            keyboardType="url"
          />
        </View>
      </View>
      <Field
        label="Notes"
        value={notes}
        onChangeText={setNotes}
        placeholder="Optional"
        multiline
      />

      <Pressable
        onPress={submit}
        disabled={!canSubmit}
        style={[styles.saveBtn, !canSubmit && styles.saveBtnDisabled]}
      >
        <Text style={styles.saveLabel}>{isEdit ? 'Save changes' : 'Save'}</Text>
      </Pressable>
    </Animated.View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  autoCapitalize,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'url' | 'email-address' | 'numeric';
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        autoCorrect={false}
        keyboardType={keyboardType ?? 'default'}
        multiline={multiline}
        style={[styles.input, multiline && styles.inputMulti]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  formTitle: { ...type.heading, fontSize: 16, color: colors.text },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  col: { flex: 1 },
  field: { gap: 6 },
  fieldLabel: { ...type.eyebrow, color: colors.textMuted, fontSize: 11 },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    ...type.body,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  inputMulti: { minHeight: 60, textAlignVertical: 'top' },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveLabel: { ...type.heading, fontSize: 15, color: colors.primaryOn },
});
