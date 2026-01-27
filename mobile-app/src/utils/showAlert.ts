import { notifyActionable, notifySystem } from './notificationService';
import { Alert } from 'react-native';

type AlertParams = Parameters<typeof Alert.alert>;

/**
 * @deprecated Use notifyActionable or notifySystem from notificationService instead.
 * This function is kept for backward compatibility but will be removed.
 *
 * Legacy wrapper that delegates all logic to notificationService.
 * No UI logic or store access here - everything goes through the centralized service.
 */
export const showAlert = (...args: AlertParams): void => {
  const [title, message, buttons] = args;

  // If buttons are provided, check for retry button
  if (buttons && buttons.length > 0) {
    // Look for a "Retry" or "Reintentar" button
    const retryButton = buttons.find(
      (b) =>
        b.text?.toLowerCase().includes('retry') ||
        b.text?.toLowerCase().includes('reintentar')
    );

    if (retryButton?.onPress) {
      // System error with retry - delegate to notificationService
      // Pass original title/message as debug for dev traceability
      notifySystem(
        'Something went wrong',
        'Try again',
        { originalTitle: title, originalMessage: message },
        retryButton.onPress
      );
      return;
    }

    // Other buttons (e.g., option selection) - treat as actionable
    // Note: For true option selection dialogs, consider using Alert.alert directly
    // This wrapper is for error notifications, not UI dialogs
    notifyActionable(title, message || 'Action required');
    return;
  }

  // No buttons: default to system error with generic message
  // This prevents accidentally showing technical error messages as actionable
  notifySystem('Something went wrong', 'Try again', {
    originalTitle: title,
    originalMessage: message,
  });
};
