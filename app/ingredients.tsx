import { useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Camera, ClipboardPaste, ScanLine, Wand2, X } from 'lucide-react-native';
import { Screen } from '../components/Screen';
import { StepHeader } from '../components/StepHeader';
import { Button } from '../components/Button';
import { CreditsBadge } from '../components/CreditsBadge';
import { colors, radius, shadow, spacing, type } from '../lib/theme';
import { useLook } from '../lib/state';
import { presentPickerSheet } from '../lib/pickImage';

type Mode = 'photo' | 'text';

export default function IngredientsInput() {
  const {
    ingredientPhoto,
    ingredientText,
    setIngredientPhoto,
    setIngredientText,
    resetIngredients,
  } = useLook();
  const [mode, setMode] = useState<Mode>(ingredientText ? 'text' : 'photo');

  const canSubmit =
    (mode === 'photo' && !!ingredientPhoto) ||
    (mode === 'text' && ingredientText.trim().length > 10);

  const pasteFromClipboard = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text && text.length > 0) setIngredientText(text);
    } catch {
      // ignore
    }
  };

  const submit = () => {
    if (!canSubmit) return;
    router.push('/ingredients-result');
  };

  const onSwitchMode = (next: Mode) => {
    setMode(next);
  };

  return (
    <Screen>
      <View style={styles.topRow}>
        <CreditsBadge />
      </View>

      <StepHeader
        title="Ingredient scanner"
        subtitle="Snap or paste an INCI list — we'll score it 0–100 and break down what's good and what's iffy."
        onBack={() => {
          resetIngredients();
          router.back();
        }}
      />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.toggle}>
          <ToggleSeg label="Take a photo" active={mode === 'photo'} onPress={() => onSwitchMode('photo')} />
          <ToggleSeg label="Paste text" active={mode === 'text'} onPress={() => onSwitchMode('text')} />
        </View>

        {mode === 'photo' ? (
          <PhotoCapture
            uri={ingredientPhoto}
            onPick={() =>
              presentPickerSheet((picked) => setIngredientPhoto(picked), {
                title: 'Scan ingredients',
                cameraLabel: 'Take a photo',
                libraryLabel: 'Pick from library',
              })
            }
            onClear={() => setIngredientPhoto(null)}
          />
        ) : (
          <PasteArea
            value={ingredientText}
            onChange={setIngredientText}
            onPaste={pasteFromClipboard}
            onClear={() => setIngredientText('')}
          />
        )}

        <View style={styles.tipsCard}>
          <Text style={styles.tipsEyebrow}>How to get the best score</Text>
          <Tip text="Capture the full INCI list — order matters because ingredients are ranked by concentration." />
          <Tip text="Flat, well-lit photos read best. Avoid shadows and angled shots." />
          <Tip text="Works for skincare, haircare, makeup and fragrances — anything with an INCI list." />
          <Text style={styles.tipsHelper}>1 credit per scan.</Text>
        </View>

        <View style={styles.cta}>
          <Button
            label="Score this product"
            onPress={submit}
            disabled={!canSubmit}
            trailing={<Wand2 size={18} color={colors.primaryOn} strokeWidth={2.2} />}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

function ToggleSeg({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.toggleSeg, active && styles.toggleSegActive]}
    >
      <Text style={[styles.toggleLabel, active && styles.toggleLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function PhotoCapture({
  uri,
  onPick,
  onClear,
}: {
  uri: string | null;
  onPick: () => void;
  onClear: () => void;
}) {
  return (
    <View style={[styles.slot, shadow.card]}>
      {uri ? (
        <View style={styles.imageWrap}>
          <Image source={{ uri }} style={styles.image} resizeMode="cover" />
          <Pressable onPress={onClear} hitSlop={10} style={styles.clearBtn}>
            <X size={16} color={colors.primaryOn} strokeWidth={2.4} />
          </Pressable>
          <Pressable onPress={onPick} style={styles.replaceBadge}>
            <Camera size={14} color={colors.primaryOn} strokeWidth={2} />
            <Text style={styles.replaceText}>Replace</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={onPick} style={styles.empty}>
          <View style={styles.iconRing}>
            <ScanLine size={30} color={colors.primary} strokeWidth={1.8} />
          </View>
          <Text style={styles.emptyTitle}>Scan an ingredient list</Text>
          <Text style={styles.emptyHint}>
            Find the small print on the back of any product and snap a clear, flat photo.
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function PasteArea({
  value,
  onChange,
  onPaste,
  onClear,
}: {
  value: string;
  onChange: (v: string) => void;
  onPaste: () => void;
  onClear: () => void;
}) {
  return (
    <View style={[styles.pasteCard, shadow.card]}>
      <View style={styles.pasteHeader}>
        <Text style={styles.pasteLabel}>Ingredient list</Text>
        <View style={styles.pasteActions}>
          {value.length > 0 && (
            <Pressable onPress={onClear} hitSlop={8} style={styles.pasteAction}>
              <X size={14} color={colors.text} strokeWidth={2} />
              <Text style={styles.pasteActionLabel}>Clear</Text>
            </Pressable>
          )}
          <Pressable onPress={onPaste} hitSlop={8} style={styles.pasteAction}>
            <ClipboardPaste size={14} color={colors.text} strokeWidth={2} />
            <Text style={styles.pasteActionLabel}>Paste</Text>
          </Pressable>
        </View>
      </View>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Aqua, Glycerin, Niacinamide, Cetearyl Alcohol…"
        placeholderTextColor={colors.textFaint}
        multiline
        textAlignVertical="top"
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.pasteInput}
      />
      <Text style={styles.pasteHint}>
        {value.trim().length === 0
          ? 'Tap Paste to drop in what you copied, or type it out.'
          : `${value.trim().length} characters`}
      </Text>
    </View>
  );
}

function Tip({ text }: { text: string }) {
  return (
    <View style={styles.tipRow}>
      <View style={styles.tipDot} />
      <Text style={styles.tipText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: spacing.sm,
  },
  content: {
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: colors.bgSoft,
    borderRadius: radius.pill,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleSeg: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  toggleSegActive: { backgroundColor: colors.primary },
  toggleLabel: { ...type.caption, color: colors.text, fontWeight: '600', fontSize: 13 },
  toggleLabelActive: { color: colors.primaryOn },
  slot: {
    height: 320,
    backgroundColor: colors.bgSoft,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  imageWrap: { flex: 1 },
  image: { width: '100%', height: '100%' },
  clearBtn: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(10,10,10,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  replaceBadge: {
    position: 'absolute',
    bottom: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(10,10,10,0.88)',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  replaceText: { ...type.caption, color: colors.primaryOn },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  iconRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  emptyTitle: { ...type.heading, color: colors.text, textAlign: 'center' },
  emptyHint: {
    ...type.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  pasteCard: {
    backgroundColor: colors.bgSoft,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  pasteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pasteLabel: { ...type.eyebrow, color: colors.textMuted },
  pasteActions: { flexDirection: 'row', gap: spacing.sm },
  pasteAction: {
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
  pasteActionLabel: { ...type.caption, color: colors.text, fontWeight: '600', fontSize: 12 },
  pasteInput: {
    ...type.body,
    color: colors.text,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    minHeight: 220,
    fontSize: 14,
    lineHeight: 20,
  },
  pasteHint: { ...type.caption, color: colors.textFaint, fontSize: 12 },
  tipsCard: {
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  tipsEyebrow: { ...type.eyebrow, color: colors.textMuted },
  tipsHelper: {
    ...type.caption,
    color: colors.textFaint,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  tipDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 8,
  },
  tipText: {
    ...type.body,
    fontSize: 13,
    color: colors.text,
    flex: 1,
    lineHeight: 19,
  },
  cta: {
    marginTop: spacing.md,
  },
});
