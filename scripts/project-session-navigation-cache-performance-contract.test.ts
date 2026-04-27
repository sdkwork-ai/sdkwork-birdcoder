import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { BirdCoderProject } from '@sdkwork/birdcoder-types';

const selectionModulePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/workbench/codingSessionSelection.ts',
  import.meta.url,
);
const codeCommandsPath = new URL(
  '../packages/sdkwork-birdcoder-code/src/pages/useCodeWorkbenchCommands.ts',
  import.meta.url,
);
const studioBindingsPath = new URL(
  '../packages/sdkwork-birdcoder-studio/src/pages/useStudioWorkbenchEventBindings.ts',
  import.meta.url,
);

const selectionSource = readFileSync(selectionModulePath, 'utf8');
const codeCommandsSource = readFileSync(codeCommandsPath, 'utf8');
const studioBindingsSource = readFileSync(studioBindingsPath, 'utf8');

const {
  buildProjectCodingSessionIndex,
} = await import(`${selectionModulePath.href}?t=${Date.now()}`);

const projects: BirdCoderProject[] = [
  {
    archived: false,
    author: 'user-1',
    codingSessions: [
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
    codingSessions: [
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

const sessionIndex = buildProjectCodingSessionIndex(projects);

assert.equal(
  sessionIndex.previousCodingSessionIdById.get('session-a') ?? null,
  null,
  'The first session in project/session traversal order must not report a previous session.',
);

assert.equal(
  sessionIndex.nextCodingSessionIdById.get('session-a') ?? null,
  'session-b',
  'The navigation index must link to the next session without rescanning the full project tree.',
);

assert.equal(
  sessionIndex.previousCodingSessionIdById.get('session-c') ?? null,
  'session-b',
  'The navigation index must preserve cross-project traversal order for previous-session commands.',
);

assert.equal(
  sessionIndex.nextCodingSessionIdById.get('session-c') ?? null,
  null,
  'The last session in project/session traversal order must not report a next session.',
);

assert.match(
  selectionSource,
  /previousCodingSessionIdById: ReadonlyMap<string, string \| null>;/,
  'The shared project/session index must expose previous-session navigation so command handlers can avoid rebuilding flattened session arrays.',
);

assert.match(
  selectionSource,
  /nextCodingSessionIdById: ReadonlyMap<string, string \| null>;/,
  'The shared project/session index must expose next-session navigation so command handlers can avoid rebuilding flattened session arrays.',
);

assert.match(
  codeCommandsSource,
  /buildProjectCodingSessionIndex\(projectsRef\.current\)/,
  'Code workbench commands must reuse the shared project/session index when navigating between sessions.',
);

assert.doesNotMatch(
  codeCommandsSource,
  /projectsRef\.current\.flatMap\(\(project\) => project\.codingSessions\)/,
  'Code workbench commands must not flatten all project sessions on every navigation command.',
);

assert.match(
  studioBindingsSource,
  /buildProjectCodingSessionIndex\(projectsRef\.current\)/,
  'Studio workbench bindings must reuse the shared project/session index when navigating between sessions.',
);

assert.doesNotMatch(
  studioBindingsSource,
  /flatMap\(\(project\) => project\.codingSessions\)/,
  'Studio workbench bindings must not flatten all project sessions on every navigation command.',
);

console.log('project/session navigation cache performance contract passed.');
