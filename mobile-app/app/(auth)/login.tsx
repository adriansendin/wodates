import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/domain/stores/authStore';
import { ApiClient } from '../../src/data/api/apiClient';
import { AuthApi } from '../../src/data/api/authApi';
import { AuthTokens } from '../../src/domain/entities/Auth';
import { User, Gender } from '../../src/domain/entities/User';
import { getApiUrl } from '../../src/utils/apiConfig';
import { notifyActionable, notifySystem } from '../../src/utils/notificationService';
import { trackLoginSuccess } from '../../src/analytics/ga4';

const API_URL = getApiUrl();

const normalizeUser = (rawUser: Record<string, unknown>): User => {
  const now = new Date().toISOString();

  if (typeof rawUser?.id !== 'string' || typeof rawUser?.email !== 'string') {
    throw new Error('User payload is missing required fields.');
  }

  const gender = (rawUser.gender ?? 'male') as Gender;

  return {
    id: rawUser.id,
    email: rawUser.email,
    name: typeof rawUser.name === 'string' ? rawUser.name : '',
    birthDate: typeof rawUser.birthDate === 'string' ? rawUser.birthDate : now,
    gender,
    bio: typeof rawUser.bio === 'string' ? rawUser.bio : undefined,
    photoUrl: typeof rawUser.photoUrl === 'string' ? rawUser.photoUrl : undefined,
    location: rawUser.location as User['location'],
    createdAt: typeof rawUser.createdAt === 'string' ? rawUser.createdAt : now,
    updatedAt: typeof rawUser.updatedAt === 'string' ? rawUser.updatedAt : now,
  };
};

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, setLoading, setError, isLoading, error } = useAuthStore();

  const apiClient = useMemo(() => new ApiClient(API_URL), []);
  const authApi = useMemo(() => new AuthApi(apiClient), [apiClient]);

  const handleLogin = async () => {
    if (isLoading) {
      return;
    }

    console.log('[Login] handleLogin pressed');

    setLoading(true);
    setError(null);

    try {
      const result = await authApi.login({ email, password });

      console.log('[Login] API response', result);

      if (!result.success) {
        const message = result.error.message ?? "Couldn't sign in. Please check your credentials.";
        setError(message);
        // Credential errors are actionable - user can fix them
        notifyActionable("Couldn't sign in", message, result.error);
        return;
      }

      const { user, token } = result.data;
      const normalizedUser = normalizeUser(user as Record<string, unknown>);
      const tokens: AuthTokens = {
        accessToken: token,
        refreshToken: token,
        expiresIn: 7 * 24 * 60 * 60, // 7 dias en segundos
      };

      login(normalizedUser, tokens);
      
      // Track GA4 event: login success
      trackLoginSuccess('email');
      
      router.replace('/(app)/matches');
    } catch (err) {
      console.error('Login error', err);
      const message = 'Network error. Please try again.';
      setError(message);
      // Network errors are system errors - user can only retry
      notifySystem('Something went wrong', 'Try again', err, handleLogin);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.innerContent}>
            {/* Logo completo: icono + palabra Wodates */}
            <View style={styles.logoContainer}>
              <Image 
                source={require('../../assets/icon.png')} 
                style={styles.logoIcon}
                resizeMode="contain"
              />
              <Text style={styles.logoText}>Wodates</Text>
            </View>

            {/* Contextual copy: London Drop positioning */}
            <View style={styles.contextualBlock}>
              <Text style={styles.contextualText}>London Drop</Text>
              <Text style={styles.contextualText}>For people who are done with swipe culture.</Text>
            </View>


            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="next"
              />

              <TextInput
                style={styles.input}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />

              <TouchableOpacity
                style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={isLoading}
              >
                <Text style={styles.primaryButtonText}>{isLoading ? 'Signing in...' : 'Sign in'}</Text>
              </TouchableOpacity>

              <Text style={styles.caption}>London only · Drop #1 · March 8</Text>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 40,
    paddingBottom: Platform.OS === 'android' ? 100 : 40,
  },
  innerContent: {
    alignItems: 'center',
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
  contextualBlock: {
    alignItems: 'center',
    gap: 2,
    marginTop: -10,
  },
  contextualText: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    fontWeight: '400',
    lineHeight: 20,
  },
  caption: {
    marginTop: 4,
    fontSize: 12,
    color: '#9E9E9E',
    textAlign: 'center',
    fontWeight: '400',
  },
  form: {
    width: '100%',
    maxWidth: 280,
    gap: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: '#333333',
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
  buttonDisabled: {
    opacity: 0.6,
  },
  errorText: {
    marginTop: 8,
    color: '#ff4d4d',
    textAlign: 'center',
    fontSize: 14,
  },
});
