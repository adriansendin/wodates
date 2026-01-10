import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useRegistrationStore } from '../../../src/domain/stores/registrationStore';
import { ProgressBar } from '../../../src/components/ProgressBar';
import { ApiClient } from '../../../src/data/api/apiClient';
import { AuthApi } from '../../../src/data/api/authApi';
import { getApiUrl } from '../../../src/utils/apiConfig';
import {
  parseWaitlistValidationErrors,
  isValidationError,
  isServerOrNetworkError,
  getGenericValidationMessage,
  type WaitlistFieldErrors,
} from './waitlistHelpers';

type CityOption = 'london' | 'paris' | 'nyc' | 'other';

const CITY_OPTIONS = [
  { value: 'london' as CityOption, label: 'London (Central)', status: 'Available now' },
  { value: 'paris' as CityOption, label: 'Paris (Central)', status: 'Waitlist' },
  { value: 'nyc' as CityOption, label: 'NYC (Manhattan)', status: 'Waitlist' },
  { value: 'other' as CityOption, label: 'Other city', status: 'Waitlist' },
];

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export default function Step3Screen() {
  const router = useRouter();
  const { data, updateData, nextStep, previousStep } = useRegistrationStore();
  
  const apiClient = useMemo(() => new ApiClient(getApiUrl()), []);
  const authApi = useMemo(() => new AuthApi(apiClient), [apiClient]);
  
  const [selectedCity, setSelectedCity] = useState<CityOption>('london');
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistCity, setWaitlistCity] = useState('');
  const [isSubmittingWaitlist, setIsSubmittingWaitlist] = useState(false);
  const [waitlistSuccess, setWaitlistSuccess] = useState<{ city: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<WaitlistFieldErrors>({});
  const [genericError, setGenericError] = useState<string | null>(null);

  const isWaitlistCity = selectedCity === 'paris' || selectedCity === 'nyc' || selectedCity === 'other';
  const showContinueButton = selectedCity === 'london' && !waitlistSuccess;
  const showWaitlistForm = isWaitlistCity && !waitlistSuccess;

  const handleCitySelect = (city: CityOption) => {
    setSelectedCity(city);
    setWaitlistEmail('');
    setWaitlistCity('');
    setWaitlistSuccess(null);
    setFieldErrors({});
    setGenericError(null);
  };

  const handleNext = () => {
    if (selectedCity !== 'london') {
      return;
    }
    
    // Save selected city and set country
    updateData({ 
      location: 'London',
      country: 'UK'
    });
    nextStep();
    router.push('/(auth)/register/step4');
  };

  const handleBack = () => {
    previousStep();
    router.back();
  };

  const handleJoinWaitlist = async () => {
    // Validate email
    if (!waitlistEmail.trim() || !isValidEmail(waitlistEmail.trim())) {
      return;
    }

    // For "other city", validate city name
    if (selectedCity === 'other' && !waitlistCity.trim()) {
      return;
    }

    // Clear previous errors
    setFieldErrors({});
    setGenericError(null);
    setIsSubmittingWaitlist(true);

    try {
      const cityName = selectedCity === 'other' 
        ? waitlistCity.trim() 
        : selectedCity === 'paris' 
          ? 'Paris (Central)' 
          : 'NYC (Manhattan)';

      const result = await authApi.joinWaitlist(cityName, waitlistEmail.trim());

      if (result.success) {
        // Success (200 or 201)
        setWaitlistSuccess({ city: cityName });
        setFieldErrors({});
        setGenericError(null);
      } else {
        // Error from backend
        const error = result.error;

        if (isValidationError(error)) {
          // 400: Validation error - show field errors, NO success
          const parsedErrors = parseWaitlistValidationErrors(error);
          if (parsedErrors) {
            setFieldErrors(parsedErrors);
          } else {
            setGenericError(getGenericValidationMessage());
          }
          // Explicitly do NOT set success
        } else if (isServerOrNetworkError(error)) {
          // 500+ or network error - graceful degradation (show success)
          setWaitlistSuccess({ city: cityName });
          setFieldErrors({});
          setGenericError(null);
        } else {
          // Other errors - graceful degradation
          setWaitlistSuccess({ city: cityName });
          setFieldErrors({});
          setGenericError(null);
        }
      }
    } catch (error) {
      // Unexpected error - graceful degradation (show success)
      const cityName = selectedCity === 'other' 
        ? waitlistCity.trim() 
        : selectedCity === 'paris' 
          ? 'Paris (Central)' 
          : 'NYC (Manhattan)';
      setWaitlistSuccess({ city: cityName });
      setFieldErrors({});
      setGenericError(null);
    } finally {
      setIsSubmittingWaitlist(false);
    }
  };

  const handleDone = () => {
    // Navigate back to home or close registration flow
    router.replace('/(auth)/register');
  };

  const canSubmitWaitlist = () => {
    if (!waitlistEmail.trim() || !isValidEmail(waitlistEmail.trim())) {
      return false;
    }
    if (selectedCity === 'other' && !waitlistCity.trim()) {
      return false;
    }
    return true;
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
            {CITY_OPTIONS.map((option) => (
              <View key={option.value}>
                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    selectedCity === option.value && styles.optionButtonSelected
                  ]}
                  onPress={() => handleCitySelect(option.value)}
                >
                  <View style={styles.optionContent}>
                    <Text style={[
                      styles.optionText,
                      selectedCity === option.value && styles.optionTextSelected
                    ]}>
                      {option.label}
                    </Text>
                    <Text style={[
                      styles.optionStatus,
                      selectedCity === option.value && styles.optionStatusSelected
                    ]}>
                      {option.status === 'Available now' ? '· Available now' : '· Waitlist'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Waitlist form inline */}
                {showWaitlistForm && selectedCity === option.value && (
                  <View style={styles.waitlistForm}>
                    {selectedCity === 'other' && (
                      <View>
                        <TextInput
                          style={[
                            styles.input,
                            fieldErrors.city && styles.inputError
                          ]}
                          placeholder="City"
                          value={waitlistCity}
                          onChangeText={(text) => {
                            setWaitlistCity(text);
                            // Clear error when user starts typing
                            if (fieldErrors.city) {
                              setFieldErrors(prev => ({ ...prev, city: undefined }));
                            }
                          }}
                          autoCapitalize="words"
                          returnKeyType="next"
                        />
                        {fieldErrors.city && (
                          <Text style={styles.errorText}>{fieldErrors.city}</Text>
                        )}
                      </View>
                    )}
                    <View>
                      <TextInput
                        style={[
                          styles.input,
                          fieldErrors.email && styles.inputError
                        ]}
                        placeholder="Email"
                        value={waitlistEmail}
                        onChangeText={(text) => {
                          setWaitlistEmail(text);
                          // Clear error when user starts typing
                          if (fieldErrors.email) {
                            setFieldErrors(prev => ({ ...prev, email: undefined }));
                          }
                        }}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        returnKeyType="done"
                        onSubmitEditing={handleJoinWaitlist}
                      />
                      {fieldErrors.email && (
                        <Text style={styles.errorText}>{fieldErrors.email}</Text>
                      )}
                    </View>
                    {genericError && (
                      <Text style={styles.genericErrorText}>{genericError}</Text>
                    )}
                    <TouchableOpacity
                      style={[
                        styles.waitlistButton,
                        (!canSubmitWaitlist() || isSubmittingWaitlist) && styles.waitlistButtonDisabled
                      ]}
                      onPress={handleJoinWaitlist}
                      disabled={!canSubmitWaitlist() || isSubmittingWaitlist}
                    >
                      {isSubmittingWaitlist ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.waitlistButtonText}>Join waitlist</Text>
                      )}
                    </TouchableOpacity>
                    <Text style={styles.consentText}>
                      We'll email you when it's available. No spam.
                    </Text>
                  </View>
                )}

                {/* Success message inline */}
                {waitlistSuccess && selectedCity === option.value && (
                  <View style={styles.successContainer}>
                    <Text style={styles.successText}>
                      ✅ You're on the waitlist{selectedCity === 'other' ? '.' : ` for ${waitlistSuccess.city}.`}
                    </Text>
                    <TouchableOpacity
                      style={styles.doneButton}
                      onPress={handleDone}
                    >
                      <Text style={styles.doneButtonText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </View>

          {showContinueButton && (
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
          )}
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
  optionButton: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
  },
  optionButtonSelected: {
    borderColor: '#F45C5C',
    backgroundColor: '#FEF5F5',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
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
  optionStatus: {
    fontSize: 16,
    color: '#7F8C8D',
    fontWeight: '400',
  },
  optionStatusSelected: {
    color: '#F45C5C',
  },
  waitlistForm: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginTop: -12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
  },
  inputError: {
    borderColor: '#E74C3C',
  },
  errorText: {
    fontSize: 12,
    color: '#E74C3C',
    marginTop: 4,
    marginLeft: 4,
  },
  genericErrorText: {
    fontSize: 12,
    color: '#E74C3C',
    textAlign: 'center',
    marginTop: -4,
    marginBottom: 4,
  },
  waitlistButton: {
    backgroundColor: '#F45C5C',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  waitlistButtonDisabled: {
    backgroundColor: '#BDC3C7',
    opacity: 0.6,
  },
  waitlistButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  consentText: {
    fontSize: 12,
    color: '#7F8C8D',
    textAlign: 'center',
    lineHeight: 16,
  },
  successContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginTop: -12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    gap: 12,
  },
  successText: {
    fontSize: 16,
    color: '#2C3E50',
    textAlign: 'center',
  },
  doneButton: {
    backgroundColor: '#F45C5C',
    borderRadius: 8,
    padding: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
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
