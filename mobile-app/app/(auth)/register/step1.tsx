import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useRegistrationStore } from '../../../src/domain/stores/registrationStore';
import { ProgressBar } from '../../../src/components/ProgressBar';
import { FeedbackBanner } from '../../../src/components/FeedbackBanner';
import { ApiClient } from '../../../src/data/api/apiClient';
import { AuthApi } from '../../../src/data/api/authApi';
import { getApiUrl } from '../../../src/utils/apiConfig';

export default function Step1Screen() {
  const router = useRouter();
  const { data, updateData, nextStep } = useRegistrationStore();
  
  const [name, setName] = useState(data.name);
  const [email, setEmail] = useState(data.email);
  const [password, setPassword] = useState(data.password);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const apiClient = useMemo(() => new ApiClient(getApiUrl()), []);
  const authApi = useMemo(() => new AuthApi(apiClient), [apiClient]);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleNext = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Por favor ingresa tu nombre');
      return;
    }

    if (!email.trim()) {
      Alert.alert('Error', 'Por favor ingresa tu email');
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert('Error', 'Por favor ingresa un email válido');
      return;
    }

    if (!password || password.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }

    // Verificar si el email ya existe
    setErrorMessage(null);
    setIsCheckingEmail(true);
    try {
      const result = await authApi.checkEmail(email.trim());
      
      if (result.success) {
        if (result.data.exists) {
          setIsCheckingEmail(false);
          setErrorMessage('Correo electrónico ya está registrado');
          return;
        }
      } else {
        // Si hay un error al verificar, mostramos un mensaje pero permitimos continuar
        // El backend también verificará al registrar
        console.warn('[Step1] Error checking email:', result.error);
        setIsCheckingEmail(false);
        // No mostramos error aquí, simplemente continuamos
        // El backend verificará al registrar
      }
    } catch (error) {
      // Si hay un error de red, no mostramos error, simplemente continuamos
      // El backend también verificará al registrar
      console.error('[Step1] Network error checking email:', error);
      setIsCheckingEmail(false);
      // No mostramos error aquí, simplemente continuamos
      // El backend verificará al registrar
    } finally {
      setIsCheckingEmail(false);
    }

    // Si el email no existe o hubo un error, continuar con el registro
    // El backend verificará el email al registrar
    updateData({ name, email, password });
    nextStep();
    router.push('/(auth)/register/step7');
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
          showsVerticalScrollIndicator={false}
        >
          <ProgressBar totalSteps={7} currentStep={6} />

          <View style={styles.content}>
            {errorMessage && (
              <FeedbackBanner
                type="error"
                message={errorMessage}
                onClose={() => setErrorMessage(null)}
              />
            )}
            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Nombre</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Tu nombre"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="tu@email.com"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  returnKeyType="next"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Contraseña</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  returnKeyType="done"
                  onSubmitEditing={handleNext}
                />
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.button, isCheckingEmail && styles.buttonDisabled]} 
              onPress={handleNext}
              disabled={isCheckingEmail}
            >
              {isCheckingEmail ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Continuar</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.backButton} 
              onPress={() => router.back()}
            >
              <Text style={styles.backButtonText}>Volver</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: Platform.OS === 'android' ? 100 : 20,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2C3E50',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#7F8C8D',
    textAlign: 'center',
    marginBottom: 32,
  },
  form: {
    gap: 20,
    marginBottom: 32,
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
    marginLeft: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
  },
  button: {
    backgroundColor: '#F45C5C',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  backButton: {
    padding: 12,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#7F8C8D',
    fontSize: 14,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

