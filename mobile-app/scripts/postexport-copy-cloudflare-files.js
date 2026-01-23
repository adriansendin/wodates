/**
 * Post-export script to copy Cloudflare Pages configuration files to dist/
 * 
 * This ensures that _redirects and _headers are present in the build output
 * even if expo export regenerates or clears the dist/ folder.
 */

const fs = require('fs');
const path = require('path');

const CLOUDFLARE_DIR = path.join(__dirname, '..', 'cloudflare');
const DIST_DIR = path.join(__dirname, '..', 'dist');

const FILES_TO_COPY = ['_redirects', '_headers'];

function main() {
  console.log('[Cloudflare] Copying configuration files to dist/...');

  // Check if dist/ exists
  if (!fs.existsSync(DIST_DIR)) {
    console.error(`[Cloudflare] ERROR: dist/ directory does not exist. Run 'expo export' first.`);
    process.exit(1);
  }

  // Check if cloudflare/ exists
  if (!fs.existsSync(CLOUDFLARE_DIR)) {
    console.error(`[Cloudflare] ERROR: cloudflare/ directory does not exist.`);
    process.exit(1);
  }

  let copiedCount = 0;
  let errorCount = 0;

  // Copy each file
  for (const filename of FILES_TO_COPY) {
    const sourcePath = path.join(CLOUDFLARE_DIR, filename);
    const destPath = path.join(DIST_DIR, filename);

    try {
      // Check if source file exists
      if (!fs.existsSync(sourcePath)) {
        console.warn(`[Cloudflare] WARNING: ${filename} not found in cloudflare/ directory. Skipping.`);
        errorCount++;
        continue;
      }

      // Copy file
      fs.copyFileSync(sourcePath, destPath);
      console.log(`[Cloudflare] ✓ Copied ${filename} to dist/`);
      copiedCount++;
    } catch (error) {
      console.error(`[Cloudflare] ERROR: Failed to copy ${filename}:`, error.message);
      errorCount++;
    }
  }

  // Summary
  if (errorCount === 0) {
    console.log(`[Cloudflare] ✓ Successfully copied ${copiedCount} file(s) to dist/`);
  } else {
    console.error(`[Cloudflare] ✗ Completed with ${errorCount} error(s)`);
    process.exit(1);
  }

  // Copy Ionicons fonts to assets path
  const fontsSource = path.join(
    DIST_DIR,
    'node_modules',
    '@expo',
    'vector-icons',
    'build',
    'vendor',
    'react-native-vector-icons',
    'Fonts'
  );
  const fontsDest = path.join(
    DIST_DIR,
    'assets',
    'node_modules',
    '@expo',
    'vector-icons',
    'build',
    'vendor',
    'react-native-vector-icons',
    'Fonts'
  );

  if (!fs.existsSync(fontsSource)) {
    console.warn(`[Cloudflare] WARNING: Ionicons fonts source not found at ${fontsSource}`);
  } else {
    try {
      // Remove destination if exists
      if (fs.existsSync(fontsDest)) {
        fs.rmSync(fontsDest, { recursive: true, force: true });
      }
      // Create parent directories recursively
      fs.mkdirSync(path.dirname(fontsDest), { recursive: true });
      // Copy directory recursively
      copyDirRecursive(fontsSource, fontsDest);
      console.log(`[Cloudflare] ✓ Copied Ionicons fonts to assets path`);
    } catch (error) {
      console.error(`[Cloudflare] ERROR: Failed to copy fonts:`, error.message);
    }
  }
}

function copyDirRecursive(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

main();
