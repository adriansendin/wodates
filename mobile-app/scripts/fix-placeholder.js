/**
 * Regenerates placeholder.png as a valid PNG (fixes AAPT2 compile error).
 * Run: node scripts/fix-placeholder.js
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, '../assets/placeholder.png');
const SIZE = 256;
const BG = '#f5a5a5'; // light coral, matches WODATES style

sharp({
  create: {
    width: SIZE,
    height: SIZE,
    channels: 3,
    background: BG,
  },
})
  .png({ compressionLevel: 6 })
  .toFile(OUT)
  .then(() => {
    console.log('✓ placeholder.png regenerated as valid PNG');
  })
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
