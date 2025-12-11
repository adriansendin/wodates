import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  ActivityIndicator,
  Alert,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useRegistrationStore } from '../../../src/domain/stores/registrationStore';
import { useAuthStore } from '../../../src/domain/stores/authStore';
import { ProgressBar } from '../../../src/components/ProgressBar';
import { PlatformInfo } from '../../../src/components/PlatformInfo';
import { 
  pickImageFromGallery, 
  takePictureWithCamera,
  uploadAvatarToBackend,
} from '../../../src/data/api/imageService';
import { AvatarPicker } from '../../../src/components/AvatarPicker';

// Removed external placeholder; AvatarPicker shows empty background when no uri

export default function Step7Screen() {
  const router = useRouter();
  const { data, updateData, nextStep, previousStep } = useRegistrationStore();
  const { user } = useAuthStore();
  
  const [avatarUri, setAvatarUri] = useState<string | null>(data.avatarUrl);
  const [isUploading, setIsUploading] = useState(false);

  const handleSelectImage = () => {
    // Check if running on web
    if (Platform.OS === 'web') {
      Alert.alert(
        'Seleccionar foto de perfil',
        'Elige una foto desde tu computadora para tu perfil',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Seleccionar archivo', onPress: handlePickFromGallery },
        ]
      );
      return;
    }

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancelar', 'Tomar foto', 'Elegir de galería'],
          cancelButtonIndex: 0,
        },
        async (buttonIndex) => {
          if (buttonIndex === 1) {
            await handleTakePhoto();
          } else if (buttonIndex === 2) {
            await handlePickFromGallery();
          }
        }
      );
    } else {
      // Android: Show alert dialog
      Alert.alert(
        'Seleccionar foto',
        '¿De dónde quieres obtener tu foto?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Tomar foto', onPress: handleTakePhoto },
          { text: 'Elegir de galería', onPress: handlePickFromGallery },
        ]
      );
    }
  };

  const handleTakePhoto = async () => {
    const result = await takePictureWithCamera();
    
    if (!result.success) {
      Alert.alert('Error', result.error.message);
      return;
    }

    if (result.data) {
      setAvatarUri(result.data);
    }
  };

  const handlePickFromGallery = async () => {
    const result = await pickImageFromGallery();
    
    if (!result.success) {
      Alert.alert('Error', result.error.message);
      return;
    }

    if (result.data) {
      setAvatarUri(result.data);
    }
  };

  const handleNext = async () => {
    if (!avatarUri) {
      // User can skip adding a photo
      updateData({ avatarUrl: null });
      nextStep();
      router.push('/(auth)/register/complete');
      return;
    }

    // We need a user ID to upload the avatar
    // In registration flow, we don't have a user ID yet
    // So we'll store the local URI and upload it after registration is complete
    updateData({ avatarUrl: avatarUri });
    nextStep();
    router.push('/(auth)/register/complete');
  };

  const handleBack = () => {
    previousStep();
    router.back();
  };

  const handleSkip = () => {
    updateData({ avatarUrl: null });
    nextStep();
    router.push('/(auth)/register/complete');
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ProgressBar totalSteps={7} currentStep={7} />

        <View style={styles.content}>
          <Text style={styles.title}>Añade tu foto de perfil</Text>

          <View style={styles.avatarContainer}>
            <AvatarPicker
              uri={avatarUri}
              size={200}
              disabled={isUploading}
              onChange={(localUri) => {
                setAvatarUri(localUri);
              }}
              helperText={avatarUri ? 'Toca el botón para cambiar la foto' : 'Añade tu foto de perfil (opcional)'}
            />
          </View>

          <Text style={styles.infoText}>
            Podrás cambiar esta preferencia más adelante.
          </Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.button} 
              onPress={handleNext}
              disabled={isUploading}
            >
              {isUploading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Continuar</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.skipButton} 
              onPress={handleSkip}
              disabled={isUploading}
            >
              <Text style={styles.skipButtonText}>Omitir por ahora</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.backButton} 
              onPress={handleBack}
              disabled={isUploading}
            >
              <Text style={styles.backButtonText}>Volver</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    paddingTop: 0,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2C3E50',
    textAlign: 'center',
    marginBottom: 8,
    marginTop: 24,
  },
  subtitle: {
    fontSize: 16,
    color: '#7F8C8D',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarWrapper: {
    position: 'relative',
    width: 200,
    height: 200,
    borderRadius: 100,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  avatarOverlayIcon: {
    fontSize: 40,
  },
  avatarOverlayText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 14,
    color: '#7F8C8D',
    textAlign: 'center',
    marginBottom: 24,
  },
  buttonContainer: {
    gap: 12,
    marginTop: 'auto',
  },
  button: {
    backgroundColor: '#F45C5C',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  skipButton: {
    borderWidth: 2,
    borderColor: '#F45C5C',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  skipButtonText: {
    color: '#F45C5C',
    fontSize: 16,
    fontWeight: 'bold',
  },
  backButton: {
    padding: 12,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#7F8C8D',
    fontSize: 14,
  },
  infoText: {
    fontSize: 14,
    color: '#95A5A6',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
    lineHeight: 20,
  },
});

