import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link2, ArrowRight } from 'lucide-react-native';
import { colors, radius, spacing, type } from '../lib/theme';

type Props = {
  loading?: boolean;
  onSubmit: (url: string) => void;
};

export function UrlInput({ loading, onSubmit }: Props) {
  const [value, setValue] = useState('');
  const canSubmit = value.trim().length > 4 && !loading;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit(value.trim());
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Link2 size={18} color={colors.primary} strokeWidth={2} />
      </View>
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder="Paste a product link"
        placeholderTextColor={colors.textFaint}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        returnKeyType="go"
        onSubmitEditing={submit}
        editable={!loading}
        style={styles.input}
      />
      <Pressable
        onPress={submit}
        disabled={!canSubmit}
        style={[styles.go, !canSubmit && styles.goDisabled]}
      >
        {loading ? (
          <ActivityIndicator color={colors.primaryOn} size="small" />
        ) : (
          <ArrowRight size={18} color={colors.primaryOn} strokeWidth={2.4} />
        )}
      </Pressable>
    </View>
  );
}

export function Divider({ label }: { label: string }) {
  return (
    <View style={styles.divider}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerLabel}>{label}</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgSoft,
    borderRadius: radius.pill,
    paddingLeft: spacing.md,
    paddingRight: 6,
    height: 56,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  iconWrap: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    ...type.body,
    color: colors.text,
    paddingVertical: 0,
  },
  go: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goDisabled: { opacity: 0.35 },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerLabel: {
    ...type.caption,
    color: colors.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
});
