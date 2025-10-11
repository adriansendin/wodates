import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useRegistrationStore } from '../../../src/domain/stores/registrationStore';
import { ProgressBar } from '../../../src/components/ProgressBar';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function Step2Screen() {
  const router = useRouter();
  const { data, updateData, nextStep, previousStep } = useRegistrationStore();
  
  const [date, setDate] = useState<Date>(data.birthDate || new Date(2000, 0, 1));
  const [show, setShow] = useState(false);

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  const calculateAge = (birthDate: Date): number => {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  };

  const onChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShow(false);
    }
    
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const handleNext = () => {
    const age = calculateAge(date);
    
    if (age < 18) {
      Alert.alert('Error', 'Debes tener al menos 18 años para registrarte');
      return;
    }

    updateData({ birthDate: date });
    nextStep();
    router.push('/(auth)/register/step3');
  };

  const handleBack = () => {
    previousStep();
    router.back();
  };

  return (
    <View style={styles.container}>
      <ProgressBar totalSteps={5} currentStep={2} />

      <View style={styles.content}>
        <Text style={styles.title}>¿Cuándo naciste?</Text>
        <Text style={styles.subtitle}>Tu edad será visible en tu perfil</Text>

        <View style={styles.dateContainer}>
          <TouchableOpacity 
            style={styles.dateButton} 
            onPress={() => setShow(true)}
          >
            <Text style={styles.dateText}>{formatDate(date)}</Text>
          </TouchableOpacity>
          
          <Text style={styles.ageText}>
            {calculateAge(date)} años
          </Text>
        </View>

        {(show || Platform.OS === 'ios') && (
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onChange}
            maximumDate={new Date()}
            minimumDate={new Date(1940, 0, 1)}
            locale="es-ES"
            style={styles.picker}
          />
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.button} onPress={handleNext}>
            <Text style={styles.buttonText}>Continuar</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
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
  },
  dateContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  dateButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  dateText: {
    fontSize: 18,
    color: '#2C3E50',
    fontWeight: '600',
  },
  ageText: {
    fontSize: 16,
    color: '#F45C5C',
    fontWeight: '600',
  },
  picker: {
    width: '100%',
    marginBottom: 32,
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

