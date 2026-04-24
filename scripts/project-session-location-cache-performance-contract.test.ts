import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { BirdCoderProject } from '@sdkwork/birdcoder-types';

const modulePath = new URL(
  '../packages/sdkwork-birdcoder-commons/src/workbench/codingSessionSelection.ts',
  import.meta.url,
);

const {
  buildProjectCodingSessionIndex,
  resolveCodingSessionLocationInProjects,
  resolveProjectIdByCodingSessionId,
} = await import(`${modulePath.href}?t=${Date.now()}`);

const source = readFileSync(modulePath, 'utf8');

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
        id: 'session-1',
        messages: [],
        modelId: 'gpt-5.4',
        pinned: false,
        projectId: 'project-1',
        runtimeStatus: 'ready',
        sortTimestamp: Date.parse('2026-04-22T00:00:00.000Z'),
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

const sessionIndex = buildProjectCodingSessionIndex(projects);
const resolvedLocation = resolveCodingSessionLocationInProjects(projects, 'session-1');

assert.equal(
  resolvedLocation,
  sessionIndex.codingSessionLocationsById.get('session-1') ?? null,
  'resolveCodingSessionLocationInProjects must reuse the shared cached location entry instead of rebuilding a new object.',
);

assert.equal(
  resolveProjectIdByCodingSessionId(projects, 'session-1'),
  'project-1',
  'resolveProjectIdByCodingSessionId must still resolve the owning project id through the shared cached session index.',
);

assert.match(
  source,
  /resolveCodingSessionLocationInProjects[\s\S]*buildProjectCodingSessionIndex\(projects\)/,
  'resolveCodingSessionLocationInProjects must reuse the shared project/session index instead of rescanning every project.',
);

assert.match(
  source,
  /resolveProjectIdByCodingSessionId[\s\S]*buildProjectCodingSessionIndex\(projects\)/,
  'resolveProjectIdByCodingSessionId must resolve project ownership from the shared project/session index.',
);

console.log('project/session location cache performance contract passed.');
