import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useRegistrationStore } from '../../../src/domain/stores/registrationStore';
import { ProgressBar } from '../../../src/components/ProgressBar';

const CITY_OPTIONS = [
  { value: 'Barcelona', label: 'Barcelona' },
  { value: 'Madrid', label: 'Madrid' },
];

export default function Step3Screen() {
  const router = useRouter();
  const { data, updateData, nextStep, previousStep } = useRegistrationStore();
  
  // Inicializar con valor por defecto si no hay uno guardado, pero validar antes de avanzar
  const [selectedCity, setSelectedCity] = useState<string>(data.location || 'Barcelona');

  const handleNext = () => {
    // Validar que se haya seleccionado una ciudad
    if (!selectedCity || selectedCity.trim() === '') {
      return;
    }
    
    // Save selected city and set country to Spain automatically
    updateData({ 
      location: selectedCity.trim(),
      country: 'Spain' // This will be used in the backend
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
        <ProgressBar totalSteps={7} currentStep={1} />

        <View style={styles.content}>
          <Text style={styles.title}>¿Dónde vives?</Text>

          <View style={styles.form}>
            {CITY_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionButton,
                  selectedCity === option.value && styles.optionButtonSelected
                ]}
                onPress={() => setSelectedCity(option.value)}
              >
                <Text style={[
                  styles.optionText,
                  selectedCity === option.value && styles.optionTextSelected
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              testID="continuar-step3-button" 
              style={[
                styles.button,
                (!selectedCity || selectedCity.trim() === '') && styles.buttonDisabled
              ]} 
              onPress={handleNext}
              disabled={!selectedCity || selectedCity.trim() === ''}
            >
              <Text style={[
                styles.buttonText,
                (!selectedCity || selectedCity.trim() === '') && styles.buttonTextDisabled
              ]}>Continuar</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Text style={styles.backButtonText}>Volver</Text>
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
  subtitle: {
    fontSize: 16,
    color: '#7F8C8D',
    textAlign: 'center',
    marginBottom: 48,
    lineHeight: 24,
  },
  form: {
    marginBottom: 32,
  },
  optionButton: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
    alignItems: 'center',
  },
  optionButtonSelected: {
    borderColor: '#F45C5C',
    backgroundColor: '#FEF5F5',
  },
  optionText: {
    fontSize: 16,
    color: '#2C3E50',
    fontWeight: '500',
  },
  optionTextSelected: {
    color: '#F45C5C',
    fontWeight: 'bold',
  },
  hint: {
    fontSize: 14,
    color: '#95A5A6',
    textAlign: 'center',
    lineHeight: 20,
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
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonTextDisabled: {
    color: '#FFFFFF',
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

