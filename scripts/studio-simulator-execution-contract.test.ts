import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import { resolveHostStudioSimulatorSession } from '../packages/sdkwork-birdcoder-host-studio/src/index.ts';

const runtimeModulePath = new URL(
  '../packages/sdkwork-birdcoder-studio/src/simulator/runtime.ts',
  import.meta.url,
);

assert.equal(
  existsSync(runtimeModulePath),
  true,
  'Studio simulator execution runtime must exist.',
);

const {
  STUDIO_SIMULATOR_EXECUTION_ADAPTER_ID,
  buildStudioSimulatorExecutionEvidence,
  resolveStudioSimulatorExecutionLaunch,
} = await import('../packages/sdkwork-birdcoder-studio/src/simulator/runtime.ts');

const simulatorSession = resolveHostStudioSimulatorSession(
  {
    platform: 'app',
    appPlatform: 'harmony',
    deviceModel: 'mate-60',
    isLandscape: true,
  },
  'cn',
);

const launch = await resolveStudioSimulatorExecutionLaunch(
  simulatorSession,
  {
    id: 'simulate-harmony',
    name: 'Simulate Harmony App',
    command: 'pnpm simulate:harmony',
    profileId: 'powershell',
    group: 'dev',
    cwdMode: 'project',
    customCwd: '',
  },
  {
    projectId: 'project-1',
    projectDirectory: '/workspace/demo-project',
    workspaceDirectory: '/workspace',
    timestamp: 81,
  },
);

assert.deepEqual(launch.request, {
  adapterId: STUDIO_SIMULATOR_EXECUTION_ADAPTER_ID,
  runConfigurationId: 'simulate-harmony',
  session: simulatorSession,
  terminalRequest: {
    surface: 'embedded',
    path: '/workspace/demo-project',
    command: 'pnpm simulate:harmony',
    profileId: 'powershell',
    timestamp: 81,
  },
  evidence: {
    adapterId: STUDIO_SIMULATOR_EXECUTION_ADAPTER_ID,
    evidenceKey: 'simulator.cn.app.harmony.harmony-emulator.landscape.launch',
    sessionEvidenceKey: 'simulator.cn.app.harmony.harmony-emulator.landscape',
    host: simulatorSession.host,
    channel: 'app.harmony',
    runtime: 'harmony-emulator',
    orientation: 'landscape',
    command: 'pnpm simulate:harmony',
    cwd: '/workspace/demo-project',
    profileId: 'powershell',
    projectId: 'project-1',
    runConfigurationId: 'simulate-harmony',
    launchedAt: 81,
  },
});

assert.deepEqual(
  buildStudioSimulatorExecutionEvidence(
    simulatorSession,
    {
      surface: 'embedded',
      path: '/workspace/demo-project',
      command: 'pnpm simulate:harmony',
      profileId: 'powershell',
      timestamp: 81,
    },
    {
      projectId: 'project-1',
      runConfigurationId: 'simulate-harmony',
    },
  ),
  {
    adapterId: STUDIO_SIMULATOR_EXECUTION_ADAPTER_ID,
    evidenceKey: 'simulator.cn.app.harmony.harmony-emulator.landscape.launch',
    sessionEvidenceKey: 'simulator.cn.app.harmony.harmony-emulator.landscape',
    host: simulatorSession.host,
    channel: 'app.harmony',
    runtime: 'harmony-emulator',
    orientation: 'landscape',
    command: 'pnpm simulate:harmony',
    cwd: '/workspace/demo-project',
    profileId: 'powershell',
    projectId: 'project-1',
    runConfigurationId: 'simulate-harmony',
    launchedAt: 81,
  },
);

const blockedLaunch = await resolveStudioSimulatorExecutionLaunch(
  simulatorSession,
  {
    id: 'simulate-codex',
    name: 'Simulate via Codex',
    command: 'pnpm simulate:harmony',
    profileId: 'codex',
    group: 'dev',
    cwdMode: 'workspace',
    customCwd: '',
  },
  {
    projectId: 'project-1',
    projectDirectory: '/workspace/demo-project',
    workspaceDirectory: '/workspace',
    timestamp: 82,
    cliAvailabilityByProfileId: {
      codex: {
        profileId: 'codex',
        executable: 'codex',
        aliases: ['codex', 'openai-codex'],
        installHint: 'Install Codex CLI and ensure the codex command is on PATH.',
        status: 'missing',
        resolvedExecutable: null,
        checkedAt: 82,
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

const studioIndexSource = readFileSync(
  new URL('../packages/sdkwork-birdcoder-studio/src/index.ts', import.meta.url),
  'utf8',
);
assert.equal(
  studioIndexSource.includes("export * from './simulator/runtime';"),
  true,
  'Studio package should export simulator runtime contracts.',
);

console.log('studio simulator execution contract passed.');
