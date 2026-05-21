import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as MediaLibrary from 'expo-media-library';
import { Check, Clock, Download, Heart, RotateCcw, Share2 } from 'lucide-react-native';
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

type State =
  | { kind: 'loading' }
  | { kind: 'ok'; uri: string }
  | { kind: 'error'; message: string }
  | { kind: 'no-credits'; reason: string };

export default function ResultScreen() {
  const { selfieUri, productUris, productUrls, zone, mode, quality, resetTryOn } = useLook();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [view, setView] = useState<'before' | 'after'>('after');
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
          case 'pending':
          case 'processing': {
            // Keep polling. 2s interval is a reasonable balance — fast enough
            // for the user to feel responsive, slow enough not to hammer the API.
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
            setState({ kind: 'ok', uri: resultUri });
            setView('after');
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
        message: 'Look what I just tried on with BLENDRR Ai 💄',
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

  const loadingHint = quality === 'ultra'
    ? "Ultra HD try-ons take 40 seconds to 1 minute — we're getting every detail pixel-perfect. You can swipe to another app, but don't close BLENDRR."
    : "This usually takes 15–30 seconds. You can swipe to another app, but don't close BLENDRR.";

  return (
    <Screen>
      <StepHeader
        step="Result"
        title="Your shade match"
        onBack={backHome}
      />

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {state.kind === 'loading' && (
          <AiLoading
            label="Blending your shade…"
            hint={loadingHint}
          />
        )}
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
