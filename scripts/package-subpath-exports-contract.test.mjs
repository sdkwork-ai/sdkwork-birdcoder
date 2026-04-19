import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const rootDir = process.cwd();
const packagesDir = path.join(rootDir, 'packages');
const sourceRoots = ['src', 'packages', 'scripts'];
const sourceExtensions = new Set([
  '.cjs',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.mts',
  '.ts',
  '.tsx',
]);
const ignoredDirectories = new Set([
  '.git',
  '.idea',
  '.turbo',
  '.vite',
  'artifacts',
  'coverage',
  'dist',
  'node_modules',
  'out',
  'target',
]);

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

function collectWorkspacePackages() {
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

function collectSourceFiles(directoryPath, relativeDirectoryPath, results) {
  if (!fs.existsSync(directoryPath)) {
    return;
  }

  for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) {
      continue;
    }

    const entryPath = path.join(directoryPath, entry.name);
    const entryRelativePath = path.join(relativeDirectoryPath, entry.name);

    if (entry.isDirectory()) {
      collectSourceFiles(entryPath, entryRelativePath, results);
      continue;
    }

    if (!sourceExtensions.has(path.extname(entry.name))) {
      continue;
    }

    results.push(entryRelativePath.split(path.sep).join('/'));
  }
}

function collectWorkspaceSourceFiles() {
  const results = [];
  for (const sourceRoot of sourceRoots) {
    collectSourceFiles(path.join(rootDir, sourceRoot), sourceRoot, results);
  }
  return results.sort();
}

function extractSdkworkSpecifiers(source) {
  const specifiers = new Set();
  const matcher = /['"](@sdkwork\/[^'"`\s)]+)['"]/g;
  let match = matcher.exec(source);
  while (match) {
    specifiers.add(match[1]);
    match = matcher.exec(source);
  }
  return [...specifiers];
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesExportSubpath(exportKey, subpath) {
  if (exportKey === subpath) {
    return true;
  }

  if (!exportKey.includes('*')) {
    return false;
  }

  const exportPattern = new RegExp(`^${escapeRegex(exportKey).replace(/\\\*/g, '[^/]+')}$`);
  return exportPattern.test(subpath);
}

function resolvePackageReference(specifier, workspacePackageNames) {
  for (const packageName of workspacePackageNames) {
    if (specifier === packageName) {
      return { packageName, subpath: null };
    }

    if (specifier.startsWith(`${packageName}/`)) {
      return {
        packageName,
        subpath: `./${specifier.slice(packageName.length + 1)}`,
      };
    }
  }

  return null;
}

const rootPackageJson = readJson('package.json');
const qualityFastRunnerModule = await import(
  pathToFileURL(path.join(rootDir, 'scripts/run-quality-fast-check.mjs')).href
);
const workspacePackages = collectWorkspacePackages()
  .filter(({ manifest }) => manifest.name.startsWith('@sdkwork/birdcoder-'))
  .sort((left, right) => right.manifest.name.length - left.manifest.name.length);
const workspacePackageNames = workspacePackages.map(({ manifest }) => manifest.name);
const packageExportsByName = new Map(
  workspacePackages.map(({ manifest, relativePath }) => [
    manifest.name,
    {
      relativePath,
      exports: manifest.exports ?? {},
    },
  ]),
);
const missingExports = [];
const resolvedChecks = [];

for (const relativePath of collectWorkspaceSourceFiles()) {
  const source = fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
  for (const specifier of extractSdkworkSpecifiers(source)) {
    const packageReference = resolvePackageReference(specifier, workspacePackageNames);
    if (!packageReference || !packageReference.subpath) {
      continue;
    }

    const packageExports = packageExportsByName.get(packageReference.packageName);
    if (!packageExports) {
      continue;
    }

    resolvedChecks.push({
      packageName: packageReference.packageName,
      relativePath,
      subpath: packageReference.subpath,
    });

    const exportKeys = Object.keys(packageExports.exports);
    if (!exportKeys.some((exportKey) => matchesExportSubpath(exportKey, packageReference.subpath))) {
      missingExports.push({
        importedSpecifier: specifier,
        packageName: packageReference.packageName,
        packageManifestPath: packageExports.relativePath,
        relativePath,
        requiredExportKey: packageReference.subpath,
      });
    }
  }
}

assert.equal(
  rootPackageJson.scripts['check:package-subpath-exports'],
  'node scripts/package-subpath-exports-contract.test.mjs',
  'root package.json must expose check:package-subpath-exports.',
);
assert.equal(rootPackageJson.scripts.lint, 'node scripts/run-quality-fast-check.mjs');
assert.ok(
  qualityFastRunnerModule.QUALITY_FAST_CHECK_COMMANDS.includes(
    'node scripts/run-workspace-package-script.mjs . check:package-subpath-exports',
  ),
  'lint must execute the package-subpath-exports contract through the governed quality-fast runner.',
);

assert.equal(
  missingExports.length,
  0,
  [
    'Workspace package subpath imports must be backed by explicit package.json exports.',
    ...missingExports.map(
      (entry) =>
        `- ${entry.relativePath} imports ${entry.importedSpecifier}, but ${entry.packageManifestPath} is missing ${entry.requiredExportKey}`,
    ),
  ].join('\n'),
);

console.log(
  `package subpath exports contract passed for ${resolvedChecks.length} internal subpath imports.`,
);
