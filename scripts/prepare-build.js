#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

/**
 * Deeply merge two objects
 */
function deepMerge(base, override) {
  if (!override) return base;
  const result = { ...base };
  for (const key of Object.keys(override)) {
    const baseVal = result[key];
    const overVal = override[key];
    if (
      baseVal && overVal &&
      typeof baseVal === 'object' && !Array.isArray(baseVal) &&
      typeof overVal === 'object' && !Array.isArray(overVal)
    ) {
      result[key] = deepMerge(baseVal, overVal);
    } else if (overVal !== undefined) {
      result[key] = overVal;
    }
  }
  return result;
}

/**
 * Read and parse JSON file
 */
function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

// Main execution
const rootDir = path.resolve(__dirname, '..');

// 1. Read build.config files with proper merge order
const baseConfig = readJSON(path.join(rootDir, 'build.config.json'));
const localConfig = readJSON(path.join(rootDir, 'build.config.local.json'));
const buildConfig = deepMerge(baseConfig || {}, localConfig);

// 2. Validate required fields
if (!buildConfig.app || !buildConfig.app.identifier || !buildConfig.app.updater) {
  console.error('❌ Error: Invalid build.config - missing app.identifier or app.updater');
  console.error('   Required fields:');
  console.error('   - app.identifier: Application identifier (e.g., "com.teamclaw.app")');
  console.error('   - app.updater.endpoint: Update manifest endpoint URL');
  console.error('   - app.updater.pubkey: Public key for signature verification');
  process.exit(1);
}

console.log('🔧 Configuring build from build.config.json:');
console.log(`   Identifier: ${buildConfig.app.identifier}`);
console.log(`   Updater endpoint: ${buildConfig.app.updater.endpoint}`);

// 3. Read tauri.conf.json
const tauriConfPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json');
const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));

// 4. Update tauri.conf.json with build config
tauriConf.identifier = buildConfig.app.identifier;
tauriConf.plugins.updater.pubkey = buildConfig.app.updater.pubkey;
tauriConf.plugins.updater.endpoints = [buildConfig.app.updater.endpoint];

// 5. Write updated tauri.conf.json
fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
console.log('✅ tauri.conf.json updated successfully');
