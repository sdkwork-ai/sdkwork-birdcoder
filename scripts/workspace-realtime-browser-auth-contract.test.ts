import assert from 'node:assert/strict';

const authenticationModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/workspaceRealtimeAuthentication.ts',
  import.meta.url,
);
const sseTransportModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/workspaceRealtimeSseTransport.ts',
  import.meta.url,
);

const {
  createWorkspaceRealtimeWebSocketProtocols,
  resolveWorkspaceRealtimeDualTokenCredentials,
} = await import(authenticationModulePath.href);
const {
  BoundedWorkspaceRealtimeSseParser,
  createWorkspaceRealtimeSseTransport,
} = await import(sseTransportModulePath.href);

const completeHeaders = () => ({
  'Access-Token': 'access-token-contract',
  Authorization: 'Bearer auth-token-contract',
});

assert.deepEqual(
  resolveWorkspaceRealtimeDualTokenCredentials(completeHeaders),
  {
    accessToken: 'access-token-contract',
    authToken: 'auth-token-contract',
    authorization: 'Bearer auth-token-contract',
  },
);
for (const incompleteHeaders of [
  () => ({}),
  () => ({ Authorization: 'Bearer auth-only' }),
  () => ({ 'Access-Token': 'access-only' }),
  () => ({ 'Access-Token': 'access', Authorization: 'Basic auth' }),
]) {
  assert.equal(
    resolveWorkspaceRealtimeDualTokenCredentials(incompleteHeaders),
    null,
    'dual-token credentials must fail closed when either canonical header is absent or malformed.',
  );
}

const protocols = createWorkspaceRealtimeWebSocketProtocols(completeHeaders);
assert.equal(protocols[0], 'sdkwork-realtime-v1');
assert.equal(protocols.length, 3);
assert.match(protocols[1] ?? '', /^sdkwork-realtime-auth-v1\.[A-Za-z0-9_-]+$/u);
assert.match(protocols[2] ?? '', /^sdkwork-realtime-access-v1\.[A-Za-z0-9_-]+$/u);
assert.equal(protocols.join(',').includes('auth-token-contract'), false);
assert.throws(
  () =>
    createWorkspaceRealtimeWebSocketProtocols(() => ({
      'Access-Token': 'a'.repeat(6_145),
      Authorization: 'Bearer auth-token-contract',
    })),
  /complete authenticated|transport limit/u,
);

const parsedEvents: Array<{ data: string; event: string; lastEventId: string }> = [];
const parser = new BoundedWorkspaceRealtimeSseParser((event) => {
  parsedEvents.push(event);
});
const encoder = new TextEncoder();
for (const chunk of [
  '\ufeff: heartbeat\r',
  '\nid: durable-7\r\nretry: 2500\r\nevent: eve',
  'nt\r\ndata: {"line":1,\r\ndata: "line":2}\r\n\r\n',
]) {
  parser.push(encoder.encode(chunk));
}
assert.deepEqual(parsedEvents, [
  {
    data: '{"line":1,\n"line":2}',
    event: 'event',
    lastEventId: 'durable-7',
  },
]);
assert.equal(parser.reconnectionTimeMs, 2_500);
parser.finish();

const lineLimitedParser = new BoundedWorkspaceRealtimeSseParser(() => undefined, {
  maxBufferBytes: 32,
  maxEventBytes: 32,
  maxLineBytes: 8,
});
assert.throws(
  () => lineLimitedParser.push(encoder.encode('data: 123456789\n')),
  /line exceeded/u,
);

const eventLimitedParser = new BoundedWorkspaceRealtimeSseParser(() => undefined, {
  maxBufferBytes: 64,
  maxEventBytes: 8,
  maxLineBytes: 64,
});
assert.throws(
  () => eventLimitedParser.push(encoder.encode('data: 12345678\n')),
  /event exceeded/u,
);

const bufferLimitedParser = new BoundedWorkspaceRealtimeSseParser(() => undefined, {
  maxBufferBytes: 4,
  maxEventBytes: 64,
  maxLineBytes: 64,
});
assert.throws(
  () => bufferLimitedParser.push(encoder.encode('12345')),
  /buffer exceeded/u,
);

const lineCountLimitedParser = new BoundedWorkspaceRealtimeSseParser(
  () => undefined,
  {
    maxBufferBytes: 64,
    maxEventBytes: 64,
    maxEventLines: 2,
    maxLineBytes: 64,
  },
);
assert.throws(
  () =>
    lineCountLimitedParser.push(
      encoder.encode('data:\ndata:\ndata:\n'),
    ),
  /line count exceeded/u,
);

const residualEvents: unknown[] = [];
const residualParser = new BoundedWorkspaceRealtimeSseParser((event) => {
  residualEvents.push(event);
});
residualParser.push(encoder.encode('event: event\ndata: partial'));
assert.throws(() => residualParser.finish(), /incomplete event frame/u);
assert.deepEqual(residualEvents, [], 'EOF must not dispatch a residual SSE frame.');

const transportEvents: string[] = [];
const transportErrors: Error[] = [];
let capturedInit: RequestInit | undefined;
let capturedUrl = '';
const responseChunks = [
  encoder.encode('event: ready\r\ndata: {"kind":"ready"}\r\n\r\n'),
  encoder.encode('event: event\ndata: {"kind":"event",\n'),
  encoder.encode('data: "value":1}\n\n'),
];
const transport = createWorkspaceRealtimeSseTransport({
  fetchImpl: (async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedUrl = String(input);
    capturedInit = init;
    return new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          for (const chunk of responseChunks) {
            controller.enqueue(chunk);
          }
          controller.close();
        },
      }),
      {
        headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
        status: 200,
      },
    );
  }) as typeof fetch,
  onError(error) {
    transportErrors.push(error);
  },
  onEvent(event) {
    transportEvents.push(event.data);
  },
  resolveHeaders: completeHeaders,
  url: 'https://realtime.example.test/app/v3/api/workspaces/w-1/realtime?transport=sse',
});
await new Promise((resolve) => setTimeout(resolve, 10));
assert.equal(capturedUrl.includes('auth-token-contract'), false);
assert.equal(capturedUrl.includes('access-token-contract'), false);
const capturedHeaders = new Headers(capturedInit?.headers);
assert.equal(capturedHeaders.get('Authorization'), 'Bearer auth-token-contract');
assert.equal(capturedHeaders.get('Access-Token'), 'access-token-contract');
assert.deepEqual(transportEvents, [
  '{"kind":"ready"}',
  '{"kind":"event",\n"value":1}',
]);
assert.match(transportErrors[0]?.message ?? '', /ended unexpectedly/u);
transport.close();

let abortSignal: AbortSignal | undefined;
let resolveOpened: (() => void) | undefined;
const opened = new Promise<void>((resolve) => {
  resolveOpened = resolve;
});
const abortTransport = createWorkspaceRealtimeSseTransport({
  fetchImpl: (async (_input: RequestInfo | URL, init?: RequestInit) => {
    abortSignal = init?.signal ?? undefined;
    return new Response(new ReadableStream<Uint8Array>(), {
      headers: { 'Content-Type': 'text/event-stream' },
      status: 200,
    });
  }) as typeof fetch,
  onError(error) {
    assert.fail(`explicit abort must not report an error: ${error.message}`);
  },
  onEvent() {},
  onOpen() {
    resolveOpened?.();
  },
  resolveHeaders: completeHeaders,
  url: 'https://realtime.example.test/app/v3/api/workspaces/w-1/realtime?transport=sse',
});
await opened;
abortTransport.close();
assert.equal(abortSignal?.aborted, true);

for (const response of [
  new Response(JSON.stringify({
    code: 40101,
    detail: 'The authenticated session is no longer valid.',
    traceId: 'trace-realtime-401',
  }), {
    headers: { 'Content-Type': 'application/problem+json' },
    status: 401,
  }),
  new Response('not an event stream', {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  }),
]) {
  const errors: Error[] = [];
  const failedTransport = createWorkspaceRealtimeSseTransport({
    fetchImpl: (async () => response) as typeof fetch,
    onError(error) {
      errors.push(error);
    },
    onEvent() {},
    resolveHeaders: completeHeaders,
    url: 'https://realtime.example.test/app/v3/api/workspaces/w-1/realtime?transport=sse',
  });
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(errors.length, 1);
  if (response.status === 401) {
    assert.equal((errors[0] as Error & { code?: number }).code, 40101);
    assert.equal(
      (errors[0] as Error & { detail?: string }).detail,
      'The authenticated session is no longer valid.',
    );
    assert.equal(
      (errors[0] as Error & { traceId?: string }).traceId,
      'trace-realtime-401',
    );
  }
  failedTransport.close();
}

console.log('workspace realtime browser auth contract passed.');
