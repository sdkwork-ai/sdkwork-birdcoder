import assert from 'node:assert/strict';

import {
  projectChatTranscriptToolActivity,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/chat-message-activity-projection.ts';
import {
  resolveChatMessageView,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/chat-message-view.ts';
import {
  projectChatMessageToolCalls,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/chat-message-tool-calls.ts';
import {
  mergeBirdCoderProjectionMessages,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/index.ts';
import {
  resolveEditorMessageFilePath,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/workbench/editorMessageFilePath.ts';

const engineOptions = { engineId: 'claude-code' as const };

function completedEvent(
  id: string,
  sequence: number,
  sessionId: string,
  turnId: string,
  payload: Record<string, unknown>,
) {
  return {
    id,
    codingSessionId: sessionId,
    turnId,
    kind: 'message.completed' as const,
    sequence: String(sequence),
    payload,
    createdAt: `2026-07-21T01:00:${String(sequence).padStart(2, '0')}.000Z`,
  };
}

function projectCompletedEvents(
  sessionId: string,
  events: ReturnType<typeof completedEvent>[],
) {
  return mergeBirdCoderProjectionMessages({
    codingSessionId: sessionId,
    existingMessages: [],
    idPrefix: 'authoritative',
    events,
  });
}

const notificationSessionId = 'claude-sdk-notification-session';
const notificationProjection = projectCompletedEvents(notificationSessionId, [
  completedEvent('notification-low', 1, notificationSessionId, 'notification-low-turn', {
    role: 'assistant',
    content: {
      type: 'system',
      subtype: 'notification',
      key: 'index-ready',
      text: 'Workspace index refreshed',
      priority: 'low',
      uuid: 'notification-low-uuid',
      session_id: notificationSessionId,
    },
  }),
  completedEvent('notification-high', 2, notificationSessionId, 'notification-high-turn', {
    role: 'assistant',
    content: {
      type: 'system',
      subtype: 'notification',
      key: 'credentials-expiring',
      text: 'Credentials expire soon',
      priority: 'high',
      uuid: 'notification-high-uuid',
      session_id: notificationSessionId,
    },
  }),
]);
const notificationViews = notificationProjection.map((message) => resolveChatMessageView(message));
assert.deepEqual(
  notificationViews.map((view) => view.blocks.find(
    (block) => block.type === 'markdown',
  )?.noticeKind),
  ['info', 'warning'],
  'Claude low-priority notifications must become info notes and high-priority notifications warnings.',
);
assert.equal(
  notificationProjection.some((message) => (
    message.role === 'assistant'
    && /Workspace index refreshed|Credentials expire soon/u.test(message.content)
  )),
  false,
  'Claude notifications must not masquerade as authored assistant Markdown.',
);

const taskSessionId = 'claude-sdk-task-session';
const taskTurnId = 'claude-sdk-task-turn';
const taskProjection = projectCompletedEvents(taskSessionId, [
  completedEvent('task-tool-use', 1, taskSessionId, taskTurnId, {
    role: 'assistant',
    content: [{
      type: 'tool_use',
      id: 'toolu1',
      name: 'Task',
      input: { prompt: 'Audit provider messages', description: 'Provider protocol audit' },
    }],
  }),
  completedEvent('task-started', 2, taskSessionId, taskTurnId, {
    role: 'assistant',
    content: {
      type: 'system',
      subtype: 'task_started',
      task_id: 'task1',
      tool_use_id: 'toolu1',
      description: 'Provider protocol audit',
      task_type: 'local_agent',
      uuid: 'task-started-uuid',
      session_id: taskSessionId,
    },
  }),
  completedEvent('task-updated', 3, taskSessionId, taskTurnId, {
    role: 'assistant',
    content: {
      type: 'system',
      subtype: 'task_updated',
      task_id: 'task1',
      patch: { status: 'completed', description: 'Provider protocol audit completed' },
      uuid: 'task-updated-uuid',
      session_id: taskSessionId,
    },
  }),
  completedEvent('task-authored-reply', 4, taskSessionId, taskTurnId, {
    role: 'assistant',
    content: 'The provider protocol audit is complete.',
  }),
]);
const orderedTaskProjection = projectChatTranscriptToolActivity(taskProjection, engineOptions);
const orderedTaskSlots = orderedTaskProjection.flatMap((message, messageIndex) => {
  const calls = projectChatMessageToolCalls(message.tool_calls, engineOptions)
    .filter((call) => call.kind === 'agent' || call.kind === 'task');
  return calls.length > 0 ? [{ calls, message, messageIndex }] : [];
});
assert.equal(
  orderedTaskSlots.length,
  1,
  'Claude tool_use, task_started, and task_updated records must occupy one ordered activity slot.',
);
assert.equal(orderedTaskSlots[0]?.calls.length, 1);
assert.equal(
  orderedTaskSlots[0]?.calls[0]?.id,
  'toolu1',
  'The originating tool_use id must remain the stable lifecycle call identity.',
);
assert.equal(orderedTaskSlots[0]?.calls[0]?.status, 'success');
assert.equal(orderedTaskSlots[0]?.calls[0]?.title, 'Provider protocol audit completed');
const authoredTaskReplyIndex = orderedTaskProjection.findIndex(
  (message) => message.content === 'The provider protocol audit is complete.',
);
assert.ok(authoredTaskReplyIndex >= 0, 'The authored task reply must remain visible.');
assert.ok(
  (orderedTaskSlots[0]?.messageIndex ?? Number.MAX_SAFE_INTEGER) < authoredTaskReplyIndex,
  'The lifecycle slot must retain provider order ahead of the authored reply.',
);

const summarySessionId = 'claude-sdk-tool-summary-session';
const summaryProjection = projectChatTranscriptToolActivity(projectCompletedEvents(summarySessionId, [
  completedEvent('tool-use-summary', 1, summarySessionId, 'tool-use-summary-turn', {
    role: 'assistant',
    content: {
      type: 'tool_use_summary',
      summary: 'Read 10 provider files',
      preceding_tool_use_ids: ['toolu-read-1', 'toolu-read-2'],
      uuid: 'tool-summary-uuid',
      session_id: summarySessionId,
    },
  }),
]), engineOptions);
assert.equal(summaryProjection.length, 1);
const summaryCalls = projectChatMessageToolCalls(summaryProjection[0]?.tool_calls, engineOptions);
assert.equal(summaryCalls.length, 1);
assert.equal(summaryCalls[0]?.kind, 'task');
assert.equal(summaryCalls[0]?.name, 'tool_summary');
assert.equal(summaryCalls[0]?.output, 'Read 10 provider files');
assert.deepEqual(
  resolveChatMessageView(summaryProjection[0]!, engineOptions).blocks.map((block) => block.type),
  ['tool-calls'],
  'Claude tool_use_summary must render as structured task activity without manufactured Markdown.',
);

const documentSessionId = 'claude-sdk-rich-document-session';
const base64Marker = 'JVBERi0xLjQKPRIVATE_CLAUDE_DOCUMENT_BASE64_MUST_NOT_RENDER';
const documentProjection = projectChatTranscriptToolActivity(projectCompletedEvents(
  documentSessionId,
  [
    completedEvent('document-tool-use', 1, documentSessionId, 'document-turn', {
      role: 'assistant',
      content: [{
        type: 'tool_use',
        id: 'toolu-document',
        name: 'ReadDocument',
        input: { path: 'provider-contract.pdf' },
      }],
    }),
    completedEvent('document-tool-result', 2, documentSessionId, 'document-turn', {
      role: 'user',
      content: {
        type: 'user',
        isSynthetic: true,
        parent_tool_use_id: null,
        uuid: 'document-result-uuid',
        session_id: documentSessionId,
        message: {
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: 'toolu-document',
            content: [{
              type: 'document',
              title: 'provider-contract.pdf',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64Marker,
              },
            }],
          }],
        },
      },
    }),
  ],
), engineOptions);
const documentCalls = documentProjection.flatMap((message) => (
  projectChatMessageToolCalls(message.tool_calls, engineOptions)
));
assert.equal(documentCalls.length, 1);
assert.deepEqual(documentCalls[0]?.resultBlocks, [{
  type: 'resource',
  name: 'provider-contract.pdf',
  mimeType: 'application/pdf',
}]);
assert.doesNotMatch(
  JSON.stringify(documentCalls[0]?.resultBlocks),
  /PRIVATE_CLAUDE_DOCUMENT_BASE64_MUST_NOT_RENDER|JVBER/iu,
  'Claude rich document result blocks must preserve safe metadata without serializing base64.',
);

const memorySessionId = 'claude-sdk-memory-session';
const memoryContent = 'M'.repeat(5_000);
const memoryProjection = projectCompletedEvents(memorySessionId, [
  completedEvent('memory-recall-select', 1, memorySessionId, 'memory-select-turn', {
    role: 'assistant',
    content: {
      type: 'system',
      subtype: 'memory_recall',
      mode: 'select',
      memories: [
        {
          path: 'E:/workspace/birdcoder/.claude/memory/provider.md',
          scope: 'personal',
        },
        {
          path: 'https://example.com/team-memory',
          scope: 'organization',
          content: 'Organization provider contract context',
        },
      ],
      uuid: 'memory-recall-select-uuid',
      session_id: memorySessionId,
    },
  }),
  completedEvent('memory-recall-synthesis', 2, memorySessionId, 'memory-synthesis-turn', {
    role: 'assistant',
    content: {
      type: 'system',
      subtype: 'memory_recall',
      mode: 'synthesize',
      memories: [{
        path: '<synthesis:E:/workspace/birdcoder/.claude/memory>',
        scope: 'team',
        content: memoryContent,
      }],
      uuid: 'memory-recall-synthesis-uuid',
      session_id: memorySessionId,
    },
  }),
]);
const memoryResources = memoryProjection.flatMap((message) => message.resources ?? []);
assert.equal(
  memoryResources.length,
  3,
  'Claude SDK memory_recall must project file, organization URL, and synthesis entries as resources.',
);
assert.ok(memoryResources.every((resource) => resource.kind === 'citation'));
const fileMemory = memoryResources.find((resource) => resource.path?.endsWith('/provider.md'));
const organizationMemory = memoryResources.find(
  (resource) => resource.uri === 'https://example.com/team-memory',
);
const synthesisMemory = memoryResources.find((resource) => resource.name === 'Memory synthesis');
assert.ok(fileMemory, 'File-backed Claude memory must retain its safe local path.');
assert.ok(organizationMemory, 'Organization Claude memory must retain its HTTPS URI.');
assert.ok(synthesisMemory, 'Synthesized Claude memory must not masquerade as a local file.');
assert.equal(synthesisMemory.path, undefined);
assert.equal(synthesisMemory.description?.length, 4_000, 'Memory content must use a bounded preview.');
assert.equal(
  resolveEditorMessageFilePath(fileMemory.path!, {
    filePaths: new Set(['/BirdCoder/.claude/memory/provider.md']),
    loadedDirectoryPaths: new Set(['/BirdCoder', '/BirdCoder/.claude', '/BirdCoder/.claude/memory']),
  }),
  '/BirdCoder/.claude/memory/provider.md',
  'File-backed Claude memories must use the existing safe workspace file resolver.',
);
assert.equal(
  resolveEditorMessageFilePath(organizationMemory.uri!, {
    filePaths: new Set(['/BirdCoder/.claude/memory/provider.md']),
    loadedDirectoryPaths: new Set(['/BirdCoder']),
  }),
  null,
  'HTTPS memory resources must never be interpreted as local editor paths.',
);

console.log('Claude SDK message protocol contract tests passed');
