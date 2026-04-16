import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const rootPackageJson = JSON.parse(
  fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'),
);

const entrypointContracts = [
  {
    scriptName: 'check:arch',
    command: 'node scripts/check-arch-boundaries.mjs',
    filePath: path.join(rootDir, 'scripts', 'check-arch-boundaries.mjs'),
    exportedFunctionPattern: /export function runArchitectureBoundaryCheck\(/,
    launchPattern: /void runArchitectureBoundaryCheckCli\(\)/,
  },
  {
    scriptName: 'check:sdkwork-birdcoder-structure',
    command: 'node scripts/check-sdkwork-birdcoder-structure.mjs',
    filePath: path.join(rootDir, 'scripts', 'check-sdkwork-birdcoder-structure.mjs'),
    exportedFunctionPattern: /export function runSdkworkBirdcoderStructureCheck\(/,
    launchPattern: /void runSdkworkBirdcoderStructureCheckCli\(\)/,
  },
  {
    scriptName: 'generate:rust-host-engine-catalog',
    command: 'node --experimental-strip-types scripts/generate-rust-host-engine-catalog.ts',
    filePath: path.join(rootDir, 'scripts', 'generate-rust-host-engine-catalog.ts'),
    exportedFunctionPattern: /export function generateRustHostEngineCatalog\(/,
    launchPattern: /void generateRustHostEngineCatalogCli\(\)/,
  },
];

for (const contract of entrypointContracts) {
  const source = fs.readFileSync(contract.filePath, 'utf8');

  assert.equal(
    rootPackageJson.scripts[contract.scriptName],
    contract.command,
    `${contract.scriptName} must keep its governed package.json command binding.`,
  );
  assert.match(
    source,
    contract.exportedFunctionPattern,
    `${path.basename(contract.filePath)} must expose an explicit callable function instead of executing purely at import time.`,
  );
  assert.match(
    source,
    /pathToFileURL\(process\.argv\[1\]\)\.href/,
    `${path.basename(contract.filePath)} must gate CLI execution behind a direct-entry check.`,
  );
  assert.match(
    source,
    contract.launchPattern,
    `${path.basename(contract.filePath)} must launch its CLI path without coupling execution to module import.`,
  );
}

console.log('package script entrypoints contract passed.');
