// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IAgentSessionService } from '@sdkwork/birdcoder-pc-infrastructure-runtime';

import {
  mapAgentSessionPendingInteractions,
  useAgentSessionPendingInteractions,
} from '../src/hooks/useAgentSessionInteractions.ts';

type InteractionRecord = Awaited<ReturnType<IAgentSessionService['getInteraction']>>;

const mocks = vi.hoisted(() => {
  const answerInteraction = vi.fn();
  const approveInteraction = vi.fn();
  const claimInteraction = vi.fn();
  const getCurrentUser = vi.fn();
  const getInteraction = vi.fn();
  const getSession = vi.fn();
  const listInteractions = vi.fn();
  const resolveInteraction = vi.fn();
  return {
    answerInteraction,
    approveInteraction,
    claimInteraction,
    getCurrentUser,
    getInteraction,
    getSession,
    ideServices: {
      agentSessionService: {
        answerInteraction,
        approveInteraction,
        claimInteraction,
        getInteraction,
        getSession,
        listInteractions,
        resolveInteraction,
      },
      authService: { getCurrentUser },
    },
    listInteractions,
    resolveInteraction,
  };
});

vi.mock('../src/context/ideServices.ts', () => ({
  useIDEServices: () => mocks.ideServices,
}));

vi.mock('../src/workbench/workspaceSessionInboxCoordinator.ts', () => ({
  invalidateActiveWorkspaceSessionInboxSynchronizations: vi.fn(),
}));

function interaction(
  interactionId: string,
  kind: InteractionRecord['kind'],
  request?: InteractionRecord['request'],
): InteractionRecord {
  return {
    interactionId,
    tenantId: '100001',
    organizationId: '0',
    sessionId: 'session.typed',
    kind,
    status: 'pending',
    prompt: `Prompt for ${interactionId}`,
    options: [],
    request,
    fencingToken: '0',
    version: '1',
    createdAt: `2026-08-01T00:00:${interactionId.slice(-2).padStart(2, '0')}.000Z`,
    updatedAt: '2026-08-01T00:01:00.000Z',
  };
}

function page(items: InteractionRecord[]) {
  return {
    items,
    pageInfo: {
      hasMore: false,
      mode: 'offset' as const,
      page: 1,
      pageSize: 200,
    },
  };
}

const typedInteractions: InteractionRecord[] = [
  interaction('typed-01', 'approval', {
    schemaVersion: 1,
    category: 'approval',
    kind: 'command_execution',
    allowedActions: ['accept', 'accept_with_exec_policy_amendment'],
    data: { command: 'pnpm test', proposedExecPolicyAmendment: { prefix: ['pnpm'] } },
  }),
  interaction('typed-02', 'approval', {
    schemaVersion: 1,
    category: 'approval',
    kind: 'file_change',
    allowedActions: ['accept', 'accept_for_session'],
    data: { changes: { 'src/app.ts': '+ready' } },
  }),
  interaction('typed-03', 'approval', {
    schemaVersion: 1,
    category: 'approval',
    kind: 'permission_profile',
    allowedActions: ['grant', 'decline'],
    data: { requestedPermissions: { network: true } },
  }),
  interaction('typed-04', 'user_question', {
    schemaVersion: 1,
    category: 'user_input',
    kind: 'question_set',
    allowedActions: ['submit', 'cancel'],
    data: { questions: [{ id: 'q1', header: 'One', prompt: 'First?', allowOther: true, secret: false, options: null }] },
  }),
  interaction('typed-05', 'user_question', {
    schemaVersion: 1,
    category: 'user_input',
    kind: 'onboarding_question_set',
    allowedActions: ['submit', 'cancel'],
    data: { questions: [{ id: 'q2', header: 'Two', prompt: 'Second?', allowOther: false, secret: true, options: null }] },
  }),
  interaction('typed-06', 'user_question', {
    schemaVersion: 1,
    category: 'user_input',
    kind: 'option_picker',
    allowedActions: ['submit', 'skip', 'dismiss'],
    data: { question: 'Choose', options: [{ label: 'A', description: 'Option A' }] },
  }),
  interaction('typed-07', 'user_question', {
    schemaVersion: 1,
    category: 'user_input',
    kind: 'context_source_picker',
    allowedActions: ['continue', 'skip', 'dismiss'],
    data: { autoResolutionMs: '30000', question: 'Context', options: [{ label: 'Workspace' }] },
  }),
  interaction('typed-08', 'setup', {
    schemaVersion: 1,
    category: 'setup',
    kind: 'setup_step',
    allowedActions: ['continue', 'skip', 'dismiss'],
    data: { step: 'context', question: 'Setup context', options: [{ label: 'Repository' }] },
  }),
  interaction('typed-09', 'elicitation', {
    schemaVersion: 1,
    category: 'elicitation',
    kind: 'mcp_elicitation',
    allowedActions: ['accept', 'decline', 'cancel'],
    data: { mode: 'form', message: 'Configure app', requestedSchema: { type: 'object' } },
  }),
];

beforeEach(() => {
  mocks.getSession.mockResolvedValue({ projectId: 'project.typed' });
  mocks.listInteractions.mockResolvedValue(page(typedInteractions));
  mocks.getCurrentUser.mockResolvedValue({ id: 'user.typed' });
  mocks.getInteraction.mockImplementation(async (_identity, interactionId: string) => {
    const record = typedInteractions.find((candidate) => candidate.interactionId === interactionId);
    if (!record) throw new Error(`Missing fixture ${interactionId}`);
    return record;
  });
  mocks.claimInteraction.mockImplementation(async (_identity, _interactionId, _request) => ({
    interaction: { ...typedInteractions[0], version: '2' },
    claimToken: 'claim-token',
    claimExpiresAt: '2026-08-01T00:02:00.000Z',
    fencingToken: '3',
  }));
  mocks.resolveInteraction.mockResolvedValue(typedInteractions[0]);
  mocks.approveInteraction.mockResolvedValue(typedInteractions[0]);
  mocks.answerInteraction.mockResolvedValue(typedInteractions[0]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('typed Agent Session interactions', () => {
  it('projects all nine canonical request kinds without losing the generated request envelope', () => {
    const mapped = mapAgentSessionPendingInteractions(typedInteractions);

    expect(mapped.approvals).toHaveLength(4);
    expect(mapped.questions).toHaveLength(5);
    const projected = [...mapped.approvals, ...mapped.questions];
    for (const record of typedInteractions) {
      expect(projected.find(({ interactionId }) => interactionId === record.interactionId)?.request)
        .toEqual(record.request);
    }
    expect(mapped.questions.find(({ interactionId }) => interactionId === 'typed-04')?.questions)
      .toEqual([{
        id: 'q1',
        header: 'One',
        question: 'First?',
        allowOther: true,
        secret: false,
        options: undefined,
      }]);
  });

  it('claims and resolves approval, elicitation, user-input, and setup envelopes with full typed semantics', async () => {
    const { result } = renderHook(() => useAgentSessionPendingInteractions(
      { agentId: 'agent.codex', sessionId: 'session.typed' },
      0,
      'project.typed\u0001session.typed',
      'project.typed',
    ));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.submitApprovalDecision('typed-01', {
        action: 'accept_with_exec_policy_amendment',
        decision: 'approved',
        execPolicyAmendment: { prefix: ['pnpm'] },
      });
      await result.current.submitApprovalDecision('typed-03', {
        action: 'grant',
        decision: 'approved',
        permissions: { network: true },
        scope: 'session',
        strictAutoReview: true,
      });
      await result.current.submitApprovalDecision('typed-09', {
        action: 'accept',
        content: { app: 'calendar' },
        decision: 'approved',
      });
      await result.current.submitQuestionAnswer('typed-04', {
        action: 'submit',
        answers: { q1: ['first'], q2: ['second'] },
      });
      await result.current.submitQuestionAnswer('typed-08', {
        action: 'continue',
        selectedSources: ['Repository'],
      });
    });

    expect(mocks.resolveInteraction).toHaveBeenCalledTimes(5);
    expect(mocks.resolveInteraction.mock.calls[0]?.[2].resolution).toEqual({
      action: 'accept_with_exec_policy_amendment',
      execPolicyAmendment: { prefix: ['pnpm'] },
    });
    expect(mocks.resolveInteraction.mock.calls[1]?.[2].resolution).toEqual({
      action: 'grant',
      permissions: { network: true },
      scope: 'session',
      strictAutoReview: true,
    });
    expect(mocks.resolveInteraction.mock.calls[2]?.[2].resolution).toEqual({
      action: 'accept',
      content: { app: 'calendar' },
    });
    expect(mocks.resolveInteraction.mock.calls[3]?.[2].resolution).toEqual({
      action: 'submit',
      answers: { q1: ['first'], q2: ['second'] },
    });
    expect(mocks.resolveInteraction.mock.calls[4]?.[2].resolution).toEqual({
      action: 'continue',
      selectedSources: ['Repository'],
    });
    expect(mocks.approveInteraction).not.toHaveBeenCalled();
    expect(mocks.answerInteraction).not.toHaveBeenCalled();
  });

  it('retains approve and answer compatibility only for legacy records', async () => {
    const legacyApproval = interaction('legacy-10', 'approval');
    const legacyQuestion = {
      ...interaction('legacy-11', 'user_question'),
      options: [{ value: 'continue', label: 'Continue' }],
    };
    const records = [legacyApproval, legacyQuestion];
    mocks.listInteractions.mockResolvedValue(page(records));
    mocks.getInteraction.mockImplementation(async (_identity, interactionId: string) => (
      records.find((candidate) => candidate.interactionId === interactionId)!
    ));

    const { result } = renderHook(() => useAgentSessionPendingInteractions(
      { agentId: 'agent.codex', sessionId: 'session.typed' },
      0,
    ));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.submitApprovalDecision('legacy-10', { decision: 'approved' });
      await result.current.submitQuestionAnswer('legacy-11', {
        answer: 'continue',
        optionLabel: 'Continue',
        optionValue: 'continue',
      });
    });

    expect(mocks.approveInteraction).toHaveBeenCalledTimes(1);
    expect(mocks.answerInteraction).toHaveBeenCalledTimes(1);
    expect(mocks.resolveInteraction).not.toHaveBeenCalled();
  });
});
