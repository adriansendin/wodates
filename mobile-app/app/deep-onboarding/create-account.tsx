import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useNavigation, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { FeedbackBanner } from '../../src/components/FeedbackBanner';
import { BirthDatePicker } from '../../src/components/BirthDatePicker';
import { AgeRangePicker } from '../../src/components/AgeRangePicker';
import { ApiClient } from '../../src/data/api/apiClient';
import { AuthApi } from '../../src/data/api/authApi';
import { ProfileApi } from '../../src/data/api/profileApi';
import { DeepOnboardingApi } from '../../src/data/api/deepOnboardingApi';
import { AuthTokens } from '../../src/domain/entities/Auth';
import { User, Gender } from '../../src/domain/entities/User';
import {
  GENDER_OPTIONS,
  GenderOption,
} from '../../src/domain/entities/Gender';
import {
  LOOKING_FOR_OPTIONS,
  LookingForOption,
} from '../../src/domain/entities/LookingFor';
import { DomainError } from '../../src/domain/errors/DomainError';
import { useAuthStore } from '../../src/domain/stores/authStore';
import { useDeepOnboardingStore } from '../../src/domain/stores/deepOnboardingStore';
import { getApiUrl } from '../../src/utils/apiConfig';
import { trackSignupComplete, trackLoginSuccess } from '../../src/analytics/ga4';
import { SocialInterestCodesFormBlock } from '../../src/components/SocialInterestCodesFormBlock';
import {
  isValidSocialInterestCodeInput,
  normalizeSocialInterestCodes,
} from '../../src/utils/socialInterestCodes';

const normalizeUser = (rawUser: Record<string, unknown>): User => {
  const now = new Date().toISOString();

  if (typeof rawUser?.id !== 'string' || typeof rawUser?.email !== 'string') {
    throw new Error('User payload is missing required fields.');
  }

  const rawGender = rawUser.gender;
  if (
    !rawGender ||
    typeof rawGender !== 'string' ||
    !GENDER_OPTIONS.includes(rawGender as GenderOption)
  ) {
    throw new Error('User payload is missing valid gender field.');
  }
  const gender = rawGender as Gender;

  return {
    id: rawUser.id,
    email: rawUser.email,
    name: typeof rawUser.name === 'string' ? rawUser.name : '',
    birthDate:
      typeof rawUser.birthDate === 'string' ? rawUser.birthDate : now,
    gender,
    bio: typeof rawUser.bio === 'string' ? rawUser.bio : undefined,
    photoUrl:
      typeof rawUser.photoUrl === 'string' ? rawUser.photoUrl : undefined,
    location: rawUser.location as User['location'],
    createdAt:
      typeof rawUser.createdAt === 'string' ? rawUser.createdAt : now,
    updatedAt:
      typeof rawUser.updatedAt === 'string' ? rawUser.updatedAt : now,
  };
};

function calculateAge(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }
  return age;
}

export default function DeepOnboardingCreateAccountScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { t, i18n } = useTranslation('common');
  const { user, login } = useAuthStore();

  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [birthDate, setBirthDate] = useState(new Date(1996, 0, 1));
  const [birthError, setBirthError] = useState<string | null>(null);
  const [gender, setGender] = useState<GenderOption | ''>('');
  const [lookingFor, setLookingFor] = useState<LookingForOption | ''>('');
  const [minAge, setMinAge] = useState(29);
  const [maxAge, setMaxAge] = useState(40);

  const [socialTriple, setSocialTriple] = useState<[string, string, string]>([
    '',
    '',
    '',
  ]);
  const [socialTripleError, setSocialTripleError] = useState<string | null>(
    null
  );

  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const apiClient = useMemo(() => new ApiClient(getApiUrl()), []);
  const authApi = useMemo(() => new AuthApi(apiClient), [apiClient]);
  const profileApi = useMemo(() => new ProfileApi(apiClient), [apiClient]);
  const deepApi = useMemo(() => new DeepOnboardingApi(apiClient), [apiClient]);

  useEffect(() => {
    if (user) {
      router.replace('/(app)/questionnaire');
    }
  }, [user, router]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t('deepOnboarding.createAccountScreenTitle'),
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => router.replace('/')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
        >
          <Text style={styles.headerBack}>{t('common.back')}</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, router, t]);

  const GENDER_LABELS: Record<GenderOption, string> = useMemo(
    () => ({
      male: t('profile.genderMale'),
      female: t('profile.genderFemale'),
      non_binary: t('profile.genderNonBinary'),
    }),
    [t]
  );

  const LOOKING_FOR_LABELS: Record<LookingForOption, string> = useMemo(
    () => ({
      both: t('profile.lookingForBoth'),
      male: t('profile.lookingForMen'),
      female: t('profile.lookingForWomen'),
    }),
    [t]
  );

  const validateEmail = (value: string): boolean =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleAgeRangeChange = (min: number, max: number) => {
    setMinAge(min);
    setMaxAge(max);
  };

  const handleCreateAccount = async () => {
    setFeedback(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFeedback({ type: 'error', message: t('deepOnboarding.nameRequired') });
      return;
    }

    if (!email.trim()) {
      setFeedback({ type: 'error', message: t('register.emailRequired') });
      return;
    }
    if (!validateEmail(email.trim())) {
      setFeedback({ type: 'error', message: t('register.emailInvalid') });
      return;
    }

    if (!password || password.length < 6) {
      setFeedback({ type: 'error', message: t('register.passwordMinLength') });
      return;
    }

    const age = calculateAge(birthDate);
    if (age < 29 || age > 65) {
      setFeedback({
        type: 'error',
        message:
          age < 29
            ? t('register.minAgeError', { min: 29 })
            : t('register.maxAgeError', { max: 65 }),
      });
      return;
    }

    if (!gender || !GENDER_OPTIONS.includes(gender as GenderOption)) {
      setFeedback({ type: 'error', message: t('register.selectGender') });
      return;
    }
    if (
      !lookingFor ||
      !LOOKING_FOR_OPTIONS.includes(lookingFor as LookingForOption)
    ) {
      setFeedback({ type: 'error', message: t('register.selectLookingFor') });
      return;
    }

    if (typeof minAge !== 'number' || minAge < 29 || minAge > 65) {
      setFeedback({ type: 'error', message: t('register.minAgeValid') });
      return;
    }
    if (typeof maxAge !== 'number' || maxAge < 29 || maxAge > 65) {
      setFeedback({ type: 'error', message: t('register.maxAgeValid') });
      return;
    }
    if (minAge > maxAge) {
      setFeedback({
        type: 'error',
        message: t('register.minAgeGreaterThanMax'),
      });
      return;
    }

    setSocialTripleError(null);
    if (!socialTriple.every(isValidSocialInterestCodeInput)) {
      setSocialTripleError(t('register.socialInterestInvalidCode'));
      return;
    }

    setIsCheckingEmail(true);
    try {
      const check = await authApi.checkEmail(email.trim());
      if (check.success && check.data.exists) {
        setFeedback({
          type: 'error',
          message: t('register.emailAlreadyRegistered'),
        });
        setIsCheckingEmail(false);
        return;
      }
    } catch {
      // Backend will validate on register
    } finally {
      setIsCheckingEmail(false);
    }

    const locale = i18n.language?.toLowerCase().startsWith('es') ? 'es' : 'en';
    const registerPayload = {
      email: email.trim(),
      password,
      name: trimmedName.slice(0, 100),
      birthDate: birthDate.toISOString(),
      gender: gender as Gender,
      location: city.trim(),
      country: '',
      lookingFor: lookingFor as LookingForOption,
      locale,
    };

    setIsSubmitting(true);
    try {
      const result = await authApi.register(registerPayload);

      if (!result.success) {
        setFeedback({
          type: 'error',
          message: result.error.message ?? t('register.createAccountError'),
        });
        setIsSubmitting(false);
        return;
      }

      const { user: rawUser, token } = result.data;
      const normalizedUser = normalizeUser(rawUser as Record<string, unknown>);
      const tokens: AuthTokens = {
        accessToken: token,
        refreshToken: token,
        expiresIn: 7 * 24 * 60 * 60,
      };

      login(normalizedUser, tokens);
      trackSignupComplete('email');
      trackLoginSuccess('email');

      // Solo rango de edad preferido aquí: nombre, nacimiento, género y busco ya van en el alta.
      const profileUpdate = await profileApi.updateProfile(
        { min_age: minAge, max_age: maxAge },
        token
      );

      if (!profileUpdate.success) {
        setFeedback({
          type: 'error',
          message: t('register.savePreferencesError'),
        });
        setIsSubmitting(false);
        return;
      }

      const socialCodes = normalizeSocialInterestCodes([...socialTriple]);
      if (socialCodes.length > 0) {
        const interestRes = await profileApi.replaceSocialProfileInterests(
          socialCodes,
          token
        );
        if (!interestRes.success) {
          setFeedback({
            type: 'error',
            message: t('register.saveInterestCodesError'),
          });
          setIsSubmitting(false);
          return;
        }
      }

      const sessionId = useDeepOnboardingStore.getState().clientSessionId;
      if (sessionId) {
        const linkResult = await deepApi.linkSession(sessionId, token);
        if (!linkResult.success) {
          console.warn(
            '[DeepOnboardingCreateAccount] link-session failed:',
            linkResult.error
          );
        }
      }

      router.replace('/(app)/questionnaire');
    } catch (e) {
      console.error('[DeepOnboardingCreateAccount]', e);
      setFeedback({ type: 'error', message: t('register.networkError') });
    } finally {
      setIsSubmitting(false);
    }
  };

  const disabledMain =
    isSubmitting ||
    isCheckingEmail ||
    !!birthError ||
    !gender ||
    !lookingFor ||
    !GENDER_OPTIONS.includes(gender as GenderOption) ||
    !LOOKING_FOR_OPTIONS.includes(lookingFor as LookingForOption);

  return (
    <>
      <Stack.Screen options={{ headerShown: true }} />
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.screenSubtitle}>
              {t('deepOnboarding.createAccountSubtitle')}
            </Text>

            {feedback ? (
              <FeedbackBanner
                type={feedback.type}
                message={feedback.message}
                onClose={() => setFeedback(null)}
              />
            ) : null}

            <View style={styles.field}>
              <Text style={styles.label}>{t('profile.labelName')}</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder={t('profile.namePlaceholder')}
                placeholderTextColor="#999"
                autoCapitalize="words"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t('profile.labelCity')}</Text>
              <TextInput
                style={styles.input}
                value={city}
                onChangeText={setCity}
                placeholder={t('profile.cityPlaceholder')}
                placeholderTextColor="#999"
                autoCapitalize="words"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t('register.labelEmail')}</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder={t('auth.emailExample')}
                placeholderTextColor="#999"
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t('register.labelPassword')}</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder={t('auth.passwordPlaceholder')}
                placeholderTextColor="#999"
                secureTextEntry
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t('profile.labelBirthDate')}
              </Text>
              <Text style={styles.sectionHint}>{t('register.ageVisible')}</Text>
              <BirthDatePicker
                value={birthDate}
                onChange={(d) => {
                  setBirthDate(d);
                  setBirthError(null);
                }}
                onError={(err) => setBirthError(err)}
              />
              {birthError ? (
                <Text style={styles.inlineError}>{birthError}</Text>
              ) : null}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t('profile.selectGenderTitle')}
              </Text>
              <View style={styles.optionsCol}>
                {GENDER_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.optionRow,
                      gender === option && styles.optionRowSelected,
                    ]}
                    onPress={() => setGender(option)}
                  >
                    <View
                      style={[
                        styles.radioOuter,
                        gender === option && styles.radioOuterSelected,
                      ]}
                    >
                      {gender === option ? (
                        <View style={styles.radioInner} />
                      ) : null}
                    </View>
                    <Text style={styles.optionLabel}>
                      {GENDER_LABELS[option]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t('profile.selectLookingForTitle')}
              </Text>
              <View style={styles.optionsCol}>
                {LOOKING_FOR_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.optionRow,
                      lookingFor === option && styles.optionRowSelected,
                    ]}
                    onPress={() => setLookingFor(option)}
                  >
                    <View
                      style={[
                        styles.radioOuter,
                        lookingFor === option && styles.radioOuterSelected,
                      ]}
                    >
                      {lookingFor === option ? (
                        <View style={styles.radioInner} />
                      ) : null}
                    </View>
                    <Text style={styles.optionLabel}>
                      {LOOKING_FOR_LABELS[option]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t('profile.labelPreferredAgeRange')}
              </Text>
              <AgeRangePicker
                minAge={minAge}
                maxAge={maxAge}
                onRangeChange={handleAgeRangeChange}
              />
              <Text style={styles.sectionHint}>{t('register.changeLater')}</Text>
            </View>

            <View style={styles.optionalSection}>
              <SocialInterestCodesFormBlock
                optionalHint={t('register.socialInterestOptional')}
                description={t('register.socialInterestDescription')}
                footnote={t('register.socialInterestFootnote')}
                values={socialTriple}
                onChange={(next) => {
                  setSocialTriple(next);
                  setSocialTripleError(null);
                }}
                fieldError={socialTripleError}
                inputPlaceholder={t('register.socialInterestPlaceholder')}
              />
            </View>

            <TouchableOpacity
              style={[styles.cta, disabledMain && styles.ctaDisabled]}
              onPress={() => void handleCreateAccount()}
              disabled={disabledMain}
              activeOpacity={0.85}
            >
              {isSubmitting || isCheckingEmail ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.ctaText}>
                  {t('deepOnboarding.buttonCreateAccount')}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  headerBack: {
    color: '#F45C5C',
    fontSize: 17,
    fontWeight: '600',
    marginLeft: 8,
  },
  screenSubtitle: {
    fontSize: 15,
    color: '#555',
    lineHeight: 22,
    marginBottom: 16,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#1a1a1a',
  },
  section: {
    marginTop: 8,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 6,
  },
  sectionHint: {
    fontSize: 13,
    color: '#7F8C8D',
    marginBottom: 12,
  },
  inlineError: {
    color: '#c62828',
    marginTop: 8,
    fontSize: 14,
  },
  optionsCol: {
    gap: 10,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e8e8e8',
    backgroundColor: '#fff',
  },
  optionRowSelected: {
    borderColor: '#F45C5C',
    backgroundColor: '#FFF5F5',
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: { borderColor: '#F45C5C' },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#F45C5C',
  },
  optionLabel: {
    flex: 1,
    fontSize: 16,
    color: '#222',
  },
  optionalSection: {
    marginTop: 4,
    marginBottom: 8,
  },
  cta: {
    backgroundColor: '#F45C5C',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 24,
  },
  ctaDisabled: { opacity: 0.55 },
  ctaText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
});
