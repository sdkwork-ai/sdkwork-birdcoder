import assert from 'node:assert/strict';

const workspaceRealtimeClientModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/workspaceRealtimeClient.ts',
  import.meta.url,
);
const defaultIdeServicesRuntimeModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/defaultIdeServicesRuntime.ts',
  import.meta.url,
);
const runtimeServerSessionModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/runtimeServerSession.ts',
  import.meta.url,
);

const originalWebSocketDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'WebSocket');

class ContractWebSocket {
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static readonly urls: string[] = [];

  readonly readyState = 1;
  readonly url: string;

  constructor(url: string) {
    this.url = url;
    ContractWebSocket.urls.push(url);
  }

  addEventListener() {}

  close() {}
}

Object.defineProperty(globalThis, 'WebSocket', {
  configurable: true,
  value: ContractWebSocket,
});

try {
  const {
    canSubscribeBirdCoderWorkspaceRealtime,
    subscribeBirdCoderWorkspaceRealtime,
  } = await import(workspaceRealtimeClientModulePath.href);
  const {
    configureDefaultBirdCoderIdeServicesRuntime,
  } = await import(defaultIdeServicesRuntimeModulePath.href);
  const {
    clearRuntimeServerSessionId,
    readRuntimeServerSessionId,
    writeRuntimeServerTokenBundle,
    writeRuntimeServerSessionId,
  } = await import(`${runtimeServerSessionModulePath.href}?t=${Date.now()}`);

  configureDefaultBirdCoderIdeServicesRuntime({
    apiBaseUrl: 'not a url',
    executionAuthorityMode: 'remote-required',
  });
  writeRuntimeServerTokenBundle({
    accessToken: 'runtime-access-token-contract',
    authToken: 'runtime-auth-token-contract',
    sessionToken: 'runtime-session-contract',
  });

  assert.equal(
    canSubscribeBirdCoderWorkspaceRealtime(),
    false,
    'workspace realtime availability must reject malformed API base URLs instead of reporting a subscribable channel.',
  );
  assert.doesNotThrow(
    () =>
      subscribeBirdCoderWorkspaceRealtime({
        workspaceId: 'workspace-realtime-contract',
        onEvent() {},
      }),
    'workspace realtime subscription must not throw when runtime API base URL configuration is malformed.',
  );
  assert.equal(
    subscribeBirdCoderWorkspaceRealtime({
      workspaceId: 'workspace-realtime-contract',
      onEvent() {},
    }),
    null,
    'workspace realtime subscription must safely fall back to null when runtime API base URL configuration is malformed.',
  );

  clearRuntimeServerSessionId();
  ContractWebSocket.urls.length = 0;
  configureDefaultBirdCoderIdeServicesRuntime({
    apiBaseUrl: 'https://realtime.example.test',
    executionAuthorityMode: 'remote-required',
  });
  writeRuntimeServerTokenBundle({
    accessToken: 'access-token-without-session',
    authToken: 'auth-token-without-session',
  });

  assert.equal(
    readRuntimeServerSessionId(),
    null,
    'a runtime auth/access token bundle without an IAM session id must not synthesize a WebSocket session id.',
  );
  assert.equal(
    canSubscribeBirdCoderWorkspaceRealtime(),
    false,
    'workspace realtime must fail closed when the authenticated token bundle does not include a real IAM session id.',
  );
  assert.equal(
    subscribeBirdCoderWorkspaceRealtime({
      workspaceId: 'workspace-without-iam-session',
      onEvent() {},
    }),
    null,
    'workspace realtime must not create a socket from an auth/access token fallback.',
  );
  assert.deepEqual(
    ContractWebSocket.urls,
    [],
    'workspace realtime must never serialize auth/access tokens into a WebSocket URL.',
  );

  clearRuntimeServerSessionId();
  writeRuntimeServerTokenBundle({
    accessToken: 'access-token-with-iam-session',
    authToken: 'auth-token-with-iam-session',
    sessionToken: 'iam-session-for-realtime',
  });
  const subscription = subscribeBirdCoderWorkspaceRealtime({
    workspaceId: 'workspace-with-iam-session',
    onEvent() {},
  });
  assert.notEqual(subscription, null, 'a real IAM session id must permit workspace realtime.');
  const realtimeUrl = new URL(ContractWebSocket.urls.at(-1));
  assert.equal(realtimeUrl.searchParams.get('sessionId'), 'iam-session-for-realtime');
  assert.equal(realtimeUrl.searchParams.has('authToken'), false);
  assert.equal(realtimeUrl.searchParams.has('accessToken'), false);
  assert.equal(realtimeUrl.toString().includes('auth-token-with-iam-session'), false);
  assert.equal(realtimeUrl.toString().includes('access-token-with-iam-session'), false);
  subscription?.close();

  clearRuntimeServerSessionId();
  configureDefaultBirdCoderIdeServicesRuntime();
} finally {
  if (originalWebSocketDescriptor) {
    Object.defineProperty(globalThis, 'WebSocket', originalWebSocketDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'WebSocket');
  }
}

console.log('workspace realtime client resilience contract passed.');
