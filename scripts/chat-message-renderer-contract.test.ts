import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const chatMessageViewSource = readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-contracts-commons/src/chat-message-view.ts',
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
const toolCallCardSource = readFileSync(
  new URL(
    '../apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-ui/src/components/chat/messages/contentBlocks/ToolCallCard.tsx',
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

assert.match(
  chatMessageViewSource,
  /BirdCoderChatMessageViewKind/,
  'pc-types must export BirdCoderChatMessageViewKind for transcript message views.',
);
assert.match(
  chatMessageViewSource,
  /@sdkwork\/birdcoder-chat-contracts/,
  'pc-types chat message view kinds must align with shared chat contracts.',
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
  /BIRDCODER_CODE_ENGINE_KEYS/,
  'engine transcript plugins must cover all built-in code engines.',
);
assert.match(
  enginePluginsSource,
  /flex w-full min-w-0 max-w-full flex-col/,
  'engine transcript plugin wrappers must shrink inside narrow code and sidebar surfaces.',
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
  /call\.serverName[\s\S]*call\.name/,
  'MCP tool rows must render a compact server/tool identity.',
);
assert.match(
  toolCallCardSource,
  /aria-expanded=\{isExpanded\}/,
  'tool call detail rows must expose their expansion state.',
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
  /MAX_TOOL_CALL_DETAIL_PREVIEW_CHARACTERS = 24_000/,
  'expanded tool details must cap rendered content to protect transcript responsiveness.',
);
assert.match(
  toolCallCardSource,
  /copyMessageToClipboard\(call\.output \?\? ''\)/,
  'truncated tool output must retain a full-content copy action.',
);
assert.match(
  replyRenderersSource,
  /<ContentBlockList view=\{view\} context=\{context\} \/>/,
  'message renderers must render standardized content blocks instead of ad-hoc fields.',
);
assert.match(
  replyRenderersSource,
  /RoleHeader/,
  'reply renderers must show role-specific headers for planner/reviewer/tool/system views.',
);
assert.match(
  contentBlockRenderersSource,
  /data-chat-system-notice=\{block\.noticeKind\}/,
  'provider lifecycle messages must render as dedicated compact status rows.',
);
assert.match(
  replyRenderersSource,
  /context\.showMessageActions && !isProtocolNotice/,
  'passive provider lifecycle notices must not expose reply actions.',
);

console.log('chat message renderer contract passed.');
