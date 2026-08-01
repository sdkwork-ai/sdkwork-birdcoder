#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function resolveWorkspaceRootDir() {
  return path.resolve(__dirname, '..');
}

function compareVersionLike(left, right) {
  return String(left ?? '').localeCompare(String(right ?? ''), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

function parseTsxStoreVersion(storeName) {
  const match = /^tsx@(?<version>[^_]+)(?:_|$)/u.exec(String(storeName ?? ''));
  return String(match?.groups?.version ?? '').trim();
}

export function resolveInstalledTsxPackageRoot({
  cwd = process.cwd(),
  workspaceRootDir = resolveWorkspaceRootDir(),
} = {}) {
  const directCandidates = [
    path.join(cwd, 'node_modules', 'tsx'),
    path.join(workspaceRootDir, 'node_modules', 'tsx'),
  ];

  for (const candidate of directCandidates) {
    if (existsSync(path.join(candidate, 'package.json'))) {
      return candidate;
    }
  }

  const storeDirs = [
    path.join(workspaceRootDir, 'node_modules', '.pnpm-fresh'),
    path.join(workspaceRootDir, 'node_modules', '.pnpm'),
  ];

  for (const storeDir of storeDirs) {
    if (!existsSync(storeDir)) {
      continue;
    }

    const storeNames = readdirSync(storeDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith('tsx@'))
      .map((entry) => entry.name)
      .sort((left, right) =>
        compareVersionLike(parseTsxStoreVersion(right), parseTsxStoreVersion(left)),
      );

    for (const storeName of storeNames) {
      const candidate = path.join(storeDir, storeName, 'node_modules', 'tsx');
      if (existsSync(path.join(candidate, 'package.json'))) {
        return candidate;
      }
    }
  }

  return null;
}

export function resolveTsxCliEntry({
  cwd = process.cwd(),
  workspaceRootDir = resolveWorkspaceRootDir(),
} = {}) {
  const tsxPackageRoot = resolveInstalledTsxPackageRoot({
    cwd,
    workspaceRootDir,
  });
  if (!tsxPackageRoot) {
    throw new Error(
      `Unable to resolve an installed tsx package from ${cwd}. Run pnpm install before invoking run-local-tsx.`,
    );
  }

  const packageJson = JSON.parse(
    readFileSync(path.join(tsxPackageRoot, 'package.json'), 'utf8'),
  );
  const binField = packageJson?.bin;
  const configuredCliPath =
    typeof binField?.tsx === 'string'
      ? path.join(tsxPackageRoot, binField.tsx)
      : null;
  const fallbackCliPath = path.join(tsxPackageRoot, 'dist', 'cli.mjs');

  if (configuredCliPath && existsSync(configuredCliPath)) {
    return configuredCliPath;
  }
  if (existsSync(fallbackCliPath)) {
    return fallbackCliPath;
  }

  throw new Error(
    `Unable to resolve a runnable tsx CLI from ${path.join(tsxPackageRoot, 'package.json')}.`,
  );
}

export function resolveTsxEsbuildBinaryPath({
  tsxPackageRoot,
  platform = process.platform,
  arch = process.arch,
} = {}) {
  if (!tsxPackageRoot) {
    return null;
  }

  const physicalTsxPackageRoot = realpathSync(tsxPackageRoot);
  const linkedEsbuildPackageRoot = path.join(
    path.dirname(physicalTsxPackageRoot),
    'esbuild',
  );
  if (!existsSync(linkedEsbuildPackageRoot)) {
    return null;
  }
  const esbuildPackageRoot = realpathSync(linkedEsbuildPackageRoot);
  const esbuildPackageJsonPath = path.join(esbuildPackageRoot, 'package.json');
  if (!existsSync(esbuildPackageJsonPath)) {
    return null;
  }

  const esbuildPackageJson = JSON.parse(
    readFileSync(esbuildPackageJsonPath, 'utf8'),
  );
  const platformPackagesDir = path.join(
    path.dirname(esbuildPackageRoot),
    '@esbuild',
  );
  if (!existsSync(platformPackagesDir)) {
    return null;
  }

  const platformPackageNames = readdirSync(platformPackagesDir).sort();
  for (const packageName of platformPackageNames) {
    const platformPackageRoot = path.join(platformPackagesDir, packageName);
    const packageJsonPath = path.join(platformPackageRoot, 'package.json');
    if (!existsSync(packageJsonPath)) {
      continue;
    }

    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    const supportedPlatforms = Array.isArray(packageJson.os) ? packageJson.os : [];
    const supportedArchitectures = Array.isArray(packageJson.cpu)
      ? packageJson.cpu
      : [];
    if (
      packageJson.version !== esbuildPackageJson.version ||
      !supportedPlatforms.includes(platform) ||
      !supportedArchitectures.includes(arch)
    ) {
      continue;
    }

    const binaryCandidates = [
      path.join(platformPackageRoot, 'esbuild.exe'),
      path.join(platformPackageRoot, 'bin', 'esbuild'),
    ];
    return binaryCandidates.find((candidate) => existsSync(candidate)) ?? null;
  }

  return null;
}

export function createLocalTsxPlan({
  argv = process.argv.slice(2),
  cwd = process.cwd(),
} = {}) {
  const workspaceRootDir = resolveWorkspaceRootDir();
  const args = Array.isArray(argv) ? [...argv] : [];
  const testAssetHooksPath = path.join(
    workspaceRootDir,
    'scripts',
    'register-test-asset-hooks.mjs',
  );
  const tsxPackageRoot = resolveInstalledTsxPackageRoot({
    cwd,
    workspaceRootDir,
  });
  const env = createRunnerEnv(testAssetHooksPath, {
    esbuildBinaryPath: resolveTsxEsbuildBinaryPath({ tsxPackageRoot }),
  });
  if (!tsxPackageRoot) {
    return {
      command: process.execPath,
      args: [
        '--experimental-strip-types',
        ...stripTsxOnlyArgs(args),
      ],
      cwd,
      env,
      runner: 'node-strip-types',
    };
  }

  const hasExplicitTsconfig = args.some((arg) => arg === '--tsconfig');
  const runtimeTsconfigArgs = hasExplicitTsconfig
    ? []
    : ['--tsconfig', path.join(workspaceRootDir, 'tsconfig.runtime.json')];

  return {
    command: process.execPath,
    args: [
      resolveTsxCliEntry({ cwd, workspaceRootDir }),
      ...runtimeTsconfigArgs,
      ...args,
    ],
    cwd,
    env,
    runner: 'tsx',
  };
}

function createRunnerEnv(testAssetHooksPath, { esbuildBinaryPath } = {}) {
  const importOption = `--import=${pathToFileURL(testAssetHooksPath).href}`;
  const existingNodeOptions = String(process.env.NODE_OPTIONS ?? '').trim();
  const nodeOptions = existingNodeOptions.includes(importOption)
    ? existingNodeOptions
    : [existingNodeOptions, importOption].filter(Boolean).join(' ');
  const env = {
    ...process.env,
    NODE_OPTIONS: nodeOptions,
  };
  if (!env.ESBUILD_BINARY_PATH && esbuildBinaryPath) {
    env.ESBUILD_BINARY_PATH = esbuildBinaryPath;
  }
  return env;
}

function stripTsxOnlyArgs(argv) {
  const args = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--tsconfig') {
      index += 1;
      continue;
    }
    args.push(token);
  }
  return args;
}

export async function runLocalTsxCli({
  argv = process.argv.slice(2),
} = {}) {
  const plan = createLocalTsxPlan({ argv });
  const child = spawn(plan.command, plan.args, {
    cwd: plan.cwd,
    env: plan.env,
    stdio: 'inherit',
    shell: false,
  });

  child.on('error', (error) => {
    console.error(`[run-local-tsx] ${error.message}`);
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.error(`[run-local-tsx] process exited with signal ${signal}`);
      process.exit(1);
    }
    process.exit(code ?? 0);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runLocalTsxCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
