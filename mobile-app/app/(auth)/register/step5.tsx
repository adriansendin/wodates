import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useRegistrationStore } from '../../../src/domain/stores/registrationStore';
import { ProgressBar } from '../../../src/components/ProgressBar';
import { LOOKING_FOR_OPTIONS, LookingForOption } from '../../../src/domain/entities/LookingFor';

const LOOKING_FOR_LABELS: Record<LookingForOption, string> = {
  male: 'Hombres',
  female: 'Mujeres',
  both: 'Ambos',
};

export default function Step5Screen() {
  const router = useRouter();
  const { data, updateData, nextStep, previousStep } = useRegistrationStore();
  
  const [lookingFor, setLookingFor] = useState<LookingForOption | ''>(data.lookingFor);

  const handleNext = () => {
    updateData({ lookingFor });
    nextStep();
    router.push('/(auth)/register/complete');
  };

  const handleBack = () => {
    previousStep();
    router.back();
  };

  const selectLookingFor = (value: LookingForOption | '') => {
    setLookingFor(value);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ProgressBar totalSteps={5} currentStep={5} />

        <View style={styles.content}>
          <Text style={styles.title}>¿A quién buscas?</Text>
          <Text style={styles.subtitle}>
            Esto nos ayudará a mostrarte personas compatibles
          </Text>

          <View style={styles.optionsContainer}>
            <TouchableOpacity
              style={[
                styles.option,
                lookingFor === '' && styles.optionSelected,
              ]}
              onPress={() => selectLookingFor('')}
            >
              <View style={styles.radio}>
                {lookingFor === '' && <View style={styles.radioInner} />}
              </View>
              <Text style={[
                styles.optionText,
                lookingFor === '' && styles.optionTextSelected,
              ]}>
                Sin preferencia
              </Text>
            </TouchableOpacity>

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

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.button} onPress={handleNext}>
              <Text style={styles.buttonText}>Continuar</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
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
});

