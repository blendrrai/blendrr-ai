import { Alert, Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Check, Copy, ExternalLink, Pencil, Share2, Trash2 } from 'lucide-react-native';
import { colors, radius, shadow, spacing, type } from '../lib/theme';
import type { WishlistItem } from '../lib/storage';

type Props = {
  item: WishlistItem;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  onLongPress?: (id: string) => void;
};

export function ProductCard({
  item,
  onDelete,
  onEdit,
  selectMode = false,
  selected = false,
  onToggleSelect,
  onLongPress,
}: Props) {
  const copy = async () => {
    const text = item.url
      ? `${item.name}${item.price ? ` — ${item.price}` : ''}\n${item.url}`
      : `${item.name}${item.price ? ` — ${item.price}` : ''}`;
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied', 'Pasted to your clipboard.');
  };

  const share = async () => {
    const message = item.url
      ? `${item.name}${item.price ? ` — ${item.price}` : ''}\n${item.url}`
      : `${item.name}${item.price ? ` — ${item.price}` : ''}`;
    try {
      await Share.share({ message });
    } catch {
      // user cancelled
    }
  };

  const open = async () => {
    if (!item.url || selectMode) return;
    const can = await Linking.canOpenURL(item.url);
    if (can) await Linking.openURL(item.url);
  };

  const confirmDelete = () => {
    if (!onDelete) return;
    Alert.alert('Delete this item?', item.name, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(item.id) },
    ]);
  };

  const handlePress = () => {
    if (selectMode) onToggleSelect?.(item.id);
  };

  const handleLongPress = () => {
    if (!selectMode) onLongPress?.(item.id);
  };

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      delayLongPress={350}
      style={[styles.card, shadow.card, selected && styles.cardSelected]}
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.name} numberOfLines={2}>
            {item.name}
          </Text>
          {item.price ? <Text style={styles.price}>{item.price}</Text> : null}
        </View>

        {selectMode ? (
          <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
            {selected && <Check size={14} color={colors.primaryOn} strokeWidth={3} />}
          </View>
        ) : (
          <View style={styles.iconRow}>
            {onEdit && (
              <Pressable onPress={() => onEdit(item.id)} hitSlop={8} style={styles.iconBtn}>
                <Pencil size={15} color={colors.textMuted} strokeWidth={2} />
              </Pressable>
            )}
            {onDelete && (
              <Pressable onPress={confirmDelete} hitSlop={8} style={styles.iconBtn}>
                <Trash2 size={15} color={colors.textFaint} strokeWidth={2} />
              </Pressable>
            )}
          </View>
        )}
      </View>

      {item.url ? (
        <Pressable onPress={open} style={styles.urlRow} hitSlop={6} disabled={selectMode}>
          <ExternalLink size={14} color={colors.textMuted} strokeWidth={2} />
          <Text style={styles.url} numberOfLines={1}>
            {item.url.replace(/^https?:\/\//, '')}
          </Text>
        </Pressable>
      ) : null}

      {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}

      {!selectMode && (
        <View style={styles.actions}>
          <ActionBtn label="Copy" Icon={Copy} onPress={copy} />
          <ActionBtn label="Share" Icon={Share2} onPress={share} />
        </View>
      )}
    </Pressable>
  );
}

function ActionBtn({
  label,
  Icon,
  onPress,
}: {
  label: string;
  Icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.actionBtn}>
      <Icon size={15} color={colors.text} strokeWidth={2} />
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  cardSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  headerText: { flex: 1, gap: 2 },
  name: { ...type.heading, fontSize: 16, color: colors.text },
  price: { ...type.body, color: colors.primary, fontWeight: '600', fontSize: 15 },
  iconRow: { flexDirection: 'row', gap: 4 },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  urlRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  url: { ...type.caption, color: colors.textMuted, flex: 1 },
  notes: { ...type.body, color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionLabel: { ...type.caption, color: colors.text, fontWeight: '500' },
});
