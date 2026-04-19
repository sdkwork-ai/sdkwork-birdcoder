import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const rootDir = process.cwd();
const packagesDir = path.join(rootDir, 'packages');
const workspaceConfigPath = path.join(rootDir, 'pnpm-workspace.yaml');
const dependencySections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

function collectWorkspaceManifests() {
  return fs.readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((dirName) => fs.existsSync(path.join(packagesDir, dirName, 'package.json')))
    .sort()
    .map((dirName) => ({
      dirName,
      relativePath: path.join('packages', dirName, 'package.json'),
      manifest: readJson(path.join('packages', dirName, 'package.json')),
    }));
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

const rootPackageJson = readJson('package.json');
const qualityFastRunnerModule = await import(
  pathToFileURL(path.join(rootDir, 'scripts/run-quality-fast-check.mjs')).href
);
const workspaceConfigSource = fs.readFileSync(workspaceConfigPath, 'utf8');
const workspacePackages = collectWorkspaceManifests();
const workspacePackageNames = new Set(workspacePackages.map(({ manifest }) => manifest.name));
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
assert.match(
  workspaceConfigSource,
  /^packages:\s*\r?\n  - 'packages\/sdkwork-birdcoder-\*'/m,
  'pnpm-workspace.yaml must target packages/sdkwork-birdcoder-*.',
);
assert.doesNotMatch(
  workspaceConfigSource,
  /packages\/\*/,
  'pnpm-workspace.yaml must not fall back to the legacy packages/* workspace glob.',
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

      const uses = thirdPartyUsage.get(dependencyName) ?? [];
      uses.push({ relativePath, section, version });
      thirdPartyUsage.set(dependencyName, uses);
    }
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
