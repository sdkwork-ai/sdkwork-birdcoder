import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { resolveBirdcoderApplicationPackageRoots } from './lib/birdcoder-package-scan-roots.mjs';

const rootDir = process.cwd();
const pcPackagesDir = path.join(rootDir, 'apps', 'sdkwork-birdcoder-pc', 'packages');
const h5PackagesDir = path.join(rootDir, 'apps', 'sdkwork-birdcoder-h5', 'packages');
const requiredCanonicalDocs = [
  'docs/product/prd/PRD.md',
  'docs/architecture/tech/TECH_ARCHITECTURE.md',
];

const requiredPaths = [
  '.github/workflows/ci.yml',
  '.github/workflows/package.yml',
  'sdkwork.workflow.json',
  'deployments/docker/Dockerfile',
  'deployments/docker/docker-compose.yml',
  'deployments/kubernetes/Chart.yaml',
  'docs/index.md',
  'docs/architecture.md',
  'docs/release.md',
  'docs/contributing/index.md',
  'docs/core/architecture.md',
  'docs/core/desktop.md',
  'docs/core/packages.md',
  'docs/core/release-and-deployment.md',
  'docs/guide/application-modes.md',
  'docs/guide/development.md',
  'docs/guide/getting-started.md',
  'docs/guide/install-and-deploy.md',
  'docs/reference/api-reference.md',
  'docs/reference/commands.md',
  'docs/reference/environment.md',
  'docs/release/releases.json',
  'docs/.vitepress/config.mts',
  'docs/.vitepress/searchIndexPolicy.ts',
  'tools/shared-sdk-release-sources.json',
  'scripts/claw-docs-ia-contract.test.mjs',
  'scripts/ci-flow-contract.test.mjs',
  'scripts/check-release-closure.mjs',
  'scripts/check-sdkwork-birdcoder-structure.mjs',
  'scripts/check-sdkwork-birdcoder-structure-contract.test.mjs',
  'scripts/check-arch-boundaries.mjs',
  'scripts/provider-sdk-import-governance-contract.test.mjs',
  'scripts/provider-sdk-package-manifest-contract.test.mjs',
  'scripts/provider-adapter-browser-safety-contract.test.mjs',
  'scripts/engine-experimental-capability-gating-contract.test.ts',
  'scripts/engine-canonical-registry-governance-contract.test.ts',
  'scripts/package-governance-contract.test.mjs',
  'scripts/technical-debt-contract.test.mjs',
  'scripts/birdcoder-plus-entity-standard-contract.test.ts',
  'scripts/runtime-plus-entity-standard-contract.test.mjs',
  'scripts/engine-plus-entity-standard-contract.test.mjs',
  'scripts/catalog-plus-entity-standard-contract.test.mjs',
  'scripts/collaboration-plus-entity-standard-contract.test.mjs',
  'scripts/delivery-governance-plus-entity-standard-contract.test.mjs',
  'scripts/desktop-data-schema-contract.test.mjs',
  'scripts/coding-server-api-spec-path-contract.test.ts',
  'scripts/sync-birdcoder-sdk-openapi.mjs',
  'scripts/generate-birdcoder-sdk-family.mjs',
  'scripts/birdcoder-sdk-family-standard-contract.test.mjs',
  'scripts/birdcoder-sdk-family-generated-contract.test.mjs',
  'scripts/birdcoder-iam-standard-contract.test.mjs',
  'scripts/birdcoder-iam-shared-surface-contract.test.mjs',
  'scripts/birdcoder-iam-runtime-standard-contract.test.mjs',
  'scripts/birdcoder-iam-no-legacy-identity-contract.test.mjs',
  'scripts/governance-regression-report.mjs',
  'scripts/governance-regression-report.test.mjs',
  'scripts/quality-gate-execution-report.mjs',
  'scripts/quality-gate-execution-report.test.mjs',
  'scripts/package-script-entrypoints-contract.test.mjs',
  'scripts/run-vite-host.mjs',
  'scripts/run-vite-host.test.mjs',
  'scripts/vite-host-preflight.mjs',
  'scripts/vite-host-preflight.test.mjs',
  'scripts/vite-config-esm-contract.test.mjs',
  'scripts/vite-windows-realpath-patch.mjs',
  'scripts/vite-windows-realpath-patch.test.mjs',
  'scripts/host-runtime-contract.test.ts',
  'scripts/host-studio-preview-contract.test.ts',
  'scripts/host-studio-simulator-contract.test.ts',
  'scripts/studio-preview-execution-contract.test.ts',
  'scripts/studio-preview-evidence-store-contract.test.ts',
  'scripts/studio-build-execution-contract.test.ts',
  'scripts/studio-build-evidence-store-contract.test.ts',
  'scripts/studio-test-execution-contract.test.ts',
  'scripts/studio-test-evidence-store-contract.test.ts',
  'scripts/studio-evidence-viewer-contract.test.ts',
  'scripts/studio-evidence-viewer-ui-contract.test.ts',
  'scripts/studio-simulator-execution-contract.test.ts',
  'scripts/studio-simulator-evidence-store-contract.test.ts',
  'scripts/studio-simulator-ui-contract.test.ts',
  'scripts/prepare-shared-sdk-git-sources.mjs',
  'scripts/prepare-shared-sdk-packages.mjs',
  'scripts/run-claw-server-build.mjs',
  'scripts/run-birdcoder-server-build.mjs',
  'scripts/run-release-flow-check.mjs',
  'scripts/run-release-flow-check.test.mjs',
  'scripts/release-docs-api-sdk-standard-contract.test.mjs',
  'scripts/run-vitepress.mjs',
  'scripts/shared-sdk-mode.mjs',
  'scripts/release-flow-contract.test.mjs',
  'scripts/release/sdkwork-workflow-lifecycle.mjs',
  'scripts/release/finalize-release-assets.mjs',
  'scripts/release/assert-release-readiness.mjs',
  'scripts/release/assert-release-readiness.test.mjs',
  'scripts/release/desktop-installer-smoke-contract.mjs',
  'scripts/release/desktop-startup-smoke-contract.mjs',
  'scripts/release/local-release-command.mjs',
  'scripts/release/release-smoke-contract.test.mjs',
  'scripts/release/package-release-assets.mjs',
  'scripts/release/release-smoke-contract.mjs',
  'scripts/release/release-profiles.mjs',
  'scripts/release/release-checksums.mjs',
  'scripts/release/release-checksums.test.mjs',
  'scripts/release/release-readiness-complete-matrix.test.mjs',
  'scripts/release/write-readiness-fixture.mjs',
  'scripts/release/write-readiness-fixture.test.mjs',
  'scripts/release/candidate-dry-run.mjs',
  'scripts/release/candidate-dry-run.test.mjs',
  'scripts/release/rehearsal-verify.mjs',
  'scripts/release/rehearsal-verify.test.mjs',
  'scripts/release/preflight-desktop-signing-environment.mjs',
  'scripts/release/preflight-desktop-signing-environment.test.mjs',
  'scripts/release/verify-desktop-installer-trust.mjs',
  'scripts/release/verify-desktop-installer-trust.test.mjs',
  'scripts/release/write-attestation-evidence.mjs',
  'scripts/release/write-attestation-evidence.test.mjs',
  'scripts/release/render-release-notes.mjs',
  'scripts/release/smoke-finalized-release-assets.mjs',
  'scripts/release/smoke-finalized-release-assets.test.mjs',
  'scripts/release/smoke-deployment-release-assets.mjs',
  'scripts/release/smoke-desktop-installers.mjs',
  'scripts/release/smoke-desktop-packaged-launch.mjs',
  'scripts/release/smoke-desktop-packaged-launch.test.mjs',
  'scripts/release/smoke-desktop-startup-evidence.mjs',
  'scripts/release/smoke-desktop-startup-evidence.test.mjs',
  'scripts/release/smoke-server-release-assets.mjs',
  'scripts/release/studio-build-evidence-archive.mjs',
  'scripts/release/studio-preview-evidence-archive.mjs',
  'scripts/release/studio-simulator-evidence-archive.mjs',
  'scripts/release/studio-test-evidence-archive.mjs',
  'sdks/sdkwork-birdcoder-app-sdk/sdk-manifest.json',
  'sdks/sdkwork-birdcoder-backend-sdk/sdk-manifest.json',
  'sdks/README.md',
  'sdks/specs/README.md',
  'sdks/specs/component.spec.json',
  'sdks/specs/domain-catalog.json',
  'sdks/specs/openapi/birdcoder-app-v3.openapi.json',
  'sdks/specs/openapi/birdcoder-backend-v3.openapi.json',
  'sdks/sdkwork-birdcoder-app-sdk/README.md',
  'sdks/sdkwork-birdcoder-app-sdk/sdkwork-birdcoder-app-sdk-typescript/package.json',
  'sdks/sdkwork-birdcoder-app-sdk/sdkwork-birdcoder-app-sdk-typescript/src/index.ts',
  'sdks/sdkwork-birdcoder-app-sdk/sdkwork-birdcoder-app-sdk-rust/Cargo.toml',
  'sdks/sdkwork-birdcoder-app-sdk/sdkwork-birdcoder-app-sdk-rust/src/lib.rs',
  'sdks/sdkwork-birdcoder-backend-sdk/README.md',
  'sdks/sdkwork-birdcoder-backend-sdk/sdkwork-birdcoder-backend-sdk-typescript/package.json',
  'sdks/sdkwork-birdcoder-backend-sdk/sdkwork-birdcoder-backend-sdk-typescript/src/index.ts',
  'sdks/sdkwork-birdcoder-backend-sdk/sdkwork-birdcoder-backend-sdk-rust/Cargo.toml',
  'sdks/sdkwork-birdcoder-backend-sdk/sdkwork-birdcoder-backend-sdk-rust/src/lib.rs',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell/package.json',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell-runtime/package.json',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-iam/package.json',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-auth/package.json',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-user/package.json',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-web/package.json',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-desktop/package.json',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server/package.json',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-host-core/package.json',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-host-studio/package.json',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-studio/src/evidence/viewer.ts',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-studio/src/evidence/StudioEvidencePanel.tsx',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-i18n/package.json',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/package.json',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-distribution/package.json',
];

for (const relativePath of requiredPaths) {
  assert.ok(
    fs.existsSync(path.join(rootDir, relativePath)),
    `Expected architecture path to exist: ${relativePath}`,
  );
}

for (const canonicalDoc of requiredCanonicalDocs) {
  assert.ok(
    fs.existsSync(path.join(rootDir, canonicalDoc)),
    `Expected canonical documentation file to exist: ${canonicalDoc}`,
  );
}

const rootPackageJson = JSON.parse(
  fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'),
);
const qualityFastRunnerSource = fs.readFileSync(
  path.join(rootDir, 'scripts', 'run-quality-fast-check.mjs'),
  'utf8',
);
const structureCheckSource = fs.readFileSync(
  path.join(rootDir, 'scripts', 'check-sdkwork-birdcoder-structure.mjs'),
  'utf8',
);

assert.equal(rootPackageJson.name, '@sdkwork/birdcoder-workspace');
assert.equal(rootPackageJson.scripts?.['build:server'], 'node scripts/run-birdcoder-server-build.mjs');
assert.equal(rootPackageJson.scripts?.['sdk:prepare'], 'node scripts/prepare-shared-sdk-packages.mjs');
assert.match(
  rootPackageJson.scripts?.['check:release-flow'] ?? '',
  /run-release-flow-check\.mjs/,
);
assert.match(
  rootPackageJson.scripts?.['check:release-flow'] ?? '',
  /^node scripts\/run-release-flow-check\.mjs$/,
);
assert.match(
  rootPackageJson.scripts?.['check:release-flow'] ?? '',
  /^node scripts\/run-release-flow-check\.mjs$/,
);
assert.ok(rootPackageJson.scripts?.['docs:build'], 'Missing docs:build script');
assert.ok(rootPackageJson.scripts?.['check:ci-flow'], 'Missing check:ci-flow script');
assert.ok(rootPackageJson.scripts?.['check:multi-mode'], 'Missing check:multi-mode script');
assert.ok(rootPackageJson.scripts?.['check:iam-standard'], 'Missing check:iam-standard script');
assert.match(
  rootPackageJson.scripts?.['check:iam-standard'] ?? '',
  /birdcoder-iam-standard-contract\.test\.mjs/,
  'check:iam-standard must include the repository-local IAM standard contract so retired identity surfaces cannot bypass architecture governance.',
);
assert.match(
  rootPackageJson.scripts?.['check:iam-standard'] ?? '',
  /birdcoder-iam-no-legacy-identity-contract\.test\.mjs/,
  'check:iam-standard must include the no-legacy-identity contract so retired compatibility surfaces cannot bypass architecture governance.',
);
assert.ok(rootPackageJson.scripts?.['check:data-kernel'], 'Missing check:data-kernel script');
for (const dataKernelContract of [
  'birdcoder-plus-entity-standard-contract.test.ts',
  'runtime-plus-entity-standard-contract.test.mjs',
  'engine-plus-entity-standard-contract.test.mjs',
  'catalog-plus-entity-standard-contract.test.mjs',
  'collaboration-plus-entity-standard-contract.test.mjs',
  'delivery-governance-plus-entity-standard-contract.test.mjs',
  'desktop-data-schema-contract.test.mjs',
]) {
  assert.match(
    rootPackageJson.scripts?.['check:data-kernel'] ?? '',
    new RegExp(dataKernelContract.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    `check:data-kernel must include ${dataKernelContract} so DATABASE_SPEC-aligned local table contracts cannot drift out of architecture governance.`,
  );
}
assert.equal(
  rootPackageJson.scripts?.['test:user-center-standard'],
  undefined,
  'Root package must not expose the retired user-center standard runner.',
);
assert.equal(
  rootPackageJson.scripts?.['check:sdkwork-birdcoder-structure-contract'],
  'node scripts/check-sdkwork-birdcoder-structure-contract.test.mjs',
  'Root package must expose the sdkwork-birdcoder structure behavior contract as a first-class verification command.',
);
assert.ok(rootPackageJson.scripts?.['check:package-governance'], 'Missing check:package-governance script');
assert.ok(
  rootPackageJson.scripts?.['test:provider-sdk-package-manifest-contract'],
  'Missing test:provider-sdk-package-manifest-contract script',
);
assert.ok(rootPackageJson.scripts?.['check:vite-config-esm'], 'Missing check:vite-config-esm script');
assert.ok(rootPackageJson.scripts?.['check:vite-host-preflight'], 'Missing check:vite-host-preflight script');
assert.ok(rootPackageJson.scripts?.['check:vite-windows-realpath'], 'Missing check:vite-windows-realpath script');
assert.ok(rootPackageJson.scripts?.['check:governance-regression'], 'Missing check:governance-regression script');
assert.ok(rootPackageJson.scripts?.['check:governance-regression-contract'], 'Missing check:governance-regression-contract script');
assert.equal(
  rootPackageJson.scripts?.['check:technical-debt'],
  'node scripts/technical-debt-contract.test.mjs',
  'Root package must expose a dedicated technical debt scan contract.',
);
assert.equal(
  rootPackageJson.scripts?.['test:coding-server-api-spec-path-contract'],
  'node scripts/run-local-tsx.mjs scripts/coding-server-api-spec-path-contract.test.ts',
  'Root package must expose the API_SPEC path contract so app/backend prefix drift cannot bypass repository governance.',
);
assert.equal(
  rootPackageJson.scripts?.['check:sdk-family-standard'],
  'node scripts/birdcoder-sdk-family-standard-contract.test.mjs',
  'Root package must expose the BirdCoder app/backend SDK family standard contract.',
);
assert.equal(
  rootPackageJson.scripts?.['check:sdk-family-generated'],
  'node scripts/birdcoder-sdk-family-generated-contract.test.mjs',
  'Root package must expose the BirdCoder app/backend generated SDK reproducibility contract.',
);
assert.equal(
  rootPackageJson.scripts?.['sdk:generate'],
  'node scripts/sync-birdcoder-sdk-openapi.mjs && node scripts/generate-birdcoder-sdk-family.mjs',
  'BirdCoder SDK generation must sync OpenAPI source contracts before regenerating app/backend SDK packages.',
);
assert.equal(
  rootPackageJson.scripts?.['check:package-script-entrypoints'],
  'node scripts/package-script-entrypoints-contract.test.mjs',
  'Root package must expose the package script entrypoint contract as a first-class verification command.',
);
assert.ok(rootPackageJson.scripts?.['check:quality-execution-report'], 'Missing check:quality-execution-report script');
assert.ok(rootPackageJson.scripts?.['release:finalize'], 'Missing release:finalize script');
assert.equal(
  rootPackageJson.scripts?.lint,
  'node scripts/run-quality-fast-check.mjs',
  'Root lint must delegate to the governed quality-fast runner.',
);
assert.match(
  qualityFastRunnerSource,
  /node scripts\/run-workspace-package-script\.mjs \. check:package-governance/,
  'Root lint must include check:package-governance through the governed quality-fast runner.',
);
assert.equal(
  rootPackageJson.scripts?.['check:release-flow'],
  'node scripts/run-release-flow-check.mjs',
  'check:release-flow must delegate to the bounded runner script so Windows command invocation stays stable.',
);
assert.match(
  structureCheckSource,
  /collectRootPackageScriptTargetPaths/,
  'structure check must derive repo-local script targets from the root manifest so package.json script topology drift cannot bypass repository governance.',
);
assert.match(
  structureCheckSource,
  /Root package script .* references missing repo file:/,
  'structure check must report missing root package script targets with the owning script name for direct diagnosis.',
);
assert.match(
  structureCheckSource,
  /'scripts\/run-release-flow-check\.mjs'/,
  'structure check must require the release-flow runner script so repository topology cannot drop the bounded runner.',
);
assert.match(
  structureCheckSource,
  /'scripts\/run-release-flow-check\.test\.mjs'/,
  'structure check must require the release-flow runner contract so repository topology cannot drop runner governance.',
);
assert.match(
  structureCheckSource,
  /'scripts\/package-script-entrypoints-contract\.test\.mjs'/,
  'structure check must require the package script entrypoint contract so governed CLI import safety cannot drift out of the repo topology.',
);
assert.match(
  structureCheckSource,
  /'scripts\/provider-sdk-package-manifest-contract\.test\.mjs'/,
  'structure check must require provider SDK package manifest governance so adapter package contracts cannot drift.',
);
assert.match(
  structureCheckSource,
  /'sdks\/\.sdkwork-assembly\.json'/,
  'structure check must forbid the retired parallel SDK assembly registry.',
);
assert.match(
  structureCheckSource,
  /'sdks\/sdkwork-birdcoder-app-sdk\/sdk-manifest\.json'/,
  'structure check must require the app family-root SDK manifest.',
);
assert.match(
  structureCheckSource,
  /'sdks\/sdkwork-birdcoder-backend-sdk\/sdk-manifest\.json'/,
  'structure check must require the backend family-root SDK manifest.',
);
assert.match(
  structureCheckSource,
  /'sdks\/specs\/openapi\/birdcoder-app-v3\.openapi\.json'/,
  'structure check must require the app SDK OpenAPI source contract.',
);
assert.match(
  structureCheckSource,
  /'sdks\/specs\/domain-catalog\.json'/,
  'structure check must require the SDK domain catalog so DOMAIN_SPEC ownership cannot drift.',
);
assert.match(
  structureCheckSource,
  /'sdks\/specs\/openapi\/birdcoder-backend-v3\.openapi\.json'/,
  'structure check must require the backend SDK OpenAPI source contract.',
);
assert.match(
  structureCheckSource,
  /'sdks\/sdkwork-birdcoder-sdk'/,
  'structure check must forbid the retired single-surface SDK directory.',
);
assert.match(
  structureCheckSource,
  /'sdks'/,
  'structure check must scan SDK topology for legacy package-name residue.',
);

const shellPackageJson = JSON.parse(
  fs.readFileSync(path.join(pcPackagesDir, 'sdkwork-birdcoder-pc-shell', 'package.json'), 'utf8'),
);

assert.equal(
  shellPackageJson.dependencies?.['@sdkwork/birdcoder-pc-auth'],
  undefined,
  '@sdkwork/birdcoder-pc-shell must not bind directly to the auth UI package; runtime-backed auth loading is owned by @sdkwork/birdcoder-pc-iam.',
);
assert.equal(
  shellPackageJson.dependencies?.['@sdkwork/birdcoder-pc-iam'],
  'workspace:*',
  '@sdkwork/birdcoder-pc-shell must depend on the standard @sdkwork/birdcoder-pc-iam integration package.',
);
assert.equal(
  shellPackageJson.dependencies?.['@sdkwork/birdcoder-pc-user'],
  'workspace:*',
  '@sdkwork/birdcoder-pc-shell must depend on the unified @sdkwork/birdcoder-pc-user integration package.',
);

const iamPackageJson = JSON.parse(
  fs.readFileSync(path.join(pcPackagesDir, 'sdkwork-birdcoder-pc-iam', 'package.json'), 'utf8'),
);
const authPackageJson = JSON.parse(
  fs.readFileSync(path.join(pcPackagesDir, 'sdkwork-birdcoder-pc-auth', 'package.json'), 'utf8'),
);
const userPackageJson = JSON.parse(
  fs.readFileSync(path.join(pcPackagesDir, 'sdkwork-birdcoder-pc-user', 'package.json'), 'utf8'),
);

assert.equal(
  iamPackageJson.name,
  '@sdkwork/birdcoder-pc-iam',
  'The IAM integration package must be named @sdkwork/birdcoder-pc-iam.',
);
assert.equal(
  iamPackageJson.dependencies?.['@sdkwork/birdcoder-pc-auth'],
  'workspace:*',
  'The IAM integration package must compose the auth UI package.',
);
assert.equal(
  iamPackageJson.dependencies?.['@sdkwork/birdcoder-pc-infrastructure'],
  'workspace:*',
  'The IAM integration package must bind auth UI to the generated-SDK backed infrastructure runtime.',
);
assert.equal(
  authPackageJson.name,
  '@sdkwork/birdcoder-pc-auth',
  'The auth UI bridge package must be named @sdkwork/birdcoder-pc-auth.',
);
assert.equal(
  authPackageJson.dependencies?.['@sdkwork/birdcoder-pc-infrastructure-runtime'],
  undefined,
  'The auth UI bridge package must not depend on infrastructure runtime; runtime injection belongs to @sdkwork/birdcoder-pc-iam.',
);
assert.equal(
  userPackageJson.name,
  '@sdkwork/birdcoder-pc-user',
  'The unified user bridge package must be named @sdkwork/birdcoder-pc-user.',
);

const authIndexSource = fs.readFileSync(
  path.join(pcPackagesDir, 'sdkwork-birdcoder-pc-auth', 'src', 'index.ts'),
  'utf8',
);
const userIndexSource = fs.readFileSync(
  path.join(pcPackagesDir, 'sdkwork-birdcoder-pc-user', 'src', 'index.ts'),
  'utf8',
);

for (const exportTarget of [
  './auth.ts',
  './pageLoaders.ts',
]) {
  assert.match(
    authIndexSource,
    new RegExp(`export \\* from ['"]${exportTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`),
    `sdkwork-birdcoder-auth/src/index.ts must export ${exportTarget}.`,
  );
}
assert.doesNotMatch(
  authIndexSource,
  /export\s+\*\s+from ['"]\.\/pages\/AuthPage\.tsx['"]/u,
  'sdkwork-birdcoder-auth/src/index.ts must not statically export AuthPage because the shell loads it through pageLoaders to preserve the lazy auth boundary.',
);

for (const exportTarget of [
  './pageLoaders.ts',
  './user.ts',
  './vip.ts',
  './user-surface.ts',
  './vip-surface.ts',
]) {
  assert.match(
    userIndexSource,
    new RegExp(`export \\* from ['"]${exportTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`),
    `sdkwork-birdcoder-user/src/index.ts must export ${exportTarget}.`,
  );
}
assert.doesNotMatch(
  userIndexSource,
  /profileStorage/u,
  'sdkwork-birdcoder-user/src/index.ts must not export retired local profile/VIP storage.',
);
for (const lazyPageTarget of [
  './pages/UserPage.tsx',
  './pages/VipPage.tsx',
]) {
  assert.doesNotMatch(
    userIndexSource,
    new RegExp(`export \\* from ['"]${lazyPageTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`, 'u'),
    `sdkwork-birdcoder-user/src/index.ts must not statically export ${lazyPageTarget} because user pages load through pageLoaders to preserve lazy page boundaries.`,
  );
}

const authSource = fs.readFileSync(
  path.join(pcPackagesDir, 'sdkwork-birdcoder-pc-auth', 'src', 'auth.ts'),
  'utf8',
);
const userSource = fs.readFileSync(
  path.join(pcPackagesDir, 'sdkwork-birdcoder-pc-user', 'src', 'user.ts'),
  'utf8',
);
const vipSource = fs.readFileSync(
  path.join(pcPackagesDir, 'sdkwork-birdcoder-pc-user', 'src', 'vip.ts'),
  'utf8',
);
for (const sourcePackageName of [
  '@sdkwork/auth-pc-react',
  '@sdkwork/user-pc-react',
]) {
  assert.match(
    `${authSource}\n${userSource}\n${vipSource}`,
    new RegExp(sourcePackageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    `BirdCoder IAM adapters must trace the upstream ${sourcePackageName} capability.`,
  );
}
assert.doesNotMatch(
  vipSource,
  /@sdkwork\/vip-pc-react/u,
  'BirdCoder VIP adapter must not trace the retired shared VIP UI package; commerce membership is owned by the generated BirdCoder app SDK.',
);

for (const requiredAuthSurface of [
  'BirdCoderAuthWorkspaceManifest',
  'CreateBirdCoderAuthWorkspaceManifestOptions',
  'createBirdCoderAuthWorkspaceManifest',
  'createAuthWorkspaceManifest',
  'authPackageMeta',
]) {
  assert.match(
    authSource,
    new RegExp(requiredAuthSurface.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    `sdkwork-birdcoder-auth bridge must expose ${requiredAuthSurface}.`,
  );
}

for (const requiredUserSurface of [
  'BirdCoderUserWorkspaceManifest',
  'CreateBirdCoderUserWorkspaceManifestOptions',
  'createBirdCoderUserWorkspaceManifest',
  'createUserWorkspaceManifest',
  'createBirdCoderUserSectionRouteIntent',
  'createUserSectionRouteIntent',
  'userPackageMeta',
]) {
  assert.match(
    userSource,
    new RegExp(requiredUserSurface.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    `sdkwork-birdcoder-user bridge must expose ${requiredUserSurface}.`,
  );
}

for (const requiredVipSurface of [
  'BirdCoderVipWorkspaceManifest',
  'CreateBirdCoderVipWorkspaceManifestOptions',
  'createBirdCoderVipWorkspaceManifest',
  'createVipWorkspaceManifest',
  'vipPackageMeta',
]) {
  assert.match(
    vipSource,
    new RegExp(requiredVipSurface.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    `sdkwork-birdcoder-user vip bridge must expose ${requiredVipSurface}.`,
  );
}

for (const scriptName of [
  'dev',
  'build',
  'lint',
  'check:arch',
  'check:sdkwork-birdcoder-structure',
  'check:governance-regression',
  'check:release-flow',
  'build:server',
  'build:desktop',
  'release:plan',
  'release:preflight:desktop-signing',
  'release:write-attestation-evidence',
  'release:package:desktop',
  'release:verify-trust:desktop',
  'release:package:server',
  'release:package:container',
  'release:package:kubernetes',
  'release:package:web',
  'release:smoke:desktop',
  'release:smoke:desktop-packaged-launch',
  'release:smoke:desktop-startup',
  'release:assert-ready',
  'release:fixture:ready',
  'release:candidate:dry-run',
  'release:rehearsal:verify',
  'release:smoke:finalized',
  'release:smoke:server',
  'release:smoke:container',
  'release:smoke:kubernetes',
  'release:smoke:web',
]) {
  assert.ok(rootPackageJson.scripts?.[scriptName], `Missing root script: ${scriptName}`);
}

function collectPackageJsonFiles(packagesRoot) {
  if (!fs.existsSync(packagesRoot)) {
    return [];
  }

  return fs.readdirSync(packagesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(packagesRoot, entry.name, 'package.json'))
    .filter((absolutePath) => fs.existsSync(absolutePath));
}

const packageJsonFiles = resolveBirdcoderApplicationPackageRoots(rootDir).flatMap((packageRoot) =>
  collectPackageJsonFiles(packageRoot),
);

for (const absolutePath of packageJsonFiles) {
  const source = fs.readFileSync(absolutePath, 'utf8');
  assert.ok(!source.includes('sdkwork-ide-'), `Legacy sdkwork-ide package prefix remains in ${absolutePath}`);
  assert.ok(!source.includes('sdkwork-bird-'), `Legacy sdkwork-bird package prefix remains in ${absolutePath}`);
  assert.ok(!source.includes('@sdkwork/bird-'), `Legacy @sdkwork/bird package prefix remains in ${absolutePath}`);
}

console.log('sdkwork-birdcoder architecture contract passed.');
