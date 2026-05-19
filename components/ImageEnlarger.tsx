import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Maximize2, X } from 'lucide-react-native';
import { colors, radius, spacing } from '../lib/theme';

type Props = {
  uri: string | null;
  visible: boolean;
  onClose: () => void;
};

export function ImageEnlargerModal({ uri, visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  if (!uri) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={styles.backdrop}>
        <Image source={{ uri }} style={styles.image} resizeMode="contain" />
        <Pressable
          onPress={onClose}
          hitSlop={10}
          style={[styles.closeBtn, { top: insets.top + spacing.md }]}
        >
          <X size={20} color={colors.primaryOn} strokeWidth={2.4} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

type ButtonProps = {
  onPress: () => void;
  style?: import('react-native').ViewStyle;
};

export function EnlargeButton({ onPress, style }: ButtonProps) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={[styles.enlargeBtn, style]}>
      <Maximize2 size={14} color={colors.primaryOn} strokeWidth={2.4} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '90%' },
  closeBtn: {
    position: 'absolute',
    right: spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  enlargeBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(10,10,10,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
