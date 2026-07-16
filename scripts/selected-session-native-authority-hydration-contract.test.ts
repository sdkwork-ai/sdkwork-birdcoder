import assert from 'node:assert/strict';
import { isBirdCoderCodeEngineNativeSessionId } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-codeengine/src/catalog.ts';
import { refreshCodingSessionMessages } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-commons/src/workbench/sessionRefresh.ts';
import type {
  BirdCoderCodingSession,
  BirdCoderCodingSessionEvent,
  BirdCoderCodingSessionSummary,
  BirdCoderNativeSessionDetail,
  BirdCoderProject,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-types/src/index.ts';

type RefreshOptions = Parameters<typeof refreshCodingSessionMessages>[0];
type RefreshAppRuntimeReadService = NonNullable<RefreshOptions['appRuntimeReadService']>;
type RefreshProjectService = RefreshOptions['projectService'];

const workspaceId = 'workspace-native-selected-session';
const projectId = 'project-native-selected-session';
const timestamp = '2026-07-16T01:00:00.000Z';
const assistantTimestamp = '2026-07-16T01:00:01.000Z';
const canonicalTimestamp = '2026-07-16T01:00:02.000Z';
const providers = [
  { engineId: 'codex', prefix: 'codex-native:' },
  { engineId: 'claude-code', prefix: 'claude-code-native:' },
  { engineId: 'gemini', prefix: 'gemini-native:' },
  { engineId: 'opencode', prefix: 'opencode-native:' },
] as const;

assert.equal(
  isBirdCoderCodeEngineNativeSessionId('ordinary-canonical-session'),
  false,
  'Canonical session ids must not be misclassified as provider-native ids.',
);

for (const provider of providers) {
  const codingSessionId = `${provider.prefix}${provider.engineId}-history`;
  const summary: BirdCoderCodingSessionSummary = {
    createdAt: timestamp,
    engineId: provider.engineId,
    hostMode: 'desktop',
    id: codingSessionId,
    lastTurnAt: timestamp,
    modelId: `${provider.engineId}-model`,
    nativeAttributes: {
      isEphemeral: false,
      isSidechain: false,
      metadata: { provider: provider.engineId },
      schemaVersion: 1,
      source: provider.engineId,
    },
    nativeSessionId: codingSessionId,
    projectId,
    runtimeLocationId: `runtime-location-${provider.engineId}`,
    sortTimestamp: String(Date.parse(timestamp)),
    status: 'active',
    title: `${provider.engineId} history`,
    transcriptUpdatedAt: timestamp,
    updatedAt: timestamp,
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
    createdAt: timestamp,
    id: projectId,
    name: 'Native selected session project',
    updatedAt: timestamp,
    workspaceId,
  };
  const nativeDetail: BirdCoderNativeSessionDetail = {
    messages: [
      {
        codingSessionId,
        content: `${provider.engineId} native user message`,
        createdAt: timestamp,
        id: `${provider.engineId}-native-user`,
        role: 'user',
      },
      {
        codingSessionId,
        commands: [
          {
            command: `${provider.engineId} --version`,
            output: 'ok',
            requiresApproval: false,
            status: 'success',
            toolCallId: `${provider.engineId}-tool-call`,
            toolName: 'shell',
          },
        ],
        content: `${provider.engineId} native assistant message`,
        createdAt: assistantTimestamp,
        fileChanges: [{ path: `${provider.engineId}.md`, type: 'modify' }],
        id: `${provider.engineId}-native-assistant`,
        role: 'assistant',
        taskProgress: { completed: 1, total: 1 },
        tool_calls: [{ id: `${provider.engineId}-tool-call`, type: 'function' }],
      },
    ],
    summary: {
      ...summary,
      kind: 'coding',
      sortTimestamp: String(Date.parse(timestamp)),
    },
  };
  const canonicalEvent: BirdCoderCodingSessionEvent = {
    codingSessionId,
    createdAt: canonicalTimestamp,
    id: `${provider.engineId}-canonical-event`,
    kind: 'message.completed',
    payload: {
      content: `${provider.engineId} canonical continuation`,
      role: 'assistant',
    },
    runtimeId: `${provider.engineId}-runtime`,
    sequence: '1',
    turnId: `${provider.engineId}-turn`,
  };
  let nativeDetailReads = 0;
  let canonicalEventReads = 0;
  let persistedSession: BirdCoderCodingSession | null = null;
  const appRuntimeReadService = {
    async getCodingSession() {
      return summary;
    },
    async getNativeSession(_nativeSessionId: string, request: { runtimeLocationId: string }) {
      assert.equal(request.runtimeLocationId, summary.runtimeLocationId);
      nativeDetailReads += 1;
      return nativeDetail;
    },
    async listCodingSessionEvents() {
      canonicalEventReads += 1;
      return [canonicalEvent];
    },
    async listCodingSessions() {
      return [summary];
    },
    async listNativeSessions() {
      return [nativeDetail.summary];
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
    identityScope: `user-${provider.engineId}`,
    projectService,
    resolvedLocation: {
      codingSession: selectedSession,
      project,
    },
    workspaceId,
  });

  assert.equal(result.status, 'refreshed');
  assert.equal(result.source, 'native-engine');
  assert.equal(nativeDetailReads, 1);
  assert.equal(canonicalEventReads, 1);
  assert.deepEqual(
    result.codingSession?.messages.map((message) => message.content),
    [
      `${provider.engineId} native user message`,
      `${provider.engineId} native assistant message`,
      `${provider.engineId} canonical continuation`,
    ],
    `${provider.engineId} selection must combine provider-native history with later canonical events.`,
  );
  assert.equal(
    result.codingSession?.messages[1]?.commands?.[0]?.toolCallId,
    `${provider.engineId}-tool-call`,
  );
  assert.deepEqual(
    result.codingSession?.messages[1]?.fileChanges,
    [{ path: `${provider.engineId}.md`, type: 'modify' }],
  );
  assert.deepEqual(
    result.codingSession?.nativeAttributes?.metadata,
    { provider: provider.engineId },
  );
  assert.equal(persistedSession, result.codingSession);
}

console.log('selected session native authority hydration contract passed.');
