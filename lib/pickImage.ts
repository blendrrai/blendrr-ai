import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { setPendingCameraCallback } from './cameraBridge';

export type PickSource = 'camera' | 'library';

async function ensureLibraryPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === 'granted';
}

export async function pickFromLibrary(): Promise<string | null> {
  const ok = await ensureLibraryPermission();
  if (!ok) {
    Alert.alert('Permission needed', 'BLENDRR Ai needs photo library access to pick images.');
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.9,
    allowsEditing: false,
  });

  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0].uri;
}

/**
 * Show the iOS-style action sheet for picking a photo. Camera taps open the
 * custom in-app camera (no iOS confirm screen). Library taps use the system picker.
 */
export function presentPickerSheet(
  onPick: (uri: string) => void,
  opts?: { cameraLabel?: string; libraryLabel?: string; title?: string },
) {
  Alert.alert(opts?.title ?? 'Add a photo', undefined, [
    {
      text: opts?.cameraLabel ?? 'Take photo',
      onPress: () => {
        setPendingCameraCallback((uri) => {
          if (uri) onPick(uri);
        });
        router.push('/camera');
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
