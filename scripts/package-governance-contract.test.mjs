import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import {
  collectBirdcoderApplicationPackageManifests,
} from './lib/birdcoder-package-scan-roots.mjs';

const rootDir = process.cwd();
const workspaceConfigPath = path.join(rootDir, 'pnpm-workspace.yaml');
const dependencySections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
const externalTerminalPackagesRootDir = path.join(
  rootDir,
  '..',
  'sdkwork-terminal',
  'packages',
);
const externalTerminalAppsRootDir = path.join(
  rootDir,
  '..',
  'sdkwork-terminal',
  'apps',
);
const externalTerminalPcPackagesRootDir = path.join(
  rootDir,
  '..',
  'sdkwork-terminal',
  'apps',
  'sdkwork-terminal-pc',
  'packages',
);
const approvedExternalSdkworkLinkDirectories = new Map([
  [
    '@sdkwork/auth-pc-react',
    path.join(
      rootDir,
      '..',
      'sdkwork-appbase',
      'packages',
      'pc-react',
      'iam',
      'sdkwork-auth-pc-react',
    ),
  ],
  [
    '@sdkwork/user-pc-react',
    path.join(
      rootDir,
      '..',
      'sdkwork-appbase',
      'packages',
      'pc-react',
      'iam',
      'sdkwork-user-pc-react',
    ),
  ],
  [
    '@sdkwork/drive-app-sdk',
    path.join(
      rootDir,
      '..',
      'sdkwork-drive',
      'sdks',
      'sdkwork-drive-app-sdk',
      'sdkwork-drive-app-sdk-typescript',
    ),
  ],
]);

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

function collectWorkspaceManifests() {
  return collectBirdcoderApplicationPackageManifests(rootDir, (absolutePath) =>
    JSON.parse(fs.readFileSync(absolutePath, 'utf8')),
  );
}

function readPackageJson(packageJsonPath) {
  return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
}

function globSegmentToRegex(segment) {
  const escaped = segment.replace(/[.+?^${}()|[\]\\]/gu, '\\$&');
  return new RegExp(`^${escaped.replace(/\*/gu, '.*')}$`, 'u');
}

function collectWorkspacePackageGlobs(workspaceConfigSource) {
  // Parse packages section line by line to handle all entries including external paths
  const lines = workspaceConfigSource.split(/\r?\n/);
  let inPackagesSection = false;
  const packageGlobs = [];

  for (const line of lines) {
    if (line.startsWith('packages:')) {
      inPackagesSection = true;
      continue;
    }
    if (line.startsWith('catalog:')) {
      // packages section ends when catalog: begins
      break;
    }
    
    if (inPackagesSection && line.startsWith('  - ')) {
      const match = line.match(/^  - ['"]([^'"]+)['"]\s*$/u);
      if (match) {
        packageGlobs.push(match[1]);
      }
    }
  }

  assert.ok(packageGlobs.length > 0, 'pnpm-workspace.yaml must define at least one package glob.');
  return packageGlobs;
}

function expandWorkspacePackageGlob(packageGlob) {
  const normalizedGlob = normalizeManifestDependencyPath(packageGlob);
  const segments = normalizedGlob.split('/');
  const wildcardIndex = segments.findIndex((segment) => segment.includes('*'));

  if (wildcardIndex === -1) {
    const packageJsonPath = path.join(rootDir, ...segments, 'package.json');
    return fs.existsSync(packageJsonPath) ? [packageJsonPath] : [];
  }

  const baseDir = path.join(rootDir, ...segments.slice(0, wildcardIndex));
  if (!fs.existsSync(baseDir)) {
    return [];
  }

  const segmentRegex = globSegmentToRegex(segments[wildcardIndex]);
  const remainingSegments = segments.slice(wildcardIndex + 1);
  return fs.readdirSync(baseDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && segmentRegex.test(entry.name))
    .map((entry) => path.join(baseDir, entry.name, ...remainingSegments, 'package.json'))
    .filter((packageJsonPath) => fs.existsSync(packageJsonPath))
    .sort();
}

function collectConfiguredWorkspacePackageNames(workspaceConfigSource) {
  const workspacePackageNames = new Set();
  for (const packageGlob of collectWorkspacePackageGlobs(workspaceConfigSource)) {
    for (const packageJsonPath of expandWorkspacePackageGlob(packageGlob)) {
      const manifest = readPackageJson(packageJsonPath);
      if (typeof manifest.name === 'string' && manifest.name.length > 0) {
        workspacePackageNames.add(manifest.name);
      }
    }
  }
  return workspacePackageNames;
}

function collectCatalogEntries(workspaceConfigSource) {
  const catalogMatch = workspaceConfigSource.match(/^catalog:\s*$(?<body>[\s\S]*)/m);
  assert.ok(catalogMatch?.groups?.body, 'pnpm-workspace.yaml must define a catalog section.');

  const catalogEntries = new Set();
  for (const line of catalogMatch.groups.body.split(/\r?\n/)) {
    const match = line.match(/^  ['"]?([^'":]+)['"]?:\s+/);
    if (!match) {
      if (line.trim().length === 0) {
        continue;
      }
      if (!line.startsWith('  ')) {
        break;
      }
      continue;
    }
    catalogEntries.add(match[1]);
  }
  return catalogEntries;
}

function normalizeManifestDependencyPath(rawPath) {
  return String(rawPath ?? '').replace(/\\/gu, '/');
}

function resolveApprovedExternalSdkworkLinkDirectory(dependencyName) {
  if (dependencyName === '@sdkwork/terminal-desktop') {
    return path.join(externalTerminalAppsRootDir, 'desktop');
  }

  if (/^@sdkwork\/terminal-pc-/u.test(dependencyName)) {
    return path.join(
      externalTerminalPcPackagesRootDir,
      dependencyName.replace(/^@sdkwork\//u, 'sdkwork-'),
    );
  }

  if (/^@sdkwork\/terminal-/u.test(dependencyName)) {
    return path.join(
      externalTerminalPackagesRootDir,
      dependencyName.replace(/^@sdkwork\//u, 'sdkwork-'),
    );
  }

  return approvedExternalSdkworkLinkDirectories.get(dependencyName) ?? null;
}

function buildExpectedApprovedExternalSdkworkLinkVersion(relativePath, dependencyName) {
  const externalPackageDir = resolveApprovedExternalSdkworkLinkDirectory(dependencyName);
  if (!externalPackageDir) {
    return null;
  }

  const packageDir = path.dirname(path.join(rootDir, relativePath));
  const relativeExternalPackageDir = path.relative(packageDir, externalPackageDir);
  return `link:${normalizeManifestDependencyPath(relativeExternalPackageDir)}`;
}

function isApprovedExternalSdkworkLinkVersion(relativePath, dependencyName, version) {
  const expectedVersion = buildExpectedApprovedExternalSdkworkLinkVersion(relativePath, dependencyName);
  return expectedVersion !== null && version === expectedVersion;
}

const rootPackageJson = readJson('package.json');
const qualityFastRunnerModule = await import(
  pathToFileURL(path.join(rootDir, 'scripts/run-quality-fast-check.mjs')).href
);
const workspaceConfigSource = fs.readFileSync(workspaceConfigPath, 'utf8');
const workspacePackages = collectWorkspaceManifests();
const workspacePackageGlobs = collectWorkspacePackageGlobs(workspaceConfigSource);
const workspacePackageNames = collectConfiguredWorkspacePackageNames(workspaceConfigSource);
const catalogEntries = collectCatalogEntries(workspaceConfigSource);

assert.equal(rootPackageJson.name, '@sdkwork/birdcoder-workspace');
assert.equal(
  rootPackageJson.scripts['check:package-governance'],
  'node scripts/package-governance-contract.test.mjs',
  'root package.json must expose check:package-governance.',
);
assert.equal(
  rootPackageJson.scripts['check:package-subpath-exports'],
  'node scripts/package-subpath-exports-contract.test.mjs',
  'root package.json must expose check:package-subpath-exports.',
);
assert.equal(rootPackageJson.scripts.lint, 'node scripts/run-quality-fast-check.mjs');
assert.ok(
  qualityFastRunnerModule.QUALITY_FAST_CHECK_COMMANDS.includes(
    'node scripts/run-workspace-package-script.mjs . check:package-governance',
  ),
  'lint must execute the package-governance contract through the governed quality-fast runner.',
);
assert.ok(
  qualityFastRunnerModule.QUALITY_FAST_CHECK_COMMANDS.includes(
    'node scripts/run-workspace-package-script.mjs . check:package-subpath-exports',
  ),
  'lint must execute the package-subpath-exports contract through the governed quality-fast runner.',
);
assert.ok(
  workspacePackageGlobs.includes('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-*'),
  'pnpm-workspace.yaml must target apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-*.',
);
assert.ok(
  workspacePackageGlobs.includes('apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-*'),
  'pnpm-workspace.yaml must target apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-*.',
);
assert.ok(
  workspacePackageGlobs.includes('apps/sdkwork-birdcoder-common'),
  'pnpm-workspace.yaml must include apps/sdkwork-birdcoder-common for cross-surface packages.',
);
assert.ok(
  workspacePackageGlobs.includes('apps/sdkwork-birdcoder-flutter-mobile'),
  'pnpm-workspace.yaml must include apps/sdkwork-birdcoder-flutter-mobile.',
);
assert.doesNotMatch(
  workspaceConfigSource,
  /packages\/sdkwork-birdcoder-\*/,
  'pnpm-workspace.yaml must not retain the retired root packages/sdkwork-birdcoder-* workspace glob.',
);
assert.doesNotMatch(
  workspaceConfigSource,
  /^  - ['"]packages\/\*['"]/m,
  'pnpm-workspace.yaml must not fall back to the legacy root packages/* workspace glob.',
);

for (const { dirName, relativePath, manifest } of workspacePackages) {
  const suffix = dirName.replace(/^sdkwork-birdcoder-/, '');
  assert.ok(suffix.length > 0, `${relativePath} must live under a sdkwork-birdcoder-* directory.`);
  assert.equal(
    manifest.name,
    `@sdkwork/birdcoder-${suffix}`,
    `${relativePath} must use the scoped @sdkwork/birdcoder-* package name that matches its directory suffix.`,
  );
}

const thirdPartyUsage = new Map();

function expectedTypecheckScript(relativePath) {
  const packageDir = path.dirname(relativePath).replace(/\\/g, '/');
  if (packageDir === '.') {
    return 'node scripts/run-local-typescript.mjs --noEmit';
  }
  const depth = packageDir.split('/').length;
  const prefix = `${'../'.repeat(depth)}scripts/run-local-typescript.mjs`;
  return `node ${prefix} --noEmit`;
}

for (const { relativePath, manifest } of [
  { relativePath: 'package.json', manifest: rootPackageJson },
  ...workspacePackages,
]) {
  for (const section of dependencySections) {
    for (const [dependencyName, version] of Object.entries(manifest[section] ?? {})) {
      if (workspacePackageNames.has(dependencyName)) {
        assert.equal(
          version,
          'workspace:*',
          `${relativePath} must reference internal package ${dependencyName} with workspace:* in ${section}.`,
        );
        continue;
      }

      if (version === 'workspace:*') {
        assert.ok(
          workspacePackageNames.has(dependencyName),
          `${relativePath} uses workspace:* for non-workspace dependency ${dependencyName} in ${section}.`,
        );
        continue;
      }

      if (version === 'catalog:') {
        assert.ok(
          catalogEntries.has(dependencyName),
          `${relativePath} uses catalog: for ${dependencyName} in ${section}, but pnpm-workspace.yaml does not define it.`,
        );
        continue;
      }

      if (typeof version === 'string' && version.startsWith('link:')) {
        assert.ok(
          isApprovedExternalSdkworkLinkVersion(relativePath, dependencyName, version),
          [
            `${relativePath} uses unsupported local link dependency ${dependencyName} in ${section}.`,
            `Expected: ${buildExpectedApprovedExternalSdkworkLinkVersion(relativePath, dependencyName)}`,
            `Actual: ${version}`,
          ].join('\n'),
        );
        continue;
      }

      const uses = thirdPartyUsage.get(dependencyName) ?? [];
      uses.push({ relativePath, section, version });
      thirdPartyUsage.set(dependencyName, uses);
    }
  }

  if (relativePath !== 'package.json' && typeof manifest.scripts?.typecheck === 'string') {
    assert.equal(
      manifest.scripts.typecheck,
      expectedTypecheckScript(relativePath),
      `${relativePath} must route typecheck through the workspace-local TypeScript runner instead of shelling out to a bare tsc binary.`,
    );
  }
}

for (const [dependencyName, uses] of [...thirdPartyUsage.entries()].sort((left, right) => left[0].localeCompare(right[0]))) {
  if (uses.length <= 1) {
    continue;
  }

  assert.fail(
    [
      `Shared third-party dependency ${dependencyName} must be governed from pnpm-workspace.yaml catalog and referenced with catalog:.`,
      ...uses.map((use) => `- ${use.relativePath} -> ${use.section}:${use.version}`),
    ].join('\n'),
  );
}

console.log('package governance contract passed.');
