import React, { useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useMatchesStore, MatchWithUser } from '../../src/domain/stores/matchesStore';
import { useAuthStore } from '../../src/domain/stores/authStore';
import { ApiClient } from '../../src/data/api/apiClient';
import { MatchApi } from '../../src/data/api/matchApi';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export default function MatchesScreen() {
  const router = useRouter();
  const {
    matches,
    isLoading,
    setMatches,
    setLoading,
    setError,
    clearError,
  } = useMatchesStore();
  const { user, tokens } = useAuthStore();

  const apiClient = useMemo(() => new ApiClient(API_URL), []);
  const matchApi = useMemo(() => new MatchApi(apiClient), [apiClient]);

  const isInitialLoad = useRef(true);
  const isFetching = useRef(false);

  const loadMatches = useCallback(async () => {
    const shouldShowLoader = isInitialLoad.current;

    if (!tokens?.accessToken || !user?.id) {
      setMatches([]);
      if (shouldShowLoader) {
        setLoading(false);
        isInitialLoad.current = false;
      }
      return;
    }

    if (isFetching.current) {
      return;
    }

    isFetching.current = true;

    if (shouldShowLoader) {
      setLoading(true);
    }
    clearError();

    try {
      const result = await matchApi.getMatches(tokens.accessToken);

      if (!result.success) {
        setError(result.error.message);
        if (shouldShowLoader) {
          Alert.alert('Error', result.error.message);
        }
        return;
      }
      const normalizeGender = (
        g?: string | null
      ): "male" | "female" | "non_binary" | "other" | "prefer_not_to_say" | undefined => {
        const allowed = ["male", "female", "non_binary", "other", "prefer_not_to_say"] as const;
        if (g && allowed.includes(g as any)) {
          return g as typeof allowed[number];
        }
        return undefined;
      };
      

      const normalizedMatches: MatchWithUser[] = result.data.matches.map((match) => {
        const otherUserId =
          match.userId1 === user.id ? match.userId2 : match.userId1;

        const otherUser = match.otherUser
          ? {
              id: match.otherUser.id,
              name: match.otherUser.name,
              bio: match.otherUser.bio ?? undefined,
              photoUrl: match.otherUser.photoUrl ?? undefined,
              gender: normalizeGender(match.otherUser.gender ?? undefined),
              birthDate: match.otherUser.birthDate ?? undefined,
            }
          : {
              id: otherUserId,
              name: 'User',
            };

        return {
          id: match.id,
          userId1: match.userId1,
          userId2: match.userId2,
          createdAt: match.createdAt,
          otherUser,
          lastMessage: match.lastMessage ?? undefined,
          unreadCount: match.unreadCount,
        };
      });

      setMatches(normalizedMatches);
    } catch (error) {
      console.error('Failed to load matches', error);
      const message = 'Network error. Please try again.';
      setError(message);
      if (shouldShowLoader) {
        Alert.alert('Error', message);
      }
    } finally {
      if (shouldShowLoader) {
        setLoading(false);
      }
      isInitialLoad.current = false;
      isFetching.current = false;
    }
  }, [clearError, matchApi, setError, setLoading, setMatches, tokens, user]);

  useFocusEffect(
    useCallback(() => {
      loadMatches();

      const interval = setInterval(() => {
        loadMatches();
      }, 5000);

      return () => {
        clearInterval(interval);
      };
    }, [loadMatches]),
  );

  const handleMatchPress = (match: MatchWithUser) => {
    router.push({
      pathname: '/chat/[matchId]',
      params: {
        matchId: match.id,
        name: match.otherUser?.name ?? 'Chat',
        photoUrl: match.otherUser?.photoUrl ?? '',
        otherUserId: match.otherUser?.id ?? '',
      },
    });
  };

  const renderMatch = ({ item }: { item: MatchWithUser }) => (
    <TouchableOpacity style={styles.matchItem} onPress={() => handleMatchPress(item)}>
      <Image
        source={{ uri: item.otherUser?.photoUrl || 'https://via.placeholder.com/60x60' }}
        style={styles.avatar}
      />
      <View style={styles.matchInfo}>
        <Text style={styles.matchName}>{item.otherUser?.name ?? 'Unknown user'}</Text>
        <Text style={styles.lastMessage} numberOfLines={1}>
          {item.lastMessage?.content || 'No messages yet'}
        </Text>
      </View>
      {item.unreadCount > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadText}>{item.unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e91e63" />
        <Text style={styles.loadingText}>Loading matches...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Matches</Text>
      {matches.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No matches yet</Text>
          <Text style={styles.emptySubtext}>Keep swiping to find your perfect match(matches)!</Text>
        </View>
      ) : (
        <FlatList data={matches} renderItem={renderMatch} keyExtractor={(item) => item.id} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    padding: 20,
    color: '#333',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  matchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  matchInfo: {
    flex: 1,
  },
  matchName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
  },
  unreadBadge: {
    backgroundColor: '#e91e63',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  unreadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
