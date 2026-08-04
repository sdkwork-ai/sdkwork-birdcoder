import { describe, expect, it } from 'vitest';
import type {
  AgentProjectView,
  AgentSessionView,
} from '@sdkwork/birdcoder-pc-contracts-commons';

import {
  buildDesktopTraySessionMenuSnapshot,
  parseDesktopTrayAction,
  type DesktopTraySessionMenuLabels,
} from '../src/workbench/desktopTraySessionMenu.ts';

const labels: DesktopTraySessionMenuLabels = {
  exit: 'Exit',
  more: 'More',
  newChat: 'New Chat',
  openApplication: 'Open BirdCoder',
  pinned: 'Pinned',
  recent: 'Recent',
  running: 'Running',
  untitledSession: 'Untitled session',
};

function session({
  id,
  projectId = 'project.one',
  runtimeStatus = 'ready',
  updatedAt,
  ...overrides
}: {
  id: string;
  projectId?: string;
  runtimeStatus?: AgentSessionView['runtimeStatus'];
  updatedAt: string;
} & Partial<AgentSessionView>): AgentSessionView {
  return {
    agentId: 'agent.codex',
    createdAt: updatedAt,
    displayTime: 'now',
    engineId: 'codex',
    hostMode: 'desktop',
    id,
    items: [],
    modelId: 'gpt-5',
    projectId,
    providerId: 'provider.openai',
    runtimeStatus,
    status: 'active',
    title: `Session ${id}`,
    updatedAt,
    ...overrides,
  };
}

function project(
  projectId: string,
  name: string,
  agentSessions: AgentSessionView[],
): AgentProjectView {
  return {
    agentSessions,
    createdAt: '2026-07-01T00:00:00.000Z',
    driveAccessMode: 'disabled',
    name,
    organizationId: '2001',
    ownerUserId: '3001',
    projectId,
    status: 'active',
    tenantId: '1001',
    updatedAt: '2026-07-29T00:00:00.000Z',
    version: '1',
    visibility: 'private',
    workspaceId: 'workspace.one',
  };
}

describe('desktop tray session menu', () => {
  it('groups loaded sessions by activity while reserving overflow for More', () => {
    const sessions = [
      session({
        id: 'running',
        runtimeStatus: 'streaming',
        updatedAt: '2026-07-29T10:08:00.000Z',
      }),
      session({
        id: 'recent-two',
        updatedAt: '2026-07-29T10:07:00.000Z',
      }),
      session({
        id: 'recent-three',
        updatedAt: '2026-07-29T10:06:00.000Z',
      }),
      session({
        id: 'pinned',
        pinned: true,
        title: 'Pinned review',
        updatedAt: '2026-07-29T10:05:00.000Z',
      }),
      session({
        id: 'overflow',
        updatedAt: '2026-07-29T10:04:00.000Z',
      }),
      session({
        archived: true,
        id: 'archived',
        updatedAt: '2026-07-29T10:09:00.000Z',
      }),
      session({
        id: 'provider-archived',
        providerArchived: true,
        updatedAt: '2026-07-29T10:10:00.000Z',
      }),
      session({
        id: 'provider-hidden',
        providerVisible: false,
        updatedAt: '2026-07-29T10:11:00.000Z',
      }),
    ];

    const snapshot = buildDesktopTraySessionMenuSnapshot({
      labels,
      newChatEnabled: true,
      projects: [project('project.one', 'BirdCoder', sessions)],
    });

    expect(snapshot.running.map(({ sessionId }) => sessionId)).toEqual(['running']);
    expect(snapshot.pinned.map(({ sessionId }) => sessionId)).toEqual(['pinned']);
    expect(snapshot.recent.map(({ sessionId }) => sessionId)).toEqual([
      'running',
      'recent-two',
      'recent-three',
    ]);
    expect(snapshot.more.map(({ sessionId }) => sessionId)).toEqual(['overflow']);
    expect(snapshot.more[0]).toMatchObject({
      projectId: 'project.one',
      projectName: 'BirdCoder',
    });
  });

  it('keeps duplicate provider session ids distinct across project scope', () => {
    const first = session({
      id: 'shared-id',
      projectId: 'project.one',
      updatedAt: '2026-07-29T10:00:00.000Z',
    });
    const second = session({
      id: 'shared-id',
      projectId: 'project.two',
      updatedAt: '2026-07-29T09:59:00.000Z',
    });

    const snapshot = buildDesktopTraySessionMenuSnapshot({
      labels,
      newChatEnabled: true,
      projects: [
        project('project.one', 'One', [first]),
        project('project.two', 'Two', [second]),
      ],
    });

    expect(snapshot.recent).toEqual([
      expect.objectContaining({ projectId: 'project.one', sessionId: 'shared-id' }),
      expect.objectContaining({ projectId: 'project.two', sessionId: 'shared-id' }),
    ]);
  });

  it('uses provider pin and recency ordering consistently with the Session inbox', () => {
    const sessions = [
      session({
        id: 'provider-newest',
        providerRecencyAt: '2026-07-29T12:00:00.000Z',
        providerSessionId: 'provider-newest',
        providerSortKey: '2',
        updatedAt: '2026-07-29T09:00:00.000Z',
      }),
      session({
        id: 'provider-pinned',
        providerPinned: true,
        providerRecencyAt: '2026-07-29T08:00:00.000Z',
        providerSessionId: 'provider-pinned',
        providerSortKey: '1',
        updatedAt: '2026-07-29T08:00:00.000Z',
      }),
      session({
        id: 'activity-newest',
        providerRecencyAt: '2026-07-29T07:00:00.000Z',
        providerSessionId: 'activity-newest',
        providerSortKey: '3',
        updatedAt: '2026-07-29T13:00:00.000Z',
      }),
    ];

    const snapshot = buildDesktopTraySessionMenuSnapshot({
      labels,
      newChatEnabled: true,
      projects: [project('project.one', 'BirdCoder', sessions)],
    });

    expect(snapshot.recent.map(({ sessionId }) => sessionId)).toEqual([
      'provider-pinned',
      'provider-newest',
      'activity-newest',
    ]);
  });

  it('bounds the More submenu to the latest 50 loaded overflow sessions', () => {
    const sessions = Array.from({ length: 80 }, (_, index) => session({
      id: `session-${index.toString().padStart(2, '0')}`,
      updatedAt: new Date(Date.UTC(2026, 6, 29, 10, 0, 0) - index * 1_000).toISOString(),
    }));

    const snapshot = buildDesktopTraySessionMenuSnapshot({
      labels,
      newChatEnabled: true,
      projects: [project('project.one', 'BirdCoder', sessions)],
    });

    expect(snapshot.more).toHaveLength(50);
    expect(snapshot.more[0]?.sessionId).toBe('session-03');
    expect(snapshot.more.at(-1)?.sessionId).toBe('session-52');
  });

  it('accepts only typed tray actions with scoped session identity', () => {
    expect(parseDesktopTrayAction({ type: 'newChat' })).toEqual({ type: 'newChat' });
    expect(parseDesktopTrayAction({
      projectId: ' project.one ',
      sessionId: ' session.one ',
      type: 'openSession',
    })).toEqual({
      projectId: 'project.one',
      sessionId: 'session.one',
      type: 'openSession',
    });
    expect(parseDesktopTrayAction({ sessionId: 'session.one', type: 'openSession' })).toBeNull();
    expect(parseDesktopTrayAction({ type: 'unknown' })).toBeNull();
  });
});
