import { Platform, Alert } from 'react-native';
import type { AlertButton, AlertOptions } from 'react-native';
import { useToastStore } from '../domain/stores/toastStore';
import { notifyActionable } from './notificationService';

/**
 * @deprecated Use notifyActionable or notifySystem from notificationService instead.
 * This function is kept for backward compatibility but will be removed.
 *
 * Show an error notification.
 * On native: uses Alert.alert
 * On web: uses in-app toast (no browser popup)
 */
export const notifyError = (title: string, message?: string): void => {
  // Default to actionable since most errors are user-fixable
  notifyActionable(title, message);
};

/**
 * Show a success notification.
 * On native: uses Alert.alert
 * On web: uses in-app toast (no browser popup)
 */
export const notifySuccess = (title: string, message?: string): void => {
  if (Platform.OS === 'web') {
    const store = useToastStore.getState();
    store.showToast({ type: 'success', title, message });
  } else {
    Alert.alert(title, message);
  }
};

/**
 * Show an info notification.
 * On native: uses Alert.alert
 * On web: uses in-app toast (no browser popup)
 */
export const notifyInfo = (title: string, message?: string): void => {
  if (Platform.OS === 'web') {
    const store = useToastStore.getState();
    store.showToast({ type: 'info', title, message });
  } else {
    Alert.alert(title, message);
  }
};

/**
 * @deprecated Use notifySystem with retry callback from notificationService instead.
 * This function is kept for backward compatibility but will be removed.
 *
 * Show an alert with buttons (for actions requiring user choice).
 * On native: uses Alert.alert with buttons
 * On web: shows toast only (buttons not supported, user can dismiss)
 */
export const notifyWithButtons = (
  title: string,
  message?: string,
  buttons?: AlertButton[],
  options?: AlertOptions
): void => {
  if (Platform.OS === 'web') {
    // On web, show toast only - do NOT execute any button handlers
    const store = useToastStore.getState();
    const displayMessage = message || 'Action required';
    store.showToast({
      type: 'info',
      title,
      message: displayMessage,
      duration: 6000,
    });
  } else {
    Alert.alert(title, message, buttons, options);
  }
};
