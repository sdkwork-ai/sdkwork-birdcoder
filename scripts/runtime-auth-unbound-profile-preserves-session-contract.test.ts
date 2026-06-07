import assert from 'node:assert/strict';

const runtimeAuthModulePath = new URL(
  '../packages/sdkwork-birdcoder-infrastructure/src/services/impl/RuntimeAuthService.ts',
  import.meta.url,
);

const runtimeAuthModule = await import(
  `${runtimeAuthModulePath.href}?runtime-auth=${Date.now()}`
);

function createRuntimeFixture({
  storedSession = {},
  retrieveCurrentUser,
}: {
  storedSession?: Record<string, string | undefined>;
  retrieveCurrentUser?: () => Promise<unknown>;
} = {}) {
  let tokenSession = { ...storedSession };
  let clearCalls = 0;
  let contextClearCalls = 0;
  let sessionDeleteCalls = 0;

  const runtime = {
    contextStore: {
      clear: async () => {
        contextClearCalls += 1;
      },
    },
    service: {
      auth: {
        sessions: {
          current: {
            delete: async () => {
              sessionDeleteCalls += 1;
            },
          },
        },
      },
      iam: {
        users: {
          current: {
            retrieve: retrieveCurrentUser ?? (async () => ({
              displayName: 'Runtime User',
              email: 'runtime@example.com',
              id: 'runtime-user',
            })),
          },
        },
      },
    },
    tokenStore: {
      clear: async () => {
        clearCalls += 1;
        tokenSession = {};
      },
      get: () => tokenSession,
    },
  };

  return {
    readStats: () => ({
      clearCalls,
      contextClearCalls,
      sessionDeleteCalls,
      tokenSession,
    }),
    runtime,
  };
}

{
  const fixture = createRuntimeFixture();
  const authService = runtimeAuthModule.createBirdCoderRuntimeAuthService({
    getRuntime: () => fixture.runtime,
  });
  assert.equal(await authService.getCurrentUser(), null);
  assert.equal(
    fixture.readStats().clearCalls,
    0,
    'getCurrentUser without a stored SDKWork IAM session must not clear token storage.',
  );
}

{
  const fixture = createRuntimeFixture({
    storedSession: {
      accessToken: 'access-token',
      authToken: 'auth-token',
    },
  });
  const authService = runtimeAuthModule.createBirdCoderRuntimeAuthService({
    getRuntime: () => fixture.runtime,
  });
  assert.deepEqual(await authService.getCurrentUser(), {
    email: 'runtime@example.com',
    id: 'runtime-user',
    name: 'Runtime User',
  });
}

{
  const fixture = createRuntimeFixture({
    retrieveCurrentUser: async () => ({
      avatar: {
        kind: 'image',
        publicUrl: 'https://cdn.sdkwork.test/avatar.png',
        source: 'external_url',
        url: 'https://origin.sdkwork.test/avatar.png',
      },
      displayName: 'Avatar User',
      email: 'avatar@example.com',
      id: 'avatar-user',
    }),
    storedSession: {
      accessToken: 'access-token',
      authToken: 'auth-token',
    },
  });
  const authService = runtimeAuthModule.createBirdCoderRuntimeAuthService({
    getRuntime: () => fixture.runtime,
  });
  assert.deepEqual(await authService.getCurrentUser(), {
    avatarUrl: 'https://cdn.sdkwork.test/avatar.png',
    email: 'avatar@example.com',
    id: 'avatar-user',
    name: 'Avatar User',
  });
}

{
  const fixture = createRuntimeFixture({
    retrieveCurrentUser: async () => {
      throw new Error('profile unavailable');
    },
    storedSession: {
      accessToken: 'access-token',
      authToken: 'auth-token',
    },
  });
  const authService = runtimeAuthModule.createBirdCoderRuntimeAuthService({
    getRuntime: () => fixture.runtime,
  });
  await assert.rejects(() => authService.getCurrentUser(), /profile unavailable/);
  assert.equal(
    fixture.readStats().clearCalls,
    0,
    'a transient SDKWork IAM profile failure must not clear the durable app session token.',
  );
}

{
  const fixture = createRuntimeFixture({
    storedSession: {
      accessToken: 'access-token',
      authToken: 'auth-token',
    },
  });
  const authService = runtimeAuthModule.createBirdCoderRuntimeAuthService({
    getRuntime: () => fixture.runtime,
  });
  await authService.logout();
  assert.deepEqual(
    fixture.readStats(),
    {
      clearCalls: 1,
      contextClearCalls: 1,
      sessionDeleteCalls: 1,
      tokenSession: {},
    },
    'logout must revoke the SDKWork IAM app session and clear token/context stores.',
  );
}

console.log('runtime auth unbound profile session preservation contract passed.');
