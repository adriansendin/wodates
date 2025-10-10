import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  Dimensions,
} from 'react-native';

interface RangeSliderProps {
  min: number;
  max: number;
  minValue: number;
  maxValue: number;
  onValueChange: (minValue: number, maxValue: number) => void;
  step?: number;
  disabled?: boolean;
  style?: any;
}

export const RangeSlider: React.FC<RangeSliderProps> = ({
  min,
  max,
  minValue,
  maxValue,
  onValueChange,
  step = 1,
  disabled = false,
  style,
}) => {
  const [sliderWidth, setSliderWidth] = useState(0);
  const [isDraggingMin, setIsDraggingMin] = useState(false);
  const [isDraggingMax, setIsDraggingMax] = useState(false);
  
  const minHandleRef = useRef<View>(null);
  const maxHandleRef = useRef<View>(null);

  const getPercentage = (value: number) => {
    return ((value - min) / (max - min)) * 100;
  };

  const getValueFromPercentage = (percentage: number) => {
    const value = min + (percentage / 100) * (max - min);
    return Math.round(value / step) * step;
  };

  const getValueFromPosition = (x: number) => {
    const percentage = Math.max(0, Math.min(100, (x / sliderWidth) * 100));
    return Math.max(min, Math.min(max, getValueFromPercentage(percentage)));
  };

  const minPanResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => !disabled,
    onMoveShouldSetPanResponder: () => !disabled,
    onPanResponderGrant: () => {
      setIsDraggingMin(true);
    },
    onPanResponderMove: (evt, gestureState) => {
      const newValue = getValueFromPosition(gestureState.moveX);
      const minAllowedValue = Math.max(min, Math.min(newValue, maxValue));
      onValueChange(minAllowedValue, maxValue);
    },
    onPanResponderRelease: () => {
      setIsDraggingMin(false);
    },
  });

  const maxPanResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => !disabled,
    onMoveShouldSetPanResponder: () => !disabled,
    onPanResponderGrant: () => {
      setIsDraggingMax(true);
    },
    onPanResponderMove: (evt, gestureState) => {
      const newValue = getValueFromPosition(gestureState.moveX);
      const maxAllowedValue = Math.min(max, Math.max(newValue, minValue));
      onValueChange(minValue, maxAllowedValue);
    },
    onPanResponderRelease: () => {
      setIsDraggingMax(false);
    },
  });

  const minPercentage = getPercentage(minValue);
  const maxPercentage = getPercentage(maxValue);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.labels}>
        <Text style={styles.label}>{minValue}</Text>
        <Text style={styles.label}>{maxValue}</Text>
      </View>
      
      <View
        style={styles.sliderContainer}
        onLayout={(event) => {
          setSliderWidth(event.nativeEvent.layout.width);
        }}
      >
        {/* Track background */}
        <View style={styles.track} />
        
        {/* Active range */}
        <View
          style={[
            styles.activeTrack,
            {
              left: `${minPercentage}%`,
              width: `${maxPercentage - minPercentage}%`,
            },
          ]}
        />
        
        {/* Min handle */}
        <View
          ref={minHandleRef}
          style={[
            styles.handle,
            styles.minHandle,
            isDraggingMin && styles.handleActive,
            { left: `${minPercentage}%` },
          ]}
          {...minPanResponder.panHandlers}
        >
          <View style={styles.handleInner} />
        </View>
        
        {/* Max handle */}
        <View
          ref={maxHandleRef}
          style={[
            styles.handle,
            styles.maxHandle,
            isDraggingMax && styles.handleActive,
            { left: `${maxPercentage}%` },
          ]}
          {...maxPanResponder.panHandlers}
        >
          <View style={styles.handleInner} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e91e63',
    minWidth: 30,
    textAlign: 'center',
  },
  sliderContainer: {
    height: 40,
    justifyContent: 'center',
    position: 'relative',
    paddingHorizontal: 16, // Espacio para que las bolas no se salgan
  },
  track: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    position: 'absolute',
    left: 16,
    right: 16,
  },
  activeTrack: {
    height: 4,
    backgroundColor: '#e91e63',
    borderRadius: 2,
    position: 'absolute',
    top: 0,
    left: 16, // Ajustar para el padding
  },
  handle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e91e63',
    position: 'absolute',
    top: -10,
    marginLeft: -12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  handleInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#e91e63',
  },
  minHandle: {
    // Additional styles for min handle if needed
  },
  maxHandle: {
    // Additional styles for max handle if needed
  },
  handleActive: {
    transform: [{ scale: 1.1 }],
    borderColor: '#c2185b',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
});