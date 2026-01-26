import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  FlatList,
  Platform,
} from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface Photo {
  id: string;
  public_url: string;
  is_main?: boolean;
  position?: number;
}

interface PhotoCarouselProps {
  photos: Photo[];
  fallbackPhoto?: { uri: string } | number;
  onPhotoChange?: (index: number) => void;
  onSwipeRef?: (methods: { goToNext: () => void; goToPrevious: () => void; goToIndex: (index: number) => void }) => void;
}

export function PhotoCarousel({
  photos,
  fallbackPhoto,
  onPhotoChange,
  onSwipeRef,
}: PhotoCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const containerRef = useRef<View>(null);
  
  // Mouse drag state for web
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const scrollOffsetRef = useRef(0);
  const currentIndexRef = useRef(currentIndex);
  
  // Keep ref in sync with state
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  // Sort photos: main first, then by position
  const sortedPhotos = React.useMemo(() => {
    if (!photos || photos.length === 0) {
      return [];
    }
    return [...photos].sort((a, b) => {
      if (a.is_main && !b.is_main) return -1;
      if (!a.is_main && b.is_main) return 1;
      return (a.position || 0) - (b.position || 0);
    });
  }, [photos]);

  // Create a hash of photo IDs to detect when photos actually change
  const photosHash = React.useMemo(() => {
    return sortedPhotos.map(p => p.id).join(',');
  }, [sortedPhotos]);

  // Reset to first photo when photos change
  useEffect(() => {
    if (sortedPhotos.length > 0 && flatListRef.current) {
      setCurrentIndex(0);
      flatListRef.current.scrollToIndex({ index: 0, animated: false });
    }
  }, [photosHash]);

  // Notify parent of photo change
  useEffect(() => {
    if (onPhotoChange) {
      onPhotoChange(currentIndex);
    }
  }, [currentIndex, onPhotoChange]);

  // Expose swipe methods to parent
  useEffect(() => {
    if (onSwipeRef) {
      onSwipeRef({
        goToNext: () => {
          if (flatListRef.current && currentIndex < sortedPhotos.length - 1) {
            flatListRef.current.scrollToIndex({ index: currentIndex + 1, animated: true });
          }
        },
        goToPrevious: () => {
          if (flatListRef.current && currentIndex > 0) {
            flatListRef.current.scrollToIndex({ index: currentIndex - 1, animated: true });
          }
        },
        goToIndex: (index: number) => {
          if (flatListRef.current && index >= 0 && index < sortedPhotos.length) {
            flatListRef.current.scrollToIndex({ index, animated: true });
          }
        },
      });
    }
  }, [onSwipeRef, currentIndex, sortedPhotos.length]);

  // Mouse drag handlers for web using native DOM events
  useEffect(() => {
    if (Platform.OS !== 'web' || sortedPhotos.length <= 1) {
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
      const clampedOffset = Math.max(0, Math.min(newOffset, (sortedPhotos.length - 1) * SCREEN_WIDTH));
      
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
        if (deltaX > 0 && currentIdx < sortedPhotos.length - 1) {
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
  }, [currentIndex, sortedPhotos.length]);

  const handleScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / SCREEN_WIDTH);
    if (index !== currentIndex && index >= 0 && index < sortedPhotos.length) {
      setCurrentIndex(index);
    }
  };

  const renderPhoto = ({ item, index }: { item: Photo; index: number }) => {
    const imageSource = item.public_url
      ? { uri: item.public_url }
      : fallbackPhoto || require('../../assets/placeholder.png');

    return (
      <View style={styles.photoContainer}>
        <Image
          source={imageSource}
          style={styles.image}
          resizeMode="cover"
        />
      </View>
    );
  };

  // Show fallback if no photos
  if (!sortedPhotos || sortedPhotos.length === 0) {
    return (
      <View style={styles.container}>
        <Image
          source={fallbackPhoto || require('../../assets/placeholder.png')}
          style={styles.image}
          resizeMode="cover"
        />
      </View>
    );
  }

  return (
    <View 
      ref={containerRef} 
      style={styles.container}
    >
      {/* Photo indicators */}
      {sortedPhotos.length > 1 && (
        <View style={styles.indicatorsContainer}>
          {sortedPhotos.map((_, index) => (
            <View
              key={index}
              style={[
                styles.indicator,
                index === currentIndex && styles.indicatorActive,
              ]}
            />
          ))}
        </View>
      )}

      {/* Photo carousel */}
      <FlatList
        ref={flatListRef}
        data={sortedPhotos}
        renderItem={renderPhoto}
        keyExtractor={(item) => item.id}
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
        style={styles.flatList}
        contentContainerStyle={styles.flatListContent}
        removeClippedSubviews={false}
        windowSize={3}
        scrollEnabled={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
