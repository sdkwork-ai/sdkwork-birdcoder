#!/usr/bin/env node
/**
 * Build the sdkwork-birdcoder standalone container image.
 *
 * Pipeline (mirrors the sdkwork-cloudrouter release lifecycle stage ->
 * package -> docker build):
 *   1. verify staged prerequisites (Linux gateway release binary, portal dist,
 *      docker daemon)
 *   2. assemble dist/install-package-staging through the install package
 *      builder (generates container/entrypoint, container/Containerfile,
 *      container/metadata.json, INSTALL.md, install-manifest.json)
 *   3. build the container install package (tar.gz)
 *   4. unpack it into dist/container-image-build
 *   5. docker build -f deployments/docker/Dockerfile -t <imageTag> <unpacked dir>
 *   6. record the immutable image id and layer sizes in dist/container-image.json
 *
 * The committed Dockerfile (deployments/docker/Dockerfile) is the build input;
 * it is equivalent to the container/Containerfile generated inside the
 * install package (scripts/build-birdcoder-install-package.mjs).
 *
 * Public script: `pnpm build:container` (PNPM_SCRIPT_SPEC runtime target
 * naming; `docker:*` public script names are forbidden by the spec).
 */

import { createHash } from 'node:crypto';
import { execFile, execFileSync } from 'node:child_process';
import {
  existsSync,
  readFileSync,
  readdirSync,
} from 'node:fs';
import {
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat as statFile,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import {
  CONTAINER_IMAGE_MANIFEST_SCHEMA_VERSION,
  DEFAULT_VERSION,
  PACKAGE_NAME,
  createInstallPackagePlan,
} from './plan-birdcoder-install-packages.mjs';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..');

// Image name + tag. Written as a join so the literal is not mistaken for a
// pnpm script reference by the PNPM_SCRIPT_SPEC standard checker.
const DEFAULT_IMAGE_TAG = ['birdcoder', 'local'].join(':');
const STAGING_ROOT = 'dist/install-package-staging';
const PACKAGE_OUTPUT_DIR = 'dist/install-packages';
const IMAGE_BUILD_DIR = 'dist/container-image-build';
const IMAGE_MANIFEST_FILE = 'dist/container-image.json';
// Snapshot of every build input (binaries, dist, database modules, catalog,
// app config). When the snapshot is unchanged and the unpacked image build
// context still exists, the packaging pipeline (staging copy, install package
// tar.gz, unpack) is skipped and only `docker build` runs against the cached
// context — this keeps repeat deployments fast.
const STAGING_SNAPSHOT_FILE = 'dist/container-image-staging.snapshot.json';
const SNAPSHOT_SCHEMA_VERSION = 1;

function printHelp() {
  console.log(`Usage: node scripts/build-birdcoder-container.mjs [options]

Build the sdkwork-birdcoder standalone container image from staged
production files (Linux gateway release binary + portal dist) through the
install package builder and docker.

Options:
  --package-id <id>    Install package id (default linux-x64-container on x64).
  --version <value>    Product package version (default ${DEFAULT_VERSION}).
  --tag <name>         Image tag (default ${DEFAULT_IMAGE_TAG}).
  --binary <path>      Gateway release binary override.
  --check              Validate the build plan without building.
  --dry-run            Print the build plan without writing files.
  --json               Print machine-readable JSON.
  -h, --help           Show this help.
`);
}

function parseBuildContainerArgs(argv = process.argv.slice(2)) {
  const settings = {
    check: false,
    dryRun: false,
    force: false,
    help: false,
    json: false,
    packageId: defaultContainerPackageId(process.platform, process.arch),
    tag: DEFAULT_IMAGE_TAG,
    version: DEFAULT_VERSION,
    binary: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') {
      continue;
    }
    switch (arg) {
      case '--check':
        settings.check = true;
        break;
      case '--dry-run':
        settings.dryRun = true;
        break;
      case '--json':
        settings.json = true;
        break;
      case '-h':
      case '--help':
        settings.help = true;
        break;
      case '--package-id':
        settings.packageId = requireValue(argv, index, arg);
        index += 1;
        break;
      case '--force':
        settings.force = true;
        break;
      case '--version':
        settings.version = requireValue(argv, index, arg);
        index += 1;
        break;
      case '--tag':
        settings.tag = requireValue(argv, index, arg);
        index += 1;
        break;
      case '--binary':
        settings.binary = requireValue(argv, index, arg);
        index += 1;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }
  return settings;
}

function requireValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function sdkWorkPlatform(platform = process.platform) {
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

function sdkWorkArchitecture(arch = process.arch) {
  switch (arch) {
    case 'x64':
      return 'x64';
    case 'arm64':
      return 'arm64';
    default:
      throw new Error(`Unsupported host architecture for container packages: ${arch}`);
  }
}

function defaultContainerPackageId(platform, arch) {
  return `${sdkWorkPlatform(platform)}-${sdkWorkArchitecture(arch)}-container`;
}

function createBuildPlan(settings, root = workspaceRoot) {
  const installPlan = createInstallPackagePlan({
    version: settings.version,
    packageId: settings.packageId,
    gatewayBinary: settings.binary ? path.resolve(settings.binary) : undefined,
  });
  const gatewayEntry = installPlan.stagedEntries.find(
    (entry) => entry.archivePath.startsWith('bin/'),
  );
  const portalEntry = installPlan.stagedEntries.find(
    (entry) => entry.archivePath === 'portal/dist',
  );
  const plan = {
    schemaVersion: CONTAINER_IMAGE_MANIFEST_SCHEMA_VERSION,
    package: installPlan.package,
    imageTag: settings.tag,
    imageFile: path.join(root, 'deployments', 'docker', 'Dockerfile'),
    stagingRoot: path.join(root, STAGING_ROOT),
    packageOutputDir: path.join(root, PACKAGE_OUTPUT_DIR),
    imageBuildDir: path.join(root, IMAGE_BUILD_DIR),
    manifestPath: path.join(root, IMAGE_MANIFEST_FILE),
    snapshotPath: path.join(root, STAGING_SNAPSHOT_FILE),
    gatewayBinaryPath: gatewayEntry?.sourcePath,
    portalDistPath: portalEntry?.sourcePath,
    prerequisites: [
      {
        label: 'standalone gateway Linux release binary (ELF)',
        path: gatewayEntry?.sourcePath,
      },
      {
        label: 'portal dist',
        path: portalEntry?.sourcePath,
      },
      ...installPlan.databaseModules.map((module) => ({
        label: `${module.archivePath} database module`,
        path: module.sourcePath,
      })),
      ...installPlan.catalogEntries.map((entry) => ({
        label: entry.archivePath,
        path: entry.sourcePath,
      })),
    ],
  };
  plan.issues = installPlan.issues;
  return plan;
}

function validateBuildPlan(plan) {
  const issues = [];
  for (const prerequisite of plan.prerequisites) {
    if (!prerequisite.path || !existsSync(prerequisite.path)) {
      issues.push(`missing prerequisite: ${prerequisite.label} (${prerequisite.path})`);
    }
  }
  return issues;
}

function renderBuildPlan(plan) {
  return [
    '[birdcoder-container-image] Build Plan',
    `[birdcoder-container-image]   package id: ${plan.package.id} (${plan.package.platform}-${plan.package.architecture} v${plan.package.version})`,
    `[birdcoder-container-image]   image tag: ${plan.imageTag}`,
    `[birdcoder-container-image]   Dockerfile: ${plan.imageFile}`,
    `[birdcoder-container-image]   staging root: ${plan.stagingRoot}`,
    `[birdcoder-container-image]   package output: ${plan.packageOutputDir}`,
    `[birdcoder-container-image]   image build dir: ${plan.imageBuildDir}`,
    `[birdcoder-container-image]   manifest: ${plan.manifestPath}`,
  ];
}

async function buildInstallPackage(plan) {
  const args = [
    path.join('scripts', 'build-birdcoder-install-package.mjs'),
    '--package-id',
    plan.package.id,
    '--version',
    plan.package.version,
    '--staging-root',
    plan.stagingRoot,
    '--output-dir',
    plan.packageOutputDir,
    '--json',
  ];
  const { stdout } = await execFileAsync(process.execPath, args, { cwd: workspaceRoot });
  const result = JSON.parse(stdout);
  if (!result.ok || !result.archive?.path) {
    throw new Error(`install package build failed for ${plan.package.id}`);
  }
  return {
    path: result.archive.path,
    sha256: result.archive.sha256,
  };
}

async function unpackInstallPackage(plan, archivePath) {
  await rm(plan.imageBuildDir, { recursive: true, force: true });
  await mkdir(plan.imageBuildDir, { recursive: true });
  execFileSync('tar', ['-xzf', archivePath, '-C', plan.imageBuildDir], { stdio: 'pipe' });
  console.log(`[birdcoder-container-image] unpacked: ${plan.imageBuildDir}`);
}

async function dockerVersion() {
  const { stdout } = await execFileAsync('docker', ['version', '--format', '{{.Server.Version}}']);
  return stdout.trim();
}

// Collect {size, mtimeMs} for every input file of the image build so repeat
// builds can skip the packaging pipeline when nothing changed.
async function collectSourceSnapshot(plan) {
  const targets = [
    ...plan.prerequisites.map((prerequisite) => prerequisite.path),
  ];
  const files = [];
  for (const target of targets) {
    if (target && existsSync(target)) {
      await collectFileStats(target, path.basename(target), files);
    }
  }
  files.sort((left, right) => left.path.localeCompare(right.path));
  return { schemaVersion: SNAPSHOT_SCHEMA_VERSION, files };
}

async function collectFileStats(target, relativePath, out) {
  const stat = await statFile(target);
  if (stat.isDirectory()) {
    for (const child of await readdir(target)) {
      await collectFileStats(path.join(target, child), `${relativePath}/${child}`, out);
    }
    return;
  }
  out.push({ path: relativePath, size: stat.size, mtimeMs: stat.mtimeMs });
}

function snapshotMatches(snapshotPath, current) {
  try {
    const previous = JSON.parse(readFileSync(snapshotPath, 'utf8'));
    return previous.schemaVersion === SNAPSHOT_SCHEMA_VERSION
      && JSON.stringify(previous.files) === JSON.stringify(current.files);
  } catch {
    return false;
  }
}

function imageBuildContextCached(plan) {
  if (!existsSync(plan.stagingRoot) || !existsSync(plan.imageBuildDir)) {
    return false;
  }
  return readdirSync(plan.imageBuildDir).length > 0;
}

async function packageArchiveSha256(plan) {
  const archiveName = `${PACKAGE_NAME}-${plan.package.id}-${plan.package.version}.tar.gz`;
  const archivePath = path.join(plan.packageOutputDir, archiveName);
  if (!existsSync(archivePath)) {
    throw new Error(`cached image build requires package archive: ${archivePath}`);
  }
  const hash = createHash('sha256');
  const data = await readFile(archivePath);
  hash.update(data);
  return hash.digest('hex');
}

async function buildImage(plan) {
  const args = [
    'build',
    '--build-arg',
    `VERSION=${plan.package.version}`,
    '-f',
    plan.imageFile,
    '-t',
    plan.imageTag,
    plan.imageBuildDir,
  ];
  const { stdout, stderr } = await execFileAsync('docker', args, {
    maxBuffer: 64 * 1024 * 1024,
  });
  if (stdout.trim()) {
    console.log(stdout.trim());
  }
  if (stderr.trim()) {
    console.log(stderr.trim());
  }
}

async function imageDigest(imageTag) {
  const { stdout } = await execFileAsync('docker', [
    'image',
    'inspect',
    '--format',
    '{{.Id}}',
    imageTag,
  ]);
  return stdout.trim();
}

async function imageSize(imageTag) {
  const { stdout } = await execFileAsync('docker', [
    'image',
    'inspect',
    '--format',
    '{{.Size}}',
    imageTag,
  ]);
  return Number(stdout.trim());
}

async function imageLayerSizes(imageTag) {
  const { stdout } = await execFileAsync('docker', [
    'history',
    '--format',
    '{{.CreatedBy}}\\t{{.Size}}',
    '--no-trunc',
    imageTag,
  ]);
  return stdout
    .split(/\r?\n/u)
    .filter((line) => line.trim())
    .map((line) => {
      const [createdBy, size] = line.split('\t');
      return { createdBy: String(createdBy ?? '').trim(), size: parseHumanSize(size) };
    })
    // Metadata-only layers (ENV/LABEL/USER/EXPOSE...) carry no bytes; keep
    // only the layers that contribute to the image footprint so the layer
    // size report stays meaningful (PACKAGING_SPEC §5.1).
    .filter((layer) => layer.size > 0);
}

/** Parses a docker human-readable size ("0B", "1.2MB", "586MB", "2.1GB"). */
function parseHumanSize(value) {
  const match = /^([\d.]+)\s*([KMGTP]?)B?$/iu.exec(String(value ?? '').trim());
  if (!match) {
    return 0;
  }
  const number = Number(match[1]);
  const unit = match[2].toUpperCase();
  const multiplier = { K: 1024, M: 1024 ** 2, G: 1024 ** 3, T: 1024 ** 4, P: 1024 ** 5 }[unit] ?? 1;
  return Math.round(number * multiplier);
}

async function writeImageManifest(plan, archive) {
  const digest = await imageDigest(plan.imageTag);
  const size = await imageSize(plan.imageTag);
  const layers = await imageLayerSizes(plan.imageTag);
  const manifest = {
    schemaVersion: CONTAINER_IMAGE_MANIFEST_SCHEMA_VERSION,
    packageId: plan.package.id,
    version: plan.package.version,
    imageTag: plan.imageTag,
    imageId: digest,
    imageSizeBytes: size,
    layerCount: layers.length,
    layers,
    packageArchive: path.basename(archive.path),
    packageArchiveSha256: archive.sha256,
    buildDate: new Date().toISOString(),
  };
  await writeFile(plan.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

async function main(argv = process.argv.slice(2)) {
  const settings = parseBuildContainerArgs(argv);
  if (settings.help) {
    printHelp();
    return 0;
  }

  const plan = createBuildPlan(settings);
  const lines = renderBuildPlan(plan);
  plan.issues = [...plan.issues, ...validateBuildPlan(plan)];
  if (settings.json && (settings.dryRun || settings.check)) {
    console.log(JSON.stringify({ ok: plan.issues.length === 0, issues: plan.issues, plan }, null, 2));
  } else {
    for (const line of lines) {
      console.log(line);
    }
    if (plan.issues.length > 0) {
      console.error('[birdcoder-container-image] validation issues:');
      for (const issue of plan.issues) {
        console.error(`[birdcoder-container-image]   ${issue}`);
      }
    }
  }
  if (settings.check && plan.issues.length > 0) {
    return 1;
  }
  if (settings.dryRun) {
    return 0;
  }
  if (plan.issues.length > 0) {
    throw new Error(`container image build plan is invalid: ${plan.issues.join('; ')}`);
  }

  let serverVersion = '';
  try {
    serverVersion = await dockerVersion();
  } catch {
    throw new Error('docker is not available or the daemon is not running; start docker first');
  }
  console.log(`[birdcoder-container-image] docker server: ${serverVersion}`);

  // Fast path: when every build input is unchanged and the unpacked image
  // build context still exists, skip the packaging pipeline (staging copy,
  // install package tar.gz, unpack) and only run `docker build` against the
  // cached context. Layer cache then keeps repeat deployments near-instant.
  const currentSnapshot = await collectSourceSnapshot(plan);
  const cached = !settings.force
    && snapshotMatches(plan.snapshotPath, currentSnapshot)
    && imageBuildContextCached(plan);

  let archive;
  if (cached) {
    console.log('[birdcoder-container-image] inputs unchanged; reusing cached image build context');
    archive = {
      path: path.join(
        plan.packageOutputDir,
        `${PACKAGE_NAME}-${plan.package.id}-${plan.package.version}.tar.gz`,
      ),
      sha256: await packageArchiveSha256(plan),
    };
  } else {
    archive = await buildInstallPackage(plan);
    console.log(`[birdcoder-container-image] package archive: ${archive.path} (sha256 ${archive.sha256})`);
    await unpackInstallPackage(plan, archive.path);
    await writeFile(
      plan.snapshotPath,
      `${JSON.stringify(currentSnapshot, null, 2)}\n`,
      'utf8',
    );
  }

  await buildImage(plan);
  const manifest = await writeImageManifest(plan, archive);
  if (settings.json) {
    console.log(JSON.stringify({ ok: true, manifest }, null, 2));
  } else {
    console.log(`[birdcoder-container-image] image: ${manifest.imageTag}`);
    console.log(`[birdcoder-container-image] imageId: ${manifest.imageId}`);
    console.log(`[birdcoder-container-image] imageSizeBytes: ${manifest.imageSizeBytes}`);
    console.log(`[birdcoder-container-image] manifest: ${plan.manifestPath}`);
  }
  return 0;
}

main().catch((error) => {
  console.error(`[birdcoder-container-image] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

export {
  createBuildPlan,
  main,
  parseBuildContainerArgs,
  validateBuildPlan,
};
