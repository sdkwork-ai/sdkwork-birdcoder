#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { DEFAULT_RELEASE_PROFILE_ID } from './release/release-profiles.mjs';
import { normalizeViteMode } from './run-vite-host.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const desktopPackageDir = path.join(rootDir, 'packages', 'sdkwork-birdcoder-desktop');

function resolveDesktopTauriConfigPath(viteMode = 'production') {
  const normalizedMode = normalizeViteMode(viteMode, 'production');
  if (normalizedMode === 'test') {
    return path.join('packages', 'sdkwork-birdcoder-desktop', 'src-tauri', 'tauri.test.conf.json');
  }

  return path.join('packages', 'sdkwork-birdcoder-desktop', 'src-tauri', 'tauri.conf.json');
}

function normalizeBundleTargets(value) {
  return String(value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function readOptionValue(argv, index, flag) {
  const next = argv[index + 1];
  const normalizedNext = String(next ?? '').trim();

  if (!normalizedNext || normalizedNext.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return normalizedNext;
}

export function parseArgs(argv) {
  const options = {
    profileId: DEFAULT_RELEASE_PROFILE_ID,
    targetTriple: '',
    phase: 'all',
    releaseMode: false,
    platform: process.platform,
    hostArch: process.arch,
    viteMode: 'production',
    bundleTargets: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    switch (token) {
      case '--profile':
        options.profileId = readOptionValue(argv, index, '--profile');
        index += 1;
        break;
      case '--target':
        options.targetTriple = readOptionValue(argv, index, '--target');
        index += 1;
        break;
      case '--phase':
        options.phase = readOptionValue(argv, index, '--phase');
        index += 1;
        break;
      case '--platform':
        options.platform = readOptionValue(argv, index, '--platform');
        index += 1;
        break;
      case '--host-arch':
        options.hostArch = readOptionValue(argv, index, '--host-arch');
        index += 1;
        break;
      case '--vite-mode':
        options.viteMode = readOptionValue(argv, index, '--vite-mode');
        index += 1;
        break;
      case '--bundles':
        options.bundleTargets = normalizeBundleTargets(
          readOptionValue(argv, index, '--bundles'),
        );
        index += 1;
        break;
      case '--release':
        options.releaseMode = true;
        break;
      default:
        throw new Error(`Unknown argument: ${token}`);
    }
  }

  return options;
}

function createNoopPlan(message, env = process.env) {
  return {
    command: process.execPath,
    args: ['-e', `console.log(${JSON.stringify(message)});`],
    cwd: rootDir,
    env: { ...env },
    shell: false,
  };
}

function createDirectTauriBuildPlan({
  env = process.env,
  targetTriple = '',
  viteMode = 'production',
  bundleTargets = [],
} = {}) {
  const args = [
    'scripts/run-tauri-cli.mjs',
    'build',
    '--config',
    path.relative(desktopPackageDir, path.join(rootDir, resolveDesktopTauriConfigPath(viteMode))).replaceAll('\\', '/'),
  ];

  if (String(targetTriple ?? '').trim()) {
    args.push('--target', String(targetTriple).trim());
  }
  if (bundleTargets.length > 0) {
    args.push('--bundles', bundleTargets.join(','));
  }

  args.push('--vite-mode', normalizeViteMode(viteMode, 'production'));

  return {
    command: process.execPath,
    args,
    cwd: desktopPackageDir,
    env: { ...env },
    shell: false,
  };
}

function resolveReleasePhasePlan({
  phase = 'all',
  platform = process.platform,
  env = process.env,
  targetTriple = '',
  viteMode = 'production',
  bundleTargets = [],
} = {}) {
  const normalizedPhase = String(phase ?? 'all').trim().toLowerCase() || 'all';
  const normalizedPlatform = String(platform ?? process.platform).trim().toLowerCase();

  switch (normalizedPhase) {
    case 'sync':
      return {
        command: process.execPath,
        args: ['scripts/prepare-shared-sdk-packages.mjs'],
        cwd: rootDir,
        env: { ...env },
        shell: false,
      };
    case 'prepare-target':
      return createNoopPlan(
        '[run-desktop-release-build] BirdCoder does not require extra Tauri target cache cleanup for release parity.',
        env,
      );
    case 'prepare-openclaw':
      return createNoopPlan(
        '[run-desktop-release-build] BirdCoder keeps the Claw desktop phase contract, but does not bundle the OpenClaw runtime.',
        env,
      );
    case 'bundle':
      if (normalizedPlatform === 'win32' || normalizedPlatform === 'windows') {
        const args = [
          'scripts/run-windows-tauri-bundle.mjs',
          '--config',
          resolveDesktopTauriConfigPath(viteMode).replaceAll('\\', '/'),
          '--vite-mode',
          normalizeViteMode(viteMode, 'production'),
        ];
        if (String(targetTriple ?? '').trim()) {
          args.push('--target', String(targetTriple).trim());
        }
        if (bundleTargets.length > 0) {
          args.push('--bundles', bundleTargets.join(','));
        }
        return {
          command: process.execPath,
          args,
          cwd: rootDir,
          env: { ...env },
          shell: false,
        };
      }

      return createDirectTauriBuildPlan({
        env,
        targetTriple,
        viteMode,
        bundleTargets,
      });
    case 'all':
      return {
        command: '',
        args: [],
        cwd: rootDir,
        env: { ...env },
        phases: ['sync', 'prepare-target', 'prepare-openclaw', 'bundle'],
        shell: false,
      };
    default:
      throw new Error(`Unsupported desktop release phase: ${phase}`);
  }
}

export function createDesktopReleaseBuildPlan({
  profileId = DEFAULT_RELEASE_PROFILE_ID,
  platform = process.platform,
  hostArch = process.arch,
  env = process.env,
  targetTriple = '',
  phase = 'all',
  releaseMode = false,
  viteMode = 'production',
  bundleTargets = [],
} = {}) {
  void profileId;
  void hostArch;
  void releaseMode;

  return resolveReleasePhasePlan({
    phase,
    platform,
    env,
    targetTriple,
    viteMode,
    bundleTargets,
  });
}

export function buildDesktopReleaseBuildPreflightPlan({
  phase = 'all',
} = {}) {
  const normalizedPhase = String(phase ?? 'all').trim().toLowerCase() || 'all';
  if (normalizedPhase !== 'bundle' && normalizedPhase !== 'all') {
    return null;
  }

  return null;
}

function runPlan(plan) {
  const result = spawnSync(plan.command, plan.args, {
    cwd: plan.cwd,
    env: plan.env ?? process.env,
    stdio: 'inherit',
    shell: Boolean(plan.shell),
  });

  if (result.error) {
    throw result.error;
  }
  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runCli() {
  const options = parseArgs(process.argv.slice(2));
  const preflightPlan = buildDesktopReleaseBuildPreflightPlan(options);
  if (preflightPlan) {
    runPlan(preflightPlan);
  }

  const plan = createDesktopReleaseBuildPlan({
    profileId: options.profileId,
    platform: options.platform,
    hostArch: options.hostArch,
    phase: options.phase,
    targetTriple: options.targetTriple,
    releaseMode: options.releaseMode,
    viteMode: options.viteMode,
    bundleTargets: options.bundleTargets,
  });

  if (Array.isArray(plan.phases) && plan.phases.length > 0) {
    for (const phase of plan.phases) {
      runPlan(
        createDesktopReleaseBuildPlan({
          profileId: options.profileId,
          platform: options.platform,
          hostArch: options.hostArch,
          phase,
          targetTriple: options.targetTriple,
          releaseMode: options.releaseMode,
          viteMode: options.viteMode,
          bundleTargets: options.bundleTargets,
        }),
      );
    }
    return;
  }

  runPlan(plan);
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
