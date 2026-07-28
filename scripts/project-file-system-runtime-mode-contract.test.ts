import assert from 'node:assert/strict';

import type { IFileSystemService } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/interfaces/IFileSystemService.ts';
import {
  createProjectFileSystemService,
  resolveProjectFileSystemProvider,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/projectFileSystemServiceFactory.ts';
import {
  resolveBirdCoderRuntimeTopology,
  type ResolveBirdCoderRuntimeTopologyOptions,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/runtimeTopology.ts';

interface RuntimeModeCase {
  expectedProvider: 'device-mount' | 'drive-sandbox';
  label: string;
  topology: ResolveBirdCoderRuntimeTopologyOptions;
}

const runtimeModeCases: RuntimeModeCase[] = [
  {
    expectedProvider: 'drive-sandbox',
    label: 'remote Browser cloud',
    topology: { deploymentProfile: 'cloud', runtimeTarget: 'browser' },
  },
  {
    expectedProvider: 'drive-sandbox',
    label: 'Browser standalone API host',
    topology: { deploymentProfile: 'standalone', runtimeTarget: 'browser' },
  },
  {
    expectedProvider: 'device-mount',
    label: 'local Tauri standalone',
    topology: { deploymentProfile: 'standalone', runtimeTarget: 'desktop' },
  },
  {
    expectedProvider: 'drive-sandbox',
    label: 'remote Tauri cloud',
    topology: { deploymentProfile: 'cloud', runtimeTarget: 'desktop' },
  },
  {
    expectedProvider: 'device-mount',
    label: 'explicit Browser device mount',
    topology: {
      deploymentProfile: 'standalone',
      executionLocation: 'local-host',
      runtimeTarget: 'browser',
    },
  },
  {
    expectedProvider: 'drive-sandbox',
    label: 'explicit desktop remote authority',
    topology: {
      deploymentProfile: 'standalone',
      executionLocation: 'cloud-workspace',
      runtimeTarget: 'desktop',
    },
  },
];

for (const testCase of runtimeModeCases) {
  const topology = resolveBirdCoderRuntimeTopology(testCase.topology);
  const provider = resolveProjectFileSystemProvider(topology.executionLocation);
  assert.equal(provider, testCase.expectedProvider, testCase.label);

  let localCreations = 0;
  let remoteCreations = 0;
  const localFileSystem = { mode: 'local' } as unknown as IFileSystemService;
  const remoteFileSystem = { mode: 'remote' } as unknown as IFileSystemService;
  const service = createProjectFileSystemService({
    createLocalFileSystem: () => {
      localCreations += 1;
      return localFileSystem;
    },
    createRemoteFileSystem: () => {
      remoteCreations += 1;
      return remoteFileSystem;
    },
    executionLocation: topology.executionLocation,
  });

  assert.equal(service, provider === 'device-mount' ? localFileSystem : remoteFileSystem);
  assert.equal(localCreations, provider === 'device-mount' ? 1 : 0);
  assert.equal(remoteCreations, provider === 'drive-sandbox' ? 1 : 0);
}

console.log('project file-system runtime mode contract passed.');
