// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AgentSessionView } from '@sdkwork/birdcoder-pc-contracts-commons';
import { ProjectExplorerSessionRow } from './ProjectExplorerSessionRow.tsx';

afterEach(cleanup);

const runtimeStatusLabels = {
  awaitingApproval: 'Awaiting approval',
  awaitingTool: 'Awaiting tool',
  awaitingUser: 'Needs input',
  executing: 'Working',
  failed: 'Failed',
  initializing: 'Starting',
  stale: 'Status stale',
  unknown: 'Status unknown',
};

function createPinnedSession(): AgentSessionView {
  return {
    id: 'session.pinned-attention',
    agentId: 'agent.code-engine.codex',
    archived: true,
    createdAt: '2026-07-31T00:00:00.000Z',
    displayTime: 'Just now',
    engineId: 'codex',
    hostMode: 'desktop',
    items: [],
    modelId: 'gpt-5-codex',
    pinned: true,
    projectId: 'project.birdcoder',
    providerId: 'provider.model.codex',
    runtimeStatus: 'awaiting_approval',
    status: 'active',
    title: 'Review workspace command',
    unread: true,
    updatedAt: '2026-07-31T00:01:00.000Z',
  };
}

describe('ProjectExplorerSessionRow pinned attention state', () => {
  it('keeps provider, unread, archive, and runtime attention visible', () => {
    const { container } = render(
      <ProjectExplorerSessionRow
        isRenaming={false}
        isSelected={false}
        moreActionsLabel="More actions"
        onAgentSessionContextMenu={vi.fn()}
        onRenameCancel={vi.fn()}
        onRenameSubmit={vi.fn()}
        onRenameValueChange={vi.fn()}
        onSelectAgentSession={vi.fn()}
        paddingClassName="px-2"
        relativeTimeNow={Date.parse('2026-07-31T00:02:00.000Z')}
        renameValue=""
        runtimeStatusLabels={runtimeStatusLabels}
        session={createPinnedSession()}
        variant="pinned"
      />,
    );

    expect(container.querySelector('[data-session-provider-badge="leading"]')).toBeTruthy();
    expect(container.querySelector('[data-session-unread="true"]')).toBeTruthy();
    expect(container.querySelector('[data-session-archived="true"]')).toBeTruthy();
    expect(container.querySelector('[data-session-runtime-status="awaiting_approval"]')).toBeTruthy();
    expect(screen.getByText('Awaiting approval')).toBeTruthy();
  });
});
