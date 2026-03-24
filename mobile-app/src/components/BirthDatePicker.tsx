import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';

interface BirthDatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  onError?: (error: string | null) => void;
}

const MIN_AGE = 29;
const MAX_AGE = 65;

/**
 * Componente multiplataforma para seleccionar fecha de nacimiento
 * Compatible con Web, Android e iOS sin dependencias externas
 * Valida automáticamente que la edad esté entre 29 y 65 años
 */
export const BirthDatePicker: React.FC<BirthDatePickerProps> = ({
  value,
  onChange,
  onError,
}) => {
  const { t, i18n } = useTranslation('common');
  const [isVisible, setIsVisible] = useState(false);
  const [tempYear, setTempYear] = useState(value.getFullYear());
  const [tempMonth, setTempMonth] = useState(value.getMonth());
  const [tempDay, setTempDay] = useState(value.getDate());
  const [error, setError] = useState<string | null>(null);

  const MONTHS = [
    t('birthDate.months.january'),
    t('birthDate.months.february'),
    t('birthDate.months.march'),
    t('birthDate.months.april'),
    t('birthDate.months.may'),
    t('birthDate.months.june'),
    t('birthDate.months.july'),
    t('birthDate.months.august'),
    t('birthDate.months.september'),
    t('birthDate.months.october'),
    t('birthDate.months.november'),
    t('birthDate.months.december'),
  ];

  // Generar rango de años válidos
  const currentYear = new Date().getFullYear();
  const minYear = currentYear - MAX_AGE;
  const maxYear = currentYear - MIN_AGE;
  const years = Array.from(
    { length: maxYear - minYear + 1 },
    (_, i) => maxYear - i
  );

  // Calcular días válidos para el mes seleccionado
  const daysInMonth = new Date(tempYear, tempMonth + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Ajustar día si es inválido para el mes actual
  useEffect(() => {
    if (tempDay > daysInMonth) {
      setTempDay(daysInMonth);
    }
  }, [tempMonth, tempYear, tempDay, daysInMonth]);

  /**
   * Calcula la edad en años
   */
  const calculateAge = (birthDate: Date): number => {
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
  };

  /**
   * Valida que la fecha cumpla con los requisitos de edad
   */
  const validateDate = (date: Date): string | null => {
    const age = calculateAge(date);

    if (age < MIN_AGE) {
      return t('register.minAgeError', { min: MIN_AGE });
    }

    if (age > MAX_AGE) {
      return t('register.maxAgeError', { max: MAX_AGE });
    }

    if (date > new Date()) {
      return t('register.futureDateError');
    }

    return null;
  };

  /**
   * Formatea la fecha para mostrar al usuario
   */
  const formatDate = (date: Date): string => {
    const locale = i18n.language?.startsWith('es') ? 'es-ES' : 'en-US';
    return date.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  /**
   * Abre el selector de fecha
   */
  const handleOpen = () => {
    setTempYear(value.getFullYear());
    setTempMonth(value.getMonth());
    setTempDay(value.getDate());
    setError(null);
    setIsVisible(true);
  };

  /**
   * Cancela la selección y cierra el modal
   */
  const handleCancel = () => {
    setTempYear(value.getFullYear());
    setTempMonth(value.getMonth());
    setTempDay(value.getDate());
    setError(null);
    setIsVisible(false);
  };

  /**
   * Confirma la fecha seleccionada
   */
  const handleConfirm = () => {
    const newDate = new Date(tempYear, tempMonth, tempDay);
    const validationError = validateDate(newDate);

    if (validationError) {
      setError(validationError);
      if (onError) {
        onError(validationError);
      }
      return;
    }

    setError(null);
    if (onError) {
      onError(null);
    }
    onChange(newDate);
    setIsVisible(false);
  };

  const age = calculateAge(value);
  const isValidAge = age >= MIN_AGE && age <= MAX_AGE;

  return (
    <>
      <TouchableOpacity
        style={[styles.triggerButton, !isValidAge && styles.triggerButtonError]}
        onPress={handleOpen}
        accessibilityLabel={t('common.selectBirthDate')}
        accessibilityHint={t('common.selectBirthDateHint')}
      >
        <Text style={styles.triggerText}>{formatDate(value)}</Text>
        <Text style={styles.triggerHint}>{t('common.tapToChange')}</Text>
      </TouchableOpacity>

      <View style={styles.ageContainer}>
        <Text style={[styles.ageText, !isValidAge && styles.ageTextError]}>
          {t('common.yearsOld', { count: age })}
        </Text>
      </View>

      <Modal
        visible={isVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('register.whenBorn')}</Text>

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.pickerContainer}>
              {/* Selector de Día */}
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>{t('birthDate.day')}</Text>
                <ScrollView
                  style={styles.pickerScroll}
                  showsVerticalScrollIndicator={Platform.OS === 'web'}
                >
                  {days.map((day) => (
                    <TouchableOpacity
                      key={day}
                      style={[
                        styles.pickerOption,
                        tempDay === day && styles.pickerOptionSelected,
                      ]}
                      onPress={() => setTempDay(day)}
                    >
                      <Text
                        style={[
                          styles.pickerOptionText,
                          tempDay === day && styles.pickerOptionTextSelected,
                        ]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Selector de Mes */}
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>{t('birthDate.month')}</Text>
                <ScrollView
                  style={styles.pickerScroll}
                  showsVerticalScrollIndicator={Platform.OS === 'web'}
                >
                  {MONTHS.map((month, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.pickerOption,
                        tempMonth === index && styles.pickerOptionSelected,
                      ]}
                      onPress={() => setTempMonth(index)}
                    >
                      <Text
                        style={[
                          styles.pickerOptionText,
                          tempMonth === index &&
                            styles.pickerOptionTextSelected,
                        ]}
                      >
                        {month}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Selector de Año */}
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerLabel}>{t('birthDate.year')}</Text>
                <ScrollView
                  style={styles.pickerScroll}
                  showsVerticalScrollIndicator={Platform.OS === 'web'}
                >
                  {years.map((year) => (
                    <TouchableOpacity
                      key={year}
                      style={[
                        styles.pickerOption,
                        tempYear === year && styles.pickerOptionSelected,
                      ]}
                      onPress={() => setTempYear(year)}
                    >
                      <Text
                        style={[
                          styles.pickerOptionText,
                          tempYear === year && styles.pickerOptionTextSelected,
                        ]}
                      >
                        {year}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancel}
              >
                <Text style={styles.cancelButtonText}>
                  {t('common.cancel')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleConfirm}
              >
                <Text style={styles.confirmButtonText}>{t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  triggerButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    alignItems: 'center',
  },
  triggerButtonError: {
    borderColor: '#F45C5C',
  },
  triggerText: {
    fontSize: 18,
    color: '#2C3E50',
    fontWeight: '600',
  },
  triggerHint: {
    fontSize: 12,
    color: '#7F8C8D',
    marginTop: 4,
  },
  ageContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  ageText: {
    fontSize: 16,
    color: '#F45C5C',
    fontWeight: '600',
  },
  ageTextError: {
    color: '#E74C3C',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 600,
    ...Platform.select({
      web: {
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 25,
        elevation: 10,
      },
    }),
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
    textAlign: 'center',
    marginBottom: 20,
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#C62828',
    textAlign: 'center',
    fontWeight: '500',
  },
  pickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 12,
  },
  pickerColumn: {
    flex: 1,
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
    textAlign: 'center',
    marginBottom: 8,
  },
  pickerScroll: {
    maxHeight: 240,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#FAFAFA',
  },
  pickerOption: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  pickerOptionSelected: {
    backgroundColor: '#F45C5C',
  },
  pickerOptionText: {
    fontSize: 14,
    color: '#2C3E50',
    textAlign: 'center',
  },
  pickerOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#7F8C8D',
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#F45C5C',
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
