/**
 * Generate PWA icons with correct sizes from source assets
 * 
 * This script generates properly sized PWA icons (192x192 and 512x512)
 * from the source icon files in assets/ and places them in public/assets/
 * 
 * Usage: npm run generate:pwa-icons
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const PUBLIC_ASSETS_DIR = path.join(__dirname, '..', 'public', 'assets');

// Ensure public/assets directory exists
if (!fs.existsSync(PUBLIC_ASSETS_DIR)) {
  fs.mkdirSync(PUBLIC_ASSETS_DIR, { recursive: true });
}

async function generateIcon(inputPath, outputPath, size) {
  try {
    await sharp(inputPath)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .png()
      .toFile(outputPath);
    console.log(`✓ Generated ${path.basename(outputPath)} (${size}x${size})`);
  } catch (error) {
    console.error(`✗ Failed to generate ${path.basename(outputPath)}:`, error.message);
    throw error;
  }
}

async function main() {
  console.log('Generating PWA icons...\n');

  const iconPath = path.join(ASSETS_DIR, 'icon.png');
  const adaptiveIconPath = path.join(ASSETS_DIR, 'adaptive-icon.png');

  // Check if source files exist
  if (!fs.existsSync(iconPath)) {
    console.error(`✗ Source icon not found: ${iconPath}`);
    console.error('  Expected: assets/icon.png');
    process.exit(1);
  }
  if (!fs.existsSync(adaptiveIconPath)) {
    console.error(`✗ Source adaptive icon not found: ${adaptiveIconPath}`);
    console.error('  Expected: assets/adaptive-icon.png');
    process.exit(1);
  }

  try {
    // Generate standard icons (any purpose)
    await generateIcon(
      iconPath,
      path.join(PUBLIC_ASSETS_DIR, 'icon-192.png'),
      192
    );
    await generateIcon(
      iconPath,
      path.join(PUBLIC_ASSETS_DIR, 'icon-512.png'),
      512
    );

    // Generate maskable icons
    await generateIcon(
      adaptiveIconPath,
      path.join(PUBLIC_ASSETS_DIR, 'icon-maskable-192.png'),
      192
    );
    await generateIcon(
      adaptiveIconPath,
      path.join(PUBLIC_ASSETS_DIR, 'icon-maskable-512.png'),
      512
    );

    console.log('\n✓ All PWA icons generated successfully!');
    console.log(`  Output directory: ${PUBLIC_ASSETS_DIR}`);
    console.log('\nNext steps:');
    console.log('1. Run: npm run generate:pwa-screenshots (or create screenshots manually)');
    console.log('2. Run: npm run build');
  } catch (error) {
    console.error('\n✗ Icon generation failed:', error.message);
    process.exit(1);
  }
}

main();
