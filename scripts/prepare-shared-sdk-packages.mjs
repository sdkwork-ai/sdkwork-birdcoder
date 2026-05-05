#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { ensureSharedSdkGitSources } from './prepare-shared-sdk-git-sources.mjs';
import { resolveSharedSdkMode } from './shared-sdk-mode.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scriptWorkspaceRoot = path.resolve(__dirname, '..');
const DEPENDENCY_BRIDGE_MARKER_FILE_NAME = '.sdkwork-birdcoder-dependency-bridge.json';
const FALLBACK_SHARED_SDK_BRIDGE_DEPENDENCIES = Object.freeze([
  '@tauri-apps/api',
  '@types/react',
  '@types/react-dom',
  '@xterm/addon-canvas',
  '@xterm/addon-fit',
  '@xterm/addon-search',
  '@xterm/addon-unicode11',
  '@xterm/xterm',
  'lucide-react',
  'qrcode',
  'react',
  'react-dom',
  'react-hook-form',
  'react-router',
  'react-router-dom',
  'typescript',
]);
const SHARED_PACKAGE_BRIDGE_SPECS = Object.freeze([
  {
    id: 'sdkwork-appbase',
    relativePackageRoots: [
      'packages/pc-react/identity/sdkwork-auth-pc-react',
      'packages/pc-react/identity/sdkwork-auth-runtime-pc-react',
      'packages/pc-react/foundation/sdkwork-appbase-pc-react',
      'packages/pc-react/foundation/sdkwork-search-pc-react',
      'packages/pc-react/identity/sdkwork-user-pc-react',
      'packages/pc-react/identity/sdkwork-user-center-pc-react',
      'packages/pc-react/identity/sdkwork-user-center-core-pc-react',
      'packages/pc-react/identity/sdkwork-user-center-validation-pc-react',
      'packages/pc-react/commerce/sdkwork-vip-pc-react',
      'packages/pc-react/commerce/sdkwork-wallet-pc-react',
    ],
  },
  {
    id: 'sdkwork-ui',
    relativePackageRoots: [
      'sdkwork-ui-pc-react',
    ],
  },
  {
    id: 'sdkwork-terminal',
    relativePackageRoots: [
      'apps/desktop',
      'packages/sdkwork-terminal-ai-cli',
      'packages/sdkwork-terminal-commons',
      'packages/sdkwork-terminal-contracts',
      'packages/sdkwork-terminal-core',
      'packages/sdkwork-terminal-diagnostics',
      'packages/sdkwork-terminal-i18n',
      'packages/sdkwork-terminal-infrastructure',
      'packages/sdkwork-terminal-resources',
      'packages/sdkwork-terminal-sessions',
      'packages/sdkwork-terminal-settings',
      'packages/sdkwork-terminal-shell',
      'packages/sdkwork-terminal-types',
      'packages/sdkwork-terminal-ui',
      'packages/sdkwork-terminal-workbench',
    ],
  },
]);

export function resolveWorkspaceRootDir(currentWorkingDir = process.cwd()) {
  let candidateDir = path.resolve(currentWorkingDir);

  while (true) {
    const packageJsonPath = path.join(candidateDir, 'package.json');
    const workspaceManifestPath = path.join(candidateDir, 'pnpm-workspace.yaml');

    if (fs.existsSync(packageJsonPath) && fs.existsSync(workspaceManifestPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (packageJson?.name === '@sdkwork/birdcoder-workspace') {
          return candidateDir;
        }
      } catch {
        // Ignore parse failures and continue walking upward.
      }
    }

    const parentDir = path.dirname(candidateDir);
    if (parentDir === candidateDir) {
      break;
    }

    candidateDir = parentDir;
  }

  return scriptWorkspaceRoot;
}

function normalizePackageName(packageName) {
  return String(packageName ?? '').trim();
}

function readPackageJson(packageRoot) {
  const packageJsonPath = path.join(packageRoot, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
}

function collectDeclaredDependencies(packageRoot) {
  const packageJson = readPackageJson(packageRoot);
  if (!packageJson) {
    return [];
  }

  const dependencies = new Map(FALLBACK_SHARED_SDK_BRIDGE_DEPENDENCIES.map((dependencyName) => [dependencyName, '']));
  for (const fieldName of ['dependencies', 'peerDependencies', 'devDependencies']) {
    const dependencyMap = packageJson?.[fieldName];
    if (!dependencyMap || typeof dependencyMap !== 'object' || Array.isArray(dependencyMap)) {
      continue;
    }

    for (const [dependencyName, dependencySpec] of Object.entries(dependencyMap)) {
      dependencies.set(dependencyName, String(dependencySpec ?? ''));
    }
  }

  return [...dependencies.entries()]
    .map(([name, spec]) => ({
      name: normalizePackageName(name),
      spec: String(spec ?? '').trim(),
    }))
    .filter((dependency) => dependency.name.length > 0)
    .sort((left, right) => left.name.localeCompare(right.name));
}

function resolvePackageTargetPath(packageName, baseDir) {
  return path.join(baseDir, ...packageName.split('/'));
}

function parseVersion(version) {
  const match = /^(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)/u.exec(String(version ?? '').trim());
  if (!match?.groups) {
    return null;
  }

  return [
    Number.parseInt(match.groups.major, 10),
    Number.parseInt(match.groups.minor, 10),
    Number.parseInt(match.groups.patch, 10),
  ];
}

function compareParsedVersions(left, right) {
  for (let index = 0; index < 3; index += 1) {
    const diff = left[index] - right[index];
    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
}

function candidateSatisfiesDependencySpec(candidateVersion, dependencySpec) {
  const normalizedSpec = String(dependencySpec ?? '').trim();
  if (!normalizedSpec || normalizedSpec === '*' || normalizedSpec === 'catalog:') {
    return true;
  }

  const candidate = parseVersion(candidateVersion);
  if (!candidate) {
    return true;
  }

  const exactVersion = parseVersion(normalizedSpec);
  if (exactVersion) {
    return compareParsedVersions(candidate, exactVersion) === 0;
  }

  const caretMatch = /^\^(?<version>\d+\.\d+\.\d+)/u.exec(normalizedSpec);
  if (caretMatch?.groups?.version) {
    const minimum = parseVersion(caretMatch.groups.version);
    return Boolean(minimum)
      && candidate[0] === minimum[0]
      && compareParsedVersions(candidate, minimum) >= 0;
  }

  const tildeMatch = /^~(?<version>\d+\.\d+\.\d+)/u.exec(normalizedSpec);
  if (tildeMatch?.groups?.version) {
    const minimum = parseVersion(tildeMatch.groups.version);
    return Boolean(minimum)
      && candidate[0] === minimum[0]
      && candidate[1] === minimum[1]
      && compareParsedVersions(candidate, minimum) >= 0;
  }

  const minimumMatch = />=\s*(?<version>\d+\.\d+\.\d+)/u.exec(normalizedSpec);
  const maximumMatch = /<\s*(?<version>\d+\.\d+\.\d+)/u.exec(normalizedSpec);
  if (minimumMatch?.groups?.version || maximumMatch?.groups?.version) {
    const minimum = minimumMatch?.groups?.version ? parseVersion(minimumMatch.groups.version) : null;
    const maximum = maximumMatch?.groups?.version ? parseVersion(maximumMatch.groups.version) : null;
    return (!minimum || compareParsedVersions(candidate, minimum) >= 0)
      && (!maximum || compareParsedVersions(candidate, maximum) < 0);
  }

  return true;
}

function readInstalledPackageCandidate(packageRoot) {
  const packageJson = readPackageJson(packageRoot);
  if (!packageJson?.name) {
    return null;
  }

  return {
    packageRoot,
    name: String(packageJson.name),
    version: String(packageJson.version ?? ''),
  };
}

function collectInstalledPackageCandidates(packageName, workspaceRootDir) {
  const candidates = [];
  const directCandidateRoots = [
    resolvePackageTargetPath(packageName, path.join(workspaceRootDir, 'node_modules')),
    resolvePackageTargetPath(packageName, path.join(workspaceRootDir, 'node_modules', '.pnpm', 'node_modules')),
  ];

  for (const candidateRoot of directCandidateRoots) {
    const candidate = readInstalledPackageCandidate(candidateRoot);
    if (candidate?.name === packageName) {
      candidates.push(candidate);
    }
  }

  const pnpmStoreDir = path.join(workspaceRootDir, 'node_modules', '.pnpm');
  if (fs.existsSync(pnpmStoreDir)) {
    for (const entry of fs.readdirSync(pnpmStoreDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }

      const candidateRoot = resolvePackageTargetPath(packageName, path.join(pnpmStoreDir, entry.name, 'node_modules'));
      const candidate = readInstalledPackageCandidate(candidateRoot);
      if (candidate?.name === packageName) {
        candidates.push(candidate);
      }
    }
  }

  return candidates;
}

function resolveInstalledPackageRoot(packageName, workspaceRootDir, dependencySpec = '') {
  const candidates = collectInstalledPackageCandidates(packageName, workspaceRootDir);
  if (candidates.length === 0) {
    return null;
  }

  const satisfyingCandidates = candidates.filter((candidate) =>
    candidateSatisfiesDependencySpec(candidate.version, dependencySpec),
  );
  const rankedCandidates = satisfyingCandidates.length > 0 ? satisfyingCandidates : candidates;
  rankedCandidates.sort((left, right) => {
    const leftVersion = parseVersion(left.version);
    const rightVersion = parseVersion(right.version);
    if (leftVersion && rightVersion) {
      return compareParsedVersions(rightVersion, leftVersion);
    }

    return left.packageRoot.localeCompare(right.packageRoot);
  });

  return rankedCandidates[0].packageRoot;
}

function bridgeMarkerPath(bridgeRoot) {
  return path.join(bridgeRoot, DEPENDENCY_BRIDGE_MARKER_FILE_NAME);
}

function removeExistingNodeModulesBridge(bridgeRoot) {
  if (!fs.existsSync(bridgeRoot)) {
    return true;
  }

  const stat = fs.lstatSync(bridgeRoot);
  if (!stat.isSymbolicLink() && !stat.isDirectory()) {
    throw new Error(
      `[prepare-shared-sdk-packages] Expected node_modules bridge directory at ${bridgeRoot}.`,
    );
  }

  if (!fs.existsSync(bridgeMarkerPath(bridgeRoot))) {
    return false;
  }

  fs.rmSync(bridgeRoot, { recursive: true, force: true });
  return true;
}

function linkDependencyPackage({
  dependencyName,
  dependencyRoot,
  bridgeRoot,
}) {
  const linkPath = resolvePackageTargetPath(dependencyName, bridgeRoot);
  fs.mkdirSync(path.dirname(linkPath), { recursive: true });
  if (fs.existsSync(linkPath)) {
    fs.rmSync(linkPath, { recursive: true, force: true });
  }

  fs.symlinkSync(dependencyRoot, linkPath, 'junction');
}

function collectPreparedSharedWorkspacePackages(sources) {
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const packageByName = new Map();

  for (const bridgeSpec of SHARED_PACKAGE_BRIDGE_SPECS) {
    const source = sourceById.get(bridgeSpec.id);
    if (!source?.repoRoot) {
      continue;
    }

    for (const relativePackageRoot of bridgeSpec.relativePackageRoots) {
      const packageRoot = path.join(source.repoRoot, relativePackageRoot);
      const packageJson = readPackageJson(packageRoot);
      const packageName = normalizePackageName(packageJson?.name);
      if (packageName.length === 0) {
        continue;
      }

      packageByName.set(packageName, {
        packageRoot,
        sourceId: bridgeSpec.id,
        relativePackageRoot,
      });
    }
  }

  return packageByName;
}

function prepareSourceDependencyBridge({
  packageRoot,
  workspaceRootDir,
  sharedWorkspacePackageByName,
  logger,
}) {
  const dependencies = collectDeclaredDependencies(packageRoot);
  if (dependencies.length === 0) {
    return {
      packageRoot,
      linkedDependencies: [],
      skippedDependencies: [],
      bridgeRoot: path.join(packageRoot, 'node_modules'),
    };
  }

  const bridgeRoot = path.join(packageRoot, 'node_modules');
  if (!removeExistingNodeModulesBridge(bridgeRoot)) {
    logger.log(
      `[prepare-shared-sdk-packages] Preserving existing unmanaged node_modules at ${bridgeRoot}.`,
    );
    return {
      packageRoot,
      linkedDependencies: [],
      skippedDependencies: dependencies.map((dependency) => dependency.name),
      preservedExistingNodeModules: true,
      bridgeRoot,
    };
  }

  fs.mkdirSync(bridgeRoot, { recursive: true });

  const linkedDependencies = [];
  const skippedDependencies = [];
  for (const { name: dependencyName, spec: dependencySpec } of dependencies) {
    if (dependencyName.startsWith('@sdkwork/')) {
      const sharedWorkspacePackage = sharedWorkspacePackageByName?.get(dependencyName);
      if (!sharedWorkspacePackage?.packageRoot) {
        skippedDependencies.push(dependencyName);
        continue;
      }

      linkDependencyPackage({
        dependencyName,
        dependencyRoot: sharedWorkspacePackage.packageRoot,
        bridgeRoot,
      });
      linkedDependencies.push(dependencyName);
      continue;
    }

    const dependencyRoot = resolveInstalledPackageRoot(dependencyName, workspaceRootDir, dependencySpec);
    if (!dependencyRoot) {
      skippedDependencies.push(dependencyName);
      continue;
    }

    linkDependencyPackage({
      dependencyName,
      dependencyRoot,
      bridgeRoot,
    });
    linkedDependencies.push(dependencyName);
  }

  logger.log(
    `[prepare-shared-sdk-packages] Prepared dependency bridge for ${packageRoot} (${linkedDependencies.length} linked, ${skippedDependencies.length} skipped).`,
  );
  fs.writeFileSync(
    bridgeMarkerPath(bridgeRoot),
    JSON.stringify({
      managedBy: '@sdkwork/birdcoder-workspace',
      purpose: 'git-backed shared SDK dependency resolution bridge',
      linkedDependencies,
      skippedDependencies,
    }, null, 2) + '\n',
  );

  return {
    packageRoot,
    linkedDependencies,
    skippedDependencies,
    preservedExistingNodeModules: false,
    bridgeRoot,
  };
}

export function prepareSharedSdkDependencyBridges({
  workspaceRootDir,
  sources,
  logger = console,
} = {}) {
  if (!Array.isArray(sources) || sources.length === 0) {
    return [];
  }

  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const sharedWorkspacePackageByName = collectPreparedSharedWorkspacePackages(sources);
  const bridges = [];

  for (const bridgeSpec of SHARED_PACKAGE_BRIDGE_SPECS) {
    const source = sourceById.get(bridgeSpec.id);
    if (!source?.repoRoot) {
      continue;
    }

    for (const relativePackageRoot of bridgeSpec.relativePackageRoots) {
      const packageRoot = path.join(source.repoRoot, relativePackageRoot);
      if (!fs.existsSync(path.join(packageRoot, 'package.json'))) {
        continue;
      }

      bridges.push({
        id: bridgeSpec.id,
        relativePackageRoot,
        ...prepareSourceDependencyBridge({
          packageRoot,
          workspaceRootDir,
          sharedWorkspacePackageByName,
          logger,
        }),
      });
    }
  }

  return bridges;
}

export function prepareSharedSdkPackages({
  currentWorkingDir = process.cwd(),
  workspaceRootDir,
  env = process.env,
  logger = console,
  syncExistingRepos,
  spawnSyncImpl,
} = {}) {
  const workspaceRoot = workspaceRootDir ?? resolveWorkspaceRootDir(currentWorkingDir);
  const mode = resolveSharedSdkMode(env);

  if (mode === 'git') {
    logger.log('[prepare-shared-sdk-packages] Ensuring git-backed shared SDK sources are available.');
    const result = ensureSharedSdkGitSources({
      workspaceRootDir: workspaceRoot,
      env,
      logger,
      syncExistingRepos,
      spawnSyncImpl,
    });
    const dependencyBridges = prepareSharedSdkDependencyBridges({
      workspaceRootDir: workspaceRoot,
      sources: result.sources,
      logger,
    });

    return {
      mode,
      prepared: true,
      sources: result.sources,
      dependencyBridges,
      workspaceRoot,
    };
  }

  logger.log('[prepare-shared-sdk-packages] shared SDK mode is source; no extra package preparation is required for BirdCoder.');
  return {
    mode,
    prepared: false,
    sources: [],
    dependencyBridges: [],
    workspaceRoot,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(JSON.stringify(prepareSharedSdkPackages(), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
