import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

const MANIFESTO_EMAIL = 'hello@wodates.com';
const MAILTO_URI = `mailto:${MANIFESTO_EMAIL}`;

export default function Manifesto() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const BLOCK_A = useMemo(
    () => [
      t('manifesto.datingNotCasino'),
      t('manifesto.connectionNotAlgorithms'),
      t('manifesto.deserveToKnow'),
      t('manifesto.deserveFocus'),
    ],
    [t]
  );
  const BLOCK_B = useMemo(
    () => [
      t('manifesto.oneConversation'),
      t('manifesto.affinityFromDialogue'),
      t('manifesto.radicalTransparency'),
      t('manifesto.peopleOverMetrics'),
    ],
    [t]
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <View style={[styles.container, { paddingTop: Math.max(insets.top, 8), paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backTouchable} activeOpacity={0.7}>
            <Text style={styles.backText}>{t('manifesto.back')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>{t('manifesto.title')}</Text>

          <View style={styles.manifestoBlocks}>
            <View style={styles.bodyBlock}>
              <Text style={styles.bodyLineAnchor}>{BLOCK_A[0]}</Text>
              {BLOCK_A.slice(1).map((line, index) => (
                <Text key={index} style={styles.bodyLine}>{line}</Text>
              ))}
            </View>
            <View style={styles.blockSeparator} />
            <View style={styles.bodyBlock}>
              {BLOCK_B.map((line, index) => (
                <Text key={index} style={styles.bodyLine}>{line}</Text>
              ))}
            </View>
          </View>

          <View style={styles.separatorBeforeFooter} />
          <View style={styles.footerBlock}>
            <Text style={styles.brandName}>WODATES</Text>
            <Text style={styles.tagline}>{t('manifesto.taglineAffinity')}</Text>
            <Text style={styles.tagline}>{t('manifesto.taglineOneConversation')}</Text>
          </View>

          <View style={styles.separatorBeforeEmail} />
          <TouchableOpacity
            onPress={() => Linking.openURL(MAILTO_URI)}
            activeOpacity={0.7}
            style={styles.emailLink}
          >
            <Text style={styles.emailText}>{MANIFESTO_EMAIL}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingHorizontal: 32,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingVertical: 4,
    marginBottom: 12,
  },
  backTouchable: {
    paddingVertical: 4,
    paddingLeft: 0,
    paddingRight: 12,
  },
  backText: {
    fontSize: 14,
    color: '#6B6B6B',
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333333',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  manifestoBlocks: {
    alignItems: 'center',
    maxWidth: 320,
  },
  bodyBlock: {
    alignItems: 'center',
    gap: 6,
  },
  blockSeparator: {
    height: 20,
  },
  bodyLineAnchor: {
    fontSize: 16,
    color: '#6B6B6B',
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 22,
  },
  separatorBeforeFooter: {
    height: 20,
  },
  bodyLine: {
    fontSize: 16,
    color: '#6B6B6B',
    textAlign: 'center',
    fontWeight: '400',
    lineHeight: 22,
  },
  separatorBeforeEmail: {
    height: 24,
  },
  footerBlock: {
    alignItems: 'center',
    gap: 4,
  },
  brandName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F45C5C',
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    fontWeight: '400',
  },
  emailLink: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    alignItems: 'center',
    alignSelf: 'center',
  },
  emailText: {
    fontSize: 13,
    color: '#8A8A8A',
    fontWeight: '400',
  },
});
