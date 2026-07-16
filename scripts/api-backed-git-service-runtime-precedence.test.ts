import assert from 'node:assert/strict';
import type { BirdCoderProjectGitOverview } from '@sdkwork/birdcoder-pc-types';
import {
  BrowserDeploymentWorkspaceUnavailableError,
  type BrowserDeploymentWorkspaceRuntime,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/platform/browserDeploymentWorkspaceRuntime.ts';
import {
  TauriProjectGitRuntimeUnavailableError,
  type TauriProjectGitRuntime,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/platform/tauriProjectGitRuntime.ts';
import { ApiBackedGitService } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/impl/ApiBackedGitService.ts';
import { ProjectRuntimeLocationExecutionUnavailableError } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/interfaces/IProjectRuntimeLocationService.ts';
import type { BirdCoderAppSdkApiClient } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts';

const projectId = 'runtime-precedence-project';
const runtimeLocationId = 'runtime-location-runtime-precedence';
const overview = {
  aheadCount: 0,
  behindCount: 0,
  branches: [],
  changedFiles: [],
  currentBranch: 'main',
  currentRevision: '0123456789abcdef',
  remotes: [],
  status: 'ready',
  worktrees: [],
} satisfies BirdCoderProjectGitOverview;

function createRuntime<T extends object>(
  getProjectGitOverview: (
    nextProjectId: string,
    nextRuntimeLocationId?: string,
  ) => Promise<BirdCoderProjectGitOverview>,
): T {
  return new Proxy({}, {
    get: (_target, property) => {
      if (property === 'getProjectGitOverview') {
        return getProjectGitOverview;
      }
      return async () => overview;
    },
  }) as T;
}

let appSdkCalls = 0;
const appClient = createRuntime<BirdCoderAppSdkApiClient>(async (
  nextProjectId,
  nextRuntimeLocationId,
) => {
  appSdkCalls += 1;
  assert.equal(nextProjectId, projectId);
  assert.equal(nextRuntimeLocationId, runtimeLocationId);
  return overview;
});
const browserUnavailable = createRuntime<BrowserDeploymentWorkspaceRuntime>(async () => {
  throw new BrowserDeploymentWorkspaceUnavailableError();
});

let tauriCalls = 0;
const mountedTauriRuntime = createRuntime<TauriProjectGitRuntime>(async (nextProjectId) => {
  tauriCalls += 1;
  assert.equal(nextProjectId, projectId);
  return overview;
});
const mountedService = new ApiBackedGitService({
  appClient,
  browserDeploymentRuntime: browserUnavailable,
  tauriProjectGitRuntime: mountedTauriRuntime,
});
assert.equal(await mountedService.getProjectGitOverview(projectId), overview);
assert.equal(tauriCalls, 1);
assert.equal(appSdkCalls, 0, 'A mounted Tauri project must not fall through to the App SDK.');

const tauriUnavailable = createRuntime<TauriProjectGitRuntime>(async () => {
  throw new TauriProjectGitRuntimeUnavailableError();
});
const missingResolverService = new ApiBackedGitService({
  appClient,
  browserDeploymentRuntime: browserUnavailable,
  tauriProjectGitRuntime: tauriUnavailable,
});
await assert.rejects(
  missingResolverService.getProjectGitOverview(projectId),
  /runtime-location resolver is required/u,
);
assert.equal(
  appSdkCalls,
  0,
  'Remote Git must fail before calling the App SDK when no authoritative runtime-location resolver is available.',
);

const pendingRuntimeLocationService = new ApiBackedGitService({
  appClient,
  browserDeploymentRuntime: browserUnavailable,
  resolveProjectRuntimeLocation: async (nextProjectId) => ({
    location: {
      localWorkingDirectory: 'C:\\workspace\\pending-runtime-location',
      projectId: nextProjectId,
      remoteSynchronization: 'pending',
      source: 'active_mount',
    },
    status: 'resolved',
  }),
  tauriProjectGitRuntime: tauriUnavailable,
});
await assert.rejects(
  pendingRuntimeLocationService.getProjectGitOverview(projectId),
  (error: unknown) =>
    error instanceof ProjectRuntimeLocationExecutionUnavailableError &&
    error.code === 'missing_runtime_location_id' &&
    error.projectId === projectId,
);
assert.equal(
  appSdkCalls,
  0,
  'A local-only or pending runtime location must never be substituted for a registered remote identifier.',
);

const fallbackService = new ApiBackedGitService({
  appClient,
  browserDeploymentRuntime: browserUnavailable,
  resolveProjectRuntimeLocation: async (nextProjectId) => ({
    location: {
      localWorkingDirectory: 'C:\\workspace\\registered-runtime-location',
      projectId: nextProjectId,
      remoteSynchronization: 'registered',
      runtimeLocationId,
      source: 'active_mount',
    },
    status: 'resolved',
  }),
  tauriProjectGitRuntime: tauriUnavailable,
});
assert.equal(await fallbackService.getProjectGitOverview(projectId), overview);
assert.equal(
  appSdkCalls,
  1,
  'The App SDK is used only when both local runtimes are unavailable and a registered runtime location resolves.',
);

const nativeGitFailure = new Error('native checkout conflict');
const failingTauriRuntime = createRuntime<TauriProjectGitRuntime>(async () => {
  throw nativeGitFailure;
});
const failingNativeService = new ApiBackedGitService({
  appClient,
  browserDeploymentRuntime: browserUnavailable,
  tauriProjectGitRuntime: failingTauriRuntime,
});
await assert.rejects(failingNativeService.getProjectGitOverview(projectId), nativeGitFailure);
assert.equal(
  appSdkCalls,
  1,
  'A real native Git failure must surface instead of mutating an unrelated gateway directory.',
);

const browserGitFailure = new Error('browser host rejected repository');
const failingBrowserRuntime = createRuntime<BrowserDeploymentWorkspaceRuntime>(async () => {
  throw browserGitFailure;
});
const blockedTauriRuntime = createRuntime<TauriProjectGitRuntime>(async () => {
  assert.fail('Tauri must not run after an available Browser Host reports a real Git failure.');
});
const failingBrowserService = new ApiBackedGitService({
  appClient,
  browserDeploymentRuntime: failingBrowserRuntime,
  tauriProjectGitRuntime: blockedTauriRuntime,
});
await assert.rejects(failingBrowserService.getProjectGitOverview(projectId), browserGitFailure);
assert.equal(appSdkCalls, 1);

console.log('API-backed Git runtime precedence contract passed.');
