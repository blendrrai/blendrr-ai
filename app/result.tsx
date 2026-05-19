import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as MediaLibrary from 'expo-media-library';
import { Download, Heart, RotateCcw, Share2 } from 'lucide-react-native';
import { Screen } from '../components/Screen';
import { StepHeader } from '../components/StepHeader';
import { Button } from '../components/Button';
import { AiError, AiLoading, NoCredits } from '../components/AiStatus';
import { EnlargeButton, ImageEnlargerModal } from '../components/ImageEnlarger';
import { colors, radius, shadow, spacing, type, zoneLabels } from '../lib/theme';
import { useLook } from '../lib/state';
import { tryOn } from '../lib/blendrr';
import { canUseCredit, saveTryOn } from '../lib/storage';
import { consumeCreditWithPrompt } from '../lib/credits';

type State =
  | { kind: 'loading' }
  | { kind: 'ok'; uri: string }
  | { kind: 'error'; message: string }
  | { kind: 'no-credits'; reason: string };

export default function ResultScreen() {
  const { selfieUri, productUri, productUrl, zone, resetTryOn } = useLook();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [view, setView] = useState<'before' | 'after'>('after');
  const [saving, setSaving] = useState(false);
  const [enlargedUri, setEnlargedUri] = useState<string | null>(null);
  const [savedToRoll, setSavedToRoll] = useState(false);
  const [addedToWishlist, setAddedToWishlist] = useState(false);
  const inFlight = useRef(false);

  const run = useCallback(async () => {
    if (inFlight.current) return;
    if (!selfieUri || !productUri) {
      setState({ kind: 'error', message: 'Missing selfie or product image.' });
      return;
    }
    inFlight.current = true;
    setState({ kind: 'loading' });

    const credit = await canUseCredit();
    if (!credit.ok) {
      setState({ kind: 'no-credits', reason: credit.reason });
      inFlight.current = false;
      return;
    }

    try {
      const resultUri = await tryOn({ selfieUri, productUri, zone });
      await consumeCreditWithPrompt();
      await saveTryOn({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: Date.now(),
        zone,
        selfieUri,
        productUri,
        productUrl,
        resultUri,
      });
      setState({ kind: 'ok', uri: resultUri });
      setView('after');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Something went wrong.';
      setState({ kind: 'error', message });
    } finally {
      inFlight.current = false;
    }
  }, [selfieUri, productUri, productUrl, zone]);

  useEffect(() => {
    run();
  }, [run]);

  const saveToRoll = async () => {
    if (state.kind !== 'ok' || saving) return;
    setSaving(true);
    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert(
          'Photos access needed',
          'Allow Blendrr Ai to save to your camera roll in Settings.',
        );
        return;
      }
      await MediaLibrary.saveToLibraryAsync(state.uri);
      setSavedToRoll(true);
      Alert.alert('Saved', 'Your try-on is in Photos.');
    } catch (e) {
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  const shareIt = async () => {
    if (state.kind !== 'ok') return;
    try {
      await Share.share({
        url: state.uri,
        message: 'Look what I just tried on with Blendrr Ai 💄',
      });
    } catch {
      // user cancelled
    }
  };

  const goHome = () => {
    resetTryOn();
    router.dismissAll();
  };

  const confirmLeave = (action: () => void) => {
    if (state.kind !== 'ok' || savedToRoll || addedToWishlist) {
      action();
      return;
    }
    Alert.alert(
      'Heads up',
      "You haven't saved this try-on to camera roll or added the product to your wishlist. Leave anyway?",
      [
        { text: 'Stay here', style: 'cancel' },
        { text: 'Leave anyway', style: 'destructive', onPress: action },
      ],
    );
  };

  const startOver = () => confirmLeave(goHome);
  const backHome = () => confirmLeave(goHome);

  const displayUri = view === 'before' ? selfieUri : state.kind === 'ok' ? state.uri : null;

  return (
    <Screen>
      <StepHeader
        step="Result"
        title="Your shade match"
        subtitle={`Trying ${zoneLabels[zone].toLowerCase()} from your product.`}
        onBack={backHome}
      />

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {state.kind === 'loading' && <AiLoading label="Blending your shade…" />}
        {state.kind === 'error' && <AiError message={state.message} onRetry={run} />}
        {state.kind === 'no-credits' && <NoCredits reason={state.reason} />}

        {state.kind === 'ok' && (
          <View style={[styles.imageCard, shadow.card]}>
            {displayUri && (
              <Image source={{ uri: displayUri }} style={styles.image} resizeMode="cover" />
            )}

            <View style={styles.toggle}>
              <ToggleSeg label="Before" active={view === 'before'} onPress={() => setView('before')} />
              <ToggleSeg label="After" active={view === 'after'} onPress={() => setView('after')} />
            </View>

            {displayUri && (
              <EnlargeButton
                onPress={() => setEnlargedUri(displayUri)}
                style={styles.enlargeOverlay}
              />
            )}
          </View>
        )}

        <View style={styles.thumbRow}>
          <Thumb uri={selfieUri} label="Selfie" onEnlarge={setEnlargedUri} />
          <Thumb uri={productUri} label="Product" onEnlarge={setEnlargedUri} />
        </View>

        <View style={styles.cta}>
          {state.kind === 'ok' && (
            <>
              <Button
                label={saving ? 'Saving…' : 'Save to camera roll'}
                onPress={saveToRoll}
                disabled={saving}
                trailing={<Download size={18} color={colors.primaryOn} strokeWidth={2} />}
              />
              <Button
                label="Add to makeup wishlist"
                onPress={() => {
                  setAddedToWishlist(true);
                  router.push({
                    pathname: '/menu/wishlist',
                    params: {
                      openForm: '1',
                      category: 'makeup',
                      url: productUrl ?? '',
                    },
                  });
                }}
                variant="ghost"
                trailing={<Heart size={18} color={colors.text} strokeWidth={2} />}
              />
              <Button
                label="Share to friends"
                onPress={shareIt}
                variant="ghost"
                trailing={<Share2 size={18} color={colors.text} strokeWidth={2} />}
              />
            </>
          )}
          <Button
            label="Start over"
            onPress={startOver}
            variant="ghost"
            leading={<RotateCcw size={18} color={colors.text} strokeWidth={2} />}
          />
        </View>
      </ScrollView>

      <ImageEnlargerModal
        uri={enlargedUri}
        visible={!!enlargedUri}
        onClose={() => setEnlargedUri(null)}
      />
    </Screen>
  );
}

function ToggleSeg({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.toggleSeg, active && styles.toggleSegActive]}>
      <Text style={[styles.toggleLabel, active && styles.toggleLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function Thumb({
  uri,
  label,
  onEnlarge,
}: {
  uri: string | null;
  label: string;
  onEnlarge: (uri: string) => void;
}) {
  return (
    <View style={styles.thumb}>
      {uri ? (
        <View style={styles.thumbImageWrap}>
          <Image source={{ uri }} style={styles.thumbImage} resizeMode="cover" />
          <EnlargeButton onPress={() => onEnlarge(uri)} style={styles.thumbEnlarge} />
        </View>
      ) : (
        <View style={[styles.thumbImage, styles.thumbEmpty]} />
      )}
      <Text style={styles.thumbLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  bodyContent: { gap: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xxl },
  imageCard: {
    backgroundColor: colors.bgSoft,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
  },
  image: { width: '100%', aspectRatio: 1 },
  toggle: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    backgroundColor: 'rgba(10,10,10,0.72)',
    borderRadius: radius.pill,
    padding: 4,
    gap: 2,
  },
  toggleSeg: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  toggleSegActive: { backgroundColor: colors.primaryOn },
  toggleLabel: {
    ...type.caption,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '600',
  },
  toggleLabelActive: { color: colors.text },
  enlargeOverlay: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
  },
  thumbRow: { flexDirection: 'row', gap: spacing.md },
  thumb: { flex: 1, gap: spacing.sm },
  thumbImageWrap: { position: 'relative' },
  thumbEnlarge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
  },
  thumbImage: {
    aspectRatio: 1,
    width: '100%',
    borderRadius: radius.lg,
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumbEmpty: { backgroundColor: colors.bgSoft },
  thumbLabel: { ...type.caption, color: colors.textFaint, textAlign: 'center' },
  cta: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
