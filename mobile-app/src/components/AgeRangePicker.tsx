import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
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

  // Web: Range slider con dos handles usando HTML5 inputs
  return (
    <View style={[styles.container, style]}>
      <View style={styles.webSliderContainer}>
        <WebRangeSlider
          minAge={localMinAge}
          maxAge={localMaxAge}
          onRangeChange={(min, max) => {
            if (disabled) return;
            setLocalMinAge(min);
            setLocalMaxAge(max);
            onRangeChange(min, max);
          }}
          disabled={disabled}
        />
      </View>

      <View style={styles.rangeDisplay}>
        <Text style={styles.rangeText}>
          {`Rango: ${localMinAge} - ${localMaxAge} años`}
        </Text>
      </View>
    </View>
  );
};

// Componente web específico para el range slider
const WebRangeSlider: React.FC<{
  minAge: number;
  maxAge: number;
  onRangeChange: (min: number, max: number) => void;
  disabled: boolean;
}> = ({ minAge, maxAge, onRangeChange, disabled }) => {
  const [localMin, setLocalMin] = useState(minAge);
  const [localMax, setLocalMax] = useState(maxAge);

  // Inyectar estilos CSS cuando el componente se monte en web
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const styleId = 'age-range-slider-styles';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          .range-input {
            -webkit-appearance: none;
            appearance: none;
            width: 100%;
            height: 40px;
            background: transparent;
            pointer-events: none;
            outline: none;
            margin: 0;
            padding: 0;
          }

          .range-input::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: #e91e63;
            border: 2px solid #fff;
            cursor: pointer;
            pointer-events: all;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            transition: transform 0.1s ease, box-shadow 0.1s ease;
            margin-top: -11px;
          }

          .range-input::-webkit-slider-thumb:hover {
            transform: scale(1.1);
            box-shadow: 0 3px 6px rgba(0, 0, 0, 0.3);
          }

          .range-input::-webkit-slider-thumb:active {
            transform: scale(1.15);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
          }

          .range-input::-moz-range-thumb {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: #e91e63;
            border: 2px solid #fff;
            cursor: pointer;
            pointer-events: all;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            transition: transform 0.1s ease, box-shadow 0.1s ease;
          }

          .range-input::-moz-range-thumb:hover {
            transform: scale(1.1);
            box-shadow: 0 3px 6px rgba(0, 0, 0, 0.3);
          }

          .range-input::-moz-range-thumb:active {
            transform: scale(1.15);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
          }

          .range-input::-webkit-slider-runnable-track {
            width: 100%;
            height: 4px;
            background: transparent;
            margin: 18px 0;
          }

          .range-input::-moz-range-track {
            width: 100%;
            height: 4px;
            background: transparent;
            margin: 18px 0;
          }

          .range-input:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .range-input:disabled::-webkit-slider-thumb {
            cursor: not-allowed;
          }

          .range-input:disabled::-moz-range-thumb {
            cursor: not-allowed;
          }
        `;
        document.head.appendChild(style);
      }
    }
  }, []);

  useEffect(() => {
    setLocalMin(minAge);
    setLocalMax(maxAge);
  }, [minAge, maxAge]);

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    const newMin = Math.min(value, localMax);
    setLocalMin(newMin);
    onRangeChange(newMin, localMax);
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    const newMax = Math.max(value, localMin);
    setLocalMax(newMax);
    onRangeChange(localMin, newMax);
  };

  // Calcular el porcentaje para el track activo
  const minPercent = ((localMin - MIN_AGE) / (MAX_AGE - MIN_AGE)) * 100;
  const maxPercent = ((localMax - MIN_AGE) / (MAX_AGE - MIN_AGE)) * 100;

  return (
    <div style={webStyles.sliderWrapper}>
      <div style={webStyles.trackContainer}>
        <div style={webStyles.trackBackground} />
        <div
          style={{
            ...webStyles.trackActive,
            left: `${minPercent}%`,
            width: `${maxPercent - minPercent}%`,
          }}
        />
      </div>
      <input
        type="range"
        min={MIN_AGE}
        max={MAX_AGE}
        value={localMin}
        onChange={handleMinChange}
        disabled={disabled}
        style={webStyles.input}
        className="range-input range-input-min"
      />
      <input
        type="range"
        min={MIN_AGE}
        max={MAX_AGE}
        value={localMax}
        onChange={handleMaxChange}
        disabled={disabled}
        style={webStyles.input}
        className="range-input range-input-max"
      />
    </div>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  sliderContainer: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  webSliderContainer: {
    paddingHorizontal: 8,
    paddingVertical: 16,
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

// Estilos web usando objetos de estilo inline (compatibles con React Native Web)
const webStyles: { [key: string]: React.CSSProperties } = {
  sliderWrapper: {
    position: 'relative',
    width: '100%',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    padding: '0 8px',
  },
  trackContainer: {
    position: 'absolute',
    width: 'calc(100% - 16px)',
    height: '4px',
    backgroundColor: '#e0e0e0',
    borderRadius: '2px',
    top: '50%',
    left: '8px',
    transform: 'translateY(-50%)',
  },
  trackBackground: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: '#e0e0e0',
    borderRadius: '2px',
  },
  trackActive: {
    position: 'absolute',
    height: '100%',
    backgroundColor: '#e91e63',
    borderRadius: '2px',
    top: 0,
  },
  input: {
    position: 'absolute',
    width: 'calc(100% - 16px)',
    height: '40px',
    background: 'transparent',
    pointerEvents: 'none',
    WebkitAppearance: 'none',
    appearance: 'none',
    outline: 'none',
    left: '8px',
    top: '50%',
    transform: 'translateY(-50%)',
    margin: 0,
    padding: 0,
  },
};

