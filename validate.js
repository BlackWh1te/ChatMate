#!/usr/bin/env node

/**
 * Extension validation script
 * Run with: node validate.js
 * Checks that all required files are present and valid
 */

const fs = require('fs');
const path = require('path');

const requiredFiles = [
  'manifest.json',
  'popup.html',
  'popup.js',
  'sidebar.html',
  'content.js',
  'background.js',
  'settings.html',
  'settings.js'
];

const optionalFiles = [
  'README.md',
  'INSTALLATION.md',
  'LICENSE',
  'CONTRIBUTING.md',
  '.gitignore',
  'icon.svg',
  'icon16.png',
  'icon32.png',
  'icon48.png',
  'icon128.png'
];

console.log('🔍 Validating Chrome Extension...\n');

let missingFiles = [];
let presentFiles = [];

// Check required files
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    presentFiles.push(`✅ ${file}`);
  } else {
    missingFiles.push(`❌ ${file} (REQUIRED)`);
  }
});

// Check optional files
optionalFiles.forEach(file => {
  if (fs.existsSync(file)) {
    presentFiles.push(`✅ ${file} (optional)`);
  } else {
    presentFiles.push(`⚪ ${file} (optional, not present)`);
  }
});

// Validate manifest.json
if (fs.existsSync('manifest.json')) {
  try {
    const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
    console.log('✅ manifest.json is valid JSON');
    console.log(`   Name: ${manifest.name}`);
    console.log(`   Version: ${manifest.version}`);
    console.log(`   Manifest version: ${manifest.manifest_version}`);
  } catch (e) {
    console.log('❌ manifest.json is invalid JSON');
    missingFiles.push('manifest.json (invalid JSON)');
  }
} else {
  console.log('❌ manifest.json not found');
}

// Output results
console.log('\n📋 File Status:');
presentFiles.forEach(file => console.log(`  ${file}`));

if (missingFiles.length > 0) {
  console.log('\n❌ Missing Files:');
  missingFiles.forEach(file => console.log(`  ${file}`));
  console.log('\n❌ Extension is not ready to load');
  process.exit(1);
} else {
  console.log('\n✅ All required files present');
  console.log('✅ Extension is ready to load in Chrome');
  console.log('\n📝 Next steps:');
  console.log('   1. Open Chrome and go to chrome://extensions/');
  console.log('   2. Enable "Developer mode"');
  console.log('   3. Click "Load unpacked"');
  console.log('   4. Select this folder');
  process.exit(0);
}
