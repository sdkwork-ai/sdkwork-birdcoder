#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { chmodSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const h5DistDir = path.join(rootDir, 'apps/sdkwork-birdcoder-h5/dist');
const androidRoot = path.join(
  rootDir,
  'apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-capacitor/android',
);
const apkPath = path.join(androidRoot, 'app/build/outputs/apk/debug/app-debug.apk');

if (!existsSync(h5DistDir)) {
  console.error('H5 dist is missing. Run `pnpm h5:build` and `pnpm cap:sync` before assembling Android.');
  process.exit(1);
}

const gradlewName = process.platform === 'win32' ? 'gradlew.bat' : 'gradlew';
const gradlewPath = path.join(androidRoot, gradlewName);
if (!existsSync(gradlewPath)) {
  console.error(`Gradle wrapper not found at ${gradlewPath}`);
  process.exit(1);
}

if (process.platform !== 'win32') {
  chmodSync(path.join(androidRoot, 'gradlew'), 0o755);
}

const gradleArgs = process.platform === 'win32' ? [gradlewPath, 'assembleDebug'] : ['./gradlew', 'assembleDebug'];
const result = spawnSync(gradleArgs[0], gradleArgs.slice(1), {
  cwd: androidRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: process.env,
});

if ((result.status ?? 1) !== 0) {
  process.exit(result.status ?? 1);
}

if (!existsSync(apkPath)) {
  console.error(`Expected debug APK was not produced at ${apkPath}`);
  process.exit(1);
}

console.log(`Capacitor Android debug APK assembled at ${apkPath}`);
