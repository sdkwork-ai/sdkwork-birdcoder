import assert from 'node:assert/strict';

import { sha256Hash } from '@sdkwork/utils/crypto';

import { createBirdCoderHttpApiTransport } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkTransportShared.ts';

interface CapturedRequest {
  readonly body: BodyInit | null | undefined;
  readonly headers: Record<string, string>;
  readonly method: string;
}

const capturedRequests: CapturedRequest[] = [];
const transport = createBirdCoderHttpApiTransport({
  baseUrl: 'http://127.0.0.1:10240',
  fetchImpl: async (_input, init) => {
    capturedRequests.push({
      body: init?.body,
      headers: init?.headers as Record<string, string>,
      method: init?.method ?? 'GET',
    });
    return new Response(
      JSON.stringify({
        code: 0,
        data: {
          item: {},
        },
        traceId: 'trace.http-api-transport-content-integrity-contract',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  },
});

const body = {
  name: 'project',
  nested: {
    enabled: true,
  },
};
await transport.request({
  body,
  method: 'PUT',
  path: '/app/v3/api/projects/project-1/workspace_binding',
});

const serializedBody = '{"name":"project","nested":{"enabled":true}}';
assert.equal(capturedRequests[0]?.body, serializedBody);
assert.equal(
  capturedRequests[0]?.headers['X-Content-SHA256'],
  sha256Hash(serializedBody),
  'body-bearing SDK requests must hash the exact serialized JSON string sent on the wire.',
);
assert.match(
  capturedRequests[0]?.headers['X-Content-SHA256'] ?? '',
  /^[a-f0-9]{64}$/u,
  'X-Content-SHA256 must be a lowercase SHA-256 hex digest.',
);

await transport.request({
  body: { name: 'preserved' },
  headers: {
    'x-content-sha256': 'caller-provided-content-digest',
  },
  method: 'PATCH',
  path: '/app/v3/api/projects/project-1',
});
assert.equal(
  capturedRequests[1]?.headers['x-content-sha256'],
  'caller-provided-content-digest',
);
assert.equal(
  capturedRequests[1]?.headers['X-Content-SHA256'],
  undefined,
  'transport header detection must be case-insensitive and must not duplicate caller evidence.',
);

await transport.request({
  body: { name: 'fingerprinted' },
  headers: {
    'X-Idempotency-Fingerprint': 'caller-provided-fingerprint',
  },
  method: 'POST',
  path: '/app/v3/api/projects',
});
assert.equal(
  capturedRequests[2]?.headers['X-Idempotency-Fingerprint'],
  'caller-provided-fingerprint',
);
assert.equal(
  capturedRequests[2]?.headers['X-Content-SHA256'],
  undefined,
  'an explicit SDKWork idempotency fingerprint must remain the caller-owned integrity evidence.',
);

await transport.request({
  method: 'GET',
  path: '/app/v3/api/projects/project-1',
});
assert.equal(capturedRequests[3]?.headers['X-Content-SHA256'], undefined);
assert.equal(capturedRequests[3]?.headers['X-Idempotency-Fingerprint'], undefined);
assert.equal(capturedRequests[3]?.headers['Content-Type'], undefined);

await transport.request({
  body: {
    logicalPath: 'projects/demo',
    rootEntryId: 'entry-projects-demo',
    sandboxId: 'sandbox-1',
  },
  headers: {
    'Idempotency-Key': 'workspace-binding-project-2',
  },
  method: 'PUT',
  path: '/app/v3/api/projects/project-2/workspace_binding',
});

const workspaceBindingRequest = capturedRequests[4];
assert.equal(workspaceBindingRequest?.method, 'PUT');
assert.equal(
  workspaceBindingRequest?.headers['Idempotency-Key'],
  'workspace-binding-project-2',
  'the generated workspace-binding SDK call must retain its command idempotency key.',
);
assert.equal(
  workspaceBindingRequest?.headers['X-Content-SHA256'],
  sha256Hash(String(workspaceBindingRequest?.body)),
  'the generated workspace-binding SDK call must carry body-integrity evidence.',
);

console.log('http api transport content integrity contract passed.');
