#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { sha256File } from './sdkwork-utils-digest.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export const PROVIDER_WORKER_FILE_NAMES = Object.freeze([
  'generic-ts-sdk-worker.mjs',
  'engine-sdk-live.mjs',
  'codex-app-server-runtime.mjs',
  'codex-app-server-live.mjs',
  'codex-app-server-interactions.mjs',
  'codex-app-server-host-requests.mjs',
  'codex-cli-live.mjs',
  'provider-cli-live.mjs',
  'generic_python_sdk_worker.py',
]);

const TARGETS = new Map([
  ['x86_64-pc-windows-msvc', {
    arch: 'x64',
    codexPackageName: '@openai/codex-win32-x64',
    platform: 'win32',
  }],
  ['aarch64-pc-windows-msvc', {
    arch: 'arm64',
    codexPackageName: '@openai/codex-win32-arm64',
    platform: 'win32',
  }],
  ['x86_64-apple-darwin', {
    arch: 'x64',
    codexPackageName: '@openai/codex-darwin-x64',
    platform: 'darwin',
  }],
  ['aarch64-apple-darwin', {
    arch: 'arm64',
    codexPackageName: '@openai/codex-darwin-arm64',
    platform: 'darwin',
  }],
  ['x86_64-unknown-linux-gnu', {
    arch: 'x64',
    codexPackageName: '@openai/codex-linux-x64',
    platform: 'linux',
  }],
  ['aarch64-unknown-linux-gnu', {
    arch: 'arm64',
    codexPackageName: '@openai/codex-linux-arm64',
    platform: 'linux',
  }],
]);

const TARGET_TRIPLE_BY_PLATFORM_ARCH = new Map(
  [...TARGETS.entries()].map(([targetTriple, target]) => [
    `${target.platform}:${target.arch}`,
    targetTriple,
  ]),
);

function readOptionValue(argv, index, flag) {
  const value = String(argv[index + 1] ?? '').trim();
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return value;
}

export function parseArgs(argv) {
  const options = {
    arch: process.arch,
    desktopPackageDir: '',
    kernelRootDir: '',
    nodeBinaryPath: '',
    nodeLicensePath: '',
    outputRootDir: '',
    platform: process.platform,
    targetTriple: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    switch (token) {
      case '--target':
        options.targetTriple = readOptionValue(argv, index, token);
        index += 1;
        break;
      case '--platform':
        options.platform = readOptionValue(argv, index, token);
        index += 1;
        break;
      case '--arch':
      case '--host-arch':
        options.arch = readOptionValue(argv, index, token);
        index += 1;
        break;
      case '--kernel-root':
        options.kernelRootDir = readOptionValue(argv, index, token);
        index += 1;
        break;
      case '--desktop-package-dir':
        options.desktopPackageDir = readOptionValue(argv, index, token);
        index += 1;
        break;
      case '--output-root':
        options.outputRootDir = readOptionValue(argv, index, token);
        index += 1;
        break;
      case '--node-binary':
        options.nodeBinaryPath = readOptionValue(argv, index, token);
        index += 1;
        break;
      case '--node-license':
        options.nodeLicensePath = readOptionValue(argv, index, token);
        index += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${token}`);
    }
  }

  return options;
}

function normalizePlatform(value) {
  const platform = String(value ?? '').trim().toLowerCase();
  if (platform === 'windows') {
    return 'win32';
  }
  if (platform === 'macos' || platform === 'osx') {
    return 'darwin';
  }
  return platform;
}

function normalizeArch(value) {
  const arch = String(value ?? '').trim().toLowerCase();
  if (arch === 'amd64' || arch === 'x86_64') {
    return 'x64';
  }
  if (arch === 'aarch64') {
    return 'arm64';
  }
  return arch;
}

export function resolveDesktopProviderTarget({
  arch = process.arch,
  platform = process.platform,
  targetTriple = '',
} = {}) {
  const requestedTarget = String(targetTriple ?? '').trim();
  const resolvedTargetTriple = requestedTarget || TARGET_TRIPLE_BY_PLATFORM_ARCH.get(
    `${normalizePlatform(platform)}:${normalizeArch(arch)}`,
  );
  const target = TARGETS.get(resolvedTargetTriple);
  if (!target) {
    throw new Error(
      `Unsupported desktop provider host target: ${requestedTarget || `${platform}/${arch}`}.`,
    );
  }

  const executableSuffix = target.platform === 'win32' ? '.exe' : '';
  return {
    ...target,
    codexExecutableRelativePath: `bin/codex${executableSuffix}`,
    nodeRelativePath: target.platform === 'win32' ? 'node/node.exe' : 'node/bin/node',
    targetTriple: resolvedTargetTriple,
  };
}

function requireFile(filePath, description) {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
    throw new Error(`${description} is missing: ${resolvedPath}`);
  }
  return resolvedPath;
}

function requireDirectory(directoryPath, description) {
  const resolvedPath = path.resolve(directoryPath);
  if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isDirectory()) {
    throw new Error(`${description} is missing: ${resolvedPath}`);
  }
  return resolvedPath;
}

export function validateProviderWorkerDependencyClosure(
  workerSourceDir,
  workerFileNames = PROVIDER_WORKER_FILE_NAMES,
) {
  const includedWorkers = new Set(workerFileNames);
  const relativeModulePattern = /(?:from\s*|import\s*(?:\(\s*)?)['"](?<specifier>\.\/[^'"]+\.mjs)['"]/gu;
  for (const workerFileName of workerFileNames) {
    const sourcePath = requireFile(
      path.join(workerSourceDir, workerFileName),
      `SDKWork Kernel provider worker ${workerFileName}`,
    );
    const source = fs.readFileSync(sourcePath, 'utf8');
    for (const match of source.matchAll(relativeModulePattern)) {
      const dependency = path.posix.normalize(match.groups.specifier.slice(2));
      if (dependency.includes('/') || !includedWorkers.has(dependency)) {
        throw new Error(
          `SDKWork Kernel provider worker dependency is not staged: ${workerFileName} -> ${match.groups.specifier}`,
        );
      }
      requireFile(
        path.join(workerSourceDir, dependency),
        `SDKWork Kernel provider worker dependency ${dependency}`,
      );
    }
  }
}

function readJson(filePath, description) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(
      `${description} is not valid JSON: ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function resolvePackageJson(requireFrom, packageName, description) {
  try {
    return requireFrom.resolve(`${packageName}/package.json`);
  } catch (error) {
    throw new Error(
      `${description} is not installed: ${packageName}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function resolveCodexRuntime(desktopPackageDir, target) {
  const desktopPackageJsonPath = requireFile(
    path.join(desktopPackageDir, 'package.json'),
    'BirdCoder desktop package manifest',
  );
  const requireFromDesktop = createRequire(desktopPackageJsonPath);
  const codexPackageJsonPath = resolvePackageJson(
    requireFromDesktop,
    '@openai/codex',
    'Pinned Codex CLI package',
  );
  const codexPackageJson = readJson(codexPackageJsonPath, 'Codex CLI package manifest');
  const declaredNativeVersion = codexPackageJson.optionalDependencies?.[target.codexPackageName];
  if (typeof declaredNativeVersion !== 'string' || !declaredNativeVersion.trim()) {
    throw new Error(
      `Codex ${codexPackageJson.version ?? 'unknown'} does not declare ${target.codexPackageName}.`,
    );
  }

  const requireFromCodex = createRequire(codexPackageJsonPath);
  const nativePackageJsonPath = resolvePackageJson(
    requireFromCodex,
    target.codexPackageName,
    'Codex native runtime package',
  );
  const nativePackageJson = readJson(
    nativePackageJsonPath,
    'Codex native runtime package manifest',
  );
  const nativeRuntimeDir = requireDirectory(
    path.join(path.dirname(nativePackageJsonPath), 'vendor', target.targetTriple),
    'Codex native runtime directory',
  );
  const codexRuntimePackageJsonPath = requireFile(
    path.join(nativeRuntimeDir, 'codex-package.json'),
    'Codex native runtime metadata',
  );
  const codexRuntimePackageJson = readJson(
    codexRuntimePackageJsonPath,
    'Codex native runtime metadata',
  );
  if (codexRuntimePackageJson.target !== target.targetTriple) {
    throw new Error(
      `Codex native runtime target mismatch: expected ${target.targetTriple}, received ${codexRuntimePackageJson.target ?? 'unknown'}.`,
    );
  }
  if (codexRuntimePackageJson.entrypoint !== target.codexExecutableRelativePath) {
    throw new Error(
      `Codex native runtime entrypoint mismatch: expected ${target.codexExecutableRelativePath}, received ${codexRuntimePackageJson.entrypoint ?? 'unknown'}.`,
    );
  }

  const requiredRuntimeFiles = [
    target.codexExecutableRelativePath,
    `bin/codex-code-mode-host${target.platform === 'win32' ? '.exe' : ''}`,
    `codex-path/rg${target.platform === 'win32' ? '.exe' : ''}`,
    `codex-resources/codex-command-runner${target.platform === 'win32' ? '.exe' : ''}`,
  ];
  if (target.platform === 'win32') {
    requiredRuntimeFiles.push('codex-resources/codex-windows-sandbox-setup.exe');
  }
  for (const relativePath of requiredRuntimeFiles) {
    requireFile(
      path.join(nativeRuntimeDir, relativePath),
      `Codex native runtime file ${relativePath}`,
    );
  }

  return {
    codexPackageJson,
    codexPackageJsonPath,
    codexRuntimePackageJson,
    nativePackageJson,
    nativePackageJsonPath,
    nativeRuntimeDir,
  };
}

function resolveNodeLicense(nodeBinaryPath, configuredLicensePath) {
  if (String(configuredLicensePath ?? '').trim()) {
    return requireFile(configuredLicensePath, 'Node.js license');
  }
  const candidates = [
    path.join(path.dirname(nodeBinaryPath), 'LICENSE'),
    path.join(path.dirname(nodeBinaryPath), 'LICENSE.txt'),
    path.join(path.dirname(nodeBinaryPath), '..', 'LICENSE'),
    path.join(path.dirname(nodeBinaryPath), '..', 'LICENSE.txt'),
  ];
  const licensePath = candidates.find(
    (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
  );
  if (!licensePath) {
    throw new Error(`Node.js license is missing beside the bundled runtime: ${nodeBinaryPath}`);
  }
  return licensePath;
}

function resolveNodeVersion(nodeBinaryPath, configuredVersion) {
  const requestedVersion = String(configuredVersion ?? '').trim().replace(/^v/u, '');
  if (requestedVersion) {
    return requestedVersion;
  }
  if (path.resolve(nodeBinaryPath) === path.resolve(process.execPath)) {
    return process.versions.node;
  }
  const result = spawnSync(nodeBinaryPath, ['--version'], {
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });
  const version = String(result.stdout ?? '').trim().replace(/^v/u, '');
  if (result.error || result.status !== 0 || !/^\d+\.\d+\.\d+/u.test(version)) {
    throw new Error(
      `Unable to determine bundled Node.js version from ${nodeBinaryPath}: ${result.error?.message ?? result.stderr ?? `exit ${result.status}`}`,
    );
  }
  return version;
}

function listRuntimeFiles(directoryPath, prefix = '') {
  const files = [];
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolutePath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...listRuntimeFiles(absolutePath, relativePath));
    } else if (entry.isFile() && relativePath !== 'runtime-manifest.json') {
      files.push({
        path: relativePath.replaceAll('\\', '/'),
        sha256: sha256File(absolutePath),
        size: fs.statSync(absolutePath).size,
      });
    } else if (!entry.isFile()) {
      throw new Error(`Provider host cannot contain links or special files: ${absolutePath}`);
    }
  }
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

function writeCodexLauncher(stageDir, target) {
  const binDir = path.join(stageDir, 'node_modules', '.bin');
  fs.mkdirSync(binDir, { recursive: true });
  const nativeRelativePath = `../../codex/${target.targetTriple}/${target.codexExecutableRelativePath}`;
  if (target.platform === 'win32') {
    const launcherPath = path.join(binDir, 'codex.cmd');
    fs.writeFileSync(
      launcherPath,
      `@echo off\r\n"%~dp0..\\..\\codex\\${target.targetTriple}\\${target.codexExecutableRelativePath.replaceAll('/', '\\')}" %*\r\n`,
      'utf8',
    );
    return 'node_modules/.bin/codex.cmd';
  }

  const launcherPath = path.join(binDir, 'codex');
  fs.writeFileSync(
    launcherPath,
    `#!/bin/sh\nexec "$(dirname "$0")/${nativeRelativePath}" "$@"\n`,
    { encoding: 'utf8', mode: 0o755 },
  );
  fs.chmodSync(launcherPath, 0o755);
  return 'node_modules/.bin/codex';
}

function assertSafeHostDestination(outputRootDir, hostDir) {
  if (
    path.basename(hostDir) !== 'provider-host'
    || path.dirname(hostDir) !== outputRootDir
  ) {
    throw new Error(`Refusing unsafe provider host destination: ${hostDir}`);
  }
}

function renameDirectoryWithRetry(sourcePath, destinationPath) {
  const retryableErrors = new Set(['EBUSY', 'ENOTEMPTY', 'EPERM']);
  const sleepSignal = new Int32Array(new SharedArrayBuffer(4));
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      fs.renameSync(sourcePath, destinationPath);
      return;
    } catch (error) {
      if (!retryableErrors.has(error?.code) || attempt === 11) {
        throw error;
      }
      Atomics.wait(sleepSignal, 0, 0, 25 * (attempt + 1));
    }
  }
}

function validateStagedHost(stageDir, manifest) {
  for (const entry of manifest.files) {
    if (path.isAbsolute(entry.path) || entry.path.split('/').includes('..')) {
      throw new Error(`Provider host manifest path must be relative: ${entry.path}`);
    }
    const filePath = requireFile(
      path.join(stageDir, ...entry.path.split('/')),
      `Staged provider host file ${entry.path}`,
    );
    const stat = fs.statSync(filePath);
    if (stat.size !== entry.size || sha256File(filePath) !== entry.sha256) {
      throw new Error(`Staged provider host integrity mismatch: ${entry.path}`);
    }
  }
  requireFile(path.join(stageDir, manifest.node.binary), 'Staged Node.js binary');
  requireFile(path.join(stageDir, manifest.codex.executable), 'Staged Codex executable');
  requireFile(path.join(stageDir, manifest.codex.launcher), 'Staged Codex launcher');
  for (const worker of manifest.workers) {
    requireFile(path.join(stageDir, worker), `Staged provider worker ${worker}`);
  }
}

function replaceHostDirectory(outputRootDir, stageDir) {
  const hostDir = path.join(outputRootDir, 'provider-host');
  assertSafeHostDestination(outputRootDir, hostDir);
  const backupDir = path.join(
    outputRootDir,
    `.provider-host-backup-${process.pid}-${randomUUID()}`,
  );
  let movedExistingHost = false;
  try {
    if (fs.existsSync(hostDir)) {
      renameDirectoryWithRetry(hostDir, backupDir);
      movedExistingHost = true;
    }
    renameDirectoryWithRetry(stageDir, hostDir);
    if (movedExistingHost) {
      fs.rmSync(backupDir, { force: true, maxRetries: 12, recursive: true, retryDelay: 25 });
    }
    return hostDir;
  } catch (error) {
    if (!fs.existsSync(hostDir) && movedExistingHost && fs.existsSync(backupDir)) {
      renameDirectoryWithRetry(backupDir, hostDir);
    }
    throw error;
  }
}

export function stageDesktopProviderHost(options = {}) {
  const target = resolveDesktopProviderTarget(options);
  const kernelRootDir = path.resolve(
    String(options.kernelRootDir ?? '').trim() || path.join(rootDir, '..', 'sdkwork-kernel'),
  );
  const desktopPackageDir = path.resolve(
    String(options.desktopPackageDir ?? '').trim()
      || path.join(
        rootDir,
        'apps',
        'sdkwork-birdcoder-pc',
        'packages',
        'sdkwork-birdcoder-pc-desktop',
      ),
  );
  const outputRootDir = path.resolve(
    String(options.outputRootDir ?? '').trim()
      || path.join(rootDir, 'artifacts', 'desktop-provider-host'),
  );
  const workerSourceDir = requireDirectory(
    path.join(kernelRootDir, 'scripts', 'provider-transport-workers'),
    'SDKWork Kernel provider worker directory',
  );
  validateProviderWorkerDependencyClosure(workerSourceDir);
  const workerSourcePaths = PROVIDER_WORKER_FILE_NAMES.map((fileName) => requireFile(
    path.join(workerSourceDir, fileName),
    `SDKWork Kernel provider worker ${fileName}`,
  ));
  const nodeBinaryWasConfigured = Boolean(String(options.nodeBinaryPath ?? '').trim());
  if (
    !nodeBinaryWasConfigured
    && (
      target.platform !== normalizePlatform(process.platform)
      || target.arch !== normalizeArch(process.arch)
    )
  ) {
    throw new Error(
      `Cannot stage host Node.js ${process.platform}/${process.arch} for target ${target.targetTriple}; provide --node-binary for that target.`,
    );
  }
  const nodeBinaryPath = requireFile(
    String(options.nodeBinaryPath ?? '').trim() || process.execPath,
    'Node.js runtime binary',
  );
  const nodeLicensePath = resolveNodeLicense(nodeBinaryPath, options.nodeLicensePath);
  const nodeVersion = resolveNodeVersion(nodeBinaryPath, options.nodeVersion);
  const codexRuntime = resolveCodexRuntime(desktopPackageDir, target);

  fs.mkdirSync(outputRootDir, { recursive: true });
  const stageDir = path.join(
    outputRootDir,
    `.provider-host-stage-${process.pid}-${randomUUID()}`,
  );
  fs.mkdirSync(stageDir, { recursive: false });

  try {
    const workersDir = path.join(stageDir, 'workers');
    fs.mkdirSync(workersDir, { recursive: true });
    workerSourcePaths.forEach((sourcePath, index) => {
      fs.copyFileSync(sourcePath, path.join(workersDir, PROVIDER_WORKER_FILE_NAMES[index]));
    });

    const stagedNodeBinary = path.join(stageDir, ...target.nodeRelativePath.split('/'));
    fs.mkdirSync(path.dirname(stagedNodeBinary), { recursive: true });
    fs.copyFileSync(nodeBinaryPath, stagedNodeBinary);
    if (target.platform !== 'win32') {
      fs.chmodSync(stagedNodeBinary, 0o755);
    }
    const stagedNodeLicense = 'node/LICENSE';
    fs.copyFileSync(nodeLicensePath, path.join(stageDir, stagedNodeLicense));

    const stagedCodexRuntimeDir = path.join(stageDir, 'codex', target.targetTriple);
    fs.mkdirSync(path.dirname(stagedCodexRuntimeDir), { recursive: true });
    fs.cpSync(codexRuntime.nativeRuntimeDir, stagedCodexRuntimeDir, {
      dereference: true,
      recursive: true,
    });
    const launcher = writeCodexLauncher(stageDir, target);
    const workers = PROVIDER_WORKER_FILE_NAMES.map((fileName) => `workers/${fileName}`);
    const manifest = {
      schemaVersion: 1,
      runtime: 'sdkwork-birdcoder-desktop-provider-host',
      targetTriple: target.targetTriple,
      platform: target.platform,
      arch: target.arch,
      scope: {
        pythonRuntimeBundled: false,
        providerInstallerRuntimes: [],
        verifiedProviderHosts: ['codex'],
        verifiedProviderTransports: ['codex', 'hermes-agent'],
      },
      node: {
        binary: target.nodeRelativePath,
        license: stagedNodeLicense,
        version: nodeVersion,
      },
      codex: {
        executable: `codex/${target.targetTriple}/${target.codexExecutableRelativePath}`,
        launcher,
        nativePackage: target.codexPackageName,
        nativePackageVersion: codexRuntime.nativePackageJson.version,
        package: '@openai/codex',
        version: codexRuntime.codexPackageJson.version,
      },
      workers,
      files: listRuntimeFiles(stageDir),
    };
    validateStagedHost(stageDir, manifest);
    fs.writeFileSync(
      path.join(stageDir, 'runtime-manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
      'utf8',
    );

    const hostDir = replaceHostDirectory(outputRootDir, stageDir);
    return {
      fileCount: manifest.files.length,
      hostDir,
      manifestPath: path.join(hostDir, 'runtime-manifest.json'),
      targetTriple: target.targetTriple,
    };
  } catch (error) {
    if (fs.existsSync(stageDir)) {
      fs.rmSync(stageDir, { force: true, recursive: true });
    }
    throw error;
  }
}

function runCli() {
  const result = stageDesktopProviderHost(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(result, null, 2));
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
