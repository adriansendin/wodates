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

  // If no IP address is found, return as-is (already localhost or domain)
  if (!ipMatch) {
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

  // On web, always use localhost instead of IP addresses
  // This avoids CORS and network issues in browsers
  try {
    if (Platform.OS === 'web') {
      console.log(
        `[getApiUrl] Web platform detected: ${configuredUrl} -> ${localhostUrl}`
      );
      return localhostUrl;
    }
  } catch (error) {
    // Platform might not be available, check if we're in a browser environment
    if (typeof window !== 'undefined') {
      console.log(
        `[getApiUrl] Browser environment detected (Platform unavailable): ${configuredUrl} -> ${localhostUrl}`
      );
      return localhostUrl;
    }
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
    // Running in simulator/emulator - can use localhost
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
