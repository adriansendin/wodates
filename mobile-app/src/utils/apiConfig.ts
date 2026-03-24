import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Gets the API URL based on the platform and environment.
 * - Web: Always uses localhost (works better in browsers)
 * - iOS/Android Simulator: Uses localhost if IP is detected (simulators can access localhost)
 * - iOS/Android Physical Device: Uses the configured URL as-is (should be IP address)
 */
export function getApiUrl(): string {
  const configuredUrl =
    process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

  // Detect if URL contains an IP address (like 192.168.x.x or 10.x.x.x)
  const ipAddressRegex = /http:\/\/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d+)/;
  const ipMatch = configuredUrl.match(ipAddressRegex);

  // If no IP address is found, return as-is — except Android emulator + localhost
  if (!ipMatch) {
    const isAndroidEmulator =
      Platform.OS === 'android' &&
      Constants?.isDevice === false;
    if (isAndroidEmulator && /localhost|127\.0\.0\.1/.test(configuredUrl)) {
      const androidLocal = configuredUrl.replace(
        /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)/,
        'http://10.0.2.2$2'
      );
      console.log(
        `[getApiUrl] Android emulator + localhost API host -> ${androidLocal}`
      );
      return androidLocal;
    }
    console.log(
      `[getApiUrl] No IP address detected, using as-is: ${configuredUrl}`
    );
    return configuredUrl;
  }

  const [, , port] = ipMatch;
  const localhostUrl = configuredUrl.replace(
    ipAddressRegex,
    `http://localhost:${port}`
  );

  // On web, check if we're accessing from localhost or from network IP
  // If accessing from network IP (like iPhone), use the IP address
  // If accessing from localhost, use localhost for the API
  try {
    if (Platform.OS === 'web' || typeof window !== 'undefined') {
      // Check if the current page is being accessed via IP address
      const currentHost =
        typeof window !== 'undefined' ? window.location.hostname : '';
      const isAccessingViaIP = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(
        currentHost
      );

      if (isAccessingViaIP) {
        // Accessing from network IP (like iPhone), use IP address for API
        console.log(
          `[getApiUrl] Web platform detected, accessing via IP ${currentHost}, using IP for API: ${configuredUrl}`
        );
        return configuredUrl;
      } else {
        // Accessing from localhost, use localhost for API
        console.log(
          `[getApiUrl] Web platform detected, accessing via localhost, using localhost for API: ${localhostUrl}`
        );
        return localhostUrl;
      }
    }
  } catch (error) {
    // If we can't determine, default to using configured URL (safer for network access)
    console.warn(
      `[getApiUrl] Could not determine access method, using configured URL: ${configuredUrl}`
    );
    return configuredUrl;
  }

  // On iOS/Android, check if running in simulator/emulator
  // IMPORTANT: Default to using IP (physical device) unless we're CERTAIN it's a simulator
  // This is safer because physical devices NEED the IP address to work
  let isSimulator = false;
  let deviceDetectionMethod = 'unknown';

  try {
    // Check Constants.isDevice - if it's explicitly false, we're in a simulator
    if (Constants && typeof Constants.isDevice !== 'undefined') {
      // Constants.isDevice === false means simulator
      // Constants.isDevice === true means physical device
      isSimulator = !Constants.isDevice;
      deviceDetectionMethod = `Constants.isDevice (${Constants.isDevice})`;
    } else {
      // If Constants.isDevice is not available, check executionEnvironment
      // In Expo Go on physical device, executionEnvironment is usually 'storeClient'
      // In simulator, it might be 'bare' or undefined
      const executionEnv = Constants?.executionEnvironment;
      if (executionEnv === 'storeClient' || executionEnv === 'standalone') {
        // These indicate physical device
        isSimulator = false;
        deviceDetectionMethod = `Constants.executionEnvironment (${executionEnv})`;
      } else {
        // If we can't determine, default to physical device (safer)
        // Only use localhost if we're VERY sure it's a simulator
        isSimulator = false;
        deviceDetectionMethod = 'default (assume physical device - safer)';
      }
    }
  } catch (error) {
    // If Constants is not available at all, assume physical device (safer default)
    console.warn(
      '[getApiUrl] Could not determine device status, assuming physical device'
    );
    isSimulator = false;
    deviceDetectionMethod = 'error fallback (assume physical device)';
  }

  console.log(
    `[getApiUrl] Platform: ${Platform.OS}, isSimulator: ${isSimulator} (${deviceDetectionMethod}), configuredUrl: ${configuredUrl}`
  );

  if (isSimulator) {
    // iOS simulator: host machine is localhost. Android emulator: localhost is the VM;
    // use special alias to reach the dev machine (see Android docs: 10.0.2.2).
    if (Platform.OS === 'android') {
      const androidUrl = configuredUrl.replace(
        ipAddressRegex,
        `http://10.0.2.2:${port}`
      );
      const withHost = androidUrl.includes('10.0.2.2')
        ? androidUrl
        : androidUrl.replace(
            /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/,
            `http://10.0.2.2$2`
          );
      console.log(
        `[getApiUrl] Android emulator: ${configuredUrl} -> ${withHost}`
      );
      return withHost;
    }
    console.log(
      `[getApiUrl] Simulator/Emulator detected: ${configuredUrl} -> ${localhostUrl}`
    );
    return localhostUrl;
  }

  // Physical device - use configured URL as-is (should be IP address like 192.168.1.11:3000)
  console.log(
    `[getApiUrl] Physical device detected, using IP: ${configuredUrl}`
  );
  return configuredUrl;
}
