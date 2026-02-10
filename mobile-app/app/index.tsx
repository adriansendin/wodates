import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/domain/stores/authStore';
import { usePreviewStore } from '../src/domain/stores/previewStore';

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { enterPreview } = usePreviewStore();

  useEffect(() => {
    if (user) {
      router.replace('/(app)/matches');
    }
  }, [user, router]);

  const handleEnterPreview = () => {
    enterPreview();
    router.push('/(preview)/feed');
  };

  const handleDirectRegister = () => {
    // Navigate directly to registration onboarding (first screen: city selection)
    // TODO: Add analytics tracking if needed: cta_register_direct_clicked
    router.push('/(auth)/register');
  };

  return (
    <>
      <Stack.Screen 
        options={{ 
          headerShown: false 
        }} 
      />
      <View style={styles.container}>
        {/* Top-right: matchmaker CTA (absolute so main content stays centered) */}
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) }]}>
          <TouchableOpacity
            style={styles.matchmakerButton}
            onPress={() => router.push('/intromatchmaker')}
            activeOpacity={0.7}
          >
            <Text style={styles.matchmakerButtonText}>are you a matchmaker?</Text>
          </TouchableOpacity>
        </View>

        {/* Logo completo: icono + palabra Wodates */}
        <View style={styles.logoContainer}>
          <Image 
            source={require('../assets/icon.png')} 
            style={styles.logoIcon}
            resizeMode="contain"
          />
          <Text style={styles.logoText}>Wodates</Text>
        </View>

        {/* Tagline */}
        <View style={styles.sloganBlock}>
                <Text style={styles.tagline}>Dating by affinity</Text>
                <Text style={styles.tagline}>One connection at a time</Text>
        </View>

        {/* Botones principales */}
        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={styles.secondaryButtonText}>Sign in</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleEnterPreview}
          >
            <Text style={styles.primaryButtonText}>Enter preview</Text>
          </TouchableOpacity>
        </View>

        {/* Link de registro directo */}
        <TouchableOpacity
          style={styles.registerLinkContainer}
          onPress={handleDirectRegister}
          activeOpacity={0.6}
        >
          <Text style={styles.registerLinkText}>New here? Create an account</Text>
        </TouchableOpacity>
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
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    zIndex: 1,
  },
  matchmakerButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F45C5C',
    backgroundColor: 'transparent',
  },
  matchmakerButtonText: {
    color: '#F45C5C',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.2,
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
  tagline: {
    fontSize: 18,
    color: '#6B6B6B',
    textAlign: 'center',
    fontWeight: '400',
    lineHeight: 24,
  },
  buttonsContainer: {
    width: '100%',
    gap: 16,
    maxWidth: 280,
  },
  primaryButton: {
    backgroundColor: '#F45C5C',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#F45C5C',
    shadowOffset: {
      width: 0,
      height: 4,
    },
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
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#F45C5C',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#F45C5C',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  sloganBlock: {
    alignItems: 'center',
    gap: 2, // reduce o aumenta según prefieras
    marginTop: -10, // opcional: ajusta verticalmente si queda muy separado del logo
  },
  registerLinkContainer: {
    marginTop: 0,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  registerLinkText: {
    fontSize: 15,
    color: '#F45C5C',
    textAlign: 'center',
    textDecorationLine: 'underline',
    fontWeight: '500',
    letterSpacing: 0.2,
  },
});
