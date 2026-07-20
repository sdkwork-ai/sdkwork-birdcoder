import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const runnerSource = fs.readFileSync(path.join(rootDir, 'scripts/run-flutter-mobile-command.mjs'), 'utf8');

const requiredScripts = [
  'install:flutter-android',
  'check:flutter-android',
  'test:flutter-android',
  'build:flutter-android',
  'build:flutter-android:full',
  'build:flutter-ios',
  'build:flutter-ios:full',
];

for (const scriptName of requiredScripts) {
  assert.ok(packageJson.scripts[scriptName], `Root package.json must expose ${scriptName}.`);
  assert.match(
    packageJson.scripts[scriptName],
    /run-flutter-mobile-command\.mjs/u,
    `${scriptName} must route through the flutter mobile command runner.`,
  );
}

assert.match(
  runnerSource,
  /apps\/sdkwork-birdcoder-flutter-mobile/u,
  'Flutter mobile command runner must target the BirdCoder Flutter app root.',
);

console.log('flutter mobile command runner contract passed.');
