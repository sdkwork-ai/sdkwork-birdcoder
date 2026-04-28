import assert from 'node:assert/strict';
import { mergeProjectsForStore } from '../packages/sdkwork-birdcoder-commons/src/stores/projectsStore.ts';
import type {
  BirdCoderChatMessage,
  BirdCoderCodingSession,
  BirdCoderProject,
} from '../packages/sdkwork-birdcoder-types/src/index.ts';

function buildMessage(
  overrides: Partial<BirdCoderChatMessage> = {},
): BirdCoderChatMessage {
  return {
    id: 'message-1',
    codingSessionId: 'session-1',
    role: 'assistant',
    content: 'Ready.',
    createdAt: '2026-04-28T01:00:00.000Z',
    ...overrides,
  };
}

function buildCodingSession(
  overrides: Partial<BirdCoderCodingSession> = {},
): BirdCoderCodingSession {
  return {
    id: 'session-1',
    workspaceId: 'workspace-1',
    projectId: 'project-1',
    title: 'Identity Session',
    status: 'active',
    hostMode: 'desktop',
    engineId: 'codex',
    modelId: 'gpt-5.4',
    createdAt: '2026-04-28T01:00:00.000Z',
    updatedAt: '2026-04-28T01:00:00.000Z',
    lastTurnAt: '2026-04-28T01:00:00.000Z',
    transcriptUpdatedAt: '2026-04-28T01:00:00.000Z',
    displayTime: 'Just now',
    messages: [],
    ...overrides,
  };
}

function buildProject(
  overrides: Partial<BirdCoderProject> = {},
): BirdCoderProject {
  return {
    id: 'project-1',
    workspaceId: 'workspace-1',
    name: 'Identity Project',
    path: 'D:/workspace/identity-project',
    createdAt: '2026-04-28T01:00:00.000Z',
    updatedAt: '2026-04-28T01:00:00.000Z',
    archived: false,
    codingSessions: [],
    ...overrides,
  };
}

const preservedMessages = [
  buildMessage({
    id: 'message-preserved',
    codingSessionId: 'session-preserved',
    content: 'Keep transcript payload from the richer duplicate.',
  }),
];

const mergedDuplicateProjects = mergeProjectsForStore(
  [],
  [
    buildProject({
      id: 'project-duplicate',
      name: 'Duplicate Project With Sessions',
      updatedAt: '2026-04-28T01:00:00.000Z',
      codingSessions: [
        buildCodingSession({
          id: 'session-preserved',
          projectId: 'project-duplicate',
          messages: preservedMessages,
        }),
      ],
    }),
    buildProject({
      id: 'project-duplicate',
      name: 'Duplicate Project Authority',
      updatedAt: '2026-04-28T01:01:00.000Z',
      codingSessions: [],
    }),
  ],
);

assert.equal(
  mergedDuplicateProjects.length,
  1,
  'project store must collapse duplicate project identities before React renders key={project.id} lists.',
);
assert.equal(
  mergedDuplicateProjects[0]?.name,
  'Duplicate Project Authority',
  'project store should keep the latest duplicate project scalars while deduplicating identity.',
);
assert.equal(
  mergedDuplicateProjects[0]?.codingSessions.length,
  1,
  'project store should not let a later empty duplicate project snapshot erase sessions already present in the same refresh.',
);
assert.equal(
  mergedDuplicateProjects[0]?.codingSessions[0]?.messages,
  preservedMessages,
  'project store should preserve the richer duplicate session transcript by reference after project deduplication.',
);

const mergedDuplicateSessions = mergeProjectsForStore(
  [],
  [
    buildProject({
      id: 'project-with-duplicate-sessions',
      codingSessions: [
        buildCodingSession({
          id: 'session-duplicate',
          projectId: 'project-with-duplicate-sessions',
          title: 'Session With Transcript',
          updatedAt: '2026-04-28T01:00:00.000Z',
          messages: [
            buildMessage({
              id: 'message-session-duplicate',
              codingSessionId: 'session-duplicate',
            }),
          ],
        }),
        buildCodingSession({
          id: 'session-duplicate',
          projectId: 'project-with-duplicate-sessions',
          title: 'Session Authority',
          updatedAt: '2026-04-28T01:01:00.000Z',
          messages: [],
        }),
      ],
    }),
  ],
);

const deduplicatedSessions = mergedDuplicateSessions[0]?.codingSessions ?? [];
assert.equal(
  deduplicatedSessions.length,
  1,
  'project store must collapse duplicate session identities before React renders key={session.id} rows.',
);
assert.equal(
  deduplicatedSessions[0]?.title,
  'Session Authority',
  'session store should keep the latest duplicate session scalars while deduplicating identity.',
);
assert.deepEqual(
  deduplicatedSessions[0]?.messages.map((message) => message.id),
  ['message-session-duplicate'],
  'session store should preserve transcript payload when a later duplicate summary arrives without messages.',
);

console.log('projects store identity deduplication contract passed.');
