import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { BirdCoderProject } from '@sdkwork/birdcoder-pc-contracts-commons';

const modulePath = new URL(
  '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/workbench/agentSessionSelection.ts',
  import.meta.url,
);

const {
  buildProjectAgentSessionIndex,
} = await import(`${modulePath.href}?t=${Date.now()}`);

const source = readFileSync(modulePath, 'utf8');

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
        id: 'session-1',
        messages: [],
        modelId: 'gpt-5.4',
        pinned: false,
        projectId: 'project-1',
        runtimeStatus: 'ready',
        sortTimestamp: String(Date.parse('2026-04-22T00:00:00.000Z')),
        status: 'active',
        title: 'First session',
        transcriptUpdatedAt: '2026-04-22T00:00:00.000Z',
        unread: false,
        updatedAt: '2026-04-22T00:00:00.000Z',
        workspaceId: 'workspace-1',
      },
    ],
    createdAt: '2026-04-22T00:00:00.000Z',
    id: 'project-1',
    name: 'Project 1',
    updatedAt: '2026-04-22T00:00:00.000Z',
    workspaceId: 'workspace-1',
  },
];

const firstIndex = buildProjectAgentSessionIndex(projects);
const secondIndex = buildProjectAgentSessionIndex(projects);

assert.equal(
  secondIndex,
  firstIndex,
  'buildProjectAgentSessionIndex must reuse the same computed index for the same projects snapshot reference.',
);

assert.match(
  source,
  /new WeakMap<[\s\S]*readonly BirdCoderProject\[\],[\s\S]*BirdCoderProjectAgentSessionIndex[\s\S]*>\(\)/,
  'agentSessionSelection must keep a weak cache keyed by the projects snapshot reference.',
);

console.log('project/session index cache performance contract passed.');
