import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { DeepOnboardingQuestionDto } from '../../data/api/deepOnboardingApi';

export const TOTAL_ONBOARDING_BLOCKS = 4;

export function DeepOnboardingQuestionControls({
  question,
  singleByCode,
  multiByCode,
  multiOtherNested,
  textByCode,
  setSingle,
  toggleMulti,
  setMultiOther,
  setText,
}: {
  question: DeepOnboardingQuestionDto;
  singleByCode: Record<string, string>;
  multiByCode: Record<string, string[]>;
  multiOtherNested: Record<string, Record<string, string>>;
  textByCode: Record<string, string>;
  setSingle: (code: string, key: string) => void;
  toggleMulti: (code: string, key: string, maxSelections: number) => void;
  setMultiOther: (code: string, optionKey: string, value: string) => void;
  setText: (code: string, value: string) => void;
}) {
  const { t } = useTranslation('common');

  if (question.answerType === 'single' && question.options) {
    const selected = singleByCode[question.code];
    return (
      <View style={styles.optionsCol}>
        {question.options.map((opt) => {
          const isSelected = selected === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.optionRow, isSelected && styles.optionRowSelected]}
              onPress={() => setSingle(question.code, opt.key)}
              activeOpacity={0.85}
            >
              <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                {isSelected ? <View style={styles.radioInner} /> : null}
              </View>
              <Text style={styles.optionLabel}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  if (question.answerType === 'multi' && question.options && question.maxSelections != null) {
    const selected = multiByCode[question.code] ?? [];
    const maxSel = question.maxSelections;
    return (
      <View style={styles.optionsCol}>
        <Text style={styles.multiHint}>
          ({selected.length}/{maxSel})
        </Text>
        {question.options.map((opt) => {
          const isSelected = selected.includes(opt.key);
          return (
            <View key={opt.key}>
              <TouchableOpacity
                style={[styles.optionRow, isSelected && styles.optionRowSelected]}
                onPress={() => toggleMulti(question.code, opt.key, maxSel)}
                activeOpacity={0.85}
              >
                <View style={[styles.checkboxOuter, isSelected && styles.checkboxOuterSelected]}>
                  {isSelected ? <Text style={styles.checkMark}>✓</Text> : null}
                </View>
                <Text style={styles.optionLabel}>{opt.label}</Text>
              </TouchableOpacity>
              {isSelected && opt.key.startsWith('other_') ? (
                <TextInput
                  style={styles.otherInput}
                  placeholder={t('deepOnboarding.otherDetailPlaceholder')}
                  placeholderTextColor="#999"
                  value={multiOtherNested[question.code]?.[opt.key] ?? ''}
                  onChangeText={(txt) => setMultiOther(question.code, opt.key, txt)}
                  multiline
                />
              ) : null}
            </View>
          );
        })}
      </View>
    );
  }

  if (question.answerType === 'text') {
    const max = question.maxChars ?? 5000;
    const val = textByCode[question.code] ?? '';
    return (
      <>
        <TextInput
          style={styles.textArea}
          multiline
          value={val}
          maxLength={max}
          onChangeText={(txt) => setText(question.code, txt)}
          placeholderTextColor="#999"
        />
        <Text style={styles.charCounter}>
          {t('deepOnboarding.charactersCount', { used: val.length, max })}
        </Text>
      </>
    );
  }

  return null;
}

export const onboardingBlockStyles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f8f9fa' },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f8f9fa',
    gap: 16,
  },
  muted: { marginTop: 12, color: '#6B6B6B', fontSize: 15 },
  errorText: { color: '#c62828', textAlign: 'center', fontSize: 16 },
  headerBack: { color: '#F45C5C', fontSize: 17, fontWeight: '600', marginLeft: 8 },
  intro: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
    marginBottom: 20,
  },
  questionBlock: {
    marginBottom: 28,
  },
  prompt: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
    lineHeight: 24,
  },
  optionsCol: { gap: 10 },
  multiHint: { fontSize: 13, color: '#666', marginBottom: 4 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    marginTop: 2,
  },
  radioOuterSelected: { borderColor: '#F45C5C' },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#F45C5C',
  },
  checkboxOuter: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxOuterSelected: { borderColor: '#F45C5C', backgroundColor: '#F45C5C' },
  checkMark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  optionLabel: {
    flex: 1,
    fontSize: 16,
    color: '#222',
    lineHeight: 22,
  },
  otherInput: {
    marginTop: 8,
    marginLeft: 34,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    minHeight: 72,
    textAlignVertical: 'top',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    minHeight: 120,
    backgroundColor: '#fff',
    textAlignVertical: 'top',
    color: '#1a1a1a',
  },
  charCounter: {
    alignSelf: 'flex-end',
    marginTop: 6,
    fontSize: 13,
    color: '#888',
  },
  feedbackError: {
    color: '#c62828',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
    marginTop: 4,
  },
  primaryBtn: {
    backgroundColor: '#F45C5C',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  cta: {
    marginTop: 24,
    marginBottom: 12,
  },
  ctaDisabled: { opacity: 0.65 },
});

const styles = onboardingBlockStyles;
