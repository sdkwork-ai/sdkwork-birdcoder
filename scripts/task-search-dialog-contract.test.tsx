import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type {
  AgentProjectView,
  AgentSessionView,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/index.ts';
import { TaskSearchDialog } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/components/TaskSearchDialog.tsx';
import { buildTaskSearchEntries } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/components/taskSearch.ts';

function createSession(
  id: string,
  title: string,
  updatedAt: string,
  overrides: Partial<AgentSessionView> = {},
): AgentSessionView {
  return {
    agentId: 'agent.codex',
    createdAt: updatedAt,
    displayTime: 'now',
    engineId: 'codex',
    hostMode: 'desktop',
    id,
    items: [],
    modelId: 'gpt-5',
    projectId: 'project-1',
    providerId: 'openai',
    status: 'active',
    title,
    updatedAt,
    ...overrides,
  };
}

function createProject(
  projectId: string,
  name: string,
  agentSessions: AgentSessionView[],
): AgentProjectView {
  return {
    agentSessions: agentSessions.map((session) => ({ ...session, projectId })),
    agentSessionPageInfo: { hasMore: false, page: 1, pageSize: 20 },
    createdAt: '2026-07-28T08:00:00.000Z',
    driveAccessMode: 'disabled',
    name,
    organizationId: '0',
    ownerUserId: '100001',
    projectId,
    status: 'active',
    tenantId: '100001',
    updatedAt: '2026-07-28T08:00:00.000Z',
    version: '1',
    visibility: 'private',
    workspaceId: 'workspace-1',
  };
}

const projects = [
  createProject('project-1', 'BirdCoder', [
    createSession('older', 'Repair release flow', '2026-07-28T08:00:00.000Z'),
    createSession('newer', 'Improve task search', '2026-07-28T10:00:00.000Z'),
  ]),
  createProject('project-2', 'ClawRouter', [
    createSession('router', 'Fix upstream list', '2026-07-28T09:00:00.000Z', {
      engineId: 'claude-code',
      modelId: 'claude-sonnet-4',
      providerId: 'anthropic',
    }),
  ]),
];

assert.deepEqual(
  buildTaskSearchEntries(projects, '').map((entry) => entry.session.id),
  ['newer', 'router', 'older'],
  'Task search must show the most recently active loaded tasks first.',
);
assert.deepEqual(
  buildTaskSearchEntries(projects, 'clawrouter').map((entry) => entry.session.id),
  ['router'],
  'Task search must match project names.',
);
assert.deepEqual(
  buildTaskSearchEntries(projects, 'anthropic sonnet').map((entry) => entry.session.id),
  ['router'],
  'Task search must match provider and model tokens.',
);

const dialogHtml = renderToStaticMarkup(
  <TaskSearchDialog
    canCreateTask
    canSearchFiles
    labels={{
      clearSearch: 'Clear task search',
      newTask: 'New task',
      noTasksFound: 'No tasks found',
      openFolder: 'Open folder',
      recommendations: 'Recommended',
      searchFiles: 'Search files',
      searchPlaceholder: 'Search tasks',
      selectProjectFirst: 'Select a project first',
      tasks: 'Tasks',
    }}
    projects={projects}
    query=""
    runtimeStatusLabels={{
      awaitingApproval: 'Awaiting approval',
      awaitingTool: 'Awaiting tool',
      awaitingUser: 'Awaiting user',
      executing: 'Executing',
      failed: 'Failed',
      initializing: 'Initializing',
      stale: 'Stale',
      unknown: 'Unknown',
    }}
    selectedProjectId="project-1"
    selectedSessionId="newer"
    onClose={() => undefined}
    onCreateTask={() => undefined}
    onOpenFolder={() => undefined}
    onQueryChange={() => undefined}
    onSearchFiles={() => undefined}
    onSelectTask={() => undefined}
  />,
);

assert.match(dialogHtml, /data-task-search-dialog="true"/u);
assert.match(dialogHtml, /role="dialog"/u);
assert.match(dialogHtml, /aria-modal="true"/u);
assert.match(dialogHtml, /placeholder="Search tasks"/u);
assert.match(dialogHtml, /Improve task search/u);
assert.match(dialogHtml, /BirdCoder/u);
assert.match(dialogHtml, /Ctrl\+1/u);
assert.match(dialogHtml, /New task/u);
assert.match(dialogHtml, /Open folder/u);
assert.match(dialogHtml, /Search files/u);

console.log('task search dialog contract passed.');
