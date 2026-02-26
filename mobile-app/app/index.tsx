import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { useAuthStore } from '../src/domain/stores/authStore';

export default function Home() {
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    if (user) {
      router.replace('/(app)/matches');
    }
  }, [user, router]);

  const handleJoinLondonDrop = () => {
    router.push('/(auth)/register');
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <View style={styles.container}>
        {/* Logo + app name */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../assets/icon.png')}
            style={styles.logoIcon}
            resizeMode="contain"
          />
          <Text style={styles.logoText}>Wodates</Text>
        </View>

        {/* Headline + subheadline */}
        <View style={styles.sloganBlock}>
          <Text style={styles.headline}>Designed for people who are done with swipe culture.</Text>
          <Text style={styles.subheadline}>One conversation. Real depth.</Text>
        </View>

        {/* Primary CTA: Join London Drop */}
        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleJoinLondonDrop}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Join London Drop</Text>
          </TouchableOpacity>
          <Text style={styles.caption}>London only · Drop #1 · March 8</Text>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/(auth)/login')}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryButtonText}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#ffffff',
    gap: 40,
  },
  logoContainer: {
    alignItems: 'center',
    gap: 16,
  },
  logoIcon: {
    width: 80,
    height: 80,
  },
  logoText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#F45C5C',
    letterSpacing: -0.5,
  },
  sloganBlock: {
    alignItems: 'center',
    gap: 8,
  },
  headline: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
    lineHeight: 26,
    paddingHorizontal: 8,
  },
  subheadline: {
    fontSize: 17,
    fontWeight: '400',
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 24,
  },
  buttonsContainer: {
    width: '100%',
    gap: 12,
    maxWidth: 280,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#F45C5C',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#F45C5C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  caption: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    fontWeight: '400',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#F45C5C',
    alignItems: 'center',
    width: '100%',
  },
  secondaryButtonText: {
    color: '#F45C5C',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
