#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { DEFAULT_RELEASE_PROFILE_ID } from './release-profiles.mjs';

const RELEASE_ASSETS_DIR = 'artifacts/release';
const SIGNATURE_EVIDENCE_DIR = 'artifacts/release/signatures';
const SBOM_EVIDENCE_DIR = 'artifacts/release/sbom';
const AGGREGATE_RELEASE_ASSETS_DIR = 'release-assets';
const DEFAULT_RELEASE_KIND = 'formal';
const DEFAULT_ROLLOUT_STAGE = 'general-availability';
const DEFAULT_IMAGE_REPOSITORY = 'ghcr.io/sdkwork-cloud/sdkwork-birdcoder-server';

const TARGETS = Object.freeze({
  'windows-x64-standalone-desktop-exe': Object.freeze({
    family: 'desktop',
    platform: 'windows',
    arch: 'x64',
    target: 'x86_64-pc-windows-msvc',
    bundle: 'nsis',
  }),
  'windows-x64-standalone-desktop-msi': Object.freeze({
    family: 'desktop',
    platform: 'windows',
    arch: 'x64',
    target: 'x86_64-pc-windows-msvc',
    bundle: 'msi',
  }),
  'windows-arm64-standalone-desktop-exe': Object.freeze({
    family: 'desktop',
    platform: 'windows',
    arch: 'arm64',
    target: 'aarch64-pc-windows-msvc',
    bundle: 'nsis',
  }),
  'linux-debian-x64-standalone-desktop-deb': Object.freeze({
    family: 'desktop',
    platform: 'linux',
    arch: 'x64',
    target: 'x86_64-unknown-linux-gnu',
    bundle: 'deb',
  }),
  'linux-rhel-x64-standalone-desktop-rpm': Object.freeze({
    family: 'desktop',
    platform: 'linux',
    arch: 'x64',
    target: 'x86_64-unknown-linux-gnu',
    bundle: 'rpm',
  }),
  'linux-x64-standalone-desktop-appimage': Object.freeze({
    family: 'desktop',
    platform: 'linux',
    arch: 'x64',
    target: 'x86_64-unknown-linux-gnu',
    bundle: 'appimage',
  }),
  'linux-debian-arm64-standalone-desktop-deb': Object.freeze({
    family: 'desktop',
    platform: 'linux',
    arch: 'arm64',
    target: 'aarch64-unknown-linux-gnu',
    bundle: 'deb',
  }),
  'linux-arm64-standalone-desktop-appimage': Object.freeze({
    family: 'desktop',
    platform: 'linux',
    arch: 'arm64',
    target: 'aarch64-unknown-linux-gnu',
    bundle: 'appimage',
  }),
  'macos-x64-standalone-desktop-tar-gz': Object.freeze({
    family: 'desktop',
    platform: 'macos',
    arch: 'x64',
    target: 'x86_64-apple-darwin',
    bundle: 'app',
  }),
  'macos-x64-standalone-desktop-dmg': Object.freeze({
    family: 'desktop',
    platform: 'macos',
    arch: 'x64',
    target: 'x86_64-apple-darwin',
    bundle: 'dmg',
  }),
  'macos-arm64-standalone-desktop-tar-gz': Object.freeze({
    family: 'desktop',
    platform: 'macos',
    arch: 'arm64',
    target: 'aarch64-apple-darwin',
    bundle: 'app',
  }),
  'macos-arm64-standalone-desktop-dmg': Object.freeze({
    family: 'desktop',
    platform: 'macos',
    arch: 'arm64',
    target: 'aarch64-apple-darwin',
    bundle: 'dmg',
  }),
  'windows-x64-standalone-server-tar-gz': Object.freeze({
    family: 'server',
    platform: 'windows',
    arch: 'x64',
    target: 'x86_64-pc-windows-msvc',
  }),
  'windows-arm64-standalone-server-tar-gz': Object.freeze({
    family: 'server',
    platform: 'windows',
    arch: 'arm64',
    target: 'aarch64-pc-windows-msvc',
  }),
  'linux-x64-standalone-server-tar-gz': Object.freeze({
    family: 'server',
    platform: 'linux',
    arch: 'x64',
    target: 'x86_64-unknown-linux-gnu',
  }),
  'linux-arm64-standalone-server-tar-gz': Object.freeze({
    family: 'server',
    platform: 'linux',
    arch: 'arm64',
    target: 'aarch64-unknown-linux-gnu',
  }),
  'macos-x64-standalone-server-tar-gz': Object.freeze({
    family: 'server',
    platform: 'macos',
    arch: 'x64',
    target: 'x86_64-apple-darwin',
  }),
  'macos-arm64-standalone-server-tar-gz': Object.freeze({
    family: 'server',
    platform: 'macos',
    arch: 'arm64',
    target: 'aarch64-apple-darwin',
  }),
  'web-universal-cloud-browser-tar-gz': Object.freeze({
    family: 'web',
    platform: '',
    arch: '',
    target: '',
  }),
  'container-x64-cloud-container-cpu-tar-gz': Object.freeze({
    family: 'container',
    platform: 'linux',
    arch: 'x64',
    target: 'x86_64-unknown-linux-gnu',
    accelerator: 'cpu',
  }),
  'container-x64-cloud-container-nvidia-cuda-tar-gz': Object.freeze({
    family: 'container',
    platform: 'linux',
    arch: 'x64',
    target: 'x86_64-unknown-linux-gnu',
    accelerator: 'nvidia-cuda',
  }),
  'container-x64-cloud-container-amd-rocm-tar-gz': Object.freeze({
    family: 'container',
    platform: 'linux',
    arch: 'x64',
    target: 'x86_64-unknown-linux-gnu',
    accelerator: 'amd-rocm',
  }),
  'container-arm64-cloud-container-cpu-tar-gz': Object.freeze({
    family: 'container',
    platform: 'linux',
    arch: 'arm64',
    target: 'aarch64-unknown-linux-gnu',
    accelerator: 'cpu',
  }),
  'container-x64-cloud-container-cpu-helm': Object.freeze({
    family: 'kubernetes',
    platform: 'linux',
    arch: 'x64',
    target: 'x86_64-unknown-linux-gnu',
    accelerator: 'cpu',
  }),
  'container-x64-cloud-container-nvidia-cuda-helm': Object.freeze({
    family: 'kubernetes',
    platform: 'linux',
    arch: 'x64',
    target: 'x86_64-unknown-linux-gnu',
    accelerator: 'nvidia-cuda',
  }),
  'container-x64-cloud-container-amd-rocm-helm': Object.freeze({
    family: 'kubernetes',
    platform: 'linux',
    arch: 'x64',
    target: 'x86_64-unknown-linux-gnu',
    accelerator: 'amd-rocm',
  }),
  'container-arm64-cloud-container-cpu-helm': Object.freeze({
    family: 'kubernetes',
    platform: 'linux',
    arch: 'arm64',
    target: 'aarch64-unknown-linux-gnu',
    accelerator: 'cpu',
  }),
});

function nonEmpty(value, fallback = '') {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function normalizeReleaseTag(env = process.env) {
  return nonEmpty(env.SDKWORK_RELEASE_TAG, 'release-local');
}

function currentTargetId(env = process.env) {
  return nonEmpty(env.SDKWORK_PACKAGE_TARGET_ID, env.SDKWORK_PACKAGE_ID);
}

function resolveTarget(env = process.env) {
  if (env.SDKWORK_RELEASE_AGGREGATE === 'true') {
    return {
      family: 'aggregate',
      platform: 'web',
      arch: 'noarch',
      target: '',
    };
  }

  const targetId = currentTargetId(env);
  const target = TARGETS[targetId];
  if (!target) {
    throw new Error(`Unsupported SDKWork BirdCoder package target: ${targetId}`);
  }

  return {
    id: targetId,
    ...target,
  };
}

function commandToString(command) {
  const [program, ...args] = command;
  return [program, ...args].join(' ');
}

function createCommand(program, args = [], options = {}) {
  return {
    program,
    args: args.map((arg) => String(arg)),
    cwd: options.cwd ?? process.cwd(),
    env: {
      ...process.env,
      ...(options.env ?? {}),
    },
    shell: Boolean(options.shell),
  };
}

function nodeCommand(args, options = {}) {
  return createCommand(process.execPath, args, options);
}

function pnpmCommand(args, options = {}) {
  return createCommand('pnpm', args, options);
}

function buildCommonPackageArgs(target, env = process.env) {
  const args = [
    '--profile',
    DEFAULT_RELEASE_PROFILE_ID,
    '--release-tag',
    normalizeReleaseTag(env),
    '--output-dir',
    RELEASE_ASSETS_DIR,
  ];
  if (target.platform) {
    args.push('--platform', target.platform);
  }
  if (target.arch) {
    args.push('--arch', target.arch);
  }
  if (target.target) {
    args.push('--target', target.target);
  }
  if (target.accelerator) {
    args.push('--accelerator', target.accelerator);
  }
  return args;
}

function imageMetadataDir(target) {
  return path.join(RELEASE_ASSETS_DIR, 'container-image-metadata', target.arch);
}

function imageMetadataPath(target) {
  return path.join(imageMetadataDir(target), 'published-image.json');
}

function imageTag(env = process.env) {
  return normalizeReleaseTag(env);
}

function dockerPlatform(target) {
  return target.arch === 'arm64' ? 'linux/arm64' : 'linux/amd64';
}

function buildContainerImageRepository(env = process.env) {
  return nonEmpty(env.BIRDCODER_CONTAINER_IMAGE_REPOSITORY, DEFAULT_IMAGE_REPOSITORY);
}

function recordImageMetadataCommand(target, env = process.env) {
  return [
    process.execPath,
    '-e',
    [
      'const fs = require("node:fs");',
      'const path = require("node:path");',
      `const metadataPath = ${JSON.stringify(imageMetadataPath(target))};`,
      'fs.mkdirSync(path.dirname(metadataPath), { recursive: true });',
      'const digest = process.env.SDKWORK_PUBLISHED_IMAGE_DIGEST || process.env.BIRDCODER_PUBLISHED_IMAGE_DIGEST || "";',
      'const imageRepository = process.env.BIRDCODER_CONTAINER_IMAGE_REPOSITORY || "ghcr.io/sdkwork-cloud/sdkwork-birdcoder-server";',
      'const imageTag = process.env.SDKWORK_RELEASE_TAG || "release-local";',
      'fs.writeFileSync(metadataPath, `${JSON.stringify({ imageRepository, imageTag, imageDigest: digest, imageReference: digest ? `${imageRepository}@${digest}` : "" }, null, 2)}\\n`);',
    ].join('\n'),
  ];
}

function lifecycleInstallEnv() {
  return {
    SDKWORK_SHARED_SDK_MODE: 'git',
    SDKWORK_SHARED_SDK_GIT_PROTOCOL: 'https',
    SDKWORK_SHARED_SDK_GITHUB_TOKEN: process.env.SDKWORK_SHARED_SDK_GITHUB_TOKEN || process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '',
  };
}

function buildPreflightCommands(target) {
  if (target.family === 'desktop' && target.platform === 'linux') {
    return [
      createCommand('sudo', ['apt-get', 'update']),
      createCommand('sudo', [
        'apt-get',
        'install',
        '-y',
        'libwebkit2gtk-4.1-dev',
        'libayatana-appindicator3-dev',
        'librsvg2-dev',
        'patchelf',
        'xvfb',
        'xdg-utils',
        'rpm',
      ]),
      nodeCommand([
        'scripts/release/preflight-desktop-signing-environment.mjs',
        '--platform',
        target.platform,
        '--arch',
        target.arch,
        '--target',
        target.target,
        '--bundles',
        target.bundle,
        '--release-kind',
        DEFAULT_RELEASE_KIND,
        '--rollout-stage',
        DEFAULT_ROLLOUT_STAGE,
      ]),
    ];
  }

  if (target.family === 'desktop') {
    return [
      nodeCommand([
        'scripts/release/preflight-desktop-signing-environment.mjs',
        '--platform',
        target.platform,
        '--arch',
        target.arch,
        '--target',
        target.target,
        '--bundles',
        target.bundle,
        '--release-kind',
        DEFAULT_RELEASE_KIND,
        '--rollout-stage',
        DEFAULT_ROLLOUT_STAGE,
      ]),
    ];
  }

  return [];
}

function buildInstallCommands() {
  return [
    pnpmCommand(['install', '--frozen-lockfile'], { env: lifecycleInstallEnv() }),
    pnpmCommand(['prepare:shared-sdk'], { env: lifecycleInstallEnv() }),
  ];
}

function buildBuildCommands(target) {
  if (target.family === 'desktop') {
    return [
      nodeCommand(['scripts/run-desktop-release-build.mjs', '--profile', DEFAULT_RELEASE_PROFILE_ID, '--phase', 'sync', '--target', target.target, '--release']),
      nodeCommand(['scripts/run-desktop-release-build.mjs', '--profile', DEFAULT_RELEASE_PROFILE_ID, '--phase', 'prepare-target', '--target', target.target]),
      nodeCommand(['scripts/run-desktop-release-build.mjs', '--profile', DEFAULT_RELEASE_PROFILE_ID, '--phase', 'prepare-openclaw', '--target', target.target]),
      nodeCommand(['scripts/run-desktop-release-build.mjs', '--profile', DEFAULT_RELEASE_PROFILE_ID, '--phase', 'bundle', '--target', target.target, '--platform', target.platform, '--bundles', target.bundle, '--release']),
    ];
  }

  if (target.family === 'server' || target.family === 'container') {
    return [
      nodeCommand(['scripts/run-claw-server-build.mjs', '--target', target.target]),
      nodeCommand(['--experimental-strip-types', 'scripts/coding-server-openapi-export.ts']),
      pnpmCommand(['build']),
    ];
  }

  if (target.family === 'web') {
    return [
      pnpmCommand(['build']),
      pnpmCommand(['docs:build']),
    ];
  }

  if (target.family === 'kubernetes') {
    return [];
  }

  throw new Error(`Unsupported build family: ${target.family}`);
}

function containerPackageCommands(target, env = process.env) {
  const commands = [
    nodeCommand(['scripts/release/package-release-assets.mjs', 'container', ...buildCommonPackageArgs(target, env)]),
  ];
  if (target.accelerator === 'cpu') {
    const repository = buildContainerImageRepository(env);
    const tag = imageTag(env);
    commands.push(
      createCommand('docker', [
        'buildx',
        'create',
        '--use',
      ]),
      createCommand('docker', [
        'buildx',
        'build',
        '--platform',
        dockerPlatform(target),
        '--push',
        '--file',
        'deployments/docker/Dockerfile',
        '--tag',
        `${repository}:${tag}`,
        '--label',
        `org.opencontainers.image.source=https://github.com/${nonEmpty(env.GITHUB_REPOSITORY, 'Sdkwork-Cloud/sdkwork-birdcoder')}`,
        '--label',
        `org.opencontainers.image.version=${tag}`,
        '--label',
        `org.opencontainers.image.revision=${nonEmpty(env.GITHUB_SHA, '')}`,
        '--label',
        'org.opencontainers.image.title=sdkwork-birdcoder-server',
        'artifacts/release/container/linux',
      ]),
      createCommand(recordImageMetadataCommand(target, env)[0], recordImageMetadataCommand(target, env).slice(1), {
        env: {
          BIRDCODER_CONTAINER_IMAGE_REPOSITORY: repository,
          SDKWORK_RELEASE_TAG: tag,
        },
      }),
    );
  }

  return commands;
}

function readImageMetadata(target) {
  const metadataPath = imageMetadataPath(target);
  if (!fs.existsSync(metadataPath)) {
    throw new Error(`Missing published CPU container image metadata for kubernetes package: ${metadataPath}`);
  }
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  return {
    imageRepository: nonEmpty(metadata.imageRepository, DEFAULT_IMAGE_REPOSITORY),
    imageTag: nonEmpty(metadata.imageTag, normalizeReleaseTag()),
    imageDigest: nonEmpty(metadata.imageDigest, ''),
  };
}

function buildPackageCommands(target, env = process.env) {
  if (target.family === 'desktop') {
    return [
      nodeCommand([
        'scripts/release/package-release-assets.mjs',
        'desktop',
        ...buildCommonPackageArgs(target, env),
        '--bundles',
        target.bundle,
      ]),
    ];
  }

  if (target.family === 'server') {
    return [
      nodeCommand(['scripts/release/package-release-assets.mjs', 'server', ...buildCommonPackageArgs(target, env)]),
    ];
  }

  if (target.family === 'container') {
    return containerPackageCommands(target, env);
  }

  if (target.family === 'kubernetes') {
    const imageMetadata = readImageMetadata(target);
    return [
      nodeCommand([
        'scripts/release/package-release-assets.mjs',
        'kubernetes',
        ...buildCommonPackageArgs(target, env),
        '--image-repository',
        imageMetadata.imageRepository,
        '--image-tag',
        imageMetadata.imageTag,
        '--image-digest',
        imageMetadata.imageDigest,
      ]),
    ];
  }

  if (target.family === 'web') {
    return [
      nodeCommand(['scripts/release/package-release-assets.mjs', 'web', ...buildCommonPackageArgs(target, env)]),
    ];
  }

  throw new Error(`Unsupported package family: ${target.family}`);
}

function writePackageSignatureEvidenceCommand(target, env = process.env) {
  const packageId = nonEmpty(env.SDKWORK_PACKAGE_ID, currentTargetId(env));
  const evidencePath = path.posix.join(SIGNATURE_EVIDENCE_DIR, `${packageId}.signature-evidence.json`);
  return nodeCommand([
    '-e',
    [
      'const fs = require("node:fs");',
      'const path = require("node:path");',
      `const evidencePath = ${JSON.stringify(evidencePath)};`,
      'fs.mkdirSync(path.dirname(evidencePath), { recursive: true });',
      'const env = process.env;',
      'const evidence = {',
      '  schemaVersion: "2026-06-06.sdkwork.signature-evidence.v1",',
      '  appId: env.SDKWORK_APP_ID || "sdkwork-birdcoder",',
      `  packageId: ${JSON.stringify(packageId)},`,
      `  targetId: ${JSON.stringify(currentTargetId(env))},`,
      `  runtimeTarget: ${JSON.stringify(nonEmpty(env.SDKWORK_RUNTIME_TARGET, target.family))},`,
      `  deploymentProfile: ${JSON.stringify(nonEmpty(env.SDKWORK_DEPLOYMENT_PROFILE, target.family === 'container' || target.family === 'kubernetes' ? 'cloud' : 'standalone'))},`,
      `  packageProfile: ${JSON.stringify(nonEmpty(env.SDKWORK_PACKAGE_PROFILE, target.family))},`,
      '  releaseTag: env.SDKWORK_RELEASE_TAG || "release-local",',
      '  required: true,',
      '  status: "pending-external-signature",',
      '  signerWorkflow: ".github/workflows/package.yml",',
      '  note: "Package signing is enforced through SDKWork release validation and platform-specific trust evidence.",',
      '  generatedAt: new Date().toISOString()',
      '};',
      'fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\\n`);',
    ].join('\n'),
  ]);
}

function writePackageSbomEvidenceCommand(target, env = process.env) {
  const packageId = nonEmpty(env.SDKWORK_PACKAGE_ID, currentTargetId(env));
  const sbomPath = path.posix.join(SBOM_EVIDENCE_DIR, `${packageId}.sbom.json`);
  return nodeCommand([
    '-e',
    [
      'const fs = require("node:fs");',
      'const path = require("node:path");',
      `const sbomPath = ${JSON.stringify(sbomPath)};`,
      'fs.mkdirSync(path.dirname(sbomPath), { recursive: true });',
      'const env = process.env;',
      'const sbom = {',
      '  bomFormat: "CycloneDX",',
      '  specVersion: "1.6",',
      '  version: 1,',
      '  metadata: {',
      '    timestamp: new Date().toISOString(),',
      '    tools: [{ vendor: "SDKWork", name: "sdkwork-birdcoder-release-lifecycle", version: "1.0.0" }],',
      '    component: {',
      '      type: "application",',
      '      name: env.SDKWORK_APP_ID || "sdkwork-birdcoder",',
      '      version: env.SDKWORK_PACKAGE_VERSION || env.SDKWORK_RELEASE_TAG || "release-local",',
      '      "bom-ref": env.SDKWORK_PACKAGE_ID || "sdkwork-birdcoder-package"',
      '    },',
      '    properties: [',
      `      { name: "sdkwork:packageId", value: ${JSON.stringify(packageId)} },`,
      `      { name: "sdkwork:targetId", value: ${JSON.stringify(currentTargetId(env))} },`,
      `      { name: "sdkwork:runtimeTarget", value: ${JSON.stringify(nonEmpty(env.SDKWORK_RUNTIME_TARGET, target.family))} },`,
      `      { name: "sdkwork:deploymentProfile", value: ${JSON.stringify(nonEmpty(env.SDKWORK_DEPLOYMENT_PROFILE, target.family === 'container' || target.family === 'kubernetes' ? 'cloud' : 'standalone'))} }`,
      '    ]',
      '  },',
      '  components: []',
      '};',
      'fs.writeFileSync(sbomPath, `${JSON.stringify(sbom, null, 2)}\\n`);',
    ].join('\n'),
  ]);
}

function buildSignCommands(target, env = process.env) {
  return [writePackageSignatureEvidenceCommand(target, env)];
}

function buildSbomCommands(target, env = process.env) {
  return [writePackageSbomEvidenceCommand(target, env)];
}

function buildValidateCommands(target) {
  if (target.family === 'desktop') {
    return [
      nodeCommand([
        'scripts/release/verify-desktop-installer-trust.mjs',
        '--platform',
        target.platform,
        '--arch',
        target.arch,
        '--target',
        target.target,
        '--release-assets-dir',
        RELEASE_ASSETS_DIR,
        '--release-kind',
        DEFAULT_RELEASE_KIND,
        '--rollout-stage',
        DEFAULT_ROLLOUT_STAGE,
      ]),
      nodeCommand([
        'scripts/release/smoke-desktop-installers.mjs',
        '--platform',
        target.platform,
        '--arch',
        target.arch,
        '--target',
        target.target,
        '--release-assets-dir',
        RELEASE_ASSETS_DIR,
      ]),
      nodeCommand([
        'scripts/release/smoke-desktop-packaged-launch.mjs',
        '--platform',
        target.platform,
        '--arch',
        target.arch,
        '--target',
        target.target,
        '--release-assets-dir',
        RELEASE_ASSETS_DIR,
      ]),
    ];
  }

  if (target.family === 'server') {
    return [
      nodeCommand([
        'scripts/release/smoke-server-release-assets.mjs',
        '--platform',
        target.platform,
        '--arch',
        target.arch,
        '--target',
        target.target,
        '--release-assets-dir',
        RELEASE_ASSETS_DIR,
      ]),
    ];
  }

  if (target.family === 'container' || target.family === 'kubernetes') {
    return [
      nodeCommand([
        'scripts/release/smoke-deployment-release-assets.mjs',
        '--family',
        target.family,
        '--platform',
        target.platform,
        '--arch',
        target.arch,
        '--target',
        target.target,
        '--accelerator',
        target.accelerator,
        '--release-assets-dir',
        RELEASE_ASSETS_DIR,
      ]),
    ];
  }

  if (target.family === 'web') {
    return [
      nodeCommand(['scripts/release/smoke-web-release-assets.mjs', '--release-assets-dir', RELEASE_ASSETS_DIR]),
    ];
  }

  throw new Error(`Unsupported validate family: ${target.family}`);
}

function buildPublishCommands(env = process.env) {
  const releaseAssetsDir = nonEmpty(env.SDKWORK_AGGREGATE_ARTIFACT_PATH, AGGREGATE_RELEASE_ASSETS_DIR);
  const repository = nonEmpty(env.GITHUB_REPOSITORY, 'Sdkwork-Cloud/sdkwork-birdcoder');
  const releaseTag = normalizeReleaseTag(env);
  return [
    nodeCommand([
      'scripts/release/render-release-notes.mjs',
      '--release-tag',
      releaseTag,
      '--output',
      path.join(releaseAssetsDir, 'release-notes.md'),
    ]),
    nodeCommand([
      'scripts/release/finalize-release-assets.mjs',
      '--profile',
      DEFAULT_RELEASE_PROFILE_ID,
      '--release-tag',
      releaseTag,
      '--repository',
      repository,
      '--release-assets-dir',
      releaseAssetsDir,
      '--release-kind',
      DEFAULT_RELEASE_KIND,
      '--rollout-stage',
      DEFAULT_ROLLOUT_STAGE,
    ]),
    nodeCommand(['scripts/release/smoke-finalized-release-assets.mjs', '--release-assets-dir', releaseAssetsDir]),
    nodeCommand([
      'scripts/release/write-attestation-evidence.mjs',
      '--profile',
      DEFAULT_RELEASE_PROFILE_ID,
      '--release-assets-dir',
      releaseAssetsDir,
      '--repository',
      repository,
      '--release-tag',
      releaseTag,
    ]),
    nodeCommand(['scripts/release/assert-release-readiness.mjs', '--profile', DEFAULT_RELEASE_PROFILE_ID, '--release-assets-dir', releaseAssetsDir]),
  ];
}

function buildLifecycleCommands(phase, env = process.env) {
  const target = resolveTarget(env);
  switch (phase) {
    case 'preflight':
      return buildPreflightCommands(target);
    case 'install':
      return buildInstallCommands(target);
    case 'build':
      return buildBuildCommands(target);
    case 'package':
      return buildPackageCommands(target, env);
    case 'sign':
      return buildSignCommands(target, env);
    case 'sbom':
      return buildSbomCommands(target, env);
    case 'validate':
      return buildValidateCommands(target);
    case 'publish':
      return buildPublishCommands(env);
    default:
      throw new Error(`Unsupported SDKWork BirdCoder lifecycle phase: ${phase}`);
  }
}

function runCommand(command) {
  const result = spawnSync(command.program, command.args, {
    cwd: command.cwd,
    env: command.env,
    stdio: 'inherit',
    shell: command.shell,
  });
  if (result.error) {
    throw result.error;
  }
  if ((result.status ?? 1) !== 0) {
    throw new Error(`${command.program} ${command.args.join(' ')} failed with exit code ${result.status ?? 1}`);
  }
}

export {
  TARGETS,
  buildLifecycleCommands,
  commandToString,
  resolveTarget,
  writePackageSbomEvidenceCommand,
  writePackageSignatureEvidenceCommand,
};

export async function runLifecycle(phase, { env = process.env } = {}) {
  const commands = buildLifecycleCommands(phase, env);
  if (commands.length === 0) {
    console.log(`[sdkwork-birdcoder-release] lifecycle ${phase}: no-op for ${currentTargetId(env) || 'aggregate-release'}`);
    return;
  }

  for (const command of commands) {
    console.log(`[sdkwork-birdcoder-release] ${command.program} ${command.args.join(' ')}`);
    runCommand(command);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const phase = process.argv[2];
  if (!phase) {
    console.error('Usage: node scripts/release/sdkwork-workflow-lifecycle.mjs <preflight|install|build|package|sign|sbom|validate|publish>');
    process.exit(1);
  }

  runLifecycle(phase).catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exit(1);
  });
}
