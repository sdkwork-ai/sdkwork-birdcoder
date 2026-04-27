import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

const requiredPaths = [
  '.github/workflows/ci.yml',
  '.github/workflows/release.yml',
  '.github/workflows/release-reusable.yml',
  '.github/workflows/user-center-upstream-sync.yml',
  'deploy/docker/Dockerfile',
  'deploy/docker/docker-compose.yml',
  'deploy/kubernetes/Chart.yaml',
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
  'docs/架构/README.md',
  'docs/架构/01-产品设计与需求范围.md',
  'docs/架构/02-架构标准与总体设计.md',
  'docs/架构/03-模块规划与边界.md',
  'docs/架构/04-技术选型与可插拔策略.md',
  'docs/架构/05-统一Kernel与Code Engine标准.md',
  'docs/架构/06-编译环境-预览-模拟器-测试体系.md',
  'docs/架构/07-数据模型-状态模型-接口契约.md',
  'docs/架构/08-性能-安全-可观测性标准.md',
  'docs/架构/09-安装-部署-发布标准.md',
  'docs/架构/10-开发流程-质量门禁-评估标准.md',
  'docs/架构/11-行业对标与能力矩阵.md',
  'docs/架构/12-统一工具协议-权限沙箱-审计标准.md',
  'docs/架构/13-规则-技能-MCP-知识系统标准.md',
  'docs/架构/14-现状基线-差距-演进路线.md',
  'docs/release/releases.json',
  'docs/.vitepress/config.mts',
  'docs/.vitepress/searchIndexPolicy.ts',
  'config/shared-sdk-release-sources.json',
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
  'scripts/run-user-center-standard.mjs',
  'scripts/run-user-center-standard.test.mjs',
  'scripts/birdcoder-identity-standard-contract.test.mjs',
  'scripts/user-center-upstream-sync-payload.mjs',
  'scripts/user-center-upstream-sync-payload.test.mjs',
  'scripts/user-center-upstream-sync-workflow.test.mjs',
  'scripts/user-center-standard.test.mjs',
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
  'scripts/run-vitepress.mjs',
  'scripts/shared-sdk-mode.mjs',
  'scripts/release-flow-contract.test.mjs',
  'scripts/release/finalize-release-assets.mjs',
  'scripts/release/desktop-installer-smoke-contract.mjs',
  'scripts/release/desktop-startup-smoke-contract.mjs',
  'scripts/release/local-release-command.mjs',
  'scripts/release/release-smoke-contract.test.mjs',
  'scripts/release/package-release-assets.mjs',
  'scripts/release/release-smoke-contract.mjs',
  'scripts/release/release-profiles.mjs',
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
  'packages/sdkwork-birdcoder-shell/package.json',
  'packages/sdkwork-birdcoder-shell-runtime/package.json',
  'packages/sdkwork-birdcoder-auth/package.json',
  'packages/sdkwork-birdcoder-user/package.json',
  'packages/sdkwork-birdcoder-web/package.json',
  'packages/sdkwork-birdcoder-desktop/package.json',
  'packages/sdkwork-birdcoder-server/package.json',
  'packages/sdkwork-birdcoder-host-core/package.json',
  'packages/sdkwork-birdcoder-host-studio/package.json',
  'packages/sdkwork-birdcoder-studio/src/evidence/viewer.ts',
  'packages/sdkwork-birdcoder-studio/src/evidence/StudioEvidencePanel.tsx',
  'packages/sdkwork-birdcoder-i18n/package.json',
  'packages/sdkwork-birdcoder-infrastructure/package.json',
  'packages/sdkwork-birdcoder-distribution/package.json',
];

for (const relativePath of requiredPaths) {
  assert.ok(
    fs.existsSync(path.join(rootDir, relativePath)),
    `Expected architecture path to exist: ${relativePath}`,
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
assert.equal(rootPackageJson.scripts?.['server:build'], 'node scripts/run-birdcoder-server-build.mjs');
assert.equal(rootPackageJson.scripts?.['prepare:shared-sdk'], 'node scripts/prepare-shared-sdk-packages.mjs');
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
assert.ok(rootPackageJson.scripts?.['check:identity-standard'], 'Missing check:identity-standard script');
assert.equal(
  rootPackageJson.scripts?.['test:user-center-standard'],
  'node scripts/run-user-center-standard.mjs',
  'Root package must expose the canonical user-center standard runner as a first-class verification command.',
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
  rootPackageJson.scripts?.['check:package-script-entrypoints'],
  'node scripts/package-script-entrypoints-contract.test.mjs',
  'Root package must expose the package script entrypoint contract as a first-class verification command.',
);
assert.ok(rootPackageJson.scripts?.['quality:execution-report'], 'Missing quality:execution-report script');
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

const shellPackageJson = JSON.parse(
  fs.readFileSync(path.join(rootDir, 'packages', 'sdkwork-birdcoder-shell', 'package.json'), 'utf8'),
);

assert.equal(
  shellPackageJson.dependencies?.['@sdkwork/birdcoder-auth'],
  'workspace:*',
  '@sdkwork/birdcoder-shell must depend on the unified @sdkwork/birdcoder-auth integration package.',
);
assert.equal(
  shellPackageJson.dependencies?.['@sdkwork/birdcoder-user'],
  'workspace:*',
  '@sdkwork/birdcoder-shell must depend on the unified @sdkwork/birdcoder-user integration package.',
);

const authPackageJson = JSON.parse(
  fs.readFileSync(path.join(rootDir, 'packages', 'sdkwork-birdcoder-auth', 'package.json'), 'utf8'),
);
const userPackageJson = JSON.parse(
  fs.readFileSync(path.join(rootDir, 'packages', 'sdkwork-birdcoder-user', 'package.json'), 'utf8'),
);

assert.equal(
  authPackageJson.name,
  '@sdkwork/birdcoder-auth',
  'The unified auth bridge package must be named @sdkwork/birdcoder-auth.',
);
assert.equal(
  userPackageJson.name,
  '@sdkwork/birdcoder-user',
  'The unified user bridge package must be named @sdkwork/birdcoder-user.',
);

const authIndexSource = fs.readFileSync(
  path.join(rootDir, 'packages', 'sdkwork-birdcoder-auth', 'src', 'index.ts'),
  'utf8',
);
const userIndexSource = fs.readFileSync(
  path.join(rootDir, 'packages', 'sdkwork-birdcoder-user', 'src', 'index.ts'),
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
  './profileStorage.ts',
  './storage.ts',
  './user-center-runtime.ts',
  './user-center.ts',
  './user.ts',
  './validation.ts',
  './vip.ts',
]) {
  assert.match(
    userIndexSource,
    new RegExp(`export \\* from ['"]${exportTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`),
    `sdkwork-birdcoder-user/src/index.ts must export ${exportTarget}.`,
  );
}
for (const lazyPageTarget of [
  './pages/UserCenterPage.tsx',
  './pages/VipPage.tsx',
]) {
  assert.doesNotMatch(
    userIndexSource,
    new RegExp(`export \\* from ['"]${lazyPageTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`, 'u'),
    `sdkwork-birdcoder-user/src/index.ts must not statically export ${lazyPageTarget} because user-center pages load through pageLoaders to preserve lazy page boundaries.`,
  );
}

const authSource = fs.readFileSync(
  path.join(rootDir, 'packages', 'sdkwork-birdcoder-auth', 'src', 'auth.ts'),
  'utf8',
);
const userSource = fs.readFileSync(
  path.join(rootDir, 'packages', 'sdkwork-birdcoder-user', 'src', 'user.ts'),
  'utf8',
);
const vipSource = fs.readFileSync(
  path.join(rootDir, 'packages', 'sdkwork-birdcoder-user', 'src', 'vip.ts'),
  'utf8',
);
const userCenterSource = fs.readFileSync(
  path.join(rootDir, 'packages', 'sdkwork-birdcoder-user', 'src', 'user-center.ts'),
  'utf8',
);

for (const sourcePackageName of [
  '@sdkwork/auth-pc-react',
  '@sdkwork/user-pc-react',
  '@sdkwork/vip-pc-react',
]) {
  assert.match(
    `${authSource}\n${userSource}\n${vipSource}`,
    new RegExp(sourcePackageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    `BirdCoder identity adapters must trace the upstream ${sourcePackageName} capability.`,
  );
}

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

for (const requiredUserCenterSurface of [
  'createBirdCoderUserCenterPluginDefinition',
  'createBirdCoderUserCenterServerPluginDefinition',
  'BIRDCODER_USER_CENTER_PLUGIN_PACKAGES',
]) {
  assert.match(
    userCenterSource,
    new RegExp(requiredUserCenterSurface.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    `sdkwork-birdcoder-user user-center bridge must expose ${requiredUserCenterSurface}.`,
  );
}

for (const scriptName of [
  'dev',
  'build',
  'lint',
  'test:user-center-standard',
  'check:arch',
  'check:sdkwork-birdcoder-structure',
  'check:governance-regression',
  'check:release-flow',
  'server:build',
  'tauri:build',
  'release:plan',
  'release:package:desktop',
  'release:package:server',
  'release:package:container',
  'release:package:kubernetes',
  'release:package:web',
  'release:smoke:desktop',
  'release:smoke:desktop-packaged-launch',
  'release:smoke:desktop-startup',
  'release:smoke:finalized',
  'release:smoke:server',
  'release:smoke:container',
  'release:smoke:kubernetes',
  'release:smoke:web',
]) {
  assert.ok(rootPackageJson.scripts?.[scriptName], `Missing root script: ${scriptName}`);
}

const packageJsonFiles = fs.readdirSync(path.join(rootDir, 'packages'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(rootDir, 'packages', entry.name, 'package.json'))
  .filter((absolutePath) => fs.existsSync(absolutePath));

for (const absolutePath of packageJsonFiles) {
  const source = fs.readFileSync(absolutePath, 'utf8');
  assert.ok(!source.includes('sdkwork-ide-'), `Legacy sdkwork-ide package prefix remains in ${absolutePath}`);
  assert.ok(!source.includes('sdkwork-bird-'), `Legacy sdkwork-bird package prefix remains in ${absolutePath}`);
  assert.ok(!source.includes('@sdkwork/bird-'), `Legacy @sdkwork/bird package prefix remains in ${absolutePath}`);
}

console.log('sdkwork-birdcoder architecture contract passed.');
