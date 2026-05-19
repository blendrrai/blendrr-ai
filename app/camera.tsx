import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { Repeat, X } from 'lucide-react-native';
import { colors, radius, shadow, spacing, type } from '../lib/theme';
import { resolveCameraCapture } from '../lib/cameraBridge';

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [facing, setFacing] = useState<CameraType>('front');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  const cancel = () => {
    resolveCameraCapture(null);
    router.back();
  };

  const flip = () => {
    setFacing((f) => (f === 'front' ? 'back' : 'front'));
  };

  const capture = async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.92,
        skipProcessing: false,
      });
      if (!photo?.uri) {
        setBusy(false);
        return;
      }
      let finalUri = photo.uri;
      if (facing === 'front') {
        try {
          const flipped = await ImageManipulator.manipulateAsync(
            photo.uri,
            [{ flip: ImageManipulator.FlipType.Horizontal }],
            { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG },
          );
          finalUri = flipped.uri;
        } catch {
          // fall back to un-mirrored if manipulator fails
        }
      }
      resolveCameraCapture(finalUri);
      router.back();
    } catch {
      setBusy(false);
    }
  };

  if (!permission) {
    return <View style={styles.permissionWrap} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionWrap}>
        <View style={styles.permissionCard}>
          <Text style={styles.permissionTitle}>Camera access needed</Text>
          <Text style={styles.permissionBody}>
            Allow Blendrr to use the camera so you can take selfies for try-ons and analyses.
          </Text>
          <View style={styles.permissionActions}>
            <Pressable onPress={cancel} style={styles.permissionGhost}>
              <Text style={styles.permissionGhostLabel}>Cancel</Text>
            </Pressable>
            <Pressable onPress={requestPermission} style={styles.permissionPrimary}>
              <Text style={styles.permissionPrimaryLabel}>Allow camera</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView ref={cameraRef} facing={facing} style={styles.preview} mirror={false} />

      <SafeAreaView style={styles.topBar} pointerEvents="box-none">
        <Pressable onPress={cancel} hitSlop={12} style={styles.iconBtn}>
          <X size={20} color={colors.primaryOn} strokeWidth={2.2} />
        </Pressable>
      </SafeAreaView>

      <SafeAreaView style={styles.bottomBar} pointerEvents="box-none" edges={['bottom']}>
        <View style={styles.bottomRow}>
          <View style={styles.sideSlot} />
          <Pressable onPress={capture} disabled={busy} hitSlop={12} style={styles.shutterWrap}>
            <View style={[styles.shutterOuter, busy && styles.shutterBusy]}>
              <View style={styles.shutterInner} />
            </View>
          </Pressable>
          <View style={styles.sideSlot}>
            <Pressable onPress={flip} hitSlop={12} style={styles.iconBtn}>
              <Repeat size={20} color={colors.primaryOn} strokeWidth={2.2} />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  preview: { ...StyleSheet.absoluteFillObject },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingBottom: spacing.lg,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
  },
  sideSlot: { width: 56, alignItems: 'center', justifyContent: 'center' },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  shutterWrap: { alignItems: 'center', justifyContent: 'center' },
  shutterOuter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.85)',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterBusy: { opacity: 0.5 },
  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#FFFFFF',
  },
  permissionWrap: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, justifyContent: 'center' },
  permissionCard: {
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
    ...shadow.card,
  },
  permissionTitle: { ...type.heading, color: colors.text, fontSize: 18 },
  permissionBody: { ...type.body, color: colors.textMuted, lineHeight: 22 },
  permissionActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  permissionGhost: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
  },
  permissionGhostLabel: { ...type.heading, fontSize: 14, color: colors.text },
  permissionPrimary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  permissionPrimaryLabel: { ...type.heading, fontSize: 14, color: colors.primaryOn },
});
