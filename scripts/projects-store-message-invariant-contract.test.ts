import assert from 'node:assert/strict';
import type {
  BirdCoderChatMessage,
  BirdCoderCodingSession,
  BirdCoderProject,
} from '@sdkwork/birdcoder-types';
import {
  mergeProjectsForStore,
  updateCodingSessionInCollection,
  upsertCodingSessionIntoCollection,
} from '../packages/sdkwork-birdcoder-commons/src/stores/projectsStore.ts';

function buildMessage(
  overrides: Partial<BirdCoderChatMessage> = {},
): BirdCoderChatMessage {
  return {
    id: 'message-1',
    codingSessionId: 'session-1',
    role: 'user',
    content: 'Implement store-level transcript invariants.',
    createdAt: '2026-04-27T01:00:00.000Z',
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
    title: 'Invariant Session',
    status: 'active',
    hostMode: 'desktop',
    engineId: 'codex',
    modelId: 'gpt-5-codex',
    createdAt: '2026-04-27T01:00:00.000Z',
    updatedAt: '2026-04-27T01:00:00.000Z',
    lastTurnAt: '2026-04-27T01:00:00.000Z',
    transcriptUpdatedAt: '2026-04-27T01:00:00.000Z',
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
    name: 'Invariant Project',
    description: undefined,
    path: 'D:/workspace/invariant-project',
    createdAt: '2026-04-27T01:00:00.000Z',
    updatedAt: '2026-04-27T01:00:00.000Z',
    archived: false,
    codingSessions: [buildCodingSession()],
    ...overrides,
  };
}

const duplicateBaseMessage = buildMessage();
const richerDuplicateMessage = buildMessage({
  content: 'Implement store-level transcript invariants with richer payload.',
  commands: [
    {
      command: 'pnpm.cmd typecheck',
      status: 'success',
    },
  ],
});
const foreignSessionMessage = buildMessage({
  id: 'foreign-message',
  codingSessionId: 'session-foreign',
  content: 'This message belongs to a different session.',
});

const upsertedProjects = upsertCodingSessionIntoCollection(
  [buildProject()],
  'project-1',
  buildCodingSession({
    messages: [
      duplicateBaseMessage,
      foreignSessionMessage,
      richerDuplicateMessage,
    ],
  }),
);
const upsertedSession = upsertedProjects[0]!.codingSessions.find(
  (codingSession) => codingSession.id === 'session-1',
);

assert.deepEqual(
  upsertedSession?.messages.map((message) => ({
    id: message.id,
    codingSessionId: message.codingSessionId,
    content: message.content,
    commands: message.commands,
  })),
  [
    {
      id: 'message-1',
      codingSessionId: 'session-1',
      content: 'Implement store-level transcript invariants with richer payload.',
      commands: [
        {
          command: 'pnpm.cmd typecheck',
          status: 'success',
        },
      ],
    },
  ],
  'project store upserts must enforce session-scoped, deduplicated transcripts before the UI can render duplicates.',
);

const updatedProjects = updateCodingSessionInCollection(
  [buildProject({
    codingSessions: [
      buildCodingSession({
        messages: [duplicateBaseMessage],
      }),
    ],
  })],
  'project-1',
  'session-1',
  (codingSession) => ({
    ...codingSession,
    messages: [
      ...codingSession.messages,
      foreignSessionMessage,
      richerDuplicateMessage,
    ],
  }),
);
const updatedSession = updatedProjects[0]!.codingSessions.find(
  (codingSession) => codingSession.id === 'session-1',
);

assert.deepEqual(
  updatedSession?.messages.map((message) => ({
    id: message.id,
    codingSessionId: message.codingSessionId,
    content: message.content,
  })),
  [
    {
      id: 'message-1',
      codingSessionId: 'session-1',
      content: 'Implement store-level transcript invariants with richer payload.',
    },
  ],
  'project store updater mutations must also normalize transcripts so local optimistic and realtime paths share the same invariant.',
);

const projectWithLongMetadata = buildProject({
  coverImage: {
    assetId: 101777208078558043n,
  } as unknown as Record<string, unknown>,
  parentMetadata: {
    ownerId: 101777208078558041n,
  } as unknown as Record<string, unknown>,
});
const mergedLongMetadataProjects = mergeProjectsForStore(
  [projectWithLongMetadata],
  [
    buildProject({
      coverImage: {
        assetId: 101777208078558043n,
      } as unknown as Record<string, unknown>,
      parentMetadata: {
        ownerId: 101777208078558041n,
      } as unknown as Record<string, unknown>,
    }),
  ],
);
assert.equal(
  (mergedLongMetadataProjects[0]?.parentMetadata as { ownerId?: unknown } | undefined)?.ownerId,
  101777208078558041n,
  'project store metadata comparison must be Long-safe so BigInt metadata cannot crash session inventory reconciliation.',
);
assert.equal(
  (mergedLongMetadataProjects[0]?.coverImage as { assetId?: unknown } | undefined)?.assetId,
  101777208078558043n,
);

console.log('projects store message invariant contract passed.');
