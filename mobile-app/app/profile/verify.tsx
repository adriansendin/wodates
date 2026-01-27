import React, { useEffect, useMemo, useState } from 'react';
import {
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
import { notifySystem } from '../../src/utils/notificationService';

export default function VerifyProfileScreen() {
  const router = useRouter();
  const { user, tokens } = useAuthStore();
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
    try {
      const pickResult = await pickImageFromGallery();
      
      // User cancelled - silently return, no error message
      if (pickResult.success && !pickResult.data) {
        return;
      }

      if (!pickResult.success) {
        // Image picker errors are system errors
        notifySystem('Something went wrong', 'Try again', pickResult.error);
        return;
      }

      if (!pickResult.data) {
        return;
      }

      const uploadResult = await uploadVerificationSelfie(pickResult.data);
      if (!uploadResult.success) {
        // Upload errors are system errors
        notifySystem('Something went wrong', 'Try again', uploadResult.error);
        return;
      }

      Alert.alert(
        'Selfie received!',
        "We've received your selfie. Our team will review your verification shortly."
      );

      router.replace('/profile');
    } catch (error) {
      console.error('[VerifyProfile] Error in handleSubmit:', error);
      // Network/unexpected errors are system errors
      notifySystem('Something went wrong', 'Try again', error, handleSubmit);
    }
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
          <Text style={styles.title}>Verify your identity</Text>
          <Text style={styles.description}>
            Upload a clear selfie to confirm it's really you.
            It won't appear on your profile.
          </Text>

          {illustration ? (
            <Image
              source={illustration}
              style={styles.illustration}
              resizeMode="contain"
            />
          ) : null}

          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmit}
            activeOpacity={0.85}
          >
            <Text style={styles.submitButtonText}>Upload selfie</Text>
          </TouchableOpacity>
          <Text style={styles.helperText}>
            Use a clear photo, with good lighting and your full face visible.
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
