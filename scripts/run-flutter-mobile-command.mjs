#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const flutterMobileRoot = path.join(rootDir, 'apps/sdkwork-birdcoder-flutter-mobile');

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error('Usage: node scripts/run-flutter-mobile-command.mjs <command> [args...]');
  process.exit(1);
}

const commandMap = {
  'pub-get': ['pub', 'get'],
  analyze: ['analyze', 'lib', 'test', 'packages'],
  test: ['test'],
  'build:android': ['build', 'apk', '--release'],
  'build:android:prod': ['build', 'appbundle', '--release'],
  'build:ios': ['build', 'ios', '--release', '--no-codesign'],
  'build:ios:prod': ['build', 'ipa', '--release', '--no-codesign'],
};

const flutterArgs = commandMap[command];
if (!flutterArgs) {
  console.error(`Unsupported flutter mobile command: ${command}`);
  process.exit(1);
}

const result = spawnSync('flutter', [...flutterArgs, ...args], {
  cwd: flutterMobileRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

process.exit(result.status ?? 1);
