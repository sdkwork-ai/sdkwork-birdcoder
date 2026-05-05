import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const rootDir = process.cwd();
const packagesDir = path.join(rootDir, 'packages');
const workspaceConfigPath = path.join(rootDir, 'pnpm-workspace.yaml');

const requiredPackages = [
  ['packages/sdkwork-birdcoder-auth', '@sdkwork/birdcoder-auth'],
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
  ['packages/sdkwork-birdcoder-shell-runtime', '@sdkwork/birdcoder-shell-runtime'],
  ['packages/sdkwork-birdcoder-skills', '@sdkwork/birdcoder-skills'],
  ['packages/sdkwork-birdcoder-studio', '@sdkwork/birdcoder-studio'],
  ['packages/sdkwork-birdcoder-templates', '@sdkwork/birdcoder-templates'],
  ['packages/sdkwork-birdcoder-types', '@sdkwork/birdcoder-types'],
  ['packages/sdkwork-birdcoder-ui', '@sdkwork/birdcoder-ui'],
  ['packages/sdkwork-birdcoder-ui-shell', '@sdkwork/birdcoder-ui-shell'],
  ['packages/sdkwork-birdcoder-user', '@sdkwork/birdcoder-user'],
  ['packages/sdkwork-birdcoder-web', '@sdkwork/birdcoder-web'],
  ['packages/sdkwork-birdcoder-workbench-state', '@sdkwork/birdcoder-workbench-state'],
  ['packages/sdkwork-birdcoder-workbench-storage', '@sdkwork/birdcoder-workbench-storage'],
];

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
  'scripts/user-center-upstream-sync-payload.mjs',
  'scripts/user-center-upstream-sync-payload.test.mjs',
  'scripts/user-center-upstream-sync-workflow.test.mjs',
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
  'packages/sdkwork-birdcoder-studio/src/evidence/viewer.ts',
  'packages/sdkwork-birdcoder-studio/src/evidence/StudioEvidencePanel.tsx',
];

const forbiddenResidualPaths = [
  'packages/sdkwork-birdcoder-appbase',
  'packages/sdkwork-birdcoder-appbase-storage',
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
      const rawPath = match[1].replace(/\\/g, '/');
      const scriptsIndex = rawPath.indexOf('scripts/');

      if (scriptsIndex === -1) {
        continue;
      }

      const relativePath = rawPath.slice(scriptsIndex);
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
    'packages/sdkwork-birdcoder-workbench-storage/src/index.ts',
    /sdkwork-birdcoder-commons[\\/]src[\\/]storage[\\/]/u,
    '@sdkwork/birdcoder-workbench-storage',
  );
  assertNoFacadeSourceBypass(
    'packages/sdkwork-birdcoder-workbench-state/src/index.ts',
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
