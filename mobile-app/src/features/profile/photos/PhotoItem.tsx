import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Text,
} from 'react-native';
import { MoreVertical, Star } from 'lucide-react-native';
import { UserPhoto } from '../../../domain/models/UserPhoto';
import { PhotoMenuModal } from './PhotoMenuModal';

type Props = {
  photo: UserPhoto;
  isMain?: boolean;
  size?: number;
  onSetMain: (photoId: string) => void;
  onDelete: (photoId: string) => void;
  disabled?: boolean;
};

export function PhotoItem({
  photo,
  isMain = false,
  size = 150,
  onSetMain,
  onDelete,
  disabled = false,
}: Props) {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const imageUrlRef = useRef<string>(photo.public_url);
  const hasLoadedRef = useRef<boolean>(false);

  // Reset loading state when photo URL changes
  useEffect(() => {
    if (imageUrlRef.current !== photo.public_url) {
      imageUrlRef.current = photo.public_url;
      hasLoadedRef.current = false;
      setImageLoading(true);
      setImageError(false);
    }
  }, [photo.public_url]);

  const handleMenuPress = () => {
    if (disabled) return;
    console.log(
      '[PhotoItem] Menu pressed for photo:',
      photo.id,
      'isMain:',
      isMain
    );
    setShowMenu(true);
  };

  const handleSetMain = () => {
    console.log('[PhotoItem] Set main option selected for photo:', photo.id);
    onSetMain(photo.id);
  };

  const handleDelete = () => {
    console.log('[PhotoItem] Delete option selected for photo:', photo.id);
    onDelete(photo.id);
  };

  const handleLoadStart = () => {
    if (!hasLoadedRef.current) {
      setImageLoading(true);
      setImageError(false);
    }
  };

  const handleLoadEnd = () => {
    hasLoadedRef.current = true;
    setImageLoading(false);
  };

  const handleError = () => {
    hasLoadedRef.current = true;
    setImageLoading(false);
    setImageError(true);
  };

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {!imageError ? (
        <Image
          source={{ uri: photo.public_url }}
          style={[styles.image, { width: size, height: size }]}
          resizeMode="cover"
          onLoadStart={handleLoadStart}
          onLoadEnd={handleLoadEnd}
          onError={handleError}
        />
      ) : (
        <View style={[styles.errorContainer, { width: size, height: size }]}>
          <Text style={styles.errorText}>Error</Text>
        </View>
      )}
      {imageLoading && !imageError && (
        <View style={[styles.loadingOverlay, { width: size, height: size }]}>
          <ActivityIndicator color="#e91e63" />
        </View>
      )}
      {isMain && (
        <View style={styles.mainBadge}>
          <Star size={16} color="#fff" fill="#fff" />
        </View>
      )}
      <TouchableOpacity
        style={styles.menuButton}
        onPress={handleMenuPress}
        disabled={disabled}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <MoreVertical size={20} color="#333" />
      </TouchableOpacity>

      <PhotoMenuModal
        visible={showMenu}
        isMain={isMain}
        onClose={() => setShowMenu(false)}
        onSetMain={handleSetMain}
        onDelete={handleDelete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  image: {
    borderRadius: 12,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  mainBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#e91e63',
    borderRadius: 12,
    padding: 4,
  },
  menuButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
  errorContainer: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  errorText: {
    color: '#999',
    fontSize: 12,
  },
});
