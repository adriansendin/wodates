import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useRegistrationStore } from '../../../src/domain/stores/registrationStore';
import { ProgressBar } from '../../../src/components/ProgressBar';

export default function Step5Screen() {
  const router = useRouter();
  const { t } = useTranslation('common');
  const { data, updateData, nextStep, previousStep } = useRegistrationStore();
  
  const [hasChildren, setHasChildren] = useState<boolean | null>(data.hasChildren);
  const [wantsChildren, setWantsChildren] = useState<'yes' | 'no' | 'not_sure' | null>(data.wantsChildren);
  const [caresAboutPartnerChildren, setCaresAboutPartnerChildren] = useState<'yes' | 'no' | null>(data.caresAboutPartnerChildren);

  const handleNext = () => {
    // Validation: must answer if they have children and if they want children
    if (hasChildren === null || wantsChildren === null) {
      return;
    }

    // Validation: must answer if they care about the other person having children
    if (caresAboutPartnerChildren === null) {
      return;
    }

    updateData({ 
      hasChildren, 
      wantsChildren, 
      caresAboutPartnerChildren
    });
    nextStep();
    router.push('/(auth)/register/step6');
  };

  const handleBack = () => {
    previousStep();
    router.back();
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ProgressBar totalSteps={5} currentStep={3} />

        <View style={styles.content}>
          {/* Section: About you */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('register.aboutYou')}</Text>

            <View style={styles.questionContainer}>
              <Text style={styles.questionText}>{t('register.doYouHaveChildren')}</Text>
              <View style={styles.optionsContainer}>
                <TouchableOpacity
                  style={[
                    styles.option,
                    hasChildren === false && styles.optionSelected,
                  ]}
                  onPress={() => setHasChildren(false)}
                >
                  <View style={styles.radio}>
                    {hasChildren === false && <View style={styles.radioInner} />}
                  </View>
                  <Text style={[
                    styles.optionText,
                    hasChildren === false && styles.optionTextSelected,
                  ]}>
                    {t('register.no')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.option,
                    hasChildren === true && styles.optionSelected,
                  ]}
                  onPress={() => setHasChildren(true)}
                >
                  <View style={styles.radio}>
                    {hasChildren === true && <View style={styles.radioInner} />}
                  </View>
                  <Text style={[
                    styles.optionText,
                    hasChildren === true && styles.optionTextSelected,
                  ]}>
                    {t('register.yes')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.questionContainer}>
              <Text style={styles.questionText}>{t('register.wantChildren')}</Text>
              <View style={styles.optionsContainer}>
                <TouchableOpacity
                  style={[
                    styles.option,
                    wantsChildren === 'yes' && styles.optionSelected,
                  ]}
                  onPress={() => setWantsChildren('yes')}
                >
                  <View style={styles.radio}>
                    {wantsChildren === 'yes' && <View style={styles.radioInner} />}
                  </View>
                  <Text style={[
                    styles.optionText,
                    wantsChildren === 'yes' && styles.optionTextSelected,
                  ]}>
                    {t('register.yes')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.option,
                    wantsChildren === 'no' && styles.optionSelected,
                  ]}
                  onPress={() => setWantsChildren('no')}
                >
                  <View style={styles.radio}>
                    {wantsChildren === 'no' && <View style={styles.radioInner} />}
                  </View>
                  <Text style={[
                    styles.optionText,
                    wantsChildren === 'no' && styles.optionTextSelected,
                  ]}>
                    {t('register.no')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.option,
                    wantsChildren === 'not_sure' && styles.optionSelected,
                  ]}
                  onPress={() => setWantsChildren('not_sure')}
                >
                  <View style={styles.radio}>
                    {wantsChildren === 'not_sure' && <View style={styles.radioInner} />}
                  </View>
                  <Text style={[
                    styles.optionText,
                    wantsChildren === 'not_sure' && styles.optionTextSelected,
                  ]}>
                    {t('register.notSure')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('register.aboutPartner')}</Text>

            <View style={styles.questionContainer}>
              <Text style={styles.questionText}>{t('register.carePartnerChildren')}</Text>
              <View style={styles.optionsContainer}>
                <TouchableOpacity
                  style={[
                    styles.option,
                    caresAboutPartnerChildren === 'yes' && styles.optionSelected,
                  ]}
                  onPress={() => setCaresAboutPartnerChildren('yes')}
                >
                  <View style={styles.radio}>
                    {caresAboutPartnerChildren === 'yes' && <View style={styles.radioInner} />}
                  </View>
                  <Text style={[
                    styles.optionText,
                    caresAboutPartnerChildren === 'yes' && styles.optionTextSelected,
                  ]}>
                    {t('register.partnerNoChildren')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.option,
                    caresAboutPartnerChildren === 'no' && styles.optionSelected,
                  ]}
                  onPress={() => setCaresAboutPartnerChildren('no')}
                >
                  <View style={styles.radio}>
                    {caresAboutPartnerChildren === 'no' && <View style={styles.radioInner} />}
                  </View>
                  <Text style={[
                    styles.optionText,
                    caresAboutPartnerChildren === 'no' && styles.optionTextSelected,
                  ]}>
                    {t('register.partnerChildrenDontCare')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <Text style={styles.infoText}>{t('register.preferencesLater')}</Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              testID="continuar-step5-button"
              style={[
                styles.button,
                (hasChildren === null || wantsChildren === null || 
                 caresAboutPartnerChildren === null) && styles.buttonDisabled
              ]} 
              onPress={handleNext}
              disabled={
                hasChildren === null || wantsChildren === null || 
                caresAboutPartnerChildren === null
              }
            >
              <Text style={[
                styles.buttonText,
                (hasChildren === null || wantsChildren === null || 
                 caresAboutPartnerChildren === null) && styles.buttonTextDisabled
              ]}>{t('common.continue')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Text style={styles.backButtonText}>{t('common.back')}</Text>
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

