#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import {
  DEFAULT_RELEASE_PROFILE_ID,
} from './release-profiles.mjs';
import { finalizeReleaseAssets } from './finalize-release-assets.mjs';
import { packageReleaseAssets } from './package-release-assets.mjs';
import {
  createReleasePlan,
  createRollbackPlan,
  DEFAULT_RELEASE_KIND,
} from './resolve-release-plan.mjs';
import { smokeDeploymentReleaseAssets } from './smoke-deployment-release-assets.mjs';
import { smokeDesktopInstallers } from './smoke-desktop-installers.mjs';
import { smokeServerReleaseAssets } from './smoke-server-release-assets.mjs';
import { smokeReleaseAssets as verifyReleaseAssets } from './smoke-release-assets.mjs';

function readOptionValue(argv, index, flag) {
  const next = argv[index + 1];
  const normalizedNext = String(next ?? '').trim();
  if (!normalizedNext || normalizedNext.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return normalizedNext;
}

function readPositiveIntegerOption(argv, index, flag) {
  const value = readOptionValue(argv, index, flag);
  const normalizedValue = Number.parseInt(value, 10);
  if (!Number.isInteger(normalizedValue) || normalizedValue <= 0) {
    throw new Error(`${flag} must be a positive integer.`);
  }

  return normalizedValue;
}

function resolveMode(command, family) {
  const normalizedCommand = String(command ?? '').trim().toLowerCase();
  const normalizedFamily = String(family ?? '').trim().toLowerCase();

  if (!normalizedCommand) {
    throw new Error('A local release command is required: plan, package <family>, smoke <family>, or finalize.');
  }
  if (normalizedCommand === 'plan') {
    return 'plan';
  }
  if (normalizedCommand === 'rollback-plan') {
    return 'rollback-plan';
  }
  if (normalizedCommand === 'package') {
    if (!normalizedFamily) {
      throw new Error('A release family is required for "package": desktop, server, container, kubernetes, or web.');
    }
    return `package:${normalizedFamily}`;
  }
  if (normalizedCommand === 'smoke') {
    if (!normalizedFamily) {
      throw new Error('A release family is required for "smoke": desktop, server, container, kubernetes, or web.');
    }
    return `smoke:${normalizedFamily}`;
  }
  if (normalizedCommand === 'finalize') {
    return 'finalize';
  }

  throw new Error(`Unsupported command: ${command}`);
}

function normalizeRelativePath(targetPath) {
  return String(targetPath ?? '').split(path.sep).join('/');
}

function formatCommandPath(targetPath) {
  const normalizedTargetPath = String(targetPath ?? '').trim();
  if (!normalizedTargetPath) {
    return '';
  }

  const resolvedPath = path.resolve(normalizedTargetPath);
  const relativePath = path.relative(process.cwd(), resolvedPath);
  if (
    relativePath
    && !relativePath.startsWith('..')
    && !path.isAbsolute(relativePath)
  ) {
    return normalizeRelativePath(relativePath);
  }

  return normalizeRelativePath(resolvedPath);
}

function summarizePackageResult(result) {
  const descriptor = result.descriptor;

  return {
    family: descriptor.family,
    releaseTag: descriptor.releaseTag,
    profileId: descriptor.profileId,
    platform: descriptor.platform,
    arch: descriptor.arch,
    target: descriptor.target,
    accelerator: descriptor.accelerator,
    imageRepository: descriptor.imageRepository,
    imageTag: descriptor.imageTag,
    imageDigest: descriptor.imageDigest,
    createdAt: descriptor.createdAt,
    outputDir: formatCommandPath(result.outputDir),
    outputFamilyDir: formatCommandPath(result.outputFamilyDir),
    manifestPath: formatCommandPath(result.manifestPath),
    archivePath: formatCommandPath(result.archivePath),
    artifacts: Array.isArray(result.manifest?.artifacts)
      ? result.manifest.artifacts
        .map((artifact) => String(artifact?.relativePath ?? '').trim())
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right))
      : [],
  };
}

export function parseArgs(argv) {
  const [command, maybeFamily, ...rest] = argv;
  const options = {
    mode: resolveMode(command, command === 'package' || command === 'smoke' ? maybeFamily : ''),
    profileId: '',
    releaseTag: 'release-local',
    gitRef: '',
    releaseKind: DEFAULT_RELEASE_KIND,
    rolloutStage: '',
    monitoringWindowMinutes: 0,
    rollbackRunbookRef: '',
    rollbackCommand: '',
    outputDir: undefined,
    releaseAssetsDir: undefined,
    platform: undefined,
    arch: undefined,
    target: '',
    accelerator: '',
    imageRepository: '',
    imageTag: '',
    imageDigest: '',
    repository: '',
    qualityExecutionReportPath: '',
  };

  const tokens = argv.slice(command === 'package' || command === 'smoke' ? 2 : 1);

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === '--') {
      continue;
    }
    if (!token.startsWith('--')) {
      continue;
    }

    switch (token) {
      case '--profile':
        options.profileId = readOptionValue(tokens, index, token);
        index += 1;
        break;
      case '--release-tag':
        options.releaseTag = readOptionValue(tokens, index, token);
        index += 1;
        break;
      case '--git-ref':
        options.gitRef = readOptionValue(tokens, index, token);
        index += 1;
        break;
      case '--release-kind':
        options.releaseKind = readOptionValue(tokens, index, token);
        index += 1;
        break;
      case '--rollout-stage':
        options.rolloutStage = readOptionValue(tokens, index, token);
        index += 1;
        break;
      case '--monitoring-window-minutes':
        options.monitoringWindowMinutes = readPositiveIntegerOption(tokens, index, token);
        index += 1;
        break;
      case '--rollback-runbook-ref':
        options.rollbackRunbookRef = readOptionValue(tokens, index, token);
        index += 1;
        break;
      case '--rollback-command':
        options.rollbackCommand = readOptionValue(tokens, index, token);
        index += 1;
        break;
      case '--output-dir':
        options.outputDir = readOptionValue(tokens, index, token);
        index += 1;
        break;
      case '--release-assets-dir':
        options.releaseAssetsDir = readOptionValue(tokens, index, token);
        index += 1;
        break;
      case '--platform':
        options.platform = readOptionValue(tokens, index, token);
        index += 1;
        break;
      case '--arch':
        options.arch = readOptionValue(tokens, index, token);
        index += 1;
        break;
      case '--target':
        options.target = readOptionValue(tokens, index, token);
        index += 1;
        break;
      case '--accelerator':
        options.accelerator = readOptionValue(tokens, index, token);
        index += 1;
        break;
      case '--image-repository':
        options.imageRepository = readOptionValue(tokens, index, token);
        index += 1;
        break;
      case '--image-tag':
        options.imageTag = readOptionValue(tokens, index, token);
        index += 1;
        break;
      case '--image-digest':
        options.imageDigest = readOptionValue(tokens, index, token);
        index += 1;
        break;
      case '--repository':
        options.repository = readOptionValue(tokens, index, token);
        index += 1;
        break;
      case '--quality-execution-report-path':
        options.qualityExecutionReportPath = readOptionValue(tokens, index, token);
        index += 1;
        break;
      default:
        throw new Error(`Unsupported option: ${token}`);
    }
  }

  if (!options.profileId) {
    options.profileId = DEFAULT_RELEASE_PROFILE_ID;
  }

  return options;
}

function smokeReleaseAssets(context) {
  const family = context.mode.split(':')[1];
  if (family === 'desktop') {
    return smokeDesktopInstallers({
      releaseAssetsDir: context.releaseAssetsDir || 'artifacts/release',
      platform: context.platform || process.platform,
      arch: context.arch || process.arch,
      target: context.target,
    });
  }
  if (family === 'server') {
    return smokeServerReleaseAssets({
      releaseAssetsDir: context.releaseAssetsDir || 'artifacts/release',
      platform: context.platform || process.platform,
      arch: context.arch || process.arch,
      target: context.target,
    });
  }
  if (family === 'container' || family === 'kubernetes') {
    return smokeDeploymentReleaseAssets({
      family,
      releaseAssetsDir: context.releaseAssetsDir || 'artifacts/release',
      platform: context.platform || 'linux',
      arch: context.arch || process.arch,
      target: context.target,
      accelerator: context.accelerator || 'cpu',
    });
  }

  return verifyReleaseAssets({
    family,
    releaseAssetsDir: context.releaseAssetsDir || 'artifacts/release',
    platform: context.platform || process.platform,
    arch: context.arch || process.arch,
    accelerator: context.accelerator || 'cpu',
  });
}

function resolveCommandPayload(context) {
  if (context.mode === 'plan') {
    return createReleasePlan({
      profileId: context.profileId,
      releaseTag: context.releaseTag || 'release-local',
      gitRef: context.gitRef,
      releaseKind: context.releaseKind,
      rolloutStage: context.rolloutStage,
      monitoringWindowMinutes: context.monitoringWindowMinutes,
      rollbackRunbookRef: context.rollbackRunbookRef,
      rollbackCommand: context.rollbackCommand,
    });
  }

  if (context.mode === 'rollback-plan') {
    return createRollbackPlan({
      profileId: context.profileId,
      releaseTag: context.releaseTag || 'release-local',
      releaseAssetsDir: context.releaseAssetsDir || context.outputDir || 'artifacts/release',
      rolloutStage: context.rolloutStage,
      monitoringWindowMinutes: context.monitoringWindowMinutes,
      rollbackRunbookRef: context.rollbackRunbookRef,
      rollbackCommand: context.rollbackCommand,
    });
  }

  if (context.mode.startsWith('package:')) {
    const family = context.mode.split(':')[1];
    const result = packageReleaseAssets(family, {
      profile: context.profileId,
      'release-tag': context.releaseTag,
      'output-dir': context.outputDir,
      platform: context.platform,
      arch: context.arch,
      target: context.target,
      accelerator: context.accelerator,
      'image-repository': context.imageRepository,
      'image-tag': context.imageTag,
      'image-digest': context.imageDigest,
    });
    return summarizePackageResult(result);
  }

  if (context.mode.startsWith('smoke:')) {
    return smokeReleaseAssets(context);
  }

  if (context.mode === 'finalize') {
    return finalizeReleaseAssets({
      profile: context.profileId,
      'release-tag': context.releaseTag || 'release-local',
      'release-kind': context.releaseKind,
      'rollout-stage': context.rolloutStage,
      'monitoring-window-minutes': context.monitoringWindowMinutes,
      'rollback-runbook-ref': context.rollbackRunbookRef,
      'rollback-command': context.rollbackCommand,
      repository: context.repository,
      'release-assets-dir': context.releaseAssetsDir || context.outputDir || 'artifacts/release',
      'quality-execution-report-path': context.qualityExecutionReportPath,
    });
  }

  throw new Error(`Unsupported local release mode: ${context.mode}`);
}

export function runLocalReleaseCommand(
  argv,
  {
    write = (content) => process.stdout.write(content),
  } = {},
) {
  const context = Array.isArray(argv) ? parseArgs(argv) : argv;
  const payload = resolveCommandPayload(context);
  write(`${JSON.stringify(payload, null, 2)}\n`);
  return payload;
}

function run() {
  runLocalReleaseCommand(process.argv.slice(2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}
