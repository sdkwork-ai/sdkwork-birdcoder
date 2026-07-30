// @vitest-environment jsdom

import { act } from 'react';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type {
  AgentProjectView,
  AgentSessionView,
} from '@sdkwork/birdcoder-pc-contracts-commons';
import { buildProjectAgentSessionIndex } from '@sdkwork/birdcoder-pc-workbench/workbench/agentSessionSelection';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useCodePageSessionSelection } from '../src/pages/useCodePageSessionSelection.ts';

function session(projectId: string, id: string): AgentSessionView {
  return {
    agentId: 'agent.code-engine.codex',
    createdAt: '2026-07-30T00:00:00.000Z',
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
    title: `Session ${id}`,
    updatedAt: '2026-07-30T00:00:00.000Z',
  };
}

function project(projectId: string, agentSessionId: string): AgentProjectView {
  return {
    agentSessions: [session(projectId, agentSessionId)],
    createdAt: '2026-07-30T00:00:00.000Z',
    driveAccessMode: 'disabled',
    name: projectId,
    organizationId: 'organization.one',
    ownerUserId: 'user.one',
    projectId,
    status: 'active',
    tenantId: 'tenant.one',
    updatedAt: '2026-07-30T00:00:00.000Z',
    version: '1',
    visibility: 'private',
    workspaceId: 'workspace.one',
  };
}

const projects = [
  project('project.one', 'session.one'),
  project('project.two', 'session.two'),
  project('project.three', 'session.three'),
];
const projectAgentSessionIndex = buildProjectAgentSessionIndex(projects);

afterEach(() => {
  cleanup();
});

describe('useCodePageSessionSelection', () => {
  it('synchronizes an external initial selection without writing stale local state back', async () => {
    const onAgentSessionChange = vi.fn();

    const { result } = renderHook(() => useCodePageSessionSelection({
      clearPendingNewAgentSessionRequest: vi.fn(),
      hasFetchedProjects: true,
      initialAgentSessionId: 'session.one',
      isVisible: true,
      onAgentSessionChange,
      projectAgentSessionIndex,
      projectId: 'project.one',
    }));

    await waitFor(() => {
      expect(result.current.currentProjectId).toBe('project.one');
      expect(result.current.sessionId).toBe('session.one');
    });
    expect(onAgentSessionChange).not.toHaveBeenCalled();
  });

  it('lets an external cross-project selection supersede a pending local selection', async () => {
    const onAgentSessionChange = vi.fn();
    const props = {
      initialAgentSessionId: 'session.one',
      projectId: 'project.one',
    };
    const { rerender, result } = renderHook(() => useCodePageSessionSelection({
      clearPendingNewAgentSessionRequest: vi.fn(),
      hasFetchedProjects: true,
      initialAgentSessionId: props.initialAgentSessionId,
      isVisible: true,
      onAgentSessionChange,
      projectAgentSessionIndex,
      projectId: props.projectId,
    }));

    await waitFor(() => {
      expect(result.current.sessionId).toBe('session.one');
    });

    act(() => {
      result.current.selectSession('session.two', { projectId: 'project.two' });
    });
    await waitFor(() => {
      expect(result.current.currentProjectId).toBe('project.two');
      expect(result.current.sessionId).toBe('session.two');
    });
    await waitFor(() => {
      expect(onAgentSessionChange).toHaveBeenCalledWith('session.two', 'project.two');
    });
    onAgentSessionChange.mockClear();

    props.projectId = 'project.three';
    props.initialAgentSessionId = 'session.three';
    rerender();

    await waitFor(() => {
      expect(result.current.currentProjectId).toBe('project.three');
      expect(result.current.sessionId).toBe('session.three');
    });
    expect(onAgentSessionChange).not.toHaveBeenCalled();
  });
});
