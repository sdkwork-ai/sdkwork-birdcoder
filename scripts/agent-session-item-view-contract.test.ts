import assert from 'node:assert/strict';

import type { AgentSessionItemRecord } from '@sdkwork/agents-app-sdk';
import {
  areAgentSessionItemsLogicallyMatched,
  deduplicateAgentSessionItemViews,
  type AgentSessionItemView,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/agent-session-view.ts';
import { isAgentSessionItemVisibleInTranscript } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/agent-session-item-transcript.ts';
import { resolveAgentSessionItemPresentation } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/agent-session-item-presentation.ts';
import {
  composeAgentSessionTranscriptActivity,
  resolveAgentTurnActivityPresentation,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/agent-session-item-activity-presentation.ts';
import { normalizeAgentSessionItemToolCalls } from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/agent-session-item-tool-calls.ts';
import {
  toAgentSessionItemView,
  toAgentSessionTranscriptItemViews,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-workbench/src/services/agentSessionViewModels.ts';

const canonicalItem: AgentSessionItemRecord = {
  tenantId: '1001',
  organizationId: '2001',
  sessionId: 'agent-session-1',
  itemId: 'agent-item-1',
  kind: 'assistant_output',
  content: 'The canonical Agents response.',
  contentType: 'text/markdown',
  status: 'completed',
  sequence: '7',
  inputTokens: '11',
  outputTokens: '23',
  modelId: 'gpt-5',
  providerId: 'openai',
  turnId: 'agent-turn-1',
  driveRefs: [],
  createdBy: '3001',
  version: '1',
  createdAt: '2026-07-23T08:00:00.000Z',
  updatedAt: '2026-07-23T08:00:01.000Z',
  completedAt: '2026-07-23T08:00:01.000Z',
};

const transientItemView = toAgentSessionItemView(canonicalItem);

assert.deepEqual(
  {
    id: transientItemView.id,
    sessionId: transientItemView.sessionId,
    turnId: transientItemView.turnId,
    role: transientItemView.role,
    content: transientItemView.content,
  },
  {
    id: canonicalItem.itemId,
    sessionId: canonicalItem.sessionId,
    turnId: canonicalItem.turnId,
    role: 'assistant',
    content: canonicalItem.content,
  },
);
assert.deepEqual(transientItemView.metadata, {
  agentItemKind: canonicalItem.kind,
  agentItemSequence: canonicalItem.sequence,
  agentItemStatus: canonicalItem.status,
  contentType: canonicalItem.contentType,
  inputTokens: canonicalItem.inputTokens,
  outputTokens: canonicalItem.outputTokens,
  parentItemId: undefined,
  providerId: canonicalItem.providerId,
  modelId: canonicalItem.modelId,
});
assert.equal('agentSessionId' in transientItemView, false);
assert.equal('conversationId' in transientItemView, false);

const legacyItemWithoutDriveRefs = {
  ...canonicalItem,
  itemId: 'agent-item-without-drive-refs',
  driveRefs: undefined,
} as unknown as AgentSessionItemRecord;
assert.equal(
  toAgentSessionItemView(legacyItemWithoutDriveRefs).content,
  canonicalItem.content,
  'Legacy Session Items without Drive references must remain renderable.',
);

const renderedView = resolveAgentSessionItemPresentation(transientItemView, {
  engineId: canonicalItem.providerId ?? undefined,
});
assert.equal(renderedView.kind, 'assistant.text');
assert.equal(renderedView.source, transientItemView);
assert.equal(renderedView.engineId, canonicalItem.providerId);
assert.equal(
  renderedView.blocks.some(
    (block) => block.type === 'markdown' && block.content === canonicalItem.content,
  ),
  true,
);

const canonicalReasoningItem: AgentSessionItemRecord = {
  ...canonicalItem,
  itemId: 'agent-item-reasoning',
  kind: 'reasoning',
  content: 'Planning the provider-neutral message projection.',
  sequence: '8',
  driveRefs: [{
    resourceRole: 'artifact',
    driveSpaceId: 'drive-space-1',
    driveNodeId: 'drive-node-plan',
    altText: 'Provider plan',
    sortOrder: 0,
    status: 'active',
    createdBy: canonicalItem.createdBy,
    createdAt: canonicalItem.createdAt,
    updatedAt: canonicalItem.updatedAt,
  }, {
    resourceRole: 'image',
    driveSpaceId: 'drive-space-1',
    driveNodeId: 'drive-node-deleted',
    altText: 'Deleted preview',
    sortOrder: 1,
    status: 'deleted',
    createdBy: canonicalItem.createdBy,
    createdAt: canonicalItem.createdAt,
    updatedAt: canonicalItem.updatedAt,
  }],
};
const reasoningItemView = toAgentSessionItemView(canonicalReasoningItem);
assert.equal(reasoningItemView.content, '');
assert.deepEqual(reasoningItemView.reasoning, [{
  id: canonicalReasoningItem.itemId,
  summary: canonicalReasoningItem.content,
  createdAt: canonicalReasoningItem.createdAt,
  startedAt: canonicalReasoningItem.createdAt,
  completedAt: canonicalReasoningItem.completedAt,
  durationMs: 1_000,
}]);
assert.deepEqual(reasoningItemView.resources, [{
  id: 'drive-node-plan',
  kind: 'file',
  name: 'Provider plan',
  uri: 'drive://nodes/drive-node-plan',
}]);
assert.deepEqual(
  resolveAgentSessionItemPresentation(reasoningItemView).blocks.map((block) => block.type),
  ['reasoning', 'resources'],
  'Canonical reasoning and Drive references must render as structured blocks, not raw Markdown.',
);

const canonicalSystemInstruction: AgentSessionItemRecord = {
  ...canonicalItem,
  itemId: 'agent-item-system-instruction',
  kind: 'system_instruction',
  content: 'Internal execution guidance that must not be shown.',
  sequence: '8',
};
const legacyCodexInstructionsUserItem: AgentSessionItemRecord = {
  ...canonicalItem,
  itemId: 'agent-item-legacy-codex-instructions',
  kind: 'user_input',
  content: [
    '# AGENTS.md instructions for E:\\workspace',
    '',
    '<INSTRUCTIONS>',
    'Internal execution guidance that must not be shown.',
    '</INSTRUCTIONS>',
    '<environment_context><cwd>E:\\workspace</cwd></environment_context>',
  ].join('\n'),
  sequence: '8',
};
const canonicalStatusNotice: AgentSessionItemRecord = {
  ...canonicalItem,
  itemId: 'agent-item-status-notice',
  kind: 'status_notice',
  content: 'The agent resumed after reconnecting.',
  sequence: '9',
};
const canonicalErrorNotice: AgentSessionItemRecord = {
  ...canonicalItem,
  itemId: 'agent-item-error-notice',
  kind: 'error_notice',
  content: 'The agent turn failed.',
  status: 'failed',
  sequence: '10',
};
const systemInstructionView = toAgentSessionItemView(canonicalSystemInstruction);
const legacyCodexInstructionsUserView = toAgentSessionItemView(legacyCodexInstructionsUserItem);
const statusNoticeView = toAgentSessionItemView(canonicalStatusNotice);
const errorNoticeView = toAgentSessionItemView(canonicalErrorNotice);

assert.equal(systemInstructionView.role, 'system');
assert.equal(isAgentSessionItemVisibleInTranscript(systemInstructionView), false);
assert.equal(legacyCodexInstructionsUserView.role, 'user');
assert.equal(isAgentSessionItemVisibleInTranscript(legacyCodexInstructionsUserView), false);
assert.equal(
  isAgentSessionItemVisibleInTranscript({
    ...transientItemView,
    metadata: { agentItemKind: 'future_internal_context' },
  }),
  false,
  'unknown canonical item kinds must stay hidden until their transcript presentation is defined.',
);
assert.equal(statusNoticeView.metadata?.noticeKind, 'info');
assert.equal(errorNoticeView.metadata?.noticeKind, 'failed');
assert.equal(isAgentSessionItemVisibleInTranscript(statusNoticeView), true);
assert.equal(isAgentSessionItemVisibleInTranscript(errorNoticeView), true);
assert.deepEqual(
  toAgentSessionTranscriptItemViews([
    canonicalSystemInstruction,
    legacyCodexInstructionsUserItem,
    canonicalStatusNotice,
    canonicalErrorNotice,
    canonicalItem,
  ]).map((item) => item.id),
  [canonicalStatusNotice.itemId, canonicalErrorNotice.itemId, canonicalItem.itemId],
  'canonical system instructions must remain execution facts without entering the user transcript.',
);
assert.equal(
  isAgentSessionItemVisibleInTranscript({
    ...systemInstructionView,
    metadata: undefined,
  }),
  false,
  'unknown system-role items must fail closed instead of exposing internal context.',
);
assert.equal(
  isAgentSessionItemVisibleInTranscript({
    ...systemInstructionView,
    metadata: { noticeKind: 'warning' },
  }),
  true,
  'explicit user-facing protocol warnings remain visible.',
);

const statusNoticePresentation = resolveAgentSessionItemPresentation(statusNoticeView);
const errorNoticePresentation = resolveAgentSessionItemPresentation(errorNoticeView);
assert.equal(statusNoticePresentation.kind, 'system.notice');
assert.equal(errorNoticePresentation.kind, 'system.notice');
assert.equal(
  statusNoticePresentation.blocks.some(
    (block) => block.type === 'markdown' && block.noticeKind === 'info',
  ),
  true,
);
assert.equal(
  errorNoticePresentation.blocks.some(
    (block) => block.type === 'markdown' && block.noticeKind === 'failed',
  ),
  true,
);

const canonicalToolItem: AgentSessionItemRecord = {
  ...canonicalItem,
  itemId: 'agent-item-2',
  kind: 'tool_result',
  content: null,
  sequence: '8',
  toolName: 'typecheck',
  toolCallId: 'agent-tool-call-1',
  toolResult: { exitCode: 0 },
};
const transientToolView = toAgentSessionItemView(canonicalToolItem);

assert.equal(transientToolView.role, 'tool');
assert.equal(transientToolView.name, canonicalToolItem.toolName);
assert.equal(transientToolView.tool_call_id, canonicalToolItem.toolCallId);
assert.equal(transientToolView.content, JSON.stringify(canonicalToolItem.toolResult, null, 2));
assert.deepEqual(transientToolView.tool_calls, [{
  id: canonicalToolItem.toolCallId,
  type: canonicalToolItem.kind,
  name: canonicalToolItem.toolName,
  status: canonicalToolItem.status,
  output: canonicalToolItem.toolResult,
}]);

const codexNativeCall = {
  type: 'function_call',
  id: 'codex-call-item-1',
  call_id: 'codex-call-1',
  name: 'shell_command',
  arguments: '{"command":"pnpm typecheck"}',
};
const codexNativeToolView = toAgentSessionItemView({
  ...canonicalToolItem,
  itemId: 'agent-item-codex-native-call',
  kind: 'tool_call',
  status: 'pending',
  toolName: 'shell_command',
  toolCallId: 'codex-call-1',
  toolArguments: codexNativeCall,
  toolResult: undefined,
});
assert.equal(
  (codexNativeToolView.tool_calls?.[0] as Record<string, unknown>).type,
  'function_call',
  'Codex response items must reach the Codex protocol adapter without an arguments wrapper.',
);
assert.equal(
  (codexNativeToolView.tool_calls?.[0] as Record<string, unknown>).arguments,
  codexNativeCall.arguments,
);
const normalizedCodexCall = normalizeAgentSessionItemToolCalls(
  codexNativeToolView.tool_calls,
  { engineId: 'codex' },
)[0];
assert.equal(normalizedCodexCall?.id, 'codex-call-1');
assert.equal(normalizedCodexCall?.name, 'shell_command');
assert.equal(normalizedCodexCall?.command, 'pnpm typecheck');

const claudeNativeResult = {
  type: 'mcp_tool_result',
  tool_use_id: 'claude-call-1',
  content: [{ type: 'text', text: 'found' }],
};
const claudeNativeToolView = toAgentSessionItemView({
  ...canonicalToolItem,
  itemId: 'agent-item-claude-native-result',
  toolName: 'mcp__docs__search',
  toolCallId: 'claude-call-1',
  toolResult: claudeNativeResult,
});
assert.equal(
  (claudeNativeToolView.tool_calls?.[0] as Record<string, unknown>).type,
  'mcp_tool_result',
  'Claude content blocks must reach the Claude protocol adapter without an output wrapper.',
);
assert.deepEqual(
  (claudeNativeToolView.tool_calls?.[0] as Record<string, unknown>).content,
  claudeNativeResult.content,
);
const normalizedClaudeResult = normalizeAgentSessionItemToolCalls(
  claudeNativeToolView.tool_calls,
  { engineId: 'claude-code' },
)[0];
assert.equal(normalizedClaudeResult?.id, 'claude-call-1');
assert.equal(normalizedClaudeResult?.name, 'search');
assert.equal(normalizedClaudeResult?.serverName, 'docs');
assert.match(normalizedClaudeResult?.output ?? '', /found/);

const claudeHookEvent = {
  type: 'system',
  subtype: 'hook_response',
  tool_use_id: 'claude-call-1',
  hook_name: 'post-tool',
  outcome: 'success',
  output: 'checked',
};
const claudeHookView = toAgentSessionItemView({
  ...canonicalToolItem,
  itemId: 'agent-item-claude-hook',
  kind: 'tool_call',
  toolName: 'post-tool',
  toolCallId: 'claude-call-1',
  toolArguments: claudeHookEvent,
  toolResult: claudeHookEvent,
});
const normalizedClaudeHook = normalizeAgentSessionItemToolCalls(
  claudeHookView.tool_calls,
  { engineId: 'claude-code' },
)[0];
assert.equal(normalizedClaudeHook?.id, 'claude-call-1');
assert.equal(normalizedClaudeHook?.name, 'post-tool');
assert.equal(normalizedClaudeHook?.status, 'success');
assert.match(normalizedClaudeHook?.output ?? '', /checked/);

const openCodeNativeTool = {
  type: 'tool',
  callID: 'opencode-call-1',
  tool: 'mcp__docs__search',
  state: {
    status: 'completed',
    input: { q: 'session items' },
    output: 'found',
  },
};
const openCodeNativeToolView = toAgentSessionItemView({
  ...canonicalToolItem,
  itemId: 'agent-item-opencode-native-tool',
  kind: 'tool_call',
  toolName: 'mcp__docs__search',
  toolCallId: 'opencode-call-1',
  toolArguments: openCodeNativeTool,
  toolResult: openCodeNativeTool,
});
assert.equal(
  (openCodeNativeToolView.tool_calls?.[0] as Record<string, unknown>).type,
  'tool',
  'OpenCode parts must reach the OpenCode protocol adapter without an arguments wrapper.',
);
assert.deepEqual(
  (openCodeNativeToolView.tool_calls?.[0] as Record<string, unknown>).state,
  openCodeNativeTool.state,
);
const normalizedOpenCodeTool = normalizeAgentSessionItemToolCalls(
  openCodeNativeToolView.tool_calls,
  { engineId: 'opencode' },
)[0];
assert.equal(normalizedOpenCodeTool?.id, 'opencode-call-1');
assert.equal(normalizedOpenCodeTool?.name, 'mcp__docs__search');
assert.equal(normalizedOpenCodeTool?.status, 'success');
assert.equal(normalizedOpenCodeTool?.output, 'found');

const commandText = 'pnpm typecheck';
const canonicalCommandCall: AgentSessionItemRecord = {
  ...canonicalItem,
  itemId: 'agent-item-command-call',
  kind: 'tool_call',
  content: null,
  sequence: '9',
  status: 'pending',
  toolName: 'shell_command',
  toolCallId: 'agent-tool-call-command-1',
  toolArguments: { command: commandText, workdir: 'E:/sdkwork-space/sdkwork-birdcoder' },
};
const canonicalCommandResult: AgentSessionItemRecord = {
  ...canonicalCommandCall,
  itemId: 'agent-item-command-result',
  kind: 'tool_result',
  sequence: '10',
  status: 'completed',
  toolArguments: undefined,
  toolResult: {
    exitCode: 0,
    stdout: 'TypeScript check passed.',
    fileChanges: [{
      path: 'src/message.tsx',
      additions: 12,
      deletions: 3,
      originalContent: 'before',
      content: 'after',
    }],
  },
};
const commandCallView = toAgentSessionItemView(canonicalCommandCall);
const commandResultView = toAgentSessionItemView(canonicalCommandResult);
assert.deepEqual(commandResultView.fileChanges, [{
  path: 'src/message.tsx',
  additions: 12,
  deletions: 3,
  lineImpactKnown: true,
  originalContent: 'before',
  content: 'after',
}]);

const openCodeSnapshotDiffView = toAgentSessionItemView({
  ...canonicalCommandResult,
  itemId: 'agent-item-opencode-snapshot-diff',
  toolResult: {
    message: {
      summary: {
        diffs: [{
          file: 'src/opencode-message.tsx',
          patch: '@@ -1 +1 @@\n-before\n+after',
          additions: 1,
          deletions: 1,
          status: 'modified',
        }],
      },
    },
  },
});
assert.deepEqual(openCodeSnapshotDiffView.fileChanges, [{
  path: 'src/opencode-message.tsx',
  additions: 1,
  deletions: 1,
  lineImpactKnown: true,
  updateStatus: 'M',
  diff: '@@ -1 +1 @@\n-before\n+after',
}]);

const codexAppServerFileChangeView = toAgentSessionItemView({
  ...canonicalCommandResult,
  itemId: 'agent-item-codex-app-server-file-change',
  toolResult: {
    method: 'item/completed',
    params: {
      threadId: 'thread-codex-1',
      turnId: 'turn-codex-1',
      item: {
        id: 'codex-file-change-1',
        type: 'fileChange',
        status: 'completed',
        changes: [{
          path: 'src/codex-app-server.ts',
          kind: { type: 'update', movePath: null },
          diff: '@@ -1 +1 @@\n-before\n+after',
        }],
      },
    },
  },
});
assert.deepEqual(codexAppServerFileChangeView.fileChanges, [{
  path: 'src/codex-app-server.ts',
  additions: 1,
  deletions: 1,
  lineImpactKnown: true,
  updateStatus: 'M',
  diff: '@@ -1 +1 @@\n-before\n+after',
}]);

const codexAppServerCreatedFileView = toAgentSessionItemView({
  ...canonicalCommandResult,
  itemId: 'agent-item-codex-app-server-created-file',
  toolResult: {
    item: {
      id: 'codex-file-change-created-1',
      type: 'fileChange',
      status: 'completed',
      changes: [{
        path: 'src/codex-created-v2.ts',
        kind: { type: 'add' },
        diff: 'export const created = true;\n',
      }],
    },
  },
});
assert.deepEqual(codexAppServerCreatedFileView.fileChanges, [{
  path: 'src/codex-created-v2.ts',
  additions: 1,
  deletions: 0,
  lineImpactKnown: true,
  updateStatus: 'A',
  content: 'export const created = true;\n',
  originalContent: '',
}]);

const codexAppServerMovedFileView = toAgentSessionItemView({
  ...canonicalCommandResult,
  itemId: 'agent-item-codex-app-server-moved-file',
  toolResult: {
    item: {
      id: 'codex-file-change-moved-1',
      type: 'fileChange',
      status: 'completed',
      changes: [{
        path: 'src/codex-before-move.ts',
        kind: { type: 'update', movePath: 'src/codex-after-move.ts' },
        diff: '@@ -1 +1 @@\n-before\n+after',
      }],
    },
  },
});
assert.deepEqual(codexAppServerMovedFileView.fileChanges, [{
  path: 'src/codex-after-move.ts',
  additions: 1,
  deletions: 1,
  lineImpactKnown: true,
  updateStatus: 'R',
  diff: '@@ -1 +1 @@\n-before\n+after',
}]);

const codexCoreFileChangeMapView = toAgentSessionItemView({
  ...canonicalCommandResult,
  itemId: 'agent-item-codex-core-file-change-map',
  toolResult: {
    type: 'patch',
    changes: {
      'src/codex-created.ts': {
        type: 'add',
        content: 'export const created = true;\n',
      },
    },
  },
});
assert.deepEqual(codexCoreFileChangeMapView.fileChanges, [{
  path: 'src/codex-created.ts',
  additions: 1,
  deletions: 0,
  lineImpactKnown: true,
  updateStatus: 'A',
  content: 'export const created = true;\n',
  originalContent: '',
}]);

const geminiCliFileDiffView = toAgentSessionItemView({
  ...canonicalCommandResult,
  itemId: 'agent-item-gemini-cli-file-diff',
  toolResult: {
    response: {
      callId: 'gemini-write-file-1',
      display: {
        name: 'WriteFile',
        result: {
          type: 'diff',
          path: 'src/gemini-cli.ts',
          beforeText: 'const state = "before";\n',
          afterText: 'const state = "after";\n',
        },
      },
      resultDisplay: {
        fileDiff: '@@ -1 +1 @@\n-const state = "before";\n+const state = "after";',
        fileName: 'gemini-cli.ts',
        filePath: 'src/gemini-cli.ts',
        originalContent: 'const state = "before";\n',
        newContent: 'const state = "after";\n',
        diffStat: {
          model_added_lines: 1,
          model_removed_lines: 1,
        },
      },
    },
  },
});
assert.deepEqual(geminiCliFileDiffView.fileChanges, [{
  path: 'src/gemini-cli.ts',
  additions: 1,
  deletions: 1,
  lineImpactKnown: true,
  updateStatus: 'M',
  diff: '@@ -1 +1 @@\n-const state = "before";\n+const state = "after";',
  content: 'const state = "after";\n',
  originalContent: 'const state = "before";\n',
}]);

const claudeAgentSdkEditView = toAgentSessionItemView({
  ...canonicalCommandResult,
  itemId: 'agent-item-claude-agent-sdk-edit',
  toolResult: {
    type: 'user',
    parent_tool_use_id: null,
    tool_use_result: {
      filePath: 'src/claude-agent-sdk.ts',
      oldString: 'before',
      newString: 'after',
      originalFile: 'export const state = "before";\n',
      structuredPatch: [{
        oldStart: 1,
        oldLines: 1,
        newStart: 1,
        newLines: 1,
        lines: ['-export const state = "before";', '+export const state = "after";'],
      }],
      userModified: false,
      replaceAll: false,
      gitDiff: {
        filename: 'src/claude-agent-sdk.ts',
        status: 'modified',
        additions: 1,
        deletions: 1,
        changes: 2,
        patch: '@@ -1 +1 @@\n-export const state = "before";\n+export const state = "after";',
      },
    },
  },
});
assert.deepEqual(claudeAgentSdkEditView.fileChanges, [{
  path: 'src/claude-agent-sdk.ts',
  additions: 1,
  deletions: 1,
  lineImpactKnown: true,
  updateStatus: 'M',
  diff: '@@ -1 +1 @@\n-export const state = "before";\n+export const state = "after";',
  content: 'export const state = "after";\n',
  originalContent: 'export const state = "before";\n',
}]);

const claudeAgentSdkWriteView = toAgentSessionItemView({
  ...canonicalCommandResult,
  itemId: 'agent-item-claude-agent-sdk-write',
  toolResult: {
    toolUseResult: {
      type: 'create',
      filePath: 'src/claude-created.ts',
      content: 'export const created = true;\n',
      originalFile: null,
      structuredPatch: [{
        oldStart: 0,
        oldLines: 0,
        newStart: 1,
        newLines: 1,
        lines: ['+export const created = true;'],
      }],
    },
  },
});
assert.deepEqual(claudeAgentSdkWriteView.fileChanges, [{
  path: 'src/claude-created.ts',
  additions: 1,
  deletions: 0,
  lineImpactKnown: true,
  updateStatus: 'A',
  diff: '@@ -0,0 +1,1 @@\n+export const created = true;',
  content: 'export const created = true;\n',
  originalContent: '',
}]);

const snakeCaseFileChangeView = toAgentSessionItemView({
  ...canonicalCommandResult,
  itemId: 'agent-item-snake-case-file-change',
  toolResult: {
    data: {
      file_changes: {
        primary: {
          file_path: 'src/provider-adapter.ts',
          lines_added: 2,
          lines_deleted: 1,
          original_content: 'before\n',
          new_content: '',
          unified_diff: '@@ -1 +0,0 @@\n-before',
          update_status: 'deleted',
        },
      },
    },
  },
});
assert.deepEqual(snakeCaseFileChangeView.fileChanges, [{
  path: 'src/provider-adapter.ts',
  additions: 2,
  deletions: 1,
  lineImpactKnown: true,
  updateStatus: 'D',
  diff: '@@ -1 +0,0 @@\n-before',
  content: '',
  originalContent: 'before\n',
}]);

const beforeAfterFileChangeView = toAgentSessionItemView({
  ...canonicalCommandResult,
  itemId: 'agent-item-before-after-file-change',
  toolResult: {
    changes: [{
      path: 'src/gemini-message.ts',
      before: 'old value',
      after: 'new value',
      status: 'added',
    }],
  },
});
assert.deepEqual(beforeAfterFileChangeView.fileChanges, [{
  path: 'src/gemini-message.ts',
  additions: 0,
  deletions: 0,
  lineImpactKnown: false,
  updateStatus: 'A',
  content: 'new value',
  originalContent: 'old value',
}]);
const commandTranscript = composeAgentSessionTranscriptActivity(
  [commandCallView, commandResultView],
  { engineId: 'codex' },
);
const commandActivity = commandTranscript
  .map((item) => resolveAgentTurnActivityPresentation(commandTranscript, item, { engineId: 'codex' }))
  .find((activity) => (activity?.commands.length ?? 0) > 0);

assert.ok(commandActivity, 'canonical command Session Items must produce transcript command activity');
assert.deepEqual(commandActivity.commands, [{
  command: commandText,
  status: 'success',
  output: 'TypeScript check passed.',
  kind: 'command',
  toolName: canonicalCommandCall.toolName,
  toolCallId: canonicalCommandCall.toolCallId,
}]);
const commandActivityItem = commandTranscript.find((item) => item.role === 'tool');
assert.ok(commandActivityItem);
const commandActivityView = resolveAgentSessionItemPresentation(commandActivityItem, {
  activitySummary: commandActivity,
  engineId: 'codex',
});
const commandActivityBlocks = commandActivityView.blocks.filter(
  (block) => block.type === 'activity',
);
assert.equal(
  commandActivityBlocks.length,
  1,
  'A tool lifecycle with commands and file changes must render as one activity disclosure.',
);
assert.equal(commandActivityBlocks[0]?.commands.length, 1);
assert.equal(commandActivityBlocks[0]?.fileChanges.length, 1);

const providerTodoFixtures = [
  {
    engineId: 'codex',
    toolCall: {
      id: 'codex-plan-1',
      type: 'todo_list',
      items: [
        { text: 'Inspect message protocol parts', status: 'completed' },
        { text: 'Align the shared renderer', status: 'in_progress' },
        { text: 'Verify compact layout', status: 'pending' },
      ],
    },
  },
  {
    engineId: 'opencode',
    toolCall: {
      type: 'tool',
      part: {
        id: 'opencode-plan-1',
        type: 'tool',
        tool: 'todowrite',
        state: {
          status: 'completed',
          input: {
            todos: [
              { content: 'Inspect message protocol parts', status: 'completed' },
              { content: 'Align the shared renderer', status: 'in_progress' },
              { content: 'Verify compact layout', status: 'pending' },
            ],
          },
        },
      },
    },
  },
  {
    engineId: 'claude-code',
    toolCall: {
      contentBlock: {
        id: 'claude-plan-1',
        type: 'tool_use',
        name: 'TodoWrite',
        input: {
          todos: [
            { content: 'Inspect message protocol parts', status: 'completed' },
            { content: 'Align the shared renderer', status: 'in_progress' },
            { content: 'Verify compact layout', status: 'pending' },
          ],
        },
      },
    },
  },
  {
    engineId: 'gemini',
    toolCall: {
      id: 'gemini-plan-1',
      type: 'tool_use',
      tool_id: 'gemini-plan-1',
      tool_name: 'write_todos',
      parameters: {
        tasks: [
          { description: 'Inspect message protocol parts', status: 'completed' },
          { description: 'Align the shared renderer', status: 'running' },
          { description: 'Verify compact layout', status: 'pending' },
        ],
      },
      status: 'completed',
    },
  },
] as const;

for (const fixture of providerTodoFixtures) {
  const presentation = resolveAgentSessionItemPresentation({
    ...transientItemView,
    id: `${fixture.engineId}-todo-item`,
    content: '',
    tool_calls: [fixture.toolCall],
  }, { engineId: fixture.engineId });
  const taskProgressBlock = presentation.blocks.find((block) => block.type === 'task-progress');
  assert.ok(
    taskProgressBlock && taskProgressBlock.type === 'task-progress',
    `${fixture.engineId} todo updates must project into the shared task progress block.`,
  );
  assert.deepEqual(
    taskProgressBlock.progress.items.map((item) => ({ status: item.status, text: item.text })),
    [
      { status: 'completed', text: 'Inspect message protocol parts' },
      { status: 'running', text: 'Align the shared renderer' },
      { status: 'pending', text: 'Verify compact layout' },
    ],
  );
  assert.equal(taskProgressBlock.progress.completed, 1);
  assert.equal(taskProgressBlock.progress.total, 3);
  assert.equal(
    presentation.blocks.some((block) =>
      block.type === 'tool-calls'
      && block.calls.some((call) => /todo|plan/u.test(call.name.toLowerCase())),
    ),
    false,
    `${fixture.engineId} todo payloads must not render a duplicate generic tool card.`,
  );
}

const provisionalUserItem: AgentSessionItemView = {
  id: '',
  sessionId: canonicalItem.sessionId,
  turnId: canonicalItem.turnId,
  role: 'user',
  content: 'First item without a canonical id.',
  createdAt: '2026-07-23T08:01:00.000Z',
};
const unrelatedProvisionalAssistantItem: AgentSessionItemView = {
  ...provisionalUserItem,
  role: 'assistant',
  content: 'A distinct item without a canonical id.',
  createdAt: '2026-07-23T08:01:01.000Z',
};
const completedUserItem: AgentSessionItemView = {
  ...provisionalUserItem,
  id: 'agent-item-provisional-completed',
  commands: [{ command: 'pnpm typecheck', status: 'success' }],
};

assert.equal(
  areAgentSessionItemsLogicallyMatched(
    provisionalUserItem,
    unrelatedProvisionalAssistantItem,
  ),
  false,
  'blank provisional ids must not collapse unrelated canonical Session Item candidates.',
);
assert.deepEqual(
  deduplicateAgentSessionItemViews([
    provisionalUserItem,
    unrelatedProvisionalAssistantItem,
    completedUserItem,
  ]).map((item) => ({
    id: item.id,
    role: item.role,
    content: item.content,
    commands: item.commands,
  })),
  [
    {
      id: 'agent-item-provisional-completed',
      role: 'user',
      content: 'First item without a canonical id.',
      commands: [{ command: 'pnpm typecheck', status: 'success' }],
    },
    {
      id: '',
      role: 'assistant',
      content: 'A distinct item without a canonical id.',
      commands: undefined,
    },
  ],
  'a canonical item may complete one matching provisional item without collapsing other rows.',
);

const longMetadataItems = deduplicateAgentSessionItemViews([
  {
    ...provisionalUserItem,
    id: 'agent-item-with-long-metadata',
    metadata: { requestId: 101777208078558063n },
  },
  {
    ...unrelatedProvisionalAssistantItem,
    id: 'agent-item-without-long-metadata',
  },
]);
assert.equal(
  longMetadataItems.length,
  2,
  'Session Item signatures must preserve Long-safe metadata without crashing synchronization.',
);

console.log('agent session item view contract passed.');
