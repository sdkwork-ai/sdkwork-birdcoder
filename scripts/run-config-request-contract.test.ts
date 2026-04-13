import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  buildRunConfigurationTerminalRequest,
  resolveRunConfigurationTerminalLaunch,
  type RunConfigurationRecord,
} from '../packages/sdkwork-birdcoder-commons/src/terminal/runConfigs.ts';

const configuration: RunConfigurationRecord = {
  id: 'lint',
  name: 'Lint Workspace',
  command: 'pnpm lint',
  profileId: 'codex',
  group: 'custom',
  cwdMode: 'workspace',
  customCwd: '',
};

const request = buildRunConfigurationTerminalRequest(configuration, {
  projectDirectory: '/workspace/demo-project',
  workspaceDirectory: '/workspace',
  timestamp: 42,
});

assert.deepEqual(request, {
  path: '/workspace',
  command: 'pnpm lint',
  profileId: 'codex',
  timestamp: 42,
});

const customRequest = buildRunConfigurationTerminalRequest(
  {
    ...configuration,
    cwdMode: 'custom',
    customCwd: '/opt/birdcoder/runtime',
  },
  {
    projectDirectory: '/workspace/demo-project',
    workspaceDirectory: '/workspace',
  },
);

assert.equal(customRequest.path, '/opt/birdcoder/runtime');
assert.equal(customRequest.command, 'pnpm lint');
assert.equal(customRequest.profileId, 'codex');
assert.equal(typeof customRequest.timestamp, 'number');

const missingCliLaunch = await resolveRunConfigurationTerminalLaunch(configuration, {
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
});

assert.equal(missingCliLaunch.request, null);
assert.deepEqual(missingCliLaunch.launchPresentation, {
  canLaunch: false,
  reason: 'Install Codex CLI and ensure the codex command is on PATH.',
  statusLabel: 'Install',
  detailLabel: 'Install Codex CLI and ensure the codex command is on PATH.',
});
assert.deepEqual(missingCliLaunch.blockedAction, {
  actionId: 'open-settings',
  actionLabel: 'Open Settings',
});

const powershellLaunch = await resolveRunConfigurationTerminalLaunch(
  {
    ...configuration,
    profileId: 'powershell',
  },
  {
    projectDirectory: '/workspace/demo-project',
    workspaceDirectory: '/workspace',
    timestamp: 100,
  },
);

assert.deepEqual(powershellLaunch.request, {
  path: '/workspace',
  command: 'pnpm lint',
  profileId: 'powershell',
  timestamp: 100,
});
assert.deepEqual(powershellLaunch.blockedAction, {
  actionId: null,
  actionLabel: null,
});

const codePageSource = await readFile(
  new URL('../packages/sdkwork-birdcoder-code/src/pages/CodePage.tsx', import.meta.url),
  'utf8',
);
const codeRunEntryHookSource = await readFile(
  new URL('../packages/sdkwork-birdcoder-code/src/pages/useCodeRunEntryActions.ts', import.meta.url),
  'utf8',
);
assert.equal(
  codePageSource.includes('resolveRunConfigurationTerminalLaunch(') ||
    codeRunEntryHookSource.includes('resolveRunConfigurationTerminalLaunch('),
  true,
  'CodePage should use the shared run configuration terminal launch guard directly or through useCodeRunEntryActions.',
);

const studioPageSource = await readFile(
  new URL('../packages/sdkwork-birdcoder-studio/src/pages/StudioPage.tsx', import.meta.url),
  'utf8',
);
assert.equal(
  studioPageSource.includes('resolveRunConfigurationTerminalLaunch('),
  true,
  'StudioPage should use the shared run configuration terminal launch guard.',
);

console.log('run config request contract passed.');
