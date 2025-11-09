import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useFeedStore } from '../../src/domain/stores/feedStore';
import { useAuthStore } from '../../src/domain/stores/authStore';
import { FeedApi } from '../../src/data/api/feedApi';
import { ApiClient } from '../../src/data/api/apiClient';
import { useMatchesStore } from '../../src/domain/stores/matchesStore';
import { MatchSchema } from '../../src/domain/entities/Match';
import { showAlert } from '../../src/utils/showAlert';
import { MatchApi } from '../../src/data/api/matchApi';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const FALLBACK_PHOTO = require('../../assets/placeholder.png');

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

export default function FeedScreen() {
  const router = useRouter();
  const {
    users,
    currentIndex,
    isLoading,
    setUsers,
    nextUser,
    setLoading,
    setError,
  } = useFeedStore();
  const { tokens, user } = useAuthStore();
  const addMatch = useMatchesStore((state) => state.addMatch);
  const activeChatsCount = useMatchesStore((state) => state.activeChatsCount);
  const setActiveChatsCount = useMatchesStore((state) => state.setActiveChatsCount);
  const [isLiking, setIsLiking] = useState(false);
  const [isPassing, setIsPassing] = useState(false);

  const apiClient = new ApiClient(API_URL);
  const feedApi = new FeedApi(apiClient);
  const matchApi = useMemo(() => new MatchApi(apiClient), [apiClient]);

  // Load matches to get activeChatsCount
  useEffect(() => {
    const loadMatchesForCount = async () => {
      if (!tokens?.accessToken || !user?.id) {
        return;
      }

      try {
        const result = await matchApi.getMatches(tokens.accessToken);
        if (result.success) {
          setActiveChatsCount(result.data.activeChatsCount);
        }
      } catch (error) {
        console.error('Failed to load matches count', error);
      }
    };

    loadMatchesForCount();
  }, [tokens?.accessToken, user?.id, matchApi, setActiveChatsCount]);

  useEffect(() => {
    loadFeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadFeed = async () => {
    if (!tokens?.accessToken) {
      return;
    }

    setLoading(true);
    try {
      const result = await feedApi.getFeed(10, 0, tokens.accessToken);
      if (result.success) {
        setUsers(result.data.users);
      } else {
        setError(result.error.message);
        showAlert('Error', result.error.message);
      }
    } catch (error) {
      setError('Network error');
      showAlert('Error', 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    const currentUser = users[currentIndex];
    if (!currentUser) {
      return;
    }

    if (!tokens?.accessToken || isLiking) {
      nextUser();
      return;
    }

    setIsLiking(true);
    try {
      const result = await feedApi.likeUser(currentUser.id, tokens.accessToken);
      if (!result.success) {
        showAlert('Error', result.error.message);
        return;
      }

      if (result.data.isMatch) {
        const validation = MatchSchema.safeParse(result.data.result);
        if (validation.success) {
          const match = validation.data;
          addMatch({
            ...match,
            otherUser: {
              id: currentUser.id,
              name: currentUser.name,
              photoUrl: currentUser.photoUrl ?? undefined,
              bio: currentUser.bio ?? undefined,
              gender: currentUser.gender ?? undefined,
              birthDate: currentUser.birthDate ?? undefined,
            },
            unreadCount: 0,
          });
          
          // Mostrar alerta y navegar al chat
          showAlert("It's a Match!", 'You and this person liked each other!');
          
          // Navegar al chat con el nuevo match
          router.push({
            pathname: '/chat/[matchId]',
            params: {
              matchId: match.id,
              name: currentUser.name,
              photoUrl: currentUser.photoUrl ?? '',
              otherUserId: currentUser.id,
              isBot: 'false', // Users from feed are never bots
            },
          });
        } else {
          console.warn('Invalid match payload received', validation.error);
        }
      }
      nextUser();
    } catch (error) {
      showAlert('Error', 'Network error. Please try again.');
    } finally {
      setIsLiking(false);
    }
  };

  const handlePass = async () => {
    const currentUser = users[currentIndex];
    if (!currentUser) {
      return;
    }

    if (!tokens?.accessToken || isPassing) {
      nextUser();
      return;
    }

    setIsPassing(true);
    try {
      const result = await feedApi.passUser(currentUser.id, tokens.accessToken);
      if (!result.success) {
        showAlert('Error', result.error.message);
        return;
      }

      nextUser();
    } catch (error) {
      showAlert('Error', 'Network error. Please try again.');
    } finally {
      setIsPassing(false);
    }
  };

  const currentUser = users[currentIndex];

  if (isLoading && users.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e91e63" />
        <Text style={styles.loadingText}>Loading feed...</Text>
      </View>
    );
  }

  // Show blocked message if user has 3+ active chats
  if (activeChatsCount >= 3) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconContainer}>
          <Text style={styles.emptyIcon}>💬</Text>
        </View>
        <Text style={styles.emptyTitle}>Conoce a tus matches</Text>
        <Text style={styles.emptySubtext}>
          Tienes {activeChatsCount} conversaciones activas. Conecta con tus matches antes de descubrir más personas.
        </Text>
        <TouchableOpacity 
          style={styles.discoverButton}
          onPress={() => router.push('/(app)/matches')}
        >
          <Text style={styles.discoverButtonText}>Ver mis matches</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!currentUser) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No more users to show</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={loadFeed}>
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const age = resolveAge(currentUser);
  const photoSource = resolvePhotoUrl(currentUser.photoUrl);

  return (
    <View style={styles.container}>
      {/* Imagen a pantalla completa */}
      <Image source={photoSource} style={styles.fullScreenImage} resizeMode="cover" />
      
      {/* Gradiente inferior para mejor legibilidad */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']}
        locations={[0, 0.5, 1]}
        style={styles.gradientOverlay}
      />
      
      {/* Overlay con información */}
      <View style={styles.infoOverlay}>
        <Text style={styles.name}>
          {currentUser.name}
          {typeof age === 'number' ? `, ${age}` : null}
        </Text>
        {(currentUser as any).location?.city ? (
          <Text style={styles.location} numberOfLines={1}>
            {`📍 ${(currentUser as any).location.city}`}
          </Text>
        ) : null}
      </View>

      {/* Botones de acción */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.passButton]}
          onPress={handlePass}
          disabled={isPassing}
          accessibilityRole="button"
          accessibilityLabel="Ignorar perfil"
          accessibilityHint="Descarta este perfil sugerido"
        >
          <Ionicons name="close" size={32} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.likeButton]}
          onPress={handleLike}
          disabled={isLiking}
          accessibilityRole="button"
          accessibilityLabel="Dar like al perfil"
          accessibilityHint="Indica que te interesa esta persona"
        >
          <Ionicons name="heart" size={32} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000', // Fondo negro para mejor contraste
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 20,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  discoverButton: {
    backgroundColor: '#e91e63',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
    shadowColor: '#e91e63',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  discoverButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  refreshButton: {
    backgroundColor: '#e91e63',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Imagen a pantalla completa
  fullScreenImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  
  // Gradiente suave
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  
  // Overlay con información
  infoOverlay: {
    position: 'absolute',
    bottom: 120,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  name: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  
  location: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 18,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    opacity: 0.9,
  },
  // Botones de acción
  actions: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 60,
  },
  
  actionButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  
  passButton: {
    backgroundColor: '#ff4757',
  },
  
  likeButton: {
    backgroundColor: '#2ed573',
  },
  welcomeContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 5,
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 10,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e91e63',
    textAlign: 'center',
    paddingVertical: 8,
  },
});
