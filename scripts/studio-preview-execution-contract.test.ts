import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import { resolveHostStudioPreviewSession } from '../packages/sdkwork-birdcoder-host-studio/src/index.ts';

const runtimeModulePath = new URL(
  '../packages/sdkwork-birdcoder-studio/src/preview/runtime.ts',
  import.meta.url,
);

assert.equal(
  existsSync(runtimeModulePath),
  true,
  'Studio preview execution runtime must exist.',
);

const {
  STUDIO_PREVIEW_EXECUTION_ADAPTER_ID,
  buildStudioPreviewExecutionEvidence,
  resolveStudioPreviewExecutionLaunch,
} = await import('../packages/sdkwork-birdcoder-studio/src/preview/runtime.ts');

const previewSession = resolveHostStudioPreviewSession(
  {
    url: 'http://127.0.0.1:4173/app',
    platform: 'app',
    appPlatform: 'harmony',
    deviceModel: 'mate-60',
    isLandscape: true,
  },
  'cn',
);

const launch = await resolveStudioPreviewExecutionLaunch(
  previewSession,
  {
    id: 'preview-dev',
    name: 'Preview Dev Server',
    command: 'pnpm dev --host 127.0.0.1 --port 4173',
    profileId: 'powershell',
    group: 'dev',
    cwdMode: 'project',
    customCwd: '',
  },
  {
    projectId: 'project-1',
    projectDirectory: '/workspace/demo-project',
    workspaceDirectory: '/workspace',
    timestamp: 42,
  },
);

assert.deepEqual(launch.request, {
  adapterId: STUDIO_PREVIEW_EXECUTION_ADAPTER_ID,
  runConfigurationId: 'preview-dev',
  session: previewSession,
  terminalRequest: {
    path: '/workspace/demo-project',
    command: 'pnpm dev --host 127.0.0.1 --port 4173',
    profileId: 'powershell',
    timestamp: 42,
  },
  evidence: {
    adapterId: STUDIO_PREVIEW_EXECUTION_ADAPTER_ID,
    evidenceKey: 'preview.cn.app.harmony.landscape.launch',
    sessionEvidenceKey: 'preview.cn.app.harmony.landscape',
    host: previewSession.host,
    channel: 'app.harmony',
    orientation: 'landscape',
    previewUrl: 'http://127.0.0.1:4173/app',
    command: 'pnpm dev --host 127.0.0.1 --port 4173',
    cwd: '/workspace/demo-project',
    profileId: 'powershell',
    projectId: 'project-1',
    runConfigurationId: 'preview-dev',
    launchedAt: 42,
  },
});

assert.deepEqual(launch.launchPresentation, {
  canLaunch: true,
  reason: null,
  statusLabel: null,
  detailLabel: 'powershell',
});
assert.deepEqual(launch.blockedAction, {
  actionId: null,
  actionLabel: null,
});

assert.deepEqual(
  buildStudioPreviewExecutionEvidence(
    previewSession,
    {
      path: '/workspace/demo-project',
      command: 'pnpm dev --host 127.0.0.1 --port 4173',
      profileId: 'powershell',
      timestamp: 42,
    },
    {
      projectId: 'project-1',
      runConfigurationId: 'preview-dev',
    },
  ),
  {
    adapterId: STUDIO_PREVIEW_EXECUTION_ADAPTER_ID,
    evidenceKey: 'preview.cn.app.harmony.landscape.launch',
    sessionEvidenceKey: 'preview.cn.app.harmony.landscape',
    host: previewSession.host,
    channel: 'app.harmony',
    orientation: 'landscape',
    previewUrl: 'http://127.0.0.1:4173/app',
    command: 'pnpm dev --host 127.0.0.1 --port 4173',
    cwd: '/workspace/demo-project',
    profileId: 'powershell',
    projectId: 'project-1',
    runConfigurationId: 'preview-dev',
    launchedAt: 42,
  },
);

const blockedLaunch = await resolveStudioPreviewExecutionLaunch(
  previewSession,
  {
    id: 'preview-codex',
    name: 'Preview via Codex',
    command: 'pnpm dev --host 127.0.0.1 --port 4173',
    profileId: 'codex',
    group: 'dev',
    cwdMode: 'workspace',
    customCwd: '',
  },
  {
    projectId: 'project-1',
    projectDirectory: '/workspace/demo-project',
    workspaceDirectory: '/workspace',
    timestamp: 99,
    cliAvailabilityByProfileId: {
      codex: {
        profileId: 'codex',
        executable: 'codex',
        aliases: ['codex', 'openai-codex'],
        installHint: 'Install Codex CLI and ensure the codex command is on PATH.',
        status: 'missing',
        resolvedExecutable: null,
        checkedAt: 99,
        detectedVia: 'tauri',
      },
    },
  },
);

assert.equal(blockedLaunch.request, null);
assert.deepEqual(blockedLaunch.launchPresentation, {
  canLaunch: false,
  reason: 'Install Codex CLI and ensure the codex command is on PATH.',
  statusLabel: 'Install',
  detailLabel: 'Install Codex CLI and ensure the codex command is on PATH.',
});
assert.deepEqual(blockedLaunch.blockedAction, {
  actionId: 'open-settings',
  actionLabel: 'Open Settings',
});

const previewRuntimeSource = readFileSync(
  new URL('../packages/sdkwork-birdcoder-studio/src/preview/runtime.ts', import.meta.url),
  'utf8',
);
assert.match(
  previewRuntimeSource,
  /\.\.\/\.\.\/\.\.\/sdkwork-birdcoder-host-studio\/src\/index\.ts/,
);

const studioPageSource = readFileSync(
  new URL('../packages/sdkwork-birdcoder-studio/src/pages/StudioPage.tsx', import.meta.url),
  'utf8',
);
assert.equal(
  studioPageSource.includes('resolveStudioPreviewExecutionLaunch('),
  true,
  'StudioPage should use the shared preview execution launch contract.',
);

console.log('studio preview execution contract passed.');
