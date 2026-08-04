import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { IAgentSessionService } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/index.ts';
import { BirdCoderAgentSessionService } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/agentsSessionService.ts';
import {
  loadAgentSessionPendingInteractions,
  mapAgentSessionPendingInteractions,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/hooks/useAgentSessionInteractions.ts';

type AgentInteraction = Parameters<typeof mapAgentSessionPendingInteractions>[0][number];

const sessionIdentity = {
  agentId: 'agent.codex',
  sessionId: 'agent-session-interactions-contract',
} as const;

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
      createdAt: '2026-07-22T01:02:00.000Z',
      interactionId: 'approval-1',
      prompt: 'Approve the patch?',
      request: undefined,
      runtimeBindingId: undefined,
      sessionId: 'agent-session-interactions-contract',
      turnId: undefined,
    }],
    questions: [{
      createdAt: '2026-07-22T01:01:00.000Z',
      interactionId: 'question-1',
      prompt: 'Which verification profile should run?',
      questions: [{
        question: 'Which verification profile should run?',
        options: [
          { label: 'Standard', value: 'standard' },
          { label: 'Release', value: 'release' },
        ],
      }],
      request: undefined,
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
    sessionIdentity,
    'project-1',
  ),
  mapAgentSessionPendingInteractions([question, approval]),
);
await assert.rejects(
  loadAgentSessionPendingInteractions(
    scopedService,
    sessionIdentity,
    'another-project',
  ),
  /does not belong to project another-project/u,
  'project-scoped views must fail closed when an Agents Session belongs to another project.',
);

const pendingInteractionReadController = new AbortController();
const pendingInteractionReadRequests: Array<{
  options?: { signal?: AbortSignal };
  page?: number;
  pageSize?: number;
  status?: string;
}> = [];
const multiPageService = {
  async getSession(_identity: typeof sessionIdentity, options?: { signal?: AbortSignal }) {
    assert.equal(options?.signal, pendingInteractionReadController.signal);
    return { projectId: 'project-1' };
  },
  async listInteractions(
    _identity: typeof sessionIdentity,
    request: { page?: number; pageSize?: number; status?: string },
    options?: { signal?: AbortSignal },
  ) {
    pendingInteractionReadRequests.push({ ...request, options });
    return request.page === 1
      ? {
          items: [question],
          pageInfo: { mode: 'offset', page: 1, pageSize: 200, hasMore: true },
        }
      : {
          items: [approval],
          pageInfo: { mode: 'offset', page: 2, pageSize: 200, hasMore: false },
        };
  },
} as unknown as IAgentSessionService;

assert.deepEqual(
  await loadAgentSessionPendingInteractions(
    multiPageService,
    sessionIdentity,
    'project-1',
    pendingInteractionReadController.signal,
  ),
  mapAgentSessionPendingInteractions([question, approval]),
  'pending Interaction loading must aggregate every bounded page before presenting the inbox.',
);
assert.deepEqual(
  pendingInteractionReadRequests.map(({ page, pageSize, status }) => ({
    page,
    pageSize,
    status,
  })),
  [
    { page: 1, pageSize: 200, status: 'pending' },
    { page: 2, pageSize: 200, status: 'pending' },
  ],
  'pending Interaction loading must request only pending records with bounded canonical pages.',
);
assert.ok(
  pendingInteractionReadRequests.every(
    ({ options }) => options?.signal === pendingInteractionReadController.signal,
  ),
  'pending Interaction reads must forward one cancellation signal through every SDK call.',
);

function createMalformedPendingInteractionService(
  pages: readonly AgentInteraction[][],
): IAgentSessionService {
  return {
    async getSession() {
      return { projectId: 'project-1' };
    },
    async listInteractions(
      _identity: typeof sessionIdentity,
      request: { page?: number },
    ) {
      const page = request.page ?? 1;
      return {
        items: pages[page - 1] ?? [],
        pageInfo: {
          mode: 'offset',
          page,
          pageSize: 200,
          hasMore: page < pages.length,
        },
      };
    },
  } as unknown as IAgentSessionService;
}

await assert.rejects(
  loadAgentSessionPendingInteractions(
    createMalformedPendingInteractionService([[question], [question]]),
    sessionIdentity,
    'project-1',
  ),
  /duplicate question-1/u,
  'pending Interaction pagination must reject duplicates across page boundaries.',
);
await assert.rejects(
  loadAgentSessionPendingInteractions(
    createMalformedPendingInteractionService([[
      buildInteraction({
        interactionId: 'wrong-session',
        kind: 'approval',
        sessionId: 'another-session',
      }),
    ]]),
    sessionIdentity,
    'project-1',
  ),
  /unexpected resource/u,
  'pending Interaction pagination must fail closed on cross-session data.',
);
await assert.rejects(
  loadAgentSessionPendingInteractions(
    createMalformedPendingInteractionService([[
      buildInteraction({
        interactionId: 'resolved-record',
        kind: 'approval',
        status: 'resolved',
      }),
    ]]),
    sessionIdentity,
    'project-1',
  ),
  /unexpected resource/u,
  'pending Interaction pagination must fail closed when the server ignores the status filter.',
);

const requestedPages: Array<{
  kind?: string;
  page?: number;
  pageSize?: number;
  status?: string;
}> = [];
const requestedInteractionReadOptions: unknown[] = [];
const paginatedClient = {
  ai: {
    agents: {
      interactions: {
        async list(
          _agentId: string,
          _sessionId: string,
          request: {
            kind?: string;
            page?: number;
            pageSize?: number;
            status?: string;
          },
          options?: unknown,
        ) {
          requestedPages.push(request);
          requestedInteractionReadOptions.push(options);
          return {
            items: [question],
            pageInfo: { mode: 'offset', page: 1, hasMore: true },
          };
        },
        async retrieve() {
          return approval;
        },
      },
    },
  },
} as unknown as ConstructorParameters<typeof BirdCoderAgentSessionService>[0]['client'];
const paginatedService = new BirdCoderAgentSessionService({ client: paginatedClient });
const paginatedReadController = new AbortController();

assert.deepEqual(
  await paginatedService.listInteractions(sessionIdentity, {
    page: 1,
    pageSize: 50,
    status: 'pending',
  }, { signal: paginatedReadController.signal }),
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
assert.equal(requestedPages[0]?.status, 'pending');
assert.deepEqual(requestedInteractionReadOptions, [{
  signal: paginatedReadController.signal,
  timeout: undefined,
}]);
assert.equal(
  await paginatedService.getInteraction(
    sessionIdentity,
    approval.interactionId,
  ),
  approval,
  'interaction resolution must retrieve one canonical record by id instead of scanning pages.',
);

let approveCalls = 0;
let answerCalls = 0;
const mutationClient = {
  ai: {
    agents: {
      interactions: {
        async answer() {
          answerCalls += 1;
          return question;
        },
        async approve() {
          approveCalls += 1;
          return approval;
        },
      },
    },
  },
} as unknown as ConstructorParameters<typeof BirdCoderAgentSessionService>[0]['client'];
const mutationService = new BirdCoderAgentSessionService({ client: mutationClient });
const interactionMutationIdentity = {
  claimToken: 'claim-token',
  expectedVersion: '1',
  fencingToken: '1',
  requestedAt: '2026-07-22T01:05:00.000Z',
};

await assert.rejects(
  mutationService.approveInteraction(
    sessionIdentity,
    approval.interactionId,
    {
      ...interactionMutationIdentity,
      approved: true,
      reason: 'r'.repeat(2_049),
    },
  ),
  /2048 characters or fewer/u,
  'oversized approval reasons must be rejected before opening an SDK mutation.',
);
await assert.rejects(
  mutationService.answerInteraction(
    sessionIdentity,
    question.interactionId,
    {
      ...interactionMutationIdentity,
      answer: 'a'.repeat(65_537),
    },
  ),
  /65536 characters or fewer/u,
  'oversized Interaction answers must be rejected before opening an SDK mutation.',
);
await assert.rejects(
  mutationService.answerInteraction(
    sessionIdentity,
    question.interactionId,
    {
      ...interactionMutationIdentity,
      answer: 'standard',
      selectedOptionValue: 'o'.repeat(257),
    },
  ),
  /256 characters or fewer/u,
  'oversized Interaction option values must be rejected before opening an SDK mutation.',
);
assert.equal(approveCalls, 0);
assert.equal(answerCalls, 0);

const interactionHookSource = await readFile(
  resolve('apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/hooks/useAgentSessionInteractions.ts'),
  'utf8',
);
const approvalMutationStart = interactionHookSource.indexOf(
  'const submitApprovalDecision = useCallback',
);
const questionMutationStart = interactionHookSource.indexOf(
  'const submitQuestionAnswer = useCallback',
);
const approvalValidationIndex = interactionHookSource.indexOf(
  'const reason = normalizeBoundedInteractionInput',
  approvalMutationStart,
);
const approvalClaimResolutionIndex = interactionHookSource.indexOf(
  'resolveInteractionAndClaimOwner(interactionId)',
  approvalMutationStart,
);
const questionValidationIndex = interactionHookSource.indexOf(
  'const submittedAnswer = normalizeBoundedInteractionInput',
  questionMutationStart,
);
const questionClaimResolutionIndex = interactionHookSource.indexOf(
  'resolveInteractionAndClaimOwner(interactionId)',
  questionMutationStart,
);
assert.ok(
  approvalMutationStart >= 0
    && approvalValidationIndex >= approvalMutationStart
    && approvalClaimResolutionIndex > approvalValidationIndex,
  'approval input bounds must be checked before an Interaction claim lease is acquired.',
);
assert.ok(
  questionMutationStart >= 0
    && questionValidationIndex >= questionMutationStart
    && questionClaimResolutionIndex > questionValidationIndex,
  'question input bounds must be checked before an Interaction claim lease is acquired.',
);

console.log('agent session interactions contract passed.');
