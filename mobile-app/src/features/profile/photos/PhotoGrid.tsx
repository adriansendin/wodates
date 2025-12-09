import React from 'react';
import { View, StyleSheet, ScrollView, Text, Dimensions } from 'react-native';
import { UserPhoto } from '../../../domain/models/UserPhoto';
import { PhotoItem } from './PhotoItem';
import { PhotoAddButton } from './PhotoAddButton';

type Props = {
  photos: UserPhoto[];
  mainPhoto: UserPhoto | null;
  otherPhotos: UserPhoto[];
  onSetMain: (photoId: string) => void;
  onDelete: (photoId: string) => void;
  onAdd: () => void;
  disabled?: boolean;
};

const { width: screenWidth } = Dimensions.get('window');
// Calculate photo size:
// - Mobile: full width minus padding
// - Desktop: max 350px (square photos)
const PHOTO_SIZE =
  screenWidth < 768
    ? screenWidth - 32 // Mobile: full width
    : Math.min(350, screenWidth * 0.4); // Desktop: max 350px or 40% of screen

export function PhotoGrid({
  photos,
  mainPhoto,
  otherPhotos,
  onSetMain,
  onDelete,
  onAdd,
  disabled = false,
}: Props) {
  const canAddMore = photos.length < 5;

  // Sort photos: main first, then others by position
  const sortedPhotos = mainPhoto
    ? [mainPhoto, ...otherPhotos.sort((a, b) => a.position - b.position)]
    : [...otherPhotos.sort((a, b) => a.position - b.position)];

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.content}>
        {/* Photo counter */}
        <View style={styles.counterContainer}>
          <Text style={styles.counterText}>{photos.length} / 5 fotos</Text>
          {photos.length >= 5 && (
            <Text style={styles.counterWarning}>
              Has alcanzado el límite máximo
            </Text>
          )}
        </View>

        {/* Vertical column of photos - like reels */}
        <View style={styles.verticalGrid}>
          {sortedPhotos.map((photo) => (
            <View key={photo.id} style={styles.photoWrapper}>
              <PhotoItem
                photo={photo}
                isMain={photo.is_main}
                size={PHOTO_SIZE}
                onSetMain={onSetMain}
                onDelete={onDelete}
                disabled={disabled}
              />
            </View>
          ))}

          {/* Add button at the end if there's space */}
          {canAddMore && (
            <View style={styles.photoWrapper}>
              <PhotoAddButton
                onPress={onAdd}
                disabled={disabled || !canAddMore}
                size={PHOTO_SIZE}
              />
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  counterContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  counterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  counterWarning: {
    fontSize: 12,
    color: '#e91e63',
    marginTop: 4,
  },
  verticalGrid: {
    gap: 16,
    alignItems: 'center',
  },
  photoWrapper: {
    width: '100%',
    alignItems: 'center',
  },
});
