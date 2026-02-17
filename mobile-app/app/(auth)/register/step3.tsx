import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useRegistrationStore } from '../../../src/domain/stores/registrationStore';
import { ProgressBar } from '../../../src/components/ProgressBar';

export default function Step3Screen() {
  const router = useRouter();
  const { data, updateData, nextStep, previousStep } = useRegistrationStore();
  const [selectedCity, setSelectedCity] = React.useState(data.location ?? '');

  const trimmedCity = selectedCity.trim();
  const isValid = trimmedCity.length > 0;

  const handleNext = () => {
    if (!isValid) return;
    updateData({
      location: trimmedCity,
      country: '',
    });
    nextStep();
    router.push('/(auth)/register/step4');
  };

  const handleBack = () => {
    previousStep();
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <ProgressBar totalSteps={5} currentStep={1} />

        <View style={styles.content}>
          <Text style={styles.title}>Where are you based?</Text>

          <View style={styles.form}>
            {/* Replaced predefined city list with free text input (major city only) */}
            <TextInput
              style={styles.input}
              placeholder="e.g. London, Manchester, Berlin"
              value={selectedCity}
              onChangeText={setSelectedCity}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={handleNext}
            />
            <Text style={styles.helperText}>Enter your nearest major city.</Text>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              testID="continuar-step3-button"
              style={[styles.button, !isValid && styles.buttonDisabled]}
              onPress={handleNext}
              disabled={!isValid}
            >
              <Text style={styles.buttonText}>Continue</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollContent: {
    flexGrow: 1,
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
  form: {
    marginBottom: 32,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  helperText: {
    fontSize: 12,
    color: '#7F8C8D',
    marginLeft: 4,
  },
  buttonContainer: {
    gap: 12,
  },
  button: {
    backgroundColor: '#F45C5C',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#BDC3C7',
    opacity: 0.6,
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
});
