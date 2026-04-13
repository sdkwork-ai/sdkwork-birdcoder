import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const packagesDir = path.join(rootDir, 'packages');
const workspaceConfigPath = path.join(rootDir, 'pnpm-workspace.yaml');

const requiredPackages = [
  ['packages/sdkwork-birdcoder-appbase', '@sdkwork/birdcoder-appbase'],
  ['packages/sdkwork-birdcoder-chat', '@sdkwork/birdcoder-chat'],
  ['packages/sdkwork-birdcoder-chat-claude', '@sdkwork/birdcoder-chat-claude'],
  ['packages/sdkwork-birdcoder-chat-codex', '@sdkwork/birdcoder-chat-codex'],
  ['packages/sdkwork-birdcoder-chat-gemini', '@sdkwork/birdcoder-chat-gemini'],
  ['packages/sdkwork-birdcoder-chat-opencode', '@sdkwork/birdcoder-chat-opencode'],
  ['packages/sdkwork-birdcoder-code', '@sdkwork/birdcoder-code'],
  ['packages/sdkwork-birdcoder-commons', '@sdkwork/birdcoder-commons'],
  ['packages/sdkwork-birdcoder-core', '@sdkwork/birdcoder-core'],
  ['packages/sdkwork-birdcoder-desktop', '@sdkwork/birdcoder-desktop'],
  ['packages/sdkwork-birdcoder-distribution', '@sdkwork/birdcoder-distribution'],
  ['packages/sdkwork-birdcoder-host-core', '@sdkwork/birdcoder-host-core'],
  ['packages/sdkwork-birdcoder-host-studio', '@sdkwork/birdcoder-host-studio'],
  ['packages/sdkwork-birdcoder-i18n', '@sdkwork/birdcoder-i18n'],
  ['packages/sdkwork-birdcoder-infrastructure', '@sdkwork/birdcoder-infrastructure'],
  ['packages/sdkwork-birdcoder-server', '@sdkwork/birdcoder-server'],
  ['packages/sdkwork-birdcoder-settings', '@sdkwork/birdcoder-settings'],
  ['packages/sdkwork-birdcoder-shell', '@sdkwork/birdcoder-shell'],
  ['packages/sdkwork-birdcoder-skills', '@sdkwork/birdcoder-skills'],
  ['packages/sdkwork-birdcoder-studio', '@sdkwork/birdcoder-studio'],
  ['packages/sdkwork-birdcoder-templates', '@sdkwork/birdcoder-templates'],
  ['packages/sdkwork-birdcoder-terminal', '@sdkwork/birdcoder-terminal'],
  ['packages/sdkwork-birdcoder-types', '@sdkwork/birdcoder-types'],
  ['packages/sdkwork-birdcoder-ui', '@sdkwork/birdcoder-ui'],
  ['packages/sdkwork-birdcoder-web', '@sdkwork/birdcoder-web'],
];

const requiredPaths = [
  '.github/workflows/ci.yml',
  '.github/workflows/release.yml',
  '.github/workflows/release-reusable.yml',
  'deploy/docker/Dockerfile',
  'deploy/docker/docker-compose.yml',
  'deploy/kubernetes/Chart.yaml',
  'docs/index.md',
  'docs/architecture.md',
  'docs/release.md',
  'docs/release/releases.json',
  'docs/.vitepress/config.mts',
  'scripts/check-arch-boundaries.mjs',
  'scripts/ci-flow-contract.test.mjs',
  'scripts/check-sdkwork-birdcoder-structure.mjs',
  'scripts/check-release-closure.mjs',
  'scripts/quality-gate-matrix-report.mjs',
  'scripts/quality-gate-matrix-contract.test.mjs',
  'scripts/quality-gate-execution-report.mjs',
  'scripts/quality-gate-execution-report.test.mjs',
  'scripts/package-governance-contract.test.mjs',
  'scripts/prompt-governance-contract.test.mjs',
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
  'scripts/prepare-shared-sdk-git-sources.mjs',
  'scripts/prepare-shared-sdk-packages.mjs',
  'scripts/run-vitepress.mjs',
  'scripts/shared-sdk-mode.mjs',
  'scripts/sdkwork-birdcoder-architecture-contract.test.mjs',
  'scripts/release-flow-contract.test.mjs',
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
  'packages/sdkwork-birdcoder-studio/src/evidence/viewer.ts',
  'packages/sdkwork-birdcoder-studio/src/evidence/StudioEvidencePanel.tsx',
];

const forbiddenResidualPaths = [
  'packages/sdkwork-birdcoder-auth',
  'packages/sdkwork-birdcoder-user',
];

const rootScanTargets = [
  'package.json',
  'pnpm-workspace.yaml',
  'scripts',
  'deploy',
  'docs',
  '.github/workflows',
  'src',
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

assertWorkspaceTargetsBirdCoderPackages();
assertNoLegacyPackageDirs();

assertExists('package.json', 'root manifest');
if (fs.existsSync(path.join(rootDir, 'package.json'))) {
  const rootPackageJson = readJson('package.json');
  if (rootPackageJson.name !== '@sdkwork/birdcoder-workspace') {
    errors.push(`Unexpected root workspace name: expected @sdkwork/birdcoder-workspace, got ${rootPackageJson.name ?? '<missing>'}`);
  }
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

if (errors.length > 0) {
  console.error('SDKWork BirdCoder structure check failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('SDKWork BirdCoder structure check passed.');
