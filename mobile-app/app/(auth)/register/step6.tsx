import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useRegistrationStore } from '../../../src/domain/stores/registrationStore';
import { ProgressBar } from '../../../src/components/ProgressBar';

export default function Step6Screen() {
  const router = useRouter();
  const { data, updateData, nextStep, previousStep } = useRegistrationStore();
  
  const [smoking, setSmoking] = useState<'no' | 'occasionally' | 'regularly' | null>(data.smoking);
  const [caresAboutPartnerSmoking, setCaresAboutPartnerSmoking] = useState<'yes' | 'no' | null>(data.caresAboutPartnerSmoking);

  const handleNext = () => {
    // Validación: debe responder sobre sus hábitos
    if (smoking === null) {
      return;
    }

    // Validación: debe responder si le importan los hábitos de la otra persona
    if (caresAboutPartnerSmoking === null) {
      return;
    }

    updateData({ 
      smoking, 
      caresAboutPartnerSmoking
    });
    nextStep();
    router.push('/(auth)/register/step1');
  };

  const handleBack = () => {
    previousStep();
    router.back();
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ProgressBar totalSteps={7} currentStep={5} />

        <View style={styles.content}>
          <Text style={styles.introText}>
            Algunas costumbres son importantes en una relación.
          </Text>

          {/* Sección: Sobre ti */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sobre ti</Text>

            <View style={styles.questionContainer}>
              <Text style={styles.questionText}>¿Fumas?</Text>
              <View style={styles.optionsContainer}>
                <TouchableOpacity
                  style={[
                    styles.option,
                    smoking === 'no' && styles.optionSelected,
                  ]}
                  onPress={() => setSmoking('no')}
                >
                  <View style={styles.radio}>
                    {smoking === 'no' && <View style={styles.radioInner} />}
                  </View>
                  <Text style={[
                    styles.optionText,
                    smoking === 'no' && styles.optionTextSelected,
                  ]}>
                    No
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.option,
                    smoking === 'occasionally' && styles.optionSelected,
                  ]}
                  onPress={() => setSmoking('occasionally')}
                >
                  <View style={styles.radio}>
                    {smoking === 'occasionally' && <View style={styles.radioInner} />}
                  </View>
                  <Text style={[
                    styles.optionText,
                    smoking === 'occasionally' && styles.optionTextSelected,
                  ]}>
                    Solo ocasionalmente
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.option,
                    smoking === 'regularly' && styles.optionSelected,
                  ]}
                  onPress={() => setSmoking('regularly')}
                >
                  <View style={styles.radio}>
                    {smoking === 'regularly' && <View style={styles.radioInner} />}
                  </View>
                  <Text style={[
                    styles.optionText,
                    smoking === 'regularly' && styles.optionTextSelected,
                  ]}>
                    Fumo habitualmente
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Sección: Sobre la persona que buscas */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sobre la persona que buscas</Text>

            <View style={styles.questionContainer}>
              <Text style={styles.questionText}>¿Te importa si la otra persona fuma?</Text>
              <View style={styles.optionsContainer}>
                <TouchableOpacity
                  style={[
                    styles.option,
                    caresAboutPartnerSmoking === 'yes' && styles.optionSelected,
                  ]}
                  onPress={() => setCaresAboutPartnerSmoking('yes')}
                >
                  <View style={styles.radio}>
                    {caresAboutPartnerSmoking === 'yes' && <View style={styles.radioInner} />}
                  </View>
                  <Text style={[
                    styles.optionText,
                    caresAboutPartnerSmoking === 'yes' && styles.optionTextSelected,
                  ]}>
                    Sí, no quiero que fume
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.option,
                    caresAboutPartnerSmoking === 'no' && styles.optionSelected,
                  ]}
                  onPress={() => setCaresAboutPartnerSmoking('no')}
                >
                  <View style={styles.radio}>
                    {caresAboutPartnerSmoking === 'no' && <View style={styles.radioInner} />}
                  </View>
                  <Text style={[
                    styles.optionText,
                    caresAboutPartnerSmoking === 'no' && styles.optionTextSelected,
                  ]}>
                    Me da igual
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <Text style={styles.infoText}>
            Podrás cambiar estas preferencias más adelante.
          </Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              testID="continuar-step6-button"
              style={[
                styles.button,
                (smoking === null || caresAboutPartnerSmoking === null) && styles.buttonDisabled
              ]} 
              onPress={handleNext}
              disabled={
                smoking === null || caresAboutPartnerSmoking === null
              }
            >
              <Text style={[
                styles.buttonText,
                (smoking === null || caresAboutPartnerSmoking === null) && styles.buttonTextDisabled
              ]}>Continuar</Text>
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
  introText: {
    fontSize: 16,
    color: '#7F8C8D',
    textAlign: 'center',
    marginBottom: 24,
    marginTop: 8,
    lineHeight: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 16,
    marginTop: 8,
  },
  questionContainer: {
    marginBottom: 24,
  },
  questionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 12,
  },
  optionsContainer: {
    gap: 12,
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
  infoText: {
    fontSize: 14,
    color: '#95A5A6',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
    lineHeight: 20,
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

