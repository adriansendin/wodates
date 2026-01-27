import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  PanResponder,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { FeedCandidate } from '../../src/domain/entities/FeedCandidate';
import { RegistrationModal } from '../../src/components/RegistrationModal';
import { BioPopupModal } from '../../src/components/BioPopupModal';
import { AffinityModal } from '../../src/components/AffinityModal';
import { X, Check } from 'lucide-react-native';
import { usePreviewStore } from '../../src/domain/stores/previewStore';
import { FlatList, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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
  location: {
    latitude: 51.5074,
    longitude: -0.1278,
    city: 'London',
    country: 'UK',
  },
};

// Static affinity sentence (as per plan requirements)
const PREVIEW_AFFINITY_SENTENCE = 'Common ground: calm weekends, outdoor walks, and long-term intentions.';

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

// Custom PhotoCarousel component for preview that handles local require() images
const PreviewPhotoCarousel: React.FC<{ images: any[]; flatListRef?: React.RefObject<FlatList | null> }> = ({ images, flatListRef: externalRef }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const internalFlatListRef = React.useRef<FlatList>(null);
  const flatListRef = (externalRef || internalFlatListRef) as React.RefObject<FlatList>;
  const containerRef = React.useRef<View>(null);
  
  // Mouse drag state for web
  const isDraggingRef = React.useRef(false);
  const startXRef = React.useRef(0);
  const currentXRef = React.useRef(0);
  const scrollOffsetRef = React.useRef(0);
  const currentIndexRef = React.useRef(currentIndex);
  
  // Keep ref in sync with state
  React.useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  // Mouse drag handlers for web using native DOM events
  React.useEffect(() => {
    if (Platform.OS !== 'web' || images.length <= 1) {
      return;
    }

    const handleMouseDown = (e: MouseEvent) => {
      // Only handle left mouse button
      if (e.button !== 0) return;
      
      isDraggingRef.current = true;
      startXRef.current = e.clientX;
      currentXRef.current = e.clientX;
      scrollOffsetRef.current = currentIndexRef.current * SCREEN_WIDTH;
      
      // Prevent default to avoid text selection
      e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      
      const deltaX = startXRef.current - e.clientX;
      const newOffset = scrollOffsetRef.current + deltaX;
      const clampedOffset = Math.max(0, Math.min(newOffset, (images.length - 1) * SCREEN_WIDTH));
      
      // Scroll to the calculated position using scrollToOffset
      if (flatListRef.current) {
        flatListRef.current.scrollToOffset({ offset: clampedOffset, animated: false });
      }
      
      currentXRef.current = e.clientX;
      e.preventDefault();
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      
      const deltaX = startXRef.current - currentXRef.current;
      const threshold = SCREEN_WIDTH * 0.15; // 15% of screen width
      const currentIdx = currentIndexRef.current;
      
      let targetIndex = currentIdx;
      
      // Determine target index based on drag distance
      if (Math.abs(deltaX) > threshold) {
        if (deltaX > 0 && currentIdx < images.length - 1) {
          // Dragged left - go to next photo
          targetIndex = currentIdx + 1;
        } else if (deltaX < 0 && currentIdx > 0) {
          // Dragged right - go to previous photo
          targetIndex = currentIdx - 1;
        }
      }
      
      // Snap to target photo
      if (flatListRef.current) {
        flatListRef.current.scrollToIndex({ index: targetIndex, animated: true });
      }
      
      isDraggingRef.current = false;
      e.preventDefault();
    };

    // Add event listeners to window for mouse move and up (to work even if mouse leaves container)
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    // Use a timeout to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      // Get the container DOM node - try multiple methods
      // @ts-ignore - React Native Web exposes _nativeNode
      let containerNode = containerRef.current?._nativeNode;
      
      // Fallback: try to find by traversing the ref
      if (!containerNode && containerRef.current) {
        // @ts-ignore
        containerNode = containerRef.current;
      }
      
      if (containerNode && typeof containerNode.addEventListener === 'function') {
        containerNode.addEventListener('mousedown', handleMouseDown);
        
        // Style for better UX
        if (containerNode instanceof HTMLElement) {
          containerNode.style.cursor = 'grab';
          containerNode.style.userSelect = 'none';
          containerNode.style.webkitUserSelect = 'none';
        }
      }
    }, 100);
    
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      
      // Try to remove mousedown listener
      // @ts-ignore
      const containerNode = containerRef.current?._nativeNode || containerRef.current;
      if (containerNode && typeof containerNode.removeEventListener === 'function') {
        containerNode.removeEventListener('mousedown', handleMouseDown);
      }
    };
  }, [currentIndex, images.length]);

  const handleScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / SCREEN_WIDTH);
    if (index !== currentIndex && index >= 0 && index < images.length) {
      setCurrentIndex(index);
    }
  };

  const renderPhoto = ({ item, index }: { item: any; index: number }) => {
    // item is a require() result, which can be used directly as Image source
    return (
      <View style={previewCarouselStyles.photoContainer}>
        <Image
          source={item}
          style={previewCarouselStyles.image}
          resizeMode="cover"
        />
      </View>
    );
  };

  if (!images || images.length === 0) {
    return (
      <View style={previewCarouselStyles.container}>
        <Image
          source={FALLBACK_PHOTO}
          style={previewCarouselStyles.image}
          resizeMode="cover"
        />
      </View>
    );
  }

  return (
    <View 
      ref={containerRef}
      style={previewCarouselStyles.container}
    >
      {/* Photo indicators */}
      {images.length > 1 && (
        <View style={previewCarouselStyles.indicatorsContainer}>
          {images.map((_, index) => (
            <View
              key={index}
              style={[
                previewCarouselStyles.indicator,
                index === currentIndex && previewCarouselStyles.indicatorActive,
              ]}
            />
          ))}
        </View>
      )}

      {/* Photo carousel */}
      <FlatList
        ref={flatListRef}
        data={images}
        renderItem={renderPhoto}
        keyExtractor={(item, index) => `preview-photo-${index}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        getItemLayout={(data, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
        snapToInterval={SCREEN_WIDTH}
        snapToAlignment="start"
        decelerationRate="fast"
        initialScrollIndex={0}
        style={previewCarouselStyles.flatList}
        contentContainerStyle={previewCarouselStyles.flatListContent}
      />
    </View>
  );
};

const previewCarouselStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  flatList: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  flatListContent: {
    alignItems: 'stretch',
  },
  photoContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#000',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  indicatorsContainer: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    paddingHorizontal: 16,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 4,
  },
  indicatorActive: {
    backgroundColor: '#fff',
    width: 24,
  },
});

export default function PreviewFeedScreen() {
  const router = useRouter();
  const { exitPreview } = usePreviewStore();
  const [previewUser, setPreviewUser] = useState<FeedCandidate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [showBioPopup, setShowBioPopup] = useState(false);
  const [showAffinityModal, setShowAffinityModal] = useState(false);
  const flatListRef = React.useRef<FlatList | null>(null);

  useEffect(() => {
    loadPreviewUser();
  }, []);

  // PanResponder for horizontal swipe on entire screen (mobile)
  const panResponder = useMemo(() => {
    if (Platform.OS === 'web') {
      return null; // Web uses mouse events handled by PreviewPhotoCarousel
    }

    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only respond to horizontal swipes (more horizontal than vertical)
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 10;
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (!flatListRef.current || PREVIEW_LOCAL_IMAGES.length <= 1) return;
        
        const threshold = 50; // Minimum swipe distance
        if (Math.abs(gestureState.dx) > threshold) {
          // Get current index from scroll position would require state, so we'll use a simpler approach
          // For now, we'll let the PreviewPhotoCarousel handle it, but we need to expose methods
        }
      },
    });
  }, []);

  // Web: Add mouse/touch event listeners to entire screen for preview
  useEffect(() => {
    if (Platform.OS !== 'web' || PREVIEW_LOCAL_IMAGES.length <= 1) return;

    let startX = 0;
    let isDragging = false;
    let currentIdx = 0;

    const handleStart = (e: MouseEvent | TouchEvent) => {
      isDragging = true;
      startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    };

    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging || !flatListRef.current) return;
      e.preventDefault();
      
      const currentX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const deltaX = startX - currentX;
      const newOffset = currentIdx * SCREEN_WIDTH + deltaX;
      const clampedOffset = Math.max(0, Math.min(newOffset, (PREVIEW_LOCAL_IMAGES.length - 1) * SCREEN_WIDTH));
      
      flatListRef.current.scrollToOffset({ offset: clampedOffset, animated: false });
    };

    const handleEnd = (e: MouseEvent | TouchEvent) => {
      if (!isDragging || !flatListRef.current) return;
      
      const endX = 'changedTouches' in e ? e.changedTouches[0].clientX : e.clientX;
      const deltaX = startX - endX;
      const threshold = 50;

      if (Math.abs(deltaX) > threshold) {
        if (deltaX > 0 && currentIdx < PREVIEW_LOCAL_IMAGES.length - 1) {
          currentIdx += 1;
        } else if (deltaX < 0 && currentIdx > 0) {
          currentIdx -= 1;
        }
        flatListRef.current.scrollToIndex({ index: currentIdx, animated: true });
      } else {
        flatListRef.current.scrollToIndex({ index: currentIdx, animated: true });
      }

      isDragging = false;
    };

    window.addEventListener('mousedown', handleStart);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchstart', handleStart);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousedown', handleStart);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchstart', handleStart);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
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
    router.push('/(auth)/register/step3');
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
  const photoSource = resolvePhotoUrl(previewUser.photoUrl);

  return (
    <View 
      style={styles.container}
      {...(panResponder?.panHandlers || {})}
    >
      {/* Custom photo carousel for preview with local images */}
      <PreviewPhotoCarousel images={PREVIEW_LOCAL_IMAGES} flatListRef={flatListRef} />
      
      {/* Subtle gradient for text readability - no black bar */}
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
              {previewUser.name}
              {typeof age === 'number' ? `, ${age}` : null}
            </Text>
          </View>
          
          {/* Affinity chip - next to name */}
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
        </View>

        {/* Location (small, if exists) */}
        {previewUser.location?.city ? (
          <Text style={styles.location} numberOfLines={1}>
            {`📍 ${previewUser.location.city}`}
          </Text>
        ) : null}
        
        {/* Bio text - where affinity was (main content) - scrollable */}
        {previewUser?.bio && 
         typeof previewUser.show_bio_in_feed === 'boolean' &&
         previewUser.show_bio_in_feed === true ? (
          <View style={styles.bioContainer}>
            <ScrollView 
              style={styles.bioScrollView}
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.bioText}>
                {previewUser.bio}
              </Text>
            </ScrollView>
            <Text style={styles.bioMicrotext}>Based on conversations</Text>
          </View>
        ) : null}
      </View>


      {/* Action buttons */}
      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handlePass}
          accessibilityRole="button"
          accessibilityLabel="Dislike"
        >
          <X size={24} color="#ef4444" />
        </TouchableOpacity>

        <View style={{ width: 16 }} />

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleLike}
          accessibilityRole="button"
          accessibilityLabel="Like"
        >
          <Check size={24} color="#10b981" />
        </TouchableOpacity>
      </View>

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

      {/* Affinity Modal */}
      <AffinityModal
        visible={showAffinityModal}
        affinitySentences={[PREVIEW_AFFINITY_SENTENCE]}
        onClose={() => setShowAffinityModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
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
  // Subtle gradient - no black bar
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 300,
  },
  // Content overlay - allows swipe through (pointerEvents="box-none")
  contentOverlay: {
    position: 'absolute',
    bottom: 120,
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
  location: {
    fontSize: 13,
    color: '#fff',
    lineHeight: 16,
    opacity: 0.9,
    marginBottom: 10,
    marginTop: 4,
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
  affinityChipText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  actionButtonsContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  actionButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
});
