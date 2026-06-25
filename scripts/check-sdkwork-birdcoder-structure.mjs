import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const rootDir = process.cwd();
const packagesDir = path.join(rootDir, 'packages');
const workspaceConfigPath = path.join(rootDir, 'pnpm-workspace.yaml');

const requiredPackages = [
  ['apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-auth', '@sdkwork/birdcoder-pc-auth'],
  ['apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-projection', '@sdkwork/birdcoder-pc-projection'],
  ['apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code', '@sdkwork/birdcoder-pc-code'],
  ['apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-commons', '@sdkwork/birdcoder-pc-commons'],
  ['apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-core', '@sdkwork/birdcoder-pc-core'],
  ['apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-desktop', '@sdkwork/birdcoder-pc-desktop'],
  ['apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-distribution', '@sdkwork/birdcoder-pc-distribution'],
  ['apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-host-core', '@sdkwork/birdcoder-pc-host-core'],
  ['apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-host-studio', '@sdkwork/birdcoder-pc-host-studio'],
  ['apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-i18n', '@sdkwork/birdcoder-pc-i18n'],
  ['apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure', '@sdkwork/birdcoder-pc-infrastructure'],
  ['apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-server', '@sdkwork/birdcoder-pc-server'],
  ['apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-settings', '@sdkwork/birdcoder-pc-settings'],
  ['apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell', '@sdkwork/birdcoder-pc-shell'],
  ['apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-shell-runtime', '@sdkwork/birdcoder-pc-shell-runtime'],
  ['apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-skills', '@sdkwork/birdcoder-pc-skills'],
  ['apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-studio', '@sdkwork/birdcoder-pc-studio'],
  ['apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-templates', '@sdkwork/birdcoder-pc-templates'],
  ['apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-types', '@sdkwork/birdcoder-pc-types'],
  ['apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui', '@sdkwork/birdcoder-pc-ui'],
  ['apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui-shell', '@sdkwork/birdcoder-pc-ui-shell'],
  ['apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-user', '@sdkwork/birdcoder-pc-user'],
  ['apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-web', '@sdkwork/birdcoder-pc-web'],
  ['apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench-state', '@sdkwork/birdcoder-pc-workbench-state'],
  ['apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench-storage', '@sdkwork/birdcoder-pc-workbench-storage'],
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
  'docs/release/releases.json',
  'docs/.vitepress/config.mts',
  'scripts/check-arch-boundaries.mjs',
  'scripts/ci-flow-contract.test.mjs',
  'scripts/check-sdkwork-birdcoder-structure.mjs',
  'scripts/check-sdkwork-birdcoder-structure-contract.test.mjs',
  'scripts/check-release-closure.mjs',
  'scripts/quality-gate-matrix-report.mjs',
  'scripts/quality-gate-matrix-contract.test.mjs',
  'scripts/quality-gate-execution-report.mjs',
  'scripts/quality-gate-execution-report.test.mjs',
  'scripts/package-script-entrypoints-contract.test.mjs',
  'scripts/package-governance-contract.test.mjs',
  'scripts/prompt-governance-contract.test.mjs',
  'scripts/technical-debt-contract.test.mjs',
  'scripts/live-docs-governance-baseline.test.mjs',
  'scripts/governance-regression-report.mjs',
  'scripts/governance-regression-report.test.mjs',
  'scripts/run-vite-host.mjs',
  'scripts/run-vite-host.test.mjs',
  'scripts/vite-host-preflight.mjs',
  'scripts/vite-host-preflight.test.mjs',
  'scripts/vite-config-esm-contract.test.mjs',
  'scripts/vite-windows-realpath-patch.mjs',
  'scripts/vite-windows-realpath-patch.test.mjs',
  'scripts/host-studio-simulator-contract.test.ts',
  'scripts/studio-build-execution-contract.test.ts',
  'scripts/studio-build-evidence-store-contract.test.ts',
  'scripts/studio-test-execution-contract.test.ts',
  'scripts/studio-test-evidence-store-contract.test.ts',
  'scripts/studio-evidence-viewer-contract.test.ts',
  'scripts/studio-evidence-viewer-ui-contract.test.ts',
  'scripts/studio-simulator-execution-contract.test.ts',
  'scripts/studio-simulator-evidence-store-contract.test.ts',
  'scripts/studio-simulator-ui-contract.test.ts',
  'scripts/run-claw-server-build.mjs',
  'scripts/run-birdcoder-server-build.mjs',
  'scripts/run-release-flow-check.mjs',
  'scripts/run-release-flow-check.test.mjs',
  'scripts/run-tauri-dev-binary-unlock.mjs',
  'scripts/run-tauri-dev-binary-unlock-check.mjs',
  'scripts/run-tauri-dev-binary-unlock-check.test.mjs',
  'scripts/provider-sdk-package-manifest-contract.test.mjs',
  'scripts/prepare-shared-sdk-git-sources.mjs',
  'scripts/prepare-shared-sdk-packages.mjs',
  'scripts/run-vitepress.mjs',
  'scripts/shared-sdk-mode.mjs',
  'scripts/sdkwork-birdcoder-architecture-contract.test.mjs',
  'scripts/release-flow-contract.test.mjs',
  'scripts/release/sdkwork-workflow-lifecycle.mjs',
  'scripts/release/finalize-release-assets.mjs',
  'scripts/release/finalize-release-assets.test.mjs',
  'scripts/release/desktop-installer-smoke-contract.mjs',
  'scripts/release/desktop-startup-smoke-contract.mjs',
  'scripts/release/local-release-command.mjs',
  'scripts/release/release-smoke-contract.test.mjs',
  'scripts/release/package-release-assets.mjs',
  'scripts/release/package-release-assets.test.mjs',
  'scripts/release/release-smoke-contract.mjs',
  'scripts/release/release-profiles.mjs',
  'scripts/release/release-checksums.mjs',
  'scripts/release/release-checksums.test.mjs',
  'scripts/release/release-readiness-complete-matrix.test.mjs',
  'scripts/release/write-readiness-fixture.mjs',
  'scripts/release/write-readiness-fixture.test.mjs',
  'scripts/release/candidate-dry-run.mjs',
  'scripts/release/candidate-dry-run.test.mjs',
  'scripts/release/preflight-desktop-signing-environment.mjs',
  'scripts/release/preflight-desktop-signing-environment.test.mjs',
  'scripts/release/verify-desktop-installer-trust.mjs',
  'scripts/release/verify-desktop-installer-trust.test.mjs',
  'scripts/release/write-attestation-evidence.mjs',
  'scripts/release/write-attestation-evidence.test.mjs',
  'scripts/release/render-release-notes.mjs',
  'scripts/release/render-release-notes.test.mjs',
  'scripts/release/resolve-release-plan.mjs',
  'scripts/release/smoke-finalized-release-assets.mjs',
  'scripts/release/smoke-finalized-release-assets.test.mjs',
  'scripts/release/smoke-deployment-release-assets.mjs',
  'scripts/release/smoke-deployment-release-assets.test.mjs',
  'scripts/release/smoke-desktop-installers.mjs',
  'scripts/release/smoke-desktop-installers.test.mjs',
  'scripts/release/smoke-desktop-packaged-launch.mjs',
  'scripts/release/smoke-desktop-packaged-launch.test.mjs',
  'scripts/release/smoke-desktop-startup-evidence.mjs',
  'scripts/release/smoke-desktop-startup-evidence.test.mjs',
  'scripts/release/smoke-release-assets.mjs',
  'scripts/release/smoke-server-release-assets.mjs',
  'scripts/release/smoke-server-release-assets.test.mjs',
  'scripts/release/studio-build-evidence-archive.mjs',
  'scripts/release/studio-preview-evidence-archive.mjs',
  'scripts/release/studio-simulator-evidence-archive.mjs',
  'scripts/release/studio-test-evidence-archive.mjs',
  'sdks/.sdkwork-assembly.json',
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
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-studio/src/evidence/viewer.ts',
  'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-studio/src/evidence/StudioEvidencePanel.tsx',
];

const forbiddenResidualPaths = [
  'packages/sdkwork-birdcoder-appbase',
  'packages/sdkwork-birdcoder-appbase-storage',
  'sdks/sdkwork-birdcoder-sdk',
  'sdks/sdkwork-birdcoder-sdk-admin',
];

const rootScanTargets = [
  'package.json',
  'pnpm-workspace.yaml',
  'scripts',
  'deploy',
  'docs',
  '.github/workflows',
  'src',
  'sdks',
];

const legacyReferencePatterns = [
  { label: 'sdkwork-bird-*', pattern: /sdkwork-bird-/ },
  { label: 'sdkwork-ide-*', pattern: /sdkwork-ide-/ },
  { label: '@sdkwork/bird-*', pattern: /@sdkwork\/bird-/ },
];

const scannableExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.rs',
  '.scss',
  '.toml',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
]);

const legacyReferenceAllowlist = new Set([
  'scripts/check-sdkwork-birdcoder-structure.mjs',
  'scripts/sdkwork-birdcoder-architecture-contract.test.mjs',
]);

const errors = [];

function normalizeRelativePath(targetPath) {
  return targetPath.split(path.sep).join('/');
}

function assertExists(relativePath, label = 'required path') {
  if (!fs.existsSync(path.join(rootDir, relativePath))) {
    errors.push(`Missing ${label}: ${relativePath}`);
  }
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

function collectRootPackageScriptTargetPaths(rootPackageJson) {
  if (!rootPackageJson?.scripts || typeof rootPackageJson.scripts !== 'object') {
    return [];
  }

  const references = [];
  const seen = new Set();

  for (const [scriptName, command] of Object.entries(rootPackageJson.scripts)) {
    if (typeof command !== 'string') {
      continue;
    }

    for (const match of command.matchAll(/((?:(?:\.\.?\/)*)scripts\/[A-Za-z0-9_./-]+\.(?:cjs|js|mjs|ps1|ts))/g)) {
      const matchIndex = match.index ?? 0;
      if (matchIndex > 0 && command[matchIndex - 1] === '/') {
        continue;
      }

      const rawPath = match[1].replace(/\\/g, '/');
      if (rawPath.includes('..')) {
        continue;
      }
      const scriptsIndex = rawPath.indexOf('scripts/');

      if (scriptsIndex === -1) {
        continue;
      }

      const relativePath = rawPath.slice(scriptsIndex);
      if (relativePath.includes('..')) {
        continue;
      }
      const dedupeKey = `${scriptName}:${relativePath}`;
      if (seen.has(dedupeKey)) {
        continue;
      }

      seen.add(dedupeKey);
      references.push({
        command,
        relativePath,
        scriptName,
      });
    }
  }

  return references;
}

function assertRootPackageScriptTargetsExist(rootPackageJson) {
  for (const reference of collectRootPackageScriptTargetPaths(rootPackageJson)) {
    if (!fs.existsSync(path.join(rootDir, reference.relativePath))) {
      errors.push(`Root package script ${reference.scriptName} references missing repo file: ${reference.relativePath}`);
    }
  }
}

function scanForLegacyReferences(absolutePath) {
  if (!fs.existsSync(absolutePath)) {
    return;
  }

  const stack = [absolutePath];
  while (stack.length > 0) {
    const currentPath = stack.pop();
    const stat = fs.statSync(currentPath);

    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
        if (['.git', 'artifacts', 'dist', 'node_modules', 'target'].includes(entry.name)) {
          continue;
        }
        stack.push(path.join(currentPath, entry.name));
      }
      continue;
    }

    if (!scannableExtensions.has(path.extname(currentPath))) {
      continue;
    }

    const relativePath = normalizeRelativePath(path.relative(rootDir, currentPath));
    if (legacyReferenceAllowlist.has(relativePath)) {
      continue;
    }

    const source = fs.readFileSync(currentPath, 'utf8');
    for (const { label, pattern } of legacyReferencePatterns) {
      if (pattern.test(source)) {
        errors.push(`Legacy ${label} reference remains in ${relativePath}`);
      }
    }
  }
}

function assertWorkspaceTargetsBirdCoderPackages() {
  if (!fs.existsSync(workspaceConfigPath)) {
    errors.push('Missing pnpm workspace config: pnpm-workspace.yaml');
    return;
  }

  const source = fs.readFileSync(workspaceConfigPath, 'utf8');
  const birdcoderGlobs = source.match(/'packages\/sdkwork-birdcoder-\*'/g) ?? [];

  if (birdcoderGlobs.length !== 1) {
    errors.push("pnpm-workspace.yaml must include exactly one 'packages/sdkwork-birdcoder-*' workspace glob.");
  }

  if (source.includes("'packages/*'")) {
    errors.push("pnpm-workspace.yaml must not include the legacy 'packages/*' workspace glob.");
  }

  if (source.includes('sdkwork-bird-') || source.includes('sdkwork-ide-') || source.includes('@sdkwork/bird-')) {
    errors.push('pnpm-workspace.yaml must not include legacy workspace globs or package prefixes.');
  }
}

function assertNoLegacyPackageDirs() {
  if (!fs.existsSync(packagesDir)) {
    errors.push('Missing packages directory.');
    return;
  }

  const legacyDirs = fs
    .readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && (entry.name.startsWith('sdkwork-bird-') || entry.name.startsWith('sdkwork-ide-')))
    .map((entry) => entry.name)
    .sort();

  for (const dirName of legacyDirs) {
    errors.push(`Legacy package directory must be removed: packages/${dirName}`);
  }
}

function assertNoFacadeSourceBypass(relativePath, forbiddenPattern, label) {
  const absolutePath = path.join(rootDir, relativePath);
  if (!fs.existsSync(absolutePath)) {
    errors.push(`Missing facade source file: ${relativePath}`);
    return;
  }

  const source = fs.readFileSync(absolutePath, 'utf8');
  if (forbiddenPattern.test(source)) {
    errors.push(`${label} must not bypass package boundaries via relative source re-exports: ${relativePath}`);
  }
}

export function runSdkworkBirdcoderStructureCheck({
  stderr = console.error,
  stdout = console.log,
} = {}) {
  errors.length = 0;

  assertWorkspaceTargetsBirdCoderPackages();
  assertNoLegacyPackageDirs();

  assertExists('package.json', 'root manifest');
  let rootPackageJson = null;
  if (fs.existsSync(path.join(rootDir, 'package.json'))) {
    rootPackageJson = readJson('package.json');
    if (rootPackageJson.name !== '@sdkwork/birdcoder-workspace') {
      errors.push(`Unexpected root workspace name: expected @sdkwork/birdcoder-workspace, got ${rootPackageJson.name ?? '<missing>'}`);
    }

    assertRootPackageScriptTargetsExist(rootPackageJson);
  }

  for (const relativePath of requiredPaths) {
    assertExists(relativePath);
  }

  for (const relativePath of forbiddenResidualPaths) {
    if (fs.existsSync(path.join(rootDir, relativePath))) {
      errors.push(`Retired standalone package directory must stay removed: ${relativePath}`);
    }
  }

  for (const [relativeDir, expectedName] of requiredPackages) {
    assertExists(relativeDir, 'package directory');

    const packageJsonPath = path.join(relativeDir, 'package.json');
    assertExists(packageJsonPath, 'package manifest');
    if (!fs.existsSync(path.join(rootDir, packageJsonPath))) {
      continue;
    }

    const pkg = readJson(packageJsonPath);
    if (pkg.name !== expectedName) {
      errors.push(`Unexpected package name in ${packageJsonPath}: expected ${expectedName}, got ${pkg.name ?? '<missing>'}`);
    }

    scanForLegacyReferences(path.join(rootDir, relativeDir));
  }

  for (const relativePath of rootScanTargets) {
    scanForLegacyReferences(path.join(rootDir, relativePath));
  }

  assertNoFacadeSourceBypass(
    'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench-storage/src/index.ts',
    /sdkwork-birdcoder-commons[\\/]src[\\/]storage[\\/]/u,
    '@sdkwork/birdcoder-workbench-storage',
  );
  assertNoFacadeSourceBypass(
    'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench-state/src/index.ts',
    /sdkwork-birdcoder-commons[\\/]src[\\/](?:terminal[\\/]runConfigStorage|workbench[\\/](?:preferences|recovery))\.ts/u,
    '@sdkwork/birdcoder-workbench-state',
  );

  if (errors.length > 0) {
    stderr('SDKWork BirdCoder structure check failed:');
    for (const error of errors) {
      stderr(`- ${error}`);
    }
    return 1;
  }

  stdout('SDKWork BirdCoder structure check passed.');
  return 0;
}

export async function runSdkworkBirdcoderStructureCheckCli() {
  process.exit(runSdkworkBirdcoderStructureCheck());
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runSdkworkBirdcoderStructureCheckCli().catch((error) => {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}
