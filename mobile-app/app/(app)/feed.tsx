import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
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
import { getApiUrl } from '../../src/utils/apiConfig';
import { MatchConfirmationModal } from '../../src/components/MatchConfirmationModal';

const API_URL = getApiUrl();
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
  console.log('[FeedScreen] Component mounted');
  const router = useRouter();
  const {
    users,
    currentIndex,
    isLoading,
    setUsers,
    addUsers,
    removeUser,
    nextUser,
    setLoading,
    setError,
    hasMore,
    setHasMore,
  } = useFeedStore();
  const { tokens, user } = useAuthStore();
  console.log('[FeedScreen] Auth state - user:', !!user, 'tokens:', !!tokens, 'accessToken:', !!tokens?.accessToken);
  const addMatch = useMatchesStore((state) => state.addMatch);
  const activeChatsCount = useMatchesStore((state) => state.activeChatsCount);
  const setActiveChatsCount = useMatchesStore((state) => state.setActiveChatsCount);
  const [isLiking, setIsLiking] = useState(false);
  const [isPassing, setIsPassing] = useState(false);
  const [affinitySentences, setAffinitySentences] = useState<string[]>([]);
  const [isLoadingSentences, setIsLoadingSentences] = useState(false);
  const [affinitySentencesError, setAffinitySentencesError] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [potentialMatch, setPotentialMatch] = useState<{
    userId: string;
    name: string;
    photoUrl?: string | null;
  } | null>(null);
  const [isConfirmingMatch, setIsConfirmingMatch] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Memoize API clients to prevent useEffect loops
  const apiClient = useMemo(() => new ApiClient(API_URL), []);
  const feedApi = useMemo(() => new FeedApi(apiClient), [apiClient]);
  const matchApi = useMemo(() => new MatchApi(apiClient), [apiClient]);

  // Track current candidate ID to prevent stale updates
  const currentCandidateIdRef = useRef<string | null>(null);
  const hasLoadedMatchesCount = useRef(false);

  // Debouncing refs for like/pass actions
  const likeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const passTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Function to load affinity sentences for current user
  const loadAffinitySentencesForCurrentUser = useCallback(async () => {
    const currentUser = users[currentIndex];

    // Guard: only call if we have valid session AND a real candidate
    if (!currentUser?.id || !tokens?.accessToken || !user?.id) {
      setAffinitySentences([]);
      setAffinitySentencesError(false);
      currentCandidateIdRef.current = null;
      return;
    }

    // Update ref to track current candidate
    currentCandidateIdRef.current = currentUser.id;

    // AbortController to cancel previous request if user changes quickly
    const abortController = new AbortController();
    const candidateId = currentUser.id; // Capture for stale check

    const loadSentences = async () => {
      setIsLoadingSentences(true);
      setAffinitySentences([]); // Clear previous sentences
      setAffinitySentencesError(false); // Reset error state

      try {
        const result = await feedApi.getAffinitySentences(
          candidateId,
          tokens.accessToken
        );

        // Check if request was aborted or candidate changed
        if (abortController.signal.aborted || currentCandidateIdRef.current !== candidateId) {
          return;
        }

        if (result.success) {
          setAffinitySentences(result.data.sentences);
          setAffinitySentencesError(false);
        } else {
          console.error('Backend returned error for affinity sentences:', result.error);
          setAffinitySentences([]);
          setAffinitySentencesError(true);
        }
      } catch (error) {
        // Check if request was aborted or candidate changed
        if (abortController.signal.aborted || currentCandidateIdRef.current !== candidateId) {
          return;
        }
        if (error instanceof Error && !error.message.includes('429')) {
          console.error('Failed to load affinity sentences:', error);
        }
        setAffinitySentences([]);
        setAffinitySentencesError(true);
      } finally {
        if (!abortController.signal.aborted && currentCandidateIdRef.current === candidateId) {
          setIsLoadingSentences(false);
        }
      }
    };

    loadSentences();

    // Cleanup: abort request if user changes
    return () => {
      abortController.abort();
    };
  }, [users, currentIndex, tokens?.accessToken, user?.id, feedApi]);

  // Load matches to get activeChatsCount
  // Only load once when component mounts or when tokens change (not on every user.id change)
  useEffect(() => {
    const loadMatchesForCount = async () => {
      // Guard: only call if we have valid session
      if (!tokens?.accessToken || !user?.id) {
        return;
      }

      // Only load once per session to avoid unnecessary calls
      if (hasLoadedMatchesCount.current) {
        return;
      }

      try {
        const result = await matchApi.getMatches(tokens.accessToken);
        if (result.success) {
          setActiveChatsCount(result.data.activeChatsCount);
          hasLoadedMatchesCount.current = true;
        }
      } catch (error) {
        // Reduce log spam: only log if it's not a rate limit error
        if (error instanceof Error && !error.message.includes('429')) {
          console.error('Failed to load matches count', error);
        }
      }
    };

    loadMatchesForCount();
    // Reset flag when tokens change (new session)
    return () => {
      if (!tokens?.accessToken) {
        hasLoadedMatchesCount.current = false;
      }
    };
  }, [tokens?.accessToken, matchApi, setActiveChatsCount]);

  const loadFeed = useCallback(async (offset: number = 0, append: boolean = false) => {
    console.log('[FeedScreen] loadFeed called with tokens:', !!tokens, 'accessToken:', !!tokens?.accessToken);
    if (!tokens?.accessToken) {
      console.log('[FeedScreen] No access token available, skipping loadFeed');
      return;
    }

    setLoading(true);
    try {
      // Load 50 users initially, then 20 more when loading more
      const limit = offset === 0 ? 50 : 20;
      const result = await feedApi.getFeed(limit, offset, tokens.accessToken);
      if (result.success) {
        if (append) {
          // Filter out users that are already in the feed to avoid duplicates
          const existingUserIds = new Set(users.map((u) => u.id));
          const newUsers = result.data.users.filter((u) => !existingUserIds.has(u.id));
          if (newUsers.length > 0) {
            addUsers(newUsers);
          }
          // Update hasMore based on whether we got new users or not
          setHasMore(result.data.pagination.hasMore && newUsers.length > 0);
        } else {
          setUsers(result.data.users);
          setHasMore(result.data.pagination.hasMore);
        }
      } else {
        setError(result.error.message);
        showAlert('Error', result.error.message);
      }
    } catch (error) {
      setError('Network error');
      showAlert('Error', 'Network error. Please try again.');
    } finally {
      setLoading(false);
      // Mark initial load as complete when first load finishes (success or failure)
      if (offset === 0) {
        setIsInitialLoad(false);
      }
    }
  }, [tokens?.accessToken, feedApi, addUsers, setUsers, setHasMore, setLoading, setError]);

  // Load more users when approaching the end
  const loadMoreIfNeeded = useCallback(async () => {
    // Load more when we're within 5 users of the end
    const remainingUsers = users.length - currentIndex;
    if (remainingUsers <= 5 && hasMore && !isLoading) {
      await loadFeed(users.length, true);
    }
  }, [users.length, currentIndex, hasMore, isLoading, loadFeed]);

  useEffect(() => {
    console.log('[FeedScreen] useEffect triggered - calling loadFeed');
    if (tokens?.accessToken && users.length === 0) {
      loadFeed(0, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens?.accessToken]);

  // Load more users when approaching the end
  useEffect(() => {
    loadMoreIfNeeded();
  }, [loadMoreIfNeeded]);

  // Load affinity sentences when current user changes
  useEffect(() => {
    const currentUser = users[currentIndex];

    // Guard: only call if we have valid session AND a real candidate
    if (!currentUser?.id || !tokens?.accessToken || !user?.id) {
      setAffinitySentences([]);
      setAffinitySentencesError(false);
      currentCandidateIdRef.current = null;
      return;
    }

    // Guard: prevent duplicate calls for the same candidate
    if (currentCandidateIdRef.current === currentUser.id) {
      return;
    }

    loadAffinitySentencesForCurrentUser();
  }, [currentIndex, users, tokens?.accessToken, user?.id, loadAffinitySentencesForCurrentUser]);

  // Cleanup timeouts and abort controllers on unmount
  useEffect(() => {
    return () => {
      if (likeTimeoutRef.current) {
        clearTimeout(likeTimeoutRef.current);
      }
      if (passTimeoutRef.current) {
        clearTimeout(passTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleLike = async () => {
    const currentUser = users[currentIndex];
    if (!currentUser) {
      return;
    }

    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    // If already liking, skip to next user
    if (isLiking) {
      nextUser();
      loadMoreIfNeeded();
      return;
    }

    // Clear any existing timeout
    if (likeTimeoutRef.current) {
      clearTimeout(likeTimeoutRef.current);
    }

    setIsLiking(true);

    try {
      const result = await feedApi.likeUser(currentUser.id, tokens?.accessToken || '', abortControllerRef.current?.signal);
      if (!result.success) {
        // Handle "User already liked" error silently - just skip to next user
        // ConflictError has code 'CONFLICT' and statusCode 409
        const isConflictError =
          (result.error.code === 'CONFLICT' || result.error.statusCode === 409) &&
          result.error.message.toLowerCase().includes('already liked');

        if (isConflictError) {
          console.log(`[FeedScreen] User ${currentUser.id} already liked, removing from feed and skipping`);
          removeUser(currentUser.id);
          nextUser();
          loadMoreIfNeeded();
          return;
        }
        // For other errors, show alert
        showAlert('Error', result.error.message);
        return;
      }

      // Check if it's an already created match (legacy behavior, should not happen with new flow)
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
      // Check if it's a potential match (mutual like but not confirmed)
      else if (result.data.isPotentialMatch) {
        // Show confirmation modal instead of creating match immediately
        setPotentialMatch({
          userId: currentUser.id,
          name: currentUser.name,
          photoUrl: currentUser.photoUrl ?? null,
        });
        setShowMatchModal(true);
        // Don't call nextUser() yet - wait for user's decision
        return;
      }

      // Like was successful - remove user from feed and move to next
      removeUser(currentUser.id);
      nextUser();
      // Load more if needed after moving to next user
      loadMoreIfNeeded();
    } catch (error) {
      // Only show error if request wasn't aborted
      if (!abortControllerRef.current?.signal.aborted) {
        showAlert('Error', 'Network error. Please try again.');
      }
    } finally {
      // Debounce: keep button disabled for 300ms to prevent rapid clicking
      likeTimeoutRef.current = setTimeout(() => {
        setIsLiking(false);
      }, 300);
    }
  };

  const handleConfirmMatch = async () => {
    if (!potentialMatch || !tokens?.accessToken) {
      return;
    }

    setIsConfirmingMatch(true);
    try {
      const result = await matchApi.confirmMatch(
        potentialMatch.userId,
        tokens.accessToken
      );

      if (!result.success) {
        showAlert('Error', result.error.message);
        setShowMatchModal(false);
        setPotentialMatch(null);
        nextUser();
        loadMoreIfNeeded();
        return;
      }

      // Add match to store
      // Backend returns a basic Match, we need to construct MatchWithUser
      const match = result.data;
      addMatch({
        ...match,
        otherUser: {
          id: potentialMatch.userId,
          name: potentialMatch.name,
          photoUrl: potentialMatch.photoUrl ?? undefined,
        },
        lastMessage: undefined, // New match, no messages yet
        unreadCount: 0,
      });

      // Update active chats count (will block feed automatically)
      const matchesResult = await matchApi.getMatches(tokens.accessToken);
      if (matchesResult.success) {
        setActiveChatsCount(matchesResult.data.activeChatsCount);
      }

      // Close modal and navigate to chat
      setShowMatchModal(false);
      setPotentialMatch(null);

      // Navigate to matches tab first, then to the chat
      router.push('/(app)/matches');
      
      // Small delay to ensure navigation completes
      setTimeout(() => {
        router.push({
          pathname: '/chat/[matchId]',
          params: {
            matchId: match.id,
            name: potentialMatch.name,
            photoUrl: potentialMatch.photoUrl ?? '',
            otherUserId: potentialMatch.userId,
            isBot: 'false',
          },
        });
      }, 100);
    } catch (error) {
      showAlert('Error', 'Network error. Please try again.');
      setShowMatchModal(false);
      setPotentialMatch(null);
      nextUser();
      loadMoreIfNeeded();
    } finally {
      setIsConfirmingMatch(false);
    }
  };

  const handleCancelMatch = () => {
    // User cancelled - just close modal and continue with feed
    // Don't remove user from feed since they didn't confirm the match
    setShowMatchModal(false);
    setPotentialMatch(null);
    nextUser();
    loadMoreIfNeeded();
  };

  const handlePass = async () => {
    const currentUser = users[currentIndex];
    if (!currentUser) {
      return;
    }

    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    // If already passing, skip to next user
    if (isPassing) {
      nextUser();
      loadMoreIfNeeded();
      return;
    }

    // Clear any existing timeout
    if (passTimeoutRef.current) {
      clearTimeout(passTimeoutRef.current);
    }

    setIsPassing(true);

    try {
      const result = await feedApi.passUser(currentUser.id, tokens?.accessToken || '', abortControllerRef.current?.signal);
      if (!result.success) {
        // Handle "User already passed" error silently - just skip to next user
        // ConflictError has code 'CONFLICT' and statusCode 409
        const isConflictError =
          (result.error.code === 'CONFLICT' || result.error.statusCode === 409) &&
          result.error.message.toLowerCase().includes('already passed');

        if (isConflictError) {
          console.log(`[FeedScreen] User ${currentUser.id} already passed, removing from feed and skipping`);
          removeUser(currentUser.id);
          nextUser();
          loadMoreIfNeeded();
          return;
        }
        // For other errors, show alert
        showAlert('Error', result.error.message);
        return;
      }

      // Pass was successful - remove user from feed and move to next
      removeUser(currentUser.id);
      nextUser();
      // Load more if needed after moving to next user
      loadMoreIfNeeded();
    } catch (error) {
      // Only show error if request wasn't aborted
      if (!abortControllerRef.current?.signal.aborted) {
        showAlert('Error', 'Network error. Please try again.');
      }
    } finally {
      // Debounce: keep button disabled for 300ms to prevent rapid clicking
      passTimeoutRef.current = setTimeout(() => {
        setIsPassing(false);
      }, 300);
    }
  };

  const currentUser = users[currentIndex];

  if (isInitialLoad && (isLoading || users.length === 0)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e91e63" />
        <Text style={styles.loadingText}>Loading feed...</Text>
      </View>
    );
  }

  // Show blocked message if user has any active chats
  if (activeChatsCount >= 1) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconContainer}>
          <Text style={styles.emptyIcon}>💬</Text>
        </View>
        <Text style={styles.emptyTitle}>Modo exclusivo activado</Text>
        <Text style={styles.emptySubtext}>
          Ahora estás conociendo a una persona.
        </Text>
        <Text style={styles.emptySubtext}>
          Para activar Discover tendrás que cerrar esa conversación.
        </Text>
        <TouchableOpacity 
          style={styles.discoverButton}
          onPress={() => router.push('/(app)/matches')}
        >
          <Text style={styles.discoverButtonText}>Abrir chat</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!currentUser) {
    // Try to load more if we still have more available
    if (hasMore && !isLoading) {
      loadMoreIfNeeded();
    }
    
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          {hasMore 
            ? 'Loading more users...' 
            : 'Wodates prioriza calidad sobre cantidad. Mejora tu afinidad hablando con Doc Love'}
        </Text>
        {!hasMore && (
          <TouchableOpacity style={styles.refreshButton} onPress={() => loadFeed(0, false)}>
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
        )}
        {isLoading && <ActivityIndicator size="small" color="#e91e63" style={{ marginTop: 10 }} />}
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
        
        {/* Affinity sentences */}
        <View style={styles.affinityContainer}>
          {isLoadingSentences ? (
            <View style={styles.affinityPlaceholder}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.affinityLoadingText}>Analizando afinidad...</Text>
            </View>
          ) : affinitySentences.length > 0 ? (
            affinitySentences.map((sentence, index) => (
              <Text key={index} style={styles.affinitySentence}>
                {sentence}
              </Text>
            ))
          ) : affinitySentencesError ? (
            <View style={styles.affinityError}>
              <Text style={styles.affinityErrorText}>
                No se pudieron cargar las frases de afinidad
              </Text>
              <TouchableOpacity
                onPress={() => {
                  loadAffinitySentencesForCurrentUser();
                }}
                style={styles.retryButton}
              >
                <Text style={styles.retryButtonText}>Reintentar</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
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

      {/* Match Confirmation Modal */}
      <MatchConfirmationModal
        visible={showMatchModal}
        otherUserName={potentialMatch?.name ?? ''}
        otherUserPhotoUrl={potentialMatch?.photoUrl}
        onConfirm={handleConfirmMatch}
        onCancel={handleCancelMatch}
        isConfirming={isConfirmingMatch}
      />
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
    marginBottom: 8,
  },
  affinityContainer: {
    marginTop: 8,
  },
  affinityPlaceholder: {
    paddingVertical: 4,
    alignItems: 'center',
  },
  affinityLoadingText: {
    fontSize: 12,
    color: '#fff',
    marginTop: 4,
    opacity: 0.8,
  },
  affinitySentence: {
    fontSize: 13,
    color: '#fff',
    lineHeight: 18,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    opacity: 0.85,
    marginBottom: 4,
  },
  affinityError: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  affinityErrorText: {
    fontSize: 12,
    color: '#fff',
    textAlign: 'center',
    opacity: 0.8,
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  retryButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  retryButtonText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500',
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
