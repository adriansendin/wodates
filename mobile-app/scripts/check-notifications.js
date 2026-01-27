#!/usr/bin/env node

/**
 * Script to check for direct Alert.alert() usage in error contexts.
 * This helps prevent regressions by detecting problematic patterns.
 * 
 * Usage: node scripts/check-notifications.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ALLOWED_PATTERNS = [
  /Alert\.alert\([^,]+,\s*['"](Select|Choose|Where|Add|Success|Account deactivated|Chat unavailable|Selfie received)/i,
  /Alert\.alert\([^,]+,\s*['"][^'"]*['"],\s*\[/m, // Has buttons array (option selection)
];

const ERROR_PATTERNS = [
  /Alert\.alert\(['"]Error['"]/i,
  /Alert\.alert\(['"]Login error['"]/i,
  /Alert\.alert\(['"]Network error['"]/i,
  /Alert\.alert\([^,]+,\s*result\.error/i,
  /Alert\.alert\([^,]+,\s*error/i,
  /Alert\.alert\([^,]+,\s*err/i,
];

function findFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Skip node_modules, .git, etc.
      if (!['node_modules', '.git', '.next', 'dist', 'build'].includes(file)) {
        findFiles(filePath, fileList);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const issues = [];

  lines.forEach((line, index) => {
    // Skip if it's importing Alert (that's fine)
    if (line.includes('import') && line.includes('Alert')) {
      return;
    }

    // Check for Alert.alert usage
    if (line.includes('Alert.alert')) {
      // Check if it matches allowed patterns
      const isAllowed = ALLOWED_PATTERNS.some((pattern) => pattern.test(line));

      // Check if it matches error patterns
      const isError = ERROR_PATTERNS.some((pattern) => pattern.test(line));

      if (!isAllowed && isError) {
        issues.push({
          file: filePath,
          line: index + 1,
          content: line.trim(),
        });
      }
    }
  });

  return issues;
}

function main() {
  const projectRoot = path.join(__dirname, '..');
  const appDir = path.join(projectRoot, 'app');
  const srcDir = path.join(projectRoot, 'src');

  console.log('🔍 Checking for direct Alert.alert() usage in error contexts...\n');

  const files = [
    ...findFiles(appDir),
    ...findFiles(srcDir),
  ].filter((file) => {
    // Skip test files and the notification service itself
    return (
      !file.includes('.test.') &&
      !file.includes('.spec.') &&
      !file.includes('notificationService')
    );
  });

  const allIssues = [];

  files.forEach((file) => {
    const issues = checkFile(file);
    if (issues.length > 0) {
      allIssues.push(...issues);
    }
  });

  if (allIssues.length > 0) {
    console.error('❌ Found direct Alert.alert() usage in error contexts:\n');
    allIssues.forEach((issue) => {
      const relativePath = path.relative(projectRoot, issue.file);
      console.error(`  ${relativePath}:${issue.line}`);
      console.error(`    ${issue.content}\n`);
    });
    console.error(
      '💡 Tip: Use notifyActionable() or notifySystem() from notificationService instead.\n'
    );
    console.error(
      '   See docs/NOTIFICATION_GUIDELINES.md for more information.\n'
    );
    process.exit(1);
  } else {
    console.log('✅ No problematic Alert.alert() usage found!\n');
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

module.exports = { checkFile, findFiles };
