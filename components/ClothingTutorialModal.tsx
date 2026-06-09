import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Camera, Check, Footprints, Gem, ShoppingBag, Shirt, X } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { colors, radius, shadow, spacing, type } from '../lib/theme';

const STORAGE_KEY = 'blendrr.clothingTutorialDismissed.v1';

/**
 * One-time tutorial that explains what kind of selfie to use for clothing
 * try-ons. Pops up the first time the user enters the clothing flow. Has a
 * "don't show again" checkbox — once ticked, the key in AsyncStorage stops
 * the modal from firing on future visits. Resetting "Clear all app data"
 * clears the key so the tutorial returns.
 */
export function ClothingTutorialModal({
  visible,
  onDismiss,
}: {
  visible: boolean;
  onDismiss: () => void;
}) {
  const [dontShow, setDontShow] = useState(false);

  const close = async () => {
    if (dontShow) {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, 'true');
      } catch {
        // ignore — worst case the tutorial shows again
      }
    }
    onDismiss();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={close}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Animated.View
          style={[styles.sheet, shadow.card]}
          entering={FadeIn.duration(220)}
          exiting={FadeOut.duration(160)}
        >
          <Pressable style={styles.closeBtn} onPress={close} hitSlop={10}>
            <X size={18} color={colors.text} strokeWidth={2.2} />
          </Pressable>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.iconRing}>
              <Camera size={28} color={colors.primaryOn} strokeWidth={1.8} />
            </View>

            <Text style={styles.title}>How to take the right photo</Text>
            <Text style={styles.subtitle}>
              For clothing try-ons to look real, your selfie needs to show whatever body part the
              item covers. A quick guide:
            </Text>

            <Tip
              Icon={Shirt}
              title="Tops & dresses"
              body="Use a half- or full-body photo with your torso and arms clearly visible. For short-sleeve tops, your arms should be on show."
            />
            <Tip
              Icon={Shirt}
              title="Bottoms (shorts, skirts, pants)"
              body="Your photo should show your legs. Stand back from the camera so the AI can map the right fit."
            />
            <Tip
              Icon={Footprints}
              title="Shoes"
              body="Take a photo where your feet are visible — a full-body shot or a quick downward angle works."
            />
            <Tip
              Icon={Gem}
              title="Jewelry"
              body="Necklaces: collarbones visible. Earrings: ears visible. Bracelets/rings: hands in frame."
            />
            <Tip
              Icon={ShoppingBag}
              title="Accessories (bags, hats, scarves)"
              body="Whatever area the accessory sits on needs to be clearly in the photo."
            />

            <Text style={styles.disclaimer}>
              Plain backgrounds and natural lighting give the best results. The AI keeps your
              body, face, and skin exactly the same — only the item changes.
            </Text>

            <Pressable
              onPress={() => setDontShow((v) => !v)}
              style={styles.checkboxRow}
              hitSlop={6}
            >
              <View style={[styles.checkbox, dontShow && styles.checkboxChecked]}>
                {dontShow && <Check size={13} color={colors.primaryOn} strokeWidth={3} />}
              </View>
              <Text style={styles.checkboxLabel}>Don't show this again</Text>
            </Pressable>

            <Pressable onPress={close} style={styles.cta}>
              <Text style={styles.ctaLabel}>Got it</Text>
            </Pressable>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

/**
 * Check whether the tutorial has been dismissed previously. Use this from
 * the zone picker (or wherever the tutorial should fire) to decide whether
 * to surface it at all.
 */
export async function hasSeenClothingTutorial(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(STORAGE_KEY);
    return v === 'true';
  } catch {
    return false;
  }
}

function Tip({
  Icon,
  title,
  body,
}: {
  Icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.tip}>
      <View style={styles.tipIcon}>
        <Icon size={18} color={colors.text} strokeWidth={1.8} />
      </View>
      <View style={styles.tipBody}>
        <Text style={styles.tipTitle}>{title}</Text>
        <Text style={styles.tipText}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,10,10,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '94%',
    paddingTop: spacing.md,
  },
  closeBtn: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bgSoft,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  title: { ...type.title, fontSize: 22, color: colors.text, textAlign: 'center' },
  subtitle: {
    ...type.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
    fontSize: 14,
    maxWidth: 320,
    marginBottom: spacing.sm,
  },
  tip: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.bgSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tipIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  tipBody: { flex: 1, gap: 2 },
  tipTitle: { ...type.heading, fontSize: 14, color: colors.text },
  tipText: { ...type.caption, color: colors.textMuted, lineHeight: 18, fontSize: 12 },
  disclaimer: {
    ...type.caption,
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 17,
    marginTop: spacing.sm,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    alignSelf: 'flex-start',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxLabel: { ...type.caption, color: colors.text, fontWeight: '600', fontSize: 13 },
  cta: {
    alignSelf: 'stretch',
    paddingVertical: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  ctaLabel: { ...type.heading, color: colors.primaryOn, fontSize: 15 },
});
