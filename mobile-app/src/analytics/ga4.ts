/**
 * GA4 Analytics Helper
 * 
 * Provides functions to track events in Google Analytics 4.
 * Only works in web/PWA environment (protects against iOS/Android).
 */

/**
 * Track signup completion event
 * @param method - Signup method (default: 'email')
 */
export function trackSignupComplete(method: string = 'email'): void {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'signup_complete', { method });
    
    // Log in dev mode for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('[GA4] signup_complete', { method });
    }
  }
}

/**
 * Track login success event
 * @param method - Login method (default: 'email')
 */
export function trackLoginSuccess(method: string = 'email'): void {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'login_success', { method });
    
    // Log in dev mode for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('[GA4] login_success', { method });
    }
  }
}
