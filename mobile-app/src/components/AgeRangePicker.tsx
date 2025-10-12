import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';

interface AgeRangePickerProps {
  minAge: number;
  maxAge: number;
  onMinAgeChange: (age: number) => void;
  onMaxAgeChange: (age: number) => void;
  disabled?: boolean;
  style?: any;
}

const MIN_AGE = 18;
const MAX_AGE = 99;

export const AgeRangePicker: React.FC<AgeRangePickerProps> = ({
  minAge,
  maxAge,
  onMinAgeChange,
  onMaxAgeChange,
  disabled = false,
  style,
}) => {
  // Generar array de edades disponibles
  const ageOptions = useMemo(() => {
    const options: number[] = [];
    for (let i = MIN_AGE; i <= MAX_AGE; i++) {
      options.push(i);
    }
    return options;
  }, []);

  // Filtrar opciones de edad mínima basándose en edad máxima seleccionada
  const minAgeOptions = useMemo(() => {
    return ageOptions.filter((age) => age <= maxAge);
  }, [ageOptions, maxAge]);

  // Filtrar opciones de edad máxima basándose en edad mínima seleccionada
  const maxAgeOptions = useMemo(() => {
    return ageOptions.filter((age) => age >= minAge);
  }, [ageOptions, minAge]);

  const handleMinAgeChange = (value: number) => {
    if (!disabled) {
      onMinAgeChange(value);
    }
  };

  const handleMaxAgeChange = (value: number) => {
    if (!disabled) {
      onMaxAgeChange(value);
    }
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.pickersContainer}>
        {/* Picker para edad mínima */}
        <View style={styles.pickerWrapper}>
          <Text style={styles.pickerLabel}>Edad mínima</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={minAge}
              onValueChange={(value) => handleMinAgeChange(Number(value))}
              enabled={!disabled}
              style={styles.picker}
              itemStyle={styles.pickerItem}
            >
              {minAgeOptions.map((age) => (
                <Picker.Item key={age} label={`${age}`} value={age} />
              ))}
            </Picker>
          </View>
        </View>

        {/* Picker para edad máxima */}
        <View style={styles.pickerWrapper}>
          <Text style={styles.pickerLabel}>Edad máxima</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={maxAge}
              onValueChange={(value) => handleMaxAgeChange(Number(value))}
              enabled={!disabled}
              style={styles.picker}
              itemStyle={styles.pickerItem}
            >
              {maxAgeOptions.map((age) => (
                <Picker.Item key={age} label={`${age}`} value={age} />
              ))}
            </Picker>
          </View>
        </View>
      </View>

      {/* Mostrar el rango actual */}
      <View style={styles.rangeDisplay}>
        <Text style={styles.rangeText}>
          Rango: {minAge} – {maxAge} años
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  pickersContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  pickerWrapper: {
    flex: 1,
    gap: 4,
  },
  pickerLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#555',
    marginBottom: 2,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fafafa',
    overflow: 'hidden',
    ...Platform.select({
      web: {
        height: 44,
        justifyContent: 'center',
      },
      ios: {
        height: 44,
        justifyContent: 'center',
      },
      android: {
        height: 50,
      },
    }),
  },
  picker: {
    ...Platform.select({
      web: {
        height: 44,
        fontSize: 16,
      },
      ios: {
        height: 44,
      },
      android: {
        height: 50,
      },
    }),
  },
  pickerItem: {
    fontSize: 16,
    height: 120,
  },
  rangeDisplay: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  rangeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e91e63',
  },
});

