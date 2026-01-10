import { DomainError, ValidationError, ServerError, NetworkError } from '../../../src/domain/errors/DomainError';

export type WaitlistFieldErrors = {
  email?: string;
  city?: string;
};

/**
 * Parses validation error details from backend response
 * @param error DomainError from API call
 * @returns Field-specific error messages or null if not a validation error
 */
export function parseWaitlistValidationErrors(
  error: DomainError
): WaitlistFieldErrors | null {
  if (!(error instanceof ValidationError)) {
    return null;
  }

  if (!error.details || typeof error.details !== 'object') {
    return null;
  }

  const details = error.details as Record<string, unknown>;
  const fieldErrors: WaitlistFieldErrors = {};

  if (typeof details.email === 'string') {
    fieldErrors.email = details.email;
  }

  if (typeof details.city === 'string') {
    fieldErrors.city = details.city;
  }

  return Object.keys(fieldErrors).length > 0 ? fieldErrors : null;
}

/**
 * Checks if error is a validation error (400)
 */
export function isValidationError(error: DomainError): boolean {
  return error instanceof ValidationError;
}

/**
 * Checks if error is a server/network error (500+ or network)
 */
export function isServerOrNetworkError(error: DomainError): boolean {
  return (
    error instanceof ServerError ||
    error instanceof NetworkError ||
    error.statusCode >= 500
  );
}

/**
 * Gets a generic error message for validation errors
 */
export function getGenericValidationMessage(): string {
  return 'Please check your details.';
}
