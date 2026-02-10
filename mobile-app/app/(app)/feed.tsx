import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useFeedStore } from '../../src/domain/stores/feedStore';
import { useAuthStore } from '../../src/domain/stores/authStore';
import { FeedApi } from '../../src/data/api/feedApi';
import { ApiClient } from '../../src/data/api/apiClient';
import { useMatchesStore } from '../../src/domain/stores/matchesStore';
import { notifySystem } from '../../src/utils/notificationService';
import { MatchApi } from '../../src/data/api/matchApi';
import { ProfileApi } from '../../src/data/api/profileApi';
import { UserProfile } from '../../src/domain/entities/UserProfile';
import { getApiUrl } from '../../src/utils/apiConfig';
import { MatchConfirmationModal } from '../../src/components/MatchConfirmationModal';
import { BioPopupModal } from '../../src/components/BioPopupModal';
import { Photo } from '../../src/components/PhotoCarousel';
import { UserPhotoApi } from '../../src/data/api/userPhotoApi';
import { X, Check, Lock } from 'lucide-react-native';

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
  const matches = useMatchesStore((state) => state.matches);
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
  const [isDislikeInitiallyDisabled, setIsDislikeInitiallyDisabled] = useState(true);
  const [showBioPopup, setShowBioPopup] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [currentUserPhotos, setCurrentUserPhotos] = useState<Photo[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);

  // Memoize API clients to prevent useEffect loops
  const apiClient = useMemo(() => new ApiClient(API_URL), []);
  const feedApi = useMemo(() => new FeedApi(apiClient), [apiClient]);
  const matchApi = useMemo(() => new MatchApi(apiClient), [apiClient]);
  const profileApi = useMemo(() => new ProfileApi(apiClient), [apiClient]);
  const userPhotoApi = useMemo(() => new UserPhotoApi(apiClient), [apiClient]);

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
          // On error, always show fallback sentence instead of error message
          // Error is logged in backend, user should not see error UI
          console.error('Backend returned error for affinity sentences:', result.error);
          setAffinitySentences(['Initial affinity is low—conversation will sharpen recommendations.']);
          setAffinitySentencesError(false);
        }
      } catch (error) {
        // Check if request was aborted or candidate changed
        if (abortController.signal.aborted || currentCandidateIdRef.current !== candidateId) {
          return;
        }
        // On error, always show fallback sentence instead of error message
        // Error is logged in backend, user should not see error UI
        if (error instanceof Error && !error.message.includes('429')) {
          console.error('Failed to load affinity sentences:', error);
        }
        setAffinitySentences(['Initial affinity is low—conversation will sharpen recommendations.']);
        setAffinitySentencesError(false);
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

  // Load current user profile to check show_bio_in_feed setting
  // Reload when screen comes into focus to get latest show_bio_in_feed value
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
      // Reduce log spam: only log if it's not a rate limit error
      if (error instanceof Error && !error.message.includes('429')) {
        console.error('Failed to load current user profile', error);
      }
    }
  }, [tokens?.accessToken, profileApi]);

  // Load profile on mount and when screen comes into focus
  useEffect(() => {
    loadCurrentUserProfile();
  }, [loadCurrentUserProfile]);

  // Reload profile when screen comes into focus to get latest show_bio_in_feed value
  useFocusEffect(
    useCallback(() => {
      loadCurrentUserProfile();
    }, [loadCurrentUserProfile])
  );

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
        // API errors loading feed are system errors
        notifySystem('Something went wrong', 'Try again', result.error, () => loadFeed(offset, append));
      }
    } catch (error) {
      setError('Network error');
      // Network errors are system errors with retry
      notifySystem('Something went wrong', 'Try again', error, () => loadFeed(offset, append));
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

  // Load photos for current user
  const loadCurrentUserPhotos = useCallback(async () => {
    const currentUser = users[currentIndex];

    if (!currentUser?.id || !tokens?.accessToken) {
      setCurrentUserPhotos([]);
      return;
    }

    // Guard: prevent duplicate calls for the same candidate
    if (currentCandidateIdRef.current === currentUser.id && currentUserPhotos.length > 0) {
      return;
    }

    setIsLoadingPhotos(true);
    try {
      const result = await userPhotoApi.getUserPublicPhotos(
        currentUser.id,
        tokens.accessToken
      );

      if (result.success) {
        setCurrentUserPhotos(result.data);
      } else {
        // Fallback to single photo from feed
        if (currentUser.photoUrl) {
          setCurrentUserPhotos([{
            id: 'fallback',
            public_url: currentUser.photoUrl,
            is_main: true,
            position: 0,
          }]);
        } else {
          setCurrentUserPhotos([]);
        }
      }
    } catch (error) {
      console.error('[FeedScreen] Failed to load user photos:', error);
      // Fallback to single photo from feed
      if (currentUser.photoUrl) {
        setCurrentUserPhotos([{
          id: 'fallback',
          public_url: currentUser.photoUrl,
          is_main: true,
          position: 0,
        }]);
      } else {
        setCurrentUserPhotos([]);
      }
    } finally {
      setIsLoadingPhotos(false);
    }
  }, [users, currentIndex, tokens?.accessToken, userPhotoApi]);

  // Load photos when current user changes
  useEffect(() => {
    loadCurrentUserPhotos();
  }, [loadCurrentUserPhotos]);

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


  // Enable dislike button after 1.5 seconds when user changes
  useEffect(() => {
    const currentUser = users[currentIndex];

    // Only enable timer if we have a valid user
    if (!currentUser?.id) {
      setIsDislikeInitiallyDisabled(true);
      return;
    }

    // Start with button disabled
    setIsDislikeInitiallyDisabled(true);

    // Enable after 1.5 seconds
    const timer = setTimeout(() => {
      setIsDislikeInitiallyDisabled(false);
    }, 1500);

    // Cleanup timer if user changes before timer completes
    return () => {
      clearTimeout(timer);
    };
  }, [currentIndex, users]);

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
        // For other errors, show system error
        notifySystem('Something went wrong', 'Try again', result.error);
        return;
      }

      // Check if it's a potential match (mutual like but not confirmed)
      if (result.data.isPotentialMatch) {
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
        notifySystem('Something went wrong', 'Try again', error, handleLike);
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
        // API errors confirming match are system errors
        notifySystem('Something went wrong', 'Try again', result.error);
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
      // Network errors are system errors
      notifySystem('Something went wrong', 'Try again', error);
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
        // For other errors, show system error
        notifySystem('Something went wrong', 'Try again', result.error);
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
        notifySystem('Something went wrong', 'Try again', error, handlePass);
      }
    } finally {
      // Debounce: keep button disabled for 300ms to prevent rapid clicking
      passTimeoutRef.current = setTimeout(() => {
        setIsPassing(false);
      }, 300);
    }
  };

  const currentUser = users[currentIndex];

  // Must run unconditionally (before any return) to avoid "Rendered more hooks than previous render"
  const photosForDiscover = useMemo(() => {
    const raw =
      currentUserPhotos.length > 0
        ? currentUserPhotos
        : currentUser?.photoUrl
          ? [{ id: 'fallback', public_url: currentUser.photoUrl, is_main: true, position: 0 }]
          : [];
    return [...raw].sort((a, b) => {
      if (a.is_main && !b.is_main) return -1;
      if (!a.is_main && b.is_main) return 1;
      return (a.position ?? 0) - (b.position ?? 0);
    });
  }, [currentUserPhotos, currentUser?.photoUrl]);

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
    // Get the first active human chat (exclude bots)
    const activeChat = matches.find(
      (match) => !match.otherUser?.isBot
    );

    return (
      <View style={styles.lockedContainer}>
        <View style={styles.lockedContent}>
          {/* Exclusive mode badge */}
          <View style={styles.exclusiveBadge}>
            <Lock size={10} color="#999" />
            <Text style={styles.exclusiveBadgeText}>Exclusive</Text>
          </View>
          {/* Title */}
          <Text style={styles.lockedTitle}>Discover is paused</Text>

          {/* Subtitle */}
          <Text style={styles.lockedSubtitle}>
            {activeChat
              ? `You're getting to know ${activeChat.otherUser?.name ?? 'someone'}.`
              : "You're getting to know someone."}
          </Text>

          {/* Active chat card */}
          {activeChat && (
            <View style={styles.activeChatCard}>
              <View style={styles.activeChatAvatarContainer}>
                <Image
                  source={
                    activeChat.otherUser?.photoUrl
                      ? { uri: activeChat.otherUser.photoUrl }
                      : require('../../assets/placeholder.png')
                  }
                  style={styles.activeChatAvatar}
                />
              </View>
              <View style={styles.activeChatInfo}>
                <View style={styles.activeChatNameContainer}>
                  <Text style={styles.activeChatName}>
                    {activeChat.otherUser?.name ?? 'Unknown user'}
                  </Text>
                  <View style={styles.activeChatTag}>
                    <Text style={styles.activeChatTagText}>Active chat</Text>
                  </View>
                </View>
                {activeChat.lastMessage?.content && (
                  <Text style={styles.activeChatSnippet} numberOfLines={1}>
                    {activeChat.lastMessage.content}
                  </Text>
                )}
              </View>
            </View>
          )}
          {/* Primary CTA */}
          {activeChat && (
            <TouchableOpacity
              style={styles.goToChatButton}
              onPress={() => {
                router.push({
                  pathname: '/chat/[matchId]',
                  params: {
                    matchId: activeChat.id,
                    name: activeChat.otherUser?.name ?? 'Chat',
                    photoUrl: activeChat.otherUser?.photoUrl ?? '',
                    otherUserId: activeChat.otherUser?.id ?? '',
                    isBot: 'false',
                    fromDiscover: 'true',
                  },
                });
              }}
            >
              <Text style={styles.goToChatButtonText}>
                Continue conversation
              </Text>
            </TouchableOpacity>
          )}

          {/* Footnote */}
          <Text style={styles.lockedFootnote}>
            Discover resumes when you close your active chat.
          </Text>
        </View>
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
            : 'Wodates prioritizes quality over quantity. Improve your affinity by talking with Doc Love.'}
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

  const primaryPhoto = photosForDiscover[0] ?? null;
  const secondPhoto = photosForDiscover[1] ?? null;
  const remainingPhotos = photosForDiscover.slice(2);

  const showBioCard =
    !!currentUser?.bio &&
    typeof (currentUser as any).show_bio_in_feed === 'boolean' &&
    (currentUser as any).show_bio_in_feed === true;

  const affinityExplanationText =
    affinitySentences.length > 0
      ? affinitySentences.join(' ')
      : 'Initial affinity is low—conversation will sharpen recommendations.';

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.discoverScroll}
        contentContainerStyle={styles.discoverScrollContent}
        showsVerticalScrollIndicator={true}
      >
        {/* 1) Top: Name, Age */}
        <View style={styles.discoverHeader}>
          <View style={styles.discoverNameAgeRow}>
            <Text style={styles.discoverName}>
              {currentUser.name}
              {typeof age === 'number' ? `, ${age}` : ''}
            </Text>
          </View>
        </View>

        {/* 2) Main photo */}
        {primaryPhoto && (
          <View style={styles.discoverPhotoBlock}>
            <Image
              source={resolvePhotoUrl(primaryPhoto.public_url)}
              style={styles.discoverPhotoImage}
              resizeMode="cover"
            />
          </View>
        )}

        {/* 3) Affinity card (inline, no popup) */}
        <View style={styles.discoverCard}>
          <View style={styles.affinityCardContent}>
            <Text style={styles.discoverCardTitle}>Affinity</Text>
            {isLoadingSentences ? (
              <View style={styles.affinityLoadingRow}>
                <ActivityIndicator size="small" color="#e91e63" />
                <Text style={styles.discoverCardBody}>Finding highlights...</Text>
              </View>
            ) : (
              <Text style={styles.discoverCardBody}>{affinityExplanationText}</Text>
            )}
            <Text style={styles.discoverCardLabel}>Based on conversations</Text>
          </View>
        </View>

        {/* 4) Second photo (if exists) */}
        {secondPhoto && (
          <View style={styles.discoverPhotoBlock}>
            <Image
              source={{ uri: secondPhoto.public_url }}
              style={styles.discoverPhotoImage}
              resizeMode="cover"
            />
          </View>
        )}

        {/* 5) Bio card */}
        <View style={styles.discoverCard}>
          <Text style={styles.discoverCardTitle}>Bio</Text>
          {showBioCard ? (
            <Text style={styles.discoverCardBody}>{currentUser.bio}</Text>
          ) : (
            <Text style={styles.discoverCardBodyMuted}>No bio available</Text>
          )}
          <Text style={styles.discoverCardLabel}>Based on conversations</Text>
        </View>

        {/* 6) Remaining photos (3rd, 4th, 5th) */}
        {remainingPhotos.map((photo) => (
          <View key={photo.id} style={styles.discoverPhotoBlock}>
            <Image
              source={{ uri: photo.public_url }}
              style={styles.discoverPhotoImage}
              resizeMode="cover"
            />
          </View>
        ))}
      </ScrollView>

      {/* Floating Dislike button - bottom left */}
      <TouchableOpacity
        style={[
          styles.discardButtonFloating,
          isDislikeInitiallyDisabled && styles.discardButtonDisabled,
        ]}
        onPress={handlePass}
        disabled={isDislikeInitiallyDisabled}
        accessibilityRole="button"
        accessibilityLabel="Not for me"
        accessibilityHint="Dismiss this suggested profile"
        activeOpacity={0.8}
      >
        <X size={24} color={isDislikeInitiallyDisabled ? 'rgba(239, 68, 68, 0.45)' : '#ef4444'} />
      </TouchableOpacity>

      {/* Floating Like button - bottom right, always visible */}
      <TouchableOpacity
        style={[styles.likeButtonFloating, (isLiking || isDislikeInitiallyDisabled) && styles.likeButtonFloatingDisabled]}
        onPress={handleLike}
        disabled={isLiking || isDislikeInitiallyDisabled}
        accessibilityRole="button"
        accessibilityLabel="I want to meet them"
        accessibilityHint="Show interest in this person"
        activeOpacity={0.8}
      >
        <Check size={26} color="#10b981" />
      </TouchableOpacity>

      {/* Match Confirmation Modal */}
      <MatchConfirmationModal
        visible={showMatchModal}
        otherUserName={potentialMatch?.name ?? ''}
        otherUserPhotoUrl={potentialMatch?.photoUrl}
        onConfirm={handleConfirmMatch}
        onCancel={handleCancelMatch}
        isConfirming={isConfirmingMatch}
      />

      {/* Bio Popup Modal (kept for any existing usage) */}
      <BioPopupModal
        visible={showBioPopup}
        bio={currentUser?.bio}
        onClose={() => setShowBioPopup(false)}
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
  // Locked/Exclusive mode styles
  lockedContainer: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 60,
  },
  lockedContent: {
    paddingHorizontal: 20,
  },
  exclusiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    marginBottom: 16,
    gap: 5,
  },
  exclusiveBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#999',
  },
  lockedTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  lockedValueLine: {
    fontSize: 13,
    color: '#999',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  lockedSubtitle: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
    marginBottom: 32,
  },
  activeChatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  activeChatAvatarContainer: {
    marginRight: 16,
  },
  activeChatAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#f0f0f0',
  },
  activeChatInfo: {
    flex: 1,
  },
  activeChatNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  activeChatName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  activeChatTag: {
    backgroundColor: '#e8f5e9',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  activeChatTagText: {
    color: '#66bb6a',
    fontSize: 11,
    fontWeight: '500',
  },
  activeChatSnippet: {
    fontSize: 12,
    color: '#aaa',
    lineHeight: 18,
  },
  goToChatButton: {
    backgroundColor: '#e91e63',
    paddingVertical: 14,
    borderRadius: 25,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#e91e63',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  goToChatButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  lockedFootnote: {
    fontSize: 11,
    color: '#bbb',
    textAlign: 'center',
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
  affinityChipLoading: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  affinityChipText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
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
  // Discover vertical scroll (Hinge-style)
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
  discardButtonDisabled: {
    opacity: 0.45,
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
  likeButtonFloatingDisabled: {
    opacity: 0.45,
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
  affinityLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
});
