import assert from 'node:assert/strict';

import { createBirdCoderIamAppClientForSdkworkIamRuntime } from '../packages/sdkwork-birdcoder-infrastructure/src/services/iamRuntime.ts';

const calls: Array<[string, unknown, unknown?]> = [];

const generatedClient = {
  openPlatform: {
    qrAuth: {
      sessions: {
        async create(body: Record<string, unknown>) {
          calls.push(['create', body]);
          return { data: { sessionKey: 'qr-session-1', status: 'pending' } };
        },
        async retrieve(pathParams: { sessionKey: string }) {
          calls.push(['retrieve', pathParams]);
          return { data: { sessionKey: pathParams.sessionKey, status: 'pending' } };
        },
        scans: {
          async create(pathParams: { sessionKey: string }, body: Record<string, unknown>) {
            calls.push(['scans.create', pathParams, body]);
            return { data: { success: true } };
          },
        },
        passwords: {
          async create(pathParams: { sessionKey: string }, body: Record<string, unknown>) {
            calls.push(['passwords.create', pathParams, body]);
            return { data: { sessionKey: pathParams.sessionKey, status: 'confirmed' } };
          },
        },
      },
    },
  },
} as never;

const iamAppClient = createBirdCoderIamAppClientForSdkworkIamRuntime(generatedClient);

await iamAppClient.openPlatform.qrAuth.sessions.create({ purpose: 'login' });
await iamAppClient.openPlatform.qrAuth.sessions.retrieve('qr-session-1');
await iamAppClient.openPlatform.qrAuth.sessions.scans.create('qr-session-1', {
  scanSource: 'browser',
});
await iamAppClient.openPlatform.qrAuth.sessions.passwords.create('qr-session-1', {
  password: 'dev123456',
  username: 'local-default@sdkwork-iam.local',
});

assert.deepEqual(calls, [
  ['create', { purpose: 'login' }],
  ['retrieve', { sessionKey: 'qr-session-1' }],
  ['scans.create', { sessionKey: 'qr-session-1' }, { scanSource: 'browser' }],
  [
    'passwords.create',
    { sessionKey: 'qr-session-1' },
    {
      password: 'dev123456',
      username: 'local-default@sdkwork-iam.local',
    },
  ],
]);

console.log('birdcoder IAM runtime QR adapter contract passed.');
