import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  deduplicateBirdCoderCodingSessionsForRender,
  deduplicateBirdCoderProjectsForRender,
} from '../packages/sdkwork-birdcoder-commons/src/workbench/projectInventoryRender.ts';
import type {
  BirdCoderChatMessage,
  BirdCoderCodingSession,
  BirdCoderProject,
} from '../packages/sdkwork-birdcoder-types/src/index.ts';

const codeSidebarSource = readFileSync(
  new URL(
    '../packages/sdkwork-birdcoder-code/src/components/Sidebar.tsx',
    import.meta.url,
  ),
  'utf8',
);
const studioSidebarSource = readFileSync(
  new URL(
    '../packages/sdkwork-birdcoder-studio/src/pages/StudioChatSidebar.tsx',
    import.meta.url,
  ),
  'utf8',
);

assert.match(
  codeSidebarSource,
  /deduplicateBirdCoderProjectsForRender\(projects\)/,
  'Code sidebar must normalize project identities before building key={project.id} render entries.',
);
assert.match(
  codeSidebarSource,
  /deduplicateBirdCoderCodingSessionsForRender\(/,
  'Code chronological sidebar must normalize flat session identities before building key={session.id} rows.',
);
assert.match(
  studioSidebarSource,
  /deduplicateBirdCoderProjectsForRender\(projects\)/,
  'Studio sidebar must normalize project identities before building project/session menu rows.',
);

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
    title: 'Render Session',
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
    name: 'Render Project',
    path: 'D:/workspace/render-project',
    createdAt: '2026-04-28T01:00:00.000Z',
    updatedAt: '2026-04-28T01:00:00.000Z',
    archived: false,
    codingSessions: [],
    ...overrides,
  };
}

const stableSession = buildCodingSession({ id: 'session-stable' });
const stableSessions = [stableSession];
assert.equal(
  deduplicateBirdCoderCodingSessionsForRender(stableSessions),
  stableSessions,
  'render session identity deduplication must reuse already-unique arrays to avoid sidebar churn at startup.',
);

const stableProject = buildProject({
  id: 'project-stable',
  codingSessions: stableSessions,
});
const stableProjects = [stableProject];
assert.equal(
  deduplicateBirdCoderProjectsForRender(stableProjects),
  stableProjects,
  'render project identity deduplication must reuse already-unique arrays to avoid sidebar churn at startup.',
);

const preservedMessages = [
  buildMessage({
    id: 'message-preserved',
    codingSessionId: 'session-preserved',
    content: 'Keep the richer duplicate transcript.',
  }),
];
const deduplicatedDuplicateProjects = deduplicateBirdCoderProjectsForRender([
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
]);

assert.equal(
  deduplicatedDuplicateProjects.length,
  1,
  'render project inventory must collapse duplicate project ids before React renders key={project.id} rows.',
);
assert.equal(
  deduplicatedDuplicateProjects[0]?.name,
  'Duplicate Project Authority',
  'render project inventory should keep the latest duplicate project scalars.',
);
assert.equal(
  deduplicatedDuplicateProjects[0]?.codingSessions.length,
  1,
  'render project inventory should not let a later empty duplicate project summary erase visible sessions.',
);
assert.equal(
  deduplicatedDuplicateProjects[0]?.codingSessions[0]?.messages,
  preservedMessages,
  'render project inventory should preserve the richer duplicate session transcript by reference.',
);

const deduplicatedDuplicateSessions = deduplicateBirdCoderProjectsForRender([
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
])[0]?.codingSessions ?? [];

assert.equal(
  deduplicatedDuplicateSessions.length,
  1,
  'render project inventory must collapse duplicate session ids before React renders key={session.id} rows.',
);
assert.equal(
  deduplicatedDuplicateSessions[0]?.title,
  'Session Authority',
  'render project inventory should keep the latest duplicate session scalars.',
);
assert.deepEqual(
  deduplicatedDuplicateSessions[0]?.messages.map((message) => message.id),
  ['message-session-duplicate'],
  'render project inventory should preserve transcript payload when a later duplicate summary arrives without messages.',
);

const deduplicatedChronologicalSessions = deduplicateBirdCoderCodingSessionsForRender([
  buildCodingSession({
    id: 'session-chronological',
    projectId: 'project-a',
    title: 'Chronological Draft',
  }),
  buildCodingSession({
    id: 'session-chronological',
    projectId: 'project-b',
    title: 'Chronological Authority',
  }),
]);

assert.deepEqual(
  deduplicatedChronologicalSessions.map((codingSession) => codingSession.id),
  ['session-chronological'],
  'chronological render inventories must collapse duplicate session ids before React renders one flat key={session.id} list.',
);
assert.equal(
  deduplicatedChronologicalSessions[0]?.title,
  'Chronological Authority',
  'chronological render inventories should keep the latest duplicate session scalars.',
);

console.log('project inventory render identity contract passed.');
