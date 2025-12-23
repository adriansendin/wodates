import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useRegistrationStore } from '../../../src/domain/stores/registrationStore';
import { ProgressBar } from '../../../src/components/ProgressBar';
import { BirthDatePicker } from '../../../src/components/BirthDatePicker';
import { AgeRangePicker } from '../../../src/components/AgeRangePicker';

export default function Step2Screen() {
  const router = useRouter();
  const { data, updateData, nextStep, previousStep } = useRegistrationStore();
  
  const [date, setDate] = useState<Date>(data.birthDate || new Date(2000, 0, 1));
  const [error, setError] = useState<string | null>(null);
  const [minAge, setMinAge] = useState(data.minAge);
  const [maxAge, setMaxAge] = useState(data.maxAge);

  const calculateAge = (birthDate: Date): number => {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  };

  const handleDateChange = (newDate: Date) => {
    setDate(newDate);
    setError(null);
  };

  const handleError = (errorMessage: string | null) => {
    setError(errorMessage);
  };

  const handleAgeRangeChange = (min: number, max: number) => {
    setMinAge(min);
    setMaxAge(max);
  };

  const handleNext = () => {
    const age = calculateAge(date);
    
    if (age < 18 || age > 99) {
      setError(age < 18 
        ? 'Debes tener al menos 18 años para registrarte'
        : 'La edad máxima permitida es 99 años'
      );
      return;
    }

    updateData({ birthDate: date, minAge, maxAge });
    nextStep();
    router.push('/(auth)/register/step1');
  };

  const handleBack = () => {
    previousStep();
    router.back();
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ProgressBar totalSteps={5} currentStep={3} />

        <View style={styles.content}>
          {/* Sección de Fecha de Nacimiento */}
          <View style={styles.section}>
            <Text style={styles.title}>¿Cuándo naciste?</Text>
            <Text style={styles.subtitle}>Tu edad será visible en tu perfil</Text>

            <View style={styles.dateContainer}>
              <BirthDatePicker
                value={date}
                onChange={handleDateChange}
                onError={handleError}
              />
            </View>

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </View>

          {/* Sección de Rango de Edad */}
          <View style={styles.section}>
            <Text style={styles.title}>¿Qué rango de edad buscas?</Text>

            <View style={styles.pickerContainer}>
              <AgeRangePicker
                minAge={minAge}
                maxAge={maxAge}
                onRangeChange={handleAgeRangeChange}
              />
            </View>

            <Text style={styles.infoText}>
              Podrás cambiar esta preferencia más adelante.
            </Text>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              testID="continuar-step2-button"
              style={[styles.button, !!error && styles.buttonDisabled]} 
              onPress={handleNext}
              disabled={!!error}
            >
              <Text style={styles.buttonText}>Continuar</Text>
            </TouchableOpacity>

            <TouchableOpacity testID="volver-step2-button" style={styles.backButton} onPress={handleBack}>
              <Text style={styles.backButtonText}>Volver</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
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
    paddingTop: 0,
  },
  section: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2C3E50',
    textAlign: 'center',
    marginBottom: 8,
    marginTop: 24,
  },
  subtitle: {
    fontSize: 16,
    color: '#7F8C8D',
    textAlign: 'center',
    marginBottom: 24,
  },
  dateContainer: {
    marginBottom: 24,
  },
  pickerContainer: {
    marginBottom: 24,
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#C62828',
    textAlign: 'center',
    fontWeight: '500',
  },
  infoText: {
    fontSize: 14,
    color: '#95A5A6',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 20,
  },
  buttonContainer: {
    gap: 12,
    marginTop: 'auto',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#F45C5C',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#E0E0E0',
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
