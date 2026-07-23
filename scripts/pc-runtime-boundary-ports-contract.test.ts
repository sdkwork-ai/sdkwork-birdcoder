import assert from 'node:assert/strict';

import {
  buildBirdCoderProtectedLoginPath,
} from '@sdkwork/birdcoder-pc-contracts-commons/authSurfacePaths';
import {
  normalizeBirdCoderSdkBaseUrl,
  resolveBirdCoderApplicationSdkBaseUrl,
  resolveBirdCoderDependencySdkBaseUrl,
} from '@sdkwork/birdcoder-pc-infrastructure/services/sdkBaseUrls';
import {
  createBirdCoderDependencyAppSdkClients,
} from '@sdkwork/birdcoder-pc-infrastructure-runtime/defaultIdeServices';

assert.equal(buildBirdCoderProtectedLoginPath('app/chat'), '/auth/login?redirect=%2Fapp%2Fchat');
assert.equal(buildBirdCoderProtectedLoginPath('https://example.com'), '/auth/login');
assert.equal(buildBirdCoderProtectedLoginPath('//example.com/path'), '/auth/login');

assert.equal(normalizeBirdCoderSdkBaseUrl(undefined), undefined);
assert.equal(
  normalizeBirdCoderSdkBaseUrl('https://birdcoder.example.com/'),
  'https://birdcoder.example.com',
);
assert.equal(
  normalizeBirdCoderSdkBaseUrl('https://api.example.com/platform/'),
  'https://api.example.com/platform',
);
assert.throws(
  () => normalizeBirdCoderSdkBaseUrl('https://api.example.com/app/v3/api/'),
  /gateway root/u,
);
assert.throws(
  () => normalizeBirdCoderSdkBaseUrl('https://user:secret@api.example.com'),
  /credentials/u,
);
assert.throws(
  () => normalizeBirdCoderSdkBaseUrl('https://api.example.com?tenant=1'),
  /query string or fragment/u,
);

assert.equal(
  resolveBirdCoderApplicationSdkBaseUrl('https://birdcoder.example.com'),
  'https://birdcoder.example.com',
);
assert.equal(
  resolveBirdCoderDependencySdkBaseUrl('Documents', {
    dependencyApiBaseUrl: 'https://documents.example.com',
    platformApiGatewayBaseUrl: 'https://platform.example.com',
  }),
  'https://documents.example.com',
  'An explicit dependency override must win over the canonical platform gateway.',
);
assert.throws(
  () => resolveBirdCoderDependencySdkBaseUrl('Documents'),
  /platform.*required|Documents.*required/u,
  'A dependency SDK must not fall back to the BirdCoder application URL or a local default.',
);

const dependencyClients = createBirdCoderDependencyAppSdkClients({
  platformApiGatewayBaseUrl: 'https://platform.example.com',
});
assert.ok(dependencyClients.documentsClient);
assert.ok(dependencyClients.promptsClient);

console.log('PC runtime boundary port contract passed.');
