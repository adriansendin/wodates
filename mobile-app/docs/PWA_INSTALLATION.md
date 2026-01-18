# PWA Installation Guide (Phase 1)

This document describes the PWA (Progressive Web App) implementation for WODATES web build, focusing on **installability only** (Phase 1).

## Overview

The PWA implementation makes WODATES installable on:
- **Android/Chrome**: Users can install via "Install app" prompt
- **iOS/Safari**: Users can "Add to Home Screen" for app-like experience

**Important**: This is Phase 1 - installability only. We do NOT implement:
- Push notifications (Phase 2)
- Offline data caching
- Offline chat/feed functionality

## Architecture

### Files Added/Modified

1. **`app.json`** - Added PWA manifest configuration under `web` field
2. **`public/manifest.json`** - Web app manifest for installability
3. **`public/sw.js`** - Minimal service worker (required for installability, does NOT cache sensitive data)
4. **`web/index.html`** - Custom HTML template with PWA meta tags and service worker registration
5. **`src/utils/pwa.ts`** - PWA utility functions
6. **`app/_layout.tsx`** - Added PWA initialization component

### Service Worker Strategy

The service worker (`public/sw.js`) is **minimal and privacy-focused**:

- ✅ **Exists** to satisfy browser installability requirements
- ✅ **Registers** successfully so browsers treat app as installable
- ❌ **Does NOT cache** API responses (`/api/*`)
- ❌ **Does NOT cache** chat, feed, or user data
- ❌ **Does NOT store** sensitive information offline
- ✅ **Network-first** for all API calls - fails gracefully when offline

When offline, the app shows "no connection" errors (handled by app UI), not cached private data.

## Building for Production

### 1. Build the Web Bundle

```bash
cd mobile-app
npm run build
```

This runs `expo export` which generates a static web build in the `dist/` folder.

### 2. Verify Build Output

After building, check that these files exist in `dist/`:

```
dist/
├── index.html          # Should include manifest link and SW registration
├── manifest.json       # PWA manifest
├── sw.js              # Service worker
└── assets/
    ├── icon.png       # App icon
    └── favicon.png    # Favicon
```

### 3. Serve Over HTTPS

PWAs **require HTTPS** (except localhost). For production:

- Deploy to a server with valid SSL certificate
- Ensure all assets are served over HTTPS
- Verify `manifest.json` and `sw.js` are accessible

## Testing Locally

### Option 1: Local HTTPS Tunnel (Recommended)

Use a tool like `ngrok` or `localtunnel` to create an HTTPS tunnel:

```bash
# Install ngrok (if not installed)
# Download from https://ngrok.com/

# Build the app
cd mobile-app
npm run build

# Serve locally (in one terminal)
npx serve dist -p 8080

# Create HTTPS tunnel (in another terminal)
ngrok http 8080
```

Then access via the HTTPS URL provided by ngrok (e.g., `https://abc123.ngrok.io`).

### Option 2: Localhost (Limited Testing)

For basic testing, you can use `localhost` (browsers allow PWAs on localhost):

```bash
cd mobile-app
npm run build
npx serve dist -p 8080
```

Open `http://localhost:8080` in Chrome/Edge.

**Note**: Some PWA features (like install prompts) may not work on `localhost` in all browsers.

### Option 3: Development Server

For development with hot reload:

```bash
cd mobile-app
npm run web
```

Then open `http://localhost:8081` (or the port shown in terminal).

**Note**: Service worker registration may be limited in development mode.

## Validation Checklist

### ✅ Browser DevTools Audit

1. **Open DevTools** → **Application** tab (Chrome) or **Application** tab (Edge)
2. **Check Manifest**:
   - Open "Manifest" section
   - Verify name, icons, theme color are correct
   - Check for any errors (red text)
3. **Check Service Worker**:
   - Open "Service Workers" section
   - Verify service worker is registered and active
   - Check scope is `/` (root)
4. **Run Lighthouse Audit**:
   - Open **Lighthouse** tab
   - Select "Progressive Web App" category
   - Run audit
   - **Expected**: Should pass "Installable" check

### ✅ Android/Chrome Testing

1. **Open app** in Chrome on Android device (or Android emulator)
2. **Check for install prompt**:
   - Should see "Install app" banner or menu option
   - Or visit `chrome://apps` to see if app appears
3. **Install the app**:
   - Tap "Install" when prompted
   - Or use Chrome menu → "Install app"
4. **Verify standalone mode**:
   - App should open without browser UI (no address bar)
   - App icon should appear on home screen
   - App name should be "WODATES"

### ✅ iOS/Safari Testing

1. **Open app** in Safari on iOS device (or iOS simulator)
2. **Add to Home Screen**:
   - Tap Share button (square with arrow)
   - Select "Add to Home Screen"
   - Verify icon and name are correct
   - Tap "Add"
3. **Launch from home screen**:
   - Tap the app icon
   - App should open in standalone mode (no Safari UI)
   - Status bar should match theme color

### ✅ Privacy & Security Verification

1. **Check Network Tab**:
   - Open DevTools → Network
   - Make API calls (login, fetch feed, etc.)
   - Verify API responses are **NOT cached** (check "Size" column - should show network size, not "disk cache")
2. **Check Application → Cache Storage**:
   - Should only contain static assets (HTML, JS, CSS)
   - Should **NOT** contain API responses or user data
3. **Test Offline Behavior**:
   - Go offline (disable network in DevTools)
   - Try to access chat/feed
   - App should show "no connection" error (not cached data)

## Known Limitations (Phase 1)

### What We Intentionally Did NOT Implement

1. **Push Notifications**: Out of scope for Phase 1 (will be Phase 2)
2. **Offline Data Caching**: App is online-first, no offline chat/feed
3. **Background Sync**: Not implemented
4. **Offline Fallback Pages**: Not implemented (app shows errors when offline)

### Platform-Specific Notes

- **iOS Safari**: Requires manual "Add to Home Screen" (no automatic install prompt)
- **Android Chrome**: May show install prompt automatically after meeting criteria
- **Desktop Browsers**: Install prompts vary by browser (Chrome/Edge support, Firefox/Safari limited)

## Troubleshooting

### Service Worker Not Registering

1. **Check HTTPS**: Service workers require HTTPS (or localhost)
2. **Check Console**: Look for registration errors
3. **Clear Cache**: DevTools → Application → Clear storage → Clear site data
4. **Verify File Exists**: Ensure `sw.js` is in `dist/` folder after build

### Manifest Not Found

1. **Check Path**: Verify `manifest.json` is at root of `dist/` folder
2. **Check HTML**: Ensure `<link rel="manifest" href="/manifest.json">` exists in `index.html`
3. **Check Network**: Verify manifest loads in Network tab (should return 200)

### Icons Not Showing

1. **Check Paths**: Verify icon paths in `manifest.json` match actual file locations
2. **Check Sizes**: Ensure icons exist and are correct size (192x192, 512x512)
3. **Check CORS**: If serving from different domain, ensure CORS headers allow icon access

### Install Prompt Not Appearing

1. **Check Criteria**: App must meet installability criteria:
   - HTTPS (or localhost)
   - Valid manifest.json
   - Registered service worker
   - Served over HTTPS
   - User has interacted with site
2. **Check Browser**: Some browsers don't show prompts (e.g., iOS Safari requires manual add)
3. **Check DevTools**: Run Lighthouse PWA audit to see what's missing

## Production Deployment

### Pre-Deployment Checklist

- [ ] Build succeeds: `npm run build`
- [ ] All assets copied to `dist/`
- [ ] `manifest.json` accessible at `/manifest.json`
- [ ] `sw.js` accessible at `/sw.js`
- [ ] Icons accessible at `/assets/icon.png`
- [ ] HTTPS enabled on production server
- [ ] CORS headers configured (if needed)
- [ ] Lighthouse PWA audit passes

### Server Configuration

Ensure your web server:

1. **Serves** `manifest.json` with `Content-Type: application/manifest+json`
2. **Serves** `sw.js` with `Content-Type: application/javascript`
3. **Supports** HTTPS with valid certificate
4. **Allows** service worker registration (no CSP blocking)

### Example Nginx Configuration

```nginx
location /manifest.json {
    add_header Content-Type application/manifest+json;
}

location /sw.js {
    add_header Content-Type application/javascript;
    add_header Service-Worker-Allowed /;
}
```

## Next Steps (Phase 2)

Future enhancements (not in scope for Phase 1):

- Push notifications
- Background sync
- Offline fallback pages (for marketing pages only, not private data)
- Install prompt UI component

## References

- [Expo PWA Documentation](https://docs.expo.dev/guides/progressive-web-apps/)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [PWA Checklist](https://web.dev/pwa-checklist/)
