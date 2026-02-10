import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MATCHMAKER_EMAIL = 'adriansendin@wodates.com';
const MAILTO_URI = `mailto:${MATCHMAKER_EMAIL}`;

export default function IntroMatchmaker() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <View style={[styles.container, { paddingTop: Math.max(insets.top, 12), paddingBottom: Math.max(insets.bottom, 24) }]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backTouchable} activeOpacity={0.7}>
            <Text style={styles.backText}>← Back to Wodates</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* Logo: same as main page */}
          <View style={styles.logoContainer}>
            <Image
              source={require('../assets/icon.png')}
              style={styles.logoIcon}
              resizeMode="contain"
            />
            <Text style={styles.logoText}>Wodates</Text>
          </View>

          <Text style={styles.headline}>
            We help matchmakers understand real affinity between people, based on how they communicate.
          </Text>

          <View style={styles.emailCtaBlock}>
            <Text style={styles.emailCtaLabel}>Email us:</Text>
            <TouchableOpacity
              style={styles.emailCtaButton}
              onPress={() => Linking.openURL(MAILTO_URI)}
              activeOpacity={0.7}
            >
              <Text style={styles.emailCtaButtonText}>{MATCHMAKER_EMAIL}</Text>
            </TouchableOpacity>
          </View>
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
    paddingVertical: 8,
    marginBottom: 24,
  },
  backTouchable: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  backText: {
    fontSize: 16,
    color: '#F45C5C',
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
  },
  logoContainer: {
    alignItems: 'center',
    gap: 16,
  },
  logoIcon: {
    width: 80,
    height: 80,
  },
  logoText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#F45C5C',
    letterSpacing: -0.5,
  },
  headline: {
    fontSize: 18,
    color: '#6B6B6B',
    textAlign: 'center',
    fontWeight: '400',
    lineHeight: 26,
    maxWidth: 320,
  },
  emailCtaBlock: {
    alignItems: 'center',
    gap: 8,
  },
  emailCtaLabel: {
    fontSize: 15,
    color: '#6B6B6B',
    fontWeight: '500',
  },
  emailCtaButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#F45C5C',
    backgroundColor: 'transparent',
  },
  emailCtaButtonText: {
    fontSize: 16,
    color: '#F45C5C',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
