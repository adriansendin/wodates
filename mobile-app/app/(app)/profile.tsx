import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActionSheetIOS,
  Platform,
  Pressable,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useUserPhotos } from '../../src/features/profile/photos/useUserPhotos';
import { AgeRangePicker } from '../../src/components/AgeRangePicker';
import { useAuthStore } from '../../src/domain/stores/authStore';
import { ApiClient } from '../../src/data/api/apiClient';
import { ProfileApi } from '../../src/data/api/profileApi';
import {
  UpdateUserProfile,
  UserProfile,
  VerificationStatus,
} from '../../src/domain/entities/UserProfile';
import { GENDER_OPTIONS, GenderOption } from '../../src/domain/entities/Gender';
import {
  LOOKING_FOR_OPTIONS,
  LookingForOption,
} from '../../src/domain/entities/LookingFor';
import {
  pickImageFromGallery,
  takePictureWithCamera,
} from '../../src/data/api/imageService';
import { getSupabaseClient } from '../../src/data/api/supabaseClient';
import { getApiUrl } from '../../src/utils/apiConfig';

const API_URL = getApiUrl();
const AVATAR_PLACEHOLDER = require('../../assets/placeholder.png');

type LookingForFormValue = LookingForOption | '';
type GenderFormValue = GenderOption | '';

type FormState = {
  gender: GenderFormValue;
  looking_for: LookingForFormValue;
  min_age: number;
  max_age: number;
  bio: string;
  city: string;
  show_bio_in_feed: boolean;
  // Family plan
  has_children: boolean | null;
  wants_children: 'yes' | 'no' | 'not_sure' | null;
  cares_about_partner_children: 'yes' | 'no' | null;
  // Habits
  smoking: 'no' | 'occasionally' | 'regularly' | null;
  cares_about_partner_smoking: 'yes' | 'no' | null;
};

type Feedback = {
  type: 'success' | 'error' | 'info';
  message: string;
};

const LOOKING_FOR_LABELS: Record<LookingForOption, string> = {
  male: 'Hombres',
  female: 'Mujeres',
  both: 'Ambos',
};

const LOOKING_FOR_CHOICES: Array<{
  value: LookingForFormValue;
  label: string;
}> = LOOKING_FOR_OPTIONS.map((value) => ({
  value,
  label: LOOKING_FOR_LABELS[value],
}));

const getLookingForLabel = (value: LookingForFormValue) =>
  value ? LOOKING_FOR_LABELS[value] : 'Seleccionar';

const GENDER_LABELS: Record<GenderOption, string> = {
  male: 'Hombre',
  female: 'Mujer',
  non_binary: 'No binario',
};

const GENDER_CHOICES: Array<{ value: GenderFormValue; label: string }> =
  GENDER_OPTIONS.map((value) => ({
    value,
    label: GENDER_LABELS[value],
  }));

const getGenderLabel = (value: GenderFormValue) =>
  value ? GENDER_LABELS[value] : 'Seleccionar';

const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  pending: 'Verificar perfil',
  verifying: 'Verificación en curso',
  verified: 'Perfil verificado',
  rejected: 'Reintentar verificación',
};

// Family plan labels
const WANTS_CHILDREN_LABELS: Record<'yes' | 'no' | 'not_sure', string> = {
  yes: 'Sí',
  no: 'No',
  not_sure: 'No lo tengo claro',
};

const CARES_ABOUT_PARTNER_CHILDREN_LABELS: Record<'yes' | 'no', string> = {
  yes: 'Sí, no quiero que tenga hijos',
  no: 'Me da igual',
};


// Habits labels
const SMOKING_LABELS: Record<'no' | 'occasionally' | 'regularly', string> = {
  no: 'No',
  occasionally: 'Solo ocasionalmente',
  regularly: 'Fumo habitualmente',
};

const CARES_ABOUT_PARTNER_SMOKING_LABELS: Record<'yes' | 'no', string> = {
  yes: 'Sí, no quiero que fume',
  no: 'Me da igual',
};

const getWantsChildrenLabel = (value: 'yes' | 'no' | 'not_sure' | null) =>
  value ? WANTS_CHILDREN_LABELS[value] : 'Seleccionar';

const getCaresAboutPartnerChildrenLabel = (value: 'yes' | 'no' | null) =>
  value ? CARES_ABOUT_PARTNER_CHILDREN_LABELS[value] : 'Seleccionar';


const getSmokingLabel = (value: 'no' | 'occasionally' | 'regularly' | null) =>
  value ? SMOKING_LABELS[value] : 'Seleccionar';

const getCaresAboutPartnerSmokingLabel = (value: 'yes' | 'no' | null) =>
  value ? CARES_ABOUT_PARTNER_SMOKING_LABELS[value] : 'Seleccionar';

const emptyForm: FormState = {
  gender: 'male',
  looking_for: 'both',
  min_age: 18,
  max_age: 99,
  bio: '',
  city: '',
  show_bio_in_feed: true,
  // Family plan
  has_children: null,
  wants_children: null,
  cares_about_partner_children: null,
  // Habits
  smoking: null,
  cares_about_partner_smoking: null,
};

const mapProfileToForm = (nextProfile: UserProfile | null): FormState => ({
  gender: nextProfile?.gender ?? 'male',
  looking_for: nextProfile?.looking_for ?? 'both',
  min_age: nextProfile?.min_age ?? 18,
  max_age: nextProfile?.max_age ?? 99,
  bio: nextProfile?.bio ?? '',
  city: nextProfile?.city ?? '',
  show_bio_in_feed: nextProfile?.show_bio_in_feed ?? true,
  // Family plan
  has_children: nextProfile?.has_children ?? null,
  wants_children: nextProfile?.wants_children ?? null,
  cares_about_partner_children: nextProfile?.cares_about_partner_children ?? null,
  // Habits
  smoking: nextProfile?.smoking ?? null,
  cares_about_partner_smoking: nextProfile?.cares_about_partner_smoking ?? null,
});

const isValidDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const calculateAge = (birthDate: string): number => {
  if (!birthDate || !isValidDate(birthDate)) {
    return 0;
  }

  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
};

export default function ProfileScreen() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseClient(), []);
  const { tokens, user, logout } = useAuthStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [verificationStatus, setVerificationStatus] =
    useState<VerificationStatus>('pending');
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isLoading, setIsLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof FormState, string>>
  >({});
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [isGenderModalVisible, setIsGenderModalVisible] = useState(false);
  const [isLookingForModalVisible, setIsLookingForModalVisible] =
    useState(false);
  // Family plan modals
  const [isHasChildrenModalVisible, setIsHasChildrenModalVisible] = useState(false);
  const [isWantsChildrenModalVisible, setIsWantsChildrenModalVisible] = useState(false);
  const [isCaresAboutPartnerChildrenModalVisible, setIsCaresAboutPartnerChildrenModalVisible] = useState(false);
  // Habits modals
  const [isSmokingModalVisible, setIsSmokingModalVisible] = useState(false);
  const [isCaresAboutPartnerSmokingModalVisible, setIsCaresAboutPartnerSmokingModalVisible] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isContactModalVisible, setIsContactModalVisible] = useState(false);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [contactMessage, setContactMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [showValidationError, setShowValidationError] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const apiClient = useMemo(() => new ApiClient(API_URL), []);
  const profileApi = useMemo(() => new ProfileApi(apiClient), [apiClient]);
  const { photos: userPhotos } = useUserPhotos(user?.id || null);
  const mainPhoto = userPhotos.find((p) => p.is_main);

  const loadProfile = useCallback(async () => {
    if (!tokens?.accessToken) {
      return;
    }

    setFeedback(null);
    setIsLoading(true);
    try {
      const result = await profileApi.getProfile(tokens.accessToken);
      if (result.success) {
        const nextProfile = result.data;
        setProfile(nextProfile);
        setVerificationStatus(nextProfile.verification_status ?? 'pending');
        setForm(mapProfileToForm(nextProfile));
        setFormErrors({});
      } else {
        setFeedback({
          type: 'error',
          message: result.error.message ?? 'No se pudo cargar el perfil.',
        });
      }
    } catch (error) {
      console.error('[Profile] loadProfile error', error);
      setFeedback({
        type: 'error',
        message: 'No se pudo cargar el perfil. Intentalo de nuevo.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [profileApi, tokens?.accessToken]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  // Cleanup timeout al desmontar el componente
  useEffect(() => {
    return () => {
      if (ageRangeTimeoutRef.current) {
        clearTimeout(ageRangeTimeoutRef.current);
      }
    };
  }, []);

  const handleChange = (field: keyof FormState) => (value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
    setFormErrors((prev) => {
      if (!prev[field]) {
        return prev;
      }
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleSelectGender = (value: GenderFormValue) => {
    setForm((prev) => ({
      ...prev,
      gender: value,
    }));
    setFormErrors((prev) => {
      if (!prev.gender) {
        return prev;
      }
      const next = { ...prev };
      delete next.gender;
      return next;
    });
    // Auto-save gender change
    autoSave('gender', value);
  };

  const handleSelectLookingFor = (value: LookingForFormValue) => {
    setForm((prev) => ({
      ...prev,
      looking_for: value,
    }));
    setFormErrors((prev) => {
      if (!prev.looking_for) {
        return prev;
      }
      const next = { ...prev };
      delete next.looking_for;
      return next;
    });
    // Auto-save looking_for change
    autoSave('looking_for', value);
  };

  // Ref para rastrear el último auto-save de rango de edad
  const ageRangeTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const handleAgeRangeChange = (minAge: number, maxAge: number) => {
    // Actualizar ambos valores juntos en el formulario
    setForm((prev) => ({
      ...prev,
      min_age: minAge,
      max_age: maxAge,
    }));
    setFormErrors((prev) => {
      const next = { ...prev };
      delete next.min_age;
      delete next.max_age;
      return next;
    });
    // Auto-save con ambos valores correctos
    autoSaveAgeRange(minAge, maxAge);
  };

  // Función especializada para guardar el rango de edad atómicamente
  const autoSaveAgeRange = useCallback(
    (minAge: number, maxAge: number) => {
      // Limpiar timeout anterior si existe
      if (ageRangeTimeoutRef.current) {
        clearTimeout(ageRangeTimeoutRef.current);
      }

      // Debounce: esperar 800ms antes de guardar
      ageRangeTimeoutRef.current = setTimeout(async () => {
        if (!tokens?.accessToken || isAutoSaving) {
          return;
        }

        // Validación
        if (minAge > maxAge) {
          console.warn('[Profile] Invalid age range: min > max', {
            minAge,
            maxAge,
          });
          return;
        }

        setIsAutoSaving(true);

        try {
          const payload: UpdateUserProfile = {
            min_age: minAge,
            max_age: maxAge,
          };

          console.log('[Profile] Auto-saving age range:', payload);

          const result = await profileApi.updateProfile(
            payload,
            tokens.accessToken
          );

          if (result.success) {
            const updatedProfile = result.data;
            setProfile(updatedProfile);

            // Actualizar el formulario con los valores confirmados de la BD
            setForm((prev) => ({
              ...prev,
              min_age: updatedProfile.min_age ?? 18,
              max_age: updatedProfile.max_age ?? 99,
            }));

            console.log('[Profile] Age range saved successfully:', {
              min_age: updatedProfile.min_age,
              max_age: updatedProfile.max_age,
            });
          } else {
            console.error('[Profile] autoSaveAgeRange failed', result.error);
            setFeedback({
              type: 'error',
              message:
                'No se pudo guardar el rango de edad. Inténtalo de nuevo.',
            });
          }
        } catch (error) {
          console.error('[Profile] autoSaveAgeRange error', error);
          setFeedback({
            type: 'error',
            message: 'Error al guardar el rango de edad.',
          });
        } finally {
          setIsAutoSaving(false);
        }
      }, 800);
    },
    [profileApi, tokens?.accessToken, isAutoSaving]
  );

  const handleShowInFeedToggle = () => {
    const newValue = !form.show_bio_in_feed;
    setForm((prev) => ({
      ...prev,
      show_bio_in_feed: newValue,
    }));
    // Auto-save show_bio_in_feed change
    autoSave('show_bio_in_feed', newValue);
  };

  // Family plan handlers
  const handleSelectHasChildren = (value: boolean) => {
    setForm((prev) => ({ ...prev, has_children: value }));
    autoSave('has_children', value);
  };

  const handleSelectWantsChildren = (value: 'yes' | 'no' | 'not_sure') => {
    setForm((prev) => ({ ...prev, wants_children: value }));
    autoSave('wants_children', value);
  };

  const handleSelectCaresAboutPartnerChildren = (value: 'yes' | 'no') => {
    setForm((prev) => ({ ...prev, cares_about_partner_children: value }));
    autoSave('cares_about_partner_children', value);
  };

  // Habits handlers
  const handleSelectSmoking = (value: 'no' | 'occasionally' | 'regularly') => {
    setForm((prev) => ({ ...prev, smoking: value }));
    autoSave('smoking', value);
  };

  const handleSelectCaresAboutPartnerSmoking = (value: 'yes' | 'no') => {
    setForm((prev) => ({ ...prev, cares_about_partner_smoking: value }));
    autoSave('cares_about_partner_smoking', value);
  };

  const handleSelectAvatar = () => {
    if (Platform.OS === 'web') {
      // For web, show options for file selection
      Alert.alert(
        'Seleccionar foto de perfil',
        'Elige una foto desde tu computadora',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Seleccionar archivo', onPress: handlePickFromGallery },
        ]
      );
      return;
    }

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancelar', 'Tomar foto', 'Elegir de galería'],
          cancelButtonIndex: 0,
        },
        async (buttonIndex) => {
          if (buttonIndex === 1) {
            await handleTakePhoto();
          } else if (buttonIndex === 2) {
            await handlePickFromGallery();
          }
        }
      );
    } else {
      Alert.alert(
        'Cambiar foto de perfil',
        '¿De dónde quieres obtener tu foto?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Tomar foto', onPress: handleTakePhoto },
          { text: 'Elegir de galería', onPress: handlePickFromGallery },
        ]
      );
    }
  };

  const handleTakePhoto = async () => {
    router.push('/profile/photos');
  };

  const handlePickFromGallery = async () => {
    router.push('/profile/photos');
  };

  const autoSave = useCallback(
    async (field: keyof FormState, value: any) => {
      if (!tokens?.accessToken || isAutoSaving) {
        return;
      }

      setIsAutoSaving(true);

      try {
        const payload: UpdateUserProfile = {};

        // Map form field to API field
        switch (field) {
          case 'gender':
            payload.gender = value || null;
            break;
          case 'looking_for':
            payload.looking_for = value || null;
            break;
          case 'min_age':
            payload.min_age = value;
            break;
          case 'max_age':
            payload.max_age = value;
            break;
          case 'show_bio_in_feed':
            payload.show_bio_in_feed = value;
            break;
          // Family plan
          case 'has_children':
            payload.has_children = value;
            break;
          case 'wants_children':
            payload.wants_children = value;
            break;
          case 'cares_about_partner_children':
            payload.cares_about_partner_children = value;
            break;
          // Habits
          case 'smoking':
            payload.smoking = value;
            break;
          case 'cares_about_partner_smoking':
            payload.cares_about_partner_smoking = value;
            break;
          default:
            return; // Don't auto-save other fields
        }

        console.log(`[Profile] Auto-saving ${field}:`, value);

        const result = await profileApi.updateProfile(
          payload,
          tokens.accessToken
        );

        if (result.success) {
          const updatedProfile = result.data;
          setProfile(updatedProfile);

          // Actualizar el formulario con los valores confirmados de la BD
          setForm(mapProfileToForm(updatedProfile));

          console.log(`[Profile] ${field} saved successfully`);
        } else {
          console.error('[Profile] autoSave failed', result.error);
          setFeedback({
            type: 'error',
            message: 'No se pudo guardar el cambio. Inténtalo de nuevo.',
          });
        }
      } catch (error) {
        console.error('[Profile] autoSave error', error);
        setFeedback({
          type: 'error',
          message: 'Error al guardar el cambio.',
        });
      } finally {
        setIsAutoSaving(false);
      }
    },
    [profileApi, tokens?.accessToken, isAutoSaving]
  );

  const handleContactUs = () => {
    setIsContactModalVisible(true);
  };

  const handleDeleteAccount = () => {
    setIsDeleteModalVisible(true);
  };

  const handleContactSubmit = async () => {
    if (contactMessage.length < 10) {
      setShowValidationError(true);
      setTimeout(() => setShowValidationError(false), 3000);
      return;
    }

    setIsSubmitting(true);

    // Simular envío (500ms)
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Mostrar mensaje de éxito (sin limpiar el texto)
    setIsSubmitting(false);
    setShowToast(true);

    // Cerrar modal después de 2 segundos (y limpiar texto al cerrar)
    setTimeout(() => {
      setShowToast(false);
      setContactMessage(''); // Limpiar aquí, cuando el usuario ya no lo ve
      setIsContactModalVisible(false);
    }, 2000);
  };

  const handleDeleteConfirm = useCallback(async () => {
    if (isDeletingAccount || !tokens?.accessToken) {
      return;
    }

    setIsDeletingAccount(true);

    try {
      const result = await profileApi.deactivateAccount(tokens.accessToken);

      if (!result.success) {
        const message =
          result.error.message ?? 'No se pudo desactivar tu cuenta.';
        Alert.alert('Error', message);
        setFeedback({
          type: 'error',
          message,
        });
        return;
      }

      try {
        await supabase.auth.signOut();
      } catch (signOutError) {
        console.warn('[Profile] supabase signOut failed', signOutError);
      }

      logout();
      setIsDeleteModalVisible(false);

      Alert.alert(
        'Cuenta desactivada',
        'Tu cuenta ha sido desactivada. Contacta con soporte si deseas reactivarla.'
      );

      router.replace('/(auth)/login');
    } catch (error) {
      console.error('[Profile] handleDeleteConfirm error', error);
      const message = 'No se pudo desactivar la cuenta. Intentalo de nuevo.';
      Alert.alert('Error', message);
      setFeedback({
        type: 'error',
        message,
      });
    } finally {
      setIsDeletingAccount(false);
    }
  }, [
    isDeletingAccount,
    tokens?.accessToken,
    profileApi,
    supabase,
    logout,
    router,
  ]);
  const resolvedVerificationStatus =
    profile?.verification_status ?? verificationStatus;
  const verificationLabel =
    VERIFICATION_LABELS[resolvedVerificationStatus] ??
    VERIFICATION_LABELS.pending;
  const isVerificationActionable =
    resolvedVerificationStatus === 'pending' ||
    resolvedVerificationStatus === 'rejected';

  const handleVerifyProfile = () => {
    if (!isVerificationActionable) {
      return;
    }
    router.push('/profile/verify');
  };

  if (!tokens?.accessToken) {
    return (
      <View style={styles.centered}>
        <Text style={styles.infoText}>
          Tu sesion no es valida. Inicia sesion de nuevo para ver tu perfil.
        </Text>
      </View>
    );
  }

  return (
    <>
      <Modal
        visible={isGenderModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsGenderModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Selecciona tu genero</Text>
            {GENDER_CHOICES.map((option) => {
              const isActive = form.gender === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.modalOption,
                    isActive ? styles.modalOptionActive : null,
                  ]}
                  onPress={() => {
                    handleSelectGender(option.value);
                    setIsGenderModalVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      isActive ? styles.modalOptionTextActive : null,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setIsGenderModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal
        visible={isLookingForModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsLookingForModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Selecciona a quien buscas</Text>
            {LOOKING_FOR_CHOICES.map((option) => {
              const isActive = form.looking_for === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.modalOption,
                    isActive ? styles.modalOptionActive : null,
                  ]}
                  onPress={() => {
                    handleSelectLookingFor(option.value);
                    setIsLookingForModalVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      isActive ? styles.modalOptionTextActive : null,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setIsLookingForModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* Family Plan Modals */}
      <Modal
        visible={isHasChildrenModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsHasChildrenModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>¿Tienes hijos?</Text>
            {[
              { value: false, label: 'No' },
              { value: true, label: 'Sí' },
            ].map((option) => {
              const isActive = form.has_children === option.value;
              return (
                <TouchableOpacity
                  key={String(option.value)}
                  style={[
                    styles.modalOption,
                    isActive ? styles.modalOptionActive : null,
                  ]}
                  onPress={() => {
                    handleSelectHasChildren(option.value);
                    setIsHasChildrenModalVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      isActive ? styles.modalOptionTextActive : null,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setIsHasChildrenModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal
        visible={isWantsChildrenModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsWantsChildrenModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>¿Quieres tener hijos en el futuro?</Text>
            {(['yes', 'no', 'not_sure'] as const).map((value) => {
              const isActive = form.wants_children === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.modalOption,
                    isActive ? styles.modalOptionActive : null,
                  ]}
                  onPress={() => {
                    handleSelectWantsChildren(value);
                    setIsWantsChildrenModalVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      isActive ? styles.modalOptionTextActive : null,
                    ]}
                  >
                    {WANTS_CHILDREN_LABELS[value]}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setIsWantsChildrenModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal
        visible={isCaresAboutPartnerChildrenModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCaresAboutPartnerChildrenModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>¿Te importa si la otra persona tiene hijos?</Text>
            {(['yes', 'no'] as const).map((value) => {
              const isActive = form.cares_about_partner_children === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.modalOption,
                    isActive ? styles.modalOptionActive : null,
                  ]}
                  onPress={() => {
                    handleSelectCaresAboutPartnerChildren(value);
                    setIsCaresAboutPartnerChildrenModalVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      isActive ? styles.modalOptionTextActive : null,
                    ]}
                  >
                    {CARES_ABOUT_PARTNER_CHILDREN_LABELS[value]}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setIsCaresAboutPartnerChildrenModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* Habits Modals */}
      <Modal
        visible={isSmokingModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsSmokingModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>¿Fumas?</Text>
            {(['no', 'occasionally', 'regularly'] as const).map((value) => {
              const isActive = form.smoking === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.modalOption,
                    isActive ? styles.modalOptionActive : null,
                  ]}
                  onPress={() => {
                    handleSelectSmoking(value);
                    setIsSmokingModalVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      isActive ? styles.modalOptionTextActive : null,
                    ]}
                  >
                    {SMOKING_LABELS[value]}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setIsSmokingModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal
        visible={isCaresAboutPartnerSmokingModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCaresAboutPartnerSmokingModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>¿Te importa si la otra persona fuma?</Text>
            {(['yes', 'no'] as const).map((value) => {
              const isActive = form.cares_about_partner_smoking === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.modalOption,
                    isActive ? styles.modalOptionActive : null,
                  ]}
                  onPress={() => {
                    handleSelectCaresAboutPartnerSmoking(value);
                    setIsCaresAboutPartnerSmokingModalVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      isActive ? styles.modalOptionTextActive : null,
                    ]}
                  >
                    {CARES_ABOUT_PARTNER_SMOKING_LABELS[value]}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setIsCaresAboutPartnerSmokingModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={loadProfile}
            tintColor="#e91e63"
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        {feedback && (
          <View
            style={[
              styles.banner,
              feedback.type === 'success'
                ? styles.bannerSuccess
                : feedback.type === 'info'
                  ? styles.bannerInfo
                  : styles.bannerError,
            ]}
          >
            <Text style={styles.bannerText}>{feedback.message}</Text>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.avatarContainer}>
            <TouchableOpacity
              onPress={() => router.push('/profile/photos')}
              style={styles.avatarButton}
            >
              {mainPhoto ? (
                <Image
                  source={{ uri: mainPhoto.public_url }}
                  style={styles.avatarImage}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarPlaceholderText}>+</Text>
                </View>
              )}
              <View style={styles.avatarEditBadge}>
                <Text style={styles.avatarEditText}>Editar</Text>
              </View>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={handleVerifyProfile}
            activeOpacity={0.85}
            disabled={!isVerificationActionable}
            style={[
              styles.verificationButton,
              !isVerificationActionable
                ? styles.verificationButtonDisabled
                : null,
            ]}
          >
            <Text style={styles.verificationButtonText}>
              {verificationLabel}
            </Text>
          </TouchableOpacity>

          {/* Mostrar nombre y edad de forma natural */}
          <View style={styles.nameAgeContainer}>
            <Text style={styles.nameAgeText}>
              {profile?.name ?? user?.name ?? 'Usuario'}
              {profile?.birthDate && calculateAge(profile.birthDate) > 0
                ? `, ${calculateAge(profile.birthDate)}`
                : null}
            </Text>
            {form.city ? (
              <View style={styles.locationContainer}>
                <Text style={styles.locationText}>{`📍 ${form.city}`}</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.sectionTitle}>Información básica</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Genero</Text>
            <TouchableOpacity
              style={[
                styles.input,
                styles.selectTrigger,
                formErrors.gender ? styles.inputError : null,
              ]}
              activeOpacity={0.7}
              onPress={() => setIsGenderModalVisible(true)}
            >
              <Text
                style={
                  form.gender ? styles.selectValue : styles.selectPlaceholder
                }
              >
                {getGenderLabel(form.gender)}
              </Text>
            </TouchableOpacity>
            {formErrors.gender ? (
              <Text style={styles.errorText}>{formErrors.gender}</Text>
            ) : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Busco</Text>
            <TouchableOpacity
              style={[
                styles.input,
                styles.selectTrigger,
                formErrors.looking_for ? styles.inputError : null,
              ]}
              activeOpacity={0.7}
              onPress={() => setIsLookingForModalVisible(true)}
            >
              <Text
                style={
                  form.looking_for
                    ? styles.selectValue
                    : styles.selectPlaceholder
                }
              >
                {getLookingForLabel(form.looking_for)}
              </Text>
            </TouchableOpacity>
            {formErrors.looking_for ? (
              <Text style={styles.errorText}>{formErrors.looking_for}</Text>
            ) : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Rango de edad que buscas</Text>
            <AgeRangePicker
              minAge={form.min_age}
              maxAge={form.max_age}
              onRangeChange={handleAgeRangeChange}
            />
            {(formErrors.min_age || formErrors.max_age) && (
              <Text style={styles.errorText}>
                {formErrors.min_age ? formErrors.min_age : formErrors.max_age}
              </Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Biografia</Text>
            <TextInput
              style={[
                styles.input,
                styles.multiline,
                styles.inputDisabled,
                formErrors.bio ? styles.inputError : null,
              ]}
              placeholder="Tu perfil crecerá a medida que conectes con otras personas."
              value={form.bio}
              onChangeText={handleChange('bio')}
              multiline
              numberOfLines={4}
              editable={false}
              maxLength={300}
            />
          </View>

          <View style={styles.field}>
            <View style={styles.toggleContainer}>
              <Text style={styles.toggleLabel}>
                Mostrar mi descripción a otras personas
              </Text>
              <TouchableOpacity
                style={[
                  styles.toggle,
                  form.show_bio_in_feed
                    ? styles.toggleActive
                    : styles.toggleInactive,
                ]}
                onPress={handleShowInFeedToggle}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.toggleThumb,
                    form.show_bio_in_feed
                      ? styles.toggleThumbActive
                      : styles.toggleThumbInactive,
                  ]}
                />
              </TouchableOpacity>
            </View>
            <Text style={styles.toggleHelperText}>
              Si lo desactivas, tu bio no será visible para otros usuarios.
            </Text>
          </View>

          {/* Plan familiar */}
          <Text style={styles.sectionTitle}>Plan familiar</Text>

          <View style={styles.field}>
            <Text style={styles.label}>¿Tienes hijos?</Text>
            <TouchableOpacity
              style={[
                styles.input,
                styles.selectTrigger,
              ]}
              activeOpacity={0.7}
              onPress={() => setIsHasChildrenModalVisible(true)}
            >
              <Text
                style={
                  form.has_children !== null ? styles.selectValue : styles.selectPlaceholder
                }
              >
                {form.has_children === null ? 'Seleccionar' : form.has_children ? 'Sí' : 'No'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>¿Quieres tener hijos en el futuro?</Text>
            <TouchableOpacity
              style={[
                styles.input,
                styles.selectTrigger,
              ]}
              activeOpacity={0.7}
              onPress={() => setIsWantsChildrenModalVisible(true)}
            >
              <Text
                style={
                  form.wants_children ? styles.selectValue : styles.selectPlaceholder
                }
              >
                {getWantsChildrenLabel(form.wants_children)}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>¿Te importa si la otra persona tiene hijos?</Text>
            <TouchableOpacity
              style={[
                styles.input,
                styles.selectTrigger,
              ]}
              activeOpacity={0.7}
              onPress={() => setIsCaresAboutPartnerChildrenModalVisible(true)}
            >
              <Text
                style={
                  form.cares_about_partner_children ? styles.selectValue : styles.selectPlaceholder
                }
              >
                {getCaresAboutPartnerChildrenLabel(form.cares_about_partner_children)}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Hábitos importantes */}
          <Text style={styles.sectionTitle}>Hábitos importantes</Text>

          <View style={styles.field}>
            <Text style={styles.label}>¿Fumas?</Text>
            <TouchableOpacity
              style={[
                styles.input,
                styles.selectTrigger,
              ]}
              activeOpacity={0.7}
              onPress={() => setIsSmokingModalVisible(true)}
            >
              <Text
                style={
                  form.smoking ? styles.selectValue : styles.selectPlaceholder
                }
              >
                {getSmokingLabel(form.smoking)}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>¿Te importa si la otra persona fuma?</Text>
            <TouchableOpacity
              style={[
                styles.input,
                styles.selectTrigger,
              ]}
              activeOpacity={0.7}
              onPress={() => setIsCaresAboutPartnerSmokingModalVisible(true)}
            >
              <Text
                style={
                  form.cares_about_partner_smoking ? styles.selectValue : styles.selectPlaceholder
                }
              >
                {getCaresAboutPartnerSmokingLabel(form.cares_about_partner_smoking)}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.autoSaveMessage}>
            Los cambios se guardan automáticamente.
          </Text>

          {/* Contact and Delete options */}
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleContactUs}
            >
              <Text style={styles.actionButtonText}>Contacta con nosotros</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={handleDeleteAccount}
            >
              <Text style={[styles.actionButtonText, styles.deleteButtonText]}>
                Borrar cuenta
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {isLoading && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#e91e63" />
            <Text style={styles.loadingText}>Cargando perfil...</Text>
          </View>
        )}
      </ScrollView>

      {/* Contact us modal */}
      <Modal
        visible={isContactModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsContactModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setIsContactModalVisible(false)}
          >
            <Pressable style={styles.contactModalContent}>
              <Text style={styles.contactModalTitle}>
                ¿En qué podemos ayudarte?
              </Text>

              <View style={styles.textInputContainer}>
                <TextInput
                  style={styles.contactTextInput}
                  placeholder="Escribe tu mensaje aquí..."
                  value={contactMessage}
                  onChangeText={setContactMessage}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  maxLength={300}
                />
                <Text style={styles.characterCounter}>
                  {contactMessage.length} / 300
                </Text>
                {showValidationError && (
                  <Text style={styles.validationError}>
                    El mensaje debe tener al menos 10 caracteres
                  </Text>
                )}
              </View>

              {showToast && (
                <Text style={styles.successMessage}>
                  Tu mensaje ha sido enviado correctamente.
                </Text>
              )}

              <View style={styles.contactButtonContainer}>
                <TouchableOpacity
                  style={styles.contactCancelButton}
                  onPress={() => setIsContactModalVisible(false)}
                >
                  <Text style={styles.contactCancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.contactSubmitButton,
                    contactMessage.length < 10 || isSubmitting
                      ? styles.contactSubmitButtonDisabled
                      : null,
                  ]}
                  onPress={handleContactSubmit}
                  disabled={contactMessage.length < 10 || isSubmitting}
                >
                  <Text
                    style={[
                      styles.contactSubmitButtonText,
                      contactMessage.length < 10 || isSubmitting
                        ? styles.contactSubmitButtonTextDisabled
                        : null,
                    ]}
                  >
                    {isSubmitting ? 'Enviando...' : 'Enviar'}
                  </Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete account modal */}
      <Modal
        visible={isDeleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsDeleteModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setIsDeleteModalVisible(false)}
        >
          <Pressable style={styles.deleteModalContent}>
            <Text style={styles.deleteModalTitle}>
              ¿Seguro que quieres eliminar tu cuenta?
            </Text>
            <Text style={styles.deleteModalSubtext}>
              Esta acción no se puede deshacer. Perderás tu perfil, tus matches
              y tus mensajes.
            </Text>
            <View style={styles.deleteButtonContainer}>
              <TouchableOpacity
                style={styles.deleteCancelButton}
                onPress={() => setIsDeleteModalVisible(false)}
              >
                <Text style={styles.deleteCancelButtonText}>No</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.deleteConfirmButton,
                  isDeletingAccount ? styles.deleteConfirmButtonDisabled : null,
                ]}
                onPress={handleDeleteConfirm}
                disabled={isDeletingAccount}
              >
                <Text style={styles.deleteConfirmButtonText}>
                  {isDeletingAccount ? 'Desactivando...' : 'Si'}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: '#f5f5f5',
  },
  banner: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f0f0f0',
  },
  bannerSuccess: {
    backgroundColor: '#e8f5e9',
    borderColor: '#2e7d32',
  },
  bannerInfo: {
    backgroundColor: '#e3f2fd',
    borderColor: '#1976d2',
  },
  bannerError: {
    backgroundColor: '#fdecea',
    borderColor: '#d32f2f',
  },
  bannerText: {
    textAlign: 'center',
    color: '#333',
    fontSize: 14,
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    gap: 16,
  },
  avatarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarButton: {
    width: 160,
    height: 160,
    borderRadius: 80,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    position: 'relative',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e0e0e0',
  },
  avatarPlaceholderText: {
    fontSize: 48,
    color: '#999',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 6,
    alignItems: 'center',
  },
  avatarEditText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  avatarOverlayIcon: {
    fontSize: 32,
  },
  avatarOverlayText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e91e63',
    marginBottom: 4,
  },
  field: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  rowField: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    color: '#555',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  selectTrigger: {
    justifyContent: 'center',
  },
  selectPlaceholder: {
    fontSize: 16,
    color: '#999',
  },
  selectValue: {
    fontSize: 16,
    color: '#222',
    fontWeight: '500',
  },
  inputError: {
    borderColor: '#d32f2f',
  },
  inputDisabled: {
    backgroundColor: '#f5f5f5',
    color: '#666',
    borderColor: '#ddd',
  },
  multiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#e91e63',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    fontSize: 12,
    color: '#d32f2f',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#222',
    textAlign: 'center',
  },
  modalOption: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  modalOptionActive: {
    borderColor: '#e91e63',
    backgroundColor: '#fde4ed',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  modalOptionTextActive: {
    color: '#e91e63',
    fontWeight: '600',
  },
  modalClose: {
    marginTop: 4,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
  },
  modalCloseText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#555',
    fontWeight: '500',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    gap: 12,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f5f5f5',
  },
  infoText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#555',
  },
  readonlyField: {
    gap: 4,
    padding: 12,
    backgroundColor: '#fafafa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  valueText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
  },
  helperText: {
    fontSize: 12,
    color: '#999',
  },
  nameAgeContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  nameAgeText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#222',
    textAlign: 'center',
  },
  locationContainer: {
    marginTop: 8,
    alignItems: 'center',
  },
  locationText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#222',
    flex: 1,
  },
  toggleHelperText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: '#e91e63',
  },
  toggleInactive: {
    backgroundColor: '#ddd',
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  toggleThumbInactive: {
    alignSelf: 'flex-start',
  },
  autoSaveMessage: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 24,
    fontStyle: 'italic',
  },
  verificationButton: {
    width: '100%',
    backgroundColor: '#e91e63',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  verificationButtonDisabled: {
    backgroundColor: '#f3a5c3',
  },
  verificationButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  // Action buttons styles
  actionButtonsContainer: {
    marginTop: 24,
    gap: 12,
  },
  actionButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  deleteButton: {
    backgroundColor: '#fff5f5',
    borderColor: '#F45C5C',
  },
  deleteButtonText: {
    color: '#F45C5C',
  },
  // Contact modal styles
  contactModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    margin: 20,
    maxWidth: 400,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  contactModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
    textAlign: 'center',
    marginBottom: 24,
  },
  textInputContainer: {
    position: 'relative',
    marginBottom: 24,
  },
  contactTextInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#fff',
    minHeight: 120,
    textAlignVertical: 'top',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  characterCounter: {
    position: 'absolute',
    bottom: 8,
    right: 12,
    fontSize: 14,
    color: '#999',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  validationError: {
    fontSize: 12,
    color: '#F45C5C',
    marginTop: 8,
    marginLeft: 4,
    fontWeight: '500',
  },
  contactButtonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  contactCancelButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#F2F2F2',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  contactCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  contactSubmitButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#F45C5C',
    alignItems: 'center',
    shadowColor: '#F45C5C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  contactSubmitButtonDisabled: {
    backgroundColor: '#E0E0E0',
    shadowOpacity: 0,
    elevation: 0,
  },
  contactSubmitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  contactSubmitButtonTextDisabled: {
    color: '#999',
  },
  successMessage: {
    fontSize: 16,
    color: '#2e7d32',
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '500',
  },
  // Toast styles
  toastContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 100,
    zIndex: 9999,
  },
  toast: {
    backgroundColor: '#F45C5C',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    marginHorizontal: 20,
    shadowColor: '#F45C5C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
  },
  toastText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  // Delete modal styles
  deleteModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    margin: 20,
    maxWidth: 400,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  deleteModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
    textAlign: 'center',
    marginBottom: 12,
  },
  deleteModalSubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  deleteButtonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  deleteCancelButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#F2F2F2',
    alignItems: 'center',
  },
  deleteCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  deleteConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#F45C5C',
    alignItems: 'center',
  },
  deleteConfirmButtonDisabled: {
    opacity: 0.6,
  },
  deleteConfirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
