import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Info } from 'lucide-react-native';
import { PhotoCarousel, Photo } from '../../src/components/PhotoCarousel';
import { UserPhotoApi } from '../../src/data/api/userPhotoApi';
import { ProfileApi } from '../../src/data/api/profileApi';
import { ApiClient } from '../../src/data/api/apiClient';
import { useAuthStore } from '../../src/domain/stores/authStore';
import { getApiUrl } from '../../src/utils/apiConfig';
import { BioPopupModal } from '../../src/components/BioPopupModal';
import { UserProfile } from '../../src/domain/entities/UserProfile';

const API_URL = getApiUrl();

export default function AvatarViewScreen() {
  const params = useLocalSearchParams<{
    photoUrl?: string | string[];
    name?: string | string[];
    otherUserId?: string | string[];
    otherUserBio?: string | string[];
  }>();
  const router = useRouter();
  const { tokens } = useAuthStore();

  const photoUrl = Array.isArray(params.photoUrl) ? params.photoUrl[0] : params.photoUrl;
  const otherUserId = Array.isArray(params.otherUserId) ? params.otherUserId[0] : params.otherUserId;
  const name = Array.isArray(params.name) ? params.name[0] : params.name;
  const otherUserBio = Array.isArray(params.otherUserBio) ? params.otherUserBio[0] : params.otherUserBio;

  const [userPhotos, setUserPhotos] = useState<Photo[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(true);
  const [otherUserProfile, setOtherUserProfile] = useState<UserProfile | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [showBioPopup, setShowBioPopup] = useState(false);

  // Memoize API clients
  const apiClient = useMemo(() => new ApiClient(API_URL), []);
  const userPhotoApi = useMemo(() => new UserPhotoApi(apiClient), [apiClient]);
  const profileApi = useMemo(() => new ProfileApi(apiClient), [apiClient]);

  // Load user photos
  const loadUserPhotos = useCallback(async () => {
    if (!otherUserId || !tokens?.accessToken) {
      // Fallback to single photo if no userId or token
      if (photoUrl) {
        setUserPhotos([{
          id: 'fallback',
          public_url: photoUrl,
          is_main: true,
          position: 0,
        }]);
      } else {
        setUserPhotos([]);
      }
      setIsLoadingPhotos(false);
      return;
    }

    setIsLoadingPhotos(true);
    try {
      const result = await userPhotoApi.getUserPublicPhotos(
        otherUserId,
        tokens.accessToken
      );

      if (result.success && result.data.length > 0) {
        setUserPhotos(result.data);
      } else {
        // Fallback to single photo from params
        if (photoUrl) {
          setUserPhotos([{
            id: 'fallback',
            public_url: photoUrl,
            is_main: true,
            position: 0,
          }]);
        } else {
          setUserPhotos([]);
        }
      }
    } catch (error) {
      console.error('[AvatarViewScreen] Failed to load user photos:', error);
      // Fallback to single photo on error
      if (photoUrl) {
        setUserPhotos([{
          id: 'fallback',
          public_url: photoUrl,
          is_main: true,
          position: 0,
        }]);
      } else {
        setUserPhotos([]);
      }
    } finally {
      setIsLoadingPhotos(false);
    }
  }, [otherUserId, tokens?.accessToken, photoUrl, userPhotoApi]);

  // Load current user profile
  const loadCurrentUserProfile = useCallback(async () => {
    if (!tokens?.accessToken) {
      setCurrentUserProfile(null);
      return;
    }

    try {
      const result = await profileApi.getProfile(tokens.accessToken);
      if (result.success) {
        setCurrentUserProfile(result.data);
      }
    } catch (error) {
      console.error('[AvatarViewScreen] Failed to load current user profile:', error);
    }
  }, [tokens?.accessToken, profileApi]);

  // Load other user profile from params passed from chat screen
  // In chat context, we assume show_bio_in_feed is true by default
  const loadOtherUserProfile = useCallback(async () => {
    setOtherUserProfile({
      id: otherUserId || '',
      bio: otherUserBio || null,
      show_bio_in_feed: true, // Default to true in chat context
    } as UserProfile);
  }, [otherUserId, otherUserBio]);

  useEffect(() => {
    loadUserPhotos();
    loadCurrentUserProfile();
    loadOtherUserProfile();
  }, [loadUserPhotos, loadCurrentUserProfile, loadOtherUserProfile]);

  const fallbackPhoto = photoUrl ? { uri: photoUrl } : require('../../assets/placeholder.png');

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerStyle: {
            backgroundColor: '#ffffff',
          },
          headerLeft: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={{ marginLeft: 16, padding: 8 }}
              >
                <Ionicons name="arrow-back" size={24} color="#000000" />
              </TouchableOpacity>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#e91e63', marginLeft: 8 }}>
                {name || 'Wodates'}
              </Text>
            </View>
          ),
          headerTitle: '',
        }}
      />
      <View style={styles.container}>
        <PhotoCarousel
          photos={userPhotos}
          fallbackPhoto={fallbackPhoto}
        />
        
        {/* Info icon for bio - show if user has bio and current user has show_bio_in_feed enabled */}
        {/* In chat context, we show bio if available and current user allows it */}
        {otherUserProfile?.bio && 
         typeof currentUserProfile?.show_bio_in_feed === 'boolean' &&
         currentUserProfile?.show_bio_in_feed === true && (
          <TouchableOpacity
            style={styles.infoIconContainer}
            onPress={() => setShowBioPopup(true)}
            accessibilityRole="button"
            accessibilityLabel="Ver bio"
            accessibilityHint="Muestra la bio del usuario"
          >
            <View style={styles.infoIconCircle}>
              <Info size={20} color="#fff" />
            </View>
          </TouchableOpacity>
        )}

        {/* Bio Popup Modal */}
        <BioPopupModal
          visible={showBioPopup}
          bio={otherUserProfile?.bio}
          onClose={() => setShowBioPopup(false)}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  infoIconContainer: {
    position: 'absolute',
    bottom: 110,
    right: 20,
    zIndex: 10,
  },
  infoIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
});

