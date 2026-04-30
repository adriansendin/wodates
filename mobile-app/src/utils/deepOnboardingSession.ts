import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'deep_onboarding_client_session_v1';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Align local session id with the server-linked session after login load. */
export async function setStoredDeepOnboardingSessionId(id: string): Promise<void> {
  if (!UUID_RE.test(id)) {
    throw new Error('[deepOnboardingSession] Invalid client session UUID');
  }
  await AsyncStorage.setItem(STORAGE_KEY, id);
}

function randomUuidV4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Stable anonymous id for deep onboarding submissions (persisted per install). */
export async function getOrCreateDeepOnboardingSessionId(): Promise<string> {
  const existing = await AsyncStorage.getItem(STORAGE_KEY);
  if (existing && UUID_RE.test(existing)) {
    return existing;
  }
  const id = randomUuidV4();
  await AsyncStorage.setItem(STORAGE_KEY, id);
  return id;
}
