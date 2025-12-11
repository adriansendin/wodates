import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
  ActionSheetIOS,
  Alert,
} from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { useAuthStore } from '../../src/domain/stores/authStore';
import { useUserPhotos } from '../../src/features/profile/photos/useUserPhotos';
import { PhotoGrid } from '../../src/features/profile/photos/PhotoGrid';
import { DeletePhotoModal } from '../../src/features/profile/photos/DeletePhotoModal';
import {
  pickImageFromGallery,
  takePictureWithCamera,
} from '../../src/data/api/imageService';
import { ArrowLeft } from 'lucide-react-native';
import { TouchableOpacity } from 'react-native';

export default function PhotosScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [photoToDelete, setPhotoToDelete] = useState<string | null>(null);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);

  const {
    photos,
    isLoading,
    error,
    isUploading,
    isDeleting,
    isSettingMain,
    uploadPhoto,
    deletePhoto,
    setMainPhoto,
    refreshPhotos,
  } = useUserPhotos(user?.id || null);

  // Refresh photos when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      console.log('[PhotosScreen] Screen focused, refreshing photos...');
      if (user?.id) {
        refreshPhotos();
      }
    }, [user?.id, refreshPhotos])
  );

  const mainPhoto = photos.find((p) => p.is_main) || null;
  const otherPhotos = photos.filter((p) => !p.is_main);

  const handleAddPhoto = async () => {
    console.log('[PhotosScreen] handleAddPhoto called');
    
    const pickFromGallery = async () => {
      try {
        console.log('[PhotosScreen] Picking image from gallery...');
        const result = await pickImageFromGallery();
        console.log('[PhotosScreen] Pick result:', result);
        if (!result.success) {
          Alert.alert('Error', result.error.message || 'Failed to pick image');
          return;
        }

        if (result.data) {
          console.log('[PhotosScreen] Uploading photo:', result.data);
          const uploadResult = await uploadPhoto(result.data);
          console.log('[PhotosScreen] Upload result:', uploadResult);
          if (!uploadResult.success) {
            Alert.alert('Error', uploadResult.error.message || 'Failed to upload photo');
          } else {
            console.log('[PhotosScreen] Photo uploaded successfully');
          }
        } else {
          console.log('[PhotosScreen] User cancelled image picker');
        }
      } catch (error) {
        console.error('[PhotosScreen] Error in pickFromGallery:', error);
        Alert.alert('Error', 'Failed to pick image from gallery');
      }
    };

    const takePhoto = async () => {
      try {
        console.log('[PhotosScreen] Taking picture with camera...');
        const result = await takePictureWithCamera();
        console.log('[PhotosScreen] Camera result:', result);
        if (!result.success) {
          Alert.alert('Error', result.error.message || 'Failed to take picture');
          return;
        }

        if (result.data) {
          console.log('[PhotosScreen] Uploading photo:', result.data);
          const uploadResult = await uploadPhoto(result.data);
          console.log('[PhotosScreen] Upload result:', uploadResult);
          if (!uploadResult.success) {
            Alert.alert('Error', uploadResult.error.message || 'Failed to upload photo');
          } else {
            console.log('[PhotosScreen] Photo uploaded successfully');
          }
        } else {
          console.log('[PhotosScreen] User cancelled camera');
        }
      } catch (error) {
        console.error('[PhotosScreen] Error in takePhoto:', error);
        Alert.alert('Error', 'Failed to take picture');
      }
    };

    if (Platform.OS === 'web') {
      // On web, show options for gallery or camera
      // Mobile web browsers will show camera option in file picker when capture attribute is used
      console.log('[PhotosScreen] Web platform detected, showing options...');
      
      // On desktop web, just open file picker (gallery)
      try {
        await pickFromGallery();
      } catch (error) {
        console.error('[PhotosScreen] Error in handleAddPhoto on web:', error);
      }
      return;
    }

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancelar', 'Tomar foto', 'Elegir de galería'],
          cancelButtonIndex: 0,
        },
        async (buttonIndex) => {
          if (buttonIndex === 1) await takePhoto();
          if (buttonIndex === 2) await pickFromGallery();
        }
      );
    } else {
      Alert.alert('Añadir foto', '¿De dónde quieres obtener tu foto?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Tomar foto', onPress: takePhoto },
        { text: 'Elegir de galería', onPress: pickFromGallery },
      ]);
    }
  };

  const handleSetMain = async (photoId: string) => {
    console.log('[PhotosScreen] Setting photo as main:', photoId);
    const result = await setMainPhoto(photoId);
    if (result.success) {
      Alert.alert('Éxito', 'La foto se ha establecido como principal');
    } else {
      Alert.alert('Error', result.error.message || 'No se pudo establecer la foto como principal');
    }
  };

  const handleDeleteRequest = (photoId: string) => {
    setPhotoToDelete(photoId);
    setIsDeleteModalVisible(true);
  };

  const handleDeleteConfirm = async () => {
    if (!photoToDelete) return;

    const result = await deletePhoto(photoToDelete);
    setIsDeleteModalVisible(false);
    setPhotoToDelete(null);

    if (!result.success) {
      Alert.alert('Error', result.error.message || 'Failed to delete photo');
    }
  };

  const handleDeleteCancel = () => {
    setIsDeleteModalVisible(false);
    setPhotoToDelete(null);
  };

  const disabled = isUploading || isDeleting || isSettingMain;

  const handleBackToProfile = () => {
    router.push('/profile');
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: '',
          headerLeft: () => (
            <TouchableOpacity
              onPress={handleBackToProfile}
              style={styles.headerBrandContainer}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ArrowLeft size={22} color="#e91e63" />
              <Text style={styles.headerBrandText}>Wodates</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <View style={styles.container}>
        {/* Content */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#e91e63" />
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <PhotoGrid
            photos={photos}
            mainPhoto={mainPhoto}
            otherPhotos={otherPhotos}
            onSetMain={handleSetMain}
            onDelete={handleDeleteRequest}
            onAdd={handleAddPhoto}
            disabled={disabled}
          />
        )}

        {/* Loading overlay */}
        {(isUploading || isDeleting || isSettingMain) && (
          <View style={styles.overlay}>
            <View style={styles.overlayContent}>
              <ActivityIndicator size="large" color="#e91e63" />
              <Text style={styles.overlayText}>
                {isUploading && 'Subiendo foto...'}
                {isDeleting && 'Eliminando foto...'}
                {isSettingMain && 'Actualizando foto principal...'}
              </Text>
            </View>
          </View>
        )}

        {/* Delete confirmation modal */}
        <DeletePhotoModal
          visible={isDeleteModalVisible}
          onClose={handleDeleteCancel}
          onConfirm={handleDeleteConfirm}
          isDeleting={isDeleting}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  headerBrandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
    paddingVertical: 4,
  },
  headerBrandText: {
    marginLeft: 8,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e91e63',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
    textAlign: 'center',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  overlayText: {
    fontSize: 16,
    color: '#333',
  },
});

