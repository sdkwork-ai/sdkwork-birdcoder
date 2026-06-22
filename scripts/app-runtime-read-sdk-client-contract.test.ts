import assert from 'node:assert/strict';

const sdkClientsModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts',
  import.meta.url,
);

function createEnvelope<TData>(data: TData, requestId: string) {
  return {
    requestId,
    timestamp: '2026-04-11T09:00:00.000Z',
    data,
    meta: {
      version: 'v1',
    },
  };
}

function createListEnvelope<TItem>(items: readonly TItem[], requestId: string) {
  return {
    requestId,
    timestamp: '2026-04-11T09:00:00.000Z',
    items: [...items],
    meta: {
      page: 1,
      pageSize: items.length,
      total: items.length,
      version: 'v1',
    },
  };
}

const observedRequests: Array<{
  method: string;
  path: string;
  query?: Record<string, unknown>;
}> = [];

const { createBirdCoderAppSdkApiClient } = await import(
  `${sdkClientsModulePath.href}?t=${Date.now()}`
);

const client = createBirdCoderAppSdkApiClient({
  transport: {
    async request<TResponse>(
      request: { method: string; path: string; query?: Record<string, unknown> },
    ): Promise<TResponse> {
      observedRequests.push({
        method: request.method,
        path: request.path,
        ...(request.query ? { query: request.query } : {}),
      });

      switch (request.path) {
        case '/app/v3/api/system/descriptor':
          return createEnvelope(
            {
              apiVersion: 'v1',
              gateway: {
                docsPath: '/docs',
                liveOpenApiPath: '/openapi.json',
                openApiPath: '/openapi/coding-server-v1.json',
                routeCatalogPath: '/app/v3/api/system/routes',
                routeCount: 58,
                routesBySurface: {
                  app: 51,
                  backend: 7,
                },
                surfaces: [
                  {
                    authMode: 'user',
                    basePath: '/app/v3/api',
                    description: 'Application-facing coding runtime, workspace, project, collaboration, and IAM routes.',
                    name: 'app',
                    routeCount: 51,
                  },
                  {
                    authMode: 'admin',
                    basePath: '/backend/v3/api',
                    description: 'Backend governance, audit, release, deployment, and team-management routes.',
                    name: 'backend',
                    routeCount: 7,
                  },
                ],
              },
              hostMode: 'server',
              moduleId: 'coding-server',
              openApiPath: '/openapi/coding-server-v1.json',
              surfaces: ['app', 'backend'],
            },
            'req.app.descriptor',
          ) as TResponse;
        case '/app/v3/api/system/runtime':
          return createEnvelope(
            {
              host: '127.0.0.1',
              port: 10240,
              configFileName: 'bird-server.config.json',
            },
            'req.app.runtime',
          ) as TResponse;
        case '/app/v3/api/system/health':
          return createEnvelope(
            {
              status: 'healthy',
            },
            'req.app.health',
          ) as TResponse;
        case '/app/v3/api/engines':
          return createListEnvelope(
            [
              {
                engineKey: 'codex',
                displayName: 'Codex',
                vendor: 'OpenAI',
                installationKind: 'external-cli',
                defaultModelId: 'gpt-5-codex',
                homepage: 'https://openai.com',
                supportedHostModes: ['desktop', 'server', 'web'],
                transportKinds: ['cli-jsonl', 'json-rpc-v2'],
                capabilityMatrix: {
                  approvalCheckpoints: true,
                  chat: true,
                  commandArtifacts: true,
                  mcp: true,
                  patchArtifacts: true,
                  planning: true,
                  previewArtifacts: true,
                  ptyArtifacts: true,
                  remoteBridge: false,
                  sessionResume: true,
                  streaming: true,
                  structuredOutput: true,
                  testArtifacts: true,
                  todoArtifacts: true,
                  toolCalls: true,
                },
              },
            ],
            'req.app.engines',
          ) as TResponse;
        case '/app/v3/api/engines/codex/capabilities':
          return createEnvelope(
            {
              approvalCheckpoints: true,
              chat: true,
              commandArtifacts: true,
              mcp: true,
              patchArtifacts: true,
              planning: true,
              previewArtifacts: true,
              ptyArtifacts: true,
              remoteBridge: false,
              sessionResume: true,
              streaming: true,
              structuredOutput: true,
              testArtifacts: true,
              todoArtifacts: true,
              toolCalls: true,
            },
            'req.app.engine-capabilities',
          ) as TResponse;
        case '/app/v3/api/models':
          return createListEnvelope(
            [
              {
                engineKey: 'codex',
                modelId: 'codex',
                displayName: 'Codex',
                providerId: 'openai',
                status: 'active',
                defaultForEngine: true,
                transportKinds: ['cli-jsonl', 'json-rpc-v2'],
                capabilityMatrix: {
                  patchArtifacts: true,
                  planning: true,
                  toolCalls: true,
                },
              },
            ],
            'req.app.models',
          ) as TResponse;
        case '/app/v3/api/native_session_providers':
          return createListEnvelope(
            [
              {
                engineId: 'codex',
                displayName: 'Codex',
                nativeSessionIdPrefix: 'codex-native:',
                transportKinds: ['cli-jsonl'],
                discoveryMode: 'explicit-only',
              },
            ],
            'req.app.native-session-providers',
          ) as TResponse;
        case '/app/v3/api/system/routes':
          return createListEnvelope(
            [
              {
                authMode: 'user',
                method: 'GET',
                openApiPath: '/app/v3/api/system/routes',
                operationId: 'routes.list',
                path: '/app/v3/api/system/routes',
                surface: 'app',
                summary: 'List unified API routes',
              },
            ],
            'req.app.routes',
          ) as TResponse;
        case '/app/v3/api/intelligence/coding_sessions':
          return createListEnvelope(
            [
              {
                createdAt: '2026-04-17T00:00:00.000Z',
                id: 'coding-session-generated-contract',
                workspaceId: 'workspace-generated-contract',
                projectId: 'project-generated-contract',
                title: 'Generated coding session',
                status: 'active',
                hostMode: 'server',
                engineId: 'codex',
                modelId: 'gpt-5-codex',
                updatedAt: '2026-04-17T00:05:00.000Z',
                lastTurnAt: '2026-04-17T00:05:00.000Z',
              },
            ],
            'req.app.coding-sessions',
          ) as TResponse;
        case '/app/v3/api/native_sessions':
          return createListEnvelope(
            [
              {
                createdAt: '2026-04-17T00:00:00.000Z',
                id: 'session-generated-contract',
                workspaceId: 'workspace-generated-contract',
                projectId: 'project-generated-contract',
                title: 'Generated native session',
                status: 'active',
                hostMode: 'server',
                engineId: 'codex',
                modelId: 'gpt-5-codex',
                updatedAt: '2026-04-17T00:05:00.000Z',
                lastTurnAt: '2026-04-17T00:05:00.000Z',
                kind: 'coding',
                nativeCwd: 'D:/workspace/generated-contract',
                sortTimestamp: '1713312300000',
                transcriptUpdatedAt: '2026-04-17T00:05:00.000Z',
              },
            ],
            'req.app.native-sessions',
          ) as TResponse;
        case '/app/v3/api/native_sessions/session-generated-contract':
          return createEnvelope(
            {
              summary: {
                createdAt: '2026-04-17T00:00:00.000Z',
                id: 'session-generated-contract',
                workspaceId: 'workspace-generated-contract',
                projectId: 'project-generated-contract',
                title: 'Generated native session',
                status: 'active',
                hostMode: 'server',
                engineId: 'codex',
                modelId: 'gpt-5-codex',
                updatedAt: '2026-04-17T00:05:00.000Z',
                lastTurnAt: '2026-04-17T00:05:00.000Z',
                kind: 'coding',
                nativeCwd: 'D:/workspace/generated-contract',
                sortTimestamp: '1713312300000',
                transcriptUpdatedAt: '2026-04-17T00:05:00.000Z',
              },
              messages: [
                {
                  id: 'native-message-generated-contract',
                  codingSessionId: 'session-generated-contract',
                  turnId: 'native-turn-generated-contract',
                  role: 'assistant',
                  content: 'Generated native session message.',
                  createdAt: '2026-04-17T00:05:00.000Z',
                },
              ],
            },
            'req.app.native-session',
          ) as TResponse;
        case '/app/v3/api/operations/op-app-runtime-read':
          return createEnvelope(
            {
              operationId: 'op-app-runtime-read',
              status: 'running',
              artifactRefs: ['artifact-1'],
              streamUrl: '/app/v3/api/intelligence/coding_sessions/session-1/events',
              streamKind: 'sse',
            },
            'req.app.operation',
          ) as TResponse;
        default:
          throw new Error(`Unhandled request: ${request.method} ${request.path}`);
      }
    },
  },
});

const descriptor = await client.getDescriptor();
const runtime = await client.getRuntime();
const health = await client.getHealth();
const engines = await client.listEngines();
const codexCapabilities = await client.getEngineCapabilities('codex');
const models = await client.listModels();
const nativeSessionProviders = await client.listNativeSessionProviders();
const routes = await client.listRoutes();
const codingSessions = await client.listCodingSessions({
  engineId: 'codex',
  limit: 20,
  offset: 5,
  projectId: 'project-generated-contract',
  workspaceId: 'workspace-generated-contract',
});
const nativeSessions = await client.listNativeSessions({
  engineId: 'codex',
  projectId: 'project-generated-contract',
  workspaceId: 'workspace-generated-contract',
});
const nativeSession = await client.getNativeSession('session-generated-contract', {
  engineId: 'codex',
  projectId: 'project-generated-contract',
  workspaceId: 'workspace-generated-contract',
});
const operation = await client.getOperation('op-app-runtime-read');

assert.equal(descriptor.moduleId, 'coding-server');
assert.equal(descriptor.gateway.routeCatalogPath, '/app/v3/api/system/routes');
assert.equal(runtime.configFileName, 'bird-server.config.json');
assert.equal(health.status, 'healthy');
assert.equal(engines[0]?.engineKey, 'codex');
assert.equal(codexCapabilities.chat, true);
assert.equal(models[0]?.modelId, 'codex');
assert.equal(nativeSessionProviders[0]?.engineId, 'codex');
assert.equal(routes[0]?.operationId, 'routes.list');
assert.equal(codingSessions[0]?.id, 'coding-session-generated-contract');
assert.equal(nativeSessions[0]?.id, 'session-generated-contract');
assert.equal(nativeSession.summary.id, 'session-generated-contract');
assert.equal(operation.operationId, 'op-app-runtime-read');
assert.deepEqual(observedRequests, [
  {
    method: 'GET',
    path: '/app/v3/api/system/descriptor',
  },
  {
    method: 'GET',
    path: '/app/v3/api/system/runtime',
  },
  {
    method: 'GET',
    path: '/app/v3/api/system/health',
  },
  {
    method: 'GET',
    path: '/app/v3/api/engines',
  },
  {
    method: 'GET',
    path: '/app/v3/api/engines/codex/capabilities',
  },
  {
    method: 'GET',
    path: '/app/v3/api/models',
  },
  {
    method: 'GET',
    path: '/app/v3/api/native_session_providers',
  },
  {
    method: 'GET',
    path: '/app/v3/api/system/routes',
  },
  {
    method: 'GET',
    path: '/app/v3/api/intelligence/coding_sessions',
    query: {
      engineId: 'codex',
      limit: 20,
      offset: 5,
      projectId: 'project-generated-contract',
      workspaceId: 'workspace-generated-contract',
    },
  },
  {
    method: 'GET',
    path: '/app/v3/api/native_sessions',
    query: {
      engineId: 'codex',
      limit: 20,
      projectId: 'project-generated-contract',
      workspaceId: 'workspace-generated-contract',
    },
  },
  {
    method: 'GET',
    path: '/app/v3/api/native_sessions/session-generated-contract',
    query: {
      engineId: 'codex',
      projectId: 'project-generated-contract',
      workspaceId: 'workspace-generated-contract',
    },
  },
  {
    method: 'GET',
    path: '/app/v3/api/operations/op-app-runtime-read',
  },
]);

console.log('app runtime SDK read client facade contract passed.');
