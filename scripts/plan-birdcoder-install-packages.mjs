#!/usr/bin/env node
/**
 * sdkwork-birdcoder install package plan.
 *
 * Declarative packaging plan (PACKAGING_SPEC §1): every packaged entry has an
 * archive path, a source path, a mode, and a required flag; anything not
 * listed here is excluded, never included by directory glob default.
 *
 * The plan covers the linux-x64-container install package: gateway binary,
 * portal SPA dist, federated database modules, models catalog, application
 * identity manifest, and generated container artifacts
 * (container/entrypoint, container/Containerfile, container/metadata.json,
 * INSTALL.md, install-manifest.json).
 *
 * Consumed by scripts/build-birdcoder-install-package.mjs (archive builder)
 * and scripts/build-birdcoder-container.mjs (container image build).
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..');

export const PACKAGE_NAME = 'sdkwork-birdcoder';
export const DEFAULT_VERSION = '0.1.0';
export const POSIX_INSTALL_ROOT = '/opt/sdkwork/birdcoder';
export const RUNTIME_DISPLAY_NAME = 'SDKWork BirdCoder';
export const CONTAINER_IMAGE_MANIFEST_SCHEMA_VERSION = '2026-08-08.container-image.v1';
export const INSTALL_MANIFEST_SCHEMA_VERSION = '2026-08-08.install-manifest.v1';

// Edge gateway deployment binary basename inside the package. The cargo
// artifact is sdkwork-api-birdcoder-standalone-gateway; it is staged under the
// historical deployment name (no "api" segment).
export const EDGE_BINARY_BASENAME = 'sdkwork-birdcoder-standalone-gateway';
// Cargo artifact name produced by crates/sdkwork-api-birdcoder-standalone-gateway.
export const CARGO_BINARY_NAME = 'sdkwork-api-birdcoder-standalone-gateway';

// Federated database modules consumed by the gateway at runtime (mirrors
// `cargo tree -p sdkwork-api-birdcoder-standalone-gateway`). Each module ships
// its database/ directory under <install root>/database-modules/<repo>/database,
// and its database host resolves the module through the matching app root env
// (compile-time app roots do not exist inside the image). Note: base-data /
// edu-data / med-data live in the sdkwork-appbase repository; the env value's
// last segment must equal the repo name because hosts resolve packaged
// modules by app root file name.
export const CORE_DATABASE_MODULES = [
  { repo: 'sdkwork-models', envKey: 'SDKWORK_MODELS_APP_ROOT' },
  // The IAM module materialization reads iam/registry/* under the IAM app
  // root, so the iam tree ships alongside the database module.
  { repo: 'sdkwork-iam', envKey: 'SDKWORK_IAM_APP_ROOT', extraPaths: ['iam'] },
  { repo: 'sdkwork-agents', envKey: 'SDKWORK_AGENTS_APP_ROOT' },
  { repo: 'sdkwork-documents', envKey: 'SDKWORK_DOCUMENTS_APP_ROOT' },
  { repo: 'sdkwork-drive', envKey: 'SDKWORK_DRIVE_APP_ROOT' },
  { repo: 'sdkwork-membership', envKey: 'SDKWORK_MEMBERSHIP_APP_ROOT' },
  { repo: 'sdkwork-order', envKey: 'SDKWORK_ORDER_APP_ROOT' },
  { repo: 'sdkwork-prompts', envKey: 'SDKWORK_PROMPTS_APP_ROOT' },
  { repo: 'sdkwork-skills', envKey: 'SDKWORK_SKILLS_APP_ROOT' },
  { repo: 'sdkwork-deployments', envKey: 'SDKWORK_DEPLOY_APP_ROOT' },
  { repo: 'sdkwork-appbase', envKey: 'SDKWORK_APPBASE_APP_ROOT' },
  { repo: 'sdkwork-appbase', envKey: 'SDKWORK_BASE_DATA_APP_ROOT' },
  { repo: 'sdkwork-appbase', envKey: 'SDKWORK_EDU_DATA_APP_ROOT' },
  { repo: 'sdkwork-appbase', envKey: 'SDKWORK_MED_DATA_APP_ROOT' },
];

export function sdkWorkPlatform(platform = process.platform) {
  switch (platform) {
    case 'linux':
      return 'linux';
    case 'win32':
      return 'windows';
    case 'darwin':
      return 'macos';
    default:
      throw new Error(`Unsupported host platform for container packages: ${platform}`);
  }
}

export function sdkWorkArchitecture(arch = process.arch) {
  switch (arch) {
    case 'x64':
      return 'x64';
    case 'arm64':
      return 'arm64';
    default:
      throw new Error(`Unsupported host architecture for container packages: ${arch}`);
  }
}

export function defaultContainerPackageId(platform, arch) {
  return `${sdkWorkPlatform(platform)}-${sdkWorkArchitecture(arch)}-container`;
}

export function exeSuffix(platform) {
  return platform === 'windows' ? '.exe' : '';
}

/**
 * Locates the staged gateway release binary. The container image requires a
 * Linux ELF executable; a Windows host build (`cargo build` on Windows) is
 * rejected by validateInstallPackagePlan. Default search order:
 *   1. --binary / BIRDCODER_GATEWAY_BINARY override
 *   2. <workspace>/target/release/<basename>
 *   3. <WSL build root>/release/<basename> (CARGO_TARGET_DIR convention used
 *      by the WSL release build, e.g. ~/sdkwork-target/birdcoder-release)
 */
export function resolveGatewayBinarySource({
  workspaceRootDir = workspaceRoot,
  explicitBinary = null,
  env = process.env,
} = {}) {
  const suffix = process.platform === 'win32' ? '.exe' : '';
  const cargoName = `${CARGO_BINARY_NAME}${suffix}`;
  const candidates = [];
  if (explicitBinary) {
    candidates.push(explicitBinary);
  }
  const envBinary = String(env.BIRDCODER_GATEWAY_BINARY ?? '').trim();
  if (envBinary) {
    candidates.push(envBinary);
  }
  candidates.push(
    path.join(workspaceRootDir, 'target', 'release', cargoName),
    path.join(process.env.HOME ?? '', 'sdkwork-target', 'birdcoder-release', 'release', cargoName),
    path.join(process.env.HOME ?? '', 'sdkwork-target', 'release', cargoName),
  );
  return candidates.find((candidate) => existsSync(candidate));
}

export function modelsCatalogRepoPath(root = workspaceRoot) {
  return path.join(root, '..', 'sdkwork-models');
}

/**
 * Declarative container install package plan. Every entry is listed with its
 * archive path, source path, mode, and required flag; the archive builder
 * packages exactly this list (PACKAGING_SPEC §1).
 */
export function createInstallPackagePlan({
  workspaceRootDir = workspaceRoot,
  version = DEFAULT_VERSION,
  packageId = defaultContainerPackageId(process.platform, process.arch),
  gatewayBinary = resolveGatewayBinarySource({ workspaceRootDir }),
} = {}) {
  const packageItem = {
    id: packageId,
    version,
    platform: 'linux',
    architecture: 'x64',
    format: 'tar.gz',
    runtimeTarget: 'container',
    deploymentProfile: 'standalone',
    containerIntegration: {
      installRoot: POSIX_INSTALL_ROOT,
      displayName: RUNTIME_DISPLAY_NAME,
      entrypoint: `${POSIX_INSTALL_ROOT}/container/entrypoint`,
      exposedPorts: [10240],
    },
  };

  const plan = {
    schemaVersion: INSTALL_MANIFEST_SCHEMA_VERSION,
    package: packageItem,
    workspaceRoot: workspaceRootDir,
    // Every declarative package entry. Generated artifacts (entrypoint,
    // Containerfile, metadata.json, INSTALL.md) are produced by the builder.
    stagedEntries: [
      {
        archivePath: `bin/${EDGE_BINARY_BASENAME}`,
        sourcePath: gatewayBinary,
        mode: 0o755,
        required: true,
      },
      {
        archivePath: 'portal/dist',
        sourcePath: path.join(workspaceRootDir, 'apps', 'sdkwork-birdcoder-pc', 'packages', 'sdkwork-birdcoder-pc-web', 'dist'),
        mode: 0o644,
        required: true,
      },
      {
        archivePath: 'sdkwork.app.config.json',
        sourcePath: path.join(workspaceRootDir, 'sdkwork.app.config.json'),
        mode: 0o644,
        required: true,
      },
      {
        archivePath: '.env.release.example',
        sourcePath: path.join(workspaceRootDir, 'deployments', 'docker', 'docker', '.env.example'),
        mode: 0o644,
        required: false,
      },
    ],
    // Federated database modules installed under <install root>/database-modules
    // (sdkwork-database-spi packaged module root resolution).
    databaseModules: CORE_DATABASE_MODULES.flatMap((module) => [
      {
        archivePath: `database-modules/${module.repo}/database`,
        sourcePath: path.join(workspaceRootDir, '..', module.repo, 'database'),
        envKey: module.envKey,
        required: true,
      },
      // Extra module trees consumed under the app root (e.g. the IAM module
      // registry at <app root>/iam/registry).
      ...(module.extraPaths ?? []).map((extra) => ({
        archivePath: `database-modules/${module.repo}/${extra}`,
        sourcePath: path.join(workspaceRootDir, '..', module.repo, extra),
        envKey: module.envKey,
        required: true,
      })),
    ]),
    // Models catalog (sdkwork-models.json + models/ + overlays/) installed
    // under <install root>/data/sdkwork-models, the bundled catalog fallback
    // (SDKWORK_MODELS_CATALOG_ROOT).
    catalogEntries: [
      {
        archivePath: 'data/sdkwork-models/sdkwork-models.json',
        sourcePath: path.join(modelsCatalogRepoPath(workspaceRootDir), 'sdkwork-models.json'),
        mode: 0o644,
        required: true,
      },
      {
        archivePath: 'data/sdkwork-models/models',
        sourcePath: path.join(modelsCatalogRepoPath(workspaceRootDir), 'models'),
        mode: 0o644,
        required: true,
      },
      {
        archivePath: 'data/sdkwork-models/overlays',
        sourcePath: path.join(modelsCatalogRepoPath(workspaceRootDir), 'overlays'),
        mode: 0o644,
        required: true,
      },
    ],
  };
  plan.issues = validateInstallPackagePlan(plan);
  return plan;
}

/**
 * Validates the declarative plan: every required entry must exist, every
 * source must stay outside forbidden package content (PACKAGING_SPEC §2), and
 * the staged gateway binary must be a Linux ELF executable (a Windows build
 * cannot run in the container).
 */
export function validateInstallPackagePlan(plan) {
  const issues = [];
  for (const entry of [...plan.stagedEntries, ...plan.databaseModules, ...plan.catalogEntries]) {
    if (!entry.sourcePath) {
      issues.push(`missing source for archive path ${entry.archivePath}`);
      continue;
    }
    if (!existsSync(entry.sourcePath)) {
      if (entry.required) {
        issues.push(`missing required entry: ${entry.archivePath} (${entry.sourcePath})`);
      }
      continue;
    }
    if (isForbiddenPackagingPath(entry.sourcePath)) {
      issues.push(`forbidden package content: ${entry.archivePath} (${entry.sourcePath})`);
    }
  }
  const gatewayEntry = plan.stagedEntries.find(
    (entry) => entry.archivePath === `bin/${EDGE_BINARY_BASENAME}`,
  );
  if (gatewayEntry && existsSync(gatewayEntry.sourcePath)) {
    const magic = readElfMagic(gatewayEntry.sourcePath);
    if (magic !== 'elf') {
      issues.push(
        `staged gateway binary is not a Linux ELF executable: ${gatewayEntry.sourcePath} — `
        + 'build the server binary in a Linux environment (e.g. WSL Ubuntu: '
        + 'cargo build --release -p sdkwork-api-birdcoder-standalone-gateway) before packaging.',
      );
    }
  }
  return issues;
}

function isForbiddenPackagingPath(sourcePath) {
  const normalized = sourcePath.replaceAll('\\', '/');
  return [
    '/node_modules/',
    '/target/',
    '/.git/',
    '/.sdkwork/',
    '/dist/install-package-staging/',
  ].some((forbidden) => normalized.includes(forbidden));
}

function readElfMagic(filePath) {
  try {
    const buffer = readFileSync(filePath);
    if (buffer.length >= 4 && buffer[0] === 0x7f && buffer[1] === 0x45
      && buffer[2] === 0x4c && buffer[3] === 0x46) {
      return 'elf';
    }
    if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) {
      return 'pe';
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

export function renderInstallPackagePlan(plan) {
  return [
    '[birdcoder-install-package] Install Package Plan',
    `[birdcoder-install-package]   package id: ${plan.package.id} (${plan.package.platform}-${plan.package.architecture} v${plan.package.version})`,
    `[birdcoder-install-package]   runtime target: ${plan.package.runtimeTarget} / ${plan.package.deploymentProfile}`,
    `[birdcoder-install-package]   install root: ${plan.package.containerIntegration.installRoot}`,
    '[birdcoder-install-package]   staged entries:',
    ...plan.stagedEntries.map((entry) => `[birdcoder-install-package]     ${entry.archivePath} <- ${entry.sourcePath}`),
    '[birdcoder-install-package]   database modules:',
    ...plan.databaseModules.map((module) => `[birdcoder-install-package]     ${module.archivePath} (${module.envKey})`),
    '[birdcoder-install-package]   catalog entries:',
    ...plan.catalogEntries.map((entry) => `[birdcoder-install-package]     ${entry.archivePath}`),
  ];
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll('\\', '/'))) {
  const plan = createInstallPackagePlan();
  for (const line of renderInstallPackagePlan(plan)) {
    console.log(line);
  }
  if (plan.issues.length > 0) {
    console.error('[birdcoder-install-package] plan issues:');
    for (const issue of plan.issues) {
      console.error(`[birdcoder-install-package]   ${issue}`);
    }
    process.exitCode = 1;
  }
}
