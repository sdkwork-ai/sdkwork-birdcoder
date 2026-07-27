import { describe, expect, it } from 'vitest';
import type {
  AgentProjectView,
  AgentSessionActivityView,
  AgentSessionView,
} from '@sdkwork/birdcoder-pc-contracts-commons';

import {
  expireAgentSessionRuntimeStatuses,
  resolveAgentSessionActivityRuntimeStatus,
  resolveNextAgentSessionActivityExpiryAt,
} from '../src/workbench/agentSessionActivity.ts';

const observedAt = '2026-07-27T10:00:00.000Z';
const freshUntil = '2026-07-27T10:00:30.000Z';

function activity(
  overrides: Partial<AgentSessionActivityView> = {},
): AgentSessionActivityView {
  return {
    activityAt: observedAt,
    freshness: 'fresh',
    freshUntil,
    observedAt,
    phase: 'running',
    source: 'runtime_binding',
    versions: { session: '1', currentRuntimeBinding: '1' },
    ...overrides,
  };
}

function session(sessionActivity: AgentSessionActivityView): AgentSessionView {
  return {
    activity: sessionActivity,
    agentId: 'agent.code-engine.codex',
    createdAt: observedAt,
    displayTime: 'now',
    engineId: 'codex',
    hostMode: 'desktop',
    id: 'session.activity',
    items: [],
    modelId: 'gpt-5',
    projectId: 'project.activity',
    providerId: 'provider.openai',
    runtimeStatus: 'streaming',
    status: 'active',
    title: 'Activity test',
    updatedAt: observedAt,
  };
}

function project(agentSession: AgentSessionView): AgentProjectView {
  return {
    agentSessions: [agentSession],
    createdAt: observedAt,
    driveAccessMode: 'disabled',
    name: 'Activity project',
    organizationId: '2001',
    ownerUserId: '3001',
    projectId: agentSession.projectId,
    status: 'active',
    tenantId: '1001',
    updatedAt: observedAt,
    version: '1',
    visibility: 'private',
    workspaceId: 'workspace.activity',
  };
}

describe('Agent Session activity projection', () => {
  it('maps provider and authority phases without animating attention states', () => {
    const now = Date.parse('2026-07-27T10:00:15.000Z');
    expect(resolveAgentSessionActivityRuntimeStatus(activity(), now)).toBe('streaming');
    expect(resolveAgentSessionActivityRuntimeStatus(activity({ phase: 'queued' }), now))
      .toBe('initializing');
    expect(resolveAgentSessionActivityRuntimeStatus(activity({
      phase: 'awaiting_input',
      pendingInteraction: {
        id: 'interaction.approval',
        kind: 'approval',
        status: 'pending',
        updatedAt: observedAt,
        version: '2',
      },
    }), now)).toBe('awaiting_approval');
    expect(resolveAgentSessionActivityRuntimeStatus(activity({
      phase: 'waiting',
      provider: {
        freshness: 'fresh',
        interactionHint: 'user_input_required',
        state: 'waiting',
      },
    }), now)).toBe('awaiting_user');
  });

  it('materializes an expired lease as stale for every Store consumer', () => {
    const initialProject = project(session(activity()));
    const beforeExpiry = Date.parse('2026-07-27T10:00:29.000Z');
    const afterExpiry = Date.parse('2026-07-27T10:00:31.000Z');

    expect(expireAgentSessionRuntimeStatuses([initialProject], beforeExpiry)[0])
      .toBe(initialProject);
    const expiredProjects = expireAgentSessionRuntimeStatuses([initialProject], afterExpiry);
    const expiredSession = expiredProjects[0]!.agentSessions[0]!;
    expect(expiredSession.runtimeStatus).toBe('stale');
    expect(expiredSession.activity?.freshness).toBe('stale');
    expect(expiredSession.activity?.phase).toBe('unknown');
    expect(resolveNextAgentSessionActivityExpiryAt(expiredProjects, afterExpiry)).toBeNull();
  });

  it('returns the nearest future expiry across providers', () => {
    const now = Date.parse('2026-07-27T10:00:00.000Z');
    const codex = session(activity({ freshUntil: '2026-07-27T10:00:25.000Z' }));
    const claude = {
      ...session(activity({ freshUntil: '2026-07-27T10:00:10.000Z' })),
      id: 'session.claude',
      engineId: 'claude-code',
      providerId: 'provider.anthropic',
    };
    expect(resolveNextAgentSessionActivityExpiryAt([
      { ...project(codex), agentSessions: [codex, claude] },
    ], now)).toBe(Date.parse('2026-07-27T10:00:10.000Z'));
  });
});
