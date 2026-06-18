#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frameworkScript = path.resolve(
  __dirname,
  '..',
  '..',
  'sdkwork-app-topology',
  'scripts',
  'sdkwork-topology.mjs',
);

const result = spawnSync(process.execPath, [frameworkScript, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status ?? 1);
