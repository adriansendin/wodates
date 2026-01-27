# Notification Guidelines

## Overview

This document describes the centralized notification system and guidelines for handling errors and user feedback in the application.

## Principles

1. **No direct alerts**: Screens/components MUST NOT call system alerts/popups directly.
2. **Centralized notifications**: All user feedback MUST go through the centralized notification service.
3. **No technical details**: Never show technical details (stack traces, objects, internal codes) to users in production.

## Notification Types

### Actionable Errors (`notifyActionable`)

Use when the user can fix the issue:
- Invalid credentials
- Invalid email format
- Validation errors
- Expected permission errors (401/403)
- User input errors

**Example:**
```typescript
import { notifyActionable } from '../../src/utils/notificationService';

// User entered wrong password
notifyActionable("Couldn't sign in", "Please check your credentials", result.error);
```

### System Errors (`notifySystem`)

Use when the user can only retry:
- Unexpected exceptions
- 5xx server errors
- Service outages
- Network timeouts
- Unexpected errors

**Example:**
```typescript
import { notifySystem } from '../../src/utils/notificationService';

// Network error with retry
notifySystem('Something went wrong', 'Try again', error, () => loadData());

// System error without retry
notifySystem('Something went wrong', 'Try again', error);
```

## Environment Behavior

### Production
- **Actionable**: Show user-friendly message
- **System**: Show generic message + retry option (if applicable). Silent logging. No technical details.

### Development
- **Actionable**: Same as production
- **System**: Generic message + retry (if applicable) + detailed error logged to console

## Platform Behavior

### Web
- Always uses in-app toasts (never browser popups)
- Retry buttons are not supported in toasts - handle retry in UI or show persistent toast

### Native
- **Actionable errors**: Prefer toast (less intrusive)
- **System errors**: Use Alert with retry button if retry callback provided

## Deprecated Functions

The following functions are deprecated and should NOT be used in new code:

- `Alert.alert()` - Use `notifyActionable` or `notifySystem` instead
- `showAlert()` - Use `notifyActionable` or `notifySystem` instead
- `notifyError()` - Use `notifyActionable` or `notifySystem` instead

## Preventing Regressions

### Code Review Checklist

When reviewing code, ensure:
- [ ] No direct calls to `Alert.alert()` (except for non-error use cases like option selection)
- [ ] No direct calls to `window.alert()` or browser popups
- [ ] All error handling uses `notifyActionable` or `notifySystem`
- [ ] System errors include retry callback when applicable
- [ ] No technical error details shown to users in production

### Allowed Uses of Alert.alert()

`Alert.alert()` is still allowed for:
- **Option selection** (e.g., "Take photo" vs "Choose from gallery")
- **Success messages** (e.g., "Account deactivated")
- **Informational dialogs** that require user action (e.g., "Chat unavailable" with OK button)

These are NOT error notifications and don't need to go through the notification service.

## Migration Guide

### Before (❌ Don't do this)
```typescript
try {
  const result = await api.loadData();
  if (!result.success) {
    Alert.alert('Error', result.error.message);
  }
} catch (error) {
  Alert.alert('Error', 'Network error. Please try again.');
}
```

### After (✅ Do this)
```typescript
import { notifyActionable, notifySystem } from '../../src/utils/notificationService';

try {
  const result = await api.loadData();
  if (!result.success) {
    // Determine if actionable or system error
    if (result.error.statusCode === 400 || result.error.statusCode === 422) {
      // Validation error - actionable
      notifyActionable('Invalid input', result.error.message, result.error);
    } else {
      // Server error - system
      notifySystem('Something went wrong', 'Try again', result.error, () => loadData());
    }
  }
} catch (error) {
  // Network error - system
  notifySystem('Something went wrong', 'Try again', error, () => loadData());
}
```

## Testing

When testing notifications:
1. Verify user-friendly messages in production mode
2. Verify detailed logs in development mode
3. Test retry functionality on system errors
4. Ensure no technical details leak to users
