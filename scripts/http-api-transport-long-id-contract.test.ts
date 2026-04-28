import assert from 'node:assert/strict';
import { createBirdCoderHttpApiTransport } from '../packages/sdkwork-birdcoder-infrastructure/src/services/appAdminApiClient.ts';
import { parseBirdCoderApiJson } from '../packages/sdkwork-birdcoder-infrastructure/src/services/apiJson.ts';
import {
  BIRDCODER_DATA_ENTITY_DEFINITIONS,
  BIRDCODER_LONG_INTEGER_JSON_SCALAR_KEYS,
  createBirdCoderGeneratedCoreWriteApiClient,
  mergeBirdCoderProjectionMessages,
  normalizeBirdCoderCodeEngineExitCode,
  resolveBirdCoderCodeEngineToolCallId,
  resolveBirdCoderLongIntegerNumber,
} from '../packages/sdkwork-birdcoder-types/src/index.ts';

const unsafeSessionId = '101777208078558001';
const unsafeWorkspaceId = '101777208078558003';
const unsafeProjectId = '101777208078558005';
const unsafeTurnId = '101777208078558007';
const unsafeToolCallId = '101777208078558009';

function toLowerCamelCaseColumnName(columnName: string): string {
  return columnName.replace(/_([a-z0-9])/gu, (_match, character: string) =>
    character.toUpperCase(),
  );
}

const unsafeSessionEnvelope = `{
  "requestId": "req-long-id",
  "timestamp": "2026-04-27T10:00:00.000Z",
  "data": {
    "id": ${unsafeSessionId},
    "workspaceId": ${unsafeWorkspaceId},
    "projectId": ${unsafeProjectId},
    "title": "Long id session",
    "status": "active",
    "hostMode": "server",
    "engineId": "codex",
    "modelId": "gpt-5.4",
    "createdAt": "2026-04-27T10:00:00.000Z",
    "updatedAt": "2026-04-27T10:00:00.000Z",
    "lastTurnAt": "2026-04-27T10:00:00.000Z"
  },
  "meta": {
    "version": "v1"
  }
}`;

const unsafeTurnEnvelope = `{
  "requestId": "req-long-id-turn",
  "timestamp": "2026-04-27T10:00:01.000Z",
  "data": {
    "id": ${unsafeTurnId},
    "codingSessionId": ${unsafeSessionId},
    "runtimeId": "runtime-long-id",
    "requestKind": "chat",
    "status": "running",
    "inputSummary": "Check exact long id routing.",
    "startedAt": "2026-04-27T10:00:01.000Z"
  },
  "meta": {
    "version": "v1"
  }
}`;

const observedRequests: Array<{
  body?: unknown;
  path: string;
  query: Record<string, string>;
  rawBody?: string;
}> = [];
const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(String(input));
  const path = url.pathname;
  const rawBody = init?.body ? String(init.body) : undefined;
  observedRequests.push({
    body: rawBody ? JSON.parse(rawBody) : undefined,
    path,
    query: Object.fromEntries(url.searchParams.entries()),
    rawBody,
  });

  const body = path.endsWith('/turns') ? unsafeTurnEnvelope : unsafeSessionEnvelope;
  return {
    ok: true,
    status: 200,
    text: async () => body,
    json: async () => JSON.parse(body),
  } as Response;
}) as typeof fetch;

const transport = createBirdCoderHttpApiTransport({
  baseUrl: 'http://127.0.0.1:13001',
  fetchImpl,
});
const coreWriteClient = createBirdCoderGeneratedCoreWriteApiClient({ transport });

const missingLongIntegerJsonKeys = BIRDCODER_DATA_ENTITY_DEFINITIONS.flatMap((definition) =>
  definition.columns.flatMap((column) => {
    if (column.logicalType !== 'bigint') {
      return [];
    }
    return [column.name, toLowerCamelCaseColumnName(column.name)].filter(
      (key) => !BIRDCODER_LONG_INTEGER_JSON_SCALAR_KEYS.has(key),
    );
  }),
);
assert.deepEqual(
  missingLongIntegerJsonKeys,
  [],
  'every schema bigint column must be registered as a canonical API JSON Long key in both snake_case and lowerCamelCase forms.',
);

const createdSession = await coreWriteClient.createCodingSession({
  workspaceId: unsafeWorkspaceId,
  projectId: unsafeProjectId,
  engineId: 'codex',
  modelId: 'gpt-5.4',
  title: 'Long id session',
});

assert.equal(
  createdSession.id,
  unsafeSessionId,
  'HTTP API transport must preserve Java/Rust Long ids as exact strings before generated clients store or route them.',
);
assert.equal(typeof createdSession.id, 'string');
assert.equal(createdSession.workspaceId, unsafeWorkspaceId);
assert.equal(createdSession.projectId, unsafeProjectId);
assert.notEqual(
  createdSession.id,
  String(Number(unsafeSessionId)),
  'the contract must fail if an unsafe Long id is rounded through JSON.parse/response.json().',
);
assert.equal(
  Number.isNaN(resolveBirdCoderLongIntegerNumber(unsafeSessionId)),
  true,
  'public Long-to-number helpers must refuse unsafe Long strings instead of returning a rounded JavaScript number.',
);
assert.equal(
  resolveBirdCoderCodeEngineToolCallId({
    payload: {
      toolCallId: Number(unsafeToolCallId),
    },
  }),
  undefined,
  'code engine identifier normalization must reject unsafe JavaScript numbers instead of turning rounded tool-call ids into strings.',
);
assert.equal(
  normalizeBirdCoderCodeEngineExitCode(unsafeToolCallId),
  undefined,
  'code engine numeric status normalization must reject unsafe Long-sized strings instead of parsing them into rounded JavaScript numbers.',
);
assert.deepEqual(observedRequests.map((request) => request.path), [
  '/api/core/v1/coding-sessions',
]);

const createdTurn = await coreWriteClient.createCodingSessionTurn(createdSession.id, {
  requestKind: 'chat',
  inputSummary: 'Check exact long id routing.',
});

assert.equal(createdTurn.id, unsafeTurnId);
assert.equal(createdTurn.codingSessionId, unsafeSessionId);
assert.deepEqual(observedRequests.map((request) => request.path), [
  '/api/core/v1/coding-sessions',
  `/api/core/v1/coding-sessions/${unsafeSessionId}/turns`,
]);
assert.notEqual(
  observedRequests[1]?.path,
  `/api/core/v1/coding-sessions/${String(Number(unsafeSessionId))}/turns`,
  'create-turn must route with the exact server-created session id, not the rounded Java/Rust Long value that causes session-not-found toasts.',
);

const parsedPluralIdentifierPayload = parseBirdCoderApiJson<{
  data: {
    artifactIds: string[];
    message_ids: string[];
    projectIDs: string[];
  };
}>(`{
  "data": {
    "artifactIds": [101, ${unsafeTurnId}],
    "message_ids": [102, 103],
    "projectIDs": [104]
  }
}`);

assert.deepEqual(
  parsedPluralIdentifierPayload.data,
  {
    artifactIds: ['101', unsafeTurnId],
    message_ids: ['102', '103'],
    projectIDs: ['104'],
  },
  'API JSON parsing must normalize plural identifier arrays to strings as part of the same Long-id standard.',
);

const parsedLongBusinessPayload = parseBirdCoderApiJson<{
  data: {
    agent_biz_type: string;
    availablePoints: string;
    balance: string;
    budgetAmount: string;
    contextTokens: string;
    duration: string;
    installCount: string;
    pointBalance: string;
    points: string;
    seed: string;
    sequence: string;
    sequenceNo: string;
    size: string;
    sortTimestamp: string;
    totalInteractionCount: string;
    totalRechargedPoints: string;
    v: string;
    version: string;
  };
}>(`{
  "data": {
    "agent_biz_type": 7,
    "availablePoints": 4097,
    "balance": 12,
    "budgetAmount": ${unsafeProjectId},
    "contextTokens": 8192,
    "duration": 250,
    "installCount": 2048,
    "pointBalance": 4096,
    "points": 13,
    "seed": 14,
    "sequence": 77,
    "sequenceNo": 77,
    "size": 15,
    "sortTimestamp": ${unsafeSessionId},
    "totalInteractionCount": 11,
    "totalRechargedPoints": ${unsafeToolCallId},
    "v": 1,
    "version": 2
  }
}`);

assert.deepEqual(
  parsedLongBusinessPayload.data,
  {
    agent_biz_type: '7',
    availablePoints: '4097',
    balance: '12',
    budgetAmount: unsafeProjectId,
    contextTokens: '8192',
    duration: '250',
    installCount: '2048',
    pointBalance: '4096',
    points: '13',
    seed: '14',
    sequence: '77',
    sequenceNo: '77',
    size: '15',
    sortTimestamp: unsafeSessionId,
    totalInteractionCount: '11',
    totalRechargedPoints: unsafeToolCallId,
    v: '1',
    version: '2',
  },
  'API JSON parsing must normalize canonical Java Long/BIGINT business fields to strings even when the numeric token is still within the JavaScript safe-integer range.',
);

const projectedMessages = mergeBirdCoderProjectionMessages({
  codingSessionId: unsafeSessionId,
  existingMessages: [],
  idPrefix: 'authoritative',
  events: [
    {
      id: 'evt-long-id-payload',
      codingSessionId: unsafeSessionId,
      turnId: unsafeTurnId,
      runtimeId: 'runtime-long-id',
      kind: 'message.completed',
      sequence: '1',
      payload: {
        role: 'assistant',
        content: 'Tool call completed.',
        commands: [
          {
            command: 'inspect',
            status: 'success',
            toolCallId: unsafeToolCallId,
          },
        ],
        toolCalls: [
          {
            id: unsafeToolCallId,
            type: 'function',
            function: {
              name: 'inspect',
              arguments: `{"projectId": "${unsafeProjectId}"}`,
            },
          },
        ],
      },
      createdAt: '2026-04-27T10:00:02.000Z',
    },
  ],
});

assert.equal(
  projectedMessages[0]?.commands?.[0]?.toolCallId,
  unsafeToolCallId,
  'projection structured command payloads must preserve nested Long ids as decimal strings.',
);
assert.equal(
  projectedMessages[0]?.tool_calls?.[0]?.id,
  unsafeToolCallId,
  'projection structured tool-call payloads must preserve nested Long ids as decimal strings.',
);
assert.notEqual(
  projectedMessages[0]?.tool_calls?.[0]?.id,
  Number(unsafeToolCallId),
  'projection payload parsing must not round nested Long ids through JSON.parse().',
);

const exactSequenceOrderingMessages = mergeBirdCoderProjectionMessages({
  codingSessionId: unsafeSessionId,
  existingMessages: [],
  idPrefix: 'authoritative',
  events: [
    {
      id: 'z-first-unsafe-sequence',
      codingSessionId: unsafeSessionId,
      turnId: `${unsafeTurnId}:first`,
      runtimeId: 'runtime-long-id',
      kind: 'message.completed',
      sequence: `${BigInt(unsafeSessionId) + 1n}`,
      payload: {
        role: 'assistant',
        content: 'first exact sequence',
      },
      createdAt: '2026-04-27T10:00:03.000Z',
    },
    {
      id: 'a-second-unsafe-sequence',
      codingSessionId: unsafeSessionId,
      turnId: `${unsafeTurnId}:second`,
      runtimeId: 'runtime-long-id',
      kind: 'message.completed',
      sequence: `${BigInt(unsafeSessionId) + 2n}`,
      payload: {
        role: 'assistant',
        content: 'second exact sequence',
      },
      createdAt: '2026-04-27T10:00:03.000Z',
    },
  ],
});

assert.deepEqual(
  exactSequenceOrderingMessages.map((message) => message.content),
  ['first exact sequence', 'second exact sequence'],
  'projection event ordering must compare Long sequence strings exactly instead of rounding through Number.',
);

await transport.request({
  method: 'POST',
  path: '/api/core/v1/long-outbound-standardization',
  body: {
    data: {
      id: BigInt(unsafeSessionId),
      workspaceId: 1001,
      ids: [1002],
      availablePoints: 4097,
      version: 2,
    },
  },
});

const outboundLongRequestBody = observedRequests.at(-1)?.body as
  | { data?: Record<string, unknown> }
  | undefined;
assert.deepEqual(
  outboundLongRequestBody?.data,
  {
    id: unsafeSessionId,
    workspaceId: '1001',
    ids: ['1002'],
    availablePoints: '4097',
    version: '2',
  },
  'HTTP API transport must serialize outbound canonical identifiers and Java Long/BIGINT fields as strings before crossing the JSON boundary.',
);

await transport.request({
  method: 'GET',
  path: '/api/core/v1/query-long-standardization',
  query: {
    active: true,
    limit: 25,
    projectId: 1001,
    workspaceId: unsafeWorkspaceId,
  },
});

assert.deepEqual(
  observedRequests.at(-1)?.query,
  {
    active: 'true',
    limit: '25',
    projectId: '1001',
    workspaceId: unsafeWorkspaceId,
  },
  'HTTP API query serialization must keep canonical identifier query values as exact decimal strings while preserving small numeric pagination fields.',
);

const observedRequestCountBeforeUnsafeQuery = observedRequests.length;
await assert.rejects(
  () =>
    transport.request({
      method: 'GET',
      path: '/api/core/v1/query-long-standardization',
      query: {
        workspaceId: Number(unsafeWorkspaceId),
      },
    }),
  /unsafe JavaScript number/u,
  'HTTP API query serialization must reject unsafe JavaScript numbers for canonical identifier query fields before sending a rounded value.',
);
assert.equal(
  observedRequests.length,
  observedRequestCountBeforeUnsafeQuery,
  'unsafe canonical identifier query values must fail before any HTTP request is sent.',
);

const observedRequestCountBeforeUnsafeBody = observedRequests.length;
await assert.rejects(
  () =>
    transport.request({
      method: 'POST',
      path: '/api/core/v1/body-long-standardization',
      body: {
        data: {
          requestCorrelation: Number(unsafeToolCallId),
        },
      },
    }),
  /unsafe JavaScript number/u,
  'HTTP API JSON body serialization must reject every unsafe JavaScript integer before JSON.stringify can round it, even when the field name is not a registered Long key.',
);
assert.equal(
  observedRequests.length,
  observedRequestCountBeforeUnsafeBody,
  'unsafe body integers must fail before any HTTP request is sent.',
);

console.log('http api transport long id contract passed.');
