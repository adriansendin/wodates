import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Stack } from 'expo-router';

// Simplified auth store for MVP
const useAuthStore = () => {
  // Mock implementation for MVP
  return {
    user: null // No user logged in initially
  };
};

export default function Home() {
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    if (user) {
      router.replace('/(app)/feed');
    }
  }, [user, router]);

  return (
    <>
      <Stack.Screen 
        options={{ 
          headerShown: false 
        }} 
      />
      <View style={styles.container}>
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
                <Text style={styles.tagline}>Relaciones serias</Text>
                <Text style={styles.tagline}>Menos swipe. Más conexiones.</Text>
        </View>

        {/* Botones principales */}
        <View style={styles.buttonsContainer}>
          <Link href="/(auth)/register" asChild>
            <TouchableOpacity style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Crear una cuenta</Text>
            </TouchableOpacity>
          </Link>

          <Link href="/(auth)/login" asChild>
            <TouchableOpacity style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Iniciar sesión</Text>
            </TouchableOpacity>
          </Link>
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
});
