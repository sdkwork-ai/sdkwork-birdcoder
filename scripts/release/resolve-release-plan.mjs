#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import {
  DEFAULT_RELEASE_PROFILE_ID,
  buildContainerReleaseMatrix,
  buildDesktopReleaseMatrix,
  buildKubernetesReleaseMatrix,
  buildServerReleaseMatrix,
  resolveReleaseProfile,
} from './release-profiles.mjs';

export const DEFAULT_RELEASE_KIND = 'formal';
export const DEFAULT_ROLLBACK_RUNBOOK_REF = 'docs/step/13-发布就绪-github-flow-灰度回滚闭环.md';

const RELEASE_KIND_DEFAULTS = Object.freeze({
  formal: Object.freeze({
    rolloutStage: 'general-availability',
    monitoringWindowMinutes: 120,
  }),
  canary: Object.freeze({
    rolloutStage: 'canary',
    monitoringWindowMinutes: 60,
  }),
  hotfix: Object.freeze({
    rolloutStage: 'expedited',
    monitoringWindowMinutes: 180,
  }),
  rollback: Object.freeze({
    rolloutStage: 'rollback',
    monitoringWindowMinutes: 30,
  }),
});

function readOptionValue(argv, index, flag) {
  const next = argv[index + 1];
  const normalizedNext = String(next ?? '').trim();

  if (!normalizedNext || normalizedNext.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return normalizedNext;
}

function normalizeReleaseKind(releaseKind = DEFAULT_RELEASE_KIND) {
  const normalizedReleaseKind = String(releaseKind ?? '').trim().toLowerCase() || DEFAULT_RELEASE_KIND;
  if (!Object.hasOwn(RELEASE_KIND_DEFAULTS, normalizedReleaseKind)) {
    throw new Error(`Unsupported release kind: ${releaseKind}`);
  }

  return normalizedReleaseKind;
}

function normalizeMonitoringWindowMinutes(monitoringWindowMinutes, releaseKind) {
  if (
    monitoringWindowMinutes === undefined
    || monitoringWindowMinutes === null
    || String(monitoringWindowMinutes).trim() === ''
    || Number(monitoringWindowMinutes) === 0
  ) {
    return RELEASE_KIND_DEFAULTS[releaseKind].monitoringWindowMinutes;
  }

  const normalizedValue = Number.parseInt(String(monitoringWindowMinutes).trim(), 10);
  if (!Number.isInteger(normalizedValue) || normalizedValue <= 0) {
    throw new Error(`monitoringWindowMinutes must be a positive integer: ${monitoringWindowMinutes}`);
  }

  return normalizedValue;
}

export function resolveReleaseControl({
  releaseKind = DEFAULT_RELEASE_KIND,
  rolloutStage = '',
  monitoringWindowMinutes = 0,
  rollbackRunbookRef = '',
  rollbackCommand = '',
} = {}) {
  const normalizedReleaseKind = normalizeReleaseKind(releaseKind);
  const defaults = RELEASE_KIND_DEFAULTS[normalizedReleaseKind];
  const normalizedRolloutStage = String(rolloutStage ?? '').trim() || defaults.rolloutStage;
  const normalizedRollbackRunbookRef = String(rollbackRunbookRef ?? '').trim()
    || DEFAULT_ROLLBACK_RUNBOOK_REF;
  const normalizedRollbackCommand = String(rollbackCommand ?? '').trim();

  return {
    releaseKind: normalizedReleaseKind,
    rolloutStage: normalizedRolloutStage,
    monitoringWindowMinutes: normalizeMonitoringWindowMinutes(
      monitoringWindowMinutes,
      normalizedReleaseKind,
    ),
    rollbackRunbookRef: normalizedRollbackRunbookRef,
    rollbackCommand: normalizedRollbackCommand,
  };
}

export function createReleasePlan({
  profileId = DEFAULT_RELEASE_PROFILE_ID,
  releaseTag = '',
  gitRef = '',
  releaseKind = DEFAULT_RELEASE_KIND,
  rolloutStage = '',
  monitoringWindowMinutes = 0,
  rollbackRunbookRef = '',
  rollbackCommand = '',
} = {}) {
  const profile = resolveReleaseProfile(profileId);
  const normalizedReleaseTag = String(releaseTag ?? '').trim();
  const normalizedGitRef = String(gitRef ?? '').trim()
    || (normalizedReleaseTag ? `refs/tags/${normalizedReleaseTag}` : '');

  if (!normalizedReleaseTag) {
    throw new Error('releaseTag is required to resolve a release plan.');
  }

  return {
    profileId: profile.id,
    productName: profile.productName,
    releaseTag: normalizedReleaseTag,
    gitRef: normalizedGitRef,
    releaseName: `${profile.productName} ${normalizedReleaseTag}`,
    release: {
      ...profile.release,
    },
    releaseControl: resolveReleaseControl({
      releaseKind,
      rolloutStage,
      monitoringWindowMinutes,
      rollbackRunbookRef,
      rollbackCommand,
    }),
    desktopMatrix: buildDesktopReleaseMatrix(profile.id),
    serverMatrix: buildServerReleaseMatrix(profile.id),
    containerMatrix: buildContainerReleaseMatrix(profile.id),
    kubernetesMatrix: buildKubernetesReleaseMatrix(profile.id),
  };
}

export function createRollbackPlan({
  profileId = DEFAULT_RELEASE_PROFILE_ID,
  releaseTag = '',
  releaseAssetsDir = 'artifacts/release',
  rolloutStage = '',
  monitoringWindowMinutes = 0,
  rollbackRunbookRef = '',
  rollbackCommand = '',
} = {}) {
  const basePlan = createReleasePlan({
    profileId,
    releaseTag,
    releaseKind: 'rollback',
    rolloutStage,
    monitoringWindowMinutes,
    rollbackRunbookRef,
    rollbackCommand,
  });
  const normalizedReleaseAssetsDir = path.resolve(
    process.cwd(),
    String(releaseAssetsDir ?? '').trim() || 'artifacts/release',
  );
  const manifestPath = path.join(normalizedReleaseAssetsDir, basePlan.release.manifestFileName);
  const hasFinalizedManifest = fs.existsSync(manifestPath);
  const manifest = hasFinalizedManifest
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    : null;
  const assets = Array.isArray(manifest?.assets) ? manifest.assets : [];
  const assetFamilies = [...new Set(assets.map((entry) => String(entry?.family ?? '').trim()).filter(Boolean))];

  return {
    profileId: basePlan.profileId,
    productName: basePlan.productName,
    releaseTag: basePlan.releaseTag,
    releaseName: basePlan.releaseName,
    releaseAssetsDir: normalizedReleaseAssetsDir,
    manifestPath,
    hasFinalizedManifest,
    releaseControl: basePlan.releaseControl,
    finalizedRelease: {
      generatedAt: String(manifest?.generatedAt ?? '').trim(),
      checksumFileName: String(
        manifest?.checksumFileName ?? basePlan.release.globalChecksumsFileName,
      ).trim(),
      assetCount: assets.length,
      assetFamilies,
    },
    rollbackExecution: {
      runbookRef: basePlan.releaseControl.rollbackRunbookRef,
      command: basePlan.releaseControl.rollbackCommand
        || `pnpm release:rollback:plan -- --release-tag ${basePlan.releaseTag} --release-assets-dir ${normalizedReleaseAssetsDir}`,
    },
    preflightChecks: [
      {
        id: 'quality-fast',
        command: 'pnpm check:quality:fast',
      },
      {
        id: 'release-smoke-finalized',
        command: `pnpm release:smoke:finalized -- --release-assets-dir ${normalizedReleaseAssetsDir}`,
      },
    ],
  };
}

export function parseArgs(argv) {
  const options = {
    profileId: DEFAULT_RELEASE_PROFILE_ID,
    releaseTag: '',
    gitRef: '',
    releaseKind: DEFAULT_RELEASE_KIND,
    rolloutStage: '',
    monitoringWindowMinutes: 0,
    rollbackRunbookRef: '',
    rollbackCommand: '',
    githubOutput: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--profile') {
      options.profileId = readOptionValue(argv, index, '--profile');
      index += 1;
      continue;
    }

    if (token === '--release-tag') {
      options.releaseTag = readOptionValue(argv, index, '--release-tag');
      index += 1;
      continue;
    }

    if (token === '--git-ref') {
      options.gitRef = readOptionValue(argv, index, '--git-ref');
      index += 1;
      continue;
    }

    if (token === '--release-kind') {
      options.releaseKind = normalizeReleaseKind(readOptionValue(argv, index, '--release-kind'));
      index += 1;
      continue;
    }

    if (token === '--rollout-stage') {
      options.rolloutStage = readOptionValue(argv, index, '--rollout-stage');
      index += 1;
      continue;
    }

    if (token === '--monitoring-window-minutes') {
      options.monitoringWindowMinutes = normalizeMonitoringWindowMinutes(
        readOptionValue(argv, index, '--monitoring-window-minutes'),
        options.releaseKind,
      );
      index += 1;
      continue;
    }

    if (token === '--rollback-runbook-ref') {
      options.rollbackRunbookRef = readOptionValue(argv, index, '--rollback-runbook-ref');
      index += 1;
      continue;
    }

    if (token === '--rollback-command') {
      options.rollbackCommand = readOptionValue(argv, index, '--rollback-command');
      index += 1;
      continue;
    }

  if (token === '--github-output') {
      options.githubOutput = true;
    }
  }

  return options;
}

export function writeGitHubOutput(
  plan,
  {
    env = process.env,
    appendFile = (targetPath, content) => fs.appendFileSync(targetPath, content, 'utf8'),
  } = {},
) {
  const githubOutputPath = String(env.GITHUB_OUTPUT ?? '').trim();
  if (!githubOutputPath) {
    throw new Error('GITHUB_OUTPUT is required when --github-output is set.');
  }

  const outputLines = [
    `profile_id=${plan.profileId}`,
    `product_name=${plan.productName}`,
    `release_tag=${plan.releaseTag}`,
    `git_ref=${plan.gitRef}`,
    `release_name=${plan.releaseName}`,
    `release_kind=${plan.releaseControl.releaseKind}`,
    `rollout_stage=${plan.releaseControl.rolloutStage}`,
    `monitoring_window_minutes=${plan.releaseControl.monitoringWindowMinutes}`,
    `rollback_runbook_ref=${plan.releaseControl.rollbackRunbookRef}`,
    `rollback_command=${plan.releaseControl.rollbackCommand}`,
    `manifest_file_name=${plan.release.manifestFileName}`,
    `global_checksums_file_name=${plan.release.globalChecksumsFileName}`,
    `desktop_matrix=${JSON.stringify(plan.desktopMatrix)}`,
    `server_matrix=${JSON.stringify(plan.serverMatrix)}`,
    `container_matrix=${JSON.stringify(plan.containerMatrix)}`,
    `kubernetes_matrix=${JSON.stringify(plan.kubernetesMatrix)}`,
  ];
  appendFile(githubOutputPath, `${outputLines.join('\n')}\n`);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const plan = createReleasePlan(options);

  if (options.githubOutput) {
    writeGitHubOutput(plan);
    return;
  }

  process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
