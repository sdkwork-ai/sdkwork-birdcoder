import assert from 'node:assert/strict';

import {
  buildRunConfigurationStorageKey,
  getDefaultRunConfigurations,
  normalizeRunConfigurations,
  resolveRunConfigurationDirectory,
} from '../packages/sdkwork-birdcoder-commons/src/terminal/runConfigs.ts';

assert.equal(buildRunConfigurationStorageKey('project-1'), 'run-configs.project-1.v1');
assert.equal(buildRunConfigurationStorageKey(null), 'run-configs.global.v1');

assert.deepEqual(
  getDefaultRunConfigurations().map((config) => ({
    id: config.id,
    command: config.command,
    profileId: config.profileId,
    group: config.group,
  })),
  [
    { id: 'dev', command: 'npm run dev', profileId: 'powershell', group: 'dev' },
    { id: 'build', command: 'npm run build', profileId: 'powershell', group: 'build' },
    { id: 'test', command: 'npm test', profileId: 'powershell', group: 'test' },
  ],
);

assert.deepEqual(
  normalizeRunConfigurations([
    { id: 'x', name: 'Custom Dev', command: 'pnpm dev', profileId: 'claude-code', group: 'dev', cwdMode: 'project' },
    { id: '', name: '', command: '', profileId: 'oops', group: 'unknown', cwdMode: 'bad' },
  ]).map((config) => ({
    id: config.id,
    name: config.name,
    command: config.command,
    profileId: config.profileId,
    group: config.group,
    cwdMode: config.cwdMode,
  })),
  [
    { id: 'x', name: 'Custom Dev', command: 'pnpm dev', profileId: 'claude-code', group: 'dev', cwdMode: 'project' },
    {
      id: 'config-2',
      name: 'Run Task',
      command: 'echo Configure this run command first.',
      profileId: 'powershell',
      group: 'custom',
      cwdMode: 'project',
    },
  ],
);

assert.equal(
  resolveRunConfigurationDirectory(
    { id: 'x', name: 'Preview', command: 'pnpm dev', profileId: 'powershell', group: 'dev', cwdMode: 'custom', customCwd: 'D:\\preview' },
    'D:\\project',
    'D:\\workspace',
  ),
  'D:\\preview',
);

assert.equal(
  resolveRunConfigurationDirectory(
    { id: 'x', name: 'Preview', command: 'pnpm dev', profileId: 'powershell', group: 'dev', cwdMode: 'workspace', customCwd: '' },
    'D:\\project',
    'D:\\workspace',
  ),
  'D:\\workspace',
);

console.log('run configuration contract passed.');
