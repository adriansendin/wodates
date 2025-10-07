import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFeedStore } from '../../src/domain/stores/feedStore';
import { useAuthStore } from '../../src/domain/stores/authStore';
import { FeedApi } from '../../src/data/api/feedApi';
import { ApiClient } from '../../src/data/api/apiClient';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

const getAge = (birthDate?: string) => {
  if (!birthDate) {
    return undefined;
  }

  const date = new Date(birthDate);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const monthDiff = now.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getDate())) {
    age -= 1;
  }

  return age;
};

export default function FeedScreen() {
  const { users, currentIndex, isLoading, setUsers, nextUser, setLoading, setError } =
    useFeedStore();
  const { tokens } = useAuthStore();
  const [isLiking, setIsLiking] = useState(false);
  const [isPassing, setIsPassing] = useState(false);

  const apiClient = new ApiClient(API_URL);
  const feedApi = new FeedApi(apiClient);

  useEffect(() => {
    loadFeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadFeed = async () => {
    if (!tokens?.accessToken) return;

    setLoading(true);
    try {
      const result = await feedApi.getFeed(10, 0, tokens.accessToken);
      if (result.success) {
        setUsers(result.data.users);
      } else {
        setError(result.error.message);
        Alert.alert('Error', result.error.message);
      }
    } catch (error) {
      setError('Network error');
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    if (!tokens?.accessToken || isLiking) return;

    const currentUser = users[currentIndex];
    if (!currentUser) return;

    setIsLiking(true);
    try {
      const result = await feedApi.likeUser(currentUser.id, tokens.accessToken);
      if (result.success) {
        if (result.data.isMatch) {
          Alert.alert("It's a Match!", 'You and this person liked each other!');
        }
        nextUser();
      } else {
        Alert.alert('Error', result.error.message);
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setIsLiking(false);
    }
  };

  const handlePass = async () => {
    if (!tokens?.accessToken || isPassing) return;

    const currentUser = users[currentIndex];
    if (!currentUser) return;

    setIsPassing(true);
    try {
      const result = await feedApi.passUser(currentUser.id, tokens.accessToken);
      if (result.success) {
        nextUser();
      } else {
        Alert.alert('Error', result.error.message);
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
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

  const age = getAge(currentUser.birthDate);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Image
          source={{ uri: currentUser.photoUrl || 'https://via.placeholder.com/300x400' }}
          style={styles.image}
          resizeMode="cover"
        />
        <View style={styles.overlay}>
          <Text style={styles.name}>
            {currentUser.name}
            {typeof age === 'number' ? `, ${age}` : ''}
          </Text>
          <Text style={styles.bio} numberOfLines={3}>
            {currentUser.bio || 'This user has not added a bio yet.'}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.passButton]}
          onPress={handlePass}
          disabled={isPassing}
        >
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.likeButton]}
          onPress={handleLike}
          disabled={isLiking}
        >
          <Ionicons name="heart" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 20,
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
  card: {
    flex: 1,
    margin: 20,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 20,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  bio: {
    fontSize: 16,
    color: '#fff',
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 20,
    gap: 40,
  },
  actionButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  passButton: {
    backgroundColor: '#ff6b6b',
  },
  likeButton: {
    backgroundColor: '#4ecdc4',
  },
});
