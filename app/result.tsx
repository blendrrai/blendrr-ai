import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as MediaLibrary from 'expo-media-library';
import { Check, Clock, Download, Heart, RotateCcw, Share2, Sparkles } from 'lucide-react-native';
import { Screen } from '../components/Screen';
import { StepHeader } from '../components/StepHeader';
import { Button } from '../components/Button';
import { AiError, AiLoading, NoCredits } from '../components/AiStatus';
import { EnlargeButton, ImageEnlargerModal } from '../components/ImageEnlarger';
import { colors, radius, shadow, spacing, type } from '../lib/theme';
import { useLook } from '../lib/state';
import { clearActiveTryOnJob, getActiveTryOnJob, pollTryOnJob } from '../lib/blendrr';
import { saveTryOn } from '../lib/storage';
import { refreshUser } from '../lib/user';
import { cancelTryOnReadyNotification } from '../lib/notifications';
import { checkAchievements } from '../lib/glow';

type State =
  | { kind: 'loading'; partialUri?: string }
  | { kind: 'ok'; uri: string }
  | { kind: 'error'; message: string }
  | { kind: 'no-credits'; reason: string };

/**
 * Rotating loader messages — cycle every ~2.5s while the AI is generating.
 * Sequenced loosely from "first step" to "final touches" so the user feels
 * concrete progress, even though there's no real progress signal.
 *
 * Two sets, picked by category. 18 messages × 2.5s = ~45s per cycle, which
 * roughly matches Ultra HD generation time — most users see each message
 * once and never feel stuck on the same text.
 */
const BEAUTY_LOADING_LABELS = [
  'Reading the shade…',
  'Sampling the colour…',
  'Mapping your features…',
  'Studying the lighting…',
  'Locking in your skin tone…',
  'Mixing the perfect pigment…',
  'Matching the undertone…',
  'Brushing it onto your lips…',
  'Blending into your skin…',
  'Smoothing the edges…',
  'Catching the light just right…',
  'Refining the texture…',
  'Polishing the finish…',
  'Adjusting for your unique tone…',
  'Almost picture-perfect…',
  'Bringing it all together…',
  'Just a touch more polish…',
  'Adding that final glow ✨',
] as const;

const CLOTHING_LOADING_LABELS = [
  'Studying the fit…',
  'Reading the fabric…',
  'Mapping your body shape…',
  'Picking up the pattern…',
  'Locking in your silhouette…',
  'Matching the colour & texture…',
  'Aligning to your pose…',
  'Draping it onto you…',
  'Catching the natural folds…',
  'Tailoring to your frame…',
  'Smoothing the seams…',
  'Refining the cut…',
  'Adjusting the drape…',
  'Locking the lighting in…',
  'Almost ready for the fit check…',
  'Bringing the look to life…',
  'Final touches on the silhouette…',
  'Setting up your fit check ✨',
] as const;

export default function ResultScreen() {
  const { selfieUri, productUris, productUrls, zone, mode, quality, category, resetTryOn } = useLook();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [saving, setSaving] = useState(false);
  const [enlargedUri, setEnlargedUri] = useState<string | null>(null);
  const [savedToRoll, setSavedToRoll] = useState(false);
  const [addedToWishlist, setAddedToWishlist] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const productUri = productUris[0] ?? null;
  const productUrl = productUrls[0] ?? null;

  /** Stop any in-flight polling. Safe to call from cleanup. */
  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  /** Single poll tick → schedules the next one if still pending. */
  const pollOnce = useCallback(
    async (jobId: string) => {
      try {
        const status = await pollTryOnJob(jobId);
        if (!isMountedRef.current) return;

        switch (status.kind) {
          case 'pending': {
            // Keep polling. 2s interval is a reasonable balance — fast enough
            // for the user to feel responsive, slow enough not to hammer the API.
            pollTimer.current = setTimeout(() => pollOnce(jobId), 2000);
            return;
          }
          case 'processing': {
            // If a streamed partial preview is available, swap from the
            // spinner to a live preview. Otherwise keep showing the spinner.
            if (status.partialUri) {
              setState({ kind: 'loading', partialUri: status.partialUri });
            }
            pollTimer.current = setTimeout(() => pollOnce(jobId), 2000);
            return;
          }
          case 'failed': {
            await clearActiveTryOnJob();
            await cancelTryOnReadyNotification();
            // Credits get auto-refunded by the server on failure; refresh local cache.
            refreshUser().catch(() => {});
            setState({ kind: 'error', message: status.error });
            return;
          }
          case 'complete': {
            const resultUri = status.resultUri;
            await saveTryOn({
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              createdAt: Date.now(),
              zone,
              selfieUri: selfieUri ?? '',
              productUri: productUris[0] ?? '',
              productUris,
              productUrl: productUrls[0] ?? null,
              productUrls,
              mode,
              quality,
              resultUri,
            });
            await clearActiveTryOnJob();
            await cancelTryOnReadyNotification();
            // Recompute Glow achievements (try-on counters changed). Fire-and-
            // forget — UI doesn't need to wait, the unlocked set will surface
            // on the next render of the home tab or achievements screen.
            checkAchievements().catch(() => {});
            setState({ kind: 'ok', uri: resultUri });
            return;
          }
        }
      } catch (e) {
        if (!isMountedRef.current) return;
        const message = e instanceof Error ? e.message : 'Something went wrong polling the try-on.';
        // Don't kill the polling immediately on transient errors; retry once.
        pollTimer.current = setTimeout(() => pollOnce(jobId), 4000);
        console.warn('[try-on] poll error, retrying in 4s:', message);
      }
    },
    [zone, mode, quality, selfieUri, productUris, productUrls],
  );

  /** Resume / start polling for the currently active job. */
  const run = useCallback(async () => {
    stopPolling();
    const job = await getActiveTryOnJob();
    if (!job) {
      setState({
        kind: 'error',
        message: "We couldn't find your try-on in progress. Tap Start over to try again.",
      });
      return;
    }
    setState({ kind: 'loading' });
    void pollOnce(job.jobId);
  }, [pollOnce, stopPolling]);

  // Initial mount: kick off polling
  useEffect(() => {
    isMountedRef.current = true;
    run();
    return () => {
      isMountedRef.current = false;
      stopPolling();
    };
  }, [run, stopPolling]);

  // When the app returns from background, resume polling if we're still
  // waiting on a result. iOS may have killed the previous poll timer.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      // Only resume if we're currently in the loading state — don't restart
      // for users who already saw their result.
      if (state.kind === 'loading') {
        run();
      }
    });
    return () => sub.remove();
  }, [state.kind, run]);

  const saveToRoll = async () => {
    if (state.kind !== 'ok' || saving) return;
    setSaving(true);
    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert(
          'Photos access needed',
          'Allow BLENDRR Ai to save to your camera roll in Settings.',
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
        message: category === 'clothing'
          ? 'Just did a fit check on BLENDRR Ai 👗'
          : 'Look what I just tried on with BLENDRR Ai 💄',
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
    // Mid-generation — credit is already deducted server-side and the AI is
    // working. Leaving abandons the result and the credit won't be refunded
    // (the job still completes, but the user loses visibility of it).
    if (state.kind === 'loading') {
      const noun = category === 'clothing' ? 'fit check' : 'try-on';
      Alert.alert(
        'Heads up',
        `Your ${noun} is still generating. Leave now and you'll lose this result — your credit won't be refunded.`,
        [
          { text: 'Stay here', style: 'cancel' },
          { text: 'Leave anyway', style: 'destructive', onPress: action },
        ],
      );
      return;
    }
    // Result is ready but the user hasn't saved it anywhere.
    if (state.kind === 'ok' && !savedToRoll && !addedToWishlist) {
      Alert.alert(
        'Heads up',
        "You haven't saved this to your camera roll or added the product to your wishlist. Leave anyway?",
        [
          { text: 'Stay here', style: 'cancel' },
          { text: 'Leave anyway', style: 'destructive', onPress: action },
        ],
      );
      return;
    }
    // Error / no-credits / already-saved states — no need to warn.
    action();
  };

  const startOver = () => confirmLeave(goHome);
  const backHome = () => confirmLeave(goHome);

  const displayUri = state.kind === 'ok' ? state.uri : null;

  const loadingHint = quality === 'ultra'
    ? "Ultra HD try-ons take 40 seconds to 1 minute — we're getting every detail pixel-perfect. You can swipe to another app, but don't close BLENDRR."
    : "This usually takes 15–30 seconds. You can swipe to another app, but don't close BLENDRR.";

  return (
    <Screen>
      <StepHeader
        step="Result"
        title={category === 'clothing' ? 'Your fit check' : 'Your shade match'}
        onBack={backHome}
      />

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {state.kind === 'loading' && !state.partialUri && (
          <AiLoading
            labels={category === 'clothing' ? CLOTHING_LOADING_LABELS : BEAUTY_LOADING_LABELS}
            hint={loadingHint}
          />
        )}
        {state.kind === 'loading' && state.partialUri && (
          <View style={[styles.imageCard, shadow.card]}>
            <Image
              source={{ uri: state.partialUri }}
              style={styles.image}
              resizeMode="cover"
            />
            <View style={styles.partialBadge}>
              <ActivityIndicator size="small" color={colors.primaryOn} />
              <Sparkles size={14} color={colors.primaryOn} strokeWidth={2.2} />
              <Text style={styles.partialBadgeText}>Refining…</Text>
            </View>
          </View>
        )}
        {state.kind === 'error' && <AiError message={state.message} onRetry={run} />}
        {state.kind === 'no-credits' && <NoCredits reason={state.reason} />}

        {state.kind === 'ok' && (
          <View style={[styles.imageCard, shadow.card]}>
            {displayUri && (
              <Image source={{ uri: displayUri }} style={styles.image} resizeMode="cover" />
            )}

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

        {state.kind === 'ok' && (
          <Pressable
            onPress={() => router.push('/history')}
            style={[styles.savedBanner, shadow.card]}
          >
            <View style={styles.savedIcon}>
              <Check size={14} color={colors.primaryOn} strokeWidth={2.6} />
            </View>
            <View style={styles.savedText}>
              <Text style={styles.savedTitle}>Saved to your history</Text>
              <Text style={styles.savedHint}>
                Tap to view, add product details, or save to wishlist later
              </Text>
            </View>
            <Clock size={16} color={colors.textFaint} strokeWidth={2} />
          </Pressable>
        )}

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
  enlargeOverlay: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
  },
  partialBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(10,10,10,0.72)',
  },
  partialBadgeText: {
    ...type.caption,
    color: colors.primaryOn,
    fontSize: 12,
    fontWeight: '600',
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
  savedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  savedIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedText: { flex: 1, gap: 2 },
  savedTitle: { ...type.heading, fontSize: 14, color: colors.text },
  savedHint: { ...type.caption, color: colors.textMuted, fontSize: 12, lineHeight: 16 },
  cta: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
