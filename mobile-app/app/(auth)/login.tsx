import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/domain/stores/authStore';
import { ApiClient } from '../../src/data/api/apiClient';
import { AuthApi } from '../../src/data/api/authApi';
import { AuthTokens } from '../../src/domain/entities/Auth';
import { User, Gender } from '../../src/domain/entities/User';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

const normalizeUser = (rawUser: Record<string, unknown>): User => {
  const now = new Date().toISOString();

  if (typeof rawUser?.id !== 'string' || typeof rawUser?.email !== 'string') {
    throw new Error('User payload is missing required fields.');
  }

  const gender = (rawUser.gender ?? 'other') as Gender;

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
        const message = result.error.message ?? 'No se pudo iniciar sesion. Revisa tus credenciales.';
        setError(message);
        Alert.alert('Error de inicio de sesion', message);
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
      router.replace('/(app)/feed');
    } catch (err) {
      console.error('Login error', err);
      const message = 'Error de red. Intentalo de nuevo.';
      setError(message);
      Alert.alert('Error', message);
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
            <Text style={styles.title}>WODATES</Text>
            <Text style={styles.subtitle}>Find your perfect match</Text>

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
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={isLoading}
              >
                <Text style={styles.buttonText}>{isLoading ? 'Entrando...' : 'Login'}</Text>
              </TouchableOpacity>

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
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: Platform.OS === 'android' ? 100 : 40,
  },
  innerContent: {
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#e91e63',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 40,
    color: '#666',
  },
  form: {
    width: '100%',
    maxWidth: 300,
    gap: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  button: {
    backgroundColor: '#e91e63',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    marginTop: 8,
    color: '#ff4d4d',
    textAlign: 'center',
  },
  debugText: {
    marginTop: 12,
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});
