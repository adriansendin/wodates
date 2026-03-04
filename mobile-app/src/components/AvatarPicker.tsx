import React from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  ActionSheetIOS,
  Alert,
  Text,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import {
  pickImageFromGallery,
  takePictureWithCamera,
} from '../data/api/imageService';

type Props = {
  uri: string | null | undefined;
  size: number;
  disabled?: boolean;
  onChange: (localUri: string | null) => Promise<void> | void;
  showHelperText?: boolean;
  helperText?: string;
};

export function AvatarPicker({
  uri,
  size,
  disabled,
  onChange,
  showHelperText = true,
  helperText,
}: Props) {
  const { t } = useTranslation('common');
  const [busy, setBusy] = React.useState(false);

  const handlePick = async () => {
    if (disabled || busy) return;

    const pickFromGallery = async () => {
      setBusy(true);
      const result = await pickImageFromGallery();
      if (result.success && result.data) {
        await onChange(result.data);
      }
      setBusy(false);
    };

    const takePhoto = async () => {
      setBusy(true);
      const result = await takePictureWithCamera();
      if (result.success && result.data) {
        await onChange(result.data);
      }
      setBusy(false);
    };

    if (Platform.OS === 'web') {
      return pickFromGallery();
    }

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [
            t('common.cancel'),
            t('common.takePhoto'),
            t('common.chooseFromGallery'),
          ],
          cancelButtonIndex: 0,
        },
        async (idx) => {
          if (idx === 1) await takePhoto();
          if (idx === 2) await pickFromGallery();
        }
      );
      return;
    }

    Alert.alert(t('common.selectPhoto'), t('common.selectPhotoFrom'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.takePhoto'), onPress: takePhoto },
      { text: t('common.chooseFromGallery'), onPress: pickFromGallery },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.avatarFrame, { width: size, height: size }]}>
        <View
          style={[
            styles.avatarWrapper,
            { width: size, height: size, borderRadius: size / 2 },
          ]}
        >
          {/* Mostrar imagen solo si hay uri; si no, fondo gris claro */}
          {uri ? (
            <Image
              source={{ uri }}
              style={styles.avatarImage}
              resizeMode="cover"
            />
          ) : null}
        </View>

        <TouchableOpacity
          onPress={handlePick}
          activeOpacity={0.85}
          style={[
            styles.fab,
            {
              width: Math.max(36, size * 0.2),
              height: Math.max(36, size * 0.2),
              borderRadius: Math.max(18, (size * 0.2) / 2),
            },
          ]}
          disabled={disabled || busy}
          accessibilityLabel={t('common.changeProfilePhoto')}
        >
          {busy ? (
            <ActivityIndicator color="#F45C5C" />
          ) : (
            <Ionicons name="pencil" size={18} color="#F45C5C" />
          )}
        </TouchableOpacity>
      </View>
      {showHelperText ? (
        <Text style={styles.helperText}>
          {helperText ??
            (uri ? t('common.tapToChangePhoto') : t('common.addProfilePhoto'))}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  avatarFrame: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrapper: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  avatarImage: { width: '100%', height: '100%' },
  fab: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#F45C5C',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  fabIcon: { color: '#F45C5C', fontSize: 18, fontWeight: '700' },
  helperText: { marginTop: 8, fontSize: 12, color: '#777' },
});
