import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuthStore } from '../../src/domain/stores/authStore';
import { ApiClient } from '../../src/data/api/apiClient';
import { ProfileApi } from '../../src/data/api/profileApi';
import {
  UpdateUserProfile,
  UserProfile,
} from '../../src/domain/entities/UserProfile';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

type FormState = {
  birthDate: string;
  gender: string;
  looking_for: string;
  min_age: string;
  max_age: string;
  bio: string;
  city: string;
};

const emptyForm: FormState = {
  birthDate: '',
  gender: '',
  looking_for: '',
  min_age: '',
  max_age: '',
  bio: '',
  city: '',
};

const isValidDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const toNullableNumber = (value: string) => {
  if (!value.trim()) {
    return null;
  }

  const numericValue = Number.parseInt(value.trim(), 10);
  return Number.isNaN(numericValue) ? NaN : numericValue;
};

export default function ProfileScreen() {
  const { tokens, user } = useAuthStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const apiClient = useMemo(() => new ApiClient(API_URL), []);
  const profileApi = useMemo(() => new ProfileApi(apiClient), [apiClient]);

  const loadProfile = useCallback(async () => {
    if (!tokens?.accessToken) {
      return;
    }

    setIsLoading(true);
    try {
      const result = await profileApi.getProfile(tokens.accessToken);
      if (result.success) {
        const nextProfile = result.data;
        setProfile(nextProfile);
        setForm({
          birthDate: nextProfile.birthDate ?? '',
          gender: nextProfile.gender ?? '',
          looking_for: nextProfile.looking_for ?? '',
          min_age: nextProfile.min_age?.toString() ?? '',
          max_age: nextProfile.max_age?.toString() ?? '',
          bio: nextProfile.bio ?? '',
          city: nextProfile.city ?? '',
        });
      } else {
        Alert.alert('Error', result.error.message ?? 'No se pudo cargar el perfil.');
      }
    } catch (error) {
      console.error('[Profile] loadProfile error', error);
      Alert.alert('Error', 'No se pudo cargar el perfil. Inténtalo de nuevo.');
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
  };

  const handleSave = async () => {
    if (!tokens?.accessToken) {
      Alert.alert('Sesión expirada', 'Vuelve a iniciar sesión para guardar los cambios.');
      return;
    }

    if (form.birthDate && !isValidDate(form.birthDate)) {
      Alert.alert('Fecha inválida', 'Usa el formato YYYY-MM-DD para la fecha de nacimiento.');
      return;
    }

    const minAge = toNullableNumber(form.min_age);
    if (Number.isNaN(minAge)) {
      Alert.alert('Edad mínima inválida', 'Introduce un número válido para la edad mínima.');
      return;
    }

    const maxAge = toNullableNumber(form.max_age);
    if (Number.isNaN(maxAge)) {
      Alert.alert('Edad máxima inválida', 'Introduce un número válido para la edad máxima.');
      return;
    }

    if (minAge !== null && maxAge !== null && minAge > maxAge) {
      Alert.alert('Rango de edad inválido', 'La edad mínima no puede ser mayor que la máxima.');
      return;
    }

    const payload: UpdateUserProfile = {
      birthDate: form.birthDate.trim() ? form.birthDate.trim() : null,
      gender: form.gender.trim() ? form.gender.trim() : null,
      looking_for: form.looking_for.trim() ? form.looking_for.trim() : null,
      min_age: minAge,
      max_age: maxAge,
      bio: form.bio.trim() ? form.bio.trim() : null,
      city: form.city.trim() ? form.city.trim() : null,
    };

    setIsSaving(true);
    try {
      const result = await profileApi.updateProfile(payload, tokens.accessToken);
      if (result.success) {
        const updated = result.data;
        setProfile(updated);
        setForm({
          birthDate: updated.birthDate ?? '',
          gender: updated.gender ?? '',
          looking_for: updated.looking_for ?? '',
          min_age: updated.min_age?.toString() ?? '',
          max_age: updated.max_age?.toString() ?? '',
          bio: updated.bio ?? '',
          city: updated.city ?? '',
        });
        Alert.alert('Perfil actualizado', 'Tus cambios se han guardado correctamente.');
      } else {
        Alert.alert('Error', result.error.message ?? 'No se pudo actualizar el perfil.');
      }
    } catch (error) {
      console.error('[Profile] handleSave error', error);
      Alert.alert('Error', 'No se pudo actualizar el perfil. Inténtalo de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!tokens?.accessToken) {
    return (
      <View style={styles.centered}>
        <Text style={styles.infoText}>
          Tu sesión no es válida. Inicia sesión de nuevo para ver tu perfil.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Información básica</Text>
        <View style={styles.readonlyField}>
          <Text style={styles.label}>Nombre</Text>
          <Text style={styles.valueText}>
            {profile?.name ?? user?.name ?? 'Usuario'}
          </Text>
          <Text style={styles.helperText}>Este campo no se puede editar desde la app.</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Fecha de nacimiento (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            placeholder="1990-05-12"
            value={form.birthDate}
            onChangeText={handleChange('birthDate')}
            keyboardType="numbers-and-punctuation"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Género</Text>
          <TextInput
            style={styles.input}
            placeholder="female / male / non-binary / other"
            value={form.gender}
            onChangeText={handleChange('gender')}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Busco</Text>
          <TextInput
            style={styles.input}
            placeholder="Describe a quién buscas"
            value={form.looking_for}
            onChangeText={handleChange('looking_for')}
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.field, styles.rowField]}>
            <Text style={styles.label}>Edad mínima</Text>
            <TextInput
              style={styles.input}
              placeholder="18"
              value={form.min_age}
              onChangeText={handleChange('min_age')}
              keyboardType="number-pad"
            />
          </View>
          <View style={[styles.field, styles.rowField]}>
            <Text style={styles.label}>Edad máxima</Text>
            <TextInput
              style={styles.input}
              placeholder="99"
              value={form.max_age}
              onChangeText={handleChange('max_age')}
              keyboardType="number-pad"
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Biografía</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="Cuéntanos algo sobre ti"
            value={form.bio}
            onChangeText={handleChange('bio')}
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Ciudad</Text>
          <TextInput
            style={styles.input}
            placeholder="Barcelona"
            value={form.city}
            onChangeText={handleChange('city')}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, isSaving && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Guardar cambios</Text>
          )}
        </TouchableOpacity>
      </View>

      {isLoading && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#e91e63" />
          <Text style={styles.loadingText}>Cargando perfil...</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: '#f5f5f5',
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
});
