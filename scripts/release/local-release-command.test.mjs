import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { parseArgs, runLocalReleaseCommand } from './local-release-command.mjs';

const plan = parseArgs(['plan']);
assert.equal(plan.mode, 'plan');
assert.equal(plan.releaseKind, 'formal');

const rollbackPlan = parseArgs([
  'rollback-plan',
  '--release-assets-dir',
  'artifacts/release',
  '--release-tag',
  'release-2026-04-09-105',
  '--rollback-command',
  'gh workflow run rollback.yml --ref main',
]);
assert.equal(rollbackPlan.mode, 'rollback-plan');
assert.equal(rollbackPlan.releaseAssetsDir, 'artifacts/release');
assert.equal(rollbackPlan.releaseTag, 'release-2026-04-09-105');
assert.equal(rollbackPlan.rollbackCommand, 'gh workflow run rollback.yml --ref main');
assert.equal(rollbackPlan.releaseKind, 'formal');

const rollbackPlanViaPnpm = parseArgs([
  'rollback-plan',
  '--release-assets-dir',
  'artifacts/release',
  '--',
  '--release-tag',
  'release-2026-04-09-105',
]);
assert.equal(rollbackPlanViaPnpm.mode, 'rollback-plan');
assert.equal(rollbackPlanViaPnpm.releaseTag, 'release-2026-04-09-105');

const desktop = parseArgs([
  'package',
  'desktop',
  '--profile',
  'sdkwork-birdcoder',
  '--platform',
  'windows',
  '--arch',
  'x64',
  '--target',
  'x86_64-pc-windows-msvc',
]);
assert.equal(desktop.mode, 'package:desktop');
assert.equal(desktop.profileId, 'sdkwork-birdcoder');
assert.equal(desktop.platform, 'windows');
assert.equal(desktop.arch, 'x64');
assert.equal(desktop.target, 'x86_64-pc-windows-msvc');

const defaultDesktop = parseArgs(['package', 'desktop']);
assert.equal(defaultDesktop.releaseTag, 'release-local');

const defaultServerPackage = parseArgs(['package', 'server']);
assert.equal(defaultServerPackage.platform, undefined);
assert.equal(defaultServerPackage.arch, undefined);
assert.equal(defaultServerPackage.outputDir, undefined);

const smoke = parseArgs(['smoke', 'container', '--accelerator', 'cpu']);
assert.equal(smoke.mode, 'smoke:container');
assert.equal(smoke.accelerator, 'cpu');

const smokeWeb = parseArgs(['smoke', 'web', '--release-assets-dir', 'artifacts/release']);
assert.equal(smokeWeb.mode, 'smoke:web');
assert.equal(smokeWeb.releaseAssetsDir, 'artifacts/release');

const kubernetesPackage = parseArgs([
  'package',
  'kubernetes',
  '--image-repository',
  'ghcr.io/sdkwork-cloud/sdkwork-birdcoder-server',
  '--image-tag',
  'release-local-linux-x64',
  '--image-digest',
  'sha256:test',
]);
assert.equal(kubernetesPackage.imageRepository, 'ghcr.io/sdkwork-cloud/sdkwork-birdcoder-server');
assert.equal(kubernetesPackage.imageTag, 'release-local-linux-x64');
assert.equal(kubernetesPackage.imageDigest, 'sha256:test');

const finalize = parseArgs(['finalize', '--release-assets-dir', 'artifacts/release']);
assert.equal(finalize.mode, 'finalize');
assert.equal(finalize.releaseAssetsDir, 'artifacts/release');

const finalizeWithQualityExecutionReport = parseArgs([
  'finalize',
  '--release-assets-dir',
  'artifacts/release',
  '--quality-execution-report-path',
  'artifacts/quality/quality-gate-execution-report.json',
]);
assert.equal(
  finalizeWithQualityExecutionReport.qualityExecutionReportPath,
  'artifacts/quality/quality-gate-execution-report.json',
);

const finalizeWithRepository = parseArgs([
  'finalize',
  '--release-assets-dir',
  'artifacts/release',
  '--release-kind',
  'canary',
  '--rollout-stage',
  'ring-1',
  '--monitoring-window-minutes',
  '45',
  '--rollback-runbook-ref',
  'docs/step/13-发布就绪-github-flow-灰度回滚闭环.md',
  '--rollback-command',
  'gh workflow run rollback.yml --ref main',
  '--repository',
  'Sdkwork-Cloud/sdkwork-birdcoder',
  '--quality-execution-report-path',
  'artifacts/quality/quality-gate-execution-report.json',
]);
assert.equal(finalizeWithRepository.repository, 'Sdkwork-Cloud/sdkwork-birdcoder');
assert.equal(finalizeWithRepository.releaseKind, 'canary');
assert.equal(finalizeWithRepository.rolloutStage, 'ring-1');
assert.equal(finalizeWithRepository.monitoringWindowMinutes, 45);
assert.equal(finalizeWithRepository.rollbackRunbookRef, 'docs/step/13-发布就绪-github-flow-灰度回滚闭环.md');
assert.equal(finalizeWithRepository.rollbackCommand, 'gh workflow run rollback.yml --ref main');
assert.equal(
  finalizeWithRepository.qualityExecutionReportPath,
  'artifacts/quality/quality-gate-execution-report.json',
);

const originalCwd = process.cwd();
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'birdcoder-local-release-command-'));

try {
  fs.mkdirSync(path.join(fixtureRoot, 'packages', 'sdkwork-birdcoder-server', 'src-host', 'src'), { recursive: true });
  fs.mkdirSync(path.join(fixtureRoot, 'packages', 'sdkwork-birdcoder-web', 'src'), { recursive: true });
  fs.mkdirSync(path.join(fixtureRoot, 'artifacts', 'openapi'), { recursive: true });
  fs.writeFileSync(
    path.join(fixtureRoot, 'packages', 'sdkwork-birdcoder-server', 'src-host', 'src', 'main.rs'),
    'fn main() {}\n',
  );
  fs.writeFileSync(
    path.join(fixtureRoot, 'packages', 'sdkwork-birdcoder-web', 'src', 'index.ts'),
    'export const web = true;\n',
  );
  fs.writeFileSync(
    path.join(fixtureRoot, 'artifacts', 'openapi', 'coding-server-v1.json'),
    JSON.stringify({
      openapi: '3.1.0',
      info: {
        title: 'SDKWork BirdCoder Coding Server API',
        version: 'v1',
      },
    }, null, 2) + '\n',
  );

  process.chdir(fixtureRoot);

  const stdoutChunks = [];
  const serverPackage = runLocalReleaseCommand(
    ['package', 'server'],
    {
      write: (chunk) => {
        stdoutChunks.push(String(chunk));
      },
    },
  );
  const normalizedHostPlatform = process.platform === 'win32'
    ? 'windows'
    : process.platform === 'darwin'
      ? 'macos'
      : process.platform;
  const expectedOutputFamilyDir = path.join(
    fixtureRoot,
    'artifacts',
    'release',
    'server',
    normalizedHostPlatform,
    process.arch,
  );
  const expectedManifestPath = path.join(expectedOutputFamilyDir, 'release-asset-manifest.json');
  const expectedArchivePath = path.join(
    expectedOutputFamilyDir,
    `sdkwork-birdcoder-server-release-local-${normalizedHostPlatform}-${process.arch}.tar.gz`,
  );

  assert.equal(serverPackage.family, 'server');
  assert.equal(serverPackage.platform, normalizedHostPlatform);
  assert.equal(serverPackage.arch, process.arch);
  assert.equal(serverPackage.outputDir, 'artifacts/release');
  assert.equal(
    serverPackage.outputFamilyDir,
    ['artifacts', 'release', 'server', normalizedHostPlatform, process.arch].join('/'),
  );
  assert.equal(
    serverPackage.manifestPath,
    ['artifacts', 'release', 'server', normalizedHostPlatform, process.arch, 'release-asset-manifest.json'].join('/'),
  );
  assert.equal(
    serverPackage.archivePath,
    ['artifacts', 'release', 'server', normalizedHostPlatform, process.arch, `sdkwork-birdcoder-server-release-local-${normalizedHostPlatform}-${process.arch}.tar.gz`].join('/'),
  );
  assert.equal(serverPackage.artifacts.includes(
    ['server', normalizedHostPlatform, process.arch, 'openapi', 'coding-server-v1.json'].join('/'),
  ), true);
  assert.equal(fs.existsSync(expectedOutputFamilyDir), true);
  assert.equal(fs.existsSync(expectedManifestPath), true);
  assert.equal(fs.existsSync(expectedArchivePath), true);
  assert.equal(
    fs.existsSync(path.join(fixtureRoot, 'server')),
    false,
  );
  assert.deepEqual(JSON.parse(stdoutChunks.join('')), serverPackage);
} finally {
  process.chdir(originalCwd);
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log('local release command contract passed.');
