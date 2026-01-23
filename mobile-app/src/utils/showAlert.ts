import { Platform, Alert } from 'react-native';
import { notifyError, notifyWithButtons } from './notify';

type AlertParams = Parameters<typeof Alert.alert>;

/**
 * @deprecated Use notifyError, notifySuccess, or notifyInfo instead.
 * This function is kept for backward compatibility but will be removed.
 * 
 * On web: Shows in-app toast (no browser popup).
 * On native: Uses Alert.alert.
 */
export const showAlert = (...args: AlertParams): void => {
  const [title, message, buttons, options] = args;

  // If buttons are provided, use notifyWithButtons
  if (buttons && buttons.length > 0) {
    notifyWithButtons(title, message, buttons, options);
    return;
  }

  // Otherwise, treat as error notification
  // On web: toast only (no Alert.alert, no window.alert)
  // On native: Alert.alert
  if (Platform.OS === 'web') {
    notifyError(title, message);
  } else {
    // On native, we can use Alert.alert for backward compatibility
    Alert.alert(title, message);
  }
};
