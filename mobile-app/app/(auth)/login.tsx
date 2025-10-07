import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/domain/stores/authStore';
import { AuthApi } from '../../src/data/api/authApi';
import { ApiClient } from '../../src/data/api/apiClient';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('bob@example.com');
  const [password, setPassword] = useState('password123');
  const [isLoading, setIsLoading] = useState(false);

  const { login, setError, clearError } = useAuthStore();

  const apiClient = new ApiClient(API_URL);
  const authApi = new AuthApi(apiClient);

  const handleLogin = async () => {
    console.log('🔵 Login button pressed');
    console.log('📧 Email:', email);
    console.log('🔑 Password:', password ? '***' : 'empty');
    
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setIsLoading(true);
    clearError();

    try {
      console.log('🌐 Making API call to:', API_URL + '/auth/login');
      const result = await authApi.login({ email, password });
      console.log('📡 API Response:', result);

      if (result.success) {
        const { user, token } = result.data;
        console.log('✅ Login successful, user:', user.name);
        login(user, { accessToken: token, refreshToken: '', expiresIn: 0 });
        router.replace('/(app)/feed');
      } else {
        console.log('❌ Login failed:', result.error.message);
        setError(result.error.message);
        Alert.alert('Login Failed', result.error.message);
      }
    } catch (error) {
      console.log('💥 Network error:', error);
      setError('Network error');
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={styles.title}>WODATES</Text>
        <Text style={styles.subtitle}>Find your perfect match(login)</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TouchableOpacity
            style={[
              styles.button, 
              isLoading && styles.buttonDisabled,
              (!email || !password) && styles.buttonDisabled
            ]}
            onPress={handleLogin}
            disabled={isLoading || !email || !password}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'Logging in...' : 'Login'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#e91e63',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    color: '#666',
  },
  form: {
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
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
