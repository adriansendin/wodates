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

  // Copy vector-icons fonts into dist/assets/fonts
  const fontsDestDir = path.join(DIST_DIR, 'assets', 'fonts');
  fs.mkdirSync(fontsDestDir, { recursive: true });

  const vectorIconTtfFiles = findVectorIconFonts(DIST_DIR);
  for (const fontPath of vectorIconTtfFiles) {
    const destPath = path.join(fontsDestDir, path.basename(fontPath));
    try {
      fs.copyFileSync(fontPath, destPath);
    } catch (error) {
      console.error(`[Cloudflare] ERROR: Failed to copy font ${fontPath}:`, error.message);
    }
  }
  console.log(
    `[Cloudflare] ✓ Copied ${vectorIconTtfFiles.length} vector-icon font files to dist/assets/fonts/`
  );
}

function findVectorIconFonts(rootDir) {
  const results = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (error) {
      continue;
    }
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.ttf')) {
        const normalizedPath = entryPath.replace(/\\/g, '/');
        if (normalizedPath.includes('react-native-vector-icons/Fonts')) {
          results.push(entryPath);
        }
      }
    }
  }
  return results;
}

main();
