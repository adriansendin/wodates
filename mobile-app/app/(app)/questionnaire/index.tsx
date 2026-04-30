import { useMemo } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import {
  TOTAL_ONBOARDING_BLOCKS,
} from '../../../src/components/deep-onboarding/onboardingQuestionControls';
import { useDeepOnboardingStore } from '../../../src/domain/stores/deepOnboardingStore';

type HubCard = { title: string; subtitle: string };

export default function QuestionnaireHubScreen() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const form = useDeepOnboardingStore((s) => s.form);
  const formLoading = useDeepOnboardingStore((s) => s.formLoading);
  const formError = useDeepOnboardingStore((s) => s.formError);
  const bootstrap = useDeepOnboardingStore((s) => s.bootstrap);

  const hubCards = useMemo(() => {
    const raw = t('questionnaire.hubCards', { returnObjects: true });
    if (!Array.isArray(raw)) return [] as HubCard[];
    return raw.filter(
      (item): item is HubCard =>
        !!item &&
        typeof item === 'object' &&
        typeof (item as HubCard).title === 'string' &&
        typeof (item as HubCard).subtitle === 'string'
    );
  }, [t]);

  if (formLoading && !form) {
    return (
      <SafeAreaView style={styles.centered} edges={['top', 'bottom', 'left', 'right']}>
        <ActivityIndicator size="large" color="#e91e63" />
        <Text style={styles.muted}>{t('deepOnboarding.loading')}</Text>
      </SafeAreaView>
    );
  }

  if (formError || !form) {
    return (
      <SafeAreaView style={styles.centered} edges={['top', 'bottom', 'left', 'right']}>
        <Text style={styles.error}>{t('deepOnboarding.loadError')}</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => void bootstrap()}>
          <Text style={styles.primaryBtnText}>{t('deepOnboarding.retry')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.flex} edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lead}>{t('questionnaire.hubSubtitle')}</Text>

        {hubCards.slice(0, TOTAL_ONBOARDING_BLOCKS).map((card, idx) => {
          const blockNum = idx + 1;
          return (
            <TouchableOpacity
              key={blockNum}
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: '/questionnaire/[block]',
                  params: { block: String(blockNum) },
                })
              }
              activeOpacity={0.88}
            >
              <View style={styles.cardMain}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{blockNum}</Text>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{card.title}</Text>
                  <Text style={styles.cardSubtitle}>{card.subtitle}</Text>
                </View>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          );
        })}

        <Text style={styles.hubFooter}>{t('questionnaire.hubFooter')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f8f9fa' },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 12,
  },
  lead: {
    fontSize: 16,
    lineHeight: 24,
    color: '#3a3a3a',
    marginBottom: 18,
    letterSpacing: -0.2,
  },
  hubFooter: {
    fontSize: 14,
    lineHeight: 21,
    color: '#7a7a7a',
    marginTop: 28,
    letterSpacing: -0.1,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  cardMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    minWidth: 0,
  },
  badge: {
    minWidth: 28,
    paddingHorizontal: 8,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#fde8ef',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#c2185b',
    letterSpacing: -0.3,
  },
  cardBody: { flex: 1, minWidth: 0 },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 6,
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  cardSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: '#6e6e6e',
    letterSpacing: -0.1,
  },
  chevron: {
    fontSize: 22,
    color: '#d0d0d0',
    fontWeight: '300',
    paddingLeft: 4,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f8f9fa',
    gap: 16,
  },
  muted: { marginTop: 8, color: '#6B6B6B', fontSize: 15 },
  error: {
    fontSize: 16,
    color: '#c62828',
    textAlign: 'center',
  },
  primaryBtn: {
    backgroundColor: '#F45C5C',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
