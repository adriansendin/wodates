import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useRegistrationStore } from '../../../src/domain/stores/registrationStore';
import { ProgressBar } from '../../../src/components/ProgressBar';

/** Exact value persisted to DB city/location field. Do not use for display-only text. */
const CITY_VALUE = 'London';

export default function Step3Screen() {
  const router = useRouter();
  const { updateData, nextStep, previousStep } = useRegistrationStore();

  const handleNext = () => {
    updateData({
      location: CITY_VALUE,
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
          <Text style={styles.title}>London only</Text>

          <View style={styles.form}>
            <TextInput
              style={[styles.input, styles.inputDisabled]}
              value={CITY_VALUE}
              editable={false}
              showSoftInputOnFocus={false}
            />
            <Text style={styles.helperText}>Wodates is currently available in London.</Text>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              testID="continuar-step3-button"
              style={styles.button}
              onPress={handleNext}
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
  inputDisabled: {
    backgroundColor: '#F0F0F0',
    color: '#2C3E50',
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
