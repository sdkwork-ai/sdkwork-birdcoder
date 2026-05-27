import assert from 'node:assert/strict';

const modulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/index.ts',
  import.meta.url,
);
const runtimeServerSessionModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/services/runtimeServerSession.ts',
  import.meta.url,
);

const originalWebSocketDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'WebSocket');

class ContractWebSocket {
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readonly readyState = 1;
  readonly url: string;

  constructor(url: string) {
    this.url = url;
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
    configureDefaultBirdCoderIdeServicesRuntime,
    subscribeBirdCoderWorkspaceRealtime,
  } = await import(`${modulePath.href}?t=${Date.now()}`);
  const {
    clearRuntimeServerSessionId,
    writeRuntimeServerSessionId,
  } = await import(`${runtimeServerSessionModulePath.href}?t=${Date.now()}`);

  configureDefaultBirdCoderIdeServicesRuntime({
    apiBaseUrl: 'not a url',
    executionAuthorityMode: 'remote-required',
  });
  writeRuntimeServerSessionId('runtime-session-contract');

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
  configureDefaultBirdCoderIdeServicesRuntime();
} finally {
  if (originalWebSocketDescriptor) {
    Object.defineProperty(globalThis, 'WebSocket', originalWebSocketDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, 'WebSocket');
  }
}

console.log('workspace realtime client resilience contract passed.');
