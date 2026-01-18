import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useRegistrationStore } from '../../../src/domain/stores/registrationStore';
import { ProgressBar } from '../../../src/components/ProgressBar';
import { GENDER_OPTIONS, GenderOption } from '../../../src/domain/entities/Gender';
import { LOOKING_FOR_OPTIONS, LookingForOption } from '../../../src/domain/entities/LookingFor';

const GENDER_LABELS: Record<GenderOption, string> = {
  male: 'Man',
  female: 'Woman',
  non_binary: 'Non-binary',
};

const LOOKING_FOR_LABELS: Record<LookingForOption, string> = {
  both: 'Everyone',
  male: 'Men',
  female: 'Women',
};

export default function Step4Screen() {
  const router = useRouter();
  const { data, updateData, nextStep, previousStep } = useRegistrationStore();
  
  // No usar valor por defecto para gender - debe ser seleccionado explícitamente
  const [gender, setGender] = useState<GenderOption | ''>(data.gender || '');
  const [lookingFor, setLookingFor] = useState<LookingForOption | ''>(data.lookingFor || '');

  const handleNext = () => {
    // Validación estricta: ambos campos deben ser valores válidos (no cadenas vacías, no undefined)
    if (gender === '' || !GENDER_OPTIONS.includes(gender as GenderOption)) {
      return;
    }
    if (lookingFor === '' || !LOOKING_FOR_OPTIONS.includes(lookingFor as LookingForOption)) {
      return;
    }
    
    // Solo guardar valores válidos (asegurar que son del tipo correcto)
    updateData({ 
      gender: gender as GenderOption, 
      lookingFor: lookingFor as LookingForOption 
    });
    nextStep();
    router.push('/(auth)/register/step2');
  };

  const handleBack = () => {
    previousStep();
    router.back();
  };

  const selectGender = (value: GenderOption | '') => {
    setGender(value);
  };

  const selectLookingFor = (value: LookingForOption | '') => {
    setLookingFor(value);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ProgressBar totalSteps={5} currentStep={2} />

        <View style={styles.content}>
          {/* Sección de Género */}
          <View style={styles.section}>
            <Text style={styles.title}>What is your gender?</Text>

            <View style={styles.optionsContainer}>
              {GENDER_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.option,
                    gender === option && styles.optionSelected,
                  ]}
                  onPress={() => selectGender(option)}
                >
                  <View style={styles.radio}>
                    {gender === option && <View style={styles.radioInner} />}
                  </View>
                  <Text style={[
                    styles.optionText,
                    gender === option && styles.optionTextSelected,
                  ]}>
                    {GENDER_LABELS[option]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Sección de A quién buscas */}
          <View style={styles.section}>
            <Text style={styles.title}>Who are you looking for?</Text>

            <View style={styles.optionsContainer}>
              {LOOKING_FOR_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.option,
                    lookingFor === option && styles.optionSelected,
                  ]}
                  onPress={() => selectLookingFor(option)}
                >
                  <View style={styles.radio}>
                    {lookingFor === option && <View style={styles.radioInner} />}
                  </View>
                  <Text style={[
                    styles.optionText,
                    lookingFor === option && styles.optionTextSelected,
                  ]}>
                    {LOOKING_FOR_LABELS[option]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Text style={styles.infoText}>
            You can change these preferences later.
          </Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              testID="continuar-step4-button" 
              style={[
                styles.button,
                (gender === '' || !GENDER_OPTIONS.includes(gender as GenderOption) ||
                 lookingFor === '' || !LOOKING_FOR_OPTIONS.includes(lookingFor as LookingForOption)) && styles.buttonDisabled
              ]} 
              onPress={handleNext}
              disabled={
                gender === '' || !GENDER_OPTIONS.includes(gender as GenderOption) ||
                lookingFor === '' || !LOOKING_FOR_OPTIONS.includes(lookingFor as LookingForOption)
              }
            >
              <Text style={[
                styles.buttonText,
                (gender === '' || !GENDER_OPTIONS.includes(gender as GenderOption) ||
                 lookingFor === '' || !LOOKING_FOR_OPTIONS.includes(lookingFor as LookingForOption)) && styles.buttonTextDisabled
              ]}>Continue</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Text style={styles.backButtonText}>Back</Text>
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
    marginBottom: 32,
    lineHeight: 24,
  },
  optionsContainer: {
    gap: 12,
    marginBottom: 32,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
  },
  optionSelected: {
    borderColor: '#F45C5C',
    backgroundColor: '#FFF5F5',
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#F45C5C',
  },
  optionText: {
    fontSize: 16,
    color: '#2C3E50',
  },
  optionTextSelected: {
    color: '#F45C5C',
    fontWeight: '600',
  },
  buttonContainer: {
    gap: 12,
    marginTop: 'auto',
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
  infoText: {
    fontSize: 14,
    color: '#95A5A6',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
    lineHeight: 20,
  },
  section: {
    marginBottom: 32,
  },
  buttonDisabled: {
    backgroundColor: '#BDC3C7',
  },
  buttonTextDisabled: {
    color: '#FFFFFF',
  },
});

