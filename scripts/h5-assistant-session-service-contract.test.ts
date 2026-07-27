import assert from 'node:assert/strict';

import type {
  AgentSessionRecord,
  SdkworkAppClient as AgentsAppClient,
} from '@sdkwork/agents-app-sdk';

import { ensureBirdCoderAssistantSession } from '../apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-core/src/sdk/assistantSessionService.ts';

function session(
  sessionId: string,
  status: AgentSessionRecord['status'],
): AgentSessionRecord {
  return {
    itemCount: '0',
    sessionId,
    sessionKind: 'assistant',
    status,
  } as AgentSessionRecord;
}

const requestedPages: number[] = [];
let createCalls = 0;
const reusable = session('session-reusable', 'idle');
const client = {
  ai: {
    agents: {
      sessions: {
        async create() {
          createCalls += 1;
          return session('session-created', 'active');
        },
        async list(_agentId: string, params: { page?: number }) {
          const page = params.page ?? 1;
          if (page === 1) {
            requestedPages.push(page);
            return {
              items: [session('session-closed', 'closed')],
              pageInfo: { hasMore: true, mode: 'offset', page, pageSize: 20 },
            };
          }
          requestedPages.push(page);
          return {
            items: [reusable],
            pageInfo: { hasMore: false, mode: 'offset', page, pageSize: 20 },
          };
        },
      },
    },
  },
} as unknown as AgentsAppClient;

const resolved = await ensureBirdCoderAssistantSession({ client });
assert.deepEqual(requestedPages, [1, 2]);
assert.deepEqual(resolved, { itemCount: 0, sessionId: reusable.sessionId });
assert.equal(createCalls, 0, 'A reusable session on a later page must not be duplicated.');

const invalidPaginationClient = {
  ai: {
    agents: {
      sessions: {
        async create() {
          throw new Error('create must not run when continuation state is ambiguous');
        },
        async list() {
          return {
            items: [],
            pageInfo: { mode: 'offset', page: 1, pageSize: 20 },
          };
        },
      },
    },
  },
} as unknown as AgentsAppClient;

await assert.rejects(
  ensureBirdCoderAssistantSession({ client: invalidPaginationClient }),
  /missing a usable continuation state/u,
);

console.log('H5 assistant session pagination contract passed.');
