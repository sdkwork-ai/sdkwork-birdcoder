import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import {
  buildChatContentPreview,
  buildChatLinePreview,
  buildCommandOutputPreview,
  MAX_CHAT_CONTENT_PREVIEW_CHARACTERS,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/contentPreview.ts';
import {
  resolveMessageActionTargetCopyText,
} from '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/messageActions.ts';

const chatMessageViewSource = readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/chat-message-view.ts',
    import.meta.url,
  ),
  'utf8',
);
const contentPreviewSource = readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/contentPreview.ts',
    import.meta.url,
  ),
  'utf8',
);
const defaultRegistrySource = readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/defaultRegistry.ts',
    import.meta.url,
  ),
  'utf8',
);
const enginePluginsSource = readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/plugins/enginePlugins.tsx',
    import.meta.url,
  ),
  'utf8',
);
const contentBlockDefaultRegistrySource = readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/contentBlocks/defaultRegistry.ts',
    import.meta.url,
  ),
  'utf8',
);
const contentBlockRenderersSource = readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/contentBlocks/ContentBlockRenderers.tsx',
    import.meta.url,
  ),
  'utf8',
);
const reasoningContentBlockSource = readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/contentBlocks/ReasoningContentBlock.tsx',
    import.meta.url,
  ),
  'utf8',
);
const toolCallCardSource = readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/contentBlocks/ToolCallCard.tsx',
    import.meta.url,
  ),
  'utf8',
);
const toolResultBlocksSource = readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/contentBlocks/ToolResultBlocks.tsx',
    import.meta.url,
  ),
  'utf8',
);
const toolInputDetailsSource = readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/contentBlocks/ToolInputDetails.tsx',
    import.meta.url,
  ),
  'utf8',
);
const contentBlocksSource = readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/contentBlocks/ContentBlockList.tsx',
    import.meta.url,
  ),
  'utf8',
);
const replyRenderersSource = readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/renderers/ReplyMessageRenderers.tsx',
    import.meta.url,
  ),
  'utf8',
);
const messageActionsSource = readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/messageActions.ts',
    import.meta.url,
  ),
  'utf8',
);
const roleHeaderSource = readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/renderers/RoleHeader.tsx',
    import.meta.url,
  ),
  'utf8',
);
const englishChatSource = readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-i18n/src/locales/en/chat.ts',
    import.meta.url,
  ),
  'utf8',
);
const chineseChatSource = readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-i18n/src/locales/zh/chat.ts',
    import.meta.url,
  ),
  'utf8',
);

const oversizedContent = `preview-head:${'x'.repeat(
  MAX_CHAT_CONTENT_PREVIEW_CHARACTERS * 2,
)}:preview-tail`;
const boundedContentPreview = buildChatContentPreview(oversizedContent);
assert.equal(boundedContentPreview.isTruncated, true);
assert.ok(
  boundedContentPreview.text.length <= MAX_CHAT_CONTENT_PREVIEW_CHARACTERS,
  'Shared chat previews must enforce their advertised character budget.',
);
assert.match(boundedContentPreview.text, /^preview-head:/u);
assert.match(boundedContentPreview.text, /:preview-tail$/u);

const boundedSingleLineDiff = buildChatLinePreview(
  `+${'a'.repeat(MAX_CHAT_CONTENT_PREVIEW_CHARACTERS * 2)}`,
  { maxLines: 80 },
);
assert.equal(boundedSingleLineDiff.isTruncated, true);
assert.ok(
  boundedSingleLineDiff.lines.join('\n').length
    <= MAX_CHAT_CONTENT_PREVIEW_CHARACTERS,
  'A single minified diff line must not bypass the activity character budget.',
);

const lineBoundedCommandPreview = buildCommandOutputPreview(
  Array.from({ length: 80 }, (_, index) => `line ${index + 1}`).join('\n'),
);
assert.equal(lineBoundedCommandPreview.omittedLineCount, 56);
assert.equal(lineBoundedCommandPreview.isCharacterTruncated, false);
assert.match(lineBoundedCommandPreview.text, /line 80$/u);

const characterBoundedCommandPreview = buildCommandOutputPreview(
  `command-output:${'b'.repeat(MAX_CHAT_CONTENT_PREVIEW_CHARACTERS * 2)}:final-error`,
);
assert.equal(characterBoundedCommandPreview.isCharacterTruncated, true);
assert.equal(characterBoundedCommandPreview.omittedLineCount, 0);
assert.ok(
  characterBoundedCommandPreview.text.length <= MAX_CHAT_CONTENT_PREVIEW_CHARACTERS,
  'A single-line command output must remain bounded in the rendered DOM.',
);
assert.match(characterBoundedCommandPreview.text, /:final-error$/u);

const whitespacePreservingCommandOutput = '  indented output\nline with trailing spaces  \n';
assert.equal(
  buildCommandOutputPreview(whitespacePreservingCommandOutput).text,
  whitespacePreservingCommandOutput,
  'Command previews must preserve terminal indentation and trailing whitespace when no truncation is needed.',
);

const groupedReplyCopyText = resolveMessageActionTargetCopyText(
  [
    { id: 'assistant-before-tool', role: 'assistant', content: 'Visible preface.' },
    { id: 'hidden-tool-json', role: 'tool', content: '{"issues":[{"severity":"high"}]}' },
    { id: 'assistant-after-tool', role: 'assistant', content: 'Visible conclusion.' },
  ] as Parameters<typeof resolveMessageActionTargetCopyText>[0],
  { startIndex: 0, endIndex: 2 },
  '',
);
assert.equal(
  groupedReplyCopyText,
  'Visible preface.\n\nVisible conclusion.',
  'Reply-level copy must exclude tool protocol bodies that are not rendered as authored Markdown.',
);

const lineBoundaryImplementation = contentPreviewSource.match(
  /function findNextLineBoundary\([\s\S]*?\n\}/u,
)?.[0] ?? '';
assert.doesNotMatch(
  lineBoundaryImplementation,
  /indexOf\(/u,
  'Line scanning must advance one cursor instead of rescanning the remaining output for every line.',
);
const largeCommandOutput = Array.from(
  { length: 50_000 },
  (_, index) => `provider output ${index}`,
).join('\n');
const largeCommandPreviewStartedAt = performance.now();
const largeCommandPreview = buildCommandOutputPreview(largeCommandOutput);
const largeCommandPreviewDuration = performance.now() - largeCommandPreviewStartedAt;
assert.equal(largeCommandPreview.omittedLineCount, 49_976);
assert.match(largeCommandPreview.text, /provider output 49999$/u);
assert.ok(
  largeCommandPreviewDuration < 1_000,
  `Large command previews must remain linear-time (measured ${largeCommandPreviewDuration.toFixed(1)} ms).`,
);

assert.match(
  chatMessageViewSource,
  /AgentSessionItemViewKind/,
  'pc-types must export AgentSessionItemViewKind for transcript message views.',
);
assert.match(
  chatMessageViewSource,
  /from '.\/agent-session-view\.ts'/,
  'Transcript rendering types must derive from the local ephemeral Agents Session Item view adapter.',
);
assert.match(
  chatMessageViewSource,
  /tool-calls/,
  'pc-types chat message view must model tool-calls content blocks.',
);
assert.match(
  defaultRegistrySource,
  /createEngineChatMessageRendererEntries\(\)/,
  'default chat message renderer registry must register per-engine plugins.',
);
assert.match(
  enginePluginsSource,
  /ENGINE_SURFACE_LABELS[\s\S]*codex:[\s\S]*'claude-code':[\s\S]*gemini:[\s\S]*opencode:/,
  'Engine transcript labels must cover every built-in code engine.',
);
assert.match(
  enginePluginsSource,
  /flex w-full min-w-0 max-w-full flex-col/,
  'engine transcript plugin wrappers must shrink inside narrow code and sidebar surfaces.',
);
assert.match(
  enginePluginsSource,
  /const isAuthoredReply =[\s\S]*const showEngineLabel = isAuthoredReply && props\.view\.blocks\.some\([\s\S]*block\.type === 'markdown' && !block\.noticeKind/,
  'Engine identity must follow visible authored Markdown, including mixed activity replies, and stay off protocol-only rows.',
);
assert.doesNotMatch(
  enginePluginsSource,
  /rounded-full|uppercase|tracking-wide/,
  'Engine identity must remain a quiet byline instead of a competing colorful provider pill.',
);
assert.match(
  chatMessageViewSource,
  /type: 'activity'/,
  'pc-types chat message view must model unified activity content blocks.',
);
assert.match(
  contentBlocksSource,
  /ContentBlockList/,
  'content block list must render view.blocks via registry.',
);
assert.match(
  contentBlockDefaultRegistrySource,
  /ActivityContentBlockRenderer/,
  'default content block registry must register unified activity block renderers.',
);
assert.match(
  contentBlockDefaultRegistrySource,
  /blockType: 'reasoning'[\s\S]*Component: ReasoningContentBlock/,
  'Reasoning-summary blocks must use their own renderer instead of falling through to Markdown.',
);
assert.match(
  reasoningContentBlockSource,
  /data-chat-reasoning-disclosure[\s\S]*aria-expanded=\{isExpanded\}[\s\S]*aria-controls=\{detailsId\}[\s\S]*id=\{detailsId\}/,
  'Reasoning summaries must be collapsed by default and expose an associated keyboard-operable disclosure.',
);
assert.match(
  reasoningContentBlockSource,
  /copyMessageToClipboard\(item\.summary\)/,
  'Reasoning summaries must own a semantic copy action without entering reply-level authored copy.',
);
assert.match(
  reasoningContentBlockSource,
  /sourceMessage\?\.id\?\.trim\(\)[\s\S]*sourceMessage\?\.turnId/,
  'Each reasoning message must own independent disclosure state even when providers reuse a turn id.',
);
assert.match(
  reasoningContentBlockSource,
  /max-h-96[\s\S]*overflow-y-auto|overflow-y-auto[\s\S]*max-h-96/,
  'Expanded reasoning summaries must use a bounded scroll region for virtualized transcripts.',
);
assert.match(
  reasoningContentBlockSource,
  /\[@media\(hover:none\)\]:opacity-100/,
  'Reasoning copy actions must stay discoverable on touch-only devices.',
);
assert.doesNotMatch(
  reasoningContentBlockSource,
  /aria-live=|role="status"/,
  'Historical reasoning summaries must remain static during virtualization mounts.',
);
assert.match(
  contentBlockRenderersSource,
  /<ChatActivitySummary/,
  'activity block rendering must delegate to ChatActivitySummary.',
);
assert.match(
  contentBlockRenderersSource,
  /<ToolCallCard/,
  'tool-calls block rendering must delegate to structured ToolCallCard components.',
);
assert.match(
  toolCallCardSource,
  /data-chat-tool-kind=\{call\.kind \?\? 'other'\}/,
  'tool call rows must expose their normalized semantic kind instead of provider-specific JSON.',
);
assert.match(
  toolCallCardSource,
  /<ToolResultBlocks[\s\S]*?blocks=\{call\.resultBlocks \?\? \[\]\}[\s\S]*?copyMessageToClipboard=\{copyMessageToClipboard\}/,
  'Structured provider results must delegate to the rich result-block renderer with its full-content copy action.',
);
assert.match(
  toolCallCardSource,
  /<ToolResultBlocks[\s\S]*?status=\{call\.status\}/,
  'Structured result rendering must receive the normalized call status so cancellation is not styled as failure.',
);
assert.match(
  toolResultBlocksSource,
  /export function resolveToolResultBlocksCopyContent\([\s\S]*case 'text':[\s\S]*case 'diff':[\s\S]*case 'list':[\s\S]*case 'link':[\s\S]*case 'resource':[\s\S]*case 'image':[\s\S]*case 'audio':/,
  'Result-block-only calls must provide one provider-neutral semantic copy representation without protocol JSON.',
);
assert.match(
  toolResultBlocksSource,
  /block\.type === 'link'[\s\S]*block\.type === 'resource'[\s\S]*block\.type === 'image'/,
  'MCP links, resources, and media must remain semantic instead of degrading into JSON text.',
);
assert.match(
  toolResultBlocksSource,
  /function renderTruncatedNotice\([\s\S]*typeof fullContent === 'function' \? fullContent\(\) : fullContent/,
  'Truncated structured tool results must defer full-content assembly until the user invokes Copy.',
);
assert.match(
  toolResultBlocksSource,
  /data-chat-task-result-list=\{isTaskResultList \? 'true' : undefined\}[\s\S]{0,220}role="region"[\s\S]{0,220}<ul className=/,
  'Scrollable structured result lists must preserve native list semantics inside their labelled region.',
);
assert.doesNotMatch(
  toolResultBlocksSource,
  /<ul[\s\S]{0,180}role="region"/,
  'Structured result lists must not replace native list semantics with an ARIA region role.',
);
assert.match(
  toolCallCardSource,
  /call\.serverName[\s\S]*call\.name/,
  'MCP tool rows must render a compact server/tool identity.',
);
assert.match(
  toolCallCardSource,
  /call\.kind === 'task'[\s\S]*call\.title[\s\S]*primaryDisplayName = taskTitle \|\| displayName/,
  'Task rows must keep their human-readable title in the primary narrow-screen slot.',
);
assert.match(
  toolCallCardSource,
  /aria-expanded=\{isExpanded\}/,
  'tool call detail rows must expose their expansion state.',
);
assert.match(
  toolCallCardSource,
  /aria-controls=\{detailsId\}[\s\S]*id=\{detailsId\}/,
  'Tool disclosures must explicitly associate their control with their expanded details.',
);
assert.match(
  toolCallCardSource,
  /case 'agent':[\s\S]*<Bot/,
  'subagent activity must use a dedicated semantic identity instead of a generic tool row.',
);
assert.match(
  toolCallCardSource,
  /formatToolCallDuration\(call\.durationMs\)/,
  'provider execution timing must render as compact commercial-grade activity metadata.',
);
assert.match(
  toolCallCardSource,
  /toolStatusCancelled/,
  'cancelled tool activity must have an explicit accessible state.',
);
assert.match(
  toolCallCardSource,
  /return call\.status \? labels\[call\.status\] : null;[\s\S]*if \(!call\.status\) \{\s*return null;\s*\}/,
  'Provider activities without a lifecycle status must omit status UI instead of presenting missing data as a failure.',
);
assert.doesNotMatch(
  toolCallCardSource,
  /toolStatusUnknown|Status unavailable|status === 'unknown'/,
  'Undefined provider status must not leak an unavailable or synthetic unknown label into the transcript.',
);
assert.doesNotMatch(
  toolCallCardSource,
  /aria-live="polite"|role="status"/,
  'Historical tool rows must not register a live region for every static provider status.',
);
assert.match(
  toolCallCardSource,
  /MAX_TOOL_CALL_DETAIL_PREVIEW_CHARACTERS\s*=\s*MAX_CHAT_CONTENT_PREVIEW_CHARACTERS/,
  'Expanded tool details must consume the shared rendered-content budget.',
);
assert.match(
  toolResultBlocksSource,
  /buildChatContentPreview\(/,
  'Rich provider result blocks must consume the same bounded preview policy as tool details.',
);
assert.match(
  toolResultBlocksSource,
  /function selectVisibleResultBlocks\([\s\S]*slice\(0, headCount\)[\s\S]*slice\(-tailCount\)/,
  'Bounded rich results must preserve both leading context and trailing failures or summaries.',
);
assert.match(
  toolResultBlocksSource,
  /data-chat-task-result-list=\{isTaskResultList \? 'true' : undefined\}/,
  'Task result markers must render through a dedicated semantic checklist instead of leaking marker strings.',
);
assert.match(
  toolCallCardSource,
  /MAX_TOOL_CALL_ARGUMENT_SUMMARY_CHARACTERS = 320/,
  'Collapsed tool rows must cap argument summaries so provider payloads cannot create oversized hidden text nodes.',
);
assert.match(
  toolCallCardSource,
  /const argumentSummary = useMemo\([\s\S]*truncateToolCallArgumentSummary\([\s\S]*call\.title\?\.trim\(\)[\s\S]*summarizeToolCallArguments\(call\.arguments\)/,
  'All collapsed tool metadata, including provider titles, targets, and commands, must share the bounded summary path.',
);
assert.match(
  toolCallCardSource,
  /\{isExpanded \? \([\s\S]*<ToolInputDetails/,
  'Collapsed tools must defer structured input parsing until the disclosure is opened.',
);
assert.match(
  toolInputDetailsSource,
  /data-chat-tool-input-fields="true"[\s\S]*<dl[\s\S]*<dt[\s\S]*<dd/,
  'Structured tool inputs must render semantic key/value fields instead of a complete JSON object.',
);
assert.match(
  toolInputDetailsSource,
  /trimmedArguments\.length > MAX_CHAT_CONTENT_PREVIEW_CHARACTERS/,
  'Oversized tool inputs must bypass JSON parsing and use the bounded fallback preview.',
);
assert.match(
  toolInputDetailsSource,
  /hasTruncatedField \|\|= preview\.isTruncated[\s\S]*isTruncated: omittedFieldCount > 0 \|\| hasTruncatedField[\s\S]*structuredInput\.isTruncated/,
  'Structured tool inputs must disclose truncation when either fields are omitted or one visible field is shortened.',
);
assert.match(
  toolInputDetailsSource,
  /overflow-auto custom-scrollbar \$\{compact \? 'max-h-36' : 'max-h-48'\}[\s\S]*role="region"[\s\S]*<dl/,
  'Structured tool inputs must use a bounded labelled scroll region just like fallback provider input.',
);
assert.match(
  toolCallCardSource,
  /onClick=\{\(\) => copyMessageToClipboard\(\s*hasResultBlocks\s*\? resolveToolResultBlocksCopyContent\(call\.resultBlocks \?\? \[\]\)/,
  'Full semantic tool output must be assembled only when the user invokes Copy.',
);
assert.match(
  toolCallCardSource,
  /data-chat-tool-output-state=\{isOutputPending \? 'pending' : 'empty'\}/,
  'Expanded tools must distinguish pending output from completed empty output.',
);
assert.match(
  toolResultBlocksSource,
  /data-chat-tool-result-empty="true"/,
  'Empty structured lists must render an explicit result state instead of a blank output container.',
);
assert.match(
  toolResultBlocksSource,
  /const isCancelled = status === 'cancelled'[\s\S]*data-chat-tool-result-tone=\{isCancelled \? 'cancelled' : 'error'\}[\s\S]*role=\{isCancelled \? 'region' : 'alert'\}/,
  'Cancelled tool reasons must remain visible with a neutral region tone while real errors retain alert styling.',
);
assert.match(
  replyRenderersSource,
  /<ContentBlockList view=\{view\} context=\{context\} \/>/,
  'message renderers must render standardized content blocks instead of ad-hoc fields.',
);
assert.match(
  replyRenderersSource,
  /RoleHeader/,
  'reply renderers must show role-specific headers for authored planner, reviewer, and system views.',
);
assert.doesNotMatch(
  roleHeaderSource,
  /'tool\.result'/,
  'Tool-result messages must not repeat a generic Tool role above their semantic tool rows.',
);
assert.match(
  contentBlockRenderersSource,
  /data-chat-system-notice=\{noticeKind\}/,
  'provider lifecycle messages must render as dedicated compact status rows.',
);
assert.match(
  chatMessageViewSource,
  /call\.presentation !== 'notice'[\s\S]*type: 'notice'[\s\S]*blocks\.unshift\(\.\.\.toolNoticeBlocks\)/,
  'Gemini notice-format tool displays must use an independent provider-neutral content block instead of changing the whole reply.',
);
assert.match(
  contentBlockRenderersSource,
  /NoticeContentBlockRenderer[\s\S]*data-chat-tool-notice=\{block\.noticeKind\}[\s\S]*role="note"/,
  'Provider-neutral tool notices must render as static message-like notes without disclosure semantics.',
);
assert.match(
  contentBlockRenderersSource,
  /warning: 'Provider warning'[\s\S]*noticeWarning[\s\S]*const isWarning = noticeKind === 'warning'[\s\S]*text-amber-200\/90[\s\S]*data-chat-system-notice=\{noticeKind\}[\s\S]*role="note"/,
  'Persisted provider notices must keep their visual severity without becoming per-row live regions during history or virtualization mounts.',
);
assert.match(
  replyRenderersSource,
  /const hasAuthoredMarkdown = view\.blocks\.some\([\s\S]*!block\.noticeKind[\s\S]*const hasStructuredActivity = view\.blocks\.some\([\s\S]*const suppressReplyChrome = !hasAuthoredMarkdown && hasStructuredActivity/,
  'notice, resource, reasoning, and activity-only rows must suppress reply chrome without hiding chrome on mixed authored replies.',
);
assert.match(
  replyRenderersSource,
  /suppressReplyChrome \? null[\s\S]*context\.showMessageActions && !suppressReplyChrome/,
  'activity-only rows must omit both role headers and message-level action controls.',
);
assert.match(
  replyRenderersSource,
  /const hasCopyContent = copyContent\.trim\(\)\.length > 0;[\s\S]*\{hasCopyContent \? \([\s\S]*copyMessageToClipboard\(copyContent\)/,
  'Activity-only reply groups must not expose a message-level Copy action with empty content.',
);
assert.match(
  messageActionsSource,
  /if \(!message \|\| message\.role === 'tool'\) \{\s*continue;/,
  'Grouped reply copy must skip tool protocol messages; tool rows own their semantic copy actions.',
);
for (const localeSource of [englishChatSource, chineseChatSource]) {
  for (const translationKey of [
    'fileOperationCreated',
    'fileOperationDeleted',
    'fileOperationModified',
    'fileOperationMoved',
    'fileOperationMovedFrom',
    'fileOperationUpdated',
    'noticeInfo',
    'taskItemBlocked',
    'taskItemCancelled',
    'taskItemCompleted',
    'taskItemPending',
    'taskItemRunning',
    'toolNoOutput',
    'toolOutputPending',
    'toolResultEmpty',
  ]) {
    assert.match(
      localeSource,
      new RegExp(`${translationKey}:`),
      `${translationKey} must be localized for every supported transcript locale.`,
    );
  }
}

console.log('chat message renderer contract passed.');
