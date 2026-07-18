import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

const packageJson = JSON.parse(read('package.json'));
const ciWorkflow = read('.github/workflows/ci.yml');
const assembleScript = read('scripts/run-h5-capacitor-android-assemble.mjs');
const appConfig = JSON.parse(read('sdkwork.app.config.json'));

assert.equal(
  packageJson.scripts['build:capacitor-android'],
  'node scripts/run-h5-capacitor-android-assemble.mjs',
  'Root package.json must expose build:capacitor-android for CI and operators.',
);

assert.match(
  assembleScript,
  /assembleDebug/u,
  'Android assemble runner must invoke Gradle assembleDebug.',
);
assert.match(
  assembleScript,
  /app-debug\.apk/u,
  'Android assemble runner must verify the debug APK output path.',
);
assert.match(
  assembleScript,
  /build:browser/u,
  'Android assemble runner must document the H5 build prerequisite.',
);

assert.match(
  ciWorkflow,
  /mobile-surfaces:[\s\S]*setup-java[\s\S]*build:capacitor-android/u,
  'CI mobile-surfaces job must setup Java and run build:capacitor-android.',
);
assert.match(
  ciWorkflow,
  /setup-android/u,
  'CI mobile-surfaces job must provision the Android SDK before Gradle assemble.',
);

assert.match(
  String(appConfig.metadata?.commercialReadiness?.mobileProductParity ?? ''),
  /android-assemble|capacitor-android-assemble/u,
  'Root manifest must record Capacitor Android assemble alignment.',
);

console.log('h5 capacitor android assemble contract passed.');
