import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { BirdCoderProject } from '@sdkwork/birdcoder-pc-contracts-commons';

const selectionModulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/workbench/agentSessionSelection.ts',
  import.meta.url,
);
const codeCommandsPath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-code/src/pages/useCodeWorkbenchCommands.ts',
  import.meta.url,
);
const studioBindingsPath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-studio/src/pages/useStudioWorkbenchEventBindings.ts',
  import.meta.url,
);

const selectionSource = readFileSync(selectionModulePath, 'utf8');
const codeCommandsSource = readFileSync(codeCommandsPath, 'utf8');
const studioBindingsSource = readFileSync(studioBindingsPath, 'utf8');

const {
  buildProjectAgentSessionIndex,
} = await import(`${selectionModulePath.href}?t=${Date.now()}`);

const projects: BirdCoderProject[] = [
  {
    archived: false,
    author: 'user-1',
    agentSessions: [
      {
        archived: false,
        createdAt: '2026-04-22T00:00:00.000Z',
        displayTime: 'just now',
        engineId: 'codex',
        hostMode: 'desktop',
        id: 'session-a',
        messages: [],
        modelId: 'gpt-5.4',
        pinned: false,
        projectId: 'project-a',
        runtimeStatus: 'ready',
        sortTimestamp: String(Date.parse('2026-04-22T00:00:00.000Z')),
        status: 'active',
        title: 'Session A',
        transcriptUpdatedAt: '2026-04-22T00:00:00.000Z',
        unread: false,
        updatedAt: '2026-04-22T00:00:00.000Z',
        workspaceId: 'workspace-1',
      },
      {
        archived: false,
        createdAt: '2026-04-22T00:01:00.000Z',
        displayTime: 'just now',
        engineId: 'codex',
        hostMode: 'desktop',
        id: 'session-b',
        messages: [],
        modelId: 'gpt-5.4',
        pinned: false,
        projectId: 'project-a',
        runtimeStatus: 'ready',
        sortTimestamp: String(Date.parse('2026-04-22T00:01:00.000Z')),
        status: 'active',
        title: 'Session B',
        transcriptUpdatedAt: '2026-04-22T00:01:00.000Z',
        unread: false,
        updatedAt: '2026-04-22T00:01:00.000Z',
        workspaceId: 'workspace-1',
      },
    ],
    createdAt: '2026-04-22T00:00:00.000Z',
    id: 'project-a',
    name: 'Project A',
    updatedAt: '2026-04-22T00:01:00.000Z',
    workspaceId: 'workspace-1',
  },
  {
    archived: false,
    author: 'user-1',
    agentSessions: [
      {
        archived: false,
        createdAt: '2026-04-22T00:02:00.000Z',
        displayTime: 'just now',
        engineId: 'codex',
        hostMode: 'desktop',
        id: 'session-c',
        messages: [],
        modelId: 'gpt-5.4',
        pinned: false,
        projectId: 'project-b',
        runtimeStatus: 'ready',
        sortTimestamp: String(Date.parse('2026-04-22T00:02:00.000Z')),
        status: 'active',
        title: 'Session C',
        transcriptUpdatedAt: '2026-04-22T00:02:00.000Z',
        unread: false,
        updatedAt: '2026-04-22T00:02:00.000Z',
        workspaceId: 'workspace-1',
      },
    ],
    createdAt: '2026-04-22T00:02:00.000Z',
    id: 'project-b',
    name: 'Project B',
    updatedAt: '2026-04-22T00:02:00.000Z',
    workspaceId: 'workspace-1',
  },
];

const sessionIndex = buildProjectAgentSessionIndex(projects);

assert.equal(
  sessionIndex.previousAgentSessionIdById.get('session-a') ?? null,
  null,
  'The first session in project/session traversal order must not report a previous session.',
);

assert.equal(
  sessionIndex.nextAgentSessionIdById.get('session-a') ?? null,
  'session-b',
  'The navigation index must link to the next session without rescanning the full project tree.',
);

assert.equal(
  sessionIndex.previousAgentSessionIdById.get('session-c') ?? null,
  'session-b',
  'The navigation index must preserve cross-project traversal order for previous-session commands.',
);

assert.equal(
  sessionIndex.nextAgentSessionIdById.get('session-c') ?? null,
  null,
  'The last session in project/session traversal order must not report a next session.',
);

assert.match(
  selectionSource,
  /previousAgentSessionIdById: ReadonlyMap<string, string \| null>;/,
  'The shared project/session index must expose previous-session navigation so command handlers can avoid rebuilding flattened session arrays.',
);

assert.match(
  selectionSource,
  /nextAgentSessionIdById: ReadonlyMap<string, string \| null>;/,
  'The shared project/session index must expose next-session navigation so command handlers can avoid rebuilding flattened session arrays.',
);

assert.match(
  codeCommandsSource,
  /buildProjectAgentSessionIndex\(projectsRef\.current\)/,
  'Code workbench commands must reuse the shared project/session index when navigating between sessions.',
);

assert.doesNotMatch(
  codeCommandsSource,
  /projectsRef\.current\.flatMap\(\(project\) => project\.agentSessions\)/,
  'Code workbench commands must not flatten all project sessions on every navigation command.',
);

assert.match(
  studioBindingsSource,
  /buildProjectAgentSessionIndex\(projectsRef\.current\)/,
  'Studio workbench bindings must reuse the shared project/session index when navigating between sessions.',
);

assert.doesNotMatch(
  studioBindingsSource,
  /flatMap\(\(project\) => project\.agentSessions\)/,
  'Studio workbench bindings must not flatten all project sessions on every navigation command.',
);

console.log('project/session navigation cache performance contract passed.');
