import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useAuthStore } from '../../src/domain/stores/authStore';
import {
  pickImageFromGallery,
  uploadVerificationSelfie,
} from '../../src/data/api/imageService';
import { ApiClient } from '../../src/data/api/apiClient';
import { ProfileApi } from '../../src/data/api/profileApi';
import { getApiUrl } from '../../src/utils/apiConfig';

export default function VerifyProfileScreen() {
  const router = useRouter();
  const { user, tokens } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profileGender, setProfileGender] = useState<string | null>(null);

  const apiClient = useMemo(() => new ApiClient(getApiUrl()), []);
  const profileApi = useMemo(() => new ProfileApi(apiClient), [apiClient]);

  useEffect(() => {
    const loadProfile = async () => {
      if (!tokens?.accessToken) return;
      const result = await profileApi.getProfile(tokens.accessToken);
      if (result.success) {
        setProfileGender(result.data.gender ?? null);
      } else {
        console.warn('[VerifyProfile] cannot load profile', result.error);
      }
    };
    loadProfile();
  }, [profileApi, tokens?.accessToken]);

  const illustration = useMemo(() => {
    const gender = profileGender ?? user?.gender;
    if (!gender) {
      return null; // no render until we know
    }
    const isMale = gender === 'male';
    console.log(
      '[VerifyProfile] gender (profile|auth):',
      gender,
      'isMale:',
      isMale
    );
    return isMale
      ? require('../../assets/verified_man.png')
      : require('../../assets/verified_woman.png');
  }, [profileGender, user?.gender]);

  const handleBackToProfile = () => {
    router.push('/profile');
  };

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);

    const pickResult = await pickImageFromGallery();
    if (!pickResult.success) {
      Alert.alert(
        'Error',
        pickResult.error.message || 'No pudimos abrir tu galería.'
      );
      setIsSubmitting(false);
      return;
    }

    if (!pickResult.data) {
      setIsSubmitting(false);
      return;
    }

    const uploadResult = await uploadVerificationSelfie(pickResult.data);
    if (!uploadResult.success) {
      Alert.alert(
        'Error',
        uploadResult.error.message || 'No pudimos subir tu selfie.'
      );
      setIsSubmitting(false);
      return;
    }

    Alert.alert(
      '¡Selfie recibida!',
      'Hemos recibido tu selfie. Nuestro equipo revisará tu verificación en breve.'
    );

    setIsSubmitting(false);
    router.replace('/profile');
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

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Verificar tu identidad</Text>
          <Text style={styles.description}>
            Súbe un selfie claro solo para confirmar que eres tú. No aparecerá
            en tu perfil.
          </Text>

          {illustration ? (
            <Image
              source={illustration}
              style={styles.illustration}
              resizeMode="contain"
            />
          ) : null}

          <TouchableOpacity
            style={[
              styles.submitButton,
              isSubmitting ? styles.submitButtonDisabled : null,
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Subir selfie</Text>
            )}
          </TouchableOpacity>
          <Text style={styles.helperText}>
            Usa una foto sin filtros, bien iluminada y con tu rostro completo.
          </Text>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#e91e63',
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#444',
    lineHeight: 22,
    textAlign: 'center',
  },
  illustration: {
    width: '100%',
    height: 240,
  },
  submitButton: {
    backgroundColor: '#e91e63',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#f3a5c3',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  helperText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
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
});
