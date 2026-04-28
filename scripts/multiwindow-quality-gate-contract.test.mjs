import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const rootDir = process.cwd();
const rootPackageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const qualityFastRunnerModule = await import(
  pathToFileURL(path.join(rootDir, 'scripts/run-quality-fast-check.mjs')).href,
);
const releaseFlowRunnerModule = await import(
  pathToFileURL(path.join(rootDir, 'scripts/run-release-flow-check.mjs')).href,
);
const governanceRegressionModule = await import(
  pathToFileURL(path.join(rootDir, 'scripts/governance-regression-report.mjs')).href,
);

const multiWindowStandardCommand = [
  'node scripts/multiwindow-quality-gate-contract.test.mjs',
  'node --experimental-strip-types scripts/multiwindow-runtime-contract.test.ts',
  'node scripts/multiwindow-page-contract.test.mjs',
  'node scripts/multiwindow-package-contract.test.mjs',
  'node scripts/multiwindow-shell-navigation-contract.test.mjs',
  'node scripts/multiwindow-turn-options-contract.test.mjs',
  'node scripts/multiwindow-release-writeback-contract.test.mjs',
  'node scripts/run-local-typescript.mjs --cwd packages/sdkwork-birdcoder-multiwindow --noEmit',
].join(' && ');

assert.equal(
  rootPackageJson.scripts['check:multiwindow-standard'],
  multiWindowStandardCommand,
  'Multi-window programming must have one root standard gate that covers package, shell, runtime, page, turn-options, release writeback, and package typecheck contracts.',
);
assert.equal(
  rootPackageJson.scripts['test:codeengine-turn-options-provider-contract'],
  'node scripts/codeengine-turn-options-provider-contract.test.mjs',
  'Codeengine turn-options provider propagation must have a direct root test script.',
);
assert.equal(
  qualityFastRunnerModule.QUALITY_FAST_CHECK_COMMANDS.includes(
    'node scripts/run-workspace-package-script.mjs . check:multiwindow-standard',
  ),
  true,
  'Fast quality gate must run the multi-window standard gate.',
);
assert.equal(
  releaseFlowRunnerModule.RELEASE_FLOW_CHECK_COMMANDS.includes(
    'node scripts/codeengine-turn-options-provider-contract.test.mjs',
  ),
  true,
  'Release-flow gate must run provider turn-options propagation contract.',
);
assert.deepEqual(
  governanceRegressionModule.ENGINE_GOVERNANCE_REGRESSION_CHECKS.find(
    (check) => check.id === 'codeengine-turn-options-provider',
  ),
  {
    id: 'codeengine-turn-options-provider',
    label: 'Codeengine turn options provider contract',
    scriptPath: 'scripts/codeengine-turn-options-provider-contract.test.mjs',
    command: 'pnpm run test:codeengine-turn-options-provider-contract',
  },
  'Engine governance regression report must track provider turn-options propagation.',
);

console.log('multi-window quality gate contract passed.');
