import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const rootDir = process.cwd();
const reusableWorkflow = fs.readFileSync(
  path.join(rootDir, '.github/workflows/release-reusable.yml'),
  'utf8',
);
const releaseWorkflow = fs.readFileSync(
  path.join(rootDir, '.github/workflows/release.yml'),
  'utf8',
);
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

assert.match(releaseWorkflow, /name:\s*release/);
assert.match(releaseWorkflow, /push:\s*[\s\S]*tags:\s*[\s\S]*-\s*'release-\*'/);
assert.match(releaseWorkflow, /uses:\s*\.\/\.github\/workflows\/release-reusable\.yml/);
assert.match(releaseWorkflow, /release_profile:\s*sdkwork-birdcoder/);
assert.doesNotMatch(releaseWorkflow, /release_profile:\s*claw-studio/);

assert.match(reusableWorkflow, /SDKWORK_SHARED_SDK_MODE:\s*git/);
assert.match(reusableWorkflow, /prepare-shared-sdk-git-sources\.mjs/);
assert.match(reusableWorkflow, /pnpm prepare:shared-sdk/);
assert.match(reusableWorkflow, /cargo test --manifest-path packages\/sdkwork-birdcoder-desktop\/src-tauri\/Cargo\.toml/);
assert.match(reusableWorkflow, /actions\/attest-build-provenance@v3/);
assert.match(reusableWorkflow, /docker\/build-push-action@v6/);
assert.match(reusableWorkflow, /azure\/setup-helm@v4/);
assert.match(reusableWorkflow, /azure\/setup-kubectl@v4/);
assert.match(reusableWorkflow, /container-image-metadata-\$\{\{ matrix\.arch \}\}/);
assert.match(reusableWorkflow, /run-desktop-release-build\.mjs --profile .* --phase sync/);
assert.match(reusableWorkflow, /run-desktop-release-build\.mjs --profile .* --phase prepare-target/);
assert.match(reusableWorkflow, /run-desktop-release-build\.mjs --profile .* --phase prepare-openclaw/);
assert.match(reusableWorkflow, /run-desktop-release-build\.mjs --profile .* --phase bundle/);
assert.match(reusableWorkflow, /Build Claw Studio desktop bundle on Windows/);
assert.match(reusableWorkflow, /Build Claw Studio desktop bundle on Unix/);
assert.match(reusableWorkflow, /smoke-desktop-installers\.mjs/);
assert.match(reusableWorkflow, /smoke-desktop-packaged-launch\.mjs/);
assert.doesNotMatch(reusableWorkflow, /smoke-desktop-startup-evidence\.mjs/);
assert.match(reusableWorkflow, /run-claw-server-build\.mjs/);
assert.match(reusableWorkflow, /smoke-server-release-assets\.mjs/);
assert.match(reusableWorkflow, /smoke-deployment-release-assets\.mjs --family container/);
assert.match(reusableWorkflow, /smoke-deployment-release-assets\.mjs --family kubernetes/);
assert.doesNotMatch(reusableWorkflow, /smoke-release-assets\.mjs web/);
assert.match(
  reusableWorkflow,
  /finalize-release-assets\.mjs[\s\S]*smoke-finalized-release-assets\.mjs --release-assets-dir release-assets[\s\S]*render-release-notes\.mjs --release-tag .* --output release-assets\/release-notes\.md/,
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
assert.match(releaseFlowCommandsJoined, /finalize-release-assets\.test\.mjs/);
assert.match(releaseFlowCommandsJoined, /smoke-finalized-release-assets\.test\.mjs/);
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
assert.match(rootPackageJson.scripts['release:smoke:finalized'], /smoke-finalized-release-assets\.mjs/);
assert.match(rootPackageJson.scripts['release:rollback:plan'], /local-release-command\.mjs rollback-plan/);
assert.match(
  rootPackageJson.scripts['release:finalize'],
  /--quality-execution-report-path artifacts\/quality\/quality-gate-execution-report\.json/,
);

console.log('release flow contract passed.');
