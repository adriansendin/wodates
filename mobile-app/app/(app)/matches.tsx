import React, { useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMatchesStore } from '../../src/domain/stores/matchesStore';
import { useAuthStore } from '../../src/domain/stores/authStore';

type MatchWithUser = ReturnType<typeof useMatchesStore.getState>['matches'][number];

export default function MatchesScreen() {
  const router = useRouter();
  const { matches, isLoading, setMatches, setLoading } = useMatchesStore();
  const { user } = useAuthStore();

  useEffect(() => {
    setLoading(true);

    const now = new Date().toISOString();

    const mockMatches: MatchWithUser[] = [
      {
        id: '1',
        userId1: user?.id || 'user-1',
        userId2: 'user-2',
        createdAt: now,
        otherUser: {
          id: 'user-2',
          email: 'alice@example.com',
          name: 'Alice Johnson',
          birthDate: new Date(1995, 5, 15).toISOString(),
          gender: 'female',
          createdAt: now,
          updatedAt: now,
          bio: 'Crossfit and yoga lover.',
          photoUrl: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400',
        },
        lastMessage: {
          id: 'msg-1',
          matchId: '1',
          senderId: 'user-2',
          content: 'Hey! How are you?',
          createdAt: now,
        },
        unreadCount: 2,
      },
      {
        id: '2',
        userId1: user?.id || 'user-1',
        userId2: 'user-3',
        createdAt: now,
        otherUser: {
          id: 'user-3',
          email: 'bob@example.com',
          name: 'Bob Smith',
          birthDate: new Date(1992, 10, 5).toISOString(),
          gender: 'male',
          createdAt: now,
          updatedAt: now,
          bio: 'Runner and nutrition geek.',
          photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
        },
        lastMessage: {
          id: 'msg-2',
          matchId: '2',
          senderId: user?.id || 'user-1',
          content: 'Thanks for the match!',
          createdAt: now,
        },
        unreadCount: 0,
      },
    ];

    const timeout = setTimeout(() => {
      setMatches(mockMatches);
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [user, setMatches, setLoading]);

  const handleMatchPress = (match: MatchWithUser) => {
    router.push({
      pathname: '/chat/[matchId]',
      params: {
        matchId: match.id,
        name: match.otherUser?.name ?? 'Chat',
        photoUrl: match.otherUser?.photoUrl ?? '',
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
