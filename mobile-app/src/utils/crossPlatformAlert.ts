import { Alert, Platform } from 'react-native';

type AlertButton = { text: string; onPress?: () => void };

/**
 * Last-resort alert that works on RN Web when native Alert is missing.
 * Prefer `notifyActionable` / `notifySystem` from `notificationService` for user-facing
 * messages: they use in-app toasts on web and avoid `window.alert`.
 */
export function showCrossPlatformAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[]
): void {
  const lines = [title, message]
    .filter((x): x is string => typeof x === 'string')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const body = lines.join('\n\n') || '—';

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(body);
    const first = buttons?.[0];
    if (first?.onPress) {
      first.onPress();
    }
    return;
  }

  if (buttons?.length) {
    Alert.alert(title, message ?? '', [
      ...buttons.map((b) => ({
        text: b.text,
        onPress: b.onPress,
      })),
    ]);
    return;
  }

  Alert.alert(title, message ?? '');
}
