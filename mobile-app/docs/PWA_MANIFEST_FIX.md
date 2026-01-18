# PWA Manifest Icon & Screenshot Fix

This document describes the fixes applied to resolve Chrome DevTools manifest warnings for icon sizes and missing screenshots.

## Overview

**Problem**: Chrome DevTools showed warnings:
- Icon size mismatches (declared sizes didn't match actual image dimensions)
- Missing screenshots for "Richer PWA Install UI"

**Solution**: 
- Generate properly sized icons (192x192 and 512x512) with exact pixel dimensions
- Add screenshots for mobile (narrow) and desktop (wide) views
- Ensure all assets are correctly copied to `dist/` during `expo export`

## Changes Made

### 1. Updated `public/manifest.json`

- **Separate icon files**: Changed from reusing the same icon file for multiple sizes to dedicated files:
  - `icon-192.png` (192x192, any purpose)
  - `icon-512.png` (512x512, any purpose)
  - `icon-maskable-192.png` (192x192, maskable)
  - `icon-maskable-512.png` (512x512, maskable)

- **Added screenshots**: Added screenshot entries for mobile (narrow) and desktop (wide) views

### 2. Icon Generation Script

Created `scripts/generate-pwa-icons.js` to automatically generate properly sized icons from source assets.

**Source files:**
- `assets/icon.png` → generates `public/assets/icon-192.png` and `icon-512.png`
- `assets/adaptive-icon.png` → generates `public/assets/icon-maskable-192.png` and `icon-maskable-512.png`

**Usage:**
```bash
npm run generate:pwa-icons
```

This script:
- Reads source images from `assets/`
- Generates correctly sized icons in `public/assets/` with exact pixel dimensions
- Fails fast with clear error messages if inputs are missing

### 3. Screenshot Placeholder Generator

Created `scripts/generate-pwa-screenshots.js` to generate placeholder screenshots.

**Usage:**
```bash
npm run generate:pwa-screenshots
```

This generates:
- `public/assets/screenshot-mobile.png` (390x844, narrow)
- `public/assets/screenshot-desktop.png` (1280x720, wide)

**Note**: These are placeholder images. Replace with actual app screenshots for production.

### 4. Package.json Updates

- Added `sharp` as devDependency (for image processing)
- Added scripts:
  - `generate:pwa-icons` - Generate PWA icons
  - `generate:pwa-screenshots` - Generate screenshot placeholders

## Build Process

### Step-by-Step Commands

```bash
# 1. Install dependencies (includes sharp)
cd mobile-app
npm install

# 2. Generate PWA icons
npm run generate:pwa-icons

# 3. Generate screenshot placeholders (or create manually)
npm run generate:pwa-screenshots

# 4. Build for production
npm run build

# 5. Verify dist/assets/ contains all files
ls dist/assets/
# Should show:
# - icon-192.png
# - icon-512.png
# - icon-maskable-192.png
# - icon-maskable-512.png
# - screenshot-mobile.png
# - screenshot-desktop.png

# 6. Serve locally for testing
npx serve dist -p 8080

# 7. Test with ngrok (for HTTPS)
ngrok http 8080
```

## Verification Checklist

After building and serving over HTTPS (ngrok), verify in Chrome DevTools:

### Application → Manifest

- [ ] Manifest loads without errors
- [ ] **No icon size warnings** - all icons show correct dimensions
- [ ] All 4 icon entries present:
  - [ ] icon-192.png (192x192, any)
  - [ ] icon-512.png (512x512, any)
  - [ ] icon-maskable-192.png (192x192, maskable)
  - [ ] icon-maskable-512.png (512x512, maskable)
- [ ] Screenshots section present with 2 entries:
  - [ ] screenshot-mobile.png (390x844, narrow)
  - [ ] screenshot-desktop.png (1280x720, wide)
- [ ] No console errors related to manifest

### Application → Service Workers

- [ ] Service worker registered and active
- [ ] Scope is `/` (root)
- [ ] No errors in service worker console

### URL Verification

Test these URLs (replace `<ngrok-host>` with your ngrok URL):

**Local:**
- http://localhost:8080/manifest.json
- http://localhost:8080/assets/icon-192.png
- http://localhost:8080/assets/icon-512.png
- http://localhost:8080/assets/screenshot-mobile.png
- http://localhost:8080/assets/screenshot-desktop.png

**HTTPS (ngrok):**
- https://<ngrok-host>/manifest.json
- https://<ngrok-host>/assets/icon-192.png
- https://<ngrok-host>/assets/icon-512.png
- https://<ngrok-host>/assets/screenshot-mobile.png
- https://<ngrok-host>/assets/screenshot-desktop.png

All URLs should return 200 OK and display the correct content.

### Visual Verification

- [ ] Icons display correctly in browser tab
- [ ] PWA install prompt appears (if criteria met)
- [ ] Install prompt shows correct app name and icon
- [ ] No warnings in Chrome DevTools → Application → Manifest

## Asset Pipeline

### How Expo Export Works

1. **Source**: `public/` folder contains static assets
2. **Build**: `expo export` (via `npm run build`) copies `public/` contents to `dist/`
3. **Result**: Files in `public/assets/` are available at `/assets/` in the built app

### File Structure

```
mobile-app/
├── assets/                    # Source icons (not copied to dist)
│   ├── icon.png
│   └── adaptive-icon.png
├── public/                    # Static assets (copied to dist/)
│   ├── manifest.json
│   ├── sw.js
│   └── assets/
│       ├── icon-192.png       # Generated by script
│       ├── icon-512.png       # Generated by script
│       ├── icon-maskable-192.png
│       ├── icon-maskable-512.png
│       ├── screenshot-mobile.png
│       └── screenshot-desktop.png
└── dist/                      # Build output (after npm run build)
    ├── manifest.json          # Copied from public/
    ├── sw.js                  # Copied from public/
    └── assets/               # Copied from public/assets/
        ├── icon-192.png
        ├── icon-512.png
        ├── icon-maskable-192.png
        ├── icon-maskable-512.png
        ├── screenshot-mobile.png
        └── screenshot-desktop.png
```

## Replacing Screenshots

The generated screenshots are placeholders. To replace with actual screenshots:

### Mobile Screenshot (390x844)

1. Open app in Chrome DevTools mobile emulator (390x844)
2. Navigate to main screen (feed/home)
3. Take screenshot
4. Save as `public/assets/screenshot-mobile.png`
5. Ensure dimensions are exactly 390x844

### Desktop Screenshot (1280x720)

1. Open app in Chrome at 1280x720 viewport
2. Navigate to main screen
3. Take screenshot
4. Save as `public/assets/screenshot-desktop.png`
5. Ensure dimensions are exactly 1280x720

**Note**: Screenshots are optional but recommended for better PWA install UI. The app will still be installable without them, but Chrome will show a warning.

## Files Modified

1. `public/manifest.json` - Updated icon paths and added screenshots
2. `package.json` - Added `generate:pwa-icons` and `generate:pwa-screenshots` scripts, added `sharp` dev dependency
3. `scripts/generate-pwa-icons.js` - New script for icon generation
4. `scripts/generate-pwa-screenshots.js` - New script for screenshot placeholder generation

## Troubleshooting

### Icons not found after build

- Verify `public/assets/` contains the generated icon files
- Check that `expo export` completed successfully
- Verify `dist/assets/` contains the icons (should be copied automatically)

### Icon size warnings persist

- Ensure icons are exactly the declared size (192x192 or 512x512)
- Check file dimensions: `file dist/assets/icon-192.png` (Linux/Mac) or use image viewer
- Regenerate icons: `npm run generate:pwa-icons`

### Screenshots not showing

- Verify screenshots exist in `public/assets/`
- Check manifest.json references correct paths (`/assets/screenshot-mobile.png`)
- Ensure screenshots are valid PNG files with correct dimensions

### Service worker issues

- Service worker behavior is unchanged (still network-first, no API caching)
- If SW registration fails, check `public/sw.js` exists and is copied to `dist/`

## Expected Output

After running all commands successfully:

```
✓ Generated icon-192.png (192x192)
✓ Generated icon-512.png (512x512)
✓ Generated icon-maskable-192.png (192x192)
✓ Generated icon-maskable-512.png (512x512)
✓ All PWA icons generated successfully!

✓ Generated screenshot-mobile.png (390x844)
✓ Generated screenshot-desktop.png (1280x720)
✓ All PWA screenshot placeholders generated successfully!
```

Chrome DevTools → Application → Manifest should show:
- ✅ No icon size warnings
- ✅ All icons present with correct sizes
- ✅ Screenshots section present
- ✅ No errors
