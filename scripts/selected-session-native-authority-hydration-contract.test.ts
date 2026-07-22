import assert from 'node:assert/strict';
import { isBirdCoderCodeEngineNativeSessionId } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine/src/catalog.ts';
import { refreshCodingSessionMessages } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/workbench/sessionRefresh.ts';
import type {
  BirdCoderCodingSession,
  BirdCoderCodingSessionEvent,
  BirdCoderCodingSessionSummary,
  BirdCoderProject,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/index.ts';

type RefreshOptions = Parameters<typeof refreshCodingSessionMessages>[0];
type RefreshAppRuntimeReadService = NonNullable<RefreshOptions['appRuntimeReadService']>;
type RefreshProjectService = RefreshOptions['projectService'];

const workspaceId = 'workspace-selected-session-authority';
const projectId = 'project-selected-session-authority';
const userTimestamp = '2026-07-16T01:00:00.000Z';
const assistantTimestamp = '2026-07-16T01:00:01.000Z';
const providers = ['codex', 'claude-code', 'gemini', 'opencode'] as const;

assert.equal(
  isBirdCoderCodeEngineNativeSessionId('birdcoder-logical-session'),
  false,
  'Persistent BirdCoder session ids must not be misclassified as provider ids.',
);

for (const engineId of providers) {
  const codingSessionId = `birdcoder-${engineId}-session`;
  const nativeSessionId = `${engineId}-provider-history`;
  const summary: BirdCoderCodingSessionSummary = {
    createdAt: userTimestamp,
    engineId,
    hostMode: 'desktop',
    id: codingSessionId,
    lastTurnAt: assistantTimestamp,
    modelId: `${engineId}-model`,
    nativeAttributes: {
      isEphemeral: false,
      isSidechain: false,
      metadata: { provider: engineId },
      schemaVersion: 1,
      source: engineId,
    },
    nativeSessionId,
    projectId,
    runtimeLocationId: `runtime-location-${engineId}`,
    sortTimestamp: String(Date.parse(assistantTimestamp)),
    status: 'active',
    title: `${engineId} history`,
    transcriptUpdatedAt: assistantTimestamp,
    updatedAt: assistantTimestamp,
    workspaceId,
  };
  const selectedSession: BirdCoderCodingSession = {
    ...summary,
    archived: false,
    displayTime: 'just now',
    messages: [],
    pinned: false,
    unread: false,
  };
  const project: BirdCoderProject = {
    archived: false,
    codingSessions: [selectedSession],
    createdAt: userTimestamp,
    id: projectId,
    name: 'Selected session authority project',
    updatedAt: assistantTimestamp,
    workspaceId,
  };
  const events: BirdCoderCodingSessionEvent[] = [
    {
      codingSessionId,
      createdAt: userTimestamp,
      id: `${engineId}-user-event`,
      kind: 'message.completed',
      payload: {
        content: `${engineId} provider user message`,
        role: 'user',
      },
      runtimeId: `${engineId}-runtime`,
      sequence: '1',
      turnId: `${engineId}-turn`,
    },
    {
      codingSessionId,
      createdAt: assistantTimestamp,
      id: `${engineId}-assistant-event`,
      kind: 'message.completed',
      payload: {
        commands: [{
          command: `${engineId} --version`,
          output: 'ok',
          requiresApproval: false,
          status: 'success',
          toolCallId: `${engineId}-tool-call`,
          toolName: 'shell',
        }],
        content: `${engineId} provider assistant message`,
        fileChanges: [{ path: `${engineId}.md`, type: 'modify' }],
        role: 'assistant',
        taskProgress: { completed: 1, total: 1 },
        toolCalls: [{ id: `${engineId}-tool-call`, type: 'function' }],
      },
      runtimeId: `${engineId}-runtime`,
      sequence: '2',
      turnId: `${engineId}-turn`,
    },
  ];
  let eventReads = 0;
  let persistedSession: BirdCoderCodingSession | null = null;
  const appRuntimeReadService = {
    async getCodingSession() {
      return summary;
    },
    async listCodingSessionEvents() {
      eventReads += 1;
      return events;
    },
    async listCodingSessions() {
      return [summary];
    },
  } as RefreshAppRuntimeReadService;
  const projectService = {
    async upsertCodingSession(_projectId: string, codingSession: BirdCoderCodingSession) {
      persistedSession = codingSession;
    },
  } as unknown as RefreshProjectService;

  const result = await refreshCodingSessionMessages({
    appRuntimeReadService,
    codingSessionId,
    identityScope: `user-${engineId}`,
    projectService,
    resolvedLocation: {
      codingSession: selectedSession,
      project,
    },
    workspaceId,
  });

  assert.equal(result.status, 'refreshed');
  assert.equal(result.source, 'native-engine');
  assert.equal(eventReads, 1);
  assert.equal(result.codingSession?.id, codingSessionId);
  assert.equal(result.codingSession?.nativeSessionId, nativeSessionId);
  assert.deepEqual(
    result.codingSession?.messages.map((message) => message.content),
    [
      `${engineId} provider user message`,
      `${engineId} provider assistant message`,
    ],
    `${engineId} history must hydrate through unified coding-session events.`,
  );
  assert.equal(
    result.codingSession?.messages[1]?.commands?.[0]?.toolCallId,
    `${engineId}-tool-call`,
  );
  assert.deepEqual(
    result.codingSession?.messages[1]?.fileChanges,
    [{ additions: 0, deletions: 0, path: `${engineId}.md` }],
  );
  assert.deepEqual(
    result.codingSession?.nativeAttributes?.metadata,
    { provider: engineId },
  );
  assert.equal(persistedSession, result.codingSession);
}

console.log('selected session unified authority hydration contract passed.');
