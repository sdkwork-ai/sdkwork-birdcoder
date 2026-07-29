import { describe, expect, it, vi } from 'vitest';
import type { IAgentSessionService } from '@sdkwork/birdcoder-pc-infrastructure-runtime';

import { resolveProjectTerminalRuntimeLocationId } from '../src/terminal/projectTerminalRuntimeLocation.ts';

type AgentSessionRecord = Awaited<
  ReturnType<IAgentSessionService['listSessionsByProject']>
>['items'][number];
type RuntimeBindingRecord = Awaited<
  ReturnType<IAgentSessionService['listRuntimeBindings']>
>['items'][number];

function createAgentSessionService(overrides: Partial<IAgentSessionService>): IAgentSessionService {
  return overrides as IAgentSessionService;
}

const pageInfo = {
  hasMore: false,
  mode: 'offset' as const,
  page: 1,
  pageSize: 20,
};

function createAgentSessionRecord(
  overrides: Partial<AgentSessionRecord>,
): AgentSessionRecord {
  return {
    id: 'id.session.default',
    agentId: 'agent.birdcoder',
    createdAt: '2026-07-15T10:00:00.000Z',
    createdBy: '1',
    entrySurface: 'pc',
    itemCount: '0',
    lastItemSequence: '0',
    organizationId: '0',
    ownerUserId: '1',
    projectId: 'project.one',
    sessionId: 'session.default',
    sessionKind: 'coding',
    status: 'active',
    tenantId: '0',
    totalInputTokens: '0',
    totalOutputTokens: '0',
    updatedAt: '2026-07-15T10:00:00.000Z',
    updatedBy: '1',
    version: '1',
    ...overrides,
  };
}

function createRuntimeBindingRecord(
  overrides: Partial<RuntimeBindingRecord>,
): RuntimeBindingRecord {
  return {
    createdAt: '2026-07-15T10:00:00.000Z',
    hostMode: 'server',
    isCurrent: true,
    modelId: 'gpt-5',
    organizationId: '0',
    providerBindingId: 'provider-binding.default',
    providerId: 'openai',
    runtimeBindingId: 'runtime-binding.default',
    sessionId: 'session.default',
    status: 'active',
    tenantId: '0',
    transportKind: 'runtime-node',
    updatedAt: '2026-07-15T10:00:00.000Z',
    version: '1',
    ...overrides,
  };
}

describe('resolveProjectTerminalRuntimeLocationId', () => {
  it('uses the selected Agent Session current active runtime binding', async () => {
    const listSessionsByProject = vi.fn<IAgentSessionService['listSessionsByProject']>();
    const listRuntimeBindings = vi.fn<IAgentSessionService['listRuntimeBindings']>(async () => ({
      items: [createRuntimeBindingRecord({
        isCurrent: true,
        runtimeLocationId: ' runtime.selected ',
        status: 'active',
      })],
      pageInfo,
    }));
    const service = createAgentSessionService({
      listRuntimeBindings,
      listSessionsByProject,
    });

    await expect(resolveProjectTerminalRuntimeLocationId(service, {
      agentId: 'agent.intelligence.codex',
      agentSessionId: 'session.selected',
      projectId: 'project.one',
    })).resolves.toBe('runtime.selected');
    expect(listSessionsByProject).not.toHaveBeenCalled();
    expect(listRuntimeBindings).toHaveBeenCalledWith(
      {
        agentId: 'agent.intelligence.codex',
        sessionId: 'session.selected',
      },
      { page: 1, pageSize: 20 },
      { signal: undefined },
    );
  });

  it('falls back to the project latest active Agent Session', async () => {
    const listSessionsByProject = vi.fn<IAgentSessionService['listSessionsByProject']>(async () => ({
      items: [
        createAgentSessionRecord({
          sessionId: 'session.older',
          updatedAt: '2026-07-15T10:00:00.000Z',
        }),
        createAgentSessionRecord({
          lastItemAt: '2026-07-15T12:00:00.000Z',
          sessionId: 'session.latest',
          updatedAt: '2026-07-15T11:00:00.000Z',
        }),
      ],
      pageInfo,
    }));
    const listRuntimeBindings = vi.fn<IAgentSessionService['listRuntimeBindings']>(async () => ({
      items: [createRuntimeBindingRecord({
        isCurrent: true,
        runtimeLocationId: 'runtime.latest',
        status: 'active',
      })],
      pageInfo,
    }));
    const service = createAgentSessionService({
      listRuntimeBindings,
      listSessionsByProject,
    });

    await expect(resolveProjectTerminalRuntimeLocationId(service, {
      projectId: 'project.one',
    })).resolves.toBe('runtime.latest');
    expect(listSessionsByProject).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      projectId: 'project.one',
      status: 'active',
    }, { signal: undefined });
    expect(listRuntimeBindings).toHaveBeenCalledWith(
      {
        agentId: 'agent.birdcoder',
        sessionId: 'session.latest',
      },
      { page: 1, pageSize: 20 },
      { signal: undefined },
    );
  });

  it('rejects inactive and non-current runtime bindings', async () => {
    const service = createAgentSessionService({
      listRuntimeBindings: vi.fn<IAgentSessionService['listRuntimeBindings']>(async () => ({
        items: [
          createRuntimeBindingRecord({
            isCurrent: true,
            runtimeLocationId: 'runtime.inactive',
            status: 'deactivated',
          }),
          createRuntimeBindingRecord({
            isCurrent: false,
            runtimeLocationId: 'runtime.other',
            status: 'active',
          }),
        ],
        pageInfo,
      })),
    });

    await expect(resolveProjectTerminalRuntimeLocationId(service, {
      agentId: 'agent.intelligence.opencode',
      agentSessionId: 'session.selected',
      projectId: 'project.one',
    })).resolves.toBeNull();
  });

  it('does not guess an Agent for a selected Session', async () => {
    const listRuntimeBindings = vi.fn<IAgentSessionService['listRuntimeBindings']>();
    const service = createAgentSessionService({ listRuntimeBindings });

    await expect(resolveProjectTerminalRuntimeLocationId(service, {
      agentSessionId: 'session.selected',
      projectId: 'project.one',
    })).rejects.toThrow('Agent ID is required');
    expect(listRuntimeBindings).not.toHaveBeenCalled();
  });
});
