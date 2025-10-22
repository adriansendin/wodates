import { Alert, Platform } from 'react-native';

type AlertParams = Parameters<typeof Alert.alert>;

const buildMessage = (title: string, message: string | undefined) => {
  return [title, message].filter(Boolean).join('\n');
};

export const showAlert = (...args: AlertParams): void => {
  const [title, message, buttons, options] = args;

  Alert.alert(title, message, buttons, options);

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(buildMessage(title, message));
  }
};
