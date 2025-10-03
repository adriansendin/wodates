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
import { useMatchesStore } from '../domain/stores/matchesStore';
import { useAuthStore } from '../domain/stores/authStore';

export default function MatchesScreen({ navigation }: { navigation: any }) {
  const { matches, isLoading, setMatches, setLoading } = useMatchesStore();
  const { user } = useAuthStore();

  useEffect(() => {
    // In v0.1, we'll use mock data
    // In production, fetch from API
    setLoading(true);
    
    // Mock matches data
    const mockMatches = [
      {
        id: '1',
        userId1: user?.id || 'user-1',
        userId2: 'user-2',
        createdAt: new Date().toISOString(),
        otherUser: {
          id: 'user-2',
          name: 'Alice Johnson',
          photoUrl: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400',
        },
        lastMessage: {
          id: 'msg-1',
          matchId: '1',
          senderId: 'user-2',
          content: 'Hey! How are you?',
          createdAt: new Date().toISOString(),
        },
        unreadCount: 2,
      },
      {
        id: '2',
        userId1: user?.id || 'user-1',
        userId2: 'user-3',
        createdAt: new Date().toISOString(),
        otherUser: {
          id: 'user-3',
          name: 'Bob Smith',
          photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
        },
        lastMessage: {
          id: 'msg-2',
          matchId: '2',
          senderId: user?.id || 'user-1',
          content: 'Thanks for the match!',
          createdAt: new Date().toISOString(),
        },
        unreadCount: 0,
      },
    ];
    
    setTimeout(() => {
      setMatches(mockMatches);
      setLoading(false);
    }, 1000);
  }, [user, setMatches, setLoading]);

  const handleMatchPress = (match: any) => {
    navigation.navigate('Chat', { matchId: match.id, otherUser: match.otherUser });
  };

  const renderMatch = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.matchItem}
      onPress={() => handleMatchPress(item)}
    >
      <Image
        source={{ uri: item.otherUser.photoUrl || 'https://via.placeholder.com/60x60' }}
        style={styles.avatar}
      />
      <View style={styles.matchInfo}>
        <Text style={styles.matchName}>{item.otherUser.name}</Text>
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
          <Text style={styles.emptySubtext}>Keep swiping to find your perfect match!</Text>
        </View>
      ) : (
        <FlatList
          data={matches}
          renderItem={renderMatch}
          keyExtractor={(item) => item.id}
          style={styles.matchesList}
        />
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
  matchesList: {
    flex: 1,
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
