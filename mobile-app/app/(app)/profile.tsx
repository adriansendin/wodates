import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
} from 'react-native';
import { AvatarPicker } from '../../src/components/AvatarPicker';
import { AgeRangePicker } from '../../src/components/AgeRangePicker';
import { useAuthStore } from '../../src/domain/stores/authStore';
import { ApiClient } from '../../src/data/api/apiClient';
import { ProfileApi } from '../../src/data/api/profileApi';
import {
  UpdateUserProfile,
  UserProfile,
} from '../../src/domain/entities/UserProfile';
import {
  GENDER_OPTIONS,
  GenderOption,
} from '../../src/domain/entities/Gender';
import {
  LOOKING_FOR_OPTIONS,
  LookingForOption,
} from '../../src/domain/entities/LookingFor';
import {
  pickImageFromGallery,
  takePictureWithCamera,
  uploadAvatarToBackend,
} from '../../src/data/api/imageService';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const AVATAR_PLACEHOLDER = 'https://via.placeholder.com/240x240.png?text=Profile';

type LookingForFormValue = LookingForOption | '';
type GenderFormValue = GenderOption | '';

type FormState = {
  gender: GenderFormValue;
  looking_for: LookingForFormValue;
  min_age: number;
  max_age: number;
  bio: string;
  city: string;
  show_in_feed: boolean;
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

const LOOKING_FOR_CHOICES: Array<{ value: LookingForFormValue; label: string }> = 
  LOOKING_FOR_OPTIONS.map((value) => ({
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

const emptyForm: FormState = {
  gender: 'male',
  looking_for: 'both',
  min_age: 18,
  max_age: 99,
  bio: '',
  city: '',
  show_in_feed: true,
};

const mapProfileToForm = (nextProfile: UserProfile | null): FormState => ({
  gender: nextProfile?.gender ?? 'male',
  looking_for: nextProfile?.looking_for ?? 'both',
  min_age: nextProfile?.min_age ?? 18,
  max_age: nextProfile?.max_age ?? 99,
  bio: nextProfile?.bio ?? '',
  city: nextProfile?.city ?? '',
  show_in_feed: nextProfile?.show_in_feed ?? true,
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
  const { tokens, user } = useAuthStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isLoading, setIsLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [isGenderModalVisible, setIsGenderModalVisible] = useState(false);
  const [isLookingForModalVisible, setIsLookingForModalVisible] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const apiClient = useMemo(() => new ApiClient(API_URL), []);
  const profileApi = useMemo(() => new ProfileApi(apiClient), [apiClient]);
  const avatarUri = useMemo(
    () => profile?.avatarUrl ?? null,
    [profile?.avatarUrl],
  );

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

  const handleMinAgeChange = (minAge: number) => {
    setForm((prev) => ({
      ...prev,
      min_age: minAge,
    }));
    setFormErrors((prev) => {
      const next = { ...prev };
      delete next.min_age;
      delete next.max_age;
      return next;
    });
    // Auto-save min_age change
    autoSave('min_age', minAge);
  };

  const handleMaxAgeChange = (maxAge: number) => {
    setForm((prev) => ({
      ...prev,
      max_age: maxAge,
    }));
    setFormErrors((prev) => {
      const next = { ...prev };
      delete next.min_age;
      delete next.max_age;
      return next;
    });
    // Auto-save max_age change
    autoSave('max_age', maxAge);
  };

  const handleShowInFeedToggle = () => {
    const newValue = !form.show_in_feed;
    setForm((prev) => ({
      ...prev,
      show_in_feed: newValue,
    }));
    // Auto-save show_in_feed change
    autoSave('show_in_feed', newValue);
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
    const result = await takePictureWithCamera();
    
    if (!result.success) {
      Alert.alert('Error', result.error.message);
      return;
    }

    if (result.data) {
      await uploadAndUpdateAvatar(result.data);
    }
  };

  const handlePickFromGallery = async () => {
    const result = await pickImageFromGallery();
    
    if (!result.success) {
      Alert.alert('Error', result.error.message);
      return;
    }

    if (result.data) {
      await uploadAndUpdateAvatar(result.data);
    }
  };

  const autoSave = useCallback(async (field: keyof FormState, value: any) => {
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
        case 'show_in_feed':
          payload.show_in_feed = value;
          break;
        default:
          return; // Don't auto-save other fields
      }

      const result = await profileApi.updateProfile(payload, tokens.accessToken);
      
      if (result.success) {
        const updatedProfile = result.data;
        setProfile(updatedProfile);
        // Don't update form state to avoid conflicts with user input
      } else {
        console.error('[Profile] autoSave failed', result.error);
      }
    } catch (error) {
      console.error('[Profile] autoSave error', error);
    } finally {
      setIsAutoSaving(false);
    }
  }, [profileApi, tokens?.accessToken, isAutoSaving]);

  const uploadAndUpdateAvatar = async (imageUri: string) => {
    if (!tokens?.accessToken || !user?.id) {
      Alert.alert('Error', 'Sesión no válida');
      return;
    }

    setIsUploadingAvatar(true);
    setFeedback({ type: 'info', message: 'Subiendo imagen...' });

    try {
      // Upload via backend
      const uploadResult = await uploadAvatarToBackend(imageUri);

      if (!uploadResult.success) {
        Alert.alert('Error', uploadResult.error.message);
        setFeedback({ type: 'error', message: uploadResult.error.message });
        setIsUploadingAvatar(false);
        return;
      }

      // Update profile with new avatar URL
      const updateResult = await profileApi.updateProfile(
        { avatarUrl: uploadResult.data },
        tokens.accessToken
      );

      if (updateResult.success) {
        const updatedProfile = updateResult.data;
        setProfile(updatedProfile);
        setForm(mapProfileToForm(updatedProfile));
        setFeedback({
          type: 'success',
          message: 'Foto de perfil actualizada correctamente.',
        });
      } else {
        Alert.alert('Error', updateResult.error.message ?? 'No se pudo actualizar la foto de perfil.');
        setFeedback({
          type: 'error',
          message: updateResult.error.message ?? 'No se pudo actualizar la foto de perfil.',
        });
      }
    } catch (error) {
      console.error('[Profile] uploadAndUpdateAvatar error', error);
      Alert.alert('Error', 'Error al actualizar la foto de perfil.');
      setFeedback({
        type: 'error',
        message: 'Error al actualizar la foto de perfil.',
      });
    } finally {
      setIsUploadingAvatar(false);
    }
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
          <AvatarPicker
            uri={avatarUri}
            size={160}
            disabled={isUploadingAvatar}
            onChange={async (localUri) => {
              if (!localUri) return;
              await uploadAndUpdateAvatar(localUri);
            }}
            helperText="Toca el botón para cambiar la foto"
          />
        </View>
        
        {/* Mostrar nombre y edad de forma natural */}
        <View style={styles.nameAgeContainer}>
          <Text style={styles.nameAgeText}>
            {profile?.name ?? user?.name ?? 'Usuario'}
            {profile?.birthDate && `, ${calculateAge(profile.birthDate)}`}
          </Text>
          {form.city && (
            <View style={styles.locationContainer}>
              <Text style={styles.locationText}>📍 {form.city}</Text>
            </View>
          )}
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
            onMinAgeChange={handleMinAgeChange}
            onMaxAgeChange={handleMaxAgeChange}
          />
          {(formErrors.min_age || formErrors.max_age) && (
            <Text style={styles.errorText}>
              {formErrors.min_age || formErrors.max_age}
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
            <Text style={styles.toggleLabel}>Mostrar mi descripción a otras personas</Text>
            <TouchableOpacity
              style={[
                styles.toggle,
                form.show_in_feed ? styles.toggleActive : styles.toggleInactive,
              ]}
              onPress={handleShowInFeedToggle}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.toggleThumb,
                  form.show_in_feed ? styles.toggleThumbActive : styles.toggleThumbInactive,
                ]}
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.toggleHelperText}>
            Si lo desactivas, tu bio no será visible para otros usuarios.
          </Text>
        </View>

        <Text style={styles.autoSaveMessage}>
          Los cambios se guardan automáticamente.
        </Text>
      </View>

      {isLoading && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#e91e63" />
          <Text style={styles.loadingText}>Cargando perfil...</Text>
        </View>
      )}
        </ScrollView>
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
  avatarWrapper: {
    position: 'relative',
    width: 160,
    height: 160,
    borderRadius: 80,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
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
});

