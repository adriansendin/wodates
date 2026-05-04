import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

type Props = {
  description: string;
  optionalHint: string;
  footnote: string;
  values: [string, string, string];
  onChange: (next: [string, string, string]) => void;
  fieldError?: string | null;
  /** i18n placeholder for each slot */
  inputPlaceholder: string;
};

export function SocialInterestCodesFormBlock({
  description,
  optionalHint,
  footnote,
  values,
  onChange,
  fieldError,
  inputPlaceholder,
}: Props) {
  const setSlot = (index: 0 | 1 | 2, text: string) => {
    const next: [string, string, string] = [values[0], values[1], values[2]];
    next[index] = text;
    onChange(next);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.optionalTag}>{optionalHint}</Text>
      <Text style={styles.description}>{description}</Text>

      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.inputWrap}>
          <TextInput
            style={[styles.input, fieldError ? styles.inputError : null]}
            value={values[i]}
            onChangeText={(t) => setSlot(i as 0 | 1 | 2, t)}
            placeholder={inputPlaceholder}
            placeholderTextColor="#999"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={48}
          />
        </View>
      ))}

      {fieldError ? <Text style={styles.error}>{fieldError}</Text> : null}

      <Text style={styles.footnote}>{footnote}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    marginBottom: 8,
  },
  optionalTag: {
    fontSize: 13,
    color: '#7F8C8D',
    marginBottom: 8,
    fontWeight: '500',
  },
  description: {
    fontSize: 15,
    color: '#34495E',
    lineHeight: 22,
    marginBottom: 12,
  },
  inputWrap: {
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: '#2C3E50',
  },
  inputError: {
    borderColor: '#E74C3C',
  },
  error: {
    color: '#E74C3C',
    fontSize: 13,
    marginBottom: 8,
    lineHeight: 18,
  },
  footnote: {
    marginTop: 4,
    fontSize: 13,
    color: '#7F8C8D',
    lineHeight: 19,
  },
});
