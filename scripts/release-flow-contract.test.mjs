import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const rootDir = process.cwd();

function readWorkflowSource(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8').replaceAll('\r\n', '\n');
}

const reusableWorkflow = readWorkflowSource('.github/workflows/release-reusable.yml');
const releaseWorkflow = readWorkflowSource('.github/workflows/release.yml');
const nodeWrapperPath = path.join(rootDir, 'sdkwork-run-node');
const pnpmWrapperPath = path.join(rootDir, 'sdkwork-run-pnpm');
const rootPackageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const webPackageJson = JSON.parse(
  fs.readFileSync(path.join(rootDir, 'packages/sdkwork-birdcoder-web/package.json'), 'utf8'),
);
const releaseFlowRunnerModule = await import(
  pathToFileURL(path.join(rootDir, 'scripts/run-release-flow-check.mjs')).href
);
const qualityStandardRunnerModule = await import(
  pathToFileURL(path.join(rootDir, 'scripts/run-quality-standard-check.mjs')).href
);
const qualityReleaseRunnerModule = await import(
  pathToFileURL(path.join(rootDir, 'scripts/run-quality-release-check.mjs')).href
);
const releaseFlowCommandsJoined = releaseFlowRunnerModule.RELEASE_FLOW_CHECK_COMMANDS.join(' && ');

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractWorkflowStepBlock(workflowSource, stepName) {
  const match = workflowSource.match(
    new RegExp(`\\n\\s*- name: ${escapeRegex(stepName)}\\n[\\s\\S]*?(?=\\n\\s*- name: |\\n\\s{2}[A-Za-z0-9_-]+:|\\n\\s*$)`),
  );
  assert.ok(match, `Missing workflow step: ${stepName}`);
  return match[0];
}

function extractWorkflowStepBlocks(workflowSource, stepName) {
  return [...workflowSource.matchAll(
    new RegExp(`\\n\\s*- name: ${escapeRegex(stepName)}\\n[\\s\\S]*?(?=\\n\\s*- name: |\\n\\s{2}[A-Za-z0-9_-]+:|\\n\\s*$)`, 'g'),
  )].map((match) => match[0]);
}

function assertPrepareSharedSdkStepsUseGithubToken(workflowSource) {
  assert.match(
    workflowSource,
    /SDKWORK_SHARED_SDK_GITHUB_TOKEN:\s*\$\{\{\s*secrets\.SDKWORK_SHARED_SDK_GITHUB_TOKEN\s*\|\|\s*github\.token\s*\}\}/u,
    'Release workflow must expose a shared SDK GitHub token env with an org secret fallback before private SDK repository clones run.',
  );
  assert.match(
    workflowSource,
    /SDKWORK_SHARED_SDK_GIT_PROTOCOL:\s*ssh/u,
    'Release workflow must request SSH transport for private shared SDK release sources.',
  );

  const prepareSteps = extractWorkflowStepBlocks(workflowSource, 'Prepare shared SDK sources');
  assert.ok(prepareSteps.length > 0, 'Release workflow must prepare shared SDK sources.');

  assert.match(
    workflowSource,
    /webfactory\/ssh-agent@v[0-9]+/u,
    'Release workflow must configure ssh-agent before preparing private shared SDK sources.',
  );
  assert.match(
    workflowSource,
    /SDKWORK_SHARED_SDK_SSH_PRIVATE_KEY/u,
    'Release workflow must use the shared SDK SSH deploy key secret for passwordless private repository clones.',
  );

  for (const prepareStep of prepareSteps) {
    assert.match(
      prepareStep,
      /prepare-shared-sdk-git-sources\.mjs/u,
      'Release shared SDK preparation must use the governed git-source materializer.',
    );
  }
}

function assertSetupNodeStepsHavePnpmActionSetup(workflowSource) {
  const lines = workflowSource.split(/\r?\n/u);
  const setupNodeLineIndexes = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => /^\s*- name: Setup Node\.js\s*$/u.test(line))
    .map(({ index }) => index);

  assert.ok(setupNodeLineIndexes.length > 0, 'Release workflow must configure Node.js in at least one job.');

  for (const setupNodeLineIndex of setupNodeLineIndexes) {
    const jobStartLineIndex = lines
      .slice(0, setupNodeLineIndex)
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => /^  [A-Za-z0-9_-]+:\s*$/u.test(line))
      .at(-1)?.index ?? -1;
    const priorJobLines = lines.slice(jobStartLineIndex + 1, setupNodeLineIndex);
    const hasPriorPnpmSetup = priorJobLines.some((line) => /^\s*- name: Setup pnpm\s*$/u.test(line));

    assert.ok(
      hasPriorPnpmSetup,
      'Every release workflow job that runs actions/setup-node@v5 must run pnpm/action-setup@v4 earlier in the same job so setup-node package-manager cache resolution can find pnpm.',
    );
  }
}

function assertSetupNodeCacheMatchesInstallIntent(workflowSource) {
  const jobBlocks = [...workflowSource.matchAll(/\n  ([A-Za-z0-9_-]+):\n([\s\S]*?)(?=\n  [A-Za-z0-9_-]+:\n|\n\S|$)/g)];

  for (const [, jobName, jobBlock] of jobBlocks) {
    if (!/- name: Setup Node\.js/u.test(jobBlock)) {
      continue;
    }

    const setupNodeStep = extractWorkflowStepBlock(jobBlock, 'Setup Node.js');
    const installsWorkspaceDependencies =
      /- name: Install workspace dependencies[\s\S]*?run:\s*pnpm install --frozen-lockfile/u.test(jobBlock);

    if (installsWorkspaceDependencies) {
      assert.match(
        setupNodeStep,
        /cache:\s*pnpm/u,
        `${jobName} installs dependencies and should retain explicit pnpm cache configuration.`,
      );
      assert.doesNotMatch(
        setupNodeStep,
        /package-manager-cache:\s*false/u,
        `${jobName} installs dependencies and must not disable setup-node package-manager caching while also declaring cache: pnpm.`,
      );
      continue;
    }

    assert.match(
      setupNodeStep,
      /package-manager-cache:\s*false/u,
      `${jobName} does not run pnpm install, so setup-node automatic package-manager cache must be disabled to avoid post-job cache path failures.`,
    );
  }
}

assert.match(releaseWorkflow, /name:\s*release/);
assert.match(releaseWorkflow, /push:\s*[\s\S]*tags:\s*[\s\S]*-\s*'release-\*'/);
assert.match(releaseWorkflow, /uses:\s*\.\/\.github\/workflows\/release-reusable\.yml/);
assert.match(releaseWorkflow, /release_profile:\s*sdkwork-birdcoder/);
assert.doesNotMatch(releaseWorkflow, /release_profile:\s*claw-studio/);

assert.match(reusableWorkflow, /SDKWORK_SHARED_SDK_MODE:\s*git/);
assert.equal(
  fs.existsSync(nodeWrapperPath),
  true,
  'release Linux and macOS runners need a POSIX sdkwork-run-node wrapper because package scripts invoke sdkwork-run-node without a .cmd extension.',
);
assert.equal(
  fs.existsSync(pnpmWrapperPath),
  true,
  'release Linux and macOS runners need a POSIX sdkwork-run-pnpm wrapper because package scripts invoke sdkwork-run-pnpm without a .cmd extension.',
);
assert.match(
  reusableWorkflow,
  /Expose workspace command wrappers[\s\S]*command -v cygpath[\s\S]*chmod \+x "\$\{workspace_path\}\/sdkwork-run-node" "\$\{workspace_path\}\/sdkwork-run-pnpm"[\s\S]*printf '%s\\n' "\$GITHUB_WORKSPACE" >> "\$\{github_path_file\}"/,
  'release jobs must add the checked-out workspace root to PATH before running pnpm scripts that call sdkwork-run-node or sdkwork-run-pnpm.',
);
assert.equal(
  reusableWorkflow.match(/Expose workspace command wrappers/g)?.length ?? 0,
  5,
  'release workflow must expose workspace command wrappers in every job that runs pnpm lifecycle scripts.',
);
assert.doesNotMatch(
  reusableWorkflow,
  /uses: pnpm\/action-setup@v4[\s\S]{0,80}version:\s*10/,
  'Release workflow must let pnpm/action-setup read pnpm@10.30.2 from packageManager instead of specifying a second pnpm version.',
);
assert.match(
  reusableWorkflow,
  /uses:\s*dtolnay\/rust-toolchain@1\.90\.0/,
  'Release workflow must install the Claw-aligned Rust 1.90.0 toolchain that stabilizes release SDK builds.',
);
assert.doesNotMatch(
  reusableWorkflow,
  /uses:\s*dtolnay\/rust-toolchain@1\.91\.1/,
  'Release workflow must not drift back to Rust 1.91.1 while the Claw release SDK build baseline is pinned to 1.90.0.',
);
assertSetupNodeStepsHavePnpmActionSetup(reusableWorkflow);
assertSetupNodeCacheMatchesInstallIntent(reusableWorkflow);
assert.match(reusableWorkflow, /prepare-shared-sdk-git-sources\.mjs/);
assertPrepareSharedSdkStepsUseGithubToken(reusableWorkflow);
assert.match(reusableWorkflow, /pnpm prepare:shared-sdk/);
assert.match(
  reusableWorkflow,
  /node scripts\/run-cargo\.mjs test --manifest-path packages\/sdkwork-birdcoder-desktop\/src-tauri\/Cargo\.toml/,
);
assert.match(reusableWorkflow, /actions\/attest-build-provenance@v3/);
assert.match(reusableWorkflow, /docker\/build-push-action@v6/);
assert.match(reusableWorkflow, /azure\/setup-helm@v4/);
assert.match(reusableWorkflow, /azure\/setup-kubectl@v4/);
assert.match(reusableWorkflow, /container-image-metadata-\$\{\{ matrix\.arch \}\}/);
assert.match(reusableWorkflow, /run-desktop-release-build\.mjs --profile .* --phase sync/);
assert.match(reusableWorkflow, /run-desktop-release-build\.mjs --profile .* --phase prepare-target/);
assert.match(reusableWorkflow, /run-desktop-release-build\.mjs --profile .* --phase prepare-openclaw/);
assert.match(
  reusableWorkflow,
  /run-desktop-release-build\.mjs --profile .* --phase bundle[\s\S]*--bundles \$\{\{ join\(matrix\.bundles, ','\) \}\}/,
  'release workflow desktop bundle steps must pass matrix.bundles explicitly so build intent cannot silently drift from release coverage.',
);
assert.match(reusableWorkflow, /Build Claw Studio desktop bundle on Windows/);
assert.match(reusableWorkflow, /Build Claw Studio desktop bundle on Unix/);
assert.match(
  reusableWorkflow,
  /preflight-desktop-signing-environment\.mjs[\s\S]*run-desktop-release-build\.mjs --profile .* --phase bundle[\s\S]*package-release-assets\.mjs desktop[\s\S]*verify-desktop-installer-trust\.mjs[\s\S]*smoke-desktop-installers\.mjs/,
  'desktop release workflow must preflight signing credentials and tools before bundling, then verify real platform installer trust after packaging and before installer smoke.',
);
const windowsDesktopSigningPreflightStep = extractWorkflowStepBlock(
  reusableWorkflow,
  'Preflight Windows desktop signing environment',
);
assert.match(windowsDesktopSigningPreflightStep, /if: matrix\.platform == 'windows'/);
assert.match(windowsDesktopSigningPreflightStep, /BIRDCODER_WINDOWS_SIGNING_CERT_SHA1:\s*\$\{\{ secrets\.BIRDCODER_WINDOWS_SIGNING_CERT_SHA1 \}\}/);
assert.match(windowsDesktopSigningPreflightStep, /BIRDCODER_WINDOWS_SIGNING_TIMESTAMP_URL:\s*\$\{\{ secrets\.BIRDCODER_WINDOWS_SIGNING_TIMESTAMP_URL \}\}/);
assert.doesNotMatch(
  windowsDesktopSigningPreflightStep,
  /APPLE_|APP_STORE_CONNECT_/,
  'Windows desktop signing preflight must not receive Apple notarization secrets.',
);
const macosDesktopSigningPreflightStep = extractWorkflowStepBlock(
  reusableWorkflow,
  'Preflight macOS desktop signing environment',
);
assert.match(macosDesktopSigningPreflightStep, /if: matrix\.platform == 'macos'/);
assert.match(macosDesktopSigningPreflightStep, /BIRDCODER_MACOS_CODESIGN_IDENTITY:\s*\$\{\{ secrets\.BIRDCODER_MACOS_CODESIGN_IDENTITY \}\}/);
assert.match(macosDesktopSigningPreflightStep, /APPLE_APP_SPECIFIC_PASSWORD:\s*\$\{\{ secrets\.APPLE_APP_SPECIFIC_PASSWORD \}\}/);
assert.match(macosDesktopSigningPreflightStep, /APP_STORE_CONNECT_API_KEY:\s*\$\{\{ secrets\.APP_STORE_CONNECT_API_KEY \}\}/);
assert.doesNotMatch(
  macosDesktopSigningPreflightStep,
  /BIRDCODER_WINDOWS_SIGNING_/,
  'macOS desktop signing preflight must not receive Windows Authenticode secrets.',
);
const linuxDesktopSigningPreflightStep = extractWorkflowStepBlock(
  reusableWorkflow,
  'Preflight Linux desktop package metadata environment',
);
assert.match(linuxDesktopSigningPreflightStep, /if: matrix\.platform == 'linux'/);
assert.doesNotMatch(
  linuxDesktopSigningPreflightStep,
  /secrets\./,
  'Linux desktop package metadata preflight must not receive signing secrets.',
);
assert.match(reusableWorkflow, /smoke-desktop-packaged-launch\.mjs/);
assert.doesNotMatch(reusableWorkflow, /smoke-desktop-startup-evidence\.mjs/);
assert.match(reusableWorkflow, /run-claw-server-build\.mjs/);
assert.match(reusableWorkflow, /smoke-server-release-assets\.mjs/);
assert.match(reusableWorkflow, /smoke-deployment-release-assets\.mjs --family container/);
assert.match(reusableWorkflow, /smoke-deployment-release-assets\.mjs --family kubernetes/);
assert.doesNotMatch(reusableWorkflow, /smoke-release-assets\.mjs web/);
assert.match(
  reusableWorkflow,
  /render-release-notes\.mjs --release-tag .* --output release-assets\/release-notes\.md[\s\S]*finalize-release-assets\.mjs[\s\S]*smoke-finalized-release-assets\.mjs --release-assets-dir release-assets[\s\S]*Attest finalized release assets[\s\S]*write-attestation-evidence\.mjs --profile \$\{\{ inputs\.release_profile \}\} --release-assets-dir release-assets --repository \$\{\{ github\.repository \}\} --release-tag \$\{\{ needs\.prepare\.outputs\.release_tag \}\}[\s\S]*assert-release-readiness\.mjs --profile \$\{\{ inputs\.release_profile \}\} --release-assets-dir release-assets/,
  'publish workflow must render notes before finalization, finalize and smoke immutable assets, attest them, write verified attestation evidence, and assert readiness before publication.',
);
assert.doesNotMatch(
  reusableWorkflow,
  /Finalize release assets[\s\S]*--allow-partial-release[\s\S]*Assert release readiness[\s\S]*Render release notes/,
  'GitHub release finalization must not publish partial release manifests',
);
assert.match(reusableWorkflow, /render-release-notes\.mjs --release-tag .* --output release-assets\/release-notes\.md/);

assert.equal(rootPackageJson.scripts['check:release-flow'], 'node scripts/run-release-flow-check.mjs');
assert.ok(Array.isArray(releaseFlowRunnerModule.RELEASE_FLOW_CHECK_COMMANDS));
assert.equal(releaseFlowRunnerModule.RELEASE_FLOW_CHECK_COMMANDS.length > 0, true);
assert.match(releaseFlowCommandsJoined, /release-flow-contract\.test\.mjs/);
assert.match(releaseFlowCommandsJoined, /run-release-flow-check\.test\.mjs/);
assert.match(releaseFlowCommandsJoined, /host-runtime-contract\.test\.ts/);
assert.match(releaseFlowCommandsJoined, /host-studio-preview-contract\.test\.ts/);
assert.match(releaseFlowCommandsJoined, /host-studio-simulator-contract\.test\.ts/);
assert.match(releaseFlowCommandsJoined, /studio-preview-execution-contract\.test\.ts/);
assert.match(releaseFlowCommandsJoined, /studio-preview-evidence-store-contract\.test\.ts/);
assert.match(releaseFlowCommandsJoined, /studio-build-execution-contract\.test\.ts/);
assert.match(releaseFlowCommandsJoined, /studio-build-evidence-store-contract\.test\.ts/);
assert.match(releaseFlowCommandsJoined, /studio-test-execution-contract\.test\.ts/);
assert.match(releaseFlowCommandsJoined, /studio-test-evidence-store-contract\.test\.ts/);
assert.match(releaseFlowCommandsJoined, /studio-simulator-execution-contract\.test\.ts/);
assert.match(releaseFlowCommandsJoined, /studio-simulator-evidence-store-contract\.test\.ts/);
assert.match(releaseFlowCommandsJoined, /studio-simulator-ui-contract\.test\.ts/);
assert.match(releaseFlowCommandsJoined, /studio-evidence-viewer-contract\.test\.ts/);
assert.match(releaseFlowCommandsJoined, /studio-evidence-viewer-ui-contract\.test\.ts/);
assert.match(releaseFlowCommandsJoined, /check-release-closure\.mjs/);
assert.match(releaseFlowCommandsJoined, /claw-release-parity-contract\.test\.mjs/);
assert.match(releaseFlowCommandsJoined, /claw-docs-ia-contract\.test\.mjs/);
assert.match(releaseFlowCommandsJoined, /prompt-governance-contract\.test\.mjs/);
assert.match(releaseFlowCommandsJoined, /shell-runtime-app-client-contract\.test\.ts/);
assert.match(releaseFlowCommandsJoined, /server-runtime-transport-contract\.test\.ts/);
assert.match(releaseFlowCommandsJoined, /skill-binding-contract\.test\.ts/);
assert.match(releaseFlowCommandsJoined, /template-instantiation-contract\.test\.ts/);
assert.match(
  releaseFlowCommandsJoined,
  /prompt-skill-template-runtime-assembly-contract\.test\.ts/,
);
assert.match(
  releaseFlowCommandsJoined,
  /prompt-skill-template-evidence-repository-contract\.test\.ts/,
);
assert.match(
  releaseFlowCommandsJoined,
  /prompt-skill-template-evidence-consumer-contract\.test\.ts/,
);
assert.match(
  releaseFlowCommandsJoined,
  /coding-server-prompt-skill-template-evidence-consumer-contract\.test\.ts/,
);
assert.match(
  releaseFlowCommandsJoined,
  /postgresql-live-smoke-contract\.test\.ts/,
);
assert.match(releaseFlowCommandsJoined, /live-docs-governance-baseline\.test\.mjs/);
assert.match(releaseFlowCommandsJoined, /quality-loop-scoreboard-contract\.test\.mjs/);
assert.match(releaseFlowCommandsJoined, /rollback-plan-command\.test\.mjs/);
assert.match(releaseFlowCommandsJoined, /package-release-assets\.test\.mjs/);
assert.match(releaseFlowCommandsJoined, /preflight-desktop-signing-environment\.test\.mjs/);
assert.match(releaseFlowCommandsJoined, /finalize-release-assets\.test\.mjs/);
assert.match(releaseFlowCommandsJoined, /write-attestation-evidence\.test\.mjs/);
assert.match(releaseFlowCommandsJoined, /assert-release-readiness\.test\.mjs/);
assert.match(releaseFlowCommandsJoined, /release-readiness-complete-matrix\.test\.mjs/);
assert.match(releaseFlowCommandsJoined, /write-readiness-fixture\.mjs --help/);
assert.match(releaseFlowCommandsJoined, /write-readiness-fixture\.test\.mjs/);
assert.match(releaseFlowCommandsJoined, /candidate-dry-run\.mjs --help/);
assert.match(releaseFlowCommandsJoined, /candidate-dry-run\.test\.mjs/);
assert.match(releaseFlowCommandsJoined, /rehearsal-verify\.mjs --help/);
assert.match(releaseFlowCommandsJoined, /rehearsal-verify\.test\.mjs/);
assert.match(releaseFlowCommandsJoined, /smoke-finalized-release-assets\.test\.mjs/);
assert.match(releaseFlowCommandsJoined, /verify-desktop-installer-trust\.test\.mjs/);
assert.match(releaseFlowCommandsJoined, /smoke-web-release-assets\.test\.mjs/);
assert.match(releaseFlowCommandsJoined, /smoke-desktop-installers\.test\.mjs/);
assert.match(releaseFlowCommandsJoined, /smoke-server-release-assets\.test\.mjs/);
assert.match(releaseFlowCommandsJoined, /coding-server-openapi-snapshot-drift\.test\.ts/);
assert.match(releaseFlowCommandsJoined, /smoke-deployment-release-assets\.test\.mjs/);
assert.match(releaseFlowCommandsJoined, /birdcoder-identity-standard-contract\.test\.mjs/);
assert.match(releaseFlowCommandsJoined, /engine-official-sdk-contract\.test\.ts/);
assert.match(
  releaseFlowCommandsJoined,
  /engine-official-sdk-runtime-selection-contract\.test\.ts/,
);
assert.match(releaseFlowCommandsJoined, /engine-runtime-adapter-contract\.test\.ts/);
assert.match(releaseFlowCommandsJoined, /engine-kernel-contract\.test\.ts/);
assert.match(releaseFlowCommandsJoined, /engine-environment-health-contract\.test\.ts/);
assert.match(releaseFlowCommandsJoined, /engine-capability-extension-contract\.test\.ts/);
assert.match(
  releaseFlowCommandsJoined,
  /engine-experimental-capability-gating-contract\.test\.ts/,
);
assert.match(
  releaseFlowCommandsJoined,
  /engine-canonical-registry-governance-contract\.test\.ts/,
);
assert.match(
  releaseFlowCommandsJoined,
  /provider-sdk-import-governance-contract\.test\.mjs/,
);
assert.match(
  releaseFlowCommandsJoined,
  /provider-sdk-package-manifest-contract\.test\.mjs/,
);
assert.match(
  releaseFlowCommandsJoined,
  /provider-adapter-browser-safety-contract\.test\.mjs/,
);
assert.match(
  releaseFlowCommandsJoined,
  /engine-official-sdk-error-propagation-contract\.test\.ts/,
);
assert.match(releaseFlowCommandsJoined, /provider-official-sdk-bridge-contract\.test\.ts/);
assert.match(releaseFlowCommandsJoined, /codeengine-turn-options-provider-contract\.test\.mjs/);
assert.match(releaseFlowCommandsJoined, /engine-conformance-contract\.test\.ts/);
assert.match(releaseFlowCommandsJoined, /tool-protocol-contract\.test\.ts/);
assert.match(releaseFlowCommandsJoined, /engine-resume-recovery-contract\.test\.ts/);
assert.match(releaseFlowCommandsJoined, /generate-rust-host-engine-catalog\.ts/);
assert.match(
  releaseFlowCommandsJoined,
  /cargo test --manifest-path packages\/sdkwork-birdcoder-server\/src-host\/Cargo\.toml core_engine_catalog_routes_match_generated_shared_engine_catalog/,
);
assert.doesNotMatch(
  rootPackageJson.scripts['check:release-flow'],
  /pnpm run /,
  'release-flow must not reopen nested pnpm run wrappers inside higher-tier quality gates on Windows',
);
assert.doesNotMatch(
  rootPackageJson.scripts['check:release-flow'],
  /&&/,
  'release-flow must delegate to a runner script so Windows command-line length stays bounded',
);
assert.equal(
  rootPackageJson.scripts['test:rust-host-engine-route-parity-contract'],
  'node --experimental-strip-types scripts/generate-rust-host-engine-catalog.ts && cargo test --manifest-path packages/sdkwork-birdcoder-server/src-host/Cargo.toml core_engine_catalog_routes_match_generated_shared_engine_catalog',
);
assert.doesNotMatch(
  rootPackageJson.scripts['test:rust-host-engine-route-parity-contract'],
  /pnpm run /,
  'rust host engine route parity must not reopen a nested pnpm run chain inside lint or release-flow on Windows',
);
assert.equal(rootPackageJson.scripts['check:quality-matrix'], 'node scripts/quality-gate-matrix-contract.test.mjs');
assert.equal(rootPackageJson.scripts['check:quality-loop-scoreboard'], 'node scripts/quality-loop-scoreboard-contract.test.mjs');
assert.equal(
  rootPackageJson.scripts['test:engine-official-sdk-contract'],
  'node --experimental-strip-types scripts/engine-official-sdk-contract.test.ts',
);
assert.equal(
  rootPackageJson.scripts['test:engine-official-sdk-runtime-selection-contract'],
  'node --experimental-strip-types scripts/engine-official-sdk-runtime-selection-contract.test.ts',
);
assert.equal(
  rootPackageJson.scripts['test:engine-kernel-contract'],
  'node --experimental-strip-types scripts/engine-kernel-contract.test.ts',
);
assert.equal(
  rootPackageJson.scripts['test:engine-environment-health-contract'],
  'node --experimental-strip-types scripts/engine-environment-health-contract.test.ts',
);
assert.equal(
  rootPackageJson.scripts['test:engine-capability-extension-contract'],
  'node --experimental-strip-types scripts/engine-capability-extension-contract.test.ts',
);
assert.equal(
  rootPackageJson.scripts['test:provider-sdk-import-governance-contract'],
  'node scripts/provider-sdk-import-governance-contract.test.mjs',
);
assert.equal(
  rootPackageJson.scripts['test:provider-sdk-package-manifest-contract'],
  'node scripts/provider-sdk-package-manifest-contract.test.mjs',
);
assert.equal(
  rootPackageJson.scripts['test:provider-adapter-browser-safety-contract'],
  'node scripts/provider-adapter-browser-safety-contract.test.mjs',
);
assert.equal(
  rootPackageJson.scripts['test:engine-official-sdk-error-propagation-contract'],
  'node --experimental-strip-types scripts/engine-official-sdk-error-propagation-contract.test.ts',
);
assert.equal(
  rootPackageJson.scripts['test:engine-experimental-capability-gating-contract'],
  'node --experimental-strip-types scripts/engine-experimental-capability-gating-contract.test.ts',
);
assert.equal(
  rootPackageJson.scripts['test:engine-canonical-registry-governance-contract'],
  'node --experimental-strip-types scripts/engine-canonical-registry-governance-contract.test.ts',
);
assert.deepEqual(qualityStandardRunnerModule.QUALITY_STANDARD_CHECK_COMMANDS, [
  'node scripts/run-workspace-package-script.mjs . check:desktop',
  'node scripts/run-workspace-package-script.mjs . check:server',
  'node scripts/run-workspace-package-script.mjs . check:web-vite-build',
  'node scripts/run-workspace-package-script.mjs . check:web-bundle-budget',
  'node scripts/run-workspace-package-script.mjs . server:build',
  'node scripts/run-workspace-package-script.mjs . docs:build',
]);
assert.equal(rootPackageJson.scripts['check:quality:release'], 'node scripts/run-quality-release-check.mjs');
assert.deepEqual(qualityReleaseRunnerModule.QUALITY_RELEASE_CHECK_COMMANDS, [
  'node scripts/run-workspace-package-script.mjs . check:quality:fast',
  'node scripts/run-workspace-package-script.mjs . check:quality:standard',
  'node scripts/run-workspace-package-script.mjs . check:quality-matrix',
  'node scripts/run-workspace-package-script.mjs . check:release-flow',
  'node scripts/run-workspace-package-script.mjs . check:ci-flow',
  'node scripts/run-workspace-package-script.mjs . check:governance-regression',
]);
assert.equal(rootPackageJson.scripts['quality:execution-report'], 'node scripts/quality-gate-execution-report.mjs');
assert.equal(
  rootPackageJson.scripts.build,
  'node scripts/prepare-shared-sdk-packages.mjs && node scripts/run-vite-host.mjs --cwd packages/sdkwork-birdcoder-web build --mode production && node scripts/web-bundle-budget.test.mjs',
  'root build must keep governance-backed web bundle verification on the pnpm run build path while bypassing recursive package-script execution that drifts under release-tier nesting',
);
assert.equal(
  rootPackageJson.scripts['build:prod'],
  'node scripts/prepare-shared-sdk-packages.mjs && node scripts/run-vite-host.mjs --cwd packages/sdkwork-birdcoder-web build --mode production && node scripts/web-bundle-budget.test.mjs',
  'root build:prod must reuse the same direct web-host build chain as build so release governance avoids recursive package-script drift under nested quality tiers',
);
for (const scriptName of ['build', 'build:dev', 'build:test', 'build:prod']) {
  assert.match(
    webPackageJson.scripts[scriptName],
    /^node \.\.\/\.\.\/scripts\/prepare-shared-sdk-packages\.mjs && node \.\.\/\.\.\/scripts\/run-vite-host\.mjs build --mode /,
    `@sdkwork/birdcoder-web ${scriptName} must keep repo script resolution on direct node execution so nested release quality runs do not depend on a recursive pnpm binary lookup`,
  );
}
assert.match(rootPackageJson.scripts['prepare:shared-sdk'], /prepare-shared-sdk-packages\.mjs/);
assert.match(rootPackageJson.scripts['release:smoke:desktop-packaged-launch'], /smoke-desktop-packaged-launch\.mjs/);
assert.match(rootPackageJson.scripts['release:smoke:desktop-startup'], /smoke-desktop-startup-evidence\.mjs/);
assert.equal(
  rootPackageJson.scripts['release:verify-trust:desktop'],
  'node scripts/release/local-release-command.mjs verify-trust desktop --release-assets-dir artifacts/release',
);
assert.equal(
  rootPackageJson.scripts['release:preflight:desktop-signing'],
  'node scripts/release/preflight-desktop-signing-environment.mjs',
);
assert.equal(
  rootPackageJson.scripts['release:write-attestation-evidence'],
  'node scripts/release/write-attestation-evidence.mjs --release-assets-dir artifacts/release',
);
assert.match(rootPackageJson.scripts['release:smoke:finalized'], /smoke-finalized-release-assets\.mjs/);
assert.match(rootPackageJson.scripts['release:rollback:plan'], /local-release-command\.mjs rollback-plan/);
assert.match(
  rootPackageJson.scripts['release:finalize'],
  /--quality-execution-report-path artifacts\/quality\/quality-gate-execution-report\.json/,
);
assert.match(
  rootPackageJson.scripts['release:assert-ready'],
  /local-release-command\.mjs assert-ready --release-assets-dir artifacts\/release/,
);
assert.equal(
  rootPackageJson.scripts['release:fixture:ready'],
  'node scripts/release/write-readiness-fixture.mjs',
  'Root release scripts must expose the complete release readiness fixture generator.',
);
assert.equal(
  rootPackageJson.scripts['release:candidate:dry-run'],
  'node scripts/release/candidate-dry-run.mjs',
  'Root release scripts must expose the commercial release candidate dry-run evidence command.',
);
assert.equal(
  rootPackageJson.scripts['release:rehearsal:verify'],
  'node scripts/release/rehearsal-verify.mjs',
  'Root release scripts must expose the commercial release rehearsal verification command.',
);

console.log('release flow contract passed.');
