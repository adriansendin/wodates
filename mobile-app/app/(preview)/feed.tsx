import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { FeedCandidate } from '../../src/domain/entities/FeedCandidate';
import { RegistrationModal } from '../../src/components/RegistrationModal';
import { BioPopupModal } from '../../src/components/BioPopupModal';
import { X, Check } from 'lucide-react-native';
import { usePreviewStore } from '../../src/domain/stores/previewStore';

const FALLBACK_PHOTO = require('../../assets/placeholder.png');

// Static preview data - matches the structure of real FeedCandidate
const PREVIEW_USER_DATA: FeedCandidate = {
  id: 'preview-female-user-id',
  name: 'Alex',
  bio: 'Works in tech but trades the screen for a quiet kitchen and slow cooking every night. She picks mountain hikes and road trips over any resort. Often found in local bookstores or home with her cat. Seeks a calm, one-on-one connection.',
  age: 31,
  gender: 'female',
  photoUrl: null, // Will use placeholder
  birthDate: null,
  show_bio_in_feed: true, // Must be true to show the (i) button
  city: 'London',
  location: {
    latitude: 51.5074,
    longitude: -0.1278,
    city: 'London',
    country: 'UK',
  },
};

// Static affinity sentence (as per plan requirements)
const PREVIEW_AFFINITY_SENTENCE = 'What brings you together is a similar rhythm of life: a walk outdoors instead of crowded plans, time to talk properly, and weekends that feel calm rather than busy. You both value emotional balance, clear intentions, and taking things at a pace that feels natural and real.';

// Local images from assets folder
const PREVIEW_LOCAL_IMAGES = [
  require('../../assets/preview_female_1.jpg'),
  require('../../assets/preview_female_2.jpg'),
  require('../../assets/preview_female_3.jpg'),
];

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

const resolvePhotoUrl = (photoUrl?: string | null) => {
  if (typeof photoUrl === 'string') {
    const trimmed = photoUrl.trim();
    if (trimmed) {
      return { uri: trimmed };
    }
  }

  return FALLBACK_PHOTO;
};

export default function PreviewFeedScreen() {
  const router = useRouter();
  const { exitPreview } = usePreviewStore();
  const [previewUser, setPreviewUser] = useState<FeedCandidate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [showBioPopup, setShowBioPopup] = useState(false);

  useEffect(() => {
    loadPreviewUser();
  }, []);

  const loadPreviewUser = async () => {
    setIsLoading(true);
    try {
      // Use static data for preview mode to avoid security issues
      // No API calls are made in preview mode - all data is hardcoded
      // This ensures no real user data is exposed without authentication
      setPreviewUser(PREVIEW_USER_DATA);
    } catch (error) {
      console.error('[PreviewFeed] Error loading preview user:', error);
    } finally {
      setIsLoading(false);
    }
  };


  const handleLike = () => {
    setShowRegistrationModal(true);
  };

  const handlePass = () => {
    setShowRegistrationModal(true);
  };

  const handleRegister = () => {
    setShowRegistrationModal(false);
    exitPreview();
    router.push('/(auth)/register/step1');
  };

  const handleSignIn = () => {
    setShowRegistrationModal(false);
    exitPreview();
    router.push('/(auth)/login');
  };

  if (isLoading || !previewUser) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e91e63" />
        <Text style={styles.loadingText}>Loading preview...</Text>
      </View>
    );
  }

  const age = resolveAge(previewUser);
  const primaryPhoto = PREVIEW_LOCAL_IMAGES[0];
  const secondPhoto = PREVIEW_LOCAL_IMAGES[1];
  const remainingImages = PREVIEW_LOCAL_IMAGES.slice(2);
  const showBioCard =
    !!previewUser?.bio &&
    typeof previewUser.show_bio_in_feed === 'boolean' &&
    previewUser.show_bio_in_feed === true;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.discoverScroll}
        contentContainerStyle={styles.discoverScrollContent}
        showsVerticalScrollIndicator={true}
      >
        {/* 1) Top: Name, Age, City */}
        <View style={styles.discoverHeader}>
          <View style={styles.discoverNameAgeRow}>
            <Text style={styles.discoverName}>
              {previewUser.name}
              {typeof age === 'number' ? `, ${age}` : ''}
              {previewUser.city?.trim() ? ` · ${previewUser.city.trim()}` : ''}
            </Text>
          </View>
        </View>

        {/* 2) Main photo */}
        {primaryPhoto && (
          <View style={styles.discoverPhotoBlock}>
            <Image
              source={primaryPhoto}
              style={styles.discoverPhotoImage}
              resizeMode="cover"
            />
          </View>
        )}

        {/* 3) Affinity card (inline) */}
        <View style={styles.discoverCard}>
          <View style={styles.affinityCardContent}>
            <Text style={styles.discoverCardTitle}>Affinity</Text>
            <Text style={styles.discoverCardBody}>{PREVIEW_AFFINITY_SENTENCE}</Text>
            <Text style={styles.discoverCardLabel}>Based on conversations</Text>
          </View>
        </View>

        {/* 4) Second photo (if exists) */}
        {secondPhoto && (
          <View style={styles.discoverPhotoBlock}>
            <Image
              source={secondPhoto}
              style={styles.discoverPhotoImage}
              resizeMode="cover"
            />
          </View>
        )}

        {/* 5) Bio card */}
        <View style={styles.discoverCard}>
          <Text style={styles.discoverCardTitle}>Bio</Text>
          {showBioCard ? (
            <Text style={styles.discoverCardBody}>{previewUser.bio}</Text>
          ) : (
            <Text style={styles.discoverCardBodyMuted}>No bio available</Text>
          )}
          <Text style={styles.discoverCardLabel}>Based on conversations</Text>
        </View>

        {/* 6) Remaining photos */}
        {remainingImages.map((img, index) => (
          <View key={`preview-photo-${index}`} style={styles.discoverPhotoBlock}>
            <Image
              source={img}
              style={styles.discoverPhotoImage}
              resizeMode="cover"
            />
          </View>
        ))}
      </ScrollView>

      {/* Floating Dislike button - bottom left */}
      <TouchableOpacity
        style={styles.discardButtonFloating}
        onPress={handlePass}
        accessibilityRole="button"
        accessibilityLabel="Not for me"
        accessibilityHint="Dismiss this suggested profile"
        activeOpacity={0.8}
      >
        <X size={24} color="#ef4444" />
      </TouchableOpacity>

      {/* Floating Like button - bottom right, always visible */}
      <TouchableOpacity
        style={styles.likeButtonFloating}
        onPress={handleLike}
        accessibilityRole="button"
        accessibilityLabel="I want to meet them"
        accessibilityHint="Show interest in this person"
        activeOpacity={0.8}
      >
        <Check size={26} color="#10b981" />
      </TouchableOpacity>

      {/* Registration Modal */}
      <RegistrationModal
        visible={showRegistrationModal}
        onClose={() => setShowRegistrationModal(false)}
        onRegister={handleRegister}
        onSignIn={handleSignIn}
        source="discover"
      />

      {/* Bio Popup Modal - same as normal feed */}
      <BioPopupModal
        visible={showBioPopup}
        bio={previewUser?.bio}
        onClose={() => setShowBioPopup(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  discoverScroll: {
    flex: 1,
    backgroundColor: '#fff',
  },
  discoverScrollContent: {
    paddingBottom: 40,
  },
  discoverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  discoverNameAgeRow: {
    flex: 1,
  },
  discoverName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  discardButtonFloating: {
    position: 'absolute',
    left: 20,
    bottom: 40,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  likeButtonFloating: {
    position: 'absolute',
    right: 20,
    bottom: 40,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  discoverPhotoBlock: {
    marginHorizontal: 20,
    marginTop: 20,
    aspectRatio: 3 / 4,
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  discoverPhotoImage: {
    width: '100%',
    height: '100%',
  },
  discoverCard: {
    marginHorizontal: 20,
    marginTop: 20,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  discoverCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e91e63',
    marginBottom: 4,
  },
  discoverCardLabel: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 8,
    marginBottom: 12,
  },
  discoverCardBody: {
    fontSize: 15,
    lineHeight: 22,
    color: '#333',
    marginBottom: 16,
  },
  discoverCardBodyMuted: {
    fontSize: 15,
    lineHeight: 22,
    color: '#999',
    fontStyle: 'italic',
  },
  affinityCardContent: {
    flex: 1,
    minWidth: 0,
  },
});
