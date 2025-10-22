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
      ): "male" | "female" | "non_binary" | undefined => {
        const allowed = ["male", "female", "non_binary"] as const;
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
    <TouchableOpacity style={styles.matchCard} onPress={() => handleMatchPress(item)}>
      <View style={styles.avatarContainer}>
        <Image
          source={item.otherUser?.photoUrl ? { uri: item.otherUser.photoUrl } : require('../../assets/placeholder.png')}
          style={styles.avatar}
        />
        {item.unreadCount > 0 && (
          <View style={styles.unreadIndicator} />
        )}
      </View>
      <View style={styles.matchInfo}>
        <View style={styles.nameContainer}>
          <Text style={styles.matchName}>{item.otherUser?.name ?? 'Unknown user'}</Text>
          {item.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unreadCount}</Text>
            </View>
          )}
        </View>
        <Text style={styles.lastMessage} numberOfLines={2}>
          {item.lastMessage?.content || 'Start a conversation...'}
        </Text>
        <Text style={styles.timestamp}>
          {item.lastMessage?.createdAt 
            ? new Date(item.lastMessage.createdAt).toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })
            : new Date(item.createdAt).toLocaleDateString([], {
                month: 'short',
                day: 'numeric'
              })
          }
        </Text>
      </View>
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
      {matches.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Text style={styles.emptyIcon}>💕</Text>
          </View>
          <Text style={styles.emptyTitle}>No matches yet</Text>
          <Text style={styles.emptySubtext}>
            Keep swiping in Discover to find your perfect match!
          </Text>
          <TouchableOpacity 
            style={styles.discoverButton}
            onPress={() => router.push('/(app)/feed')}
          >
            <Text style={styles.discoverButtonText}>Start Discovering</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList 
          data={matches} 
          renderItem={renderMatch} 
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  listContainer: {
    paddingVertical: 8,
  },
  
  // Estado vacío mejorado
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
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
  
  // Tarjetas de matches rediseñadas
  matchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  
  // Contenedor del avatar mejorado
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2,
    borderColor: '#f0f0f0',
  },
  unreadIndicator: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#e91e63',
    borderWidth: 2,
    borderColor: '#fff',
  },
  
  // Información del match mejorada
  matchInfo: {
    flex: 1,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  matchName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
  },
  
  // Badge de mensajes no leídos
  unreadBadge: {
    backgroundColor: '#e91e63',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
});
