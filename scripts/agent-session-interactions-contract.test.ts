import assert from 'node:assert/strict';

import type { IAgentSessionService } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/index.ts';
import { BirdCoderAgentSessionService } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/agentsSessionService.ts';
import {
  loadAgentSessionPendingInteractions,
  mapAgentSessionPendingInteractions,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/hooks/useAgentSessionInteractions.ts';

type AgentInteraction = Parameters<typeof mapAgentSessionPendingInteractions>[0][number];

function buildInteraction(
  overrides: Partial<AgentInteraction> & Pick<AgentInteraction, 'interactionId' | 'kind'>,
): AgentInteraction {
  return {
    interactionId: overrides.interactionId,
    tenantId: '1001',
    organizationId: '2001',
    sessionId: 'agent-session-interactions-contract',
    kind: overrides.kind,
    status: 'pending',
    prompt: 'Review the requested action',
    options: [],
    fencingToken: '1',
    version: '1',
    createdAt: '2026-07-22T01:00:00.000Z',
    updatedAt: '2026-07-22T01:00:00.000Z',
    ...overrides,
  };
}

const approval = buildInteraction({
  interactionId: 'approval-1',
  kind: 'approval',
  prompt: 'Approve the patch?',
  createdAt: '2026-07-22T01:02:00.000Z',
});
const question = buildInteraction({
  interactionId: 'question-1',
  kind: 'user_question',
  prompt: 'Which verification profile should run?',
  options: [
    { label: 'Standard', value: 'standard' },
    { label: 'Release', value: 'release' },
  ],
  createdAt: '2026-07-22T01:01:00.000Z',
});
const resolvedApproval = buildInteraction({
  interactionId: 'approval-resolved',
  kind: 'approval',
  status: 'resolved',
});

assert.deepEqual(
  mapAgentSessionPendingInteractions([approval, resolvedApproval, question]),
  {
    approvals: [{
      interactionId: 'approval-1',
      prompt: 'Approve the patch?',
      runtimeBindingId: undefined,
      sessionId: 'agent-session-interactions-contract',
      turnId: undefined,
    }],
    questions: [{
      interactionId: 'question-1',
      prompt: 'Which verification profile should run?',
      questions: [{
        question: 'Which verification profile should run?',
        options: [
          { label: 'Standard', value: 'standard' },
          { label: 'Release', value: 'release' },
        ],
      }],
      runtimeBindingId: undefined,
      sessionId: 'agent-session-interactions-contract',
      turnId: undefined,
    }],
  },
  'pending Agents interactions must be sorted, filtered, and separated by business kind.',
);

assert.equal(
  mapAgentSessionPendingInteractions([]),
  mapAgentSessionPendingInteractions([resolvedApproval]),
  'empty pending interaction results must reuse a stable value for render performance.',
);

const scopedService = {
  async getSession() {
    return { projectId: 'project-1' };
  },
  async listInteractions() {
    return {
      items: [question, approval],
      pageInfo: { mode: 'offset', page: 1, hasMore: false },
    };
  },
} as unknown as IAgentSessionService;

assert.deepEqual(
  await loadAgentSessionPendingInteractions(
    scopedService,
    'agent-session-interactions-contract',
    'project-1',
  ),
  mapAgentSessionPendingInteractions([question, approval]),
);
await assert.rejects(
  loadAgentSessionPendingInteractions(
    scopedService,
    'agent-session-interactions-contract',
    'another-project',
  ),
  /does not belong to project another-project/u,
  'project-scoped views must fail closed when an Agents Session belongs to another project.',
);

const requestedPages: Array<{ page?: number; pageSize?: number }> = [];
const paginatedClient = {
  ai: {
    agents: {
      interactions: {
        async list(
          _agentId: string,
          _sessionId: string,
          request: { page?: number; pageSize?: number },
        ) {
          requestedPages.push(request);
          return {
            items: [question],
            pageInfo: { mode: 'offset', page: 1, hasMore: true },
          };
        },
        async retrieve() {
          return { item: approval };
        },
      },
    },
  },
} as unknown as ConstructorParameters<typeof BirdCoderAgentSessionService>[0]['client'];
const paginatedService = new BirdCoderAgentSessionService({ client: paginatedClient });

assert.deepEqual(
  await paginatedService.listInteractions('agent-session-interactions-contract', {
    page: 1,
    pageSize: 50,
  }),
  {
    items: [question],
    pageInfo: { mode: 'offset', page: 1, hasMore: true },
  },
  'Agents Interaction loading must preserve canonical pageInfo without aggregation.',
);
assert.deepEqual(
  requestedPages.map(({ page }) => page),
  [1],
);
assert.equal(
  requestedPages[0]?.pageSize,
  50,
  'interactive Agents Interaction loading must request only the bounded UI page.',
);
assert.equal(
  await paginatedService.getInteraction(
    'agent-session-interactions-contract',
    approval.interactionId,
  ),
  approval,
  'interaction resolution must retrieve one canonical record by id instead of scanning pages.',
);

console.log('agent session interactions contract passed.');
