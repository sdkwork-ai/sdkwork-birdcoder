import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const runtimeModulePath = new URL(
  '../packages/sdkwork-birdcoder-studio/src/test/runtime.ts',
  import.meta.url,
);

assert.equal(
  existsSync(runtimeModulePath),
  true,
  'Studio test execution runtime must exist.',
);

const {
  STUDIO_TEST_EXECUTION_ADAPTER_ID,
  buildStudioTestExecutionEvidence,
  resolveStudioTestExecutionLaunch,
} = await import('../packages/sdkwork-birdcoder-studio/src/test/runtime.ts');

const launch = await resolveStudioTestExecutionLaunch(
  {
    id: 'test',
    name: 'Run Tests',
    command: 'npm test',
    profileId: 'powershell',
    group: 'test',
    cwdMode: 'project',
    customCwd: '',
  },
  {
    projectId: 'project-1',
    projectDirectory: '/workspace/demo-project',
    workspaceDirectory: '/workspace',
    timestamp: 91,
  },
);

assert.deepEqual(launch.request, {
  adapterId: STUDIO_TEST_EXECUTION_ADAPTER_ID,
  runConfigurationId: 'test',
  terminalRequest: {
    surface: 'embedded',
    path: '/workspace/demo-project',
    command: 'npm test',
    profileId: 'powershell',
    timestamp: 91,
  },
  evidence: {
    adapterId: STUDIO_TEST_EXECUTION_ADAPTER_ID,
    evidenceKey: 'test.test.launch',
    command: 'npm test',
    cwd: '/workspace/demo-project',
    profileId: 'powershell',
    projectId: 'project-1',
    runConfigurationId: 'test',
    launchedAt: 91,
  },
});

assert.deepEqual(
  buildStudioTestExecutionEvidence(
    {
      surface: 'embedded',
      path: '/workspace/demo-project',
      command: 'npm test',
      profileId: 'powershell',
      timestamp: 91,
    },
    {
      projectId: 'project-1',
      runConfigurationId: 'test',
    },
  ),
  {
    adapterId: STUDIO_TEST_EXECUTION_ADAPTER_ID,
    evidenceKey: 'test.test.launch',
    command: 'npm test',
    cwd: '/workspace/demo-project',
    profileId: 'powershell',
    projectId: 'project-1',
    runConfigurationId: 'test',
    launchedAt: 91,
  },
);

const blockedLaunch = await resolveStudioTestExecutionLaunch(
  {
    id: 'test-codex',
    name: 'Run Tests via Codex',
    command: 'npm test',
    profileId: 'codex',
    group: 'test',
    cwdMode: 'workspace',
    customCwd: '',
  },
  {
    projectId: 'project-1',
    projectDirectory: '/workspace/demo-project',
    workspaceDirectory: '/workspace',
    timestamp: 92,
    cliAvailabilityByProfileId: {
      codex: {
        profileId: 'codex',
        executable: 'codex',
        aliases: ['codex', 'openai-codex'],
        installHint: 'Install Codex CLI and ensure the codex command is on PATH.',
        status: 'missing',
        resolvedExecutable: null,
        checkedAt: 92,
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

const studioPageSource = readFileSync(
  new URL('../packages/sdkwork-birdcoder-studio/src/pages/StudioPage.tsx', import.meta.url),
  'utf8',
);
const studioExecutionHookSource = readFileSync(
  new URL('../packages/sdkwork-birdcoder-studio/src/pages/useStudioExecutionActions.ts', import.meta.url),
  'utf8',
);
assert.equal(
  studioPageSource.includes("from './useStudioExecutionActions';"),
  true,
  'StudioPage should delegate test execution wiring through the shared studio execution hook.',
);
assert.equal(
  studioExecutionHookSource.includes('resolveStudioTestExecutionLaunch('),
  true,
  'Studio execution hook should use the shared studio test execution launch contract.',
);

console.log('studio test execution contract passed.');
