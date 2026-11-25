/**
 * Copies mobile-app/standby/* into dist/ for Cloudflare Pages (production pause).
 */

const fs = require('fs');
const path = require('path');

const STANDBY_DIR = path.join(__dirname, '..', 'standby');
const DIST_DIR = path.join(__dirname, '..', 'dist');

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function main() {
  if (!fs.existsSync(STANDBY_DIR)) {
    console.error('[build-standby] ERROR: standby/ not found.');
    process.exit(1);
  }

  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(DIST_DIR, { recursive: true });

  for (const name of fs.readdirSync(STANDBY_DIR)) {
    copyRecursive(path.join(STANDBY_DIR, name), path.join(DIST_DIR, name));
  }

  console.log('[build-standby] Standby site copied to dist/');
}

main();