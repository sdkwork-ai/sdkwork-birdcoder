import { describe, expect, it } from 'vitest';
import type {
  AgentProjectView,
  AgentSessionView,
} from '@sdkwork/birdcoder-pc-contracts-commons';

import { buildSidebarGlobalSessions } from '../src/components/sessionSidebarPresentation.ts';

const projectId = 'project.sidebar';

function session(id: string, overrides: Partial<AgentSessionView> = {}): AgentSessionView {
  return {
    agentId: 'agent.intelligence.codex',
    createdAt: '2026-08-01T00:00:00.000Z',
    displayTime: 'now',
    engineId: 'codex',
    hostMode: 'desktop',
    id,
    items: [],
    modelId: 'gpt-5',
    projectId,
    providerId: 'provider.openai',
    runtimeStatus: 'ready',
    status: 'active',
    title: id,
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function project(agentSessions: AgentSessionView[]): AgentProjectView {
  return {
    agentSessions,
    createdAt: '2026-08-01T00:00:00.000Z',
    driveAccessMode: 'disabled',
    name: 'Sidebar project',
    organizationId: '0',
    ownerUserId: '100',
    projectId,
    status: 'active',
    tenantId: '100001',
    updatedAt: '2026-08-01T00:00:00.000Z',
    version: '1',
    visibility: 'private',
    workspaceId: 'workspace.sidebar',
  };
}

describe('Session sidebar presentation', () => {
  it('hides rows missing from the provider directory until archived rows are requested', () => {
    const visible = session('visible', {
      providerDirectoryVersion: '1',
      providerSessionId: 'thread-visible',
      providerVisible: true,
    });
    const missing = session('missing', {
      providerArchived: true,
      providerDirectoryVersion: '2',
      providerSessionId: 'thread-missing',
      providerVisible: false,
    });
    const projects = [project([missing, visible])];
    const options = {
      matches: () => true,
      projects,
      sortBy: 'provider' as const,
    };

    expect(buildSidebarGlobalSessions({ ...options, showArchived: false })).toEqual([visible]);
    expect(buildSidebarGlobalSessions({ ...options, showArchived: true })).toEqual([
      missing,
      visible,
    ]);
  });
});
