/**
 * Generate placeholder PWA screenshots
 * 
 * This script generates placeholder screenshots for PWA manifest.
 * Replace these with actual app screenshots for production.
 * 
 * Usage: npm run generate:pwa-screenshots
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const PUBLIC_ASSETS_DIR = path.join(__dirname, '..', 'public', 'assets');

// Ensure public/assets directory exists
if (!fs.existsSync(PUBLIC_ASSETS_DIR)) {
  fs.mkdirSync(PUBLIC_ASSETS_DIR, { recursive: true });
}

async function generateScreenshot(width, height, outputPath, label, formFactor) {
  try {
    // Create a simple placeholder image with text
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${width}" height="${height}" fill="#e91e63"/>
        <text x="50%" y="40%" font-family="Arial, sans-serif" font-size="${Math.min(width, height) / 10}" 
              fill="white" text-anchor="middle" dominant-baseline="middle" font-weight="bold">
          Wodates
        </text>
        <text x="50%" y="55%" font-family="Arial, sans-serif" font-size="${Math.min(width, height) / 20}" 
              fill="white" text-anchor="middle" dominant-baseline="middle">
          ${label}
        </text>
        <text x="50%" y="70%" font-family="Arial, sans-serif" font-size="${Math.min(width, height) / 25}" 
              fill="rgba(255,255,255,0.8)" text-anchor="middle" dominant-baseline="middle">
          ${formFactor === 'narrow' ? 'Mobile View' : 'Desktop View'}
        </text>
        <text x="50%" y="85%" font-family="Arial, sans-serif" font-size="${Math.min(width, height) / 30}" 
              fill="rgba(255,255,255,0.6)" text-anchor="middle" dominant-baseline="middle">
          Placeholder - Replace with actual screenshot
        </text>
      </svg>
    `;

    await sharp(Buffer.from(svg))
      .png()
      .toFile(outputPath);
    
    console.log(`✓ Generated ${path.basename(outputPath)} (${width}x${height})`);
  } catch (error) {
    console.error(`✗ Failed to generate ${path.basename(outputPath)}:`, error.message);
    throw error;
  }
}

async function main() {
  console.log('Generating PWA screenshot placeholders...\n');

  try {
    // Generate mobile screenshot (narrow)
    await generateScreenshot(
      390,
      844,
      path.join(PUBLIC_ASSETS_DIR, 'screenshot-mobile.png'),
      'Wodates mobile view',
      'narrow'
    );

    // Generate desktop screenshot (wide)
    await generateScreenshot(
      1280,
      720,
      path.join(PUBLIC_ASSETS_DIR, 'screenshot-desktop.png'),
      'Wodates desktop view',
      'wide'
    );

    console.log('\n✓ All PWA screenshot placeholders generated successfully!');
    console.log(`  Output directory: ${PUBLIC_ASSETS_DIR}`);
    console.log('\n⚠️  Note: These are placeholder images.');
    console.log('   Replace with actual app screenshots for production:');
    console.log('   - screenshot-mobile.png: 390x844 (iPhone 12/13/14 standard)');
    console.log('   - screenshot-desktop.png: 1280x720 (standard desktop)');
  } catch (error) {
    console.error('\n✗ Screenshot generation failed:', error.message);
    process.exit(1);
  }
}

main();
