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
    command:
      'node scripts/check-arch-boundaries.mjs && node scripts/commercial-alignment-contract.test.mjs && node scripts/commercial-readiness-truth-contract.test.mjs && node scripts/release-rehearsal-readiness-contract.test.mjs && node scripts/prelaunch-publish-gate-contract.test.mjs && node scripts/pc-server-module-size-contract.test.mjs && node scripts/coding-server-openapi-rust-defer-registry-contract.test.mjs && node scripts/production-deployment-mode-contract.test.mjs && node scripts/problem-json-response-contract.test.mjs && node scripts/desktop-app-session-persistence-contract.test.mjs && node scripts/commercial-postgresql-ha-readiness-contract.test.mjs && node scripts/postgresql-ha-values-contract.test.mjs && node scripts/workspace-realtime-redis-contract.test.mjs && node scripts/workspace-realtime-reconnect-contract.test.mjs && node scripts/settings-surface-honesty-contract.test.mjs && node scripts/docker-container-readiness-contract.test.mjs && node scripts/publish-runtime-truth-contract.test.mjs && node scripts/release/release-build-paths-contract.test.mjs && node scripts/birdcoder-iam-workspace-path-contract.test.mjs && node scripts/birdcoder-app-shell-componentization-contract.test.mjs && node scripts/app-sdk-surface-boundary-contract.test.mjs && node scripts/pc-architecture-layout-contract.test.mjs && node scripts/database-drift-policy-contract.test.mjs',
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
  {
    scriptName: 'typecheck',
    command: 'node scripts/run-local-typescript.mjs --noEmit',
    filePath: path.join(rootDir, 'scripts', 'run-local-typescript.mjs'),
    exportedFunctionPattern: /export function createLocalTypescriptPlan\(/,
    launchPattern: /runLocalTypescriptCli\(\)\.catch\(/,
  },
  {
    scriptName: 'check:workspace-package-script-runner',
    command: 'node scripts/workspace-package-script-runner-contract.test.mjs',
    filePath: path.join(rootDir, 'scripts', 'workspace-package-script-runner-contract.test.mjs'),
    exportedFunctionPattern: /export function runWorkspacePackageScriptRunnerContract\(/,
    launchPattern: /void runWorkspacePackageScriptRunnerContractCli\(\)\.catch\(/,
  },
  {
    scriptName: 'check:tauri-dev-binary-unlock',
    command: 'node scripts/run-tauri-dev-binary-unlock-check.mjs',
    filePath: path.join(rootDir, 'scripts', 'run-tauri-dev-binary-unlock-check.mjs'),
    exportedFunctionPattern: /export function runTauriDevBinaryUnlockCheck\(/,
    launchPattern: /process\.exit\(runTauriDevBinaryUnlockCheck\(\)\)/,
  },
  {
    scriptName: 'lint',
    command: 'node scripts/run-quality-fast-check.mjs',
    filePath: path.join(rootDir, 'scripts', 'run-quality-fast-check.mjs'),
    exportedFunctionPattern: /export function runQualityFastCheck\(/,
    launchPattern: /process\.exit\(runQualityFastCheck\(\)\)/,
  },
  {
    scriptName: 'check:quality:standard',
    command: 'node scripts/run-quality-standard-check.mjs',
    filePath: path.join(rootDir, 'scripts', 'run-quality-standard-check.mjs'),
    exportedFunctionPattern: /export function runQualityStandardCheck\(/,
    launchPattern: /process\.exit\(runQualityStandardCheck\(\)\)/,
  },
  {
    scriptName: 'check:quality:release',
    command: 'node scripts/run-quality-release-check.mjs',
    filePath: path.join(rootDir, 'scripts', 'run-quality-release-check.mjs'),
    exportedFunctionPattern: /export function runQualityReleaseCheck\(/,
    launchPattern: /process\.exit\(runQualityReleaseCheck\(\)\)/,
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
