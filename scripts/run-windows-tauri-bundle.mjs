#!/usr/bin/env node

import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { normalizeViteMode } from './run-vite-host.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const desktopPackageDir = path.join(rootDir, 'packages', 'sdkwork-birdcoder-desktop');
const defaultConfigPath = path.join(
  'packages',
  'sdkwork-birdcoder-desktop',
  'src-tauri',
  'tauri.conf.json',
);

function readOptionValue(argv, index, flag) {
  const next = argv[index + 1];
  const normalizedNext = String(next ?? '').trim();

  if (!normalizedNext || normalizedNext.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return normalizedNext;
}

function normalizeBundleTargets(bundleTargets) {
  return Array.isArray(bundleTargets)
    ? bundleTargets
      .map((entry) => String(entry ?? '').trim().toLowerCase())
      .filter(Boolean)
    : [];
}

function normalizeConfiguredBundleTargets(configuredTargets) {
  if (typeof configuredTargets === 'string') {
    return [configuredTargets.trim().toLowerCase()].filter(Boolean);
  }
  if (Array.isArray(configuredTargets)) {
    return configuredTargets
      .map((entry) => String(entry ?? '').trim().toLowerCase())
      .filter(Boolean);
  }

  return [];
}

function resolveAbsoluteConfigPath(configPath = defaultConfigPath) {
  return path.isAbsolute(configPath)
    ? configPath
    : path.join(rootDir, configPath);
}

function resolveDesktopConfig(configPath = defaultConfigPath) {
  return JSON.parse(readFileSync(resolveAbsoluteConfigPath(configPath), 'utf8'));
}

function resolveWindowsArchDir(targetTriple = '') {
  const normalizedTargetTriple = String(targetTriple ?? '').trim().toLowerCase();
  if (normalizedTargetTriple.includes('aarch64') || normalizedTargetTriple.includes('arm64')) {
    return 'arm64';
  }

  return 'x64';
}

function resolveWindowsReleaseRoot(targetTriple = '') {
  const normalizedTargetTriple = String(targetTriple ?? '').trim();
  if (normalizedTargetTriple) {
    return path.join(
      desktopPackageDir,
      'src-tauri',
      'target',
      normalizedTargetTriple,
      'release',
    );
  }

  return path.join(desktopPackageDir, 'src-tauri', 'target', 'release');
}

function resolveWixLanguage(wixLanguageConfig) {
  if (typeof wixLanguageConfig === 'string' && wixLanguageConfig.trim()) {
    return wixLanguageConfig.trim();
  }
  if (Array.isArray(wixLanguageConfig)) {
    const firstLanguage = wixLanguageConfig
      .map((entry) => String(entry ?? '').trim())
      .find(Boolean);
    if (firstLanguage) {
      return firstLanguage;
    }
  }
  if (wixLanguageConfig && typeof wixLanguageConfig === 'object') {
    const firstLanguage = Object.keys(wixLanguageConfig).find(Boolean);
    if (firstLanguage) {
      return firstLanguage;
    }
  }

  return 'en-US';
}

function shouldAttemptMsiRecovery({
  configPath = defaultConfigPath,
  bundleTargets = [],
} = {}) {
  const normalizedBundleTargets = normalizeBundleTargets(bundleTargets);
  if (normalizedBundleTargets.length > 0) {
    return normalizedBundleTargets.includes('msi') || normalizedBundleTargets.includes('all');
  }

  const desktopConfig = resolveDesktopConfig(configPath);
  const configuredTargets = normalizeConfiguredBundleTargets(desktopConfig?.bundle?.targets);
  return configuredTargets.length === 0
    || configuredTargets.includes('msi')
    || configuredTargets.includes('all');
}

export function resolveWixToolPath({
  env = process.env,
  pathExists = existsSync,
} = {}) {
  const localAppData = String(env.LOCALAPPDATA ?? '').trim();
  const candidates = [
    path.join(localAppData, 'tauri', 'WixTools314', 'light.exe'),
    path.join(rootDir, 'target', '.tauri', 'WixTools314', 'light.exe'),
    path.join(desktopPackageDir, 'src-tauri', 'target', '.tauri', 'WixTools314', 'light.exe'),
  ].filter(Boolean);

  return candidates.find((candidatePath) => pathExists(candidatePath)) ?? '';
}

export function parseArgs(argv) {
  const options = {
    configPath: defaultConfigPath,
    targetTriple: '',
    viteMode: 'production',
    bundleTargets: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--config') {
      options.configPath = readOptionValue(argv, index, '--config');
      index += 1;
      continue;
    }

    if (token === '--target') {
      options.targetTriple = readOptionValue(argv, index, '--target');
      index += 1;
      continue;
    }

    if (token === '--vite-mode') {
      options.viteMode = readOptionValue(argv, index, '--vite-mode');
      index += 1;
      continue;
    }

    if (token === '--bundles') {
      options.bundleTargets = readOptionValue(argv, index, '--bundles')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  return options;
}

export function createWindowsTauriBundlePlan({
  configPath = defaultConfigPath,
  targetTriple = '',
  viteMode = 'production',
  bundleTargets = [],
} = {}) {
  const absoluteConfigPath = resolveAbsoluteConfigPath(configPath);
  const relativeConfigPath = path.relative(desktopPackageDir, absoluteConfigPath).replaceAll('\\', '/');
  const args = [
    path.join(rootDir, 'scripts', 'run-tauri-cli.mjs'),
    'build',
    '--config',
    relativeConfigPath,
  ];

  const normalizedTargetTriple = String(targetTriple ?? '').trim();
  if (normalizedTargetTriple) {
    args.push('--target', normalizedTargetTriple);
  }

  const normalizedMode = normalizeViteMode(viteMode, 'production');
  args.push('--vite-mode', normalizedMode);

  const normalizedBundleTargets = normalizeBundleTargets(bundleTargets);
  if (normalizedBundleTargets.length > 0) {
    args.push('--bundles', normalizedBundleTargets.join(','));
  }

  return {
    command: process.execPath,
    args,
    cwd: desktopPackageDir,
    env: { ...process.env },
    shell: false,
  };
}

export function createWixValidationRecoveryPlan({
  configPath = defaultConfigPath,
  targetTriple = '',
  wixToolPath = '',
} = {}) {
  const resolvedWixToolPath = String(wixToolPath ?? '').trim() || resolveWixToolPath();
  if (!resolvedWixToolPath) {
    throw new Error('Unable to resolve light.exe for WiX MSI recovery.');
  }

  const desktopConfig = resolveDesktopConfig(configPath);
  const archDir = resolveWindowsArchDir(targetTriple);
  const releaseRoot = resolveWindowsReleaseRoot(targetTriple);
  const wixRoot = path.join(releaseRoot, 'wix', archDir);
  const language = resolveWixLanguage(desktopConfig?.bundle?.windows?.wix?.language);
  const lowerCaseLanguage = language.toLowerCase();
  const outputFileName = `${desktopConfig.productName}_${desktopConfig.version}_${archDir}_${language}.msi`;

  return {
    command: resolvedWixToolPath,
    args: [
      '-sval',
      '-out',
      path.join(releaseRoot, 'bundle', 'msi', outputFileName),
      '-pdbout',
      path.join(wixRoot, `${path.parse(outputFileName).name}.wixpdb`),
      '-ext',
      'WixUIExtension',
      `-cultures:${lowerCaseLanguage}`,
      '-loc',
      path.join(wixRoot, 'locale.wxl'),
      path.join(wixRoot, 'main.wixobj'),
    ],
    cwd: rootDir,
    env: { ...process.env },
    shell: false,
  };
}

function canRecoverWixValidationFailure({
  configPath = defaultConfigPath,
  targetTriple = '',
  bundleTargets = [],
} = {}) {
  if (!shouldAttemptMsiRecovery({ configPath, bundleTargets })) {
    return false;
  }

  const wixToolPath = resolveWixToolPath();
  if (!wixToolPath) {
    return false;
  }

  const releaseRoot = resolveWindowsReleaseRoot(targetTriple);
  const archDir = resolveWindowsArchDir(targetTriple);
  const wixRoot = path.join(releaseRoot, 'wix', archDir);

  return (
    existsSync(path.join(wixRoot, 'main.wixobj'))
    && existsSync(path.join(wixRoot, 'locale.wxl'))
  );
}

function runPlan(plan) {
  return spawnSync(plan.command, plan.args, {
    cwd: plan.cwd,
    env: plan.env ?? process.env,
    stdio: 'inherit',
    shell: Boolean(plan.shell),
  });
}

function removeExistingWixRecoveryOutputs(recoveryPlan) {
  const outIndex = recoveryPlan.args.indexOf('-out');
  const pdbOutIndex = recoveryPlan.args.indexOf('-pdbout');
  const outputPath = outIndex >= 0 ? recoveryPlan.args[outIndex + 1] : '';
  const pdbOutputPath = pdbOutIndex >= 0 ? recoveryPlan.args[pdbOutIndex + 1] : '';

  if (outputPath) {
    rmSync(outputPath, { force: true });
  }
  if (pdbOutputPath) {
    rmSync(pdbOutputPath, { force: true });
  }
}

function retryWixBundleWithSuppressedValidation(options) {
  if (!canRecoverWixValidationFailure(options)) {
    return false;
  }

  const recoveryPlan = createWixValidationRecoveryPlan(options);
  removeExistingWixRecoveryOutputs(recoveryPlan);
  const recoveryResult = runPlan(recoveryPlan);
  return !recoveryResult.error && !recoveryResult.signal && recoveryResult.status === 0;
}

async function main() {
  if (process.platform !== 'win32') {
    throw new Error('run-windows-tauri-bundle.mjs only supports Windows hosts');
  }

  const options = parseArgs(process.argv.slice(2));
  const buildPlan = createWindowsTauriBundlePlan(options);
  const buildResult = runPlan(buildPlan);

  if (!buildResult.error && !buildResult.signal && buildResult.status === 0) {
    process.exit(0);
  }

  if (retryWixBundleWithSuppressedValidation(options)) {
    console.warn(
      '[run-windows-tauri-bundle] recovered the MSI bundle by retrying light.exe with -sval after WiX ICE validation failed on this Windows host.',
    );
    process.exit(0);
  }

  if (buildResult.error) {
    throw buildResult.error;
  }
  if (buildResult.signal) {
    console.error(
      `[run-windows-tauri-bundle] tauri build exited with signal ${buildResult.signal}`,
    );
    process.exit(1);
  }

  process.exit(buildResult.status ?? 1);
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
