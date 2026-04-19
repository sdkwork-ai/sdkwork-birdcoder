import assert from 'node:assert/strict';
import type { BirdCoderAppAdminApiClient, BirdCoderReleaseSummary } from '@sdkwork/birdcoder-types';
import { createDefaultBirdCoderIdeServices } from '../packages/sdkwork-birdcoder-infrastructure/src/services/defaultIdeServices.ts';
import { createAppAdminClientContractStub } from './app-admin-client-contract-stub.ts';

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

const appAdminClient: BirdCoderAppAdminApiClient = createAppAdminClientContractStub({
  async listReleases() {
    listReleasesCalls += 1;
    return releaseFixtures;
  },
});

const services = createDefaultBirdCoderIdeServices({
  appAdminClient,
});

const releases = await services.releaseService.getReleases();

assert.deepEqual(
  releases,
  releaseFixtures,
  'default IDE services must expose release reads through the shared app/admin facade.',
);

assert.equal(
  listReleasesCalls,
  1,
  'releaseService must delegate exactly one read to BirdCoderAppAdminApiClient.listReleases().',
);

console.log('default IDE services release service contract passed.');
