/**
 * PWA Utilities
 *
 * Handles PWA installation prompts and service worker registration.
 * This is a minimal implementation for Phase 1 (installability only).
 */

/**
 * Register service worker (backup registration in case HTML script fails)
 */
export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('[PWA] Service Worker registered:', registration.scope);
      })
      .catch((error) => {
        console.warn('[PWA] Service Worker registration failed:', error);
      });
  });
}

/**
 * Check if app is running as installed PWA
 */
export function isInstalledPWA(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  // Check if running in standalone mode (iOS) or display-mode standalone (Android)
  const isStandalone =
    (window.navigator as any).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;

  return isStandalone;
}

/**
 * Check if browser supports PWA installation
 */
export function canInstallPWA(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  // Check for beforeinstallprompt event support (Chrome/Edge)
  return 'serviceWorker' in navigator && 'PushManager' in window;
}
