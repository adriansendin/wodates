import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { usePreviewStore } from '../../src/domain/stores/previewStore';

export default function PreviewProfileScreen() {
  const router = useRouter();
  const { exitPreview } = usePreviewStore();

  const handleRegister = () => {
    exitPreview();
    router.push('/(auth)/register/step1');
  };

  const handleSignIn = () => {
    exitPreview();
    router.push('/(auth)/login');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="lock-closed" size={64} color="#999" />
        </View>

        <Text style={styles.title}>Your profile is locked.</Text>
        <Text style={styles.subtitle}>
        Create a free account to set your preferences and meet real people.
        </Text>

        <TouchableOpacity
          style={styles.registerButton}
          onPress={handleRegister}
        >
          <Text style={styles.registerButtonText}>
            Create free account
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.signInButton}
          onPress={handleSignIn}
        >
          <Text style={styles.signInButtonText}>
            Sign in
          </Text>
        </TouchableOpacity>

        <Text style={styles.optionalText}>
          Takes less than 1 minute.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C3E50',
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#7F8C8D',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  registerButton: {
    backgroundColor: '#F45C5C',
    borderRadius: 12,
    padding: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    minWidth: 280,
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  signInButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    minWidth: 280,
    borderWidth: 1,
    borderColor: '#F45C5C',
    marginTop: 12,
  },
  signInButtonText: {
    color: '#F45C5C',
    fontSize: 16,
    fontWeight: 'bold',
  },
  optionalText: {
    fontSize: 12,
    color: '#7F8C8D',
    textAlign: 'center',
    marginTop: 12,
  },
});
