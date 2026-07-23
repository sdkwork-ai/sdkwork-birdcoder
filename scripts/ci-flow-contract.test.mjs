import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const rootDir = process.cwd();
const ciWorkflow = fs
  .readFileSync(path.join(rootDir, '.github/workflows/ci.yml'), 'utf8')
  .replaceAll('\r\n', '\n');
const rootPackageJson = JSON.parse(
  fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'),
);
const qualityFastRunnerModule = await import(
  pathToFileURL(path.join(rootDir, 'scripts/run-quality-fast-check.mjs')).href
);
const qualityStandardRunnerModule = await import(
  pathToFileURL(path.join(rootDir, 'scripts/run-quality-standard-check.mjs')).href
);
const qualityReleaseRunnerModule = await import(
  pathToFileURL(path.join(rootDir, 'scripts/run-quality-release-check.mjs')).href
);

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractWorkflowStepBlocks(workflowSource, stepName) {
  return [...workflowSource.matchAll(
    new RegExp(`\\n\\s*- name: ${escapeRegex(stepName)}\\n[\\s\\S]*?(?=\\n\\s*- name: |\\n\\s{2}[A-Za-z0-9_-]+:|\\n\\s*$)`, 'g'),
  )].map((match) => match[0]);
}

function assertPrepareSharedSdkStepsUseGithubToken(workflowSource, workflowName) {
  assert.match(
    workflowSource,
    /SDKWORK_SHARED_SDK_GITHUB_TOKEN:\s*\$\{\{\s*secrets\.SDKWORK_SHARED_SDK_GITHUB_TOKEN\s*\|\|\s*github\.token\s*\}\}/u,
    `${workflowName} must expose the governed shared SDK GitHub token fallback.`,
  );
  assert.match(
    workflowSource,
    /SDKWORK_SHARED_SDK_GIT_PROTOCOL:\s*ssh/u,
    `${workflowName} must request SSH transport for private shared SDK sources.`,
  );
  assert.match(
    workflowSource,
    /webfactory\/ssh-agent@v[0-9]+/u,
    `${workflowName} must configure ssh-agent before private SDK clones.`,
  );
  assert.match(
    workflowSource,
    /SDKWORK_SHARED_SDK_SSH_PRIVATE_KEY/u,
    `${workflowName} must use the shared SDK deploy-key secret.`,
  );

  const prepareSteps = extractWorkflowStepBlocks(workflowSource, 'Prepare shared SDK sources');
  assert.ok(prepareSteps.length > 0, `${workflowName} must prepare shared SDK sources.`);
  for (const prepareStep of prepareSteps) {
    assert.match(prepareStep, /prepare-shared-sdk-git-sources\.mjs/u);
  }
}

function assertRootQualityCommandsExist(commands, label) {
  for (const command of commands) {
    const match = command.match(
      /^node scripts\/run-workspace-package-script\.mjs \. ([a-z0-9:-]+)$/u,
    );
    assert.ok(match, `${label} contains a non-canonical root command: ${command}`);
    assert.equal(
      typeof rootPackageJson.scripts[match[1]],
      'string',
      `${label} references missing root script ${match[1]}.`,
    );
  }
}

assert.match(ciWorkflow, /concurrency:/u);
assert.match(ciWorkflow, /pnpm-lock\.yaml/u);
assert.match(ciWorkflow, /SDKWORK_SHARED_SDK_MODE:\s*git/u);
assert.equal(fs.existsSync(path.join(rootDir, 'sdkwork-run-node')), true);
assert.equal(fs.existsSync(path.join(rootDir, 'sdkwork-run-pnpm')), true);
assert.match(
  ciWorkflow,
  /Expose workspace command wrappers[\s\S]*command -v cygpath[\s\S]*chmod \+x "\$\{workspace_path\}\/sdkwork-run-node" "\$\{workspace_path\}\/sdkwork-run-pnpm"[\s\S]*printf '%s\\n' "\$GITHUB_WORKSPACE" >> "\$\{github_path_file\}"/u,
  'CI must expose the checked-in cross-platform command wrappers before pnpm scripts run.',
);
assert.equal(
  ciWorkflow.match(/Expose workspace command wrappers/gu)?.length ?? 0,
  3,
  'Every pnpm lifecycle job must expose the workspace command wrappers.',
);
assert.doesNotMatch(
  ciWorkflow,
  /uses: pnpm\/action-setup@v4[\s\S]{0,80}version:\s*10/u,
  'CI must read the single pnpm version authority from packageManager.',
);
assert.match(ciWorkflow, /uses:\s*dtolnay\/rust-toolchain@1\.90\.0/u);
assert.doesNotMatch(ciWorkflow, /uses:\s*dtolnay\/rust-toolchain@1\.91\.1/u);
assertPrepareSharedSdkStepsUseGithubToken(ciWorkflow, 'CI workflow');

for (const requiredPattern of [
  /pnpm sdk:prepare/u,
  /pnpm lint/u,
  /pnpm check:desktop/u,
  /pnpm check:server/u,
  /pnpm build:server/u,
  /pnpm docs:build/u,
  /run-pc-playwright-e2e\.mjs/u,
  /playwright install chromium/u,
  /Run governance regression report[\s\S]*pnpm check:governance-regression/u,
  /node scripts\/run-cargo\.mjs test --manifest-path apps\/sdkwork-birdcoder-pc\/packages\/sdkwork-birdcoder-pc-desktop\/src-tauri\/Cargo\.toml/u,
]) {
  assert.match(ciWorkflow, requiredPattern);
}

assert.doesNotMatch(
  ciWorkflow,
  /postgresql-live-smoke|postgres:16-alpine|SDKWORK_BIRDCODER_POSTGRES_TEST_URL|release:smoke:postgresql-live/u,
  'CI must not provision an application-owned database for stateless BirdCoder verification.',
);
assert.match(
  ciWorkflow,
  /mobile-surfaces:[\s\S]*pnpm typecheck:browser[\s\S]*pnpm build:browser[\s\S]*pnpm build:capacitor-android:sync[\s\S]*setup-java[\s\S]*setup-android[\s\S]*pnpm build:capacitor-android[\s\S]*pnpm check:flutter-android[\s\S]*pnpm test:flutter-android[\s\S]*h5-capacitor-native-platform-contract\.test\.mjs/u,
  'CI must verify H5, Capacitor Android, and Flutter mobile surfaces.',
);
assert.match(ciWorkflow, /pnpm release:fixture:ready/u);
assert.match(ciWorkflow, /pnpm release:candidate:dry-run/u);
assert.match(
  ciWorkflow,
  /name:\s*Prove release candidate dry-run success path[\s\S]*run:\s*pnpm release:candidate:dry-run[\s\S]*name:\s*Upload release candidate dry-run evidence[\s\S]*uses:\s*actions\/upload-artifact@v4[\s\S]*name:\s*release-candidate-dry-run-evidence[\s\S]*path:\s*artifacts\/release-candidate-dry-run[\s\S]*if-no-files-found:\s*error[\s\S]*retention-days:\s*30/u,
  'CI must retain release candidate evidence as a stable audit artifact.',
);
assert.match(ciWorkflow, /libgbm-dev/u);
assert.match(ciWorkflow, /libpipewire-0\.3-dev/u);
assert.match(ciWorkflow, /desktop-rust-windows:/u);
assert.equal(
  fs.existsSync(path.join(rootDir, '.github/workflows/user-center-upstream-sync.yml')),
  false,
);

assert.equal(rootPackageJson.scripts.typecheck, 'node scripts/run-local-typescript.mjs --noEmit');
assert.equal(rootPackageJson.scripts.lint, 'node scripts/run-quality-fast-check.mjs');
assert.equal(rootPackageJson.scripts['check:quality:fast'], rootPackageJson.scripts.lint);
assert.equal(
  rootPackageJson.scripts['check:quality:standard'],
  'node scripts/run-quality-standard-check.mjs',
);
assert.equal(
  rootPackageJson.scripts['check:quality:release'],
  'node scripts/run-quality-release-check.mjs',
);
assert.equal(
  rootPackageJson.scripts['check:quality-matrix'],
  'node scripts/quality-gate-matrix-contract.test.mjs',
);
assert.equal(
  rootPackageJson.scripts['check:quality-report'],
  'node scripts/quality-gate-matrix-report.mjs',
);
assert.equal(
  rootPackageJson.scripts['release:fixture:ready'],
  'node scripts/release/write-readiness-fixture.mjs',
);
assert.equal(
  rootPackageJson.scripts['release:candidate:dry-run'],
  'node scripts/release/candidate-dry-run.mjs',
);
assert.equal(rootPackageJson.scripts['release:smoke:postgresql-live'], undefined);

for (const retiredScript of [
  'check:workbench-session-standard',
  'check:project-inventory-standard',
  'check:project-session-index-performance',
  'check:code-session-standard',
  'check:data-kernel',
  'test:user-center-standard',
]) {
  assert.equal(
    rootPackageJson.scripts[retiredScript],
    undefined,
    `Root CI must not retain retired authority command ${retiredScript}.`,
  );
}

const expectedFastChecks = [
  'node scripts/run-workspace-package-script.mjs . typecheck',
  'node scripts/run-workspace-package-script.mjs . check:package-script-entrypoints',
  'node scripts/run-workspace-package-script.mjs . check:source-parse',
  'node scripts/run-workspace-package-script.mjs . check:api-transport-standard',
  'node scripts/run-workspace-package-script.mjs . check:local-business-storage-boundary',
  'node scripts/run-workspace-package-script.mjs . check:domain-ownership',
  'node scripts/run-workspace-package-script.mjs . check:agents-birdcoder-alignment',
  'node scripts/run-workspace-package-script.mjs . check:kernel-birdcoder-alignment',
  'node scripts/run-workspace-package-script.mjs . test:agent-session-item-view-contract',
  'node scripts/run-workspace-package-script.mjs . test:agent-session-item-semantic-boundary-contract',
  'node scripts/run-workspace-package-script.mjs . check:sdk-family-standard',
  'node scripts/run-workspace-package-script.mjs . check:sdk-family-generated',
  'node scripts/run-workspace-package-script.mjs . check:package-governance',
  'node scripts/run-workspace-package-script.mjs . check:package-subpath-exports',
  'node scripts/run-workspace-package-script.mjs . check:app-composition',
  'node scripts/run-workspace-package-script.mjs . check:technical-debt',
  'node scripts/run-workspace-package-script.mjs . check:arch',
  'node scripts/run-workspace-package-script.mjs . check:sdkwork-birdcoder-structure',
];
const expectedStandardChecks = [
  'node scripts/run-workspace-package-script.mjs . check:quality:mobile',
  'node scripts/run-workspace-package-script.mjs . check:desktop',
  'node scripts/run-workspace-package-script.mjs . check:server',
  'node scripts/run-workspace-package-script.mjs . check:web-vite-build',
  'node scripts/run-workspace-package-script.mjs . check:web-bundle-budget',
  'node scripts/run-workspace-package-script.mjs . build:server',
  'node scripts/run-workspace-package-script.mjs . docs:build',
];
const expectedReleaseChecks = [
  'node scripts/run-workspace-package-script.mjs . check:quality:fast',
  'node scripts/run-workspace-package-script.mjs . check:quality:standard',
  'node scripts/run-workspace-package-script.mjs . check:quality-matrix',
  'node scripts/run-workspace-package-script.mjs . check:release-flow',
  'node scripts/run-workspace-package-script.mjs . check:ci-flow',
  'node scripts/run-workspace-package-script.mjs . check:governance-regression',
];

assert.deepEqual(qualityFastRunnerModule.QUALITY_FAST_CHECK_COMMANDS, expectedFastChecks);
assert.deepEqual(qualityStandardRunnerModule.QUALITY_STANDARD_CHECK_COMMANDS, expectedStandardChecks);
assert.deepEqual(qualityReleaseRunnerModule.QUALITY_RELEASE_CHECK_COMMANDS, expectedReleaseChecks);
assertRootQualityCommandsExist(expectedFastChecks, 'fast quality runner');
assertRootQualityCommandsExist(expectedStandardChecks, 'standard quality runner');
assertRootQualityCommandsExist(expectedReleaseChecks, 'release quality runner');

console.log('ci flow contract passed.');
