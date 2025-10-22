import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
// Only used on native platforms (ios/android)
import MultiSlider from '@ptomasroos/react-native-multi-slider';

interface AgeRangePickerProps {
  minAge: number;
  maxAge: number;
  onRangeChange: (min: number, max: number) => void;
  disabled?: boolean;
  style?: any;
}

const MIN_AGE = 18;
const MAX_AGE = 99;

export const AgeRangePicker: React.FC<AgeRangePickerProps> = ({
  minAge,
  maxAge,
  onRangeChange,
  disabled = false,
  style,
}) => {
  // Estado local para el slider (móvil) - permite interacción fluida
  const [localMinAge, setLocalMinAge] = useState(minAge);
  const [localMaxAge, setLocalMaxAge] = useState(maxAge);

  // Sincronizar estado local cuando cambian las props (desde la BD)
  useEffect(() => {
    setLocalMinAge(minAge);
    setLocalMaxAge(maxAge);
  }, [minAge, maxAge]);

  // Generar array de edades disponibles (web)
  const ageOptions = useMemo(() => {
    const options: number[] = [];
    for (let i = MIN_AGE; i <= MAX_AGE; i++) {
      options.push(i);
    }
    return options;
  }, []);

  // Filtrar opciones para web
  const minAgeOptions = useMemo(() => {
    return ageOptions.filter((age) => age <= maxAge);
  }, [ageOptions, maxAge]);

  const maxAgeOptions = useMemo(() => {
    return ageOptions.filter((age) => age >= minAge);
  }, [ageOptions, minAge]);

  const handleMinAgeChange = (value: number) => {
    if (!disabled) {
      onRangeChange(value, maxAge);
    }
  };

  const handleMaxAgeChange = (value: number) => {
    if (!disabled) {
      onRangeChange(minAge, value);
    }
  };

  // Uso de slider nativo para iOS/Android
  if (Platform.OS !== 'web') {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.sliderContainer}>
          <MultiSlider
            values={[localMinAge, localMaxAge]}
            min={MIN_AGE}
            max={MAX_AGE}
            step={1}
            enabledOne={!disabled}
            enabledTwo={!disabled}
            allowOverlap={false}
            snapped
            onValuesChange={(values) => {
              if (disabled) return;
              const [min, max] = values as [number, number];
              // Actualizar estado local inmediatamente para UI fluida
              setLocalMinAge(min);
              setLocalMaxAge(max);
            }}
            onValuesChangeFinish={(values) => {
              if (disabled) return;
              const [min, max] = values as [number, number];
              // Notificar al padre con ambos valores juntos
              onRangeChange(min, max);
            }}
            selectedStyle={{
              backgroundColor: '#e91e63', // Color coral de wodates
            }}
            unselectedStyle={{
              backgroundColor: '#e0e0e0', // Gris claro para la parte no seleccionada
            }}
            markerStyle={{
              backgroundColor: '#e91e63', // Color coral de wodates
              height: 24,
              width: 24,
              borderRadius: 12,
              borderWidth: 2,
              borderColor: '#fff',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 3.84,
              elevation: 5,
            }}
            trackStyle={{
              height: 4,
              borderRadius: 2,
            }}
          />
        </View>

        <View style={styles.rangeDisplay}>
          <Text style={styles.rangeText}>{`Rango: ${localMinAge} - ${localMaxAge} años`}</Text>
        </View>
      </View>
    );
  }

  // Web: mantener pickers actuales
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
          {`Rango: ${minAge} - ${maxAge} años`}
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
  sliderContainer: {
    paddingHorizontal: 8,
    paddingVertical: 8,
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

