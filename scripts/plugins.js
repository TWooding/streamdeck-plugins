#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.cwd();
const mode = process.argv[2] || 'dist';

function log(...args) {
  console.log('[plugins]', ...args);
}

const pluginDirs = fs.readdirSync(root, { withFileTypes: true })
  .filter(d => d.isDirectory() && /plugin$/i.test(d.name))
  .map(d => d.name);

if (pluginDirs.length === 0) {
  console.error('No plugin directories found (names ending with "plugin").');
  process.exit(0);
}

const sdpluginsDir = path.join(root, 'sdplugins');
if (!fs.existsSync(sdpluginsDir)) fs.mkdirSync(sdpluginsDir, { recursive: true });

function runCmd(cmd, args, cwd) {
  log('Running', cmd, args.join(' '), 'in', cwd);
  const res = spawnSync(cmd, args, { stdio: 'inherit', cwd, shell: true });
  if (res.status !== 0) {
    console.error(`Command failed: ${cmd} ${args.join(' ')} (cwd: ${cwd})`);
    process.exit(res.status || 1);
  }
}

function copyRecursiveSync(src, dest) {
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const child of fs.readdirSync(src)) {
      copyRecursiveSync(path.join(src, child), path.join(dest, child));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

for (const plugin of pluginDirs) {
  const pluginPath = path.join(root, plugin);
  log('Processing', plugin);

  // Build
  log('Building', plugin);
  if (fs.existsSync(path.join(pluginPath, 'package.json'))) {
    runCmd('npm', ['run', 'build'], pluginPath);
  } else if (fs.existsSync(path.join(pluginPath, 'rollup.config.mjs'))) {
    runCmd('npx', ['rollup', '-c'], pluginPath);
  } else {
    log('No build step found for', plugin, '- skipping build');
    continue;
  }

  // Copy .sdPlugin directories into ./sdplugins
  const entries = fs.readdirSync(pluginPath, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory() && e.name.endsWith('.sdPlugin')) {
      const src = path.join(pluginPath, e.name);
      const dest = path.join(sdpluginsDir, e.name);
      if (fs.existsSync(dest)) {
        log('Removing existing', dest);
        fs.rmSync(dest, { recursive: true, force: true });
      }
      log('Copying', src, '->', dest);
      if (fs.cpSync) {
        fs.cpSync(src, dest, { recursive: true });
      } else {
        copyRecursiveSync(src, dest);
      }
    }
  }

  if (mode === 'dist') {
    // Run plugin's dist if present (this will typically call streamdeck bundle using the plugin's devDependency)
    if (fs.existsSync(path.join(pluginPath, 'package.json'))) {
      log('Running dist for', plugin);
      runCmd('npm', ['run', 'dist'], pluginPath);
    } else {
      log('No package.json for', plugin, '- skipping dist step');
    }
  }
}

log('All done.');
process.exit(0);
