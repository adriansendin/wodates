import React from 'react';
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Text,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function AvatarViewScreen() {
  const params = useLocalSearchParams<{
    photoUrl?: string | string[];
    name?: string | string[];
  }>();
  const router = useRouter();

  const photoUrl = Array.isArray(params.photoUrl) ? params.photoUrl[0] : params.photoUrl;

  const [loading, setLoading] = React.useState(true);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerStyle: {
            backgroundColor: '#ffffff',
          },
          headerLeft: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={{ marginLeft: 16, padding: 8 }}
              >
                <Ionicons name="arrow-back" size={24} color="#000000" />
              </TouchableOpacity>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#e91e63', marginLeft: 8 }}>
                Wodates
              </Text>
            </View>
          ),
          headerTitle: '',
        }}
      />
      <View style={styles.container}>
        <View style={styles.imageContainer}>
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#e91e63" />
            </View>
          )}
          <Image
            source={{ uri: photoUrl || 'https://via.placeholder.com/800x800' }}
            style={styles.image}
            resizeMode="contain"
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
          />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
});

