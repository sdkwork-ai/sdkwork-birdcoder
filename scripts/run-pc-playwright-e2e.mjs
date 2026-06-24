#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(__filename), '..');
const pcAppDir = path.join(rootDir, 'apps/sdkwork-birdcoder-pc');
const playwrightCli = path.join(rootDir, 'node_modules/@playwright/test/cli.js');

if (!existsSync(playwrightCli)) {
  console.error('Missing @playwright/test. Run pnpm install from the repository root.');
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [playwrightCli, 'test', ...process.argv.slice(2)],
  {
    cwd: pcAppDir,
    env: process.env,
    stdio: 'inherit',
  },
);

process.exit(result.status ?? 1);
