import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Stack,
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from 'expo-router';
import { useTranslation } from 'react-i18next';

import {
  TOTAL_ONBOARDING_BLOCKS,
  DeepOnboardingQuestionControls,
  onboardingBlockStyles,
} from '../../src/components/deep-onboarding/onboardingQuestionControls';
import { ApiClient } from '../../src/data/api/apiClient';
import { DeepOnboardingApi } from '../../src/data/api/deepOnboardingApi';
import { useAuthStore } from '../../src/domain/stores/authStore';
import { useDeepOnboardingStore } from '../../src/domain/stores/deepOnboardingStore';
import { getApiUrl } from '../../src/utils/apiConfig';
import { notifyActionable } from '../../src/utils/notificationService';

const TOTAL_BLOCKS = TOTAL_ONBOARDING_BLOCKS;
const styles = onboardingBlockStyles;

export default function DeepOnboardingBlockScreen() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ block: string }>();
  const rawBlock = Array.isArray(params.block) ? params.block[0] : params.block;
  const blockNum = Number(rawBlock);

  const user = useAuthStore((s) => s.user);
  const form = useDeepOnboardingStore((s) => s.form);
  const formLoading = useDeepOnboardingStore((s) => s.formLoading);
  const formError = useDeepOnboardingStore((s) => s.formError);
  const bootstrap = useDeepOnboardingStore((s) => s.bootstrap);

  const singleByCode = useDeepOnboardingStore((s) => s.singleByCode);
  const multiByCode = useDeepOnboardingStore((s) => s.multiByCode);
  const multiOtherNested = useDeepOnboardingStore((s) => s.multiOtherNested);
  const textByCode = useDeepOnboardingStore((s) => s.textByCode);

  const setSingle = useDeepOnboardingStore((s) => s.setSingle);
  const toggleMulti = useDeepOnboardingStore((s) => s.toggleMulti);
  const setMultiOther = useDeepOnboardingStore((s) => s.setMultiOther);
  const setText = useDeepOnboardingStore((s) => s.setText);
  const validateBlock = useDeepOnboardingStore((s) => s.validateBlock);
  const buildAnswersForBlock = useDeepOnboardingStore(
    (s) => s.buildAnswersForBlock
  );
  const getBlock = useDeepOnboardingStore((s) => s.getBlock);

  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const api = useMemo(
    () => new DeepOnboardingApi(new ApiClient(getApiUrl())),
    []
  );

  useEffect(() => {
    if (!Number.isFinite(blockNum) || blockNum < 1 || blockNum > TOTAL_BLOCKS) {
      router.replace('/');
    }
  }, [blockNum, router]);

  useLayoutEffect(() => {
    if (!Number.isFinite(blockNum) || blockNum < 1 || blockNum > TOTAL_BLOCKS) {
      return;
    }
    navigation.setOptions({
      title: t('deepOnboarding.blockTitle', {
        current: blockNum,
        total: TOTAL_BLOCKS,
      }),
      headerLeft:
        blockNum === 1
          ? () => (
              <TouchableOpacity
                onPress={() => router.replace('/')}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
              >
                <Text style={styles.headerBack}>{t('common.back')}</Text>
              </TouchableOpacity>
            )
          : undefined,
    });
  }, [navigation, blockNum, t, router]);

  const block = getBlock(blockNum);

  const handleContinue = async () => {
    setFeedback(null);

    const validation = validateBlock(blockNum);
    if (validation === 'incomplete') {
      const msg = t('deepOnboarding.validationIncomplete');
      setFeedback(msg);
      notifyActionable(msg);
      return;
    }
    if (validation === 'multi_other') {
      const msg = t('deepOnboarding.validationMultiOther');
      setFeedback(msg);
      notifyActionable(msg);
      return;
    }
    if (validation === 'text_too_long') {
      const msg = t('deepOnboarding.validationTextLength');
      setFeedback(msg);
      notifyActionable(msg);
      return;
    }

    const sessionId = useDeepOnboardingStore.getState().clientSessionId;
    if (!sessionId) {
      const msg = t('deepOnboarding.loadError');
      setFeedback(msg);
      notifyActionable(msg);
      void bootstrap();
      return;
    }

    const answers = buildAnswersForBlock(blockNum);
    setIsSaving(true);
    try {
      const result = await api.submit({
        clientSessionId: sessionId,
        userId: user?.id ?? null,
        answers,
      });

      if (!result.success) {
        const detail =
          result.error.message?.trim() || t('deepOnboarding.saveError');
        setFeedback(detail);
        notifyActionable(t('deepOnboarding.saveError'), detail);
        return;
      }

      if (blockNum >= TOTAL_BLOCKS) {
        router.replace('/deep-onboarding/create-account');
        return;
      }

      router.push({
        pathname: '/deep-onboarding/[block]',
        params: { block: String(blockNum + 1) },
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!Number.isFinite(blockNum) || blockNum < 1 || blockNum > TOTAL_BLOCKS) {
    return null;
  }

  if (formLoading && !form) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true }} />
        <SafeAreaView style={styles.centered}>
          <ActivityIndicator size="large" color="#F45C5C" />
          <Text style={styles.muted}>{t('deepOnboarding.loading')}</Text>
        </SafeAreaView>
      </>
    );
  }

  if (formError || !form || !block) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true }} />
        <SafeAreaView style={styles.centered}>
          <Text style={styles.errorText}>{t('deepOnboarding.loadError')}</Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => void bootstrap()}
          >
            <Text style={styles.primaryBtnText}>
              {t('deepOnboarding.retry')}
            </Text>
          </TouchableOpacity>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.intro}>{block.introText}</Text>

          {block.questions.map((q) => (
            <View key={q.code} style={styles.questionBlock}>
              <Text style={styles.prompt}>{q.promptText}</Text>
              <DeepOnboardingQuestionControls
                question={q}
                singleByCode={singleByCode}
                multiByCode={multiByCode}
                multiOtherNested={multiOtherNested}
                textByCode={textByCode}
                setSingle={setSingle}
                toggleMulti={toggleMulti}
                setMultiOther={setMultiOther}
                setText={setText}
              />
            </View>
          ))}

          {feedback ? (
            <Text style={styles.feedbackError} accessibilityLiveRegion="polite">
              {feedback}
            </Text>
          ) : null}

          <TouchableOpacity
            style={[
              styles.primaryBtn,
              styles.cta,
              isSaving && styles.ctaDisabled,
            ]}
            onPress={() => void handleContinue()}
            disabled={isSaving}
            activeOpacity={0.85}
          >
            {isSaving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {blockNum >= TOTAL_BLOCKS
                  ? t('deepOnboarding.finish')
                  : t('deepOnboarding.continue')}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
