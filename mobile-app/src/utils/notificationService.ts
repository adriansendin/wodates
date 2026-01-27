import { Platform, Alert } from 'react-native';
import type { AlertButton } from 'react-native';
import { useToastStore } from '../domain/stores/toastStore';

/**
 * Type of notification error.
 * - "actionable": User can fix it (validation, wrong credentials, etc.)
 * - "system": System failure, user can only retry
 */
export type NotificationKind = 'actionable' | 'system';

/**
 * Options for showing a notification
 */
export interface NotificationOptions {
  /** Type of notification */
  kind: NotificationKind;
  /** User-friendly title */
  title: string;
  /** Optional user-friendly message */
  message?: string;
  /** Optional debug info (only logged in dev, never shown to user) */
  debug?: unknown;
  /** Optional retry callback (only for system errors) */
  retry?: () => void | Promise<void>;
}

/**
 * Determines if we're in development mode
 */
const isDev = __DEV__;

/**
 * Logs debug information in development mode only
 */
const logDebug = (title: string, debug?: unknown): void => {
  if (isDev && debug !== undefined) {
    console.error(`[Notification] ${title}`, debug);
  }
};

/**
 * Central notification service.
 *
 * PRINCIPLES:
 * - All user-facing notifications must go through this service
 * - Never show technical details to users in production
 * - Actionable errors: show clear, user-friendly messages
 * - System errors: show generic message + retry option if applicable
 * - Debug info is logged in dev but never shown to users
 *
 * @example
 * // Actionable error (user can fix)
 * notify({
 *   kind: 'actionable',
 *   title: 'Invalid email',
 *   message: 'Please enter a valid email address',
 * });
 *
 * @example
 * // System error (user can only retry)
 * notify({
 *   kind: 'system',
 *   title: 'Something went wrong',
 *   message: 'Try again',
 *   debug: error,
 *   retry: () => loadData(),
 * });
 */
export const notify = (options: NotificationOptions): void => {
  const { kind, title, message, debug, retry } = options;

  // Log debug info in dev mode (never shown to user)
  if (kind === 'system' && debug !== undefined) {
    logDebug(title, debug);
  }

  // Determine user-facing message
  let displayTitle = title;
  let displayMessage = message;

  // For system errors, ensure generic messaging
  if (kind === 'system') {
    displayTitle = 'Something went wrong';
    displayMessage = message || 'Try again';

    // In dev, optionally append indicator (but keep message clean)
    if (isDev && debug !== undefined) {
      // Log full details to console, but don't modify user message
      logDebug('System error details', { title, message, debug });
    }
  }

  // Render based on platform
  if (Platform.OS === 'web') {
    // Web: always use toast (no browser popups)
    const store = useToastStore.getState();
    const toastType =
      kind === 'system' ? 'error' : kind === 'actionable' ? 'error' : 'info';

    // For system errors with retry, show persistent toast with longer duration
    // Note: Web toasts don't support buttons, so retry must be handled elsewhere
    const duration = kind === 'system' && retry ? 8000 : 4000;

    store.showToast({
      type: toastType,
      title: displayTitle,
      message: displayMessage,
      duration,
    });

    // If retry is provided but we can't show button in toast,
    // log a note in dev that retry should be handled in UI
    if (retry && isDev) {
      console.warn(
        "[Notification] Retry callback provided but web toasts don't support buttons. Handle retry in UI."
      );
    }
  } else {
    // Native: use Alert with buttons for retry if applicable
    if (kind === 'system' && retry) {
      // System error with retry option
      const buttons: AlertButton[] = [
        {
          text: 'Retry',
          onPress: retry,
          style: 'default',
        },
        {
          text: 'OK',
          style: 'cancel',
        },
      ];
      Alert.alert(displayTitle, displayMessage, buttons);
    } else {
      // Actionable error or system error without retry
      // Prefer toast if available, otherwise Alert
      const store = useToastStore.getState();
      const toastType = kind === 'actionable' ? 'error' : 'error';

      // For actionable errors, prefer toast (less intrusive)
      // For system errors without retry, use Alert (more visible)
      if (kind === 'actionable') {
        store.showToast({
          type: toastType,
          title: displayTitle,
          message: displayMessage,
          duration: 4000,
        });
      } else {
        // System error without retry - use Alert for visibility
        Alert.alert(displayTitle, displayMessage);
      }
    }
  }
};

/**
 * Convenience function for actionable errors.
 * Use when the user can fix the issue.
 */
export const notifyActionable = (
  title: string,
  message?: string,
  debug?: unknown
): void => {
  notify({ kind: 'actionable', title, message, debug });
};

/**
 * Convenience function for system errors.
 * Use when the user can only retry.
 */
export const notifySystem = (
  title: string,
  message?: string,
  debug?: unknown,
  retry?: () => void | Promise<void>
): void => {
  notify({ kind: 'system', title, message, debug, retry });
};
