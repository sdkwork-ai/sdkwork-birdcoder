#!/usr/bin/env node
/**
 * Build the sdkwork-birdcoder install package archive (tar.gz) from the
 * declarative install package plan (scripts/plan-birdcoder-install-packages.mjs).
 *
 * The container package contains exactly the plan entries plus generated
 * artifacts: container/entrypoint, container/Containerfile,
 * container/metadata.json, INSTALL.md, install-manifest.json. Every packaged
 * file is recorded in install-manifest.json with path, size, and sha256
 * (PACKAGING_SPEC §3/§6).
 *
 * Public script: `pnpm install:package:build` / `pnpm install:package:check`.
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { cpSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_VERSION,
  EDGE_BINARY_BASENAME,
  INSTALL_MANIFEST_SCHEMA_VERSION,
  PACKAGE_NAME,
  POSIX_INSTALL_ROOT,
  createInstallPackagePlan,
  renderInstallPackagePlan,
  validateInstallPackagePlan,
} from './plan-birdcoder-install-packages.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..');

const DEFAULT_OUTPUT_DIR = path.join(workspaceRoot, 'dist', 'install-packages');
const DEFAULT_STAGING_ROOT = path.join(workspaceRoot, 'dist', 'install-package-staging');

function printHelp() {
  console.log(`Usage: node scripts/build-birdcoder-install-package.mjs [options]

Build one manifest-backed install package archive from staged production files.

Options:
  --package-id <id>    Package id from install package plan.
  --staging-root <dir> Directory containing staged package files.
  --output-dir <dir>   Output directory (default ${DEFAULT_OUTPUT_DIR}).
  --version <value>    Product package version (default ${DEFAULT_VERSION}).
  --binary <path>      Gateway release binary override.
  --check              Validate the package build plan without building.
  --dry-run            Print the package build plan without writing archives.
  --json               Print machine-readable JSON.
  -h, --help           Show this help.
`);
}

function parseArgs(argv = process.argv.slice(2)) {
  const settings = {
    check: false,
    dryRun: false,
    help: false,
    json: false,
    outputDir: null,
    packageId: null,
    stagingRoot: null,
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
      case '--staging-root':
        settings.stagingRoot = requireValue(argv, index, arg);
        index += 1;
        break;
      case '--output-dir':
        settings.outputDir = requireValue(argv, index, arg);
        index += 1;
        break;
      case '--version':
        settings.version = requireValue(argv, index, arg);
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

function collectFiles(rootDir, baseDir = rootDir) {
  const files = [];
  for (const name of readdirSync(rootDir)) {
    const fullPath = path.join(rootDir, name);
    const stat = statSync(fullPath);
    const relativePath = path.relative(baseDir, fullPath).replaceAll('\\', '/');
    if (stat.isDirectory()) {
      files.push(...collectFiles(fullPath, baseDir));
    } else {
      files.push({ path: fullPath, archivePath: relativePath, size: stat.size, mode: stat.mode });
    }
  }
  return files;
}

function sha256File(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function renderContainerEntrypoint() {
  return `#!/bin/sh
set -eu
# sdkwork-birdcoder standalone container entrypoint.
# runtimeTarget = "container", deploymentProfile = "standalone".
# The compose file injects the deployment identity; these defaults keep a
# bare \`docker run\` reproducible.
export SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE="\${SDKWORK_BIRDCODER_DEPLOYMENT_PROFILE:-standalone}"
export SDKWORK_BIRDCODER_RUNTIME_TARGET="\${SDKWORK_BIRDCODER_RUNTIME_TARGET:-container}"
export SDKWORK_BIRDCODER_ENVIRONMENT="\${SDKWORK_BIRDCODER_ENVIRONMENT:-development}"
exec "${POSIX_INSTALL_ROOT}/bin/${EDGE_BINARY_BASENAME}" "\$@"
`;
}

function renderContainerfile(installRoot = POSIX_INSTALL_ROOT) {
  return `# sdkwork-birdcoder standalone container image (generated; the committed
# deployments/docker/Dockerfile is the build input and must stay equivalent).
# runtimeTarget = "container", deploymentProfile = "standalone".
FROM debian:bookworm-slim

ARG GATEWAY_BINARY=${EDGE_BINARY_BASENAME}
ARG INSTALL_ROOT=${installRoot}

RUN apt-get update \\
  && apt-get install -y --no-install-recommends libssl3 ca-certificates curl git \\
  && rm -rf /var/lib/apt/lists/* \\
  && groupadd --system sdkwork \\
  && useradd --system --gid sdkwork --home-dir \${INSTALL_ROOT} sdkwork \\
  && mkdir -p \${INSTALL_ROOT} /etc/sdkwork/birdcoder /run/sdkwork/birdcoder \\
    /var/lib/sdkwork/birdcoder /var/cache/sdkwork/birdcoder /var/log/sdkwork/birdcoder \\
  && chown -R sdkwork:sdkwork /etc/sdkwork/birdcoder /run/sdkwork/birdcoder \\
    /var/lib/sdkwork/birdcoder /var/cache/sdkwork/birdcoder /var/log/sdkwork/birdcoder

WORKDIR \${INSTALL_ROOT}
COPY . \${INSTALL_ROOT}
RUN chmod 0755 \${INSTALL_ROOT}/bin/\${GATEWAY_BINARY} \${INSTALL_ROOT}/container/entrypoint

ENV SDKWORK_APP_ROOT=\${INSTALL_ROOT} \\
    SDKWORK_BIRDCODER_APP_ROOT=\${INSTALL_ROOT} \\
    SDKWORK_MODELS_CATALOG_ROOT=\${INSTALL_ROOT}/data/sdkwork-models \\
    SDKWORK_MODELS_APP_ROOT=\${INSTALL_ROOT}/database-modules/sdkwork-models \\
    SDKWORK_IAM_APP_ROOT=\${INSTALL_ROOT}/database-modules/sdkwork-iam \\
    SDKWORK_AGENTS_APP_ROOT=\${INSTALL_ROOT}/database-modules/sdkwork-agents \\
    SDKWORK_DOCUMENTS_APP_ROOT=\${INSTALL_ROOT}/database-modules/sdkwork-documents \\
    SDKWORK_DRIVE_APP_ROOT=\${INSTALL_ROOT}/database-modules/sdkwork-drive \\
    SDKWORK_MEMBERSHIP_APP_ROOT=\${INSTALL_ROOT}/database-modules/sdkwork-membership \\
    SDKWORK_ORDER_APP_ROOT=\${INSTALL_ROOT}/database-modules/sdkwork-order \\
    SDKWORK_PROMPTS_APP_ROOT=\${INSTALL_ROOT}/database-modules/sdkwork-prompts \\
    SDKWORK_SKILLS_APP_ROOT=\${INSTALL_ROOT}/database-modules/sdkwork-skills \\
    SDKWORK_DEPLOY_APP_ROOT=\${INSTALL_ROOT}/database-modules/sdkwork-deployments \\
    SDKWORK_APPBASE_APP_ROOT=\${INSTALL_ROOT}/database-modules/sdkwork-appbase \\
    SDKWORK_BASE_DATA_APP_ROOT=\${INSTALL_ROOT}/database-modules/sdkwork-appbase \\
    SDKWORK_EDU_DATA_APP_ROOT=\${INSTALL_ROOT}/database-modules/sdkwork-appbase \\
    SDKWORK_MED_DATA_APP_ROOT=\${INSTALL_ROOT}/database-modules/sdkwork-appbase

USER sdkwork
EXPOSE 10240
ENTRYPOINT ["${installRoot}/container/entrypoint"]
`;
}

function renderInstallReadme(packageItem, installRoot = POSIX_INSTALL_ROOT) {
  return `# ${PACKAGE_NAME} ${packageItem.version} container install package

- Package id: ${packageItem.id}
- Platform / architecture: ${packageItem.platform}-${packageItem.architecture}
- Runtime target / deployment profile: ${packageItem.runtimeTarget} / ${packageItem.deploymentProfile}
- Install root: ${installRoot}

## Layout

- \`bin/\` — gateway executable
- \`portal/dist\` — portal SPA dist (served by the deployment nginx)
- \`database-modules/\` — federated database modules resolved by app-root envs
- \`data/sdkwork-models/\` — bundled models catalog
- \`sdkwork.app.config.json\` — application identity manifest
- \`container/entrypoint\` — container entrypoint script
- \`container/Containerfile\` — equivalent container file (committed Dockerfile is canonical)
- \`install-manifest.json\` — per-file content manifest (path, size, sha256)

## Container build

    docker build -f container/Containerfile -t ${PACKAGE_NAME}:local .

or use the packaging pipeline:

    pnpm build:container
`;
}

function createStaging(plan, stagingRoot) {
  rmSync(stagingRoot, { recursive: true, force: true });
  mkdirSync(stagingRoot, { recursive: true });
  for (const entry of plan.stagedEntries) {
    if (!existsSync(entry.sourcePath)) {
      continue;
    }
    const target = path.join(stagingRoot, entry.archivePath);
    mkdirSync(path.dirname(target), { recursive: true });
    cpSync(entry.sourcePath, target, { recursive: true, preserveTimestamps: true });
  }
  for (const module of plan.databaseModules) {
    const target = path.join(stagingRoot, module.archivePath);
    mkdirSync(path.dirname(target), { recursive: true });
    cpSync(module.sourcePath, target, { recursive: true, preserveTimestamps: true });
  }
  for (const entry of plan.catalogEntries) {
    const target = path.join(stagingRoot, entry.archivePath);
    mkdirSync(path.dirname(target), { recursive: true });
    cpSync(entry.sourcePath, target, { recursive: true, preserveTimestamps: true });
  }
  return stagingRoot;
}

function addGeneratedArtifacts(plan, stagingRoot) {
  const containerDir = path.join(stagingRoot, 'container');
  mkdirSync(containerDir, { recursive: true });
  writeFileSync(
    path.join(containerDir, 'entrypoint'),
    renderContainerEntrypoint(),
    { mode: 0o755 },
  );
  writeFileSync(path.join(containerDir, 'Containerfile'), renderContainerfile(), 'utf8');
  const metadata = {
    schemaVersion: '2026-08-08.container-package.v1',
    packageId: plan.package.id,
    version: plan.package.version,
    platform: plan.package.platform,
    architecture: plan.package.architecture,
    entrypoint: `${POSIX_INSTALL_ROOT}/bin/${EDGE_BINARY_BASENAME}`,
    entrypointScript: `${POSIX_INSTALL_ROOT}/container/entrypoint`,
    workingDirectory: POSIX_INSTALL_ROOT,
    runtimeUser: 'sdkwork',
    exposedPorts: plan.package.containerIntegration.exposedPorts,
    configFormat: 'env',
    appRoot: POSIX_INSTALL_ROOT,
    databaseModules: plan.databaseModules.map((module) => ({
      repo: module.archivePath.split('/')[1],
      envKey: module.envKey,
      archivePath: module.archivePath,
    })),
  };
  writeFileSync(path.join(containerDir, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
  writeFileSync(path.join(stagingRoot, 'INSTALL.md'), renderInstallReadme(plan.package), 'utf8');
}

function writeInstallManifest(plan, stagingRoot) {
  const files = collectFiles(stagingRoot).map((file) => ({
    path: file.archivePath,
    size: file.size,
    sha256: sha256File(file.path),
    mode: file.mode,
  }));
  files.sort((left, right) => left.path.localeCompare(right.path));
  const manifest = {
    schemaVersion: INSTALL_MANIFEST_SCHEMA_VERSION,
    package: plan.package,
    installRoot: POSIX_INSTALL_ROOT,
    fileCount: files.length,
    files,
  };
  writeFileSync(
    path.join(stagingRoot, 'install-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
  return manifest;
}

function buildTarGz(stagingRoot, outputDir, archiveName) {
  mkdirSync(outputDir, { recursive: true });
  const archivePath = path.join(outputDir, archiveName);
  rmSync(archivePath, { force: true });
  execFileSync('tar', ['-czf', archivePath, '-C', stagingRoot, '.'], { stdio: 'pipe' });
  return {
    file: archiveName,
    path: archivePath,
    sha256: sha256File(archivePath),
    bytes: statSync(archivePath).size,
  };
}

async function main(argv = process.argv.slice(2)) {
  const settings = parseArgs(argv);
  if (settings.help) {
    printHelp();
    return 0;
  }

  const plan = createInstallPackagePlan({
    version: settings.version,
    packageId: settings.packageId ?? undefined,
    gatewayBinary: settings.binary ? path.resolve(settings.binary) : undefined,
  });
  const lines = renderInstallPackagePlan(plan);
  if (settings.json && (settings.dryRun || settings.check)) {
    console.log(JSON.stringify({ ok: plan.issues.length === 0, issues: plan.issues, plan }, null, 2));
  } else if (!settings.json) {
    for (const line of lines) {
      console.log(line);
    }
    if (plan.issues.length > 0) {
      console.error('[birdcoder-install-package] validation issues:');
      for (const issue of plan.issues) {
        console.error(`[birdcoder-install-package]   ${issue}`);
      }
    }
  }
  if (settings.check && plan.issues.length > 0) {
    return 1;
  }
  if (settings.dryRun) {
    return plan.issues.length > 0 ? 1 : 0;
  }
  if (plan.issues.length > 0) {
    throw new Error(`install package plan is invalid: ${plan.issues.join('; ')}`);
  }

  const stagingRoot = settings.stagingRoot ?? DEFAULT_STAGING_ROOT;
  createStaging(plan, stagingRoot);
  addGeneratedArtifacts(plan, stagingRoot);
  const manifest = writeInstallManifest(plan, stagingRoot);
  if (!settings.json) {
    console.log(`[birdcoder-install-package] staged ${manifest.fileCount} files at ${stagingRoot}`);
  }

  const outputDir = settings.outputDir ?? DEFAULT_OUTPUT_DIR;
  const archiveName = `${PACKAGE_NAME}-${plan.package.id}-${plan.package.version}.tar.gz`;
  const archive = buildTarGz(stagingRoot, outputDir, archiveName);
  if (!settings.json) {
    console.log(`[birdcoder-install-package] archive: ${archive.path} (${archive.bytes} bytes, sha256 ${archive.sha256})`);
  }
  if (settings.json) {
    console.log(JSON.stringify({ ok: true, archive, manifest }, null, 2));
  }
  return 0;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll('\\', '/'))) {
  main().catch((error) => {
    console.error(`[birdcoder-install-package] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}

export {
  addGeneratedArtifacts,
  createStaging,
  main,
  parseArgs,
  renderContainerEntrypoint,
  renderContainerfile,
  renderInstallReadme,
  writeInstallManifest,
};
