import assert from 'node:assert/strict';

const typesEntryModulePath = new URL(
  '../packages/sdkwork-birdcoder-types/src/index.ts',
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
}> = [];

const { createBirdCoderGeneratedCoreReadApiClient } = await import(
  `${typesEntryModulePath.href}?t=${Date.now()}`
);

const client = createBirdCoderGeneratedCoreReadApiClient({
  transport: {
    async request<TResponse>(request: { method: string; path: string }): Promise<TResponse> {
      observedRequests.push({
        method: request.method,
        path: request.path,
      });

      switch (request.path) {
        case '/api/core/v1/descriptor':
          return createEnvelope(
            {
              apiVersion: 'v1',
              hostMode: 'server',
              moduleId: 'coding-server',
              openApiPath: '/openapi/coding-server-v1.json',
              surfaces: ['core', 'app', 'admin'],
            },
            'req.core.descriptor',
          ) as TResponse;
        case '/api/core/v1/runtime':
          return createEnvelope(
            {
              host: '127.0.0.1',
              port: 10240,
              configFileName: 'bird-server.config.json',
            },
            'req.core.runtime',
          ) as TResponse;
        case '/api/core/v1/health':
          return createEnvelope(
            {
              status: 'healthy',
            },
            'req.core.health',
          ) as TResponse;
        case '/api/core/v1/engines':
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
            'req.core.engines',
          ) as TResponse;
        case '/api/core/v1/engines/codex/capabilities':
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
            'req.core.engine-capabilities',
          ) as TResponse;
        case '/api/core/v1/models':
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
            'req.core.models',
          ) as TResponse;
        case '/api/core/v1/operations/op-generated-core-read':
          return createEnvelope(
            {
              operationId: 'op-generated-core-read',
              status: 'running',
              artifactRefs: ['artifact-1'],
              streamUrl: '/api/core/v1/coding-sessions/session-1/events',
              streamKind: 'sse',
            },
            'req.core.operation',
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
const operation = await client.getOperation('op-generated-core-read');

assert.equal(descriptor.moduleId, 'coding-server');
assert.equal(runtime.configFileName, 'bird-server.config.json');
assert.equal(health.status, 'healthy');
assert.equal(engines[0]?.engineKey, 'codex');
assert.equal(codexCapabilities.chat, true);
assert.equal(models[0]?.modelId, 'codex');
assert.equal(operation.operationId, 'op-generated-core-read');
assert.deepEqual(observedRequests, [
  {
    method: 'GET',
    path: '/api/core/v1/descriptor',
  },
  {
    method: 'GET',
    path: '/api/core/v1/runtime',
  },
  {
    method: 'GET',
    path: '/api/core/v1/health',
  },
  {
    method: 'GET',
    path: '/api/core/v1/engines',
  },
  {
    method: 'GET',
    path: '/api/core/v1/engines/codex/capabilities',
  },
  {
    method: 'GET',
    path: '/api/core/v1/models',
  },
  {
    method: 'GET',
    path: '/api/core/v1/operations/op-generated-core-read',
  },
]);

console.log('generated core read client facade contract passed.');
