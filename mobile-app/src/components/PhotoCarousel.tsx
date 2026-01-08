import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  FlatList,
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
}

export function PhotoCarousel({
  photos,
  fallbackPhoto,
  onPhotoChange,
}: PhotoCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

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
    <View style={styles.container}>
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
