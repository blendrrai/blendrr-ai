import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking } from 'react-native';

export type PickSource = 'camera' | 'library';

async function ensureLibraryPermission(): Promise<boolean> {
  const { status, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status === 'granted') return true;
  if (!canAskAgain) {
    Alert.alert(
      'Photo library access denied',
      'BLENDRR Ai needs photo library access to pick images. Enable it in iPhone Settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ],
    );
  }
  return false;
}

async function ensureCameraPermission(): Promise<boolean> {
  const { status, canAskAgain } = await ImagePicker.requestCameraPermissionsAsync();
  if (status === 'granted') return true;
  if (!canAskAgain) {
    Alert.alert(
      'Camera access denied',
      'BLENDRR Ai needs camera access to take photos. Enable it in iPhone Settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ],
    );
  }
  return false;
}

export async function pickFromLibrary(): Promise<string | null> {
  const ok = await ensureLibraryPermission();
  if (!ok) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.9,
    allowsEditing: false,
  });

  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0].uri;
}

/**
 * Open iOS's native camera. Users get all the built-in system controls —
 * tap-to-focus, pinch-to-zoom, flash toggle, camera flip, HDR, grid overlay.
 * No custom UI to maintain and no missing features to add later.
 *
 * `preferredCamera` picks which lens the picker opens with. Users can still
 * flip inside the native UI. Defaults to back — selfie flows should pass
 * 'front' explicitly for a natural starting state.
 */
export async function pickFromCamera(
  preferredCamera: 'front' | 'back' = 'back',
): Promise<string | null> {
  const ok = await ensureCameraPermission();
  if (!ok) return null;

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.9,
    allowsEditing: false,
    cameraType:
      preferredCamera === 'front'
        ? ImagePicker.CameraType.front
        : ImagePicker.CameraType.back,
  });

  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0].uri;
}

/**
 * iOS-style action sheet for picking a photo. Camera tap opens Apple's
 * native camera (via ImagePicker.launchCameraAsync) with all system
 * controls; library tap opens the system photo picker.
 *
 * Pass `preferredCamera: 'front'` for selfie-oriented flows so the camera
 * opens with the user's face already framed.
 */
export function presentPickerSheet(
  onPick: (uri: string) => void,
  opts?: {
    cameraLabel?: string;
    libraryLabel?: string;
    title?: string;
    preferredCamera?: 'front' | 'back';
  },
) {
  Alert.alert(opts?.title ?? 'Add a photo', undefined, [
    {
      text: opts?.cameraLabel ?? 'Take photo',
      onPress: async () => {
        const uri = await pickFromCamera(opts?.preferredCamera);
        if (uri) onPick(uri);
      },
    },
    {
      text: opts?.libraryLabel ?? 'Choose from library',
      onPress: async () => {
        const uri = await pickFromLibrary();
        if (uri) onPick(uri);
      },
    },
    { text: 'Cancel', style: 'cancel' },
  ]);
}
