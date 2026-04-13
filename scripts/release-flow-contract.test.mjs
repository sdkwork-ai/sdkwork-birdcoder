import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

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

assert.match(rootPackageJson.scripts['check:release-flow'], /release-flow-contract\.test\.mjs/);
assert.match(rootPackageJson.scripts['check:release-flow'], /host-runtime-contract\.test\.ts/);
assert.match(rootPackageJson.scripts['check:release-flow'], /host-studio-preview-contract\.test\.ts/);
assert.match(rootPackageJson.scripts['check:release-flow'], /host-studio-simulator-contract\.test\.ts/);
assert.match(rootPackageJson.scripts['check:release-flow'], /studio-preview-execution-contract\.test\.ts/);
assert.match(rootPackageJson.scripts['check:release-flow'], /studio-preview-evidence-store-contract\.test\.ts/);
assert.match(rootPackageJson.scripts['check:release-flow'], /studio-build-execution-contract\.test\.ts/);
assert.match(rootPackageJson.scripts['check:release-flow'], /studio-build-evidence-store-contract\.test\.ts/);
assert.match(rootPackageJson.scripts['check:release-flow'], /studio-test-execution-contract\.test\.ts/);
assert.match(rootPackageJson.scripts['check:release-flow'], /studio-test-evidence-store-contract\.test\.ts/);
assert.match(rootPackageJson.scripts['check:release-flow'], /studio-simulator-execution-contract\.test\.ts/);
assert.match(rootPackageJson.scripts['check:release-flow'], /studio-simulator-evidence-store-contract\.test\.ts/);
assert.match(rootPackageJson.scripts['check:release-flow'], /studio-simulator-ui-contract\.test\.ts/);
assert.match(rootPackageJson.scripts['check:release-flow'], /studio-evidence-viewer-contract\.test\.ts/);
assert.match(rootPackageJson.scripts['check:release-flow'], /studio-evidence-viewer-ui-contract\.test\.ts/);
assert.match(rootPackageJson.scripts['check:release-flow'], /check-release-closure\.mjs/);
assert.match(rootPackageJson.scripts['check:release-flow'], /claw-release-parity-contract\.test\.mjs/);
assert.match(rootPackageJson.scripts['check:release-flow'], /claw-docs-ia-contract\.test\.mjs/);
assert.match(rootPackageJson.scripts['check:release-flow'], /prompt-governance-contract\.test\.mjs/);
assert.match(rootPackageJson.scripts['check:release-flow'], /shell-runtime-app-client-contract\.test\.ts/);
assert.match(rootPackageJson.scripts['check:release-flow'], /server-runtime-transport-contract\.test\.ts/);
assert.match(rootPackageJson.scripts['check:release-flow'], /skill-binding-contract\.test\.ts/);
assert.match(rootPackageJson.scripts['check:release-flow'], /template-instantiation-contract\.test\.ts/);
assert.match(
  rootPackageJson.scripts['check:release-flow'],
  /prompt-skill-template-runtime-assembly-contract\.test\.ts/,
);
assert.match(
  rootPackageJson.scripts['check:release-flow'],
  /prompt-skill-template-evidence-repository-contract\.test\.ts/,
);
assert.match(
  rootPackageJson.scripts['check:release-flow'],
  /prompt-skill-template-evidence-consumer-contract\.test\.ts/,
);
assert.match(
  rootPackageJson.scripts['check:release-flow'],
  /coding-server-prompt-skill-template-evidence-consumer-contract\.test\.ts/,
);
assert.match(
  rootPackageJson.scripts['check:release-flow'],
  /postgresql-live-smoke-contract\.test\.ts/,
);
assert.match(rootPackageJson.scripts['check:release-flow'], /live-docs-governance-baseline\.test\.mjs/);
assert.match(rootPackageJson.scripts['check:release-flow'], /quality-loop-scoreboard-contract\.test\.mjs/);
assert.match(rootPackageJson.scripts['check:release-flow'], /rollback-plan-command\.test\.mjs/);
assert.match(rootPackageJson.scripts['check:release-flow'], /package-release-assets\.test\.mjs/);
assert.match(rootPackageJson.scripts['check:release-flow'], /finalize-release-assets\.test\.mjs/);
assert.match(rootPackageJson.scripts['check:release-flow'], /smoke-finalized-release-assets\.test\.mjs/);
assert.match(rootPackageJson.scripts['check:release-flow'], /smoke-desktop-installers\.test\.mjs/);
assert.match(rootPackageJson.scripts['check:release-flow'], /smoke-server-release-assets\.test\.mjs/);
assert.match(rootPackageJson.scripts['check:release-flow'], /smoke-deployment-release-assets\.test\.mjs/);
assert.match(rootPackageJson.scripts['check:release-flow'], /sdkwork-appbase-parity-contract\.test\.mjs/);
assert.match(rootPackageJson.scripts['check:release-flow'], /engine-runtime-adapter-contract\.test\.ts/);
assert.match(rootPackageJson.scripts['check:release-flow'], /engine-conformance-contract\.test\.ts/);
assert.match(rootPackageJson.scripts['check:release-flow'], /tool-protocol-contract\.test\.ts/);
assert.match(rootPackageJson.scripts['check:release-flow'], /engine-resume-recovery-contract\.test\.ts/);
assert.match(rootPackageJson.scripts['check:release-flow'], /generate-rust-host-engine-catalog\.ts/);
assert.match(
  rootPackageJson.scripts['check:release-flow'],
  /cargo test --manifest-path packages\/sdkwork-birdcoder-server\/src-host\/Cargo\.toml core_engine_catalog_routes_match_generated_shared_engine_catalog/,
);
assert.doesNotMatch(
  rootPackageJson.scripts['check:release-flow'],
  /pnpm run /,
  'release-flow must not reopen nested pnpm run wrappers inside higher-tier quality gates on Windows',
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
assert.match(
  rootPackageJson.scripts['check:quality:standard'],
  /node scripts\/prepare-shared-sdk-packages\.mjs && pnpm --dir packages\/sdkwork-birdcoder-web exec node \.\.\/\.\.\/scripts\/run-vite-host\.mjs build --mode production && node scripts\/web-bundle-budget\.test\.mjs/,
  'check:quality:standard must reuse the same direct web-host build chain as the governed root build so release tiers do not drift back to recursive package-script execution',
);
assert.equal(rootPackageJson.scripts['check:quality:release'], 'pnpm check:quality:fast && pnpm check:quality:standard && pnpm check:quality-matrix && pnpm check:release-flow && pnpm check:ci-flow && pnpm check:governance-regression');
assert.equal(rootPackageJson.scripts['quality:execution-report'], 'node scripts/quality-gate-execution-report.mjs');
assert.equal(
  rootPackageJson.scripts.build,
  'node scripts/prepare-shared-sdk-packages.mjs && pnpm --dir packages/sdkwork-birdcoder-web exec node ../../scripts/run-vite-host.mjs build --mode production && node scripts/web-bundle-budget.test.mjs',
  'root build must keep governance-backed web bundle verification on the pnpm run build path while bypassing recursive package-script execution that drifts under release-tier nesting',
);
assert.equal(
  rootPackageJson.scripts['build:prod'],
  'node scripts/prepare-shared-sdk-packages.mjs && pnpm --dir packages/sdkwork-birdcoder-web exec node ../../scripts/run-vite-host.mjs build --mode production && node scripts/web-bundle-budget.test.mjs',
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
