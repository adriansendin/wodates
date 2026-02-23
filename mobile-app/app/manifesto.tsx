import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MANIFESTO_EMAIL = 'hello@wodates.com';
const MAILTO_URI = `mailto:${MANIFESTO_EMAIL}`;

const BLOCK_A = [
  'Dating is not a casino.',
  'Connection should not depend on secret algorithms.',
  "You deserve to know why you're seeing someone.",
  'You deserve focus. Not infinite options.',
];
const BLOCK_B = [
  'One conversation at a time.',
  'Affinity built from real dialogue.',
  'Radical transparency.',
  'People over engagement metrics.',
];

export default function Manifesto() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <View style={[styles.container, { paddingTop: Math.max(insets.top, 8), paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.replace('/')} style={styles.backTouchable} activeOpacity={0.7}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>Wodates Manifesto</Text>

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
            <Text style={styles.tagline}>Dating by affinity. Not by volume.</Text>
            <Text style={styles.tagline}>One conversation at a time.</Text>
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
