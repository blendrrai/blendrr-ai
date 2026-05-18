import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

export type PickSource = 'camera' | 'library';

async function ensurePermission(source: PickSource) {
  if (source === 'camera') {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status === 'granted';
  }
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === 'granted';
}

export async function pickImage(source: PickSource): Promise<string | null> {
  const ok = await ensurePermission(source);
  if (!ok) {
    Alert.alert(
      'Permission needed',
      source === 'camera'
        ? 'Blendrr Ai needs camera access to take selfies.'
        : 'Blendrr Ai needs photo library access to pick images.',
    );
    return null;
  }

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.9,
          allowsEditing: false,
          cameraType: ImagePicker.CameraType.front,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.9,
          allowsEditing: false,
        });

  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0].uri;
}

export function presentPickerSheet(
  onPick: (uri: string) => void,
  opts?: { cameraLabel?: string; libraryLabel?: string; title?: string },
) {
  Alert.alert(opts?.title ?? 'Add a photo', undefined, [
    {
      text: opts?.cameraLabel ?? 'Take photo',
      onPress: async () => {
        const uri = await pickImage('camera');
        if (uri) onPick(uri);
      },
    },
    {
      text: opts?.libraryLabel ?? 'Choose from library',
      onPress: async () => {
        const uri = await pickImage('library');
        if (uri) onPick(uri);
      },
    },
    { text: 'Cancel', style: 'cancel' },
  ]);
}
