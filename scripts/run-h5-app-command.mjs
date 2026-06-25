#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const h5AppRoot = path.join(rootDir, 'apps/sdkwork-birdcoder-h5');

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error('Usage: node scripts/run-h5-app-command.mjs <command> [args...]');
  process.exit(1);
}

const commandMap = {
  typecheck: ['exec', 'tsc', '--noEmit'],
  build: ['run', 'build'],
};

const pnpmArgs = commandMap[command];
if (!pnpmArgs) {
  console.error(`Unsupported H5 app command: ${command}`);
  process.exit(1);
}

const result = spawnSync('pnpm', [...pnpmArgs, ...args], {
  cwd: h5AppRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

process.exit(result.status ?? 1);
