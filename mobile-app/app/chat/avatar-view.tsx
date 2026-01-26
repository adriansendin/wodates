import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PhotoCarousel, Photo } from '../../src/components/PhotoCarousel';
import { UserPhotoApi } from '../../src/data/api/userPhotoApi';
import { ProfileApi } from '../../src/data/api/profileApi';
import { ChatApi } from '../../src/data/api/chatApi';
import { ApiClient } from '../../src/data/api/apiClient';
import { useAuthStore } from '../../src/domain/stores/authStore';
import { useMatchesStore } from '../../src/domain/stores/matchesStore';
import { getApiUrl } from '../../src/utils/apiConfig';
import { BioPopupModal } from '../../src/components/BioPopupModal';
import { AffinityModal } from '../../src/components/AffinityModal';
import { UserProfile } from '../../src/domain/entities/UserProfile';

const API_URL = getApiUrl();

// Helper functions for age calculation (same as feed)
const getAgeFromBirthDate = (birthDate?: string | null) => {
  if (!birthDate) {
    return undefined;
  }

  const parsed = new Date(birthDate);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  const today = new Date();
  let age = today.getFullYear() - parsed.getFullYear();
  const monthDiff = today.getMonth() - parsed.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < parsed.getDate())) {
    age -= 1;
  }

  return age;
};

const resolveAge = (candidate: { age?: number | null; birthDate?: string | null }) => {
  if (typeof candidate.age === 'number') {
    return candidate.age;
  }
  return getAgeFromBirthDate(candidate.birthDate);
};

// Labels for characteristics (same as profile screen)
const GENDER_LABELS: Record<'male' | 'female' | 'non_binary', string> = {
  male: 'Male',
  female: 'Female',
  non_binary: 'Non-binary',
};

const LOOKING_FOR_LABELS: Record<'male' | 'female' | 'both', string> = {
  male: 'Men',
  female: 'Women',
  both: 'Both',
};

const WANTS_CHILDREN_LABELS: Record<'yes' | 'no' | 'not_sure', string> = {
  yes: 'Yes',
  no: 'No',
  not_sure: 'Not sure',
};

const SMOKING_LABELS: Record<'no' | 'occasionally' | 'regularly', string> = {
  no: 'No',
  occasionally: 'Occasionally',
  regularly: 'Regularly',
};

export default function AvatarViewScreen() {
  const params = useLocalSearchParams<{
    photoUrl?: string | string[];
    name?: string | string[];
    otherUserId?: string | string[];
    otherUserBio?: string | string[];
    otherUserShowBioInFeed?: string | string[];
    matchId?: string | string[];
    birthDate?: string | string[];
    gender?: string | string[];
    isBot?: string | string[];
  }>();
  const router = useRouter();
  const { tokens } = useAuthStore();
  const { matches } = useMatchesStore();

  const photoUrl = Array.isArray(params.photoUrl) ? params.photoUrl[0] : params.photoUrl;
  const otherUserId = Array.isArray(params.otherUserId) ? params.otherUserId[0] : params.otherUserId;
  const name = Array.isArray(params.name) ? params.name[0] : params.name;
  const otherUserBio = Array.isArray(params.otherUserBio) ? params.otherUserBio[0] : params.otherUserBio;
  const otherUserShowBioInFeedParam = Array.isArray(params.otherUserShowBioInFeed) 
    ? params.otherUserShowBioInFeed[0] 
    : params.otherUserShowBioInFeed;
  const otherUserShowBioInFeed = otherUserShowBioInFeedParam === 'true' ? true 
    : otherUserShowBioInFeedParam === 'false' ? false 
    : null;
  const matchId = Array.isArray(params.matchId) ? params.matchId[0] : params.matchId;
  const birthDate = Array.isArray(params.birthDate) ? params.birthDate[0] : params.birthDate;
  const gender = Array.isArray(params.gender) ? params.gender[0] : params.gender;
  const isBotParam = Array.isArray(params.isBot) ? params.isBot[0] : params.isBot;
  const isBot = isBotParam === 'true';

  const [userPhotos, setUserPhotos] = useState<Photo[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(true);
  const [otherUserProfile, setOtherUserProfile] = useState<UserProfile | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [showBioPopup, setShowBioPopup] = useState(false);
  const [affinitySentences, setAffinitySentences] = useState<string[]>([]);
  const [isLoadingSentences, setIsLoadingSentences] = useState(false);
  const [showAffinityModal, setShowAffinityModal] = useState(false);
  const [otherUserFullProfile, setOtherUserFullProfile] = useState<UserProfile | null>(null);

  // Calculate age
  const age = useMemo(() => {
    return resolveAge({ birthDate });
  }, [birthDate]);

  // Memoize API clients
  const apiClient = useMemo(() => new ApiClient(API_URL), []);
  const userPhotoApi = useMemo(() => new UserPhotoApi(apiClient), [apiClient]);
  const profileApi = useMemo(() => new ProfileApi(apiClient), [apiClient]);
  const chatApi = useMemo(() => new ChatApi(apiClient), [apiClient]);

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
  const loadOtherUserProfile = useCallback(async () => {
    setOtherUserProfile({
      id: otherUserId || '',
      bio: otherUserBio && otherUserBio.trim() !== '' ? otherUserBio : null,
      show_bio_in_feed: otherUserShowBioInFeed,
    } as UserProfile);

    // Try to get full profile from match
    if (matchId) {
      const currentMatch = matches.find(m => m.id === matchId);
      if (currentMatch?.otherUser) {
        const otherUser = currentMatch.otherUser as any;
        setOtherUserFullProfile({
          id: otherUser.id || '',
          gender: otherUser.gender || null,
          looking_for: otherUser.looking_for || null,
          has_children: otherUser.has_children ?? null,
          wants_children: otherUser.wants_children || null,
          cares_about_partner_children: otherUser.cares_about_partner_children || null,
          smoking: otherUser.smoking || null,
          cares_about_partner_smoking: otherUser.cares_about_partner_smoking || null,
          bio: otherUser.bio || null,
          show_bio_in_feed: otherUser.show_bio_in_feed ?? null,
        } as UserProfile);
      } else {
        // Fallback to basic info from params
        setOtherUserFullProfile({
          id: otherUserId || '',
          gender: gender || null,
          bio: otherUserBio && otherUserBio.trim() !== '' ? otherUserBio : null,
          show_bio_in_feed: otherUserShowBioInFeed,
        } as UserProfile);
      }
    } else {
      // Fallback to basic info from params
      setOtherUserFullProfile({
        id: otherUserId || '',
        gender: gender || null,
        bio: otherUserBio && otherUserBio.trim() !== '' ? otherUserBio : null,
        show_bio_in_feed: otherUserShowBioInFeed,
      } as UserProfile);
    }
  }, [otherUserId, otherUserBio, otherUserShowBioInFeed, matchId, matches, gender]);

  // Load affinity sentence from chat
  const loadAffinitySentence = useCallback(async () => {
    if (!matchId || !tokens?.accessToken) {
      setAffinitySentences([]);
      return;
    }

    setIsLoadingSentences(true);
    try {
      const result = await chatApi.getAffinitySentence(matchId, tokens.accessToken);
      if (result.success) {
        setAffinitySentences([result.data.sentence]);
      } else {
        setAffinitySentences(['Initial affinity is low—conversation will sharpen recommendations.']);
      }
    } catch (error) {
      console.error('[AvatarViewScreen] Failed to load affinity sentence:', error);
      setAffinitySentences(['Initial affinity is low—conversation will sharpen recommendations.']);
    } finally {
      setIsLoadingSentences(false);
    }
  }, [matchId, tokens?.accessToken, chatApi]);

  useEffect(() => {
    loadUserPhotos();
    if (!isBot) {
      loadCurrentUserProfile();
      loadOtherUserProfile();
      loadAffinitySentence();
    }
  }, [loadUserPhotos, loadCurrentUserProfile, loadOtherUserProfile, loadAffinitySentence, isBot]);

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
              {!isBot && (
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#e91e63', marginLeft: 8 }}>
                  {name || 'Wodates'}
                </Text>
              )}
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
        
        {/* If it's a bot (Doc Love), only show the photo, nothing else */}
        {!isBot && (
          <>
            {/* Gradient overlay */}
            <LinearGradient
              colors={['transparent', 'transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.6)']}
              locations={[0, 0.6, 0.85, 1]}
              style={styles.gradientOverlay}
              pointerEvents="none"
            />
            
            {/* Content overlay - allows swipe through */}
            <View style={styles.contentOverlay} pointerEvents="box-none">
              {/* Name and age pill with Affinity button */}
              <View style={styles.namePillContainer}>
                <View style={styles.namePill}>
                  <Text style={styles.namePillText}>
                    {name || 'User'}
                    {typeof age === 'number' ? `, ${age}` : null}
                  </Text>
                </View>
                
                {/* Affinity chip - next to name */}
                {isLoadingSentences ? (
                  <TouchableOpacity
                    style={[styles.affinityChip, styles.affinityChipLoading]}
                    disabled
                    accessibilityRole="button"
                    accessibilityLabel="Loading affinity"
                  >
                    <ActivityIndicator size="small" color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.affinityChipText}>Finding highlights...</Text>
                  </TouchableOpacity>
                ) : affinitySentences.length > 0 ? (
                  <TouchableOpacity
                    style={styles.affinityChip}
                    onPress={() => setShowAffinityModal(true)}
                    accessibilityRole="button"
                    accessibilityLabel="View affinity"
                    accessibilityHint="Opens detailed affinity information"
                    activeOpacity={0.8}
                  >
                    <Text style={styles.affinityChipText}>Affinity</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              
              {/* Bio text - scrollable */}
              {otherUserProfile?.bio && otherUserProfile.bio.trim() !== '' ? (
                <View style={styles.bioContainer}>
                  <ScrollView 
                    style={styles.bioScrollView}
                    nestedScrollEnabled={true}
                    showsVerticalScrollIndicator={false}
                  >
                    <Text style={styles.bioText}>
                      {otherUserProfile.bio}
                    </Text>
                  </ScrollView>
                  <Text style={styles.bioMicrotext}>Based on conversations</Text>
                </View>
              ) : null}
            </View>

            {/* Bio Popup Modal */}
            <BioPopupModal
              visible={showBioPopup}
              bio={otherUserProfile?.bio}
              onClose={() => setShowBioPopup(false)}
            />

            {/* Affinity Modal */}
            <AffinityModal
              visible={showAffinityModal}
              affinitySentences={affinitySentences}
              onClose={() => setShowAffinityModal(false)}
            />
          </>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  // Subtle gradient - no black bar
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 300,
  },
  // Content overlay - allows swipe through (pointerEvents="box-none")
  // Positioned lower since there are no like/dislike buttons
  contentOverlay: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  namePillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  namePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  namePillText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  bioContainer: {
    marginTop: 4,
  },
  bioScrollView: {
    maxHeight: 66, // Approximately 3 lines (22 lineHeight * 3)
  },
  bioText: {
    fontSize: 15,
    color: '#fff',
    lineHeight: 22,
    opacity: 0.95,
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bioMicrotext: {
    fontSize: 11,
    color: '#fff',
    opacity: 0.7,
    fontStyle: 'italic',
    marginTop: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  // Affinity chip - next to name
  affinityChip: {
    backgroundColor: 'rgba(233, 30, 99, 0.75)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  affinityChipLoading: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  affinityChipText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  characteristicsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    gap: 8,
  },
  characteristicChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  characteristicChipText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

