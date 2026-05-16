import type { BirdCoderBackendSdkApiClient } from '../packages/sdkwork-birdcoder-infrastructure/src/services/sdkClients.ts';
import assert from 'node:assert/strict';
import type { BirdCoderReleaseSummary } from '@sdkwork/birdcoder-types';
import { createDefaultBirdCoderIdeServices } from '../packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts';
import { createBackendSdkClientContractStub } from './split-sdk-client-contract-stub.ts';

const releaseFixtures: BirdCoderReleaseSummary[] = [
  {
    id: 'release-contract-1',
    releaseVersion: '0.3.0-contract',
    releaseKind: 'formal',
    rolloutStage: 'production',
    status: 'ready',
  },
];

let listReleasesCalls = 0;

const backendClient: BirdCoderBackendSdkApiClient = createBackendSdkClientContractStub({
  async listReleases() {
    listReleasesCalls += 1;
    return releaseFixtures;
  },
});

const services = createDefaultBirdCoderIdeServices({
  backendClient,
});

const releases = await services.releaseService.getReleases();

assert.deepEqual(
  releases,
  releaseFixtures,
  'default IDE services must expose release reads through the backend SDK client.',
);

assert.equal(
  listReleasesCalls,
  1,
  'releaseService must delegate exactly one read to BirdCoderBackendSdkApiClient.listReleases().',
);

console.log('default IDE services release service contract passed.');
